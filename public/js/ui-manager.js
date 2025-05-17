class UIManager {
	constructor(elements) {
		this.elements = elements;
		this.playbackManager = null;
		this.statusVerbosity = 'errors';
		
		this.voices = {
			openai: [
				{value: "alloy", text: "Alloy"}, {value: "echo", text: "Echo"},
				{value: "fable", text: "Fable"}, {value: "onyx", text: "Onyx"},
				{value: "nova", text: "Nova"}, {value: "shimmer", text: "Shimmer"}
			],
			google: [
				{value: "en-US-Studio-O", text: "en-US-Studio-O (Female)"}, {
					value: "en-US-Studio-Q",
					text: "en-US-Studio-Q (Male)"
				},
				{value: "en-GB-News-K", text: "en-GB-News-K (Female)"}, {value: "en-GB-News-L", text: "en-GB-News-L (Male)"},
				{value: "en-AU-Neural2-A", text: "en-AU-Neural2-A (Female)"}, {
					value: "en-AU-Neural2-B",
					text: "en-AU-Neural2-B (Male)"
				},
				{value: "tr-TR-Standard-A", text: "tr-TR-Standard-A (Female)"}, {
					value: "tr-TR-Standard-B",
					text: "tr-TR-Standard-B (Male)"
				},
				{value: "cmn-CN-Wavenet-A", text: "cmn-CN-Wavenet-A (Female)"}, {
					value: "cmn-CN-Wavenet-B",
					text: "cmn-CN-Wavenet-B (Male)"
				},
			]
		};
		this.aiModalInstance = null;
		this.isFloatingButtonEnabled = false;
	}
	
	setPlaybackManager(playbackManager) {
		this.playbackManager = playbackManager;
	}
	
	init() {
		this._loadAndApplyInitialSettings();
		this._bindSettingsListeners();
		this._bindAIGenerationListeners();
		this._bindLocalStorageListeners();
		this._bindMainTextareaListener();
		this._bindChunkUnitListener();
		this._bindTtsSettingsListeners();
		this._updateVoiceAndLanguageUI();
		document.body.classList.add('playback-controls-active');
		
		if (this.elements.aiGenerateModal) {
			this.aiModalInstance = new bootstrap.Modal(this.elements.aiGenerateModal);
		}
	}

	_loadAndApplyInitialSettings() {
		// Inside _loadAndApplyInitialSettings method
		const floatingButtonEnabled = localStorage.getItem('floatingPlayButtonEnabled');
		if (floatingButtonEnabled !== null) {
			this.elements.floatingPlayButtonSwitch.checked = (floatingButtonEnabled === 'true');
			this.isFloatingButtonEnabled = (floatingButtonEnabled === 'true');
			
			// Set initial visibility of the speak next button
			if (this.elements.speakNextBtn) {
				this.elements.speakNextBtn.style.display = this.isFloatingButtonEnabled ? 'none' : 'inline-block';
			}
			if (this.elements.floatingPlayButton) {
				this.elements.floatingPlayButton.style.display = this.isFloatingButtonEnabled ? 'block' : 'none';
			}
		} else {
			localStorage.setItem('floatingPlayButtonEnabled', 'false');
		}
		
		const savedUnreadOpacity = localStorage.getItem('unreadTextOpacity');
		if (savedUnreadOpacity) {
			this.elements.unreadTextOpacityInput.value = savedUnreadOpacity;
			this.elements.unreadTextOpacityValue.textContent = `${savedUnreadOpacity}%`;
			if (this.playbackManager) {
				this.playbackManager.unreadTextOpacity = parseInt(savedUnreadOpacity) / 100;
				this.playbackManager.applyUnreadTextOpacity();
			}
		} else {
			localStorage.setItem('unreadTextOpacity', this.elements.unreadTextOpacityInput.value);
			this.elements.unreadTextOpacityValue.textContent = `${this.elements.unreadTextOpacityInput.value}%`;
		}
		
		const savedVerbosity = localStorage.getItem('statusVerbosity');
		if (savedVerbosity) {
			this.elements.statusVerbositySelect.value = savedVerbosity;
			this.statusVerbosity = savedVerbosity;
		} else {
			this.statusVerbosity = this.elements.statusVerbositySelect.value;
			localStorage.setItem('statusVerbosity', this.statusVerbosity);
		}
		const showPlayAll = localStorage.getItem('showPlayAllButton');
		if (showPlayAll !== null) {
			this.elements.togglePlayAllBtnSwitch.checked = (showPlayAll === 'true');
		}
		this.elements.playAllBtn.style.display = this.elements.togglePlayAllBtnSwitch.checked ? 'inline-block' : 'none';
		this.elements.stopPlaybackBtn.style.display = this.elements.togglePlayAllBtnSwitch.checked ? 'inline-block' : 'none';
		const savedHoldDuration = localStorage.getItem('speakNextHoldDuration');
		if (savedHoldDuration) {
			this.elements.speakNextHoldDurationInput.value = savedHoldDuration;
		} else {
			localStorage.setItem('speakNextHoldDuration', this.elements.speakNextHoldDurationInput.value);
		}
		const savedFontSize = localStorage.getItem('displayTextFontSize');
		const fontSizeInput = this.elements.displayTextFontSizeInput;
		const displayTextElement = this.elements.displayText;
		if (savedFontSize) {
			fontSizeInput.value = savedFontSize;
			displayTextElement.style.fontSize = `${savedFontSize}px`;
		} else {
			displayTextElement.style.fontSize = `${fontSizeInput.value}px`;
			localStorage.setItem('displayTextFontSize', fontSizeInput.value);
		}
		const savedTtsEngine = localStorage.getItem('ttsEngine');
		if (savedTtsEngine && this.elements.ttsEngineSelect.querySelector(`option[value="${savedTtsEngine}"]`)) {
			this.elements.ttsEngineSelect.value = savedTtsEngine;
		} else {
			localStorage.setItem('ttsEngine', this.elements.ttsEngineSelect.value);
		}
		const savedTtsVoice = localStorage.getItem('ttsVoice');
		if (savedTtsVoice) {
			this.elements.ttsVoiceSelect.setAttribute('data-saved-voice', savedTtsVoice);
		}
		const savedTtsLang = localStorage.getItem('ttsLanguageCode');
		if (savedTtsLang && this.elements.ttsLanguageCodeSelect.querySelector(`option[value="${savedTtsLang}"]`)) {
			this.elements.ttsLanguageCodeSelect.value = savedTtsLang;
		} else {
			localStorage.setItem('ttsLanguageCode', this.elements.ttsLanguageCodeSelect.value);
		}
	}
	
	showStatus(message, type = 'info', duration = 3000) {
		if (this.statusVerbosity === 'none') return;
		if (this.statusVerbosity === 'errors' && type !== 'danger' && type !== 'warning') return;
		
		this.elements.statusMessage.textContent = message;
		this.elements.statusMessage.className = `alert alert-${type} mt-2`;
		this.elements.statusMessage.style.display = 'block';
		
		// Clear existing timeout if any
		if (this.statusTimeout) {
			clearTimeout(this.statusTimeout);
		}
		
		if (duration) {
			this.statusTimeout = setTimeout(() => {
				if (this.elements.statusMessage) {
					this.elements.statusMessage.style.display = 'none';
				}
			}, duration);
		}
	}
	
	_bindSettingsListeners() {
		this.elements.floatingPlayButtonSwitch.addEventListener('change', (e) => {
			const isEnabled = e.target.checked;
			localStorage.setItem('floatingPlayButtonEnabled', isEnabled);
			this.isFloatingButtonEnabled = isEnabled;
			this.showStatus(`Floating "Continue Speaking" button ${isEnabled ? 'enabled' : 'disabled'}.`, 'info', 1500);
			
			// Update the display of the main speak next button
			if (this.elements.speakNextBtn) {
				this.elements.speakNextBtn.style.display = isEnabled ? 'none' : 'inline-block';
			}
			
			if (this.elements.floatingPlayButton) {
				this.elements.floatingPlayButton.style.display = isEnabled ? 'block' : 'none';
			}
			
			if (this.playbackManager) {
				this.playbackManager.updateFloatingButtonVisibility(isEnabled);
			}
		});
		
		this.elements.unreadTextOpacityInput.addEventListener('input', (e) => {
			const opacity = e.target.value;
			this.elements.unreadTextOpacityValue.textContent = `${opacity}%`;
			localStorage.setItem('unreadTextOpacity', opacity);
			
			if (this.playbackManager) {
				this.playbackManager.unreadTextOpacity = parseInt(opacity) / 100;
				this.playbackManager.applyUnreadTextOpacity();
			}
		});
		
		this.elements.statusVerbositySelect.addEventListener('change', (e) => {
			this.statusVerbosity = e.target.value;
			localStorage.setItem('statusVerbosity', this.statusVerbosity);
			this.showStatus(`Status messages set to: ${this.statusVerbosity}`, 'info', 1500);
		});
		this.elements.togglePlayAllBtnSwitch.addEventListener('change', (e) => {
			const show = e.target.checked;
			this.elements.playAllBtn.style.display = show ? 'inline-block' : 'none';
			this.elements.stopPlaybackBtn.style.display = show ? 'inline-block' : 'none';
			localStorage.setItem('showPlayAllButton', show);
		});
		this.elements.speakNextHoldDurationInput.addEventListener('change', (e) => {
			localStorage.setItem('speakNextHoldDuration', e.target.value);
			this.showStatus(`"Speak Next" hold duration set to ${e.target.value}ms.`, 'info', 1500);
		});
		this.elements.displayTextFontSizeInput.addEventListener('input', (e) => {
			const fontSize = e.target.value;
			if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
				this.elements.displayText.style.fontSize = `${fontSize}px`;
				localStorage.setItem('displayTextFontSize', fontSize);
			}
		});
		this.elements.displayTextFontSizeInput.addEventListener('change', (e) => {
			const fontSize = e.target.value;
			if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
				localStorage.setItem('displayTextFontSize', fontSize);
				this.showStatus(`Display font size set to ${fontSize}px.`, 'info', 1500);
			} else {
				const lastValidSize = localStorage.getItem('displayTextFontSize') || e.target.defaultValue;
				e.target.value = lastValidSize;
				this.elements.displayText.style.fontSize = `${lastValidSize}px`;
				this.showStatus(`Font size out of range. Reset to ${lastValidSize}px.`, 'warning', 2000);
			}
		});
	}
	
	_updateVoiceAndLanguageUI() {
		const selectedEngine = this.elements.ttsEngineSelect.value;
		const voiceSelect = this.elements.ttsVoiceSelect;
		const langContainer = this.elements.ttsLanguageCodeContainer;
		const langSelect = this.elements.ttsLanguageCodeSelect;
		
		const optgroups = voiceSelect.getElementsByTagName('optgroup');
		let firstVisibleOptionValue = null;
		
		for (let optgroup of optgroups) {
			if (selectedEngine === 'openai' && optgroup.label === 'OpenAI Voices') {
				optgroup.style.display = '';
				if (!firstVisibleOptionValue && optgroup.options && optgroup.options.length > 0) {
					firstVisibleOptionValue = optgroup.options[0].value;
				}
			} else if (selectedEngine === 'google' && optgroup.label === 'Google Voices') {
				optgroup.style.display = '';
				if (!firstVisibleOptionValue && optgroup.options && optgroup.options.length > 0) {
					firstVisibleOptionValue = optgroup.options[0].value;
				}
			} else {
				optgroup.style.display = 'none';
			}
		}
		
		const savedVoice = voiceSelect.getAttribute('data-saved-voice');
		let currentVoiceStillVisible = false;
		if (savedVoice) {
			for (let option of voiceSelect.options) {
				if (option.value === savedVoice && option.parentElement.style.display !== 'none') {
					voiceSelect.value = savedVoice;
					currentVoiceStillVisible = true;
					break;
				}
			}
		}
		
		if (!currentVoiceStillVisible) {
			if (firstVisibleOptionValue) {
				voiceSelect.value = firstVisibleOptionValue;
			} else {
				const currentOptgroup = Array.from(optgroups).find(og => og.style.display !== 'none');
				if (currentOptgroup && currentOptgroup.options && currentOptgroup.options.length > 0) {
					voiceSelect.value = currentOptgroup.options[0].value;
				}
			}
		}
		localStorage.setItem('ttsVoice', voiceSelect.value);
		voiceSelect.removeAttribute('data-saved-voice'); // Clear after use
		
		if (selectedEngine === 'browser') {
			// Hide the voice selection from server-side options
			voiceSelect.style.display = 'none';
			// Show the language option but update it for browser's voices
			langContainer.style.display = '';
			langSelect.disabled = false;
			
			// We'll create a new select element for browser voices
			if (!this.elements.browserVoiceSelectContainer) {
				const container = document.createElement('div');
				container.className = 'col-md-4 mb-3';
				container.id = 'browserVoiceSelectContainer';
				
				const label = document.createElement('label');
				label.className = 'form-label';
				label.innerHTML = '<i class="fas fa-microphone text-success me-1"></i>Browser Voice:';
				label.setAttribute('for', 'browserVoiceSelect');
				
				const select = document.createElement('select');
				select.className = 'form-select';
				select.id = 'browserVoiceSelect';
				
				container.appendChild(label);
				container.appendChild(select);
				
				// Insert after the tts voice select (which is now hidden)
				voiceSelect.parentNode.after(container);
				this.elements.browserVoiceSelect = select;
				this.elements.browserVoiceSelectContainer = container;
				
				// Populate browser voices
				this._populateBrowserVoices();
			} else {
				this.elements.browserVoiceSelectContainer.style.display = '';
			}
		} else {
			// For OpenAI or Google, show the server-side voice options
			voiceSelect.style.display = '';
			// Hide browser voice select if it exists
			if (this.elements.browserVoiceSelectContainer) {
				this.elements.browserVoiceSelectContainer.style.display = 'none';
			}
		}
		
		if (selectedEngine === 'google') {
			langContainer.style.display = '';
			langSelect.disabled = false;
		} else {
			langContainer.style.display = 'none';
			langSelect.disabled = true;
		}
	}
	
	_populateBrowserVoices() {
		if (!this.elements.browserVoiceSelect || !window.speechSynthesis) return;
		
		// Clear existing options
		this.elements.browserVoiceSelect.innerHTML = '';
		
		// Default option
		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.text = 'Default Voice';
		this.elements.browserVoiceSelect.appendChild(defaultOption);
		
		// Get available voices and add them
		let voices = [];
		
		// Function to populate voices
		const populateVoiceList = () => {
			voices = window.speechSynthesis.getVoices();
			
			voices.forEach(voice => {
				const option = document.createElement('option');
				option.value = voice.name;
				option.text = `${voice.name} (${voice.lang})`;
				this.elements.browserVoiceSelect.appendChild(option);
			});
			
			// Set saved voice if available
			const savedBrowserVoice = localStorage.getItem('browserTtsVoice');
			if (savedBrowserVoice) {
				// Find if the saved voice exists in the current browser
				for (let i = 0; i < this.elements.browserVoiceSelect.options.length; i++) {
					if (this.elements.browserVoiceSelect.options[i].value === savedBrowserVoice) {
						this.elements.browserVoiceSelect.selectedIndex = i;
						break;
					}
				}
			}
		};
		
		// Chrome loads voices asynchronously
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = populateVoiceList;
		}
		
		// Initial population attempt
		populateVoiceList();
		
		// Add event listener for voice selection change
		this.elements.browserVoiceSelect.addEventListener('change', (e) => {
			localStorage.setItem('browserTtsVoice', e.target.value);
			if (this.playbackManager) this.playbackManager.handleTtsSettingsChange();
		});
	}
	
	_bindTtsSettingsListeners() {
		this.elements.ttsEngineSelect.addEventListener('change', (e) => {
			localStorage.setItem('ttsEngine', e.target.value);
			this._updateVoiceAndLanguageUI();
			if (this.playbackManager) this.playbackManager.handleTtsSettingsChange();
			this.showStatus(`TTS Engine set to ${e.target.options[e.target.selectedIndex].text}. Playback reset.`, 'info', 2000);
		});
		this.elements.ttsVoiceSelect.addEventListener('change', (e) => {
			localStorage.setItem('ttsVoice', e.target.value);
			if (this.playbackManager) this.playbackManager.handleTtsSettingsChange();
			this.showStatus(`TTS Voice set to ${e.target.options[e.target.selectedIndex].text}. Playback reset.`, 'info', 2000);
		});
		this.elements.ttsLanguageCodeSelect.addEventListener('change', (e) => {
			localStorage.setItem('ttsLanguageCode', e.target.value);
			if (this.playbackManager) this.playbackManager.handleTtsSettingsChange();
			this.showStatus(`TTS Language set to ${e.target.value}. Playback reset.`, 'info', 2000);
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
			this.elements.aiPreviewArea.innerHTML = 'Generating text with AI... <i class="fas fa-robot fa-spin"></i>';
			this.elements.useAiTextBtn.disabled = true;
			
			try {
				const formData = new FormData();
				formData.append('action', 'generate_text_ai');
				formData.append('prompt', prompt);
				
				const response = await fetch(window.location.href, {
					method: 'POST',
					body: formData
				});
				
				const result = await response.json();
				
				// Check if we need verification (session expired)
				if (result.require_verification) {
					window.location.reload(); // Reload the page to trigger verification flow
					return;
				}
				
				if (result.success && result.text) {
					this.elements.aiPreviewArea.innerHTML = result.text.replace(/\n/g, '<br>');
					this.elements.useAiTextBtn.disabled = false;
					this.showStatus('AI text generated successfully.', 'success');
				} else {
					this.elements.aiPreviewArea.textContent = 'Error: ' + (result.message || 'Could not generate text.');
					this.showStatus('AI generation failed: ' + (result.message || 'Unknown error'), 'danger');
				}
			} catch (error) {
				this.elements.aiPreviewArea.textContent = 'Error: ' + error.message;
				this.showStatus('AI generation process error: ' + error.message, 'danger');
			} finally {
				this.elements.generateAiTextBtn.disabled = false;
				this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate';
			}
		});
		
		
		this.elements.useAiTextBtn.addEventListener('click', () => {
			const textToUse = this.elements.aiPreviewArea.innerHTML.replace(/<br\s*\/?>/gi, '\n');
			this.elements.mainTextarea.value = textToUse;
			if (this.playbackManager) {
				this.playbackManager.handleTextChange(true); // true for new text source
			}
			this.aiModalInstance.hide();
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
			li.className = 'list-group-item'; // Bootstrap class
			
			const textPreview = document.createElement('span');
			textPreview.className = 'text-preview'; // Custom class from style.css
			textPreview.textContent = `${item.name}`;
			textPreview.title = `Preview: ${item.text.substring(0, 200).replace(/\n/g, ' ')}...`;
			
			const btnGroup = document.createElement('div');
			btnGroup.className = 'btn-group'; // Bootstrap class for grouping buttons
			
			const loadBtn = document.createElement('button');
			loadBtn.className = 'btn btn-sm btn-outline-primary';
			loadBtn.innerHTML = '<i class="fas fa-download"></i> Load';
			loadBtn.onclick = () => {
				this.elements.mainTextarea.value = item.text;
				if (this.playbackManager) {
					this.playbackManager.handleTextChange(true); // true for new text source
				}
				this.elements.displayText.innerHTML = `Text "${item.name}" loaded. Click 'Speak Next Chunk' or 'Play All'.`;
				bootstrap.Modal.getInstance(this.elements.localStorageLoadModal).hide();
				this.showStatus(`Text "${item.name}" loaded.`, 'success');
			};
			
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2'; // ms-2 for margin
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
			if (name === null) return; // User cancelled prompt
			
			texts.push({
				id: Date.now().toString(), // Unique ID
				name: name || defaultName,
				text: text
			});
			this._saveTexts(texts);
			this.showStatus('Text saved to LocalStorage!', 'success');
		});
		
		// Listener for when the modal is about to be shown
		this.elements.localStorageLoadModal.addEventListener('show.bs.modal', () => this._populateLoadModal());
	}
	
	_bindMainTextareaListener() {
		this.elements.mainTextarea.addEventListener('input', () => {
			if (this.playbackManager) {
				this.playbackManager.handleTextChange(false); // false as it's not a new source, just modification
			}
		});
	}
	
	_bindChunkUnitListener() {
		this.elements.chunkUnitSelect.addEventListener('change', (e) => {
			const unit = e.target.value;
			if (unit === 'sentences') {
				this.elements.wordsPerChunkLabel.textContent = 'Sentences per chunk (approx):';
				// Adjust default/typical value for sentences if current word value is too high
				if (parseInt(this.elements.wordsPerChunkInput.value) > 5 || parseInt(this.elements.wordsPerChunkInput.value) < 1) {
					this.elements.wordsPerChunkInput.value = '1';
				}
			} else { // words
				this.elements.wordsPerChunkLabel.textContent = 'Words per chunk (approx):';
				// Adjust default/typical value for words if current sentence value is too low/high for words
				if (parseInt(this.elements.wordsPerChunkInput.value) < 3 || parseInt(this.elements.wordsPerChunkInput.value) > 100) {
					this.elements.wordsPerChunkInput.value = '10';
				}
			}
			if (this.playbackManager) {
				this.playbackManager.handleChunkSettingsChange();
			}
			this.elements.displayText.innerHTML = "Chunking unit changed. Click 'Speak Next Chunk' or 'Play All'.";
		});
	}
}
