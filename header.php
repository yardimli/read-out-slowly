<?php
	session_start(); // Ensure session is started at the very beginning

// Check if user is verified
	if (!isset($_SESSION['is_human_verified']) || $_SESSION['is_human_verified'] !== true) {
		// For AJAX requests, return error JSON
		if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) &&
			strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
			header('Content-Type: application/json');
			echo json_encode([
				'success' => false,
				'message' => 'Human verification required. Please reload the page.',
				'require_verification' => true
			]);
			exit;
		}

		// For regular requests, redirect to verification page
		header('Location: verification.php');
		exit;
	}

	require __DIR__ . '/vendor/autoload.php';
	use App\Helpers\SimplifiedLlmAudioHelper;
	use Dotenv\Dotenv;

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

// --- Handle AJAX Requests ---
	if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
		header('Content-Type: application/json');
		$response = ['success' => false, 'message' => 'Invalid action'];

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
						'recaptcha_session_verified' => true
					];
				} else {
					$response = ['success' => false, 'message' => 'TTS generation failed: ' . ($ttsResponse['message'] ?? 'Unknown error')];
				}
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'AJAX Action Exception: ' . $e->getMessage() . ' Trace: ' . substr($e->getTraceAsString(), 0, 500));
			$response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
		}

		echo json_encode($response);
		exit;
	}
?>
