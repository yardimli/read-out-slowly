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
				$sanitizedText = preg_replace('/-+/', '-', $sanitizedText); // Collapse multiple hyphens
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
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Read Out Slowly Enhanced</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="public/css/style.css">
</head>
<body>
<div class="container mt-4">
	<h1>Read Out Slowly Tool</h1>

	<!-- Settings Area -->
	<div class="card mb-3" id="settingsCard">
		<div class="card-header">
			<h5 class="mb-0">Settings</h5>
		</div>
		<div class="card-body">
			<div class="row">
				<div class="col-md-4 mb-3">
					<label for="statusVerbositySelect" class="form-label">Status Messages:</label>
					<select id="statusVerbositySelect" class="form-select">
						<option value="all">Show All</option>
						<option value="errors" selected>Errors & Warnings Only</option>
						<option value="none">Show None</option>
					</select>
				</div>
				<div class="col-md-4 mb-3">
					<label for="speakNextHoldDuration" class="form-label">"Speak Next" Hold Duration (ms):</label>
					<input type="number" id="speakNextHoldDuration" class="form-control" value="750" min="0" step="50">
				</div>
				<div class="col-md-4 mb-3 align-self-center">
					<div class="form-check form-switch">
						<input class="form-check-input" type="checkbox" role="switch" id="togglePlayAllBtnSwitch" checked>
						<label class="form-check-label" for="togglePlayAllBtnSwitch">Show "Play All" Button</label>
					</div>
				</div>
			</div>
			<div class="row align-items-center mb-3">
				<div class="col-md-4">
					<label for="wordsPerChunkInput" class="form-label">Words per chunk (approx):</label>
					<input type="number" id="wordsPerChunkInput" class="form-control" value="15" min="1">
				</div>
				<div class="col-md-4">
					<label for="voiceSelect" class="form-label">TTS Voice:</label>
					<select id="voiceSelect" class="form-select">
						<option value="alloy">Alloy</option>
						<option value="echo">Echo</option>
						<option value="fable">Fable</option>
						<option value="onyx">Onyx</option>
						<option value="nova" selected>Nova</option>
						<option value="shimmer">Shimmer</option>
					</select>
				</div>
				<div class="col-md-4">
					<label for="volumeInput" class="form-label">Volume (1-10, FFMPEG):</label>
					<input type="number" id="volumeInput" class="form-control" value="4" min="0.1" max="10" step="0.1">
				</div>
			</div>
		</div>
	</div>


	<!-- AI Generation Modal -->
	<div class="modal fade" id="aiGenerateModal" tabindex="-1" aria-labelledby="aiGenerateModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="aiGenerateModalLabel">Generate Text with AI</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<div class="mb-3">
						<label for="aiPromptInput" class="form-label">Enter your prompt for the AI:</label>
						<input type="text" class="form-control" id="aiPromptInput" placeholder="e.g., Write a short poem about the ocean">
					</div>
					<button id="generateAiTextBtn" class="btn btn-primary mb-3">
						<i class="fas fa-cogs"></i> Generate
					</button>
					<h6>Preview:</h6>
					<div id="aiPreviewArea" class="p-2 border bg-light rounded" style="min-height: 100px;">
						Click "Generate" to see text here...
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
					<button type="button" class="btn btn-success" id="useAiTextBtn" disabled>
						<i class="fas fa-check-circle"></i> Use This Text
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Load from LocalStorage Modal -->
	<div class="modal fade" id="localStorageLoadModal" tabindex="-1" aria-labelledby="localStorageLoadModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="localStorageLoadModalLabel">Load Text from Local Storage</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<ul id="savedTextsList" class="list-group">
						<!-- Items will be populated by JavaScript -->
					</ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>

	<div class="my-3">
		<button class="btn btn-info" data-bs-toggle="modal" data-bs-target="#aiGenerateModal">
			<i class="fas fa-robot"></i> Generate with AI
		</button>
		<button id="saveToStorageBtn" class="btn btn-success">
			<i class="fas fa-save"></i> Save to LocalStorage
		</button>
		<button id="loadFromStorageBtn" class="btn btn-warning" data-bs-toggle="modal" data-bs-target="#localStorageLoadModal">
			<i class="fas fa-upload"></i> Load from LocalStorage
		</button>
		<button id="toggleTextareaBtn" class="btn btn-secondary">
			<i class="fas fa-eye-slash"></i> Hide Textarea
		</button>
	</div>

	<div class="mb-3">
		<label for="mainTextarea" class="form-label">Enter or generate text below:</label>
		<textarea id="mainTextarea" class="form-control" rows="10" placeholder="Type or paste your text here..."></textarea>
	</div>

	<div id="displayText" class="mb-3">
		Text chunks will appear here...
	</div>

	<div class="mb-3">
		<button id="speakNextBtn" class="btn btn-primary me-2">
			<i class="fas fa-play-circle"></i> Speak Next Chunk
		</button>
		<button id="playAllBtn" class="btn btn-success">
			<i class="fas fa-forward"></i> Play All
		</button>
		<button id="stopPlaybackBtn" class="btn btn-danger" style="display:none;">
			<i class="fas fa-stop-circle"></i> Stop Playback
		</button>
	</div>

	<audio id="audioPlayer" style="display: none;"></audio>
	<div id="statusMessage" class="alert alert-info" style="display:none;"></div>

	<!-- Hold Spinner Overlay -->
	<div id="holdSpinnerOverlay" style="display: none;">
		<div id="holdSpinner">
			<span id="holdSpinnerProgressText">0%</span>
		</div>
	</div>

</div>

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/script.js"></script>
</body>
</html>
