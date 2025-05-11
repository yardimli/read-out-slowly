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
				$sanitizedText = preg_replace('/-+/', '-', $sanitizedText);   // Collapse multiple hyphens
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
	<style>
      body {
          padding-bottom: 100px;
      }
      #displayText {
          font-size: 1.5em;
          padding: 15px;
          border: 1px solid #eee;
          border-radius: 5px;
          min-height: 100px;
          background-color: #f9f9f9;
          white-space: pre-wrap; /* Handles newlines correctly */
      }
      .highlight {
          background-color: yellow;
          font-weight: bold;
      }
      .modal-body .list-group-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
      }
      .modal-body .list-group-item .text-preview {
          flex-grow: 1;
          margin-right: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
      }
      #aiPreviewArea {
          white-space: pre-wrap;
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #ccc;
          padding: 10px;
          background-color: #f8f9fa;
      }
	</style>
</head>
<body>
<div class="container mt-4">
	<h1>Read Out Slowly Tool</h1>

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

	<div class="row align-items-center mb-3">
		<div class="col-md-4">
			<label for="wordsPerChunkInput" class="form-label">Words per chunk to read:</label>
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
</div>

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script>
	document.addEventListener('DOMContentLoaded', () => {
		const mainTextarea = document.getElementById('mainTextarea');
		const toggleTextareaBtn = document.getElementById('toggleTextareaBtn');
		const aiPromptInput = document.getElementById('aiPromptInput');
		const generateAiTextBtn = document.getElementById('generateAiTextBtn');
		const aiPreviewArea = document.getElementById('aiPreviewArea');
		const useAiTextBtn = document.getElementById('useAiTextBtn');
		const saveToStorageBtn = document.getElementById('saveToStorageBtn');
		// const loadFromStorageBtn = document.getElementById('loadFromStorageBtn'); // Already declared by its use with data-bs-toggle
		const savedTextsList = document.getElementById('savedTextsList');
		const wordsPerChunkInput = document.getElementById('wordsPerChunkInput');
		const voiceSelect = document.getElementById('voiceSelect');
		const volumeInput = document.getElementById('volumeInput');
		const displayText = document.getElementById('displayText');
		const speakNextBtn = document.getElementById('speakNextBtn');
		const playAllBtn = document.getElementById('playAllBtn');
		const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');
		const audioPlayer = document.getElementById('audioPlayer');
		const statusMessage = document.getElementById('statusMessage');

		let currentTextPosition = 0;
		let audioCache = {}; // Store { textHash: audioUrl }
		let isPlaying = false;
		let playAllAbortController = null;
		let newTextLoadedForSinglePlay = true; // Flag to clear displayText for single chunk play

		const showStatus = (message, type = 'info', duration = 3000) => {
			statusMessage.textContent = message;
			statusMessage.className = `alert alert-${type} mt-2`; // Added mt-2 for spacing
			statusMessage.style.display = 'block';
			if (duration) {
				setTimeout(() => {
					statusMessage.style.display = 'none';
				}, duration);
			}
		};

		// --- Textarea Toggle ---
		toggleTextareaBtn.addEventListener('click', () => {
			if (mainTextarea.style.display === 'none') {
				mainTextarea.style.display = 'block';
				toggleTextareaBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Textarea';
			} else {
				mainTextarea.style.display = 'none';
				toggleTextareaBtn.innerHTML = '<i class="fas fa-eye"></i> Show Textarea';
			}
		});

		// --- AI Text Generation ---
		generateAiTextBtn.addEventListener('click', async () => {
			const prompt = aiPromptInput.value.trim();
			if (!prompt) {
				showStatus('Please enter a prompt for the AI.', 'warning');
				return;
			}
			generateAiTextBtn.disabled = true;
			generateAiTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
			aiPreviewArea.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
			useAiTextBtn.disabled = true;

			try {
				const formData = new FormData();
				formData.append('action', 'generate_text_ai');
				formData.append('prompt', prompt);
				const response = await fetch(window.location.href, {
					method: 'POST',
					body: formData
				});
				const result = await response.json();
				if (result.success && result.text) {
					aiPreviewArea.innerHTML = result.text.replace(/\n/g, '<br>');
					useAiTextBtn.disabled = false;
				} else {
					aiPreviewArea.textContent = 'Error: ' + (result.message || 'Could not generate text.');
					showStatus('AI generation failed: ' + (result.message || 'Unknown error'), 'danger');
				}
			} catch (error) {
				aiPreviewArea.textContent = 'Error: ' + error.message;
				showStatus('AI generation error: ' + error.message, 'danger');
			} finally {
				generateAiTextBtn.disabled = false;
				generateAiTextBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate';
			}
		});

		useAiTextBtn.addEventListener('click', () => {
			const textToUse = aiPreviewArea.innerHTML.replace(/<br\s*\/?>/gi, '\n');
			mainTextarea.value = textToUse;
			currentTextPosition = 0;
			newTextLoadedForSinglePlay = true; // Signal to clear displayText on next single play
			bootstrap.Modal.getInstance(document.getElementById('aiGenerateModal')).hide();
			showStatus('Text loaded into textarea.', 'success');
		});

		// --- LocalStorage ---
		const getSavedTexts = () => JSON.parse(localStorage.getItem('readOutSlowlyTexts')) || [];
		const saveTexts = (texts) => localStorage.setItem('readOutSlowlyTexts', JSON.stringify(texts));

		saveToStorageBtn.addEventListener('click', () => {
			const text = mainTextarea.value.trim();
			if (!text) {
				showStatus('Textarea is empty. Nothing to save.', 'warning');
				return;
			}
			const texts = getSavedTexts();
			const defaultName = text.substring(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? "..." : "");
			const name = prompt("Enter a name for this text:", defaultName);
			if (name === null) return; // User cancelled prompt

			texts.push({
				id: Date.now().toString(),
				name: name || defaultName,
				text: text
			});
			saveTexts(texts);
			showStatus('Text saved to LocalStorage!', 'success');
		});

		const populateLoadModal = () => {
			const texts = getSavedTexts();
			savedTextsList.innerHTML = '';
			if (texts.length === 0) {
				savedTextsList.innerHTML = '<li class="list-group-item">No texts saved yet.</li>';
				return;
			}
			texts.sort((a,b) => b.id - a.id); // Show newest first
			texts.forEach(item => {
				const li = document.createElement('li');
				li.className = 'list-group-item';

				const textPreview = document.createElement('span');
				textPreview.className = 'text-preview';
				textPreview.textContent = `${item.name}`;
				textPreview.title = `Preview: ${item.text.substring(0, 200).replace(/\n/g, ' ')}...`;


				const btnGroup = document.createElement('div');
				btnGroup.className = 'btn-group';

				const loadBtn = document.createElement('button');
				loadBtn.className = 'btn btn-sm btn-outline-primary';
				loadBtn.innerHTML = '<i class="fas fa-download"></i> Load';
				loadBtn.onclick = () => {
					mainTextarea.value = item.text;
					currentTextPosition = 0;
					newTextLoadedForSinglePlay = true; // Signal to clear displayText
					bootstrap.Modal.getInstance(document.getElementById('localStorageLoadModal')).hide();
					showStatus(`Text "${item.name}" loaded.`, 'success');
				};

				const deleteBtn = document.createElement('button');
				deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
				deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
				deleteBtn.onclick = () => {
					if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
						const updatedTexts = texts.filter(t => t.id !== item.id);
						saveTexts(updatedTexts);
						populateLoadModal();
						showStatus(`Text "${item.name}" deleted.`, 'info');
					}
				};

				btnGroup.appendChild(loadBtn);
				btnGroup.appendChild(deleteBtn);
				li.appendChild(textPreview);
				li.appendChild(btnGroup);
				savedTextsList.appendChild(li);
			});
		};
		document.getElementById('localStorageLoadModal').addEventListener('show.bs.modal', populateLoadModal);


		// --- Text Chunking and Speech ---
		const getNextChunk = () => {
			const fullText = mainTextarea.value;
			if (currentTextPosition >= fullText.length && fullText.length > 0) { // Check fullText.length to allow reset if empty
				showStatus('End of text reached.', 'info');
				currentTextPosition = 0; // Reset for next time
				newTextLoadedForSinglePlay = true; // Allow clearing display if they play again
				return null;
			}
			if (fullText.length === 0) {
				showStatus('Textarea is empty.', 'warning');
				return null;
			}


			const wordsToRead = parseInt(wordsPerChunkInput.value) || 10;
			const remainingText = fullText.substring(currentTextPosition);

			let wordsInChunk = 0;
			let chunkEndIndex = 0;
			let inWord = false;

			for (let i = 0; i < remainingText.length; i++) {
				const char = remainingText[i];
				if (char.match(/\s/)) {
					if (inWord) {
						wordsInChunk++;
					}
					inWord = false;
				} else {
					inWord = true;
				}
				chunkEndIndex = i;
				if (wordsInChunk >= wordsToRead) {
					while (i + 1 < remainingText.length && !remainingText[i + 1].match(/\s/)) {
						i++;
						chunkEndIndex = i;
					}
					break;
				}
			}
			if (inWord && wordsInChunk < wordsToRead) { // Count last word if loop ends
				wordsInChunk++;
			}

			let chunk = remainingText.substring(0, chunkEndIndex + 1);
			if (chunk.trim() === "") return null;

			const newPosition = currentTextPosition + chunk.length;
			return { text: chunk, newPosition: newPosition }; // Return original spacing for display
		};

		const simpleHash = (str) => {
			let hash = 0;
			for (let i = 0; i < str.length; i++) {
				const char = str.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash |= 0;
			}
			return 'h' + Math.abs(hash).toString(36) + str.length;
		};

		const playAudio = (url, onEndedCallback, onPlayStartCallback) => {
			audioPlayer.src = url;
			audioPlayer.play()
				.then(() => {
					isPlaying = true;
					speakNextBtn.disabled = true;
					playAllBtn.disabled = true;
					stopPlaybackBtn.style.display = 'inline-block';
					if (onPlayStartCallback) onPlayStartCallback();
				})
				.catch(error => {
					console.error("Error playing audio:", error);
					showStatus("Error playing audio: " + error.message, 'danger');
					isPlaying = false;
					speakNextBtn.disabled = false;
					playAllBtn.disabled = false;
					stopPlaybackBtn.style.display = 'none';
					if (onEndedCallback) onEndedCallback(error); // Signal error to onEnded
				});

			audioPlayer.onended = () => {
				isPlaying = false;
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
				stopPlaybackBtn.style.display = 'none';
				// Highlight removal is handled by caller
				if (onEndedCallback) onEndedCallback();
			};

			audioPlayer.onerror = (e) => {
				console.error("Audio player error:", e);
				showStatus("Audio player error. Check console.", 'danger');
				isPlaying = false;
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
				stopPlaybackBtn.style.display = 'none';
				if (onEndedCallback) onEndedCallback(e); // Signal error to onEnded
			};
		};

		const stopCurrentPlayback = () => {
			audioPlayer.pause();
			audioPlayer.currentTime = 0;
			audioPlayer.src = "";
			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.style.display = 'none';
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
			if (playAllAbortController) {
				playAllAbortController.abort();
				playAllAbortController = null;
			}
		};
		stopPlaybackBtn.addEventListener('click', stopCurrentPlayback);

		const getAndPlayAudio = async (textChunk, onEndedCallback, onPlayStartCallback) => {
			if (!textChunk || textChunk.trim() === "") {
				if (onEndedCallback) onEndedCallback();
				return;
			}
			const trimmedTextChunk = textChunk.trim();
			const chunkHash = simpleHash(trimmedTextChunk + voiceSelect.value + volumeInput.value);

			if (audioCache[chunkHash]) {
				showStatus(`Playing cached audio for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
				playAudio(audioCache[chunkHash], onEndedCallback, onPlayStartCallback);
				return;
			}

			showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null);
			speakNextBtn.disabled = true;
			playAllBtn.disabled = true;

			try {
				const formData = new FormData();
				formData.append('action', 'text_to_speech_chunk');
				formData.append('text_chunk', trimmedTextChunk); // Send trimmed text
				formData.append('voice', voiceSelect.value);
				formData.append('volume', volumeInput.value);

				const response = await fetch(window.location.href, {
					method: 'POST',
					body: formData
				});
				const result = await response.json();

				if (result.success && result.fileUrl) {
					audioCache[chunkHash] = result.fileUrl;
					showStatus('TTS generated. Playing...', 'success', 1500);
					playAudio(result.fileUrl, onEndedCallback, onPlayStartCallback);
				} else {
					showStatus('TTS Error: ' + (result.message || 'Unknown error'), 'danger');
					if (onEndedCallback) onEndedCallback(new Error(result.message || 'TTS failed'));
					// Re-enable buttons if TTS fails before playAudio is called
					speakNextBtn.disabled = false;
					playAllBtn.disabled = false;
				}
			} catch (error) {
				console.error("TTS request error:", error);
				showStatus('TTS Request Error: ' + error.message, 'danger');
				if (onEndedCallback) onEndedCallback(error);
				// Re-enable buttons on catch
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
			}
		};

		speakNextBtn.addEventListener('click', () => {
			if (isPlaying) return;
			stopCurrentPlayback(); // Stop any existing playback before starting new

			const chunkData = getNextChunk();
			if (chunkData) {
				if (newTextLoadedForSinglePlay) {
					displayText.innerHTML = ''; // Clear display for new text session
					newTextLoadedForSinglePlay = false;
				}

				const chunkId = 'chunk-' + Date.now(); // Unique ID for this chunk span
				// Append new chunk. Use text with original spacing for display.
				const newChunkHtml = `<span id="${chunkId}">${chunkData.text.replace(/\n/g, '<br>')}</span>`;
				displayText.insertAdjacentHTML('beforeend', newChunkHtml + '<br>'); // Add space/break after chunk
				displayText.scrollTop = displayText.scrollHeight; // Scroll to bottom

				currentTextPosition = chunkData.newPosition;
				const currentChunkSpan = document.getElementById(chunkId);

				getAndPlayAudio(chunkData.text.trim(), // Send trimmed text for TTS
					() => { // onEnded
						if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
					},
					() => { // onPlayStart
						document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
						if (currentChunkSpan) currentChunkSpan.classList.add('highlight');
					}
				);
			} else {
				// getNextChunk handles "end of text" message and resets.
				// If it returned null because textarea is empty, it also shows a message.
				if(mainTextarea.value.trim().length > 0 && currentTextPosition === 0) {
					// This means end of text was reached and reset, user clicked again.
					// newTextLoadedForSinglePlay is true, so it will clear and start over.
					// Let the next call to getNextChunk handle it.
				} else if (mainTextarea.value.trim().length === 0) {
					displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
				} else {
					displayText.innerHTML = "End of text. Load new text or click again to restart.";
				}
			}
		});

		mainTextarea.addEventListener('input', () => {
			currentTextPosition = 0;
			newTextLoadedForSinglePlay = true; // Signal to clear displayText on next single play
			displayText.innerHTML = "Text changed. Click 'Speak Next Chunk' or 'Play All'.";
		});

		// --- Play All ---
		const playAllChunks = async () => {
			if (isPlaying) return;
			stopCurrentPlayback();

			playAllAbortController = new AbortController();
			const signal = playAllAbortController.signal;

			const fullText = mainTextarea.value;
			if (!fullText.trim()) {
				showStatus('Textarea is empty.', 'warning');
				return;
			}

			displayText.innerHTML = ''; // Clear display area initially

			let tempPosition = 0;
			const chunksToPlay = []; // Array of {text: "trimmed chunk text", originalChunk: "chunk with original spacing", id: "span-id"}
			let highlightedTextHtml = ""; // To build the full text with spans

			// 1. Prepare all chunks and the HTML for display
			let chunkIndex = 0;
			while(tempPosition < fullText.length) {
				const wordsToRead = parseInt(wordsPerChunkInput.value) || 10;
				const remainingText = fullText.substring(tempPosition);
				let wordsInChunk = 0;
				let chunkEndIndex = 0;
				let inWord = false;

				for (let i = 0; i < remainingText.length; i++) {
					const char = remainingText[i];
					if (char.match(/\s/)) { if (inWord) wordsInChunk++; inWord = false; }
					else { inWord = true; }
					chunkEndIndex = i;
					if (wordsInChunk >= wordsToRead) {
						while(i + 1 < remainingText.length && !remainingText[i+1].match(/\s/)) { i++; chunkEndIndex = i; }
						break;
					}
				}
				if (inWord && wordsInChunk < wordsToRead) wordsInChunk++;

				let originalChunkText = remainingText.substring(0, chunkEndIndex + 1);
				if (originalChunkText.trim() === "") { // Avoid empty chunks if only whitespace remains
					if (tempPosition + originalChunkText.length >= fullText.length) break; // End of text
					tempPosition += originalChunkText.length; // Skip whitespace
					continue;
				}

				const chunkId = `playall-chunk-${chunkIndex}`;
				chunksToPlay.push({
					text: originalChunkText.trim(), // For TTS
					originalChunk: originalChunkText, // For display
					id: chunkId
				});
				highlightedTextHtml += `<span id="${chunkId}">${originalChunkText.replace(/\n/g, '<br>')}</span>`;

				tempPosition += originalChunkText.length;
				chunkIndex++;
				if (tempPosition >= fullText.length) break;
			}

			if (chunksToPlay.length === 0) {
				showStatus('No speakable chunks found.', 'info');
				displayText.innerHTML = "No speakable content found in the textarea.";
				return;
			}

			isPlaying = true;
			speakNextBtn.disabled = true;
			playAllBtn.disabled = true;
			stopPlaybackBtn.style.display = 'inline-block';

			let isFullTextInDOM = false;

			for (let i = 0; i < chunksToPlay.length; i++) {
				if (signal.aborted) {
					showStatus('Playback stopped.', 'info');
					break;
				}
				const currentChunkData = chunksToPlay[i];

				try {
					await new Promise((resolve, reject) => {
						if (signal.aborted) {
							reject(new DOMException('Aborted', 'AbortError'));
							return;
						}
						getAndPlayAudio(currentChunkData.text, // TTS uses trimmed text
							(err) => { // onEnded
								const playedChunkSpan = document.getElementById(currentChunkData.id);
								if (playedChunkSpan) playedChunkSpan.classList.remove('highlight');
								if (err) reject(err); else resolve();
							},
							() => { // onPlayStart
								if (!isFullTextInDOM) {
									displayText.innerHTML = highlightedTextHtml;
									isFullTextInDOM = true;
								}
								document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
								const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
								if (currentChunkSpanInDOM) {
									currentChunkSpanInDOM.classList.add('highlight');
									currentChunkSpanInDOM.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
								}
							}
						);
						signal.addEventListener('abort', () => {
							audioPlayer.pause();
							reject(new DOMException('Aborted', 'AbortError'));
						});
					});
				} catch (error) {
					if (error.name === 'AbortError') {
						showStatus('Playback stopped by user.', 'info');
					} else {
						showStatus(`Error playing chunk ${i + 1}: ${error.message}`, 'danger');
						console.error(`Error playing chunk ${i + 1}:`, error);
					}
					break;
				}
			}

			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.style.display = 'none';
			if (!signal.aborted && chunksToPlay.length > 0) {
				showStatus('Finished playing all chunks.', 'success');
				displayText.innerHTML = "Playback complete. Load new text or play again.";
			} else if (chunksToPlay.length === 0 && !signal.aborted) {
				displayText.innerHTML = "No content to play.";
			}
			playAllAbortController = null;
			newTextLoadedForSinglePlay = true; // Reset for single play mode
		};

		playAllBtn.addEventListener('click', playAllChunks);
	});
</script>
</body>
</html>
