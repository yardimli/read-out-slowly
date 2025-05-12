<?php
	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\SimplifiedLlmAudioHelper;
	use Dotenv\Dotenv;
	use GuzzleHttp\Client as GuzzleClient; // For reCAPTCHA verification

// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

// --- Configuration for the Helper ---
	$config = [
		'log_directory' => __DIR__ . '/' . ($_ENV['LOG_DIRECTORY'] ?? 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . ($_ENV['PUBLIC_STORAGE_PATH_BASEDIR'] ?? 'public'),
		'app_url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
		'ffmpeg_path' => $_ENV['FFMPEG_PATH'] ?? 'ffmpeg'
	];
	SimplifiedLlmAudioHelper::init($config);


// --- reCAPTCHA Verification Function ---
	function verifyRecaptchaToken(string $token, string $secretKey, ?string $ip = null, float $scoreThreshold = 0.5): array {
		if (empty($secretKey)) {
			SimplifiedLlmAudioHelper::log('ERROR', 'reCAPTCHA secret key is not configured.');
			// For security, don't reveal too much, but log it.
			return ['success' => false, 'message' => 'Verification system error.', 'score' => 0];
		}
		if (empty($token)) {
			SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA token not provided by client.');
			return ['success' => false, 'message' => 'Verification token missing.', 'score' => 0];
		}

		$client = new GuzzleClient();
		$verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

		$payload = [
			'secret' => $secretKey,
			'response' => $token,
		];
		if ($ip) {
			$payload['remoteip'] = $ip;
		}

		try {
			$response = $client->post($verifyUrl, ['form_params' => $payload, 'timeout' => 10]);
			$body = json_decode((string) $response->getBody(), true);

			if ($body === null || !isset($body['success'])) {
				SimplifiedLlmAudioHelper::log('ERROR', 'reCAPTCHA verification response invalid JSON or missing success field.', ['response_body' => substr((string) $response->getBody(), 0, 200)]);
				return ['success' => false, 'message' => 'Invalid verification response.', 'score' => 0];
			}

			SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA verification result.', [
				'success' => $body['success'],
				'score' => $body['score'] ?? 'N/A',
				'action' => $body['action'] ?? 'N/A',
				'hostname' => $body['hostname'] ?? 'N/A',
				'challenge_ts' => $body['challenge_ts'] ?? 'N/A',
				'error-codes' => $body['error-codes'] ?? []
			]);

			// Check if the action matches what you expect for this request (optional but recommended)
			// Example: if ($_POST['action'] === 'generate_text_ai' && $body['action'] !== 'generate_ai_text') { ... }

			if ($body['success'] && isset($body['score']) && $body['score'] >= $scoreThreshold) {
				return ['success' => true, 'message' => 'reCAPTCHA verified.', 'score' => (float) $body['score'], 'action' => $body['action'] ?? 'unknown'];
			} elseif ($body['success'] && isset($body['score'])) { // Success true, but score too low
				SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA score below threshold.', ['score' => $body['score'], 'threshold' => $scoreThreshold, 'action' => $body['action'] ?? 'unknown', 'client_ip' => $ip]);
				return ['success' => false, 'message' => 'Human verification score too low.', 'score' => (float) $body['score']];
			} else { // Success false
				$errorCodes = isset($body['error-codes']) ? implode(', ', $body['error-codes']) : 'N/A';
				SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA verification failed by Google.', ['error_codes' => $errorCodes, 'client_ip' => $ip]);
				return ['success' => false, 'message' => 'Human verification failed. Errors: ' . $errorCodes, 'score' => $body['score'] ?? 0];
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'Exception during reCAPTCHA verification: ' . $e->getMessage());
			return ['success' => false, 'message' => 'Server error during verification.', 'score' => 0];
		}
	}


// --- Handle AJAX Requests ---
	if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
		header('Content-Type: application/json');
		$response = ['success' => false, 'message' => 'Invalid action'];

		// --- reCAPTCHA Verification ---
		$recaptchaToken = $_POST['g-recaptcha-response'] ?? '';
		$recaptchaSecretKey = $_ENV['RECAPTCHA_V3_SECRET_KEY'] ?? '';
		$clientIp = $_SERVER['REMOTE_ADDR'] ?? null;
		$recaptchaScoreThreshold = (float)($_ENV['RECAPTCHA_V3_SCORE_THRESHOLD'] ?? 0.5);

		// For critical actions, ensure RECAPTCHA_V3_SECRET_KEY is set
		if (empty($recaptchaSecretKey) && ($_POST['action'] === 'generate_text_ai' || $_POST['action'] === 'text_to_speech_chunk')) {
			SimplifiedLlmAudioHelper::log('CRITICAL', 'reCAPTCHA secret key not configured for a protected action.', ['action' => $_POST['action']]);
			echo json_encode([
				'success' => false,
				'message' => 'Security system misconfiguration. Action blocked.'
			]);
			exit;
		}

		// Only perform reCAPTCHA check if secret key is available (allows disabling for local dev if needed by not setting key)
		if (!empty($recaptchaSecretKey)) {
			$verificationResult = verifyRecaptchaToken($recaptchaToken, $recaptchaSecretKey, $clientIp, $recaptchaScoreThreshold);

			if (!$verificationResult['success']) {
				SimplifiedLlmAudioHelper::log('NOTICE', 'POST request blocked by reCAPTCHA.', [
					'action_attempted' => $_POST['action'],
					'reason' => $verificationResult['message'],
					'score' => $verificationResult['score'],
					'client_ip' => $clientIp
				]);
				echo json_encode([
					'success' => false,
					'message' => 'Human verification failed: ' . $verificationResult['message'] . ' Please try again or contact support if this persists.'
				]);
				exit;
			}
			SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA check passed.', [
				'action_attempted' => $_POST['action'],
				'recaptcha_action_name' => $verificationResult['action'] ?? 'N/A',
				'score' => $verificationResult['score'],
				'client_ip' => $clientIp
			]);
		} else {
			SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA secret key not set. Skipping verification. This should only occur in development.', ['action' => $_POST['action']]);
		}


		try {
			if ($_POST['action'] === 'generate_text_ai') {
				$prompt = $_POST['prompt'] ?? 'Write a short, interesting paragraph about space exploration.';
				$system_prompt = "You are a helpful assistant that writes engaging content based on user prompts. Keep responses concise unless asked for more detail.";
				$llm_model = $_ENV['DEFAULT_LLM_FOR_SIMPLE_HELPER'] ?? 'mistralai/mistral-7b-instruct';
				$llmResponse = SimplifiedLlmAudioHelper::sendTextToLlm($llm_model, $system_prompt, $prompt, 1);
				if ($llmResponse['success']) {
					$response = ['success' => true, 'text' => $llmResponse['content']];
				} else {
					$response = ['success' => false, 'message' => 'AI generation failed: ' . ($llmResponse['error'] ?? 'Unknown error')];
				}
			} elseif ($_POST['action'] === 'text_to_speech_chunk') {
				$textChunk = $_POST['text_chunk'] ?? '';
				if (empty(trim($textChunk))) {
					echo json_encode(['success' => false, 'message' => 'Text chunk cannot be empty.']);
					exit;
				}
				$voice = $_POST['voice'] ?? 'nova';
				$volume = (float)($_POST['volume'] ?? 4.0);
				$sanitizedText = strtolower($textChunk);
				$sanitizedText = preg_replace('/[^\w\s-]/', '', $sanitizedText);
				$sanitizedText = preg_replace('/\s+/', '-', $sanitizedText);
				$sanitizedText = preg_replace('/-+/', '-', $sanitizedText);
				$sanitizedText = trim($sanitizedText, '-');
				if (strlen($sanitizedText) > 50) {
					$sanitizedText = substr($sanitizedText, 0, 50);
					$sanitizedText = trim($sanitizedText, '-');
				}
				if (empty($sanitizedText)) {
					$sanitizedText = 'tts-' . substr(md5($textChunk), 0, 8);
				}
				$filenameBase = $voice . '-' . $sanitizedText;
				$ttsResponse = SimplifiedLlmAudioHelper::textToSpeechOpenAI($textChunk, $voice, $filenameBase, $volume);
				if ($ttsResponse['success']) {
					$response = [
						'success' => true,
						'fileUrl' => $ttsResponse['fileUrl'],
						'message' => $ttsResponse['message']
					];
				} else {
					$response = ['success' => false, 'message' => 'TTS generation failed: ' . ($ttsResponse['message'] ?? 'Unknown error')];
				}
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'AJAX Action Exception (post-reCAPTCHA): ' . $e->getMessage() . ' Trace: ' . substr($e->getTraceAsString(),0,500));
			$response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
		}
		echo json_encode($response);
		exit;
	}
?>
