<?php include_once 'header.php'; ?>
<!DOCTYPE html>
<html lang="en"> <!-- data-bs-theme will be set here by JS -->
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
	<h3>Read Out Slowly Tool</h3>

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
			<div class="row align-items-end mb-3">
				<div class="col-md-2">
					<label for="chunkUnitSelect" class="form-label">Chunk by:</label>
					<select id="chunkUnitSelect" class="form-select">
						<option value="words" selected>Words</option>
						<option value="sentences">Sentences</option>
					</select>
				</div>
				<div class="col-md-3">
					<label for="wordsPerChunkInput" class="form-label">Words per chunk (approx):</label>
					<input type="number" id="wordsPerChunkInput" class="form-control" value="10" min="1">
				</div>
				<div class="col-md-2">
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
				<div class="col-md-3">
					<label for="volumeInput" class="form-label">Volume Boost (1-10):</label>
					<input type="number" id="volumeInput" class="form-control" value="6" min="0.1" max="10" step="0.5">
				</div>
				<div class="col-md-2">
					<label for="displayTextFontSizeInput" class="form-label">Font Size:</label>
					<input type="number" id="displayTextFontSizeInput" class="form-control" value="40" min="8" max="100" step="1">
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

	<div class="d-flex flex-wrap align-items-center" id="mainControlsContainer">
		<button class="btn btn-info me-2 mb-2" data-bs-toggle="modal" data-bs-target="#aiGenerateModal">
			<i class="fas fa-robot"></i> Generate with AI
		</button>
		<button id="saveToStorageBtn" class="btn btn-success me-2 mb-2">
			<i class="fas fa-save"></i> Save to LocalStorage
		</button>
		<button id="loadFromStorageBtn" class="btn btn-warning me-2 mb-2" data-bs-toggle="modal" data-bs-target="#localStorageLoadModal">
			<i class="fas fa-upload"></i> Load from LocalStorage
		</button>
		<button id="pregenerateAllBtn" class="btn btn-secondary me-2 mb-2">
			<i class="fas fa-cogs"></i> Pregenerate All Audio
		</button>
		<button id="toggleControlsBtn" class="btn btn-outline-secondary me-2 mb-2">
			<i class="fas fa-eye-slash"></i> Hide Controls
		</button>
		<!-- Dark Mode Switch -->
		<div class="form-check form-switch ms-auto mb-2"> <!-- ms-auto pushes it to the right, mb-2 for alignment with other buttons if they wrap -->
			<input class="form-check-input" type="checkbox" role="switch" id="darkModeSwitch" style="cursor: pointer; transform: scale(1.2);">
			<label class="form-check-label" for="darkModeSwitch" style="cursor: pointer;">Dark Mode</label>
		</div>
	</div>
	<div class="mb-3">
		<span class="text-muted">After hiding the controls double click the header to show them again.</span>
	</div>

	<div class="mb-3">
		<label for="mainTextarea" class="form-label">Enter or generate text below:</label>
		<textarea id="mainTextarea" class="form-control" rows="10" placeholder="Type or paste your text here..."></textarea>
	</div>

	<!-- Display Text Area in a Card -->
	<div class="card mb-3" id="displayTextCard">
		<div class="card-body">
			<div id="displayText">
				Text chunks will appear here...
			</div>
		</div>
	</div>

	<audio id="audioPlayer" style="display: none;"></audio>
	<div id="statusMessage" class="alert alert-info" style="display:none;"></div>

	<!-- Playback Controls Container - Will be fixed to bottom -->
	<div id="playbackControlsContainer">
		<button id="speakNextBtn" class="btn btn-lg btn-primary me-2">
			<i class="fas fa-play-circle"></i> Continue Speaking Out Loud
		</button>
		<button id="playAllBtn" class="btn btn-lg btn-success me-2">
			<i class="fas fa-forward"></i> Play All
		</button>
		<button id="stopPlaybackBtn" class="btn btn-lg btn-danger" disabled>
			<i class="fas fa-stop-circle"></i> Stop
		</button>
	</div>

	<!-- Hold Spinner Overlay -->
	<div id="holdSpinnerOverlay" style="display: none;">
		<div id="holdSpinner">
			<span id="holdSpinnerProgressText">0%</span>
		</div>
	</div>
</div>

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/ui-manager.js"></script>
<script src="public/js/playback-manager.js"></script>
<script src="public/js/script.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
