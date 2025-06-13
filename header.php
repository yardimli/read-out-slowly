<?php
	session_start(); // Ensure session is started at the very beginning

	require __DIR__ . '/vendor/autoload.php';

	use App\Helpers\SimplifiedLlmAudioHelper;
	use App\Helpers\AuthHelper;
	use App\Helpers\Database;
	use Dotenv\Dotenv;

	// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	// Initialize Database connection
	Database::getConnection();

	// Check if user is logged in. If not, redirect to login page.
	// This protects all pages that include this header.
	if (!AuthHelper::isLoggedIn()) {
		// For AJAX requests, return an authentication error
		if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
			header('Content-Type: application/json');
			// Use a 401 Unauthorized status code
			http_response_code(401);
			echo json_encode([
				'success' => false,
				'message' => 'Authentication required. Please login again.',
				'require_verification' => true // This can trigger a page reload on the client
			]);
			exit;
		}
		// For regular page loads, redirect to the login page
		header('Location: login.php');
		exit;
	}


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
	// The login check above already protects this section
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
						'message' => $ttsResponse['message']
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
