<?php
	require __DIR__ . '/vendor/autoload.php';
	use App\Helpers\SimplifiedLlmAudioHelper;
	use Dotenv\Dotenv;

	// Load environment variables from .env file
	$dotenv = Dotenv::createImmutable(__DIR__);
	$dotenv->load();

	// --- Configuration for the Helper ---
	// These paths are relative to this index.php script
	$config = [
		'log_directory' => __DIR__ . '/' . ($_ENV['LOG_DIRECTORY'] ?? 'storage/logs'),
		'public_storage_path' => __DIR__ . '/' . ($_ENV['PUBLIC_STORAGE_PATH_BASEDIR'] ?? 'public'), // Base directory for storage
		'app_url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
		'ffmpeg_path' => $_ENV['FFMPEG_PATH'] ?? 'ffmpeg'
	];

	// Initialize the helper (and its logger)
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
				$voice = $_POST['voice'] ?? 'nova';
				$volume = (float)($_POST['volume'] ?? 4.0);

				// Generate a filename base from voice and sanitized text
				$sanitizedText = strtolower($textChunk);
				$sanitizedText = preg_replace('/[^\w\s-]/', '', $sanitizedText); // Allow words, spaces, hyphens
				$sanitizedText = preg_replace('/\s+/', '-', $sanitizedText); // Replace spaces with hyphens
				$sanitizedText = preg_replace('/-+/', '-', $sanitizedText);  // Collapse multiple hyphens
				$sanitizedText = trim($sanitizedText, '-');
				if (strlen($sanitizedText) > 50) { // Max length for text part of filename
					$sanitizedText = substr($sanitizedText, 0, 50);
					$sanitizedText = trim($sanitizedText, '-'); // Trim again if cut left a hyphen
				}
				if (empty($sanitizedText)) { // Handle cases where text becomes empty after sanitization
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
			// Use the static log method from the helper if available, or error_log
			if (class_exists('App\Helpers\SimplifiedLlmAudioHelper') && method_exists('App\Helpers\SimplifiedLlmAudioHelper', 'log')) {
				SimplifiedLlmAudioHelper::log('ERROR', 'AJAX Action Exception: ' . $e->getMessage() . ' Trace: ' . $e->getTraceAsString());
			} else {
				error_log('AJAX Action Exception: ' . $e->getMessage());
			}
			$response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
		}

		echo json_encode($response);
		exit;
	}
?>
