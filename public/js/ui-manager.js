class UIManager {
	constructor(elements) {
		this.elements = elements;
		this.statusVerbosity = 'errors';
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
		this.userTexts = []; // To hold texts loaded from the DB
	}
	
	// --- Start: Functions to replace localStorage with DB sync ---
	async _updateDbSetting(key, value) {
		const formData = new FormData();
		formData.append('action', 'update_user_setting');
		formData.append('setting_key', key);
		formData.append('setting_value', value);
		try {
			const response = await fetch('ajax.php', {method: 'POST', body: formData});
			const result = await response.json();
			if (!result.success) {
				console.error(`Failed to save setting ${key}:`, result.message);
				this.showStatus(`Error saving setting: ${result.message}`, 'danger');
			}
		} catch (error) {
			console.error(`Error saving setting ${key}:`, error);
			this.showStatus(`Network error while saving setting.`, 'danger');
		}
	}
	
	async _loadUserTexts() {
		try {
			const formData = new FormData();
			formData.append('action', 'get_user_texts');
			const response = await fetch('ajax.php', {method: 'POST', body: formData});
			const result = await response.json();
			if (result.success) {
				this.userTexts = result.texts;
			} else {
				this.showStatus('Could not load saved texts: ' + result.message, 'warning');
			}
		} catch (error) {
			this.showStatus('Network error loading saved texts.', 'danger');
		}
	}
	
	// --- End: DB Sync Functions ---
	
	async init() {
		await this._loadUserTexts(); // Load texts from DB first
		this._loadAndApplyInitialSettings(); // Loads from window.USER_SETTINGS, not localStorage
		this._bindSettingsListeners(); // Binds listeners that now save to DB
		this._bindAIGenerationListeners();
		this._bindLocalStorageListeners(); // Renamed, but now binds to DB operations
		this._bindMainTextareaListener();
		this._bindChunkUnitListener();
		this._bindTtsSettingsListeners();
		this._updateVoiceAndLanguageUI();
		if (this.elements.aiGenerateModal) {
			this.aiModalInstance = new bootstrap.Modal(this.elements.aiGenerateModal);
		}
		this.elements.pregenerateAllBtn.addEventListener('click', () => this.pregenerateAllAudioHandler());
	}
	
	_loadAndApplyInitialSettings() {
		const settings = window.USER_SETTINGS || {};
		
		// Helper to get a value from settings or a default
		const getSetting = (key, defaultValue) => settings[key] !== undefined ? settings[key] : defaultValue;
		
		// Floating Play Button Switch
		if (this.elements.floatingPlayButtonSwitch) {
			this.elements.floatingPlayButtonSwitch.checked = getSetting('floatingPlayButtonEnabled', false);
		}
		// Unread Text Opacity
		if (this.elements.unreadTextOpacityInput && this.elements.unreadTextOpacityValue) {
			const opacity = getSetting('unreadTextOpacity', 30);
			this.elements.unreadTextOpacityInput.value = opacity;
			this.elements.unreadTextOpacityValue.textContent = `${opacity}%`;
		}
		// Status Verbosity
		if (this.elements.statusVerbositySelect) {
			this.elements.statusVerbositySelect.value = getSetting('statusVerbosity', 'errors');
			this.statusVerbosity = this.elements.statusVerbositySelect.value;
		} else {
			this.statusVerbosity = getSetting('statusVerbosity', 'errors');
		}
		// Toggle Play All Button Switch
		if (this.elements.togglePlayAllBtnSwitch) {
			this.elements.togglePlayAllBtnSwitch.checked = getSetting('showPlayAllButton', true);
		}
		// Speak Next Hold Duration
		if (this.elements.speakNextHoldDurationInput) {
			this.elements.speakNextHoldDurationInput.value = getSetting('speakNextHoldDuration', 750);
		}
		// Display Text Font Size
		if (this.elements.displayTextFontSizeInput) {
			this.elements.displayTextFontSizeInput.value = getSetting('displayTextFontSize', 40);
		}
		// TTS Engine
		if (this.elements.ttsEngineSelect) {
			this.elements.ttsEngineSelect.value = getSetting('ttsEngine', 'openai');
		}
		// TTS Voice (data-saved-voice is used by _updateVoiceAndLanguageUI)
		const savedTtsVoice = getSetting('ttsVoice', 'nova');
		if (this.elements.ttsVoiceSelect) {
			this.elements.ttsVoiceSelect.setAttribute('data-saved-voice', savedTtsVoice);
		}
		// TTS Language Code
		if (this.elements.ttsLanguageCodeSelect) {
			this.elements.ttsLanguageCodeSelect.value = getSetting('ttsLanguageCode', 'en-US');
		}
		// Browser TTS Voice
		// This is still best kept in localStorage as it's browser-specific and not a core user setting
		if (localStorage.getItem('browserTtsVoice')) {
			// The population logic will handle applying this
		}
		
		// Chunk settings
		if (this.elements.wordsPerChunkInput) this.elements.wordsPerChunkInput.value = getSetting('wordsPerChunk', 10);
		if (this.elements.chunkUnitSelect) this.elements.chunkUnitSelect.value = getSetting('chunkUnit', 'words');
		if (this.elements.volumeInput) this.elements.volumeInput.value = getSetting('volume', 6);
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
				this._updateDbSetting('floatingPlayButtonEnabled', isEnabled);
				this.showStatus(`Floating button preference ${isEnabled ? 'enabled' : 'disabled'} (for Read Page).`, 'info', 1500);
			});
		}
		if (this.elements.unreadTextOpacityInput) {
			this.elements.unreadTextOpacityInput.addEventListener('input', (e) => {
				const opacity = e.target.value;
				if (this.elements.unreadTextOpacityValue) this.elements.unreadTextOpacityValue.textContent = `${opacity}%`;
				this._updateDbSetting('unreadTextOpacity', opacity);
			});
		}
		if (this.elements.statusVerbositySelect) {
			this.elements.statusVerbositySelect.addEventListener('change', (e) => {
				this.statusVerbosity = e.target.value;
				this._updateDbSetting('statusVerbosity', this.statusVerbosity);
				this.showStatus(`Status messages set to: ${this.statusVerbosity}`, 'info', 1500);
			});
		}
		if (this.elements.togglePlayAllBtnSwitch) {
			this.elements.togglePlayAllBtnSwitch.addEventListener('change', (e) => {
				const show = e.target.checked;
				this._updateDbSetting('showPlayAllButton', show);
				this.showStatus(`"Play All" button visibility preference saved (for Read Page).`, 'info', 1500);
			});
		}
		if (this.elements.speakNextHoldDurationInput) {
			this.elements.speakNextHoldDurationInput.addEventListener('change', (e) => {
				this._updateDbSetting('speakNextHoldDuration', e.target.value);
				this.showStatus(`"Speak Next" hold duration set to ${e.target.value}ms. Setting saved.`, 'info', 1500);
			});
		}
		if (this.elements.displayTextFontSizeInput) {
			this.elements.displayTextFontSizeInput.addEventListener('input', (e) => {
				const fontSize = e.target.value;
				if (fontSize >= parseInt(e.target.min) && fontSize <= parseInt(e.target.max)) {
					this._updateDbSetting('displayTextFontSize', fontSize);
				}
			});
			this.elements.displayTextFontSizeInput.addEventListener('change', (e) => {
				this.showStatus(`Display font size setting saved.`, 'info', 1500);
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
		
		const savedVoice = voiceSelect.getAttribute('data-saved-voice') || window.USER_SETTINGS?.ttsVoice;
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
		this._updateDbSetting('ttsVoice', voiceSelect.value);
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
			// This is a browser-specific setting, so localStorage is appropriate here.
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
		});
	}
	
	_bindTtsSettingsListeners() {
		if (this.elements.ttsEngineSelect) {
			this.elements.ttsEngineSelect.addEventListener('change', (e) => {
				this._updateDbSetting('ttsEngine', e.target.value);
				this._updateVoiceAndLanguageUI();
				this.showStatus(`TTS Engine set to ${e.target.options[e.target.selectedIndex].text}. Setting saved.`, 'info', 2000);
			});
		}
		if (this.elements.ttsVoiceSelect) {
			this.elements.ttsVoiceSelect.addEventListener('change', (e) => {
				this._updateDbSetting('ttsVoice', e.target.value);
				this.showStatus(`TTS Voice set to ${e.target.options[e.target.selectedIndex].text}. Setting saved.`, 'info', 2000);
			});
		}
		if (this.elements.ttsLanguageCodeSelect) {
			this.elements.ttsLanguageCodeSelect.addEventListener('change', (e) => {
				this._updateDbSetting('ttsLanguageCode', e.target.value);
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
				const response = await fetch('ajax.php', {method: 'POST', body: formData});
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
			if (this.aiModalInstance) this.aiModalInstance.hide();
			this.showStatus('Text loaded into textarea.', 'success');
		});
	}
	
	_populateLoadModal() {
		if (!this.elements.savedTextsList) return;
		const texts = this.userTexts; // Use the texts loaded during init
		this.elements.savedTextsList.innerHTML = '';
		if (texts.length === 0) {
			this.elements.savedTextsList.innerHTML = '<li class="list-group-item">No texts saved yet.</li>';
			return;
		}
		
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
				const modalInstance = bootstrap.Modal.getInstance(this.elements.localStorageLoadModal);
				if (modalInstance) modalInstance.hide();
				this.showStatus(`Text "${item.name}" loaded.`, 'success');
			};
			
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
			deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
			deleteBtn.onclick = async () => {
				if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
					const formData = new FormData();
					formData.append('action', 'delete_user_text');
					formData.append('text_id', item.id);
					try {
						const response = await fetch('ajax.php', {method: 'POST', body: formData});
						const result = await response.json();
						if (result.success) {
							this.showStatus(`Text "${item.name}" deleted.`, 'info');
							await this._loadUserTexts(); // Refresh the list from DB
							this._populateLoadModal(); // Re-render the modal list
						} else {
							this.showStatus('Error deleting text: ' + result.message, 'danger');
						}
					} catch (error) {
						this.showStatus('Network error while deleting text.', 'danger');
					}
				}
			};
			
			btnGroup.appendChild(loadBtn);
			btnGroup.appendChild(deleteBtn);
			li.appendChild(textPreview);
			li.appendChild(btnGroup);
			this.elements.savedTextsList.appendChild(li);
		});
	}
	
	async saveTextToDb(text, name) {
		// 1. Validate that we have text and a name to save.
		if (!text || !name) {
			this.showStatus('Text or name is missing for saving.', 'warning');
			throw new Error('Text or name missing.');
		}
		
		// 2. Prepare the data for the AJAX request.
		const formData = new FormData();
		formData.append('action', 'save_user_text');
		formData.append('name', name);
		formData.append('text', text);
		
		try {
			// 3. Send the request to the server.
			const response = await fetch('ajax.php', {
				method: 'POST',
				body: formData
			});
			const result = await response.json();
			
			// 4. Handle the server's response.
			if (result.success) {
				this.showStatus(`Text "${name}" saved to your account!`, 'success');
				// Refresh the internal list of texts so the "Load Text" modal is up-to-date.
				await this._loadUserTexts();
			} else {
				// If the server reports failure, show an error and reject the promise.
				this.showStatus('Error saving text: ' + result.message, 'danger');
				throw new Error(result.message);
			}
		} catch (error) {
			// 5. Handle network errors.
			this.showStatus('Network error while saving text.', 'danger');
			throw error; // Re-throw the error so the caller knows the operation failed.
		}
	}
	
	_bindLocalStorageListeners() {
		// This now binds to DB operations
		if (this.elements.saveToStorageBtn) {
			this.elements.saveToStorageBtn.addEventListener('click', async () => {
				const text = this.elements.mainTextarea.value.trim();
				if (!text) {
					this.showStatus('Textarea is empty. Nothing to save.', 'warning');
					return;
				}
				const defaultName = text.substring(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? "..." : "");
				const name = prompt("Enter a name for this text:", defaultName);
				if (name === null) return; // User cancelled
				
				// Use the new reusable function
				await this.saveTextToDb(text, name || defaultName).catch(() => {
					// Error is already shown by saveTextToDb, so we just need to catch the rejection here.
				});
			});
		}
		
		if (this.elements.localStorageLoadModal) {
			// The modal is now populated with data already fetched on init
			this.elements.localStorageLoadModal.addEventListener('show.bs.modal', () => this._populateLoadModal());
		}
	}
	
	_bindMainTextareaListener() {
		if (this.elements.mainTextarea) {
			this.elements.mainTextarea.addEventListener('input', () => {
				// No action needed here anymore, changes are not auto-saved
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
				this._updateDbSetting('chunkUnit', unit);
				this._updateDbSetting('wordsPerChunk', this.elements.wordsPerChunkInput.value);
				this.showStatus(`Chunking settings updated and saved.`, 'info', 1500);
			});
		}
		if (this.elements.wordsPerChunkInput) {
			this.elements.wordsPerChunkInput.addEventListener('change', (e) => {
				this._updateDbSetting('wordsPerChunk', e.target.value);
				this.showStatus(`Words/Sentences per chunk setting saved.`, 'info', 1500);
			});
		}
		if (this.elements.volumeInput) {
			this.elements.volumeInput.addEventListener('change', (e) => {
				this._updateDbSetting('volume', e.target.value);
				this.showStatus(`Volume setting saved.`, 'info', 1500);
			});
		}
	}
	
	async fetchAndCacheChunk(textChunk) {
		if (!textChunk || textChunk.trim() === "") return {success: false, message: "Empty chunk"};
		const trimmedTextChunk = textChunk.trim();
		const ttsEngine = this.elements.ttsEngineSelect.value;
		const ttsVoice = this.elements.ttsVoiceSelect.value;
		const ttsLanguageCode = (ttsEngine === 'google' && !this.elements.ttsLanguageCodeSelect.disabled) ? this.elements.ttsLanguageCodeSelect.value : 'n/a';
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
			const response = await fetch('ajax.php', fetchOptions);
			const result = await response.json();
			if (result.require_verification) {
				window.location.reload();
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
			throw error;
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
		}
	}
}
