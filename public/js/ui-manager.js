class UIManager {
	constructor(elements) {
		this.elements = elements;
		this.playbackManager = null; // To be set by setPlaybackManager
		this.statusVerbosity = 'errors'; // Default
		this.controlElementsToToggle = [
			this.elements.settingsCard,
			this.elements.mainControlsContainer,
			this.elements.mainTextarea,
			this.elements.mainTextareaLabel,
		];
	}
	
	setPlaybackManager(playbackManager) {
		this.playbackManager = playbackManager;
	}
	
	init() {
		// Initialize settings UI
		this._loadAndApplyInitialSettings(); // Load all settings from localStorage or defaults
		
		// Add event listeners
		this._bindSettingsListeners();
		this._bindAIGenerationListeners();
		this._bindLocalStorageListeners();
		this._bindHideShowControlsListeners();
		this._bindMainTextareaListener();
		this._bindChunkUnitListener();
		
		// Set initial state for body padding if playback controls are visible
		document.body.classList.add('playback-controls-active');
	}
	
	_loadAndApplyInitialSettings() {
		// Status Verbosity
		const savedVerbosity = localStorage.getItem('statusVerbosity');
		if (savedVerbosity) {
			this.elements.statusVerbositySelect.value = savedVerbosity;
			this.statusVerbosity = savedVerbosity;
		} else {
			this.statusVerbosity = this.elements.statusVerbositySelect.value; // Default from HTML
			localStorage.setItem('statusVerbosity', this.statusVerbosity);
		}
		
		// Toggle Play All Button
		const showPlayAll = localStorage.getItem('showPlayAllButton');
		if (showPlayAll !== null) {
			this.elements.togglePlayAllBtnSwitch.checked = (showPlayAll === 'true');
		}
		this.elements.playAllBtn.style.display = this.elements.togglePlayAllBtnSwitch.checked ? 'inline-block' : 'none';
		
		// Speak Next Hold Duration
		const savedHoldDuration = localStorage.getItem('speakNextHoldDuration');
		if (savedHoldDuration) {
			this.elements.speakNextHoldDurationInput.value = savedHoldDuration;
		} else {
			localStorage.setItem('speakNextHoldDuration', this.elements.speakNextHoldDurationInput.value);
		}
		
		// Display Text Font Size
		const savedFontSize = localStorage.getItem('displayTextFontSize');
		const fontSizeInput = this.elements.displayTextFontSizeInput;
		const displayTextElement = this.elements.displayText;
		
		if (savedFontSize) {
			fontSizeInput.value = savedFontSize;
			displayTextElement.style.fontSize = `${savedFontSize}px`;
		} else {
			// Apply default from HTML input's current value and save it
			displayTextElement.style.fontSize = `${fontSizeInput.value}px`;
			localStorage.setItem('displayTextFontSize', fontSizeInput.value);
		}
	}
	
	
	showStatus(message, type = 'info', duration = 3000) {
		if (this.statusVerbosity === 'none') return;
		if (this.statusVerbosity === 'errors' && type !== 'danger' && type !== 'warning') return;
		
		this.elements.statusMessage.textContent = message;
		this.elements.statusMessage.className = `alert alert-${type} mt-2`; // Keep mt-2 for spacing if needed
		this.elements.statusMessage.style.display = 'block';
		
		if (duration) {
			setTimeout(() => {
				if (this.elements.statusMessage) { // Check if element still exists
					this.elements.statusMessage.style.display = 'none';
				}
			}, duration);
		}
	}
	
	_bindSettingsListeners() {
		this.elements.statusVerbositySelect.addEventListener('change', (e) => {
			this.statusVerbosity = e.target.value;
			localStorage.setItem('statusVerbosity', this.statusVerbosity);
			this.showStatus(`Status messages set to: ${this.statusVerbosity}`, 'info', 1500);
		});
		
		this.elements.togglePlayAllBtnSwitch.addEventListener('change', (e) => {
			const show = e.target.checked;
			this.elements.playAllBtn.style.display = show ? 'inline-block' : 'none';
			localStorage.setItem('showPlayAllButton', show);
		});
		
		this.elements.speakNextHoldDurationInput.addEventListener('change', (e) => {
			localStorage.setItem('speakNextHoldDuration', e.target.value);
			this.showStatus(`"Speak Next" hold duration set to ${e.target.value}ms.`, 'info', 1500);
		});
		
		this.elements.displayTextFontSizeInput.addEventListener('input', (e) => { // 'input' for more responsive feel
			const fontSize = e.target.value;
			if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
				this.elements.displayText.style.fontSize = `${fontSize}px`;
				localStorage.setItem('displayTextFontSize', fontSize);
				// this.showStatus(`Display font size set to ${fontSize}px.`, 'info', 1000); // Can be a bit noisy
			}
		});
		this.elements.displayTextFontSizeInput.addEventListener('change', (e) => { // Persist on blur/enter too
			const fontSize = e.target.value;
			if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
				localStorage.setItem('displayTextFontSize', fontSize);
				this.showStatus(`Display font size set to ${fontSize}px.`, 'info', 1500);
			} else {
				// Reset to a valid value if out of bounds, e.g., the previous valid one or default
				const lastValidSize = localStorage.getItem('displayTextFontSize') || e.target.defaultValue;
				e.target.value = lastValidSize;
				this.elements.displayText.style.fontSize = `${lastValidSize}px`;
				this.showStatus(`Font size out of range. Reset to ${lastValidSize}px.`, 'warning', 2000);
			}
		});
	}
	
	_bindAIGenerationListeners() {
		this.elements.generateAiTextBtn.addEventListener('click', async () => {
			const prompt = this.elements.aiPromptInput.value.trim();
			if (!prompt) {
				this.showStatus('Please enter a prompt for the AI.', 'warning');
				return;
			}
			this.elements.generateAiTextBtn.disabled = true;
			this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
			this.elements.aiPreviewArea.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
			this.elements.useAiTextBtn.disabled = true;
			
			try {
				const formData = new FormData();
				formData.append('action', 'generate_text_ai');
				formData.append('prompt', prompt);
				
				const response = await fetch(window.location.href, { method: 'POST', body: formData });
				const result = await response.json();
				
				if (result.success && result.text) {
					this.elements.aiPreviewArea.innerHTML = result.text.replace(/\n/g, '<br>');
					this.elements.useAiTextBtn.disabled = false;
				} else {
					this.elements.aiPreviewArea.textContent = 'Error: ' + (result.message || 'Could not generate text.');
					this.showStatus('AI generation failed: ' + (result.message || 'Unknown error'), 'danger');
				}
			} catch (error) {
				this.elements.aiPreviewArea.textContent = 'Error: ' + error.message;
				this.showStatus('AI generation error: ' + error.message, 'danger');
			} finally {
				this.elements.generateAiTextBtn.disabled = false;
				this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate';
			}
		});
		
		this.elements.useAiTextBtn.addEventListener('click', () => {
			const textToUse = this.elements.aiPreviewArea.innerHTML.replace(/<br\s*\/?>/gi, '\n');
			this.elements.mainTextarea.value = textToUse;
			if (this.playbackManager) {
				this.playbackManager.handleTextChange(true); // true indicates new text loaded
			}
			bootstrap.Modal.getInstance(this.elements.aiGenerateModal).hide();
			this.showStatus('Text loaded into textarea.', 'success');
		});
	}
	
	_getSavedTexts() {
		return JSON.parse(localStorage.getItem('readOutSlowlyTexts')) || [];
	}
	
	_saveTexts(texts) {
		localStorage.setItem('readOutSlowlyTexts', JSON.stringify(texts));
	}
	
	_populateLoadModal() {
		const texts = this._getSavedTexts();
		this.elements.savedTextsList.innerHTML = '';
		if (texts.length === 0) {
			this.elements.savedTextsList.innerHTML = '<li class="list-group-item">No texts saved yet.</li>';
			return;
		}
		texts.sort((a, b) => b.id - a.id); // Show newest first
		
		texts.forEach(item => {
			const li = document.createElement('li');
			li.className = 'list-group-item';
			
			const textPreview = document.createElement('span');
			textPreview.className = 'text-preview';
			textPreview.textContent = `${item.name}`;
			textPreview.title = `Preview: ${item.text.substring(0, 200).replace(/\n/g, ' ')}...`;
			
			const btnGroup = document.createElement('div');
			btnGroup.className = 'btn-group';
			
			const loadBtn = document.createElement('button');
			loadBtn.className = 'btn btn-sm btn-outline-primary';
			loadBtn.innerHTML = '<i class="fas fa-download"></i> Load';
			loadBtn.onclick = () => {
				this.elements.mainTextarea.value = item.text;
				if (this.playbackManager) {
					this.playbackManager.handleTextChange(true);
				}
				this.elements.displayText.innerHTML = `Text "${item.name}" loaded. Click 'Speak Next Chunk' or 'Play All'.`;
				bootstrap.Modal.getInstance(this.elements.localStorageLoadModal).hide();
				this.showStatus(`Text "${item.name}" loaded.`, 'success');
			};
			
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
			deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
			deleteBtn.onclick = () => {
				if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
					const updatedTexts = texts.filter(t => t.id !== item.id);
					this._saveTexts(updatedTexts);
					this._populateLoadModal(); // Refresh list
					this.showStatus(`Text "${item.name}" deleted.`, 'info');
				}
			};
			
			btnGroup.appendChild(loadBtn);
			btnGroup.appendChild(deleteBtn);
			
			li.appendChild(textPreview);
			li.appendChild(btnGroup);
			this.elements.savedTextsList.appendChild(li);
		});
	}
	
	_bindLocalStorageListeners() {
		this.elements.saveToStorageBtn.addEventListener('click', () => {
			const text = this.elements.mainTextarea.value.trim();
			if (!text) {
				this.showStatus('Textarea is empty. Nothing to save.', 'warning');
				return;
			}
			const texts = this._getSavedTexts();
			const defaultName = text.substring(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? "..." : "");
			const name = prompt("Enter a name for this text:", defaultName);
			if (name === null) return; // User cancelled
			
			texts.push({ id: Date.now().toString(), name: name || defaultName, text: text });
			this._saveTexts(texts);
			this.showStatus('Text saved to LocalStorage!', 'success');
		});
		
		this.elements.localStorageLoadModal.addEventListener('show.bs.modal', () => this._populateLoadModal());
	}
	
	_updateControlsVisibility(show) {
		this.controlElementsToToggle.forEach(el => {
			if (el) {
				if (show) {
					el.classList.remove('d-none');
				} else {
					el.classList.add('d-none');
				}
			}
		});
		if (this.elements.toggleControlsBtn) {
			if (show) {
				this.elements.toggleControlsBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Controls';
			} else {
				// The button is part of mainControlsContainer which gets hidden.
				// If it were always visible, you might change text:
				// this.elements.toggleControlsBtn.innerHTML = '<i class="fas fa-eye"></i> Show Controls';
			}
		}
	}
	
	_bindHideShowControlsListeners() {
		this.elements.toggleControlsBtn.addEventListener('click', () => {
			this._updateControlsVisibility(false); // Hide all controls
		});
		this.elements.h1Title.addEventListener('dblclick', () => {
			this._updateControlsVisibility(true); // Show all controls
		});
	}
	
	_bindMainTextareaListener() {
		this.elements.mainTextarea.addEventListener('input', () => {
			if (this.playbackManager) {
				this.playbackManager.handleTextChange(false); // false indicates text changed by user typing
			}
			// The message "Text changed..." is now set by playbackManager.handleTextChange
		});
	}
	
	_bindChunkUnitListener() {
		this.elements.chunkUnitSelect.addEventListener('change', (e) => {
			const unit = e.target.value;
			if (unit === 'sentences') {
				this.elements.wordsPerChunkLabel.textContent = 'Sentences per chunk (approx):';
				if (parseInt(this.elements.wordsPerChunkInput.value) > 5 || parseInt(this.elements.wordsPerChunkInput.value) < 1) {
					this.elements.wordsPerChunkInput.value = '1'; // Default for sentences
				}
			} else { // words
				this.elements.wordsPerChunkLabel.textContent = 'Words per chunk (approx):';
				if (parseInt(this.elements.wordsPerChunkInput.value) < 3 || parseInt(this.elements.wordsPerChunkInput.value) > 100) { // Example range
					this.elements.wordsPerChunkInput.value = '10'; // Default for words
				}
			}
			if (this.playbackManager) {
				this.playbackManager.handleChunkSettingsChange();
			}
			this.elements.displayText.innerHTML = "Chunking unit changed. Click 'Speak Next Chunk' or 'Play All'.";
		});
	}
}
