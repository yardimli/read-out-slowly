document.addEventListener('DOMContentLoaded', () => {
	const DOMElements = {
		// Elements PlaybackManager expects for its own operations
		mainTextarea: document.getElementById('mainTextarea'), // Hidden, will be populated
		wordsPerChunkInput: document.getElementById('wordsPerChunkInput'), // Hidden
		chunkUnitSelect: document.getElementById('chunkUnitSelect'), // Hidden
		volumeInput: document.getElementById('volumeInput'), // Hidden
		ttsEngineSelect: document.getElementById('ttsEngineSelect'), // Hidden
		ttsVoiceSelect: document.getElementById('ttsVoiceSelect'), // Hidden
		ttsLanguageCodeSelect: document.getElementById('ttsLanguageCodeSelect'), // Hidden
		browserVoiceSelect: document.getElementById('browserVoiceSelect'), // Hidden, value set from localStorage
		floatingPlayButtonSwitch: document.getElementById('floatingPlayButtonSwitch'), // Hidden, checked state set from localStorage
		speakNextHoldDurationInput: document.getElementById('speakNextHoldDurationInput'), // Hidden
		
		// Elements for UI on this page
		displayText: document.getElementById('displayText'),
		displayTextCard: document.getElementById('displayTextCard'),
		audioPlayer: document.getElementById('audioPlayer'),
		statusMessage: document.getElementById('statusMessage'),
		
		// Playback control buttons
		speakNextBtn: document.getElementById('speakNextBtn'),
		playAllBtn: document.getElementById('playAllBtn'),
		stopPlaybackBtn: document.getElementById('stopPlaybackBtn'),
		floatingPlayButtonElement: document.getElementById('floatingPlayButton'),
		
		// Hold spinner elements
		holdSpinnerOverlay: document.getElementById('holdSpinnerOverlay'),
		holdSpinner: document.getElementById('holdSpinner'),
		holdSpinnerProgressText: document.getElementById('holdSpinnerProgressText'),
		
		// For scrolling adjustments & other UI
		playbackControlsContainer: document.getElementById('playbackControlsContainer'),
		readPageTitle: document.getElementById('readPageTitle'),
	};
	
	let statusTimeout;
	
	function showStatus(message, type = 'info', duration = 3000) {
		const statusVerbosity = localStorage.getItem('statusVerbosity') || 'errors';
		if (statusVerbosity === 'none') return;
		if (statusVerbosity === 'errors' && type !== 'danger' && type !== 'warning') return;
		
		if (DOMElements.statusMessage) {
			DOMElements.statusMessage.textContent = message;
			DOMElements.statusMessage.className = `alert alert-${type} mt-2`;
			DOMElements.statusMessage.style.display = 'block';
			
			if (statusTimeout) clearTimeout(statusTimeout);
			if (duration) {
				statusTimeout = setTimeout(() => {
					DOMElements.statusMessage.style.display = 'none';
				}, duration);
			}
		} else {
			console.log(`Status (${type}): ${message}`);
		}
	}
	
	function loadSettingsAndText() {
		const textToRead = localStorage.getItem('textToReadOutSlowly');
		const textTitle = localStorage.getItem('textToReadOutSlowlyTitle') || "Reading Text";
		
		if (DOMElements.readPageTitle) {
			DOMElements.readPageTitle.textContent = textTitle;
			document.title = textTitle;
		}
		
		if (textToRead) {
			DOMElements.mainTextarea.value = textToRead;
		} else {
			DOMElements.displayText.innerHTML = "No text provided to read. Please go back to the <a href='index.php'>main page</a> and enter text.";
			showStatus("No text found to read.", "warning", null);
			DOMElements.speakNextBtn.disabled = true;
			DOMElements.playAllBtn.disabled = true;
			return false;
		}
		
		// Load settings into hidden inputs for PlaybackManager
		DOMElements.wordsPerChunkInput.value = localStorage.getItem('wordsPerChunk') || '10';
		DOMElements.chunkUnitSelect.value = localStorage.getItem('chunkUnit') || 'words';
		DOMElements.volumeInput.value = localStorage.getItem('volume') || '6';
		DOMElements.ttsEngineSelect.value = localStorage.getItem('ttsEngine') || 'openai';
		DOMElements.ttsVoiceSelect.value = localStorage.getItem('ttsVoice') || 'nova';
		DOMElements.ttsLanguageCodeSelect.value = localStorage.getItem('ttsLanguageCode') || 'en-US';
		DOMElements.browserVoiceSelect.value = localStorage.getItem('browserTtsVoice') || ''; // For browser TTS
		DOMElements.speakNextHoldDurationInput.value = localStorage.getItem('speakNextHoldDuration') || '750';
		
		const floatingButtonEnabled = localStorage.getItem('floatingPlayButtonEnabled') === 'true';
		DOMElements.floatingPlayButtonSwitch.checked = floatingButtonEnabled;
		
		DOMElements.speakNextBtn.style.display = DOMElements.floatingPlayButtonSwitch.checked ? 'none' : 'inline-block';
		DOMElements.floatingPlayButtonElement.style.display = DOMElements.floatingPlayButtonSwitch.checked ? 'block' : 'none';
		
		
		// Apply visual settings directly
		const fontSize = localStorage.getItem('displayTextFontSize') || '40';
		DOMElements.displayText.style.fontSize = `${fontSize}px`;
		
		const showPlayAll = localStorage.getItem('showPlayAllButton') !== 'false'; // Default to true
		DOMElements.playAllBtn.style.display = showPlayAll ? 'inline-block' : 'none';
		// Stop button visibility is often tied to playAll or general playback activity
		DOMElements.stopPlaybackBtn.style.display = showPlayAll ? 'inline-block' : 'none';
		
		// Apply dark mode if set
		const darkMode = localStorage.getItem('darkMode');
		if (darkMode === 'enabled') {
			document.documentElement.setAttribute('data-bs-theme', 'dark');
		} else {
			document.documentElement.setAttribute('data-bs-theme', 'light');
		}
		
		return true;
	}
	
	if (loadSettingsAndText()) {
		const playbackManagerInstance = new PlaybackManager(DOMElements, showStatus);
		
		const unreadOpacitySetting = localStorage.getItem('unreadTextOpacity') || '30';
		playbackManagerInstance.unreadTextOpacity = parseInt(unreadOpacitySetting) / 100;
		
		playbackManagerInstance.init();
		
		if (DOMElements.mainTextarea.value.trim() === '') {
			DOMElements.displayText.innerHTML = "Textarea is empty.";
		} else {
			playbackManagerInstance.displayFullTextWithOpacity();
		}
		
		// Make playbackManagerInstance globally accessible for debugging if needed
		// window.playbackManager = playbackManagerInstance;
		
	} else {
		console.error("Failed to load text or settings for playback.");
	}
});
