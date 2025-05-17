class UIManager {
	constructor(elements) {
		this.elements = elements;
		this.statusVerbosity = 'errors';
		// Removed: this.playbackManager, this.pregenerateAbortController, this.isFloatingButtonEnabled
		this.voices = { // Keep this for populating voice selects on index.php
			openai: [{value: "alloy", text: "Alloy"}, {value: "echo", text: "Echo"}, {
				value: "fable",
				text: "Fable"
			}, {value: "onyx", text: "Onyx"}, {value: "nova", text: "Nova"}, {value: "shimmer", text: "Shimmer"}],
			google: [{value: "en-US-Studio-O", text: "en-US-Studio-O (Female)"}, {
				value: "en-US-Studio-Q",
				text: "en-US-Studio-Q (Male)"
			}, {value: "en-GB-News-K", text: "en-GB-News-K (Female)"}, {
				value: "en-GB-News-L",
				text: "en-GB-News-L (Male)"
			}, {value: "en-AU-Neural2-A", text: "en-AU-Neural2-A (Female)"}, {
				value: "en-AU-Neural2-B",
				text: "en-AU-Neural2-B (Male)"
			}, {value: "tr-TR-Standard-A", text: "tr-TR-Standard-A (Female)"}, {
				value: "tr-TR-Standard-B",
				text: "tr-TR-Standard-B (Male)"
			}, {value: "cmn-CN-Wavenet-A", text: "cmn-CN-Wavenet-A (Female)"}, {
				value: "cmn-CN-Wavenet-B",
				text: "cmn-CN-Wavenet-B (Male)"
			},]
		};
		this.aiModalInstance = null;
	}
	
	// Removed: setPlaybackManager
	
	init() {
		this._loadAndApplyInitialSettings(); // Loads and applies to index.php UI, saves to localStorage
		this._bindSettingsListeners();      // Binds listeners on index.php, saves to localStorage
		this._bindAIGenerationListeners();
		this._bindLocalStorageListeners();
		this._bindMainTextareaListener();
		this._bindChunkUnitListener();      // Saves to localStorage, updates related UI on index.php
		this._bindTtsSettingsListeners();   // Saves to localStorage, updates related UI on index.php
		this._updateVoiceAndLanguageUI();   // Updates UI on index.php based on selections
		
		if (this.elements.aiGenerateModal) {
			this.aiModalInstance = new bootstrap.Modal(this.elements.aiGenerateModal);
		}
		
		this.elements.pregenerateAllBtn.addEventListener('click', () => this.pregenerateAllAudioHandler());
	}
	
	_loadAndApplyInitialSettings() {
		// Floating Play Button Switch
		const floatingButtonEnabled = localStorage.getItem('floatingPlayButtonEnabled');
		if (this.elements.floatingPlayButtonSwitch) {
			if (floatingButtonEnabled !== null) {
				this.elements.floatingPlayButtonSwitch.checked = (floatingButtonEnabled === 'true');
			} else {
				localStorage.setItem('floatingPlayButtonEnabled', this.elements.floatingPlayButtonSwitch.checked.toString());
			}
		}
		
		// Unread Text Opacity
		const savedUnreadOpacity = localStorage.getItem('unreadTextOpacity');
		if (this.elements.unreadTextOpacityInput && this.elements.unreadTextOpacityValue) {
			if (savedUnreadOpacity) {
				this.elements.unreadTextOpacityInput.value = savedUnreadOpacity;
				this.elements.unreadTextOpacityValue.textContent = `${savedUnreadOpacity}%`;
			} else {
				localStorage.setItem('unreadTextOpacity', this.elements.unreadTextOpacityInput.value);
				this.elements.unreadTextOpacityValue.textContent = `${this.elements.unreadTextOpacityInput.value}%`;
			}
		}
		
		// Status Verbosity
		const savedVerbosity = localStorage.getItem('statusVerbosity');
		if (this.elements.statusVerbositySelect) {
			if (savedVerbosity) {
				this.elements.statusVerbositySelect.value = savedVerbosity;
				this.statusVerbosity = savedVerbosity;
			} else {
				this.statusVerbosity = this.elements.statusVerbositySelect.value;
				localStorage.setItem('statusVerbosity', this.statusVerbosity);
			}
		} else { // Fallback if element not present
			this.statusVerbosity = localStorage.getItem('statusVerbosity') || 'errors';
		}
		
		
		// Toggle Play All Button Switch
		const showPlayAll = localStorage.getItem('showPlayAllButton');
		if (this.elements.togglePlayAllBtnSwitch) {
			if (showPlayAll !== null) {
				this.elements.togglePlayAllBtnSwitch.checked = (showPlayAll === 'true');
			} else {
				localStorage.setItem('showPlayAllButton', this.elements.togglePlayAllBtnSwitch.checked.toString());
			}
			// Actual button display is on read.php
		}
		
		// Speak Next Hold Duration
		const savedHoldDuration = localStorage.getItem('speakNextHoldDuration');
		if (this.elements.speakNextHoldDurationInput) {
			if (savedHoldDuration) {
				this.elements.speakNextHoldDurationInput.value = savedHoldDuration;
			} else {
				localStorage.setItem('speakNextHoldDuration', this.elements.speakNextHoldDurationInput.value);
			}
		}
		
		// Display Text Font Size
		const savedFontSize = localStorage.getItem('displayTextFontSize');
		if (this.elements.displayTextFontSizeInput) {
			if (savedFontSize) {
				this.elements.displayTextFontSizeInput.value = savedFontSize;
			} else {
				localStorage.setItem('displayTextFontSize', this.elements.displayTextFontSizeInput.value);
			}
		}
		
		// TTS Engine
		const savedTtsEngine = localStorage.getItem('ttsEngine');
		if (this.elements.ttsEngineSelect) {
			if (savedTtsEngine && this.elements.ttsEngineSelect.querySelector(`option[value="${savedTtsEngine}"]`)) {
				this.elements.ttsEngineSelect.value = savedTtsEngine;
			} else {
				localStorage.setItem('ttsEngine', this.elements.ttsEngineSelect.value);
			}
		}
		
		// TTS Voice (data-saved-voice is used by _updateVoiceAndLanguageUI)
		const savedTtsVoice = localStorage.getItem('ttsVoice');
		if (this.elements.ttsVoiceSelect && savedTtsVoice) {
			this.elements.ttsVoiceSelect.setAttribute('data-saved-voice', savedTtsVoice);
		}
		
		// TTS Language Code
		const savedTtsLang = localStorage.getItem('ttsLanguageCode');
		if (this.elements.ttsLanguageCodeSelect) {
			if (savedTtsLang && this.elements.ttsLanguageCodeSelect.querySelector(`option[value="${savedTtsLang}"]`)) {
				this.elements.ttsLanguageCodeSelect.value = savedTtsLang;
			} else {
				localStorage.setItem('ttsLanguageCode', this.elements.ttsLanguageCodeSelect.value);
			}
		}
		
		// Chunk settings (wordsPerChunkInput, chunkUnitSelect, volumeInput)
		// These are standard inputs, so their values will be set if present, or localStorage will be set.
		['wordsPerChunk', 'chunkUnit', 'volume'].forEach(key => {
			const inputElement = this.elements[key + (key === 'volume' || key === 'wordsPerChunk' ? 'Input' : 'Select')];
			if (inputElement) {
				const savedValue = localStorage.getItem(key);
				if (savedValue !== null) {
					inputElement.value = savedValue;
				} else {
					localStorage.setItem(key, inputElement.value);
				}
			}
		});
	}
	
	showStatus(message, type = 'info', duration = 3000) {
		if (this.statusVerbosity === 'none') return;
		if (this.statusVerbosity === 'errors' && type !== 'danger' && type !== 'warning') return;
		
		if (this.elements.statusMessage) {
			this.elements.statusMessage.textContent = message;
			this.elements.statusMessage.className = `alert alert-${type} mt-2`;
			this.elements.statusMessage.style.display = 'block';
			if (this.statusTimeout) clearTimeout(this.statusTimeout);
			if (duration) {
				this.statusTimeout = setTimeout(() => {
					if (this.elements.statusMessage) {
						this.elements.statusMessage.style.display = 'none';
					}
				}, duration);
			}
		} else {
			console.log(`Status [${type}]: ${message}`);
		}
	}
	
	_bindSettingsListeners() {
		if (this.elements.floatingPlayButtonSwitch) {
			this.elements.floatingPlayButtonSwitch.addEventListener('change', (e) => {
				const isEnabled = e.target.checked;
				localStorage.setItem('floatingPlayButtonEnabled', isEnabled.toString());
				this.showStatus(`Floating button preference ${isEnabled ? 'enabled' : 'disabled'} (for Read Page).`, 'info', 1500);
			});
		}
		
		if (this.elements.unreadTextOpacityInput) {
			this.elements.unreadTextOpacityInput.addEventListener('input', (e) => {
				const opacity = e.target.value;
				if (this.elements.unreadTextOpacityValue) this.elements.unreadTextOpacityValue.textContent = `${opacity}%`;
				localStorage.setItem('unreadTextOpacity', opacity);
			});
		}
		
		if (this.elements.statusVerbositySelect) {
			this.elements.statusVerbositySelect.addEventListener('change', (e) => {
				this.statusVerbosity = e.target.value;
				localStorage.setItem('statusVerbosity', this.statusVerbosity);
				this.showStatus(`Status messages set to: ${this.statusVerbosity}`, 'info', 1500);
			});
		}
		
		if (this.elements.togglePlayAllBtnSwitch) {
			this.elements.togglePlayAllBtnSwitch.addEventListener('change', (e) => {
				const show = e.target.checked;
				localStorage.setItem('showPlayAllButton', show.toString());
				this.showStatus(`"Play All" button visibility preference saved (for Read Page).`, 'info', 1500);
			});
		}
		
		if (this.elements.speakNextHoldDurationInput) {
			this.elements.speakNextHoldDurationInput.addEventListener('change', (e) => {
				localStorage.setItem('speakNextHoldDuration', e.target.value);
				this.showStatus(`"Speak Next" hold duration set to ${e.target.value}ms. Setting saved.`, 'info', 1500);
			});
		}
		
		if (this.elements.displayTextFontSizeInput) {
			this.elements.displayTextFontSizeInput.addEventListener('input', (e) => { // Use 'input' for live update of storage
				const fontSize = e.target.value;
				if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
					localStorage.setItem('displayTextFontSize', fontSize);
				}
			});
			this.elements.displayTextFontSizeInput.addEventListener('change', (e) => { // 'change' for final validation and status
				const fontSize = e.target.value;
				if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
					localStorage.setItem('displayTextFontSize', fontSize);
					this.showStatus(`Display font size set to ${fontSize}px. Setting saved.`, 'info', 1500);
				} else {
					const lastValidSize = localStorage.getItem('displayTextFontSize') || e.target.defaultValue;
					e.target.value = lastValidSize;
					this.showStatus(`Font size out of range. Reset to ${lastValidSize}px.`, 'warning', 2000);
				}
			});
		}
	}
	
	_updateVoiceAndLanguageUI() {
		if (!this.elements.ttsEngineSelect || !this.elements.ttsVoiceSelect || !this.elements.ttsLanguageCodeContainer) {
			return;
		}
		
		const selectedEngine = this.elements.ttsEngineSelect.value;
		const voiceSelect = this.elements.ttsVoiceSelect;
		const langContainer = this.elements.ttsLanguageCodeContainer;
		const langSelect = this.elements.ttsLanguageCodeSelect;
		const optgroups = voiceSelect.getElementsByTagName('optgroup');
		let firstVisibleOptionValue = null;
		
		for (let optgroup of optgroups) {
			const isRelevantOpenAI = selectedEngine === 'openai' && optgroup.label === 'OpenAI Voices';
			const isRelevantGoogle = selectedEngine === 'google' && optgroup.label === 'Google Voices';
			optgroup.style.display = (isRelevantOpenAI || isRelevantGoogle) ? '' : 'none';
			if (optgroup.style.display === '' && !firstVisibleOptionValue && optgroup.options && optgroup.options.length > 0) {
				firstVisibleOptionValue = optgroup.options[0].value;
			}
		}
		
		const savedVoice = voiceSelect.getAttribute('data-saved-voice') || localStorage.getItem('ttsVoice');
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
		
		if (!currentVoiceStillVisible && firstVisibleOptionValue) {
			voiceSelect.value = firstVisibleOptionValue;
		} else if (!currentVoiceStillVisible) {
			const currentOptgroup = Array.from(optgroups).find(og => og.style.display !== 'none');
			if (currentOptgroup && currentOptgroup.options && currentOptgroup.options.length > 0) {
				voiceSelect.value = currentOptgroup.options[0].value;
			}
		}
		
		localStorage.setItem('ttsVoice', voiceSelect.value);
		if (voiceSelect.hasAttribute('data-saved-voice')) voiceSelect.removeAttribute('data-saved-voice');
		
		// Browser Voice Select specific handling
		if (selectedEngine === 'browser') {
			voiceSelect.style.display = 'none'; // Hide server voice select
			langContainer.style.display = ''; // Show language for browser (can be default)
			if (langSelect) langSelect.disabled = false;
			
			let browserVoiceContainer = document.getElementById('browserVoiceSelectContainer');
			if (!browserVoiceContainer) {
				browserVoiceContainer = document.createElement('div');
				browserVoiceContainer.className = 'col-md-3 mb-3'; // Same as ttsVoiceSelect's parent
				browserVoiceContainer.id = 'browserVoiceSelectContainer';
				
				const label = document.createElement('label');
				label.className = 'form-label';
				label.innerHTML = '<i class="fas fa-microphone text-info me-1"></i>Browser Voice:';
				label.setAttribute('for', 'browserVoiceSelectElement'); // Unique ID for the select
				
				const select = document.createElement('select');
				select.className = 'form-select';
				select.id = 'browserVoiceSelectElement'; // Store this in elements if needed by other parts
				this.elements.browserVoiceSelectElement = select; // Add to DOMElements for UIManager
				
				browserVoiceContainer.appendChild(label);
				browserVoiceContainer.appendChild(select);
				voiceSelect.parentNode.after(browserVoiceContainer); // Insert after original voice select's parent div
				this._populateBrowserVoices(); // Populate and bind
			}
			browserVoiceContainer.style.display = '';
		} else {
			voiceSelect.style.display = ''; // Show server voice select
			const browserVoiceContainer = document.getElementById('browserVoiceSelectContainer');
			if (browserVoiceContainer) {
				browserVoiceContainer.style.display = 'none';
			}
		}
		
		// Language select visibility based on engine
		if (selectedEngine === 'google') {
			langContainer.style.display = '';
			if (langSelect) langSelect.disabled = false;
		} else if (selectedEngine === 'openai' || selectedEngine === 'browser') {
			// For browser, language is often tied to voice, but allow selection for default
			// For OpenAI, language is not selected this way.
			langContainer.style.display = (selectedEngine === 'browser') ? '' : 'none';
			if (langSelect) langSelect.disabled = (selectedEngine === 'openai');
		}
	}
	
	_populateBrowserVoices() {
		const browserVoiceSelect = this.elements.browserVoiceSelectElement; // Using the one created in _updateVoiceAndLanguageUI
		if (!browserVoiceSelect || !window.speechSynthesis) return;
		
		browserVoiceSelect.innerHTML = ''; // Clear existing
		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.text = 'Default Browser Voice';
		browserVoiceSelect.appendChild(defaultOption);
		
		const populate = () => {
			const voices = window.speechSynthesis.getVoices();
			voices.forEach(voice => {
				const option = document.createElement('option');
				option.value = voice.name;
				option.text = `${voice.name} (${voice.lang})`;
				browserVoiceSelect.appendChild(option);
			});
			const savedBrowserVoice = localStorage.getItem('browserTtsVoice');
			if (savedBrowserVoice) {
				browserVoiceSelect.value = savedBrowserVoice;
			}
		};
		
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = populate;
		}
		populate(); // Initial call
		
		browserVoiceSelect.addEventListener('change', (e) => {
			localStorage.setItem('browserTtsVoice', e.target.value);
			this.showStatus(`Browser TTS Voice preference saved.`, 'info', 1500);
			// No direct call to playbackManager, read.php will use this from localStorage
		});
	}
	
	_bindTtsSettingsListeners() {
		if (this.elements.ttsEngineSelect) {
			this.elements.ttsEngineSelect.addEventListener('change', (e) => {
				localStorage.setItem('ttsEngine', e.target.value);
				this._updateVoiceAndLanguageUI();
				this.showStatus(`TTS Engine set to ${e.target.options[e.target.selectedIndex].text}. Setting saved.`, 'info', 2000);
			});
		}
		if (this.elements.ttsVoiceSelect) {
			this.elements.ttsVoiceSelect.addEventListener('change', (e) => {
				localStorage.setItem('ttsVoice', e.target.value);
				this.showStatus(`TTS Voice set to ${e.target.options[e.target.selectedIndex].text}. Setting saved.`, 'info', 2000);
			});
		}
		if (this.elements.ttsLanguageCodeSelect) {
			this.elements.ttsLanguageCodeSelect.addEventListener('change', (e) => {
				localStorage.setItem('ttsLanguageCode', e.target.value);
				this.showStatus(`TTS Language set to ${e.target.value}. Setting saved.`, 'info', 2000);
			});
		}
	}
	
	_bindAIGenerationListeners() {
		if (!this.elements.generateAiTextBtn || !this.elements.aiPromptInput || !this.elements.aiPreviewArea || !this.elements.useAiTextBtn) return;
		
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
				const response = await fetch(window.location.href, {method: 'POST', body: formData});
				const result = await response.json();
				if (result.require_verification) {
					window.location.reload();
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
			// Removed playbackManager.handleTextChange
			if (this.aiModalInstance) this.aiModalInstance.hide();
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
		if (!this.elements.savedTextsList || !this.elements.localStorageLoadModal) return;
		const texts = this._getSavedTexts();
		this.elements.savedTextsList.innerHTML = '';
		if (texts.length === 0) {
			this.elements.savedTextsList.innerHTML = '<li class="list-group-item">No texts saved yet.</li>';
			return;
		}
		texts.sort((a, b) => b.id - a.id);
		texts.forEach(item => {
			const li = document.createElement('li');
			li.className = 'list-group-item d-flex justify-content-between align-items-center';
			const textPreview = document.createElement('span');
			textPreview.className = 'text-preview';
			textPreview.textContent = `${item.name}`;
			textPreview.title = `Preview: ${item.text.substring(0, 200).replace(/\n/g, ' ')}...`;
			
			const btnGroup = document.createElement('div');
			const loadBtn = document.createElement('button');
			loadBtn.className = 'btn btn-sm btn-outline-primary';
			loadBtn.innerHTML = '<i class="fas fa-download"></i> Load';
			loadBtn.onclick = () => {
				this.elements.mainTextarea.value = item.text;
				// Removed playbackManager.handleTextChange
				// Removed displayText update
				const modalInstance = bootstrap.Modal.getInstance(this.elements.localStorageLoadModal);
				if (modalInstance) modalInstance.hide();
				this.showStatus(`Text "${item.name}" loaded.`, 'success');
			};
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
			deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
			deleteBtn.onclick = () => {
				if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
					const updatedTexts = texts.filter(t => t.id !== item.id);
					this._saveTexts(updatedTexts);
					this._populateLoadModal();
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
		if (this.elements.saveToStorageBtn) {
			this.elements.saveToStorageBtn.addEventListener('click', () => {
				const text = this.elements.mainTextarea.value.trim();
				if (!text) {
					this.showStatus('Textarea is empty. Nothing to save.', 'warning');
					return;
				}
				const texts = this._getSavedTexts();
				const defaultName = text.substring(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? "..." : "");
				const name = prompt("Enter a name for this text:", defaultName);
				if (name === null) return;
				texts.push({id: Date.now().toString(), name: name || defaultName, text: text});
				this._saveTexts(texts);
				this.showStatus('Text saved to LocalStorage!', 'success');
			});
		}
		if (this.elements.localStorageLoadModal) {
			this.elements.localStorageLoadModal.addEventListener('show.bs.modal', () => this._populateLoadModal());
		}
	}
	
	_bindMainTextareaListener() {
		if (this.elements.mainTextarea) {
			this.elements.mainTextarea.addEventListener('input', () => {
				// Removed playbackManager.handleTextChange
				// Optionally, save draft to localStorage if desired for index.php persistence
				// localStorage.setItem('mainTextareaDraft', this.elements.mainTextarea.value);
			});
		}
	}
	
	_bindChunkUnitListener() {
		if (this.elements.chunkUnitSelect && this.elements.wordsPerChunkInput && this.elements.wordsPerChunkLabel) {
			this.elements.chunkUnitSelect.addEventListener('change', (e) => {
				const unit = e.target.value;
				if (unit === 'sentences') {
					this.elements.wordsPerChunkLabel.textContent = 'Sentences per chunk (approx):';
					if (parseInt(this.elements.wordsPerChunkInput.value) > 5 || parseInt(this.elements.wordsPerChunkInput.value) < 1) {
						this.elements.wordsPerChunkInput.value = '1';
					}
				} else {
					this.elements.wordsPerChunkLabel.textContent = 'Words per chunk (approx):';
					if (parseInt(this.elements.wordsPerChunkInput.value) < 3 || parseInt(this.elements.wordsPerChunkInput.value) > 100) {
						this.elements.wordsPerChunkInput.value = '10';
					}
				}
				localStorage.setItem('chunkUnit', unit);
				localStorage.setItem('wordsPerChunk', this.elements.wordsPerChunkInput.value);
				// Removed playbackManager.handleChunkSettingsChange and displayText update
				this.showStatus(`Chunking settings updated and saved.`, 'info', 1500);
			});
		}
		// Save wordsPerChunk and volume on their own change too
		if (this.elements.wordsPerChunkInput) {
			this.elements.wordsPerChunkInput.addEventListener('change', (e) => {
				localStorage.setItem('wordsPerChunk', e.target.value);
				this.showStatus(`Words/Sentences per chunk setting saved.`, 'info', 1500);
			});
		}
		if (this.elements.volumeInput) {
			this.elements.volumeInput.addEventListener('change', (e) => {
				localStorage.setItem('volume', e.target.value);
				this.showStatus(`Volume setting saved.`, 'info', 1500);
			});
		}
	}
	
	async fetchAndCacheChunk(textChunk) {
		if (!textChunk || textChunk.trim() === "") return {success: false, message: "Empty chunk"};
		
		const trimmedTextChunk = textChunk.trim();
		const ttsEngine = this.elements.ttsEngineSelect.value;
		const ttsVoice = this.elements.ttsVoiceSelect.value;
		const ttsLanguageCode = (ttsEngine === 'google' && !this.elements.ttsLanguageCodeSelect.disabled)
			? this.elements.ttsLanguageCodeSelect.value
			: 'n/a';
		const volume = this.elements.volumeInput.value;
		
		this.showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null);
		
		try {
			const formData = new FormData();
			formData.append('action', 'text_to_speech_chunk');
			formData.append('text_chunk', trimmedTextChunk);
			formData.append('tts_engine', ttsEngine);
			formData.append('voice', ttsVoice);
			formData.append('language_code', ttsLanguageCode);
			formData.append('volume', volume);
			
			const fetchOptions = {method: 'POST', body: formData};
			
			const response = await fetch(window.location.href, fetchOptions);
			
			const result = await response.json();
			
			// Check if we need verification (session expired)
			if (result.require_verification) {
				window.location.reload(); // Reload the page to trigger verification flow
				throw new Error('Session expired. Please reload the page to continue.');
			}
			
			if (result.success && result.fileUrl) {
				return {success: true, cached: false, url: result.fileUrl};
			} else {
				throw new Error(result.message || 'TTS generation failed on server');
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				this.showStatus('TTS request aborted.', 'info');
			} else {
				console.error("TTS request error:", error);
				this.showStatus('TTS Request Error: ' + error.message, 'danger');
			}
			throw error; // Re-throw to be caught by caller
		}
	}
	
	_extractChunkInternal(textToProcess, targetCount, unit) {
		let chunkEndIndex = -1;
		let itemsInChunk = 0;
		if (textToProcess.length === 0) {
			return {text: "", length: 0};
		}
		
		if (unit === 'words') {
			let inWord = false;
			let lastWordEndIndex = -1;
			for (let i = 0; i < textToProcess.length; i++) {
				const char = textToProcess[i];
				if (char.match(/\S/)) { // Non-whitespace
					if (!inWord) inWord = true;
					lastWordEndIndex = i;
				} else { // Whitespace
					if (inWord) {
						itemsInChunk++;
						inWord = false;
					}
				}
				// Break conditions for words
				if (char === '.' || char === ',' || char === '\n') { // Natural breaks
					if (inWord) { // Count word if ending on punctuation
						itemsInChunk++;
						inWord = false;
					}
					if (itemsInChunk >= targetCount || (itemsInChunk > 0 && (char === '\n' || char === '.'))) {
						chunkEndIndex = i;
						break;
					}
				}
				if (itemsInChunk >= targetCount && lastWordEndIndex !== -1) {
					chunkEndIndex = lastWordEndIndex;
					break;
				}
				chunkEndIndex = i; // Always advance chunkEndIndex to cover the whole string if no break condition met
			}
			if (inWord) itemsInChunk++; // Count last word if text ends mid-word
		} else if (unit === 'sentences') {
			let lastValidSentenceEnd = -1;
			for (let i = 0; i < textToProcess.length; i++) {
				const char = textToProcess[i];
				if (char === '.' || char === '!' || char === '?') {
					const prevTwo = textToProcess.substring(Math.max(0, i - 2), i).toLowerCase();
					const prevThree = textToProcess.substring(Math.max(0, i - 3), i).toLowerCase();
					if (!(char === '.' && (prevTwo === 'mr' || prevTwo === 'ms' || prevTwo === 'dr' || prevThree === 'mrs' || prevTwo === 'st' || prevTwo === 'co'))) {
						const nextChar = textToProcess[i + 1];
						if (nextChar === undefined || nextChar.match(/\s|"|'|\u201C|\u201D/)) {
							itemsInChunk++;
							lastValidSentenceEnd = i;
						}
					}
				} else if (char === '\n') {
					if (i > 0 && textToProcess[i - 1] === '\n' && itemsInChunk > 0) {
						lastValidSentenceEnd = i;
						break;
					}
				}
				if (itemsInChunk >= targetCount && lastValidSentenceEnd !== -1) {
					chunkEndIndex = lastValidSentenceEnd;
					break;
				}
				chunkEndIndex = (lastValidSentenceEnd !== -1 && itemsInChunk > 0) ? lastValidSentenceEnd : i;
			}
			if (chunkEndIndex === -1 && lastValidSentenceEnd !== -1 && itemsInChunk > 0) {
				chunkEndIndex = lastValidSentenceEnd;
			}
			if (itemsInChunk === 0 && targetCount > 0 && textToProcess.trim().length > 0) {
				itemsInChunk = 1;
				chunkEndIndex = textToProcess.length - 1;
			}
		}
		
		if (chunkEndIndex === -1 && textToProcess.length > 0) {
			chunkEndIndex = textToProcess.length - 1;
		} else if (textToProcess.length === 0) {
			return {text: "", length: 0};
		}
		const chunkText = textToProcess.substring(0, chunkEndIndex + 1);
		return {text: chunkText, length: chunkText.length};
	}
	
	async pregenerateAllAudioHandler() {
		const fullText = this.elements.mainTextarea.value;
		
		if (!fullText.trim()) {
			this.showStatus('Textarea is empty. Nothing to pregenerate.', 'warning');
			this.pregenerateAbortController = null;
			return;
		}
		
		this.elements.pregenerateAllBtn.disabled = true;
		this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pregenerating...';
		
		let tempPosition = 0;
		const chunksToFetch = [];
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		
		while (tempPosition < fullText.length) {
			const remainingText = fullText.substring(tempPosition);
			if (remainingText.trim() === "") break;
			const chunkResult = this._extractChunkInternal(remainingText, countPerChunk, unit);
			if (chunkResult.length === 0) break;
			if (chunkResult.text.trim() !== "") {
				chunksToFetch.push(chunkResult.text.trim());
			}
			tempPosition += chunkResult.length;
		}
		
		let successCount = 0;
		let failCount = 0;
		this.showStatus(`Starting pregeneration for ${chunksToFetch.length} chunks...`, 'info', null);
		
		for (let i = 0; i < chunksToFetch.length; i++) {
			const chunkText = chunksToFetch[i];
			
			const ttsEngine = this.elements.ttsEngineSelect.value;
			const ttsVoice = this.elements.ttsVoiceSelect.value;
			const ttsLanguageCode = (ttsEngine === 'google' && !this.elements.ttsLanguageCodeSelect.disabled) ? this.elements.ttsLanguageCodeSelect.value : 'n/a';
			const volume = this.elements.volumeInput.value;
			
			this.showStatus(`Pregenerating chunk ${i + 1}/${chunksToFetch.length}: "${chunkText.substring(0, 20)}..."`, 'info', null);
			try {
				await this.fetchAndCacheChunk(chunkText);
				successCount++;
			} catch (error) {
				failCount++;
				if (error.name === 'AbortError') break;
			}
		}
		this.elements.pregenerateAllBtn.disabled = false;
		this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		
		if (chunksToFetch.length === 0) {
			this.showStatus('No speakable chunks found to pregenerate.', 'info');
			this.elements.pregenerateAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		}
	}
}
