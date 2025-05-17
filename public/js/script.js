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
		
		unreadTextOpacityInput: document.getElementById('unreadTextOpacityInput'),
		unreadTextOpacityValue: document.getElementById('unreadTextOpacityValue'),
		
		floatingPlayButtonSwitch: document.getElementById('floatingPlayButtonSwitch'),
		floatingPlayButton: document.getElementById('floatingPlayButton'),
		
	};
	
	const uiManagerInstance = new UIManager(DOMElements);
	
	const playbackManagerInstance = new PlaybackManager(
		DOMElements,
		uiManagerInstance.showStatus.bind(uiManagerInstance));
	
	uiManagerInstance.setPlaybackManager(playbackManagerInstance);
	
	uiManagerInstance.init();
	playbackManagerInstance.init();
	
});
