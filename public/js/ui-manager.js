class UIManager {
	constructor(elements) {
		this.elements = elements;
		this.playbackManager = null;
		this.statusVerbosity = 'errors';
		this.controlElementsToToggle = [
			this.elements.settingsCard,
			this.elements.mainControlsContainer,
			this.elements.mainTextarea,
			this.elements.mainTextareaLabel,
		];
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
		this.recaptchaV2WidgetIdAI = null;
		this.recaptchaV2WidgetIdShared = null;
		this.currentRecaptchaResolve = null;
		this.currentRecaptchaReject = null;
		this.isRecaptchaVerificationInProgress = false;
		this.activeRecaptchaContext = null; // 'ai' or 'shared'
		this.recaptchaModalInstance = null;
		this.aiModalInstance = null;
	}
	
	setPlaybackManager(playbackManager) {
		this.playbackManager = playbackManager;
	}
	
	init() {
		this._loadAndApplyInitialSettings();
		this._bindSettingsListeners();
		this._bindAIGenerationListeners();
		this._bindLocalStorageListeners();
		this._bindHideShowControlsListeners();
		this._bindMainTextareaListener();
		this._bindChunkUnitListener();
		this._bindTtsSettingsListeners();
		this._updateVoiceAndLanguageUI();
		document.body.classList.add('playback-controls-active');
		
		if (this.elements.recaptchaV2Modal) {
			this.recaptchaModalInstance = new bootstrap.Modal(this.elements.recaptchaV2Modal);
			this.elements.cancelRecaptchaV2ModalBtn.addEventListener('click', () => {
				if (this.currentRecaptchaReject) {
					this.currentRecaptchaReject(new Error('reCAPTCHA verification cancelled by user.'));
				}
				this._resetRecaptchaState();
				this.recaptchaModalInstance.hide();
				// Reset the shared reCAPTCHA widget if it exists
				if (this.recaptchaV2WidgetIdShared !== null && typeof grecaptcha !== 'undefined') {
					try {
						grecaptcha.reset(this.recaptchaV2WidgetIdShared);
					} catch (e) {
						console.warn("Error resetting shared reCAPTCHA widget:", e);
					}
				}
			});
		}
		
		if (this.elements.aiGenerateModal) {
			this.aiModalInstance = new bootstrap.Modal(this.elements.aiGenerateModal);
			this.elements.aiGenerateModal.addEventListener('hidden.bs.modal', () => {
				if (this.recaptchaV2WidgetIdAI !== null && typeof grecaptcha !== 'undefined') {
					try {
						grecaptcha.reset(this.recaptchaV2WidgetIdAI);
					} catch (e) {
						console.warn("Error resetting AI reCAPTCHA widget on modal hide:", e);
					}
				}
				// If a verification was pending for AI modal and it's closed, reject it.
				if (this.isRecaptchaVerificationInProgress && this.currentRecaptchaReject && this.activeRecaptchaContext === 'ai') {
					// Check if the error is due to modal closure or another reason
					if (this.elements.aiGenerateModal && !this.elements.aiGenerateModal.classList.contains('show')) {
						this.currentRecaptchaReject(new Error('AI reCAPTCHA modal closed before completion.'));
					} // else, another error might have occurred, let that propagate
				}
				// Don't call _resetRecaptchaState() here if an error is already being handled by reject.
				// Only reset if it was a clean close without an active promise being rejected for other reasons.
			});
			
			this.elements.aiGenerateModal.addEventListener('shown.bs.modal', () => {
				// Render reCAPTCHA in AI modal if not already present
				if (this.elements.aiRecaptchaWidgetContainer && !this.elements.aiRecaptchaWidgetContainer.hasChildNodes() && this.recaptchaV2WidgetIdAI === null) {
					if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render !== 'undefined' && RECAPTCHA_SITE_KEY) {
						try {
							this.recaptchaV2WidgetIdAI = grecaptcha.render(this.elements.aiRecaptchaWidgetContainer, {
								'sitekey': RECAPTCHA_SITE_KEY,
								'callback': 'onRecaptchaV2Success', // Global callback
								'expired-callback': 'onRecaptchaV2Expired', // Global callback
								'error-callback': 'onRecaptchaV2Error' // Global callback
							});
						} catch (e) {
							console.error("Error rendering reCAPTCHA in AI modal 'shown' event:", e);
							this.showStatus('Could not load reCAPTCHA widget.', 'danger');
							if (this.elements.aiRecaptchaWidgetContainer) this.elements.aiRecaptchaWidgetContainer.innerHTML = '<p class="text-danger">reCAPTCHA failed to load. Please ensure you are online and try again.</p>';
						}
					} else {
						this.showStatus('reCAPTCHA not available or not configured.', 'warning');
						if (this.elements.aiRecaptchaWidgetContainer) this.elements.aiRecaptchaWidgetContainer.innerHTML = '<p class="text-danger">reCAPTCHA script not loaded or site key missing.</p>';
					}
				}
			});
		}
		
		globalRecaptchaV2SuccessCallback = this._handleRecaptchaV2Success.bind(this);
		globalRecaptchaV2ExpiredCallback = this._handleRecaptchaV2Expired.bind(this);
		globalRecaptchaV2ErrorCallback = this._handleRecaptchaV2Error.bind(this);
	}
	
	_resetRecaptchaState() {
		this.isRecaptchaVerificationInProgress = false;
		this.currentRecaptchaResolve = null;
		this.currentRecaptchaReject = null;
		this.activeRecaptchaContext = null;
		if (this.elements.recaptchaV2Error) this.elements.recaptchaV2Error.style.display = 'none';
	}
	
	_handleRecaptchaV2Success(token) {
		if (!this.isRecaptchaVerificationInProgress || !this.currentRecaptchaResolve) {
			// This can happen if reCAPTCHA is solved outside of an active request flow (e.g. user solves it in AI modal before clicking generate)
			// Or if state was reset prematurely.
			console.warn("reCAPTCHA success callback triggered without active verification promise.");
			// If it's the AI context and the widget exists, we can just let the generate button pick up the token.
			// If it's shared context, this is less likely to be a problem as modal would typically be open.
			return;
		}
		this.currentRecaptchaResolve(token);
		if (this.activeRecaptchaContext === 'shared' && this.recaptchaModalInstance) {
			this.recaptchaModalInstance.hide();
		}
		// For AI modal, it stays open. The promise resolution handles the next step.
		this._resetRecaptchaState();
	}
	
	_handleRecaptchaV2Expired() {
		const message = 'reCAPTCHA challenge expired. Please try again.';
		this.showStatus(message, 'warning');
		if (this.currentRecaptchaReject) {
			this.currentRecaptchaReject(new Error(message));
		}
		
		if (this.activeRecaptchaContext === 'shared') {
			if (this.elements.recaptchaV2Error) {
				this.elements.recaptchaV2Error.textContent = message;
				this.elements.recaptchaV2Error.style.display = 'block';
			}
			if (this.recaptchaV2WidgetIdShared !== null && typeof grecaptcha !== 'undefined') {
				try {
					grecaptcha.reset(this.recaptchaV2WidgetIdShared);
				} catch (e) {
					console.warn("Error resetting shared reCAPTCHA on expiry:", e);
				}
			}
		} else if (this.activeRecaptchaContext === 'ai') {
			if (this.recaptchaV2WidgetIdAI !== null && typeof grecaptcha !== 'undefined') {
				try {
					grecaptcha.reset(this.recaptchaV2WidgetIdAI);
				} catch (e) {
					console.warn("Error resetting AI reCAPTCHA on expiry:", e);
				}
			}
			// Update UI in AI modal if needed
			if (this.elements.aiPreviewArea && this.elements.aiGenerateModal.classList.contains('show')) {
				this.elements.aiPreviewArea.innerHTML = `<p class="text-warning">${message}</p>`;
			}
		}
		this._resetRecaptchaState(); // Reset state after handling expiry
	}
	
	_handleRecaptchaV2Error() {
		const message = 'reCAPTCHA error. Please check your connection or try again later.';
		this.showStatus(message, 'danger');
		if (this.currentRecaptchaReject) {
			this.currentRecaptchaReject(new Error(message));
		}
		
		if (this.activeRecaptchaContext === 'shared') {
			if (this.elements.recaptchaV2Error) {
				this.elements.recaptchaV2Error.textContent = 'Error loading challenge. Please try again.';
				this.elements.recaptchaV2Error.style.display = 'block';
			}
			// Optionally try to reset, or advise refresh
		} else if (this.activeRecaptchaContext === 'ai') {
			if (this.elements.aiPreviewArea && this.elements.aiGenerateModal.classList.contains('show')) {
				this.elements.aiPreviewArea.innerHTML = `<p class="text-danger">${message}</p>`;
			}
		}
		this._resetRecaptchaState(); // Reset state after handling error
	}
	
	requestRecaptchaV2Verification(actionName, context = 'shared') {
		return new Promise((resolve, reject) => {
			if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render === 'undefined') {
				const msg = 'reCAPTCHA library not loaded. Please refresh.';
				this.showStatus(msg, 'danger');
				reject(new Error(msg));
				return;
			}
			if (typeof RECAPTCHA_SITE_KEY === 'undefined' || !RECAPTCHA_SITE_KEY) {
				const msg = 'reCAPTCHA site key not configured. Action disabled.';
				this.showStatus(msg, 'danger');
				reject(new Error(msg));
				return;
			}
			
			if (this.isRecaptchaVerificationInProgress) {
				// If a verification is already in progress for a *different* context, reject.
				if (this.activeRecaptchaContext !== context) {
					reject(new Error('Another reCAPTCHA verification is already in progress for a different action.'));
					return;
				}
				// If for the same context, the existing promise should be awaited by the caller.
				// However, this function creates a new promise. This might lead to issues if called multiple times rapidly.
				// For now, let's assume UI disables buttons to prevent rapid calls for the same context.
				// If a promise is already active for this context, we should ideally return that.
				// But for simplicity, we'll proceed, and the global callbacks will handle the latest one.
				console.warn("New reCAPTCHA verification requested while one might be active for the same context:", context);
			}
			
			this.isRecaptchaVerificationInProgress = true;
			this.currentRecaptchaResolve = resolve;
			this.currentRecaptchaReject = reject;
			this.activeRecaptchaContext = context;
			
			let widgetIdProperty, widgetContainerElement, widgetId;
			
			if (context === 'ai') {
				widgetIdProperty = 'recaptchaV2WidgetIdAI';
				widgetContainerElement = this.elements.aiRecaptchaWidgetContainer;
				widgetId = this.recaptchaV2WidgetIdAI;
				// AI modal is assumed to be already visible or managed by its own logic.
			} else { // 'shared'
				widgetIdProperty = 'recaptchaV2WidgetIdShared';
				widgetContainerElement = this.elements.sharedRecaptchaWidgetContainer;
				widgetId = this.recaptchaV2WidgetIdShared;
				if (this.elements.recaptchaV2Error) this.elements.recaptchaV2Error.style.display = 'none';
				this.recaptchaModalInstance.show();
			}
			
			if (!widgetContainerElement) {
				console.error(`reCAPTCHA container element for context '${context}' not found.`);
				this.currentRecaptchaReject(new Error(`reCAPTCHA UI element missing for ${context}.`));
				this._resetRecaptchaState();
				if (context === 'shared' && this.recaptchaModalInstance) this.recaptchaModalInstance.hide();
				return;
			}
			
			try {
				// If widget doesn't exist or container is empty, render it.
				// Otherwise, reset the existing widget.
				if (widgetId === null || !widgetContainerElement.hasChildNodes()) {
					widgetContainerElement.innerHTML = ''; // Clear previous attempts or messages
					this[widgetIdProperty] = grecaptcha.render(widgetContainerElement, {
						'sitekey': RECAPTCHA_SITE_KEY,
						'callback': 'onRecaptchaV2Success',
						'expired-callback': 'onRecaptchaV2Expired',
						'error-callback': 'onRecaptchaV2Error',
						'theme': document.documentElement.getAttribute('data-bs-theme') || 'light'
					});
				} else {
					grecaptcha.reset(widgetId);
				}
			} catch (e) {
				console.error(`Error rendering or resetting reCAPTCHA for context '${context}':`, e);
				const msg = 'Failed to display reCAPTCHA. Please refresh.';
				this.showStatus(msg, 'danger');
				this.currentRecaptchaReject(new Error(msg + " Details: " + e.message));
				this._resetRecaptchaState();
				if (context === 'shared' && this.recaptchaModalInstance) this.recaptchaModalInstance.hide();
			}
		});
	}
	
	
	_loadAndApplyInitialSettings() {
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
		
		if (selectedEngine === 'google') {
			langContainer.style.display = '';
			langSelect.disabled = false;
		} else {
			langContainer.style.display = 'none';
			langSelect.disabled = true;
		}
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
			this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
			this.elements.aiPreviewArea.innerHTML = 'Verifying human presence... <i class="fas fa-user-check"></i>';
			this.elements.useAiTextBtn.disabled = true;
			
			let recaptchaToken;
			try {
				// Always try to get a response from an existing widget first (if user solved it before clicking generate)
				if (this.recaptchaV2WidgetIdAI !== null && typeof grecaptcha !== 'undefined') {
					recaptchaToken = grecaptcha.getResponse(this.recaptchaV2WidgetIdAI);
				}
				
				if (!recaptchaToken) {
					this.elements.aiPreviewArea.innerHTML = 'Please complete the reCAPTCHA challenge above.';
					// RequestRecaptchaV2Verification will render/reset the widget if needed
					// and its promise resolves when the user solves it.
					recaptchaToken = await this.requestRecaptchaV2Verification('generate_ai_text', 'ai');
				}
				// If requestRecaptchaV2Verification was called, its promise resolved, so we have a token.
				
				this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
				this.elements.aiPreviewArea.innerHTML = 'Generating text with AI... <i class="fas fa-robot fa-spin"></i>';
				
				const formData = new FormData();
				formData.append('action', 'generate_text_ai');
				formData.append('prompt', prompt);
				formData.append('g-recaptcha-response', recaptchaToken);
				
				const response = await fetch(window.location.href, {
					method: 'POST',
					body: formData
				});
				const result = await response.json();
				
				if (result.success && result.text) {
					this.elements.aiPreviewArea.innerHTML = result.text.replace(/\n/g, '<br>');
					this.elements.useAiTextBtn.disabled = false;
					this.showStatus('AI text generated successfully.', 'success');
				} else {
					this.elements.aiPreviewArea.textContent = 'Error: ' + (result.message || 'Could not generate text.');
					this.showStatus('AI generation failed: ' + (result.message || 'Unknown error'), 'danger');
				}
				
			} catch (error) { // Catches errors from requestRecaptchaV2Verification or fetch
				this.elements.aiPreviewArea.textContent = 'Error: ' + error.message;
				this.showStatus('AI generation process error: ' + error.message, 'danger');
				// Ensure reCAPTCHA state is clean if it was a reCAPTCHA error
				if (error.message.toLowerCase().includes('recaptcha')) {
					this._resetRecaptchaState(); // Clean up if reCAPTCHA promise rejected
				}
			} finally {
				this.elements.generateAiTextBtn.disabled = false;
				this.elements.generateAiTextBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate';
				// Reset the AI reCAPTCHA widget for the next attempt
				if (this.recaptchaV2WidgetIdAI !== null && typeof grecaptcha !== 'undefined') {
					try {
						grecaptcha.reset(this.recaptchaV2WidgetIdAI);
					} catch (e) {
						console.warn("Error resetting AI reCAPTCHA widget post-generation:", e);
					}
				}
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
			this.elements.toggleControlsBtn.innerHTML = show ?
				'<i class="fas fa-eye-slash"></i> Hide Controls' :
				'<i class="fas fa-eye"></i> Show Controls'; // Change icon/text
		}
	}
	
	_bindHideShowControlsListeners() {
		let controlsVisible = true; // Initial state
		this.elements.toggleControlsBtn.addEventListener('click', () => {
			controlsVisible = !controlsVisible;
			this._updateControlsVisibility(controlsVisible);
		});
		
		this.elements.h3Title.addEventListener('dblclick', () => {
			controlsVisible = true; // Always show on double click
			this._updateControlsVisibility(controlsVisible);
		});
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
