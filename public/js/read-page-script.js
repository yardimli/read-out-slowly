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
		floatingPlayButtonSwitch: document.getElementById('floatingPlayButtonSwitch'), // Hidden, checked state set from DB
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
		// Use the verbosity setting from the injected settings
		const statusVerbosity = window.USER_SETTINGS?.statusVerbosity || 'errors';
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
	
	function modifyClassStyle(className, property, value) {
		// Loop through all style sheets
		for (let i = 0; i < document.styleSheets.length; i++) {
			const styleSheet = document.styleSheets[i];
			try {
				// Get all CSS rules in this stylesheet
				const rules = styleSheet.cssRules || styleSheet.rules;
				for (let j = 0; j < rules.length; j++) {
					// Find the rule that matches our class
					if (rules[j].selectorText === className) {
						rules[j].style[property] = value;
						return true;
					}
				}
			} catch (e) {
				// Security error, can't access cross-origin stylesheets
			}
		}
		return false;
	}
	
	function loadSettingsAndText() {
		// Text is still passed via localStorage for this transient purpose
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
		
		// Load settings from the injected window.USER_SETTINGS object
		const settings = window.USER_SETTINGS || {};
		const getSetting = (key, defaultValue) => settings[key] !== undefined ? settings[key] : defaultValue;
		
		DOMElements.wordsPerChunkInput.value = getSetting('wordsPerChunk', '10');
		DOMElements.chunkUnitSelect.value = getSetting('chunkUnit', 'words');
		DOMElements.volumeInput.value = getSetting('volume', '6');
		DOMElements.ttsEngineSelect.value = getSetting('ttsEngine', 'openai');
		DOMElements.ttsVoiceSelect.value = getSetting('ttsVoice', 'nova');
		DOMElements.ttsLanguageCodeSelect.value = getSetting('ttsLanguageCode', 'en-US');
		// Browser voice is still from localStorage as it's browser-specific
		DOMElements.browserVoiceSelect.value = localStorage.getItem('browserTtsVoice') || '';
		DOMElements.speakNextHoldDurationInput.value = getSetting('speakNextHoldDuration', '750');
		
		let floatingButtonEnabled = getSetting('floatingPlayButtonEnabled', false);
		if (floatingButtonEnabled == '1') {
			floatingButtonEnabled = true;
		}

		DOMElements.floatingPlayButtonSwitch.checked = floatingButtonEnabled;
		DOMElements.speakNextBtn.style.display = floatingButtonEnabled ? 'none' : 'inline-block';
		DOMElements.floatingPlayButtonElement.style.display = DOMElements.floatingPlayButtonSwitch.checked ? 'block' : 'none';
		// The floating button itself is managed by PlaybackManager
		
		// Apply visual settings directly
		const fontSize = getSetting('displayTextFontSize', '40');
		DOMElements.displayText.style.fontSize = `${fontSize}px`;
		
		let showPlayAll = getSetting('showPlayAllButton', true);
		if (showPlayAll == '1') {
			showPlayAll = true;
		}
		
		DOMElements.playAllBtn.style.display = showPlayAll ? 'inline-block' : 'none';
		DOMElements.stopPlaybackBtn.style.display = showPlayAll ? 'inline-block' : 'none';
		
		// Apply dark mode if set (dark-mode.js handles this, but we can be explicit)
		const darkMode = getSetting('darkMode', 'light'); // Assuming you save 'dark' or 'light'
		document.documentElement.setAttribute('data-bs-theme', darkMode);
		
		return true;
	}
	
	if (loadSettingsAndText()) {
		const playbackManagerInstance = new PlaybackManager(DOMElements, showStatus);
		
		const unreadOpacitySetting = window.USER_SETTINGS?.unreadTextOpacity || '30';
		playbackManagerInstance.unreadTextOpacity = parseInt(unreadOpacitySetting) / 100;
		modifyClassStyle('.unread-text', 'opacity', `${playbackManagerInstance.unreadTextOpacity}`);
		
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
