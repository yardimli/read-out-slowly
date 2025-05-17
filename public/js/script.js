document.addEventListener('DOMContentLoaded', () => {
	const DOMElements = {
		mainTextarea: document.getElementById('mainTextarea'),
		aiPromptInput: document.getElementById('aiPromptInput'),
		generateAiTextBtn: document.getElementById('generateAiTextBtn'),
		aiPreviewArea: document.getElementById('aiPreviewArea'),
		useAiTextBtn: document.getElementById('useAiTextBtn'),
		saveToStorageBtn: document.getElementById('saveToStorageBtn'),
		savedTextsList: document.getElementById('savedTextsList'),
		
		// Settings elements still managed by UIManager on index.php
		wordsPerChunkInput: document.getElementById('wordsPerChunkInput'),
		volumeInput: document.getElementById('volumeInput'),
		displayTextFontSizeInput: document.getElementById('displayTextFontSizeInput'),
		statusMessage: document.getElementById('statusMessage'),
		settingsCard: document.getElementById('settingsCard'),
		statusVerbositySelect: document.getElementById('statusVerbositySelect'),
		speakNextHoldDurationInput: document.getElementById('speakNextHoldDuration'),
		togglePlayAllBtnSwitch: document.getElementById('togglePlayAllBtnSwitch'),
		
		h3Title: document.querySelector('h3'), // For dark mode toggle interaction
		mainControlsContainer: document.getElementById('mainControlsContainer'),
		mainTextareaLabel: document.querySelector('label[for="mainTextarea"]'),
		chunkUnitSelect: document.getElementById('chunkUnitSelect'),
		wordsPerChunkLabel: document.getElementById('wordsPerChunkLabel'), // Updated to get by ID
		
		aiGenerateModal: document.getElementById('aiGenerateModal'),
		localStorageLoadModal: document.getElementById('localStorageLoadModal'),
		
		pregenerateAllBtn: document.getElementById('pregenerateAllBtn'),
		
		ttsEngineSelect: document.getElementById('ttsEngineSelect'),
		ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
		ttsLanguageCodeSelect: document.getElementById('ttsLanguageCodeSelect'),
		ttsLanguageCodeContainer: document.getElementById('ttsLanguageCodeContainer'),
		
		unreadTextOpacityInput: document.getElementById('unreadTextOpacityInput'),
		unreadTextOpacityValue: document.getElementById('unreadTextOpacityValue'),
		floatingPlayButtonSwitch: document.getElementById('floatingPlayButtonSwitch'),
		
		// New button for navigating to read.php
		readTextBtn: document.getElementById('readTextBtn'),
		mainControlsHint: document.getElementById('mainControlsHint'), // For dark mode toggle interaction
	};
	
	const uiManagerInstance = new UIManager(DOMElements);
	uiManagerInstance.init();
	
	// Add listener for the new "Read This Text" button
	if (DOMElements.readTextBtn) {
		DOMElements.readTextBtn.addEventListener('click', () => {
			const textToRead = DOMElements.mainTextarea.value;
			if (textToRead.trim() === "") {
				uiManagerInstance.showStatus("Textarea is empty. Nothing to read.", "warning");
				return;
			}
			localStorage.setItem('textToReadOutSlowly', textToRead);
			
			// Try to get a title for the read page
			let textTitle = "Reading Text";
			const savedTexts = JSON.parse(localStorage.getItem('readOutSlowlyTexts')) || [];
			const matchingSavedText = savedTexts.find(t => t.text === textToRead);
			if (matchingSavedText) {
				textTitle = matchingSavedText.name;
			} else {
				textTitle = textToRead.substring(0, 50).replace(/\n/g, ' ') + (textToRead.length > 50 ? "..." : "");
			}
			localStorage.setItem('textToReadOutSlowlyTitle', textTitle);
			
			// UIManager saves all other settings to localStorage on change,
			// so they should be up-to-date for read-page-script.js to pick up.
			window.open('read.php', '_blank'); // Open in a new tab
		});
	}
});
