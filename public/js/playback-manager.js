class PlaybackManager {
	constructor(elements, showStatusCallback) {
		this.elements = elements;
		this.showStatus = showStatusCallback;
		this.currentTextPosition = 0;
		this.audioCache = {};
		this.isPlaying = false;
		this.playAllAbortController = null;
		this.holdStartTime = 0;
		this.holdAnimationId = null;
		this.isHoldingSpeakNext = false;
		
		this.unreadTextOpacity = 0.3;
		
		this.isFloatingButtonEnabled = false;
		this.floatingPlayButtonElement = null;
	}
	
	init() {
		this.elements.stopPlaybackBtn.disabled = true;
		this.floatingPlayButtonElement = document.getElementById('floatingPlayButton');
		this._bindPlaybackButtonListeners();
		
		this.isFloatingButtonEnabled = this.elements.floatingPlayButtonSwitch.checked;
		
		if (this.floatingPlayButtonElement) {
			this.floatingPlayButtonElement.addEventListener('click', () => {
				this.executeSpeakNextAction();
			});
		}
	}
	
	async browserTextToSpeech(text, voiceName, languageCode, volume) {
		return new Promise((resolve, reject) => {
			if (!window.speechSynthesis) {
				reject(new Error("Browser speech synthesis not supported"));
				return;
			}
			volume = 100; // Set volume to 100% for browser TTS
			
			// Cancel any ongoing speech
			window.speechSynthesis.cancel();
			
			const utterance = new SpeechSynthesisUtterance(text);
			
			// Set voice if specified
			if (voiceName) {
				const voices = window.speechSynthesis.getVoices();
				const selectedVoice = voices.find(voice => voice.name === voiceName);
				if (selectedVoice) {
					utterance.voice = selectedVoice;
				}
			}
			
			// Set language if not using a specific voice
			if (!utterance.voice && languageCode) {
				utterance.lang = languageCode;
			}
			
			// Set volume (0 to 1)
			utterance.volume = Math.min(1, Math.max(0, volume / 10)); // Convert 0-10 scale to 0-1
			
			// Set up event listeners
			utterance.onend = () => {
				resolve();
			};
			
			utterance.onerror = (event) => {
				reject(new Error(`Speech synthesis error: ${event.error}`));
			};
			
			// Start speaking
			window.speechSynthesis.speak(utterance);
		});
	}
	
	updateFloatingButtonVisibility(isEnabled) {
		this.isFloatingButtonEnabled = isEnabled;
		
		// Hide or show the main speak next button based on the floating button toggle
		if (this.elements.speakNextBtn) {
			this.elements.speakNextBtn.style.display = isEnabled ? 'none' : 'inline-block';
		}
		
		if (this.floatingPlayButtonElement) {
			this.floatingPlayButtonElement.style.display = isEnabled ? 'block' : 'none';
		}
	}
	
	handleTextChange(isNewTextSource = false) {
		this.currentTextPosition = 0;
		
		if (isNewTextSource) {
			// Message is usually set by UIManager for load/AI use
		} else {
			this.displayFullTextWithOpacity();
		}
		
		this.stopCurrentPlayback();
		this.audioCache = {}; // Clear cache on any text change
	}
	
	displayFullTextWithOpacity() {
		const fullText = this.elements.mainTextarea.value;
		
		if (fullText.trim() === '') {
			this.elements.displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
			return;
		}
		
		// If at position 0, display all text with unread styling
		if (this.currentTextPosition === 0) {
			this.elements.displayText.innerHTML = `<span class="unread-text">${fullText.replace(/\n/g, '<br>')}</span>`;
			return;
		}
		
		// Split text into read and unread parts
		const readPart = fullText.substring(0, this.currentTextPosition);
		const unreadPart = fullText.substring(this.currentTextPosition);
		
		if (unreadPart.trim() === '') {
			// All text has been read
			this.elements.displayText.innerHTML = readPart.replace(/\n/g, '<br>');
			return;
		}
		
		// Construct HTML with read and unread parts
		const html = `
        <span class="read-part">${readPart.replace(/\n/g, '<br>')}</span>
        <span class="unread-text">${unreadPart.replace(/\n/g, '<br>')}</span>
    `;
		
		this.elements.displayText.innerHTML = html;
		
		// Apply current opacity setting
		this.applyUnreadTextOpacity();
	}
	
	applyUnreadTextOpacity() {
		const unreadElements = document.querySelectorAll('.unread-text');
		unreadElements.forEach(el => {
			el.style.opacity = this.unreadTextOpacity;
		});
	}
	
	
	handleChunkSettingsChange() {
		this.currentTextPosition = 0;
		this.stopCurrentPlayback();
		this.audioCache = {};
		this.showStatus('Chunk settings changed. Playback reset.', 'info', 1500);
		this.elements.displayText.innerHTML = "Chunk settings changed. Click 'Speak Next Chunk' or 'Play All'.";
	}
	
	handleTtsSettingsChange() {
		this.currentTextPosition = 0;
		this.stopCurrentPlayback();
		this.audioCache = {}; // Clear cache as voice/engine affects audio
	}
	
	_simpleHash(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0;
		}
		return 'h' + Math.abs(hash).toString(36) + str.length;
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
	
	getNextChunk() {
		const fullText = this.elements.mainTextarea.value;
		if (this.currentTextPosition >= fullText.length && fullText.length > 0) {
			this.showStatus('End of text reached.', 'info');
			this.currentTextPosition = 0; // Reset for next play from start
			return null;
		}
		if (fullText.length === 0) {
			this.showStatus('Textarea is empty.', 'warning');
			return null;
		}
		
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		const remainingText = fullText.substring(this.currentTextPosition);
		
		if (remainingText.trim() === "") { // Only whitespace remaining
			this.currentTextPosition = fullText.length; // Advance to end
			this.showStatus('End of text reached (trailing whitespace).', 'info');
			return null;
		}
		
		const chunkResult = this._extractChunkInternal(remainingText, countPerChunk, unit);
		
		if (chunkResult.text.trim() === "") {
			if (chunkResult.length > 0 && this.currentTextPosition + chunkResult.length < fullText.length) {
				this.currentTextPosition += chunkResult.length; // Skip whitespace
				return this.getNextChunk(); // Try to get the next actual content
			}
			this.currentTextPosition = fullText.length;
			return null;
		}
		return {text: chunkResult.text, newPosition: this.currentTextPosition + chunkResult.length};
	}
	
	playAudio(url, onEndedCallback, onPlayStartCallback) {
		this.elements.audioPlayer.src = url;
		this.elements.audioPlayer.play()
			.then(() => {
				this.isPlaying = true;
				this.elements.speakNextBtn.disabled = true;
				if (this.isFloatingButtonEnabled) {
					this.floatingPlayButtonElement.style.display = 'none';
				}
				this.elements.playAllBtn.disabled = true;
				this.elements.stopPlaybackBtn.disabled = false;
				if (onPlayStartCallback) onPlayStartCallback();
			})
			.catch(error => {
				console.error("Error playing audio:", error);
				this.showStatus("Error playing audio: " + error.message, 'danger');
				this.isPlaying = false;
				this.elements.speakNextBtn.disabled = false;
				if (this.isFloatingButtonEnabled) {
					this.floatingPlayButtonElement.style.display = 'block';
				}
				this.elements.playAllBtn.disabled = false;
				this.elements.stopPlaybackBtn.disabled = true;
				if (onEndedCallback) onEndedCallback(error);
			});
		
		this.elements.audioPlayer.onended = () => {
			this.isPlaying = false;
			this.elements.speakNextBtn.disabled = false;
			if (this.isFloatingButtonEnabled) {
				this.floatingPlayButtonElement.style.display = 'block';
			}
			this.elements.playAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			
			if (onEndedCallback) onEndedCallback();
		};
		this.elements.audioPlayer.onerror = (e) => {
			console.error("Audio player error:", e);
			this.showStatus("Audio player error. Check console.", 'danger');
			this.isPlaying = false;
			this.elements.speakNextBtn.disabled = false;
			if (this.isFloatingButtonEnabled) {
				this.floatingPlayButtonElement.style.display = 'block';
			}
			this.elements.playAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			if (onEndedCallback) onEndedCallback(e);
		};
	}
	
	stopCurrentPlayback() {
		if (!this.isPlaying && !this.playAllAbortController) return;
		
		// Stop browser speech synthesis if it's being used
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
		
		if (this.elements.audioPlayer && !this.elements.audioPlayer.paused) {
			this.elements.audioPlayer.pause();
		}
		
		this.elements.audioPlayer.currentTime = 0;
		this.elements.audioPlayer.src = ""; // Release audio resource
		this.isPlaying = false;
		
		this.elements.speakNextBtn.disabled = false;
		if (this.isFloatingButtonEnabled) {
			this.floatingPlayButtonElement.style.display = 'block';
		}
		this.elements.playAllBtn.disabled = false;
		this.elements.stopPlaybackBtn.disabled = true;
		
		document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		
		if (this.playAllAbortController) {
			this.playAllAbortController.abort();
			this.playAllAbortController = null;
		}

		this.cancelSpeakNextHold();
		
		if (this.floatingPlayButtonElement) {
			this.floatingPlayButtonElement.style.display = 'none';
		}
		
	}
	
	async fetchAndCacheChunk(textChunk, signal) {
		if (!textChunk || textChunk.trim() === "") return {success: false, message: "Empty chunk"};
		
		const trimmedTextChunk = textChunk.trim();
		const ttsEngine = this.elements.ttsEngineSelect.value;
		const ttsVoice = this.elements.ttsVoiceSelect.value;
		const ttsLanguageCode = (ttsEngine === 'google' && !this.elements.ttsLanguageCodeSelect.disabled)
			? this.elements.ttsLanguageCodeSelect.value
			: 'n/a';
		const volume = this.elements.volumeInput.value;
		
		const chunkHash = this._simpleHash(trimmedTextChunk + ttsEngine + ttsVoice + ttsLanguageCode + volume);
		
		if (this.audioCache[chunkHash]) {
			return {success: true, cached: true, url: this.audioCache[chunkHash]};
		}
		
		this.showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null);
		
		try {
			const formData = new FormData();
			formData.append('action', 'text_to_speech_chunk');
			formData.append('text_chunk', trimmedTextChunk);
			formData.append('tts_engine', ttsEngine);
			formData.append('voice', ttsVoice);
			formData.append('language_code', ttsLanguageCode);
			formData.append('volume', volume);
			
			// If signal is provided (for abortion), use it in the fetch options
			const fetchOptions = {method: 'POST', body: formData};
			if (signal) fetchOptions.signal = signal;
			
			const response = await fetch(window.location.href, fetchOptions);
			
			if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
			
			const result = await response.json();
			
			// Check if we need verification (session expired)
			if (result.require_verification) {
				window.location.reload(); // Reload the page to trigger verification flow
				throw new Error('Session expired. Please reload the page to continue.');
			}
			
			if (result.success && result.fileUrl) {
				this.audioCache[chunkHash] = result.fileUrl;
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
	
	async getAndPlayAudio(textChunk, onEndedCallback, onPlayStartCallback, signal) {
		if (!textChunk || textChunk.trim() === "") {
			if (onEndedCallback) onEndedCallback();
			return;
		}
		
		const trimmedTextChunk = textChunk.trim();
		this.elements.speakNextBtn.disabled = true;
		if (this.isFloatingButtonEnabled) {
			this.floatingPlayButtonElement.style.display = 'none';
		}
		this.elements.playAllBtn.disabled = true;
		
		try {
			// Check if using browser TTS
			const ttsEngine = this.elements.ttsEngineSelect.value;
			
			if (ttsEngine === 'browser') {
				// Get browser TTS settings
				const voiceName = this.elements.browserVoiceSelect ? this.elements.browserVoiceSelect.value : '';
				const languageCode = this.elements.ttsLanguageCodeSelect.value;
				const volume = parseFloat(this.elements.volumeInput.value);
				
				// Call onPlayStartCallback before starting speech
				if (onPlayStartCallback) onPlayStartCallback();
				
				this.showStatus(`Playing with browser speech: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
				this.isPlaying = true;
				this.elements.stopPlaybackBtn.disabled = false;
				
				// Check for abort signal
				if (signal && signal.aborted) {
					throw new DOMException('Aborted', 'AbortError');
				}
				
				// Use browser TTS
				await this.browserTextToSpeech(trimmedTextChunk, voiceName, languageCode, volume);
				
				// Handle completion
				this.isPlaying = false;
				this.elements.speakNextBtn.disabled = false;
				if (this.isFloatingButtonEnabled) {
					this.floatingPlayButtonElement.style.display = 'block';
				}
				this.elements.playAllBtn.disabled = false;
				this.elements.stopPlaybackBtn.disabled = true;
				
				if (onEndedCallback) onEndedCallback();
			} else {
				// Original server-side TTS code
				const {success, cached, url} = await this.fetchAndCacheChunk(trimmedTextChunk, signal);
				if (success) {
					if (cached) {
						this.showStatus(`Playing cached audio for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
					} else {
						this.showStatus('TTS generated. Playing...', 'success', 1500);
					}
					this.playAudio(url, onEndedCallback, onPlayStartCallback);
				} else {
					if (onEndedCallback) onEndedCallback(new Error('Failed to fetch or cache audio'));
					this.elements.speakNextBtn.disabled = false;
					if (this.isFloatingButtonEnabled) {
						this.floatingPlayButtonElement.style.display = 'block';
					}
					this.elements.playAllBtn.disabled = false;
				}
			}
		} catch (error) {
			if (error.name !== 'AbortError') {
				this.showStatus('Playback Error: ' + error.message, 'danger');
			}
			if (onEndedCallback) onEndedCallback(error);
			this.elements.speakNextBtn.disabled = false;
			if (this.isFloatingButtonEnabled) {
				this.floatingPlayButtonElement.style.display = 'block';
			}
			this.elements.playAllBtn.disabled = false;
		}
	}
	
	executeSpeakNextAction() {
		if (this.isPlaying) return;
		this.stopCurrentPlayback();
		
		if (this.floatingPlayButtonElement) {
			this.floatingPlayButtonElement.style.display = 'none';
		}
		
		const chunkData = this.getNextChunk();
		if (chunkData && chunkData.text.trim() !== "") {
			this.currentTextPosition = chunkData.newPosition;
			const chunkId = 'chunk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			
			this.getAndPlayAudio(
				chunkData.text.trim(),
				() => {
					// onEndedCallback
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
					
					// Position the floating button if enabled
					console.log(this.isFloatingButtonEnabled, this.floatingPlayButtonElement, currentChunkSpan);
					// In executeSpeakNextAction or where the positioning happens:
					if (this.isFloatingButtonEnabled && this.floatingPlayButtonElement && currentChunkSpan) {
						const rect = currentChunkSpan.getBoundingClientRect();
						const cardRect = this.elements.displayTextCard.getBoundingClientRect();
						
						// Position relative to the card, not the window
						const buttonTop = rect.bottom - cardRect.top + 5;
						const buttonLeft = rect.left - cardRect.left;
						
						this.floatingPlayButtonElement.style.top = `${buttonTop}px`;
						this.floatingPlayButtonElement.style.left = `${buttonLeft}px`;
						this.floatingPlayButtonElement.style.display = 'block';
					}
				},
				() => {
					// onPlayStartCallback
					// Update display with full text and current position
					this.displayFullTextWithOpacity();
					
					// Find the element that should be highlighted
					const readPart = document.querySelector('.read-part');
					if (readPart) {
						// Create a temporary span for the current chunk
						const tempSpan = document.createElement('span');
						tempSpan.id = chunkId;
						tempSpan.classList.add('highlight');
						tempSpan.innerHTML = chunkData.text.replace(/\n/g, '<br>');
						
						// Replace the last part of read text with highlighted version
						const readPartHtml = readPart.innerHTML;
						const nonHighlightedChunk = chunkData.text.replace(/\n/g, '<br>');
						if (readPartHtml.endsWith(nonHighlightedChunk)) {
							readPart.innerHTML = readPartHtml.substring(0, readPartHtml.length - nonHighlightedChunk.length);
							readPart.appendChild(tempSpan);
						}
						
						// Scroll to the highlighted text
						tempSpan.scrollIntoView({behavior: 'smooth', block: 'center'});
						
						// Adjust scroll position for fixed playback controls
						setTimeout(() => {
							if (!tempSpan || (this.playAllAbortController && this.playAllAbortController.signal.aborted)) return;
							const rect = tempSpan.getBoundingClientRect();
							const viewportHeight = window.innerHeight;
							const playbackControlsHeight = this.elements.playbackControlsContainer.offsetHeight || 80;
							const desiredBottomMargin = playbackControlsHeight + 20;
							if (rect.bottom > viewportHeight - desiredBottomMargin) {
								const scrollAmount = rect.bottom - (viewportHeight - desiredBottomMargin);
								window.scrollBy({top: scrollAmount, behavior: 'smooth'});
							}
						}, 100);
					}
				}
			);
		} else {
			if (this.elements.mainTextarea.value.trim().length > 0) {
				// End of text reached
				this.displayFullTextWithOpacity();
				this.showStatus('End of text reached.', 'info');
			} else {
				this.elements.displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
			}
		}
	}
	
	updateHoldSpinner() {
		if (!this.isHoldingSpeakNext) return;
		const holdDuration = parseInt(this.elements.speakNextHoldDurationInput.value) || 0;
		const elapsed = Date.now() - this.holdStartTime;
		const progress = Math.min(100, (elapsed / holdDuration) * 100);
		
		const theme = document.documentElement.getAttribute('data-bs-theme');
		const unfilledColor = theme === 'dark' ? '#6c757d' : '#444';
		this.elements.holdSpinner.style.background = `conic-gradient(dodgerblue ${progress * 3.6}deg, ${unfilledColor} ${progress * 3.6}deg)`;
		this.elements.holdSpinnerProgressText.textContent = `${Math.round(progress)}%`;
		
		if (progress >= 100) {
			this.cancelSpeakNextHold(false);
			this.executeSpeakNextAction();
			this.isHoldingSpeakNext = false;
		} else {
			this.holdAnimationId = requestAnimationFrame(() => this.updateHoldSpinner());
		}
	}
	
	cancelSpeakNextHold(resetIsHolding = true) {
		if (this.holdAnimationId) cancelAnimationFrame(this.holdAnimationId);
		this.holdAnimationId = null;
		this.elements.holdSpinnerOverlay.style.display = 'none';
		const theme = document.documentElement.getAttribute('data-bs-theme');
		const unfilledColor = theme === 'dark' ? '#6c757d' : '#444';
		this.elements.holdSpinner.style.background = `conic-gradient(dodgerblue 0deg, ${unfilledColor} 0deg)`;
		this.elements.holdSpinnerProgressText.textContent = '0%';
		if (resetIsHolding) this.isHoldingSpeakNext = false;
	}
	
	_releaseSpeakNextHandler() {
		if (this.isHoldingSpeakNext) {
			this.cancelSpeakNextHold();
		}
	}
	
	async playAllChunks() {
		if (this.isPlaying) return;
		this.stopCurrentPlayback();
		this.playAllAbortController = new AbortController();
		const signal = this.playAllAbortController.signal;
		const fullText = this.elements.mainTextarea.value;
		
		if (!fullText.trim()) {
			this.showStatus('Textarea is empty.', 'warning');
			this.playAllAbortController = null;
			return;
		}
		
		this.elements.displayText.innerHTML = '';
		let tempPosition = 0;
		const chunksToPlay = [];
		let highlightedTextHtml = "";
		let displayChunkIndex = 0;
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		
		while (tempPosition < fullText.length) {
			const remainingTextForPlayAll = fullText.substring(tempPosition);
			if (remainingTextForPlayAll.trim() === "" && tempPosition < fullText.length) {
				highlightedTextHtml += remainingTextForPlayAll.replace(/\n/g, '<br>');
				break;
			}
			if (remainingTextForPlayAll === "") break;
			
			const chunkResultPlayAll = this._extractChunkInternal(remainingTextForPlayAll, countPerChunk, unit);
			if (chunkResultPlayAll.length === 0 && remainingTextForPlayAll.length > 0) {
				console.warn("PlayAll: _extractChunkInternal returned empty for non-empty input. Appending rest.");
				highlightedTextHtml += remainingTextForPlayAll.substring(0).replace(/\n/g, '<br>');
				tempPosition += remainingTextForPlayAll.length;
				break;
			}
			if (chunkResultPlayAll.length === 0) break;
			
			let originalChunkText = chunkResultPlayAll.text;
			const chunkId = `playall-chunk-${displayChunkIndex}`;
			highlightedTextHtml += `<span id="${chunkId}">${originalChunkText.replace(/\n/g, '<br>')}</span>`;
			if (originalChunkText.trim() !== "") {
				chunksToPlay.push({text: originalChunkText.trim(), originalChunk: originalChunkText, id: chunkId});
			}
			tempPosition += chunkResultPlayAll.length;
			displayChunkIndex++;
		}
		this.elements.displayText.innerHTML = highlightedTextHtml;
		
		if (chunksToPlay.length === 0) {
			this.showStatus('No speakable chunks found.', 'info');
			if (this.elements.displayText.innerHTML.trim() === "") this.elements.displayText.innerHTML = "No speakable content found in the textarea.";
			this.elements.speakNextBtn.disabled = false;
			if (this.isFloatingButtonEnabled) {
				this.floatingPlayButtonElement.style.display = 'block';
			}
			this.elements.playAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			this.playAllAbortController = null;
			return;
		}
		
		this.isPlaying = true;
		this.elements.speakNextBtn.disabled = true;
		if (this.isFloatingButtonEnabled) {
			this.floatingPlayButtonElement.style.display = 'none';
		}
		this.elements.playAllBtn.disabled = true;
		this.elements.stopPlaybackBtn.disabled = false;
		
		let currentOverallTextPosition = 0;
		
		this.displayFullTextWithOpacity();
		
		for (let i = 0; i < chunksToPlay.length; i++) {
			if (signal.aborted) {
				this.showStatus('Playback stopped.', 'info');
				break;
			}
			const currentChunkData = chunksToPlay[i];
			
			let chunkStartIndexInFullText = fullText.indexOf(currentChunkData.originalChunk, currentOverallTextPosition);
			if (chunkStartIndexInFullText === -1 && i === 0) chunkStartIndexInFullText = 0;
			if (chunkStartIndexInFullText !== -1) {
				currentOverallTextPosition = chunkStartIndexInFullText + currentChunkData.originalChunk.length;
			} else {
				currentOverallTextPosition += currentChunkData.originalChunk.length;
			}
			this.currentTextPosition = currentOverallTextPosition;
			
			try {
				await new Promise((resolve, reject) => {
					if (signal.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
						return;
					}
					this.getAndPlayAudio(
						currentChunkData.text,
						(err) => { // onEndedCallback
							const playedChunkSpan = document.getElementById(currentChunkData.id);
							if (playedChunkSpan) playedChunkSpan.classList.remove('highlight');
							if (err) reject(err);
							else resolve();
						},
						() => { // onPlayStartCallback
							document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
							
							this.displayFullTextWithOpacity();
							
							const readPart = document.querySelector('.read-part');
							if (readPart) {
								const tempSpan = document.createElement('span');
								tempSpan.id = currentChunkData.id;
								tempSpan.classList.add('highlight');
								tempSpan.innerHTML = currentChunkData.originalChunk.replace(/\n/g, '<br>');
								
								// Add the highlighted span
								readPart.appendChild(tempSpan);
								
								// Scroll handling...
								const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
								if (currentChunkSpanInDOM) {
									currentChunkSpanInDOM.classList.add('highlight');
									currentChunkSpanInDOM.scrollIntoView({behavior: 'smooth', block: 'center'});
									setTimeout(() => {
										if (!currentChunkSpanInDOM || signal.aborted) return;
										const rect = currentChunkSpanInDOM.getBoundingClientRect();
										const viewportHeight = window.innerHeight;
										const playbackControlsHeight = this.elements.playbackControlsContainer.offsetHeight || 80;
										const desiredBottomMargin = playbackControlsHeight + 20;
										if (rect.bottom > viewportHeight - desiredBottomMargin) {
											const scrollAmount = rect.bottom - (viewportHeight - desiredBottomMargin);
											window.scrollBy({top: scrollAmount, behavior: 'smooth'});
										}
									}, 100);
								}
							}
						},
						signal
					);
					signal.addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'));
					}, {once: true});
				});
			} catch (error) {
				if (error.name === 'AbortError') {
					this.showStatus('Playback stopped by user.', 'info');
				} else {
					this.showStatus(`Error playing chunk ${i + 1}: ${error.message}`, 'danger');
					console.error(`Error playing chunk ${i + 1}:`, error);
				}
				break;
			}
		}
		
		this.isPlaying = false;
		this.elements.speakNextBtn.disabled = false;
		if (this.isFloatingButtonEnabled) {
			this.floatingPlayButtonElement.style.display = 'block';
		}
		this.elements.playAllBtn.disabled = false;
		this.elements.stopPlaybackBtn.disabled = true;
		
		if (!signal.aborted && chunksToPlay.length > 0) {
			this.showStatus('Finished playing all chunks.', 'success');
			this.currentTextPosition = fullText.length;
		} else if (chunksToPlay.length === 0 && !signal.aborted) {
			// Message already shown
		}
		if (signal.aborted) {
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		}
		this.playAllAbortController = null;
	}
	
	_bindPlaybackButtonListeners() {
		this.elements.speakNextBtn.addEventListener('mousedown', (e) => {
			if (e.button !== 0 || this.isPlaying || this.isHoldingSpeakNext) return;
			this.isHoldingSpeakNext = true;
			this.holdStartTime = Date.now();
			const holdDuration = parseInt(this.elements.speakNextHoldDurationInput.value) || 0;
			if (holdDuration === 0) {
				this.isHoldingSpeakNext = false;
				this.executeSpeakNextAction();
				return;
			}
			this.elements.holdSpinnerOverlay.style.display = 'flex';
			this.updateHoldSpinner();
		});
		
		this.elements.speakNextBtn.addEventListener('touchstart', (e) => {
			if (this.isPlaying || this.isHoldingSpeakNext) return;
			e.preventDefault();
			this.isHoldingSpeakNext = true;
			this.holdStartTime = Date.now();
			const holdDuration = parseInt(this.elements.speakNextHoldDurationInput.value) || 0;
			if (holdDuration === 0) {
				this.isHoldingSpeakNext = false;
				this.executeSpeakNextAction();
				return;
			}
			this.elements.holdSpinnerOverlay.style.display = 'flex';
			this.updateHoldSpinner();
		}, {passive: false});
		
		document.addEventListener('mouseup', () => this._releaseSpeakNextHandler());
		document.addEventListener('touchend', () => this._releaseSpeakNextHandler());
		document.addEventListener('touchcancel', () => this._releaseSpeakNextHandler());
		
		this.elements.playAllBtn.addEventListener('click', () => this.playAllChunks());
		this.elements.stopPlaybackBtn.addEventListener('click', () => this.stopCurrentPlayback());
	}
}
