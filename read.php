<?php
	 include_once 'header.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Read Out Text</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="public/css/style.css">
	<script>
		// Assuming this is still relevant for TTS calls if they happen from this page
		var recaptchaTtsAlreadyVerified = true;
	</script>
</head>
<body>
<div class="container mt-4">
	<h3 id="readPageTitle">Reading Text</h3>

	<!-- Hidden inputs for settings that PlaybackManager reads -->
	<input type="hidden" id="wordsPerChunkInput">
	<input type="hidden" id="chunkUnitSelect">
	<input type="hidden" id="volumeInput">
	<input type="hidden" id="ttsEngineSelect">
	<input type="hidden" id="ttsVoiceSelect">
	<input type="hidden" id="ttsLanguageCodeSelect">
	<input type="hidden" id="browserVoiceSelect"> <!-- For browser TTS -->
	<input type="hidden" id="floatingPlayButtonSwitch"> <!-- To know if it's enabled -->
	<input type="hidden" id="speakNextHoldDurationInput">

	<!-- Hidden textarea for the main text, PlaybackManager uses this -->
	<textarea id="mainTextarea" style="display:none;"></textarea>

	<div class="card mb-3" id="displayTextCard">
		<div class="card-body">
			<div id="displayText" style="font-size: 40px;">Loading text...</div>
			<button id="floatingPlayButton" class="btn btn-lg btn-primary"
			        style="display:none; position: absolute; z-index: 1000;">
				<i class="fas fa-play-circle"></i> Read
			</button>
		</div>
	</div>

	<audio id="audioPlayer" style="display: none;"></audio>
	<div id="statusMessage" class="alert alert-info" style="display:none;"></div>

	<div id="playbackControlsContainer" class="mt-3 text-center">
		<button id="speakNextBtn" class="btn btn-lg btn-primary me-2">
			<i class="fas fa-play-circle"></i> Continue Speaking
		</button>
		<button id="playAllBtn" class="btn btn-lg btn-success me-2">
			<i class="fas fa-forward"></i> Play All
		</button>
		<button id="stopPlaybackBtn" class="btn btn-lg btn-danger" disabled>
			<i class="fas fa-stop-circle"></i> Stop
		</button>
	</div>

	<!-- Hold Spinner Overlay (copied from index.php) -->
	<div id="holdSpinnerOverlay" style="display: none;">
		<div id="holdSpinner">
			<span id="holdSpinnerProgressText">0%</span>
		</div>
	</div>

</div>

<script src="public/vendor/bootstrap5.3.5/js/bootstrap.bundle.min.js"></script>
<script src="public/js/playback-manager.js"></script>
<script src="public/js/read-page-script.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
