<?php include_once 'header.php'; ?>
<!DOCTYPE html>
<html lang="en"> <!-- data-bs-theme will be set here by JS -->
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Read Out Slowly Enhanced - Settings</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="public/css/style.css">
	<script>
		var recaptchaTtsAlreadyVerified = true;
	</script>
</head>
<body>
<div class="container mt-4">
	<div class="card mb-3" id="settingsCard">
		<div class="card-header">
			<span class="mb-0 fs-5">Read Out Slowly Tool - Text & Settings</span>
			<div class="form-check form-switch float-end">
				<input class="form-check-input" type="checkbox" role="switch" id="darkModeSwitch" style="cursor: pointer; transform: scale(1.2);">
				<label class="form-check-label" for="darkModeSwitch" style="cursor: pointer;">Dark Mode</label>
			</div>

		</div>
		<div class="card-body">
			<div class="row">
				<div class="col-md-3 mb-3">
					<label for="statusVerbositySelect" class="form-label">Status Messages:</label>
					<select id="statusVerbositySelect" class="form-select">
						<option value="all">Show All</option>
						<option value="errors" selected>Errors & Warnings Only</option>
						<option value="none">Show None</option>
					</select>
				</div>
				<div class="col-md-3 mb-3">
					<label for="speakNextHoldDuration" class="form-label">Hold Duration (0 to disable):</label>
					<input type="number" id="speakNextHoldDuration" class="form-control" value="750" min="0" step="50">
				</div>
				<div class="col-md-3 mb-3 align-self-center">
					<div class="form-check form-switch">
						<input class="form-check-input" type="checkbox" role="switch" id="togglePlayAllBtnSwitch" checked>
						<label class="form-check-label" for="togglePlayAllBtnSwitch">Show "Play All" and "Stop"</label>
					</div>
				</div>
				<div class="col-md-3 mb-3 align-self-center">
					<div class="form-check form-switch">
						<input class="form-check-input" type="checkbox" role="switch" id="floatingPlayButtonSwitch">
						<label class="form-check-label" for="floatingPlayButtonSwitch">Float "Continue Read Button"</label>
					</div>
				</div>
			</div>
			<div class="row align-items-end mb-3">
				<div class="col-md-2">
					<label for="chunkUnitSelect" class="form-label">Part by:</label>
					<select id="chunkUnitSelect" class="form-select">
						<option value="words" selected>Words</option>
						<option value="sentences">Sentences</option>
					</select>
				</div>
				<div class="col-md-2">
					<label for="wordsPerChunkInput" class="form-label" id="wordsPerChunkLabel">Words per Part:</label>
					<input type="number" id="wordsPerChunkInput" class="form-control" value="10" min="1"> <!-- Default changed to 10 -->
				</div>
				<div class="col-md-2">
					<label for="displayTextFontSizeInput" class="form-label">Font Size:</label>
					<input type="number" id="displayTextFontSizeInput" class="form-control" value="40" min="8" max="100" step="1">
				</div>
				<div class="col-md-3">
					<label for="unreadTextOpacityInput" class="form-label">Unread Text Opacity:</label>
					<input type="range" id="unreadTextOpacityInput" class="form-range" value="30" min="0" max="100" step="1"  style="max-width:70%;">
					<small class="text-muted" id="unreadTextOpacityValue">30%</small>
				</div>
				<div class="col-md-2">
					<label for="volumeInput" class="form-label">Volume Boost (1-10):</label>
					<input type="number" id="volumeInput" class="form-control" value="6" min="0.1" max="10" step="0.5">
				</div>
			</div>
			<div class="row align-items-end">
				<div class="col-md-3 mb-3">
					<label for="ttsEngineSelect" class="form-label"><i class="fas fa-cogs text-info me-1"></i>TTS Engine:</label>
					<select id="ttsEngineSelect" class="form-select">
						<option value="openai" selected>OpenAI</option>
						<option value="google">Google</option>
						<option value="browser">Browser Speech</option>
					</select>
				</div>
				<div class="col-md-3 mb-3">
					<label for="ttsVoiceSelect" class="form-label"><i class="fas fa-microphone text-success me-1"></i>TTS Voice:</label>
					<select id="ttsVoiceSelect" class="form-select">
						<optgroup label="OpenAI Voices">
							<option value="alloy">Alloy</option>
							<option value="echo">Echo</option>
							<option value="fable">Fable</option>
							<option value="onyx">Onyx</option>
							<option value="nova" selected>Nova</option>
							<option value="shimmer">Shimmer</option>
						</optgroup>
						<optgroup label="Google Voices" style="display: none;">
							<option value="en-US-Studio-O">en-US-Studio-O (Female)</option>
							<option value="en-US-Studio-Q">en-US-Studio-Q (Male)</option>
							<option value="en-GB-News-K">en-GB-News-K (Female)</option>
							<option value="en-GB-News-L">en-GB-News-L (Male)</option>
							<option value="en-AU-Neural2-A">en-AU-Neural2-A (Female)</option>
							<option value="en-AU-Neural2-B">en-AU-Neural2-B (Male)</option>
							<option value="tr-TR-Standard-A">tr-TR-Standard-A (Female)</option>
							<option value="tr-TR-Standard-B">tr-TR-Standard-B (Male)</option>
							<option value="cmn-CN-Wavenet-A">cmn-CN-Wavenet-A (Female)</option>
							<option value="cmn-CN-Wavenet-B">cmn-CN-Wavenet-B (Male)</option>
						</optgroup>
					</select>
				</div>
				<div class="col-md-3 mb-3" id="ttsLanguageCodeContainer">
					<label for="ttsLanguageCodeSelect" class="form-label"><i class="fas fa-language text-warning me-1"></i>TTS Language:</label>
					<select id="ttsLanguageCodeSelect" class="form-select">
						<option value="en-US" selected>en-US (English, US)</option>
						<option value="en-GB">en-GB (English, UK)</option>
						<option value="en-AU">en-AU (English, Australia)</option>
						<option value="tr-TR">tr-TR (Turkish)</option>
						<option value="cmn-CN">cmn-CN (Mandarin, Simplified)</option>
						<option value="fr-FR">fr-FR (French)</option>
						<option value="de-DE">de-DE (German)</option>
						<option value="es-ES">es-ES (Spanish)</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<!-- AI Generation Modal (remains the same) -->
	<div class="modal fade" id="aiGenerateModal" tabindex="-1" aria-labelledby="aiGenerateModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header"><h5 class="modal-title" id="aiGenerateModalLabel">Generate Text with AI</h5> <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button> </div>
				<div class="modal-body">
					<div class="mb-3"><label for="aiPromptInput" class="form-label">Enter your prompt for the AI:</label> <input type="text" class="form-control" id="aiPromptInput" placeholder="e.g., Write a short lesson about cats"> </div>
					<button id="generateAiTextBtn" class="btn btn-primary mb-3"><i class="fas fa-cogs"></i> Generate</button>
					<h6>Preview:</h6>
					<div id="aiPreviewArea" class="p-2 border bg-light rounded" style="min-height: 100px;"> Click "Generate" to see text here... </div>
				</div>
				<div class="modal-footer"> <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button> <button type="button" class="btn btn-success" id="useAiTextBtn" disabled><i class="fas fa-check-circle"></i> Use This Text</button> </div>
			</div>
		</div>
	</div>

	<!-- Load from LocalStorage Modal (remains the same) -->
	<div class="modal fade" id="localStorageLoadModal" tabindex="-1" aria-labelledby="localStorageLoadModalLabel" aria-hidden="true">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header"><h5 class="modal-title" id="localStorageLoadModalLabel">Load Text from Local Storage</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
				<div class="modal-body"> <ul id="savedTextsList" class="list-group"> <!-- Items will be populated by JavaScript --> </ul> </div>
				<div class="modal-footer"> <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button> </div>
			</div>
		</div>
	</div>

	<div class="mb-3">
		<label for="mainTextarea" class="form-label" id="mainTextareaLabel">Enter or generate text below:</label>
		<textarea id="mainTextarea" class="form-control" rows="6" placeholder="Type or paste your text here..."></textarea>
	</div>

	<!-- REMOVED: displayTextCard, audioPlayer, playbackControlsContainer, holdSpinnerOverlay -->
	<div id="statusMessage" class="alert alert-info" style="display:none;"></div>


	<div class="d-flex flex-wrap align-items-center mb-5" id="mainControlsContainer">
		<button class="btn btn-info me-2 mb-2" data-bs-toggle="modal" data-bs-target="#aiGenerateModal"><i class="fas fa-robot"></i> Generate with AI </button>
		<button id="saveToStorageBtn" class="btn btn-success me-2 mb-2"><i class="fas fa-save"></i> Save to LocalStorage </button>
		<button id="loadFromStorageBtn" class="btn btn-warning me-2 mb-2" data-bs-toggle="modal" data-bs-target="#localStorageLoadModal"><i class="fas fa-upload"></i> Load from LocalStorage </button>
		<button id="pregenerateAllBtn" class="btn btn-secondary me-2 mb-2"><i class="fas fa-cogs"></i> Pregenerate All Audio</button>
		<button id="readTextBtn" class="btn btn-primary me-2 mb-2"><i class="fas fa-book-reader"></i> Read This Text</button>
	</div>

</div> <!-- End container -->

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/ui-manager.js"></script>
<script src="public/js/script.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
