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
		displayTextCard: document.getElementById('displayTextCard'), // Added
		displayTextFontSizeInput: document.getElementById('displayTextFontSizeInput'), // Added
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
		h1Title: document.querySelector('h1'),
		mainControlsContainer: document.getElementById('mainControlsContainer'),
		playbackControlsContainer: document.getElementById('playbackControlsContainer'),
		mainTextareaLabel: document.querySelector('label[for="mainTextarea"]'),
		chunkUnitSelect: document.getElementById('chunkUnitSelect'),
		wordsPerChunkLabel: document.querySelector('label[for="wordsPerChunkInput"]'),
		pregenerateAllBtn: document.getElementById('pregenerateAllBtn'),
		aiGenerateModal: document.getElementById('aiGenerateModal'), // Modal elements
		localStorageLoadModal: document.getElementById('localStorageLoadModal'),
	};
	
	// Instantiate managers
	// UIManager needs to call methods on PlaybackManager
	// PlaybackManager needs to call showStatus from UIManager
	const uiManagerInstance = new UIManager(DOMElements);
	// Pass the showStatus method bound to the uiManagerInstance
	const playbackManagerInstance = new PlaybackManager(DOMElements, uiManagerInstance.showStatus.bind(uiManagerInstance));
	
	// Provide the playbackManagerInstance to the uiManagerInstance for cross-communication
	uiManagerInstance.setPlaybackManager(playbackManagerInstance);
	
	// Initialize both managers
	uiManagerInstance.init();
	playbackManagerInstance.init();
	
	// Any other global initializations that don't fit into managers can go here
	// For example, if there were truly global event listeners not tied to a specific manager's scope.
});
