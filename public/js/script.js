// Define this utility function in the global scope or a namespace
// before it's potentially called by managers.
function getRecaptchaToken(action) {
	return new Promise((resolve, reject) => {
		if (typeof grecaptcha === 'undefined' || typeof RECAPTCHA_SITE_KEY === 'undefined' || !RECAPTCHA_SITE_KEY) {
			console.warn('reCAPTCHA not loaded or site key missing.');
			// Reject to prevent action if reCAPTCHA is critical
			reject(new Error('reCAPTCHA not available. Please ensure it is loaded and configured.'));
			return;
		}
		grecaptcha.ready(() => {
			grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action })
				.then((token) => {
					resolve(token);
				})
				.catch((error) => {
					console.error('Error executing reCAPTCHA:', error);
					reject(new Error('reCAPTCHA execution failed: ' + error.message));
				});
		});
	});
}

document.addEventListener('DOMContentLoaded', () => {
	// Select ALL DOM elements here to pass to managers
	const DOMElements = {
		mainTextarea: document.getElementById('mainTextarea'),
		aiPromptInput: document.getElementById('aiPromptInput'),
		generateAiTextBtn: document.getElementById('generateAiTextBtn'),
		aiPreviewArea: document.getElementById('aiPreviewArea'),
		useAiTextBtn: document.getElementById('useAiTextBtn'),
		saveToStorageBtn: document.getElementById('saveToStorageBtn'),
		savedTextsList: document.getElementById('savedTextsList'),
		wordsPerChunkInput: document.getElementById('wordsPerChunkInput'),
		voiceSelect: document.getElementById('voiceSelect'),
		volumeInput: document.getElementById('volumeInput'),
		displayText: document.getElementById('displayText'),
		displayTextCard: document.getElementById('displayTextCard'),
		displayTextFontSizeInput: document.getElementById('displayTextFontSizeInput'),
		speakNextBtn: document.getElementById('speakNextBtn'),
		playAllBtn: document.getElementById('playAllBtn'),
		stopPlaybackBtn: document.getElementById('stopPlaybackBtn'),
		audioPlayer: document.getElementById('audioPlayer'),
		statusMessage: document.getElementById('statusMessage'),
		settingsCard: document.getElementById('settingsCard'),
		statusVerbositySelect: document.getElementById('statusVerbositySelect'),
		speakNextHoldDurationInput: document.getElementById('speakNextHoldDuration'),
		togglePlayAllBtnSwitch: document.getElementById('togglePlayAllBtnSwitch'),
		holdSpinnerOverlay: document.getElementById('holdSpinnerOverlay'),
		holdSpinner: document.getElementById('holdSpinner'),
		holdSpinnerProgressText: document.getElementById('holdSpinnerProgressText'),
		toggleControlsBtn: document.getElementById('toggleControlsBtn'),
		h3Title: document.querySelector('h3'),
		mainControlsContainer: document.getElementById('mainControlsContainer'),
		playbackControlsContainer: document.getElementById('playbackControlsContainer'),
		mainTextareaLabel: document.querySelector('label[for="mainTextarea"]'),
		chunkUnitSelect: document.getElementById('chunkUnitSelect'),
		wordsPerChunkLabel: document.querySelector('label[for="wordsPerChunkInput"]'),
		pregenerateAllBtn: document.getElementById('pregenerateAllBtn'),
		aiGenerateModal: document.getElementById('aiGenerateModal'),
		localStorageLoadModal: document.getElementById('localStorageLoadModal'),
	};
	
	// Instantiate managers
	const uiManagerInstance = new UIManager(DOMElements);
	const playbackManagerInstance = new PlaybackManager(DOMElements, uiManagerInstance.showStatus.bind(uiManagerInstance));
	uiManagerInstance.setPlaybackManager(playbackManagerInstance);
	
	// Initialize both managers
	uiManagerInstance.init();
	playbackManagerInstance.init();
});
