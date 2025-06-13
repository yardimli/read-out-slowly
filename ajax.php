<?php
	session_start(); // Ensure session is started at the very beginning
	error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

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

	// --- Configuration for the Helper ---
	$config = [
		'log_directory' => __DIR__ . '/' . ($_ENV['LOG_DIRECTORY'] ?? 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . ($_ENV['PUBLIC_STORAGE_PATH_BASEDIR'] ?? 'public'),
		'public_url_segment' => $_ENV['PUBLIC_STORAGE_PATH_SEGMENT'] ?? 'public',
		'app_url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
		'ffmpeg_path' => $_ENV['FFMPEG_PATH'] ?? 'ffmpeg'
	];
	SimplifiedLlmAudioHelper::init($config);



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
		echo json_encode([
			'success' => false,
			'message' => 'You must be logged in to access this page.',
			'require_verification' => true // This can trigger a page reload on the client
		]);
		exit;
	}

	if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
		header('Content-Type: application/json');
		$response = ['success' => false, 'message' => 'Invalid action'];
		$userId = $_SESSION['user_id'];

		try {
			switch ($_POST['action']) {
				case 'generate_text_ai':
					$prompt = $_POST['prompt'] ?? 'Write a short, interesting paragraph about space exploration.';
					$system_prompt = "You are a helpful assistant that writes engaging content based on user prompts. Keep responses concise unless asked for more detail.";
					$llm_model = $_ENV['DEFAULT_LLM_FOR_SIMPLE_HELPER'] ?? 'mistralai/mistral-7b-instruct';
					$llmResponse = SimplifiedLlmAudioHelper::sendTextToLlm($llm_model, $system_prompt, $prompt, 1);
					if ($llmResponse['success']) {
						$response = ['success' => true, 'text' => $llmResponse['content']];
					} else {
						$response = ['success' => false, 'message' => 'AI generation failed: ' . ($llmResponse['error'] ?? 'Unknown error')];
					}
					break;

				case 'text_to_speech_chunk':
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
						$textChunk, $voice, $filenameBase, $volume, $ttsEngine, $languageCode
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
					break;

				case 'update_user_setting':
					$key = $_POST['setting_key'] ?? null;
					$value = $_POST['setting_value'] ?? null;

					if ($value !== null) {
						if ($value === 'true') {
							$value = true;
						} elseif ($value === 'false') {
							$value = false;
						}
						elseif (is_numeric($value)) {
							$value = $value + 0;
						}
					}


					if ($key) {
						$success = AuthHelper::updateSetting($userId, $key, $value);
						$response = ['success' => $success, 'message' => $success ? 'Setting updated.' : 'Failed to update setting.'];
					} else {
						$response = ['success' => false, 'message' => 'Setting key not provided.'];
					}
					break;

				case 'get_user_texts':
					$texts = AuthHelper::getTexts($userId);
					$response = ['success' => true, 'texts' => $texts];
					break;

				case 'save_user_text':
					$name = $_POST['name'] ?? 'Untitled';
					$text = $_POST['text'] ?? '';
					if (!empty($text)) {
						$newId = AuthHelper::saveText($userId, $name, $text);
						if ($newId) {
							$response = ['success' => true, 'new_id' => $newId, 'message' => 'Text saved.'];
						} else {
							$response = ['success' => false, 'message' => 'Failed to save text.'];
						}
					} else {
						$response = ['success' => false, 'message' => 'Text cannot be empty.'];
					}
					break;

				case 'delete_user_text':
					$textId = $_POST['text_id'] ?? null;
					if ($textId) {
						$success = AuthHelper::deleteText($userId, (int)$textId);
						$response = ['success' => $success, 'message' => $success ? 'Text deleted.' : 'Failed to delete text or permission denied.'];
					} else {
						$response = ['success' => false, 'message' => 'Text ID not provided.'];
					}
					break;
			}
		} catch (Exception $e) {
			SimplifiedLlmAudioHelper::log('ERROR', 'AJAX Action Exception: ' . $e->getMessage() . ' Trace: ' . substr($e->getTraceAsString(), 0, 500));
			$response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
		}

		echo json_encode($response);
		exit;
	}
