class PlaybackManager {
	constructor(elements, showStatusCallback) {
		this.elements = elements;
		this.showStatus = showStatusCallback;
		
		this.currentTextPosition = 0;
		this.audioCache = {};
		this.isPlaying = false;
		this.playAllAbortController = null;
		this.newTextLoadedForSinglePlay = true;
		this.pregenerateAbortController = null;
		
		this.holdTimeoutId = null;
		this.holdStartTime = 0;
		this.holdAnimationId = null;
		this.isHoldingSpeakNext = false;
	}
	
	init() {
		this.elements.stopPlaybackBtn.disabled = true;
		this._bindPlaybackButtonListeners();
	}
	
	handleTextChange(isNewTextSource = false) { // isNewTextSource (e.g. loaded from AI/storage) vs user typing
		this.currentTextPosition = 0;
		this.newTextLoadedForSinglePlay = true;
		if (isNewTextSource) {
			// Message is usually set by UIManager for load/AI use
		} else {
			this.elements.displayText.innerHTML = "Text changed. Click 'Speak Next Chunk' or 'Play All'.";
		}
		this.stopCurrentPlayback(true); // Stop everything, including pregeneration
		this.audioCache = {};
		// this.showStatus('Text changed. Playback reset.', 'info', 1500); // Maybe too noisy for every input
	}
	
	handleChunkSettingsChange() {
		this.currentTextPosition = 0;
		this.newTextLoadedForSinglePlay = true;
		// displayText update is handled in UIManager for this specific message
		this.stopCurrentPlayback(true);
		this.audioCache = {};
		this.showStatus('Chunk settings changed. Playback reset.', 'info', 1500);
	}
	
	_simpleHash(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0; // Convert to 32bit integer
		}
		return 'h' + Math.abs(hash).toString(36) + str.length;
	}
	
	_extractChunkInternal(textToProcess, targetCount, unit) {
		let chunkEndIndex = -1;
		let itemsInChunk = 0;
		
		if (textToProcess.length === 0) {
			return { text: "", length: 0 };
		}
		
		if (unit === 'words') {
			let inWord = false;
			let lastWordEndIndex = -1;
			for (let i = 0; i < textToProcess.length; i++) {
				const char = textToProcess[i];
				if (char.match(/\S/)) { // Non-whitespace character
					if (!inWord) inWord = true;
					lastWordEndIndex = i;
				} else { // Whitespace character
					if (inWord) {
						itemsInChunk++;
						inWord = false;
					}
				}
				
				// Break on major punctuation if target met or it's a strong break
				if (char === '.' || char === ',' || char === '\n') {
					if (inWord) { // Count word if punctuation ends it
						itemsInChunk++;
						inWord = false;
					}
					if (itemsInChunk >= targetCount || (itemsInChunk > 0 && (char === '\n' || char === '.'))) {
						chunkEndIndex = i;
						break;
					}
				}
				
				if (itemsInChunk >= targetCount && lastWordEndIndex !== -1) {
					chunkEndIndex = lastWordEndIndex; // End of the last full word
					break;
				}
				chunkEndIndex = i; // Fallback: extend to current char
			}
			if (inWord) itemsInChunk++; // Count last word if text ends mid-word
			
		} else if (unit === 'sentences') {
			let lastValidSentenceEnd = -1;
			for (let i = 0; i < textToProcess.length; i++) {
				const char = textToProcess[i];
				if (char === '.' || char === '!' || char === '?') {
					const prevTwo = textToProcess.substring(Math.max(0, i - 2), i).toLowerCase();
					const prevThree = textToProcess.substring(Math.max(0, i - 3), i).toLowerCase();
					// Avoid splitting common abbreviations
					if (!(char === '.' && (prevTwo === 'mr' || prevTwo === 'ms' || prevTwo === 'dr' || prevThree === 'mrs' || prevTwo === 'st' || prevTwo === 'co'))) {
						const nextChar = textToProcess[i + 1];
						// Ensure it's followed by space, newline, quote or is end of string
						if (nextChar === undefined || nextChar.match(/\s|"|'|\u201C|\u201D/)) {
							itemsInChunk++;
							lastValidSentenceEnd = i;
						}
					}
				} else if (char === '\n') {
					// Treat double newline as a hard break if sentences already counted
					if (i > 0 && textToProcess[i-1] === '\n' && itemsInChunk > 0) {
						lastValidSentenceEnd = i; // include the double newline
						break;
					}
				}
				
				if (itemsInChunk >= targetCount && lastValidSentenceEnd !== -1) {
					chunkEndIndex = lastValidSentenceEnd;
					break;
				}
				// If no sentence break found yet, extend to current char (or last valid sentence end)
				chunkEndIndex = (lastValidSentenceEnd !== -1 && itemsInChunk > 0) ? lastValidSentenceEnd : i;
			}
			// If target not met, but some sentences found, use that.
			if (chunkEndIndex === -1 && lastValidSentenceEnd !== -1 && itemsInChunk > 0) {
				chunkEndIndex = lastValidSentenceEnd;
			}
			// If no sentence enders found at all, take the whole text as one item if target is 1+
			if (itemsInChunk === 0 && targetCount > 0 && textToProcess.trim().length > 0) {
				itemsInChunk = 1; // Count it as one item
				chunkEndIndex = textToProcess.length - 1;
			}
		}
		
		if (chunkEndIndex === -1 && textToProcess.length > 0) {
			chunkEndIndex = textToProcess.length - 1;
		} else if (textToProcess.length === 0) {
			return { text: "", length: 0 };
		}
		
		const chunkText = textToProcess.substring(0, chunkEndIndex + 1);
		return { text: chunkText, length: chunkText.length };
	}
	
	getNextChunk() {
		const fullText = this.elements.mainTextarea.value;
		if (this.currentTextPosition >= fullText.length && fullText.length > 0) {
			this.showStatus('End of text reached.', 'info');
			this.currentTextPosition = 0; // Reset for next play
			this.newTextLoadedForSinglePlay = true;
			return null;
		}
		if (fullText.length === 0) {
			this.showStatus('Textarea is empty.', 'warning');
			return null;
		}
		
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		const remainingText = fullText.substring(this.currentTextPosition);
		
		if (remainingText.trim() === "") {
			this.currentTextPosition = fullText.length;
			this.showStatus('End of text reached (trailing whitespace).', 'info');
			this.newTextLoadedForSinglePlay = true;
			return null;
		}
		
		const chunkResult = this._extractChunkInternal(remainingText, countPerChunk, unit);
		
		if (chunkResult.text.trim() === "") {
			// If only whitespace was extracted, advance past it and try again, unless it's the end
			if (chunkResult.length > 0 && this.currentTextPosition + chunkResult.length < fullText.length) {
				this.currentTextPosition += chunkResult.length;
				return this.getNextChunk(); // Recursive call to find next non-empty chunk
			}
			// If it's all whitespace till the end, or empty result for other reasons
			this.currentTextPosition = fullText.length;
			this.newTextLoadedForSinglePlay = true; // Mark as end reached
			return null;
		}
		return { text: chunkResult.text, newPosition: this.currentTextPosition + chunkResult.length };
	}
	
	playAudio(url, onEndedCallback, onPlayStartCallback) {
		this.elements.audioPlayer.src = url;
		this.elements.audioPlayer.play()
			.then(() => {
				this.isPlaying = true;
				this.elements.speakNextBtn.disabled = true;
				this.elements.playAllBtn.disabled = true;
				this.elements.pregenerateAllBtn.disabled = true;
				this.elements.stopPlaybackBtn.disabled = false;
				if (onPlayStartCallback) onPlayStartCallback();
			})
			.catch(error => {
				console.error("Error playing audio:", error);
				this.showStatus("Error playing audio: " + error.message, 'danger');
				this.isPlaying = false;
				this.elements.speakNextBtn.disabled = false;
				this.elements.playAllBtn.disabled = false;
				this.elements.pregenerateAllBtn.disabled = false;
				this.elements.stopPlaybackBtn.disabled = true;
				if (onEndedCallback) onEndedCallback(error);
			});
		
		this.elements.audioPlayer.onended = () => {
			this.isPlaying = false;
			this.elements.speakNextBtn.disabled = false;
			this.elements.playAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			if (onEndedCallback) onEndedCallback();
		};
		this.elements.audioPlayer.onerror = (e) => {
			console.error("Audio player error:", e);
			this.showStatus("Audio player error. Check console.", 'danger');
			this.isPlaying = false;
			this.elements.speakNextBtn.disabled = false;
			this.elements.playAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			if (onEndedCallback) onEndedCallback(e);
		};
	}
	
	stopCurrentPlayback(fromPregenerate = false) {
		const wasPlayingOrPregenerating = this.isPlaying || this.playAllAbortController || (fromPregenerate && this.pregenerateAbortController);
		
		if (!this.isPlaying) return; // Nothing to stop
		
		this.elements.audioPlayer.pause();
		this.elements.audioPlayer.currentTime = 0;
		this.elements.audioPlayer.src = ""; // Release audio resource
		
		this.isPlaying = false;
		this.elements.speakNextBtn.disabled = false;
		this.elements.playAllBtn.disabled = false;
		this.elements.pregenerateAllBtn.disabled = false;
		this.elements.stopPlaybackBtn.disabled = true;
		
		document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		
		if (this.playAllAbortController) {
			this.playAllAbortController.abort();
			this.playAllAbortController = null;
		}
		if (fromPregenerate && this.pregenerateAbortController) {
			this.pregenerateAbortController.abort();
			this.pregenerateAbortController = null;
			this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		}
		this.cancelSpeakNextHold(); // Ensure any active hold is cancelled
		
		// if (wasPlayingOrPregenerating) this.showStatus('Playback/Pregeneration stopped.', 'info'); // Can be noisy
	}
	
	async fetchAndCacheChunk(textChunk, signal) {
		if (!textChunk || textChunk.trim() === "") return { success: false, message: "Empty chunk" };
		const trimmedTextChunk = textChunk.trim();
		const chunkHash = this._simpleHash(trimmedTextChunk + this.elements.voiceSelect.value + this.elements.volumeInput.value);
		
		if (this.audioCache[chunkHash]) {
			return { success: true, cached: true, url: this.audioCache[chunkHash] };
		}
		
		this.showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null); // Keep null for ongoing
		try {
			const formData = new FormData();
			formData.append('action', 'text_to_speech_chunk');
			formData.append('text_chunk', trimmedTextChunk);
			formData.append('voice', this.elements.voiceSelect.value);
			formData.append('volume', this.elements.volumeInput.value);
			
			const fetchOptions = { method: 'POST', body: formData };
			if (signal) fetchOptions.signal = signal;
			
			const response = await fetch(window.location.href, fetchOptions);
			if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
			
			const result = await response.json();
			if (result.success && result.fileUrl) {
				this.audioCache[chunkHash] = result.fileUrl;
				// this.showStatus(`TTS generated for: "${trimmedTextChunk.substring(0,20)}..."`, 'success', 1500); // Caller shows status
				return { success: true, cached: false, url: result.fileUrl };
			} else {
				throw new Error(result.message || 'TTS generation failed');
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				this.showStatus('TTS request aborted.', 'info');
			} else {
				console.error("TTS request error:", error);
				this.showStatus('TTS Request Error: ' + error.message, 'danger');
			}
			throw error; // Re-throw for the caller to handle
		}
	}
	
	async getAndPlayAudio(textChunk, onEndedCallback, onPlayStartCallback, signal) {
		if (!textChunk || textChunk.trim() === "") {
			if (onEndedCallback) onEndedCallback();
			return;
		}
		const trimmedTextChunk = textChunk.trim();
		this.elements.speakNextBtn.disabled = true;
		this.elements.playAllBtn.disabled = true;
		this.elements.pregenerateAllBtn.disabled = true;
		
		try {
			const { success, cached, url } = await this.fetchAndCacheChunk(trimmedTextChunk, signal);
			if (success) {
				if (cached) {
					this.showStatus(`Playing cached audio for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
				} else {
					this.showStatus('TTS generated. Playing...', 'success', 1500);
				}
				this.playAudio(url, onEndedCallback, onPlayStartCallback);
			} else {
				// Error already shown by fetchAndCacheChunk or caught below
				if (onEndedCallback) onEndedCallback(new Error('Failed to fetch or cache audio'));
				this.elements.speakNextBtn.disabled = false;
				this.elements.playAllBtn.disabled = false;
				this.elements.pregenerateAllBtn.disabled = false;
			}
		} catch (error) {
			if (error.name !== 'AbortError') {
				this.showStatus('TTS Error: ' + error.message, 'danger');
			}
			if (onEndedCallback) onEndedCallback(error);
			this.elements.speakNextBtn.disabled = false;
			this.elements.playAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.disabled = false;
		}
	}
	
	executeSpeakNextAction() {
		if (this.isPlaying) return;
		this.stopCurrentPlayback(); // Stop any previous single play, but not pregen
		
		const chunkData = this.getNextChunk();
		if (chunkData && chunkData.text.trim() !== "") {
			this.currentTextPosition = chunkData.newPosition;
			const chunkId = 'chunk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			
			this.getAndPlayAudio(
				chunkData.text.trim(),
				() => { // onEndedCallback
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
				},
				() => { // onPlayStartCallback
					if (this.newTextLoadedForSinglePlay) {
						this.elements.displayText.innerHTML = ''; // Clear if new text or reset
						this.newTextLoadedForSinglePlay = false;
					}
					const newChunkHtml = `<span id="${chunkId}">${chunkData.text.replace(/\n/g, '<br>')}</span>`;
					this.elements.displayText.insertAdjacentHTML('beforeend', newChunkHtml);
					
					// Scroll #displayText itself to its bottom (useful if it has its own scrollbar)
					//this.elements.displayText.scrollTop = this.elements.displayText.scrollHeight;
					
					window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
					
					document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.add('highlight');
				}
			);
		} else {
			// Handle cases where no chunk is returned (end of text, empty textarea)
			if (this.elements.mainTextarea.value.trim().length > 0 && this.currentTextPosition === 0 && this.newTextLoadedForSinglePlay) {
				this.elements.displayText.innerHTML = "End of text. Click 'Speak Next Chunk' to restart or load new text.";
			} else if (this.elements.mainTextarea.value.trim().length === 0) {
				this.elements.displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
			} else if (!chunkData || (chunkData && chunkData.text.trim() === "")) { // End of text or empty chunk
				this.elements.displayText.innerHTML = "End of text. Load new text or click 'Speak Next Chunk' to restart.";
			}
		}
	}
	
	updateHoldSpinner() {
		if (!this.isHoldingSpeakNext) return;
		const holdDuration = parseInt(this.elements.speakNextHoldDurationInput.value) || 0;
		const elapsed = Date.now() - this.holdStartTime;
		const progress = Math.min(100, (elapsed / holdDuration) * 100);
		
		this.elements.holdSpinner.style.background = `conic-gradient(dodgerblue ${progress * 3.6}deg, #444 ${progress * 3.6}deg)`;
		this.elements.holdSpinnerProgressText.textContent = `${Math.round(progress)}%`;
		
		if (progress >= 100) {
			this.cancelSpeakNextHold(false); // Don't reset isHoldingSpeakNext yet
			this.executeSpeakNextAction();
			this.isHoldingSpeakNext = false; // Now reset
		} else {
			this.holdAnimationId = requestAnimationFrame(() => this.updateHoldSpinner());
		}
	}
	
	cancelSpeakNextHold(resetIsHolding = true) {
		if (this.holdAnimationId) cancelAnimationFrame(this.holdAnimationId);
		this.holdAnimationId = null;
		this.elements.holdSpinnerOverlay.style.display = 'none';
		this.elements.holdSpinner.style.background = 'conic-gradient(dodgerblue 0deg, #444 0deg)';
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
		this.stopCurrentPlayback(true); // Stop everything including pregen
		this.playAllAbortController = new AbortController();
		const signal = this.playAllAbortController.signal;
		
		const fullText = this.elements.mainTextarea.value;
		if (!fullText.trim()) {
			this.showStatus('Textarea is empty.', 'warning');
			this.playAllAbortController = null;
			return;
		}
		
		this.elements.displayText.innerHTML = ''; // Clear display area
		let tempPosition = 0;
		const chunksToPlay = [];
		let highlightedTextHtml = "";
		let displayChunkIndex = 0;
		
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		
		// Pre-calculate all chunks and build the display HTML
		while (tempPosition < fullText.length) {
			const remainingTextForPlayAll = fullText.substring(tempPosition);
			if (remainingTextForPlayAll.trim() === "" && tempPosition < fullText.length) { // Only whitespace left
				highlightedTextHtml += remainingTextForPlayAll.replace(/\n/g, '<br>'); // Add remaining whitespace
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
				chunksToPlay.push({ text: originalChunkText.trim(), originalChunk: originalChunkText, id: chunkId });
			}
			tempPosition += chunkResultPlayAll.length;
			displayChunkIndex++;
		}
		this.elements.displayText.innerHTML = highlightedTextHtml;
		
		if (chunksToPlay.length === 0) {
			this.showStatus('No speakable chunks found.', 'info');
			if (this.elements.displayText.innerHTML.trim() === "") this.elements.displayText.innerHTML = "No speakable content found in the textarea.";
			this.elements.speakNextBtn.disabled = false;
			this.elements.playAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			this.playAllAbortController = null;
			return;
		}
		
		this.isPlaying = true; // Set before loop
		this.elements.speakNextBtn.disabled = true;
		this.elements.playAllBtn.disabled = true;
		this.elements.pregenerateAllBtn.disabled = true;
		this.elements.stopPlaybackBtn.disabled = false;
		
		let currentOverallTextPosition = 0; // For main currentTextPosition update
		
		for (let i = 0; i < chunksToPlay.length; i++) {
			if (signal.aborted) {
				this.showStatus('Playback stopped.', 'info');
				break;
			}
			const currentChunkData = chunksToPlay[i];
			
			// Update currentOverallTextPosition based on the original chunk's position in fullText
			// This is a bit tricky if chunks are modified (e.g. trimmed). We use originalChunk for length.
			let chunkStartIndexInFullText = fullText.indexOf(currentChunkData.originalChunk, currentOverallTextPosition);
			if (chunkStartIndexInFullText === -1 && i === 0) chunkStartIndexInFullText = 0; // First chunk might not match if text starts with whitespace
			
			if (chunkStartIndexInFullText !== -1) {
				currentOverallTextPosition = chunkStartIndexInFullText + currentChunkData.originalChunk.length;
			} else {
				// Fallback if indexOf fails (e.g. due to normalization or very similar chunks)
				// This might lead to slight inaccuracies if not careful, but originalChunk.length is key
				currentOverallTextPosition += currentChunkData.originalChunk.length;
			}
			
			
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
							if (err) reject(err); else resolve();
						},
						() => { // onPlayStartCallback
							document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
							const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
							if (currentChunkSpanInDOM) {
								currentChunkSpanInDOM.classList.add('highlight');
								currentChunkSpanInDOM.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
								
								setTimeout(() => {
									window.scrollBy({
										top: 100,
										behavior: 'smooth'
									});
								}, 100);
							}
						},
						signal // Pass signal to getAndPlayAudio
					);
					// Ensure promise rejects if signal aborts during TTS fetch/before playAudio
					signal.addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'));
					}, { once: true });
				});
			} catch (error) {
				if (error.name === 'AbortError') {
					this.showStatus('Playback stopped by user.', 'info');
				} else {
					this.showStatus(`Error playing chunk ${i + 1}: ${error.message}`, 'danger');
					console.error(`Error playing chunk ${i + 1}:`, error);
				}
				break; // Stop playing further chunks on error
			}
		}
		
		this.isPlaying = false;
		this.elements.speakNextBtn.disabled = false;
		this.elements.playAllBtn.disabled = false;
		this.elements.pregenerateAllBtn.disabled = false;
		this.elements.stopPlaybackBtn.disabled = true;
		
		if (!signal.aborted && chunksToPlay.length > 0) {
			this.showStatus('Finished playing all chunks.', 'success');
			this.currentTextPosition = fullText.length; // Mark as fully played
		} else if (chunksToPlay.length === 0 && !signal.aborted) {
			// Message already shown
		}
		
		if (signal.aborted) {
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
			// Set currentTextPosition to where it stopped
			this.currentTextPosition = Math.min(currentOverallTextPosition, fullText.length);
		}
		
		this.playAllAbortController = null;
		this.newTextLoadedForSinglePlay = true; // Ready for single play to clear display
	}
	
	async pregenerateAllAudioHandler() {
		if (this.isPlaying || this.pregenerateAbortController) {
			this.showStatus('Cannot pregenerate while another operation is active.', 'warning');
			return;
		}
		this.stopCurrentPlayback(); // Stop any existing playback/hold
		
		this.pregenerateAbortController = new AbortController();
		const signal = this.pregenerateAbortController.signal;
		const fullText = this.elements.mainTextarea.value;
		
		if (!fullText.trim()) {
			this.showStatus('Textarea is empty. Nothing to pregenerate.', 'warning');
			this.pregenerateAbortController = null;
			return;
		}
		
		this.elements.pregenerateAllBtn.disabled = true;
		this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pregenerating...';
		this.elements.speakNextBtn.disabled = true;
		this.elements.playAllBtn.disabled = true;
		this.elements.stopPlaybackBtn.disabled = false; // Allow stopping pregeneration
		
		let tempPosition = 0;
		const chunksToFetch = [];
		const countPerChunk = parseInt(this.elements.wordsPerChunkInput.value) || (this.elements.chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = this.elements.chunkUnitSelect.value;
		
		// First, gather all chunks
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
		
		if (chunksToFetch.length === 0) {
			this.showStatus('No speakable chunks found to pregenerate.', 'info');
			this.elements.pregenerateAllBtn.disabled = false;
			this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
			this.elements.speakNextBtn.disabled = false;
			this.elements.playAllBtn.disabled = false;
			this.elements.stopPlaybackBtn.disabled = true;
			this.pregenerateAbortController = null;
			return;
		}
		
		let successCount = 0;
		let failCount = 0;
		this.showStatus(`Starting pregeneration for ${chunksToFetch.length} chunks...`, 'info', null);
		
		for (let i = 0; i < chunksToFetch.length; i++) {
			if (signal.aborted) {
				this.showStatus(`Pregeneration stopped by user. ${successCount} chunks cached.`, 'info');
				break;
			}
			const chunkText = chunksToFetch[i];
			const chunkHash = this._simpleHash(chunkText + this.elements.voiceSelect.value + this.elements.volumeInput.value);
			
			if (this.audioCache[chunkHash]) {
				successCount++;
				this.showStatus(`Chunk ${i + 1}/${chunksToFetch.length} already cached. Skipped.`, 'info', 1500);
				continue;
			}
			
			this.showStatus(`Pregenerating chunk ${i + 1}/${chunksToFetch.length}: "${chunkText.substring(0,20)}..."`, 'info', null);
			try {
				await this.fetchAndCacheChunk(chunkText, signal);
				successCount++;
				// fetchAndCacheChunk shows its own status on success/failure, but we might want a summary here
				// this.showStatus(`Chunk ${i + 1}/${chunksToFetch.length} cached.`, 'success', 1500);
			} catch (error) {
				failCount++;
				if (error.name === 'AbortError') break;
				this.showStatus(`Failed to pregenerate chunk ${i + 1}: ${error.message}`, 'danger');
			}
		}
		
		if (!signal.aborted) {
			if (failCount > 0) {
				this.showStatus(`Pregeneration complete. ${successCount} chunks cached, ${failCount} failed.`, 'warning');
			} else {
				this.showStatus(`Pregeneration complete. All ${successCount} chunks cached successfully.`, 'success');
			}
		}
		
		this.elements.pregenerateAllBtn.disabled = false;
		this.elements.pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		this.elements.speakNextBtn.disabled = false;
		this.elements.playAllBtn.disabled = false;
		this.elements.stopPlaybackBtn.disabled = true;
		this.pregenerateAbortController = null;
	}
	
	
	_bindPlaybackButtonListeners() {
		// Speak Next (Hold-to-activate)
		this.elements.speakNextBtn.addEventListener('mousedown', (e) => {
			if (e.button !== 0 || this.isPlaying || this.isHoldingSpeakNext) return;
			this.isHoldingSpeakNext = true;
			this.holdStartTime = Date.now();
			const holdDuration = parseInt(this.elements.speakNextHoldDurationInput.value) || 0;
			
			if (holdDuration === 0) {
				this.isHoldingSpeakNext = false; // Not really holding
				this.executeSpeakNextAction();
				return;
			}
			this.elements.holdSpinnerOverlay.style.display = 'flex';
			this.updateHoldSpinner();
		});
		
		this.elements.speakNextBtn.addEventListener('touchstart', (e) => {
			if (this.isPlaying || this.isHoldingSpeakNext) return;
			e.preventDefault(); // Prevent mouse events and scrolling
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
		}, { passive: false });
		
		// Release handlers for Speak Next
		document.addEventListener('mouseup', () => this._releaseSpeakNextHandler());
		document.addEventListener('touchend', () => this._releaseSpeakNextHandler());
		document.addEventListener('touchcancel', () => this._releaseSpeakNextHandler());
		this.elements.speakNextBtn.addEventListener('mouseleave', (event) => {
			// Only cancel if mouse button is UP when leaving
			if (this.isHoldingSpeakNext && !(event.buttons & 1)) {
				this.cancelSpeakNextHold();
			}
		});
		
		// Other playback buttons
		this.elements.playAllBtn.addEventListener('click', () => this.playAllChunks());
		this.elements.stopPlaybackBtn.addEventListener('click', () => this.stopCurrentPlayback(true)); // true to stop pregen too
		this.elements.pregenerateAllBtn.addEventListener('click', () => this.pregenerateAllAudioHandler());
	}
}
