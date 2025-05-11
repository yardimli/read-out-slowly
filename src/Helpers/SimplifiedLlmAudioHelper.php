<?php namespace App\Helpers;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Exception; // Keep standard Exception class

class SimplifiedLlmAudioHelper { // Added class keyword
	// private static ?Logger $logger = null; // Remove Monolog logger
	private static string $logFilePath = ''; // Path for our simple log file
	private static bool $loggingEnabled = true; // Control logging
	private static string $appUrl = 'http://localhost';
	private static string $publicStorageBasePath = 'public';
	private static string $ffmpegPath = 'ffmpeg';

	/**
	 * Initializes the helper, particularly the logger and config.
	 * Call this once before using other methods.
	 */
	public static function init(array $config = []): void {
		// Initialize Simple Logger
		$logDirectory = $config['log_directory'] ?? __DIR__ . '/../../storage/logs'; // Default log directory
		if (!is_dir($logDirectory)) {
			if (!mkdir($logDirectory, 0775, true) && !is_dir($logDirectory)) {
				// Fallback if directory creation fails, disable logging
				self::$loggingEnabled = false;
				error_log("LlmAudioHelper: CRITICAL - Failed to create log directory: {$logDirectory}. Logging disabled.");
			}
		}

		if (self::$loggingEnabled && is_writable($logDirectory)) {
			self::$logFilePath = rtrim($logDirectory, '/') . '/log-' . date('Y-m-d') . '.log';
		} else {
			self::$loggingEnabled = false; // Disable if directory not writable
			if ($logDirectory && self::$loggingEnabled) { // Only log error if a directory was attempted and logging was initially enabled
				error_log("LlmAudioHelper: CRITICAL - Log directory '{$logDirectory}' is not writable. Logging disabled.");
			}
		}

		// Load other configurations
		self::$appUrl = $config['app_url'] ?? self::$appUrl;
		self::$publicStorageBasePath = rtrim($config['public_storage_path'] ?? self::$publicStorageBasePath, '/');
		self::$ffmpegPath = $config['ffmpeg_path'] ?? self::$ffmpegPath;
		self::log('INFO', 'SimplifiedLlmAudioHelper initialized.');
		self::log('DEBUG', 'Config loaded: ' . json_encode($config));
	}

	// Simple internal logging function
	private static function log(string $level, string $message, $context = null): void {
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

	private static function getOpenRouterKey_internal(): ?string {
		return $_ENV['OPEN_ROUTER_API_KEY'] ?? null;
	}

	public static function sendTextToLlm(
		string $llm_model,
		string $system_prompt,
		string $user_prompt,
		int $max_retries = 1
	): array {
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
		$temperature = (float) ($_ENV['LLM_HELPER_TEMPERATURE'] ?? 0.7);
		$max_tokens = (int) ($_ENV['LLM_HELPER_MAX_TOKENS'] ?? 4096);

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
					if(is_array($decoded_response['error']) && isset($decoded_response['error']['status'])) {
						$status_code_from_error = (int) $decoded_response['error']['status'];
					} elseif (is_array($decoded_response['error']) && isset($decoded_response['error']['code']) && is_numeric($decoded_response['error']['code'])) {
						$status_code_from_error = (int) $decoded_response['error']['code'];
					}
					if ($attempt > $max_retries || ($status_code_from_error && $status_code_from_error >= 400 && $status_code_from_error < 500 && $status_code_from_error != 429) ) {
						break;
					}
					sleep(2 + $attempt);
					continue;
				}

				if (isset($decoded_response['choices'][0]['message']['content'])) {
					$llm_response_content = $decoded_response['choices'][0]['message']['content'];
					$prompt_tokens = $decoded_response['usage']['prompt_tokens'] ?? 0;
					$completion_tokens = $decoded_response['usage']['completion_tokens'] ?? 0;
				} elseif (isset($decoded_response['content'][0]['text'])) { // Anthropic Claude
					$llm_response_content = $decoded_response['content'][0]['text'];
					$prompt_tokens = $decoded_response['usage']['input_tokens'] ?? $decoded_response['usage']['prompt_tokens'] ?? 0;
					$completion_tokens = $decoded_response['usage']['output_tokens'] ?? $decoded_response['usage']['completion_tokens'] ?? 0;
				} elseif (isset($decoded_response['candidates'][0]['content']['parts'][0]['text'])) { // Google Gemini
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
				break; // Success
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
				self::log('ERROR', $last_error_message . ' Trace: ' . substr($e->getTraceAsString(),0, 500));
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
				'prompt_tokens' => (int) $prompt_tokens,
				'completion_tokens' => (int) $completion_tokens
			];
		} else {
			self::log('ERROR', "SimplifiedLlmAudioHelper::sendTextToLlm failed after {$max_retries} retries. Last error: {$last_error_message}");
			return [
				'success' => false,
				'content' => null,
				'error' => $last_error_message,
				'prompt_tokens' => (int) $prompt_tokens,
				'completion_tokens' => (int) $completion_tokens
			];
		}
	}

	private static function _amplifyMp3Volume_internal(string $inputFile, string $outputFile, float $volumeLevel = 2.0, string $bitrate = '128k'): bool {
		if (!file_exists($inputFile)) {
			self::log('ERROR', "Amplify (internal): Input file does not exist: {$inputFile}");
			return false;
		}
		$volumeLevel = max(0.1, (float)$volumeLevel); // Ensure volume is positive
		$outputDir = dirname($outputFile);
		if (!is_dir($outputDir)) {
			if (!mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
				self::log('ERROR', "Amplify (internal): Failed to create output directory: {$outputDir}");
				return false;
			}
		}

		if (file_exists($outputFile)) {
			unlink($outputFile); // Remove existing output file before processing
		}

		// Create a temporary file for the first amplification step
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

		// Now apply silence removal to the temporary amplified file, outputting to the final $outputFile
		$silenceRemoveCommand = sprintf(
			'%s -y -i %s -af "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:detection=peak,areverse" -c:a libmp3lame -b:a %s %s',
			escapeshellarg(self::$ffmpegPath),
			escapeshellarg($tempAmplifiedFile),
			$bitrate,
			escapeshellarg($outputFile) // Final output file
		);
		self::log('INFO', "Executing FFMPEG silence removal command: {$silenceRemoveCommand}");
		exec($silenceRemoveCommand . ' 2>&1', $silenceOutput, $silenceReturnCode);

		if (file_exists($tempAmplifiedFile)) {
			unlink($tempAmplifiedFile); // Clean up temporary file
		}

		if ($silenceReturnCode !== 0) {
			self::log('ERROR', "Amplify (internal): Failed to remove silence.", ['command' => $silenceRemoveCommand, 'return_code' => $silenceReturnCode, 'output' => implode("\n", $silenceOutput)]);
			return false;
		}

		self::log('INFO', "Amplify (internal): Successfully processed audio to {$outputFile}");
		return true;
	}

	public static function textToSpeechOpenAI(
		string $text,
		string $voiceName = 'alloy',
		string $outputFilenameBase = 'openai_tts_output', // Expects something like "voice-textbasedname"
		float $volumeLevel = 4.0
	): array {
		$apiKey = $_ENV['OPENAI_API_KEY'] ?? null;
		if (empty($apiKey)) {
			self::log('ERROR', 'OpenAI API key is not configured for textToSpeechOpenAI.');
			return ['success' => false, 'storage_path' => null, 'fileUrl' => null, 'message' => 'OpenAI API key not configured.'];
		}

		$openAiModel = $_ENV['OPENAI_TTS_MODEL'] ?? 'tts-1';
		// Store files in a subdirectory based on the voice
		$directory = 'tts/openai/' . preg_replace('/[^a-z0-9_-]/i', '', $voiceName); // Sanitize voice name for directory
		$fullDirectoryPath = rtrim(self::$publicStorageBasePath, '/') . '/' . $directory;

		// Use the provided base name for both raw and amplified files
		$rawOutputFilename = $outputFilenameBase . '_raw.mp3';
		$amplifiedOutputFilename = $outputFilenameBase . '_amplified.mp3';

		$fullAmplifiedPathOnDisk = $fullDirectoryPath . '/' . $amplifiedOutputFilename;
		$relativeAmplifiedStoragePath = $directory . '/' . $amplifiedOutputFilename;

		// --- Check if amplified file already exists ---
		if (file_exists($fullAmplifiedPathOnDisk) && filesize($fullAmplifiedPathOnDisk) > 0) {
			self::log('INFO', "TTS audio already exists (amplified): {$fullAmplifiedPathOnDisk}");
			return [
				'success' => true,
				'storage_path' => $relativeAmplifiedStoragePath,
				'fileUrl' => rtrim(self::$appUrl, '/') . '/' . trim(($_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public'), '/') . "/" . $relativeAmplifiedStoragePath,
				'message' => 'TTS audio retrieved from cache.',
			];
		}

		// --- Create directory if not exists ---
		if (!is_dir($fullDirectoryPath)) {
			if(!mkdir($fullDirectoryPath, 0775, true) && !is_dir($fullDirectoryPath)) {
				self::log('ERROR', "Failed to create TTS directory: {$fullDirectoryPath}");
				return ['success' => false, 'storage_path' => null, 'fileUrl' => null, 'message' => "Failed to create TTS directory."];
			}
		}

		$fullRawPathOnDisk = $fullDirectoryPath . '/' . $rawOutputFilename;
		$relativeRawStoragePath = $directory . '/' . $rawOutputFilename;

		self::log('INFO', "SimplifiedLlmAudioHelper::textToSpeechOpenAI called.", ['voice' => $voiceName, 'model' => $openAiModel, 'text_snippet' => substr($text, 0, 70) . "..."]);

		try {
			$input_text = trim($text);
			if (strlen($input_text) > 0 && strlen($input_text) < 50 && !preg_match('/[.!?]$/', $input_text)) {
				$input_text .= '.'; // Add punctuation for short sentences if missing
			}
			if (empty($input_text)) {
				throw new Exception("Input text for TTS cannot be empty.");
			}

			$client = new Client();
			$response = $client->post('https://api.openai.com/v1/audio/speech', [
				'headers' => [
					'Authorization' => 'Bearer ' . $apiKey,
					'Content-Type' => 'application/json',
				],
				'json' => [
					'model' => $openAiModel,
					'input' => $input_text,
					'voice' => $voiceName,
					'response_format' => 'mp3',
				],
				'timeout' => 90, // seconds
				'stream' => true // Important for getting the body as a stream
			]);

			if ($response->getStatusCode() !== 200) {
				$errorMessage = "OpenAI TTS API request failed. Status: " . $response->getStatusCode();
				$errorBody = $response->getBody()->getContents(); // Read body for error
				self::log('ERROR', $errorMessage . " Body: " . $errorBody);
				$decodedError = json_decode($errorBody, true);
				if (isset($decodedError['error']['message'])) {
					$errorMessage .= " Message: " . $decodedError['error']['message'];
				}
				throw new Exception($errorMessage);
			}

			if (file_exists($fullRawPathOnDisk)) {
				unlink($fullRawPathOnDisk);
			}
			$saved = file_put_contents($fullRawPathOnDisk, $response->getBody()->getContents());
			if ($saved === false) {
				throw new Exception("Failed to save raw OpenAI TTS audio to disk at {$fullRawPathOnDisk}. Check permissions.");
			}
			self::log('INFO', "Raw OpenAI TTS audio saved to: {$fullRawPathOnDisk}");

			// Amplification
			if (file_exists($fullAmplifiedPathOnDisk)) {
				unlink($fullAmplifiedPathOnDisk);
			}
			$amplified = self::_amplifyMp3Volume_internal($fullRawPathOnDisk, $fullAmplifiedPathOnDisk, $volumeLevel);

			if (!$amplified) {
				self::log('WARNING', "Failed to amplify OpenAI TTS audio. Using raw audio instead.", ['raw_path' => $fullRawPathOnDisk]);
				// Optionally, delete the raw file if we don't want to serve it unamplified
				// unlink($fullRawPathOnDisk);
				// For now, let's return the raw one if amplification fails but raw was saved.
				if (file_exists($fullRawPathOnDisk)) {
					return [
						'success' => true, // Technically TTS worked
						'storage_path' => $relativeRawStoragePath,
						'fileUrl' => rtrim(self::$appUrl, '/') . '/' . trim(($_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public'), '/') . "/" . $relativeRawStoragePath,
						'message' => 'OpenAI TTS generated, but amplification failed. Raw audio provided.',
					];
				}
				throw new Exception("Failed to amplify audio and raw audio is also unavailable.");
			}

			// Optionally remove the raw file after successful amplification
			// if (file_exists($fullRawPathOnDisk)) {
			//     unlink($fullRawPathOnDisk);
			// }

			self::log('INFO', "OpenAI TTS and amplification successful.", ['amplified_file' => $fullAmplifiedPathOnDisk]);
			return [
				'success' => true,
				'storage_path' => $relativeAmplifiedStoragePath,
				'fileUrl' => rtrim(self::$appUrl, '/') . '/' . trim(($_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public'), '/') . "/" . $relativeAmplifiedStoragePath,
				'message' => 'OpenAI TTS generated and amplified successfully.',
			];

		} catch (Exception $e) {
			self::log('ERROR', "SimplifiedLlmAudioHelper::textToSpeechOpenAI Error: " . $e->getMessage(), [
				'exception_trace_snippet' => substr($e->getTraceAsString(), 0, 500),
				'text_snippet' => substr($text, 0, 100) . '...',
				'voice' => $voiceName,
			]);
			return [
				'success' => false,
				'storage_path' => null,
				'fileUrl' => null,
				'message' => "OpenAI TTS generation/amplification failed: " . $e->getMessage(),
			];
		}
	}
}
