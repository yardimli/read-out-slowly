<?php
	session_start(); // Ensure session is started at the very beginning

	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\SimplifiedLlmAudioHelper;
	use Dotenv\Dotenv;
	use GuzzleHttp\Client as GuzzleClient;

	// For reCAPTCHA verification

	// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	// --- Configuration for the Helper ---
	$config = [
		'log_directory' => __DIR__ . '/' . ($_ENV['LOG_DIRECTORY'] ?? 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . ($_ENV['PUBLIC_STORAGE_PATH_BASEDIR'] ?? 'public'),
		'public_url_segment' => $_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public',
		'app_url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
		'ffmpeg_path' => $_ENV['FFMPEG_PATH'] ?? 'ffmpeg'
	];
	SimplifiedLlmAudioHelper::init($config);

	// --- reCAPTCHA Verification Function (Updated for v2) ---
	function verifyRecaptchaToken(string $token, string $secretKey, ?string $ip = null): array
	{
		if (empty($secretKey)) {
			SimplifiedLlmAudioHelper::log('ERROR', 'reCAPTCHA v2 secret key is not configured.');
			return ['success' => false, 'message' => 'Verification system error. Secret key missing.'];
		}
		if (empty($token)) {
			SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA v2 token not provided by client.');
			return ['success' => false, 'message' => 'Verification token missing. Please complete the challenge.'];
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
			$response = $client->post($verifyUrl, [
				'form_params' => $payload,
				'timeout' => 10 // Timeout in seconds
			]);
			$body = json_decode((string)$response->getBody(), true);
			if ($body === null || !isset($body['success'])) {
				SimplifiedLlmAudioHelper::log('ERROR', 'reCAPTCHA v2 verification response invalid JSON or missing success field.', ['response_body' => substr((string)$response->getBody(), 0, 200)]);
				return ['success' => false, 'message' => 'Invalid verification response from Google.'];
			}
			SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA v2 verification result.', [
				'success' => $body['success'],
				'hostname' => $body['hostname'] ?? 'N/A',
				'challenge_ts' => $body['challenge_ts'] ?? 'N/A',
				'error-codes' => $body['error-codes'] ?? []
			]);
			if ($body['success']) {
				return ['success' => true, 'message' => 'reCAPTCHA v2 verified.'];
			} else {
				$errorCodes = isset($body['error-codes']) ? implode(', ', $body['error-codes']) : 'N/A';
				SimplifiedLlmAudioHelper::log('WARNING', 'reCAPTCHA v2 verification failed by Google.', ['error_codes' => $errorCodes, 'client_ip' => $ip]);
				$userMessage = 'Human verification failed.';
				if (!empty($body['error-codes'])) {
					if (in_array('timeout-or-duplicate', $body['error-codes'])) {
						$userMessage .= ' The token timed out or was already used.';
					} elseif (in_array('bad-request', $body['error-codes'])) {
						$userMessage .= ' The request was invalid. Please try again.';
					} else {
						$userMessage .= ' Errors: ' . $errorCodes;
					}
				}
				return ['success' => false, 'message' => $userMessage];
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'Exception during reCAPTCHA v2 verification: ' . $e->getMessage());
			return ['success' => false, 'message' => 'Server error during verification. Please try again later.'];
		}
	}

	// --- Handle AJAX Requests ---
	if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
		header('Content-Type: application/json');
		$response = ['success' => false, 'message' => 'Invalid action'];

		// --- reCAPTCHA Verification ---
		$recaptchaToken = $_POST['g-recaptcha-response'] ?? '';
		$recaptchaSecretKey = $_ENV['RECAPTCHA_V2_CHECKBOX_SECRET_KEY'] ?? '';
		$clientIp = $_SERVER['REMOTE_ADDR'] ?? null;
		$actionsRequiringRecaptcha = ['generate_text_ai', 'text_to_speech_chunk'];

		$actionIsTts = ($_POST['action'] === 'text_to_speech_chunk');
		$skipRecaptchaCheck = false;

		// Check if TTS action and session is already verified for TTS
		if ($actionIsTts && isset($_SESSION['recaptcha_tts_verified']) && $_SESSION['recaptcha_tts_verified'] === true) {
			SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA v2 check skipped for TTS (session already verified).', ['action' => $_POST['action']]);
			$skipRecaptchaCheck = true;
		}

		if (in_array($_POST['action'], $actionsRequiringRecaptcha) && !$skipRecaptchaCheck) {
			if (empty($recaptchaSecretKey)) {
				SimplifiedLlmAudioHelper::log('CRITICAL', 'reCAPTCHA v2 secret key not configured for a protected action.', ['action' => $_POST['action']]);
				echo json_encode(['success' => false, 'message' => 'Security system misconfiguration. Action blocked.']);
				exit;
			}
			$verificationResult = verifyRecaptchaToken($recaptchaToken, $recaptchaSecretKey, $clientIp);
			if (!$verificationResult['success']) {
				SimplifiedLlmAudioHelper::log('NOTICE', 'POST request blocked by reCAPTCHA v2.', [
					'action_attempted' => $_POST['action'],
					'reason' => $verificationResult['message'],
					'client_ip' => $clientIp
				]);
				echo json_encode(['success' => false, 'message' => $verificationResult['message'] . ' Please try solving the challenge again.']);
				exit;
			}
			// If verification was successful AND it was for a TTS action, mark the session
			if ($actionIsTts && $verificationResult['success']) {
				$_SESSION['recaptcha_tts_verified'] = true;
				SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA v2 session marked as verified for TTS.', ['action' => $_POST['action']]);
			}
			SimplifiedLlmAudioHelper::log('INFO', 'reCAPTCHA v2 check passed.', [
				'action_attempted' => $_POST['action'],
				'client_ip' => $clientIp
			]);
		} elseif (!in_array($_POST['action'], $actionsRequiringRecaptcha)) {
			SimplifiedLlmAudioHelper::log('INFO', 'Skipping reCAPTCHA v2 check for action (not required).', ['action' => $_POST['action']]);
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
				$ttsEngine = strtolower($_POST['tts_engine'] ?? ($_ENV['DEFAULT_TTS_ENGINE'] ?? 'openai'));
				$voice = $_POST['voice'] ?? ($ttsEngine === 'openai' ? 'nova' : 'en-US-Studio-O');
				$languageCode = $_POST['language_code'] ?? 'en-US'; // For Google TTS
				$volume = (float)($_POST['volume'] ?? 4.0); // For OpenAI TTS amplification

				$sanitizedText = strtolower(trim($textChunk));
				$sanitizedText = preg_replace('/[^\w\s-]/u', '', $sanitizedText);
				$sanitizedText = preg_replace('/\s+/', '-', $sanitizedText);
				$sanitizedText = preg_replace('/-+/', '-', $sanitizedText);
				$sanitizedText = trim($sanitizedText, '-');
				if (strlen($sanitizedText) > 30) {
					$sanitizedText = mb_substr($sanitizedText, 0, 30);
					$sanitizedText = trim($sanitizedText, '-');
				}
				if (empty($sanitizedText)) {
					$sanitizedText = 'tts-' . substr(md5($textChunk), 0, 8);
				}
				$filenameBase = $ttsEngine . '-' . preg_replace('/[^a-z0-9_-]/i', '', $voice) . '-' . $sanitizedText;

				$ttsResponse = SimplifiedLlmAudioHelper::textToSpeech(
					$textChunk,
					$voice,
					$filenameBase,
					$volume,
					$ttsEngine,
					$languageCode
				);

				if ($ttsResponse['success']) {
					$response = [
						'success' => true,
						'fileUrl' => $ttsResponse['fileUrl'],
						'message' => $ttsResponse['message'],
						// Include flag indicating session reCAPTCHA status for TTS
						'recaptcha_session_verified' => (isset($_SESSION['recaptcha_tts_verified']) && $_SESSION['recaptcha_tts_verified'] === true)
					];
				} else {
					$response = ['success' => false, 'message' => 'TTS generation failed: ' . ($ttsResponse['message'] ?? 'Unknown error')];
				}
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'AJAX Action Exception (post-reCAPTCHA): ' . $e->getMessage() . ' Trace: ' . substr($e->getTraceAsString(), 0, 500));
			$response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
		}
		echo json_encode($response);
		exit;
	}
?>
