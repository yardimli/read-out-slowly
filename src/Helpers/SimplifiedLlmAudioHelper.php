<?php

	namespace App\Helpers;

	use GuzzleHttp\Client;
	use GuzzleHttp\Exception\RequestException;
	use Exception;

// Add Google Cloud TextToSpeech client
	use Google\Cloud\TextToSpeech\V1\AudioConfig;
	use Google\Cloud\TextToSpeech\V1\AudioEncoding;
	use Google\Cloud\TextToSpeech\V1\SynthesisInput;
	use Google\Cloud\TextToSpeech\V1\TextToSpeechClient;
	use Google\Cloud\TextToSpeech\V1\VoiceSelectionParams;


	class SimplifiedLlmAudioHelper
	{
		private static string $logFilePath = '';
		private static bool $loggingEnabled = true;
		private static string $appUrl = 'http://localhost';
		private static string $publicStorageBasePath = 'public'; // Base directory for public files, e.g., __DIR__ . '/../../public'
		private static string $publicUrlSegment = 'public'; // URL segment for public files, e.g., 'public' if files are at example.com/public/tts...
		private static string $ffmpegPath = 'ffmpeg';

		public static function init(array $config = []): void
		{
			$logDirectory = $config['log_directory'] ?? __DIR__ . '/../../storage/logs';
			if (!is_dir($logDirectory)) {
				if (!mkdir($logDirectory, 0775, true) && !is_dir($logDirectory)) {
					self::$loggingEnabled = false;
					error_log("LlmAudioHelper: CRITICAL - Failed to create log directory: {$logDirectory}. Logging disabled.");
				}
			}
			if (self::$loggingEnabled && is_writable($logDirectory)) {
				self::$logFilePath = rtrim($logDirectory, '/') . '/log-' . date('Y-m-d') . '.log';
			} else {
				self::$loggingEnabled = false;
				if ($logDirectory && self::$loggingEnabled) {
					error_log("LlmAudioHelper: CRITICAL - Log directory '{$logDirectory}' is not writable. Logging disabled.");
				}
			}

			self::$appUrl = $config['app_url'] ?? self::$appUrl;
			// Ensure publicStorageBasePath is an absolute path
			self::$publicStorageBasePath = rtrim($config['public_storage_path'] ?? (__DIR__ . '/../../public'), '/');
			self::$publicUrlSegment = trim($config['public_url_segment'] ?? 'public', '/');
			self::$ffmpegPath = $config['ffmpeg_path'] ?? self::$ffmpegPath;

			self::log('INFO', 'SimplifiedLlmAudioHelper initialized.');
			self::log('DEBUG', 'Config loaded: AppURL=' . self::$appUrl . ', StorageBasePath=' . self::$publicStorageBasePath . ', PublicURLSegment=' . self::$publicUrlSegment);
		}

		public static function log(string $level, string $message, $context = null): void
		{
			if (!self::$loggingEnabled || empty(self::$logFilePath)) {
				if (strtoupper($level) === 'ERROR' || strtoupper($level) === 'CRITICAL') {
					error_log("LlmAudioHelper [{$level}]: {$message}" . ($context ? " | Context: " . (is_array($context) || is_object($context) ? json_encode($context) : $context) : ''));
				}
				return;
			}
			$timestamp = date('Y-m-d H:i:s');
			$logEntry = "[{$timestamp}] [{$level}] {$message}";
			if ($context !== null) {
				$logEntry .= " | Context: " . (is_array($context) || is_object($context) ? json_encode($context) : $context);
			}
			$logEntry .= PHP_EOL;
			@file_put_contents(self::$logFilePath, $logEntry, FILE_APPEND | LOCK_EX);
		}

		private static function getOpenRouterKey_internal(): ?string
		{
			return $_ENV['OPEN_ROUTER_API_KEY'] ?? null;
		}

		public static function sendTextToLlm(string $llm_model, string $system_prompt, string $user_prompt, int $max_retries = 1): array
		{
			set_time_limit(300);
			$llm_base_url = $_ENV['OPEN_ROUTER_BASE'] ?? 'https://openrouter.ai/api/v1/chat/completions';
			$llm_api_key = self::getOpenRouterKey_internal();
			if (empty($llm_model)) {
				$llm_model = $_ENV['DEFAULT_LLM_FOR_SIMPLE_HELPER'] ?? 'mistralai/mistral-7b-instruct';
			}
			if (empty($llm_api_key)) {
				self::log('ERROR', "OpenRouter API Key is not configured for sendTextToLlm.");
				return ['success' => false, 'content' => null, 'error' => 'API key not configured', 'prompt_tokens' => 0, 'completion_tokens' => 0];
			}
			$messages = [];
			if (!empty($system_prompt)) {
				$messages[] = ['role' => 'system', 'content' => $system_prompt];
			}
			$messages[] = ['role' => 'user', 'content' => $user_prompt];
			$temperature = (float)($_ENV['LLM_HELPER_TEMPERATURE'] ?? 0.7);
			$max_tokens = (int)($_ENV['LLM_HELPER_MAX_TOKENS'] ?? 4096);
			$data = [
				'model' => $llm_model,
				'messages' => $messages,
				'temperature' => $temperature,
				'max_tokens' => $max_tokens,
				'stream' => false,
			];
			self::log('INFO', "SimplifiedLlmAudioHelper::sendTextToLlm Request to {$llm_base_url} (Model: {$llm_model})");
			self::log('DEBUG', "SimplifiedLlmAudioHelper::sendTextToLlm Request Data: ", $data);
			$attempt = 0;
			$llm_response_content = null;
			$prompt_tokens = 0;
			$completion_tokens = 0;
			$last_error_message = 'LLM call failed after retries.';
			while ($attempt <= $max_retries && $llm_response_content === null) {
				$attempt++;
				self::log('INFO', "SimplifiedLlmAudioHelper::sendTextToLlm Call Attempt: {$attempt} for model {$llm_model}");
				try {
					$client = new Client(['timeout' => 180.0]);
					$headers = [
						'Content-Type' => 'application/json',
						'Authorization' => 'Bearer ' . $llm_api_key,
						'HTTP-Referer' => self::$appUrl,
						'X-Title' => $_ENV['APP_NAME'] ?? 'Standalone App',
					];
					$response = $client->post($llm_base_url, [
						'headers' => $headers,
						'json' => $data,
					]);
					$responseBody = $response->getBody()->getContents();
					self::log('INFO', "SimplifiedLlmAudioHelper::sendTextToLlm Response Status: " . $response->getStatusCode() . " (Attempt {$attempt})");
					self::log('DEBUG', "SimplifiedLlmAudioHelper::sendTextToLlm Raw Response Body (Attempt {$attempt}): " . substr($responseBody, 0, 500));
					$decoded_response = json_decode($responseBody, true);
					if (json_last_error() !== JSON_ERROR_NONE) {
						$last_error_message = "Failed to decode LLM JSON response: " . json_last_error_msg();
						self::log('ERROR', $last_error_message . " Raw response causing error: " . $responseBody);
						if ($attempt > $max_retries) break;
						sleep(2 + $attempt);
						continue;
					}
					if (isset($decoded_response['error'])) {
						$api_error_message = is_array($decoded_response['error']) ? ($decoded_response['error']['message'] ?? json_encode($decoded_response['error'])) : $decoded_response['error'];
						$last_error_message = "LLM API Error: " . $api_error_message;
						self::log('ERROR', $last_error_message);
						$status_code_from_error = null;
						if (is_array($decoded_response['error']) && isset($decoded_response['error']['status'])) {
							$status_code_from_error = (int)$decoded_response['error']['status'];
						} elseif (is_array($decoded_response['error']) && isset($decoded_response['error']['code']) && is_numeric($decoded_response['error']['code'])) {
							$status_code_from_error = (int)$decoded_response['error']['code'];
						}
						if ($attempt > $max_retries || ($status_code_from_error && $status_code_from_error >= 400 && $status_code_from_error < 500 && $status_code_from_error != 429)) {
							break;
						}
						sleep(2 + $attempt);
						continue;
					}
					if (isset($decoded_response['choices'][0]['message']['content'])) {
						$llm_response_content = $decoded_response['choices'][0]['message']['content'];
						$prompt_tokens = $decoded_response['usage']['prompt_tokens'] ?? 0;
						$completion_tokens = $decoded_response['usage']['completion_tokens'] ?? 0;
					} elseif (isset($decoded_response['content'][0]['text'])) {
						$llm_response_content = $decoded_response['content'][0]['text'];
						$prompt_tokens = $decoded_response['usage']['input_tokens'] ?? $decoded_response['usage']['prompt_tokens'] ?? 0;
						$completion_tokens = $decoded_response['usage']['output_tokens'] ?? $decoded_response['usage']['completion_tokens'] ?? 0;
					} elseif (isset($decoded_response['candidates'][0]['content']['parts'][0]['text'])) {
						$llm_response_content = $decoded_response['candidates'][0]['content']['parts'][0]['text'];
						$prompt_tokens = $decoded_response['usageMetadata']['promptTokenCount'] ?? 0;
						$completion_tokens = $decoded_response['usageMetadata']['candidatesTokenCount'] ?? $decoded_response['usageMetadata']['totalTokenCount'] ?? 0;
						if ($completion_tokens > 0 && $prompt_tokens > 0 && isset($decoded_response['usageMetadata']['totalTokenCount'])) {
							$completion_tokens = $decoded_response['usageMetadata']['totalTokenCount'] - $prompt_tokens;
						}
					} else {
						$last_error_message = "Could not find content in LLM response structure.";
						self::log('ERROR', $last_error_message . " Full response: " . json_encode($decoded_response));
						if ($attempt > $max_retries) break;
						sleep(2 + $attempt);
						continue;
					}
					break;
				} catch (RequestException $e) {
					$statusCode = $e->hasResponse() ? $e->getResponse()->getStatusCode() : 'N/A';
					$errorBody = $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : $e->getMessage();
					$last_error_message = "Guzzle HTTP Request Exception (Attempt {$attempt}): Status {$statusCode} - " . substr($errorBody, 0, 300);
					self::log('ERROR', "Full Guzzle Error: " . $e->getMessage());
					if ($attempt > $max_retries || ($statusCode !== 'N/A' && $statusCode >= 400 && $statusCode < 500 && $statusCode != 429)) {
						break;
					}
					sleep(pow(2, $attempt));
				} catch (Exception $e) {
					$last_error_message = "General Exception during LLM call (Attempt {$attempt}): " . $e->getMessage();
					self::log('ERROR', $last_error_message . ' Trace: ' . substr($e->getTraceAsString(), 0, 500));
					if ($attempt > $max_retries) break;
					sleep(pow(2, $attempt));
				}
			}
			if ($llm_response_content !== null) {
				self::log('INFO', "SimplifiedLlmAudioHelper::sendTextToLlm Success. Prompt Tokens: {$prompt_tokens}, Completion Tokens: {$completion_tokens}");
				return [
					'success' => true,
					'content' => $llm_response_content,
					'error' => null,
					'prompt_tokens' => (int)$prompt_tokens,
					'completion_tokens' => (int)$completion_tokens
				];
			} else {
				self::log('ERROR', "SimplifiedLlmAudioHelper::sendTextToLlm failed after {$max_retries} retries. Last error: {$last_error_message}");
				return [
					'success' => false,
					'content' => null,
					'error' => $last_error_message,
					'prompt_tokens' => (int)$prompt_tokens,
					'completion_tokens' => (int)$completion_tokens
				];
			}
		}

		private static function _amplifyMp3Volume_internal(string $inputFile, string $outputFile, float $volumeLevel = 2.0, string $bitrate = '128k'): bool
		{
			if (!file_exists($inputFile)) {
				self::log('ERROR', "Amplify (internal): Input file does not exist: {$inputFile}");
				return false;
			}
			$volumeLevel = max(0.1, (float)$volumeLevel);
			$outputDir = dirname($outputFile);
			if (!is_dir($outputDir)) {
				if (!mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
					self::log('ERROR', "Amplify (internal): Failed to create output directory: {$outputDir}");
					return false;
				}
			}
			if (file_exists($outputFile)) {
				unlink($outputFile);
			}
			$tempAmplifiedFile = $outputDir . '/' . bin2hex(random_bytes(5)) . '_temp_amplified.mp3';
			$amplifyCommand = sprintf(
				'%s -y -i %s -filter:a "volume=%.2f" -c:a libmp3lame -b:a %s %s',
				escapeshellarg(self::$ffmpegPath),
				escapeshellarg($inputFile),
				$volumeLevel,
				$bitrate,
				escapeshellarg($tempAmplifiedFile)
			);
			self::log('INFO', "Executing FFMPEG amplify command: {$amplifyCommand}");
			exec($amplifyCommand . ' 2>&1', $amplifyOutput, $amplifyReturnCode);
			if ($amplifyReturnCode !== 0) {
				self::log('ERROR', "Amplify (internal): Failed to amplify volume.", ['command' => $amplifyCommand, 'return_code' => $amplifyReturnCode, 'output' => implode("\n", $amplifyOutput)]);
				if (file_exists($tempAmplifiedFile)) unlink($tempAmplifiedFile);
				return false;
			}
			$silenceRemoveCommand = sprintf(
				'%s -y -i %s -af "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:detection=peak,areverse" -c:a libmp3lame -b:a %s %s',
				escapeshellarg(self::$ffmpegPath),
				escapeshellarg($tempAmplifiedFile),
				$bitrate,
				escapeshellarg($outputFile)
			);
			self::log('INFO', "Executing FFMPEG silence removal command: {$silenceRemoveCommand}");
			exec($silenceRemoveCommand . ' 2>&1', $silenceOutput, $silenceReturnCode);
			if (file_exists($tempAmplifiedFile)) {
				unlink($tempAmplifiedFile);
			}
			if ($silenceReturnCode !== 0) {
				self::log('ERROR', "Amplify (internal): Failed to remove silence.", ['command' => $silenceRemoveCommand, 'return_code' => $silenceReturnCode, 'output' => implode("\n", $silenceOutput)]);
				return false;
			}
			self::log('INFO', "Amplify (internal): Successfully processed audio to {$outputFile}");
			return true;
		}

		/**
		 * Generates speech from text using either OpenAI or Google TTS.
		 *
		 * @param string $text The text to synthesize.
		 * @param string $voiceName The voice name (specific to the engine).
		 * @param string $outputFilenameBase Base for the output filename (e.g., "voice-textslug").
		 * @param float $volumeLevel Volume amplification level (primarily for OpenAI).
		 * @param string $engine The TTS engine to use ('openai' or 'google').
		 * @param string $languageCode Language code (e.g., 'en-US', primarily for Google).
		 * @return array Result array with 'success', 'storage_path', 'fileUrl', 'message'.
		 */
		public static function textToSpeech(
			string $text,
			string $voiceName,
			string $outputFilenameBase, // e.g., "nova-hello-world"
			float  $volumeLevel = 4.0,
			string $engine = 'openai',
			string $languageCode = 'en-US'
		): array
		{
			$engine = strtolower($engine ?: ($_ENV['DEFAULT_TTS_ENGINE'] ?? 'openai'));
			$sanitizedVoiceName = preg_replace('/[^a-z0-9_-]/i', '', $voiceName);

			// Directory structure: tts/{engine}/{sanitized_voice_name}/
			$relativeDir = 'tts/' . $engine . '/' . $sanitizedVoiceName;
			$fullDirectoryPath = self::$publicStorageBasePath . '/' . $relativeDir;

			// Ensure directory exists
			if (!is_dir($fullDirectoryPath)) {
				if (!mkdir($fullDirectoryPath, 0775, true) && !is_dir($fullDirectoryPath)) {
					self::log('ERROR', "Failed to create TTS directory: {$fullDirectoryPath}");
					return ['success' => false, 'storage_path' => null, 'fileUrl' => null, 'message' => "Failed to create TTS directory."];
				}
			}

			$finalFileUrl = null;
			$finalRelativePath = null;
			$message = '';

			self::log('INFO', "textToSpeech called.", [
				'engine' => $engine, 'voice' => $voiceName, 'lang_code' => $languageCode,
				'text_snippet' => substr($text, 0, 70) . "...",
				'output_base' => $outputFilenameBase
			]);

			try {
				if ($engine === 'openai') {
					$apiKey = $_ENV['OPENAI_API_KEY'] ?? null;
					if (empty($apiKey)) {
						throw new Exception('OpenAI API key is not configured.');
					}
					$openAiModel = $_ENV['OPENAI_TTS_MODEL'] ?? 'tts-1';

					$rawFilename = $outputFilenameBase . '_raw.mp3';
					$amplifiedFilename = $outputFilenameBase . '_amplified.mp3';

					$fullRawPathOnDisk = $fullDirectoryPath . '/' . $rawFilename;
					$fullAmplifiedPathOnDisk = $fullDirectoryPath . '/' . $amplifiedFilename;

					$relativeRawStoragePath = $relativeDir . '/' . $rawFilename;
					$relativeAmplifiedStoragePath = $relativeDir . '/' . $amplifiedFilename;

					// Check if amplified file already exists
					if (file_exists($fullAmplifiedPathOnDisk) && filesize($fullAmplifiedPathOnDisk) > 0) {
						self::log('INFO', "OpenAI TTS audio already exists (amplified): {$fullAmplifiedPathOnDisk}");
						$finalRelativePath = $relativeAmplifiedStoragePath;
						$message = 'OpenAI TTS audio retrieved from cache (amplified).';
					} else {
						// Prepare input text with prefix/suffix for OpenAI
						$inputText = trim($text);
						$prefix_str = '';
						$suffix_str = '';
						// Only apply prefix/suffix for primarily ASCII text
						if (!preg_match('/[^\x20-\x7E]/', $inputText)) {
							$wordCount = count(preg_split('/\s+/', $inputText, -1, PREG_SPLIT_NO_EMPTY));
							if ($wordCount < 3 && $wordCount > 0) { // Short phrases
								// $prefix_str = '... '; // Can be too much
							}
							if (!preg_match('/[.!?]$/', $inputText) && strlen($inputText) > 0) {
								$suffix_str = '.';
							}
						}
						$finalInputText = $prefix_str . $inputText . $suffix_str;
						if (empty(trim($finalInputText))) {
							throw new Exception("Input text for OpenAI TTS cannot be effectively empty after processing.");
						}


						$client = new Client();
						$response = $client->post('https://api.openai.com/v1/audio/speech', [
							'headers' => [
								'Authorization' => 'Bearer ' . $apiKey,
								'Content-Type' => 'application/json',
							],
							'json' => [
								'model' => $openAiModel,
								'input' => $finalInputText,
								'voice' => $voiceName, // Use original voiceName for API
								'response_format' => 'mp3',
							],
							'timeout' => 90,
							'stream' => true
						]);

						if ($response->getStatusCode() !== 200) {
							$errorBody = $response->getBody()->getContents();
							$decodedError = json_decode($errorBody, true);
							$apiMessage = $decodedError['error']['message'] ?? $errorBody;
							throw new Exception("OpenAI TTS API request failed. Status: " . $response->getStatusCode() . " Message: " . $apiMessage);
						}

						if (file_exists($fullRawPathOnDisk)) unlink($fullRawPathOnDisk);
						$saved = file_put_contents($fullRawPathOnDisk, $response->getBody()->getContents());
						if ($saved === false) {
							throw new Exception("Failed to save raw OpenAI TTS audio to disk at {$fullRawPathOnDisk}.");
						}
						self::log('INFO', "Raw OpenAI TTS audio saved to: {$fullRawPathOnDisk}");

						if (file_exists($fullAmplifiedPathOnDisk)) unlink($fullAmplifiedPathOnDisk);
						$amplified = self::_amplifyMp3Volume_internal($fullRawPathOnDisk, $fullAmplifiedPathOnDisk, $volumeLevel);

						if ($amplified) {
							$finalRelativePath = $relativeAmplifiedStoragePath;
							$message = 'OpenAI TTS generated and amplified successfully.';
							// Optionally remove raw file: if (file_exists($fullRawPathOnDisk)) unlink($fullRawPathOnDisk);
						} else {
							self::log('WARNING', "Failed to amplify OpenAI TTS audio. Using raw audio instead.", ['raw_path' => $fullRawPathOnDisk]);
							$finalRelativePath = $relativeRawStoragePath; // Fallback to raw
							$message = 'OpenAI TTS generated, but amplification failed. Raw audio provided.';
						}
					}
				} elseif ($engine === 'google') {
					$credentialsPath = $_ENV['GOOGLE_APPLICATION_CREDENTIALS'] ?? null;
					if (empty($credentialsPath)) {
						throw new Exception('Google TTS credentials path (GOOGLE_APPLICATION_CREDENTIALS) not set in .env.');
					}
					if (!file_exists($credentialsPath) || !is_readable($credentialsPath)) {
						throw new Exception('Google TTS credentials file not found or not readable: ' . $credentialsPath);
					}

					// Google TTS does not get amplified in this setup, uses .mp3 directly
					$finalFilename = $outputFilenameBase . '.mp3';
					$fullFinalPathOnDisk = $fullDirectoryPath . '/' . $finalFilename;
					$relativeFinalStoragePath = $relativeDir . '/' . $finalFilename;

					if (file_exists($fullFinalPathOnDisk) && filesize($fullFinalPathOnDisk) > 0) {
						self::log('INFO', "Google TTS audio already exists: {$fullFinalPathOnDisk}");
						$finalRelativePath = $relativeFinalStoragePath;
						$message = 'Google TTS audio retrieved from cache.';
					} else {
						$client = new TextToSpeechClient(['credentials' => $credentialsPath]);
						$synthesisInput = (new SynthesisInput())->setText($text);
						$voiceParams = (new VoiceSelectionParams())
							->setLanguageCode($languageCode)
							->setName($voiceName); // Google voice name
						$audioConfig = (new AudioConfig())
							->setAudioEncoding(AudioEncoding::MP3);

						$response = $client->synthesizeSpeech($synthesisInput, $voiceParams, $audioConfig);
						$audioContent = $response->getAudioContent();
						$client->close();

						if (file_exists($fullFinalPathOnDisk)) unlink($fullFinalPathOnDisk);
						$saved = file_put_contents($fullFinalPathOnDisk, $audioContent);
						if ($saved === false) {
							throw new Exception("Failed to save Google TTS audio to disk at {$fullFinalPathOnDisk}.");
						}
						$finalRelativePath = $relativeFinalStoragePath;
						$message = 'Google TTS generated successfully.';
						self::log('INFO', "Google TTS audio saved to: {$fullFinalPathOnDisk}");
					}
				} else {
					throw new Exception("Unsupported TTS engine: {$engine}");
				}

				if ($finalRelativePath) {
					$finalFileUrl = rtrim(self::$appUrl, '/') . '/' . (self::$publicUrlSegment ? self::$publicUrlSegment . '/' : '') . $finalRelativePath;
				}

				return [
					'success' => true,
					'storage_path' => $finalRelativePath,
					'fileUrl' => $finalFileUrl,
					'message' => $message,
				];

			} catch (Exception $e) {
				self::log('ERROR', "textToSpeech Error ({$engine}): " . $e->getMessage(), [
					'exception_trace_snippet' => substr($e->getTraceAsString(), 0, 500),
					'text_snippet' => substr($text, 0, 100) . '...',
					'voice' => $voiceName,
				]);
				return [
					'success' => false,
					'storage_path' => null,
					'fileUrl' => null,
					'message' => "TTS generation failed ({$engine}): " . $e->getMessage(),
				];
			}
		}
	}

