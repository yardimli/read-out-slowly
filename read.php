<?php include_once 'header.php'; ?>
<!DOCTYPE html>
<html lang="en"> <!-- data-bs-theme will be set here by JS -->
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Read Text - Read Out Slowly</title>
	<link rel="stylesheet" href="public/vendor/bootstrap5.3.5/css/bootstrap.min.css">
	<link rel="stylesheet" href="public/vendor/fontawesome-free-6.7.2/css/all.min.css">
	<link rel="stylesheet" href="public/css/style.css">
</head>
<body>
<div class="container mt-4">
	<h3 class="d-flex align-items-center">
		<a href="index.php" class="btn btn-outline-secondary me-3"><i class="fas fa-arrow-left"></i> Back to Setup</a>
		<span>Read Text</span>
	</h3>

	<!-- Display Text Area in a Card -->
	<div class="card mb-3" id="displayTextCard">
		<div class="card-body">
			<div id="displayText">Loading your text...</div>
			<button id="floatingPlayButton" class="btn btn-lg btn-primary">
				<i class="fas fa-play-circle"></i> Read
			</button>
		</div>
	</div>

	<audio id="audioPlayer" style="display: none;"></audio>
	<div id="statusMessage" class="alert alert-info" style="display:none;"></div>

	<!-- Playback Controls Container -->
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
<script src="public/js/reader.js"></script>
<script src="public/js/dark-mode.js"></script>
</body>
</html>
