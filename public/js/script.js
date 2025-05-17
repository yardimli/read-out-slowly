// Global reCAPTCHA v2 Callbacks (to be called by Google's script)
var globalRecaptchaV2SuccessCallback = null;
var globalRecaptchaV2ExpiredCallback = null;
var globalRecaptchaV2ErrorCallback = null;

function onRecaptchaV2Success(token) {
	if (typeof globalRecaptchaV2SuccessCallback === 'function') {
		globalRecaptchaV2SuccessCallback(token);
	}
}

function onRecaptchaV2Expired() {
	if (typeof globalRecaptchaV2ExpiredCallback === 'function') {
		globalRecaptchaV2ExpiredCallback();
	}
}

function onRecaptchaV2Error() {
	if (typeof globalRecaptchaV2ErrorCallback === 'function') {
		globalRecaptchaV2ErrorCallback();
	}
}


document.addEventListener('DOMContentLoaded', () => {
	const DOMElements = {
		mainTextarea: document.getElementById('mainTextarea'),
		aiPromptInput: document.getElementById('aiPromptInput'),
		generateAiTextBtn: document.getElementById('generateAiTextBtn'),
		aiPreviewArea: document.getElementById('aiPreviewArea'),
		useAiTextBtn: document.getElementById('useAiTextBtn'),
		saveToStorageBtn: document.getElementById('saveToStorageBtn'),
		savedTextsList: document.getElementById('savedTextsList'),
		wordsPerChunkInput: document.getElementById('wordsPerChunkInput'),
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
		h3Title: document.querySelector('h3'),
		mainControlsContainer: document.getElementById('mainControlsContainer'),
		playbackControlsContainer: document.getElementById('playbackControlsContainer'),
		mainTextareaLabel: document.querySelector('label[for="mainTextarea"]'),
		chunkUnitSelect: document.getElementById('chunkUnitSelect'),
		wordsPerChunkLabel: document.querySelector('label[for="wordsPerChunkInput"]'),
		pregenerateAllBtn: document.getElementById('pregenerateAllBtn'),
		aiGenerateModal: document.getElementById('aiGenerateModal'),
		localStorageLoadModal: document.getElementById('localStorageLoadModal'),
		// New TTS Elements
		ttsEngineSelect: document.getElementById('ttsEngineSelect'),
		ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
		ttsLanguageCodeSelect: document.getElementById('ttsLanguageCodeSelect'),
		ttsLanguageCodeContainer: document.getElementById('ttsLanguageCodeContainer'),
		// New reCAPTCHA v2 elements
		aiRecaptchaWidgetContainer: document.getElementById('aiRecaptchaWidgetContainer'), // For AI Modal
		recaptchaV2Modal: document.getElementById('recaptchaV2Modal'), // The modal itself
		sharedRecaptchaWidgetContainer: document.getElementById('sharedRecaptchaWidgetContainer'), // For shared modal
		recaptchaV2Error: document.getElementById('recaptchaV2Error'), // Error display in shared modal
		cancelRecaptchaV2ModalBtn: document.getElementById('cancelRecaptchaV2ModalBtn'), // Cancel button in shared modal
		
		unreadTextOpacityInput: document.getElementById('unreadTextOpacityInput'),
		unreadTextOpacityValue: document.getElementById('unreadTextOpacityValue'),
		
		floatingPlayButtonSwitch: document.getElementById('floatingPlayButtonSwitch'),
		floatingPlayButton: document.getElementById('floatingPlayButton'),
		
	};
	
	const uiManagerInstance = new UIManager(DOMElements);
	
	const playbackManagerInstance = new PlaybackManager(
		DOMElements,
		uiManagerInstance.showStatus.bind(uiManagerInstance),
		// Pass the UIManager's reCAPTCHA v2 verification function
		(actionName) => uiManagerInstance.requestRecaptchaV2Verification(actionName, 'shared') // 'shared' context for TTS
	);
	
	uiManagerInstance.setPlaybackManager(playbackManagerInstance);
	
	uiManagerInstance.init();
	playbackManagerInstance.init();
	
});
