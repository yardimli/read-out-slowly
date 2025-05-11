document.addEventListener('DOMContentLoaded', () => {
	const mainTextarea = document.getElementById('mainTextarea');
	const toggleTextareaBtn = document.getElementById('toggleTextareaBtn');
	const aiPromptInput = document.getElementById('aiPromptInput');
	const generateAiTextBtn = document.getElementById('generateAiTextBtn');
	const aiPreviewArea = document.getElementById('aiPreviewArea');
	const useAiTextBtn = document.getElementById('useAiTextBtn');
	const saveToStorageBtn = document.getElementById('saveToStorageBtn');
	const savedTextsList = document.getElementById('savedTextsList');
	const wordsPerChunkInput = document.getElementById('wordsPerChunkInput');
	const voiceSelect = document.getElementById('voiceSelect');
	const volumeInput = document.getElementById('volumeInput');
	const displayText = document.getElementById('displayText');
	const speakNextBtn = document.getElementById('speakNextBtn');
	const playAllBtn = document.getElementById('playAllBtn');
	const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');
	const audioPlayer = document.getElementById('audioPlayer');
	const statusMessage = document.getElementById('statusMessage');
	const settingsCard = document.getElementById('settingsCard');
	
	// New UI elements for settings
	const statusVerbositySelect = document.getElementById('statusVerbositySelect');
	const speakNextHoldDurationInput = document.getElementById('speakNextHoldDuration');
	const togglePlayAllBtnSwitch = document.getElementById('togglePlayAllBtnSwitch');
	const holdSpinnerOverlay = document.getElementById('holdSpinnerOverlay');
	const holdSpinner = document.getElementById('holdSpinner');
	const holdSpinnerProgressText = document.getElementById('holdSpinnerProgressText');
	
	let currentTextPosition = 0;
	let audioCache = {}; // Store { textHash: audioUrl }
	let isPlaying = false;
	let playAllAbortController = null;
	let newTextLoadedForSinglePlay = true;
	
	// Settings variables
	let statusVerbosity = 'error'; // 'all', 'errors', 'none'
	
	// Hold-to-activate variables for Speak Next button
	let holdTimeoutId = null;
	let holdStartTime = 0;
	let holdAnimationId = null;
	let isHoldingSpeakNext = false;
	
	
	const showStatus = (message, type = 'info', duration = 3000) => {
		if (statusVerbosity === 'none') return;
		if (statusVerbosity === 'errors' && type !== 'danger') return;
		
		statusMessage.textContent = message;
		statusMessage.className = `alert alert-${type} mt-2`;
		statusMessage.style.display = 'block';
		if (duration) {
			setTimeout(() => {
				statusMessage.style.display = 'none';
			}, duration);
		}
	};
	
	// Event Listeners for new settings
	statusVerbositySelect.addEventListener('change', (e) => {
		statusVerbosity = e.target.value;
		showStatus(`Status messages set to: ${statusVerbosity}`, 'info', 1500);
	});
	
	togglePlayAllBtnSwitch.addEventListener('change', (e) => {
		playAllBtn.style.display = e.target.checked ? 'inline-block' : 'none';
	});
	// Initialize Play All button visibility based on switch
	playAllBtn.style.display = togglePlayAllBtnSwitch.checked ? 'inline-block' : 'none';
	
	
	toggleTextareaBtn.addEventListener('click', () => {
		if (mainTextarea.style.display === 'none') {
			mainTextarea.style.display = 'block';
			toggleTextareaBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Textarea';
			settingsCard.style.display = 'block';
			
		} else {
			mainTextarea.style.display = 'none';
			toggleTextareaBtn.innerHTML = '<i class="fas fa-eye"></i> Show Textarea';
			settingsCard.style.display = 'none';
		}
	});
	
	generateAiTextBtn.addEventListener('click', async () => {
		const prompt = aiPromptInput.value.trim();
		if (!prompt) {
			showStatus('Please enter a prompt for the AI.', 'warning');
			return;
		}
		generateAiTextBtn.disabled = true;
		generateAiTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
		aiPreviewArea.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
		useAiTextBtn.disabled = true;
		try {
			const formData = new FormData();
			formData.append('action', 'generate_text_ai');
			formData.append('prompt', prompt);
			const response = await fetch(window.location.href, {method: 'POST', body: formData});
			const result = await response.json();
			if (result.success && result.text) {
				aiPreviewArea.innerHTML = result.text.replace(/\n/g, '<br>');
				useAiTextBtn.disabled = false;
			} else {
				aiPreviewArea.textContent = 'Error: ' + (result.message || 'Could not generate text.');
				showStatus('AI generation failed: ' + (result.message || 'Unknown error'), 'danger');
			}
		} catch (error) {
			aiPreviewArea.textContent = 'Error: ' + error.message;
			showStatus('AI generation error: ' + error.message, 'danger');
		} finally {
			generateAiTextBtn.disabled = false;
			generateAiTextBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate';
		}
	});
	
	useAiTextBtn.addEventListener('click', () => {
		const textToUse = aiPreviewArea.innerHTML.replace(/<br\s*\/?>/gi, '\n');
		mainTextarea.value = textToUse;
		currentTextPosition = 0;
		newTextLoadedForSinglePlay = true;
		bootstrap.Modal.getInstance(document.getElementById('aiGenerateModal')).hide();
		showStatus('Text loaded into textarea.', 'success');
	});
	
	const getSavedTexts = () => JSON.parse(localStorage.getItem('readOutSlowlyTexts')) || [];
	const saveTexts = (texts) => localStorage.setItem('readOutSlowlyTexts', JSON.stringify(texts));
	
	saveToStorageBtn.addEventListener('click', () => {
		const text = mainTextarea.value.trim();
		if (!text) {
			showStatus('Textarea is empty. Nothing to save.', 'warning');
			return;
		}
		const texts = getSavedTexts();
		const defaultName = text.substring(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? "..." : "");
		const name = prompt("Enter a name for this text:", defaultName);
		if (name === null) return;
		texts.push({id: Date.now().toString(), name: name || defaultName, text: text});
		saveTexts(texts);
		showStatus('Text saved to LocalStorage!', 'success');
	});
	
	const populateLoadModal = () => {
		const texts = getSavedTexts();
		savedTextsList.innerHTML = '';
		if (texts.length === 0) {
			savedTextsList.innerHTML = '<li class="list-group-item">No texts saved yet.</li>';
			return;
		}
		texts.sort((a, b) => b.id - a.id); // Sort by newest first
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
				mainTextarea.value = item.text;
				currentTextPosition = 0;
				newTextLoadedForSinglePlay = true;
				bootstrap.Modal.getInstance(document.getElementById('localStorageLoadModal')).hide();
				showStatus(`Text "${item.name}" loaded.`, 'success');
			};
			
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
			deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
			deleteBtn.onclick = () => {
				if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
					const updatedTexts = texts.filter(t => t.id !== item.id);
					saveTexts(updatedTexts);
					populateLoadModal(); // Refresh the list
					showStatus(`Text "${item.name}" deleted.`, 'info');
				}
			};
			btnGroup.appendChild(loadBtn);
			btnGroup.appendChild(deleteBtn);
			li.appendChild(textPreview);
			li.appendChild(btnGroup);
			savedTextsList.appendChild(li);
		});
	};
	
	document.getElementById('localStorageLoadModal').addEventListener('show.bs.modal', populateLoadModal);
	
	// --- Core Chunking Logic ---
	const _extractChunkInternal = (textToProcess, wordsPerChunkTarget) => {
		let chunkEndIndex = -1;
		let wordsInChunk = 0;
		let inWord = false;
		let lastWordEndIndex = -1;
		
		if (textToProcess.length === 0) {
			return {text: "", length: 0};
		}
		
		for (let i = 0; i < textToProcess.length; i++) {
			const char = textToProcess[i];
			if (char.match(/\S/)) { // Non-whitespace character
				if (!inWord) {
					inWord = true;
				}
				lastWordEndIndex = i;
			} else { // Whitespace character
				if (inWord) {
					wordsInChunk++;
					inWord = false;
				}
			}
			
			if (char === '.' || char === ',' || char === '\n') {
				if (inWord) {
					wordsInChunk++;
					inWord = false;
				}
				chunkEndIndex = i;
				break;
			}
			
			if (wordsInChunk >= wordsPerChunkTarget && lastWordEndIndex !== -1) {
				// Ensure we end at the end of a word if target is met
				chunkEndIndex = lastWordEndIndex;
				break;
			}
			chunkEndIndex = i; // Default to current char if no other break
		}
		
		if (inWord) { // If loop ends while in a word (e.g. end of textToProcess)
			wordsInChunk++;
		}
		
		// If chunkEndIndex is still -1 (e.g. very short text, no breaks found), take whole string
		if (chunkEndIndex === -1) chunkEndIndex = textToProcess.length -1;
		
		const chunkText = textToProcess.substring(0, chunkEndIndex + 1);
		return {text: chunkText, length: chunkText.length};
	};
	
	const getNextChunk = () => {
		const fullText = mainTextarea.value;
		if (currentTextPosition >= fullText.length && fullText.length > 0) {
			showStatus('End of text reached.', 'info');
			currentTextPosition = 0;
			newTextLoadedForSinglePlay = true;
			return null;
		}
		if (fullText.length === 0) {
			showStatus('Textarea is empty.', 'warning');
			return null;
		}
		
		const wordsToRead = parseInt(wordsPerChunkInput.value) || 10;
		const remainingText = fullText.substring(currentTextPosition);
		
		if (remainingText.trim() === "") {
			currentTextPosition = fullText.length;
			showStatus('End of text reached (trailing whitespace).', 'info');
			newTextLoadedForSinglePlay = true;
			return null;
		}
		
		const chunkResult = _extractChunkInternal(remainingText, wordsToRead);
		
		if (chunkResult.text.trim() === "") {
			if (chunkResult.length > 0 && currentTextPosition + chunkResult.length < fullText.length) {
				currentTextPosition += chunkResult.length;
				return getNextChunk(); // Recursively get the next actual content chunk
			}
			currentTextPosition = fullText.length;
			newTextLoadedForSinglePlay = true;
			return null; // No meaningful chunk found or end of text.
		}
		return {text: chunkResult.text, newPosition: currentTextPosition + chunkResult.length};
	};
	
	const simpleHash = (str) => {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0;
		}
		return 'h' + Math.abs(hash).toString(36) + str.length;
	};
	
	const playAudio = (url, onEndedCallback, onPlayStartCallback) => {
		audioPlayer.src = url;
		audioPlayer.play()
			.then(() => {
				isPlaying = true;
				speakNextBtn.disabled = true; // Disable during playback
				playAllBtn.disabled = true;
				stopPlaybackBtn.style.display = 'inline-block';
				if (onPlayStartCallback) onPlayStartCallback();
			})
			.catch(error => {
				console.error("Error playing audio:", error);
				showStatus("Error playing audio: " + error.message, 'danger');
				isPlaying = false;
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
				stopPlaybackBtn.style.display = 'none';
				if (onEndedCallback) onEndedCallback(error);
			});
		
		audioPlayer.onended = () => {
			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.style.display = 'none';
			if (onEndedCallback) onEndedCallback();
		};
		audioPlayer.onerror = (e) => {
			console.error("Audio player error:", e);
			showStatus("Audio player error. Check console.", 'danger');
			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.style.display = 'none';
			if (onEndedCallback) onEndedCallback(e);
		};
	};
	
	const stopCurrentPlayback = () => {
		if (!isPlaying && !playAllAbortController) return; // No active playback or abortable process
		
		audioPlayer.pause();
		audioPlayer.currentTime = 0;
		audioPlayer.src = ""; // Clear source
		isPlaying = false;
		
		// Re-enable buttons
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		stopPlaybackBtn.style.display = 'none';
		
		document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		
		if (playAllAbortController) {
			playAllAbortController.abort();
			playAllAbortController = null; // Clear the controller
		}
		// If speak next hold was active, cancel it
		cancelSpeakNextHold();
	};
	
	stopPlaybackBtn.addEventListener('click', stopCurrentPlayback);
	
	const getAndPlayAudio = async (textChunk, onEndedCallback, onPlayStartCallback) => {
		if (!textChunk || textChunk.trim() === "") {
			if (onEndedCallback) onEndedCallback();
			return;
		}
		const trimmedTextChunk = textChunk.trim();
		const chunkHash = simpleHash(trimmedTextChunk + voiceSelect.value + volumeInput.value);
		
		if (audioCache[chunkHash]) {
			showStatus(`Playing cached audio for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
			playAudio(audioCache[chunkHash], onEndedCallback, onPlayStartCallback);
			return;
		}
		
		showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null); // No auto-hide
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		
		try {
			const formData = new FormData();
			formData.append('action', 'text_to_speech_chunk');
			formData.append('text_chunk', trimmedTextChunk);
			formData.append('voice', voiceSelect.value);
			formData.append('volume', volumeInput.value);
			
			const response = await fetch(window.location.href, {method: 'POST', body: formData});
			const result = await response.json();
			
			if (result.success && result.fileUrl) {
				audioCache[chunkHash] = result.fileUrl;
				showStatus('TTS generated. Playing...', 'success', 1500);
				playAudio(result.fileUrl, onEndedCallback, onPlayStartCallback);
			} else {
				showStatus('TTS Error: ' + (result.message || 'Unknown error'), 'danger');
				if (onEndedCallback) onEndedCallback(new Error(result.message || 'TTS failed'));
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
			}
		} catch (error) {
			console.error("TTS request error:", error);
			showStatus('TTS Request Error: ' + error.message, 'danger');
			if (onEndedCallback) onEndedCallback(error);
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
		}
	};
	
	// --- Speak Next Chunk Logic (with Hold-to-Activate) ---
	const executeSpeakNextAction = () => {
		if (isPlaying) return;
		stopCurrentPlayback(); // Stop any previous playback first
		
		const chunkData = getNextChunk(); // Returns { text: "original chunk", newPosition: pos }
		if (chunkData && chunkData.text.trim() !== "") {
			currentTextPosition = chunkData.newPosition;
			const chunkId = 'chunk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			
			getAndPlayAudio(
				chunkData.text.trim(), // Text for TTS API (trimmed)
				() => { // onEnded
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
				},
				() => { // onPlayStart
					if (newTextLoadedForSinglePlay) {
						displayText.innerHTML = '';
						newTextLoadedForSinglePlay = false;
					}
					const newChunkHtml = `<span id="${chunkId}">${chunkData.text.replace(/\n/g, '<br>')}</span>`;
					displayText.insertAdjacentHTML('beforeend', newChunkHtml);
					// displayText.insertAdjacentHTML('beforeend', ' '); // Optional: space between chunks
					displayText.scrollTop = displayText.scrollHeight;
					
					document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.add('highlight');
				}
			);
		} else {
			if (mainTextarea.value.trim().length > 0 && currentTextPosition === 0 && newTextLoadedForSinglePlay) {
				displayText.innerHTML = "End of text. Click 'Speak Next Chunk' to restart or load new text.";
			} else if (mainTextarea.value.trim().length === 0) {
				displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
			} else if (!chunkData || chunkData.text.trim() === "") {
				displayText.innerHTML = "End of text. Load new text or click 'Speak Next Chunk' to restart.";
			}
		}
	};
	
	const updateHoldSpinner = () => {
		if (!isHoldingSpeakNext) return;
		
		const holdDuration = parseInt(speakNextHoldDurationInput.value) || 0;
		const elapsed = Date.now() - holdStartTime;
		const progress = Math.min(100, (elapsed / holdDuration) * 100);
		
		holdSpinner.style.background = `conic-gradient(dodgerblue ${progress * 3.6}deg, #444 ${progress * 3.6}deg)`;
		holdSpinnerProgressText.textContent = `${Math.round(progress)}%`;
		
		if (progress >= 100) {
			cancelSpeakNextHold(false); // Don't reset isHoldingSpeakNext yet
			executeSpeakNextAction();
			isHoldingSpeakNext = false; // Now reset
		} else {
			holdAnimationId = requestAnimationFrame(updateHoldSpinner);
		}
	};
	
	const cancelSpeakNextHold = (resetIsHolding = true) => {
		if (holdAnimationId) cancelAnimationFrame(holdAnimationId);
		holdAnimationId = null;
		holdSpinnerOverlay.style.display = 'none';
		holdSpinner.style.background = 'conic-gradient(dodgerblue 0deg, #444 0deg)';
		holdSpinnerProgressText.textContent = '0%';
		if(resetIsHolding) isHoldingSpeakNext = false;
	};
	
	speakNextBtn.addEventListener('mousedown', (e) => {
		if (e.button !== 0 || isPlaying || isHoldingSpeakNext) return; // Only left click, not if already playing/holding
		isHoldingSpeakNext = true;
		holdStartTime = Date.now();
		const holdDuration = parseInt(speakNextHoldDurationInput.value) || 0;
		
		if (holdDuration === 0) { // If duration is 0, execute immediately
			isHoldingSpeakNext = false;
			executeSpeakNextAction();
			return;
		}
		
		holdSpinnerOverlay.style.display = 'flex';
		updateHoldSpinner(); // Start animation loop
	});
	speakNextBtn.addEventListener('touchstart', (e) => {
		if (isPlaying || isHoldingSpeakNext) return;
		e.preventDefault(); // Prevent mouse event firing after touch
		isHoldingSpeakNext = true;
		holdStartTime = Date.now();
		const holdDuration = parseInt(speakNextHoldDurationInput.value) || 0;
		
		if (holdDuration === 0) {
			isHoldingSpeakNext = false;
			executeSpeakNextAction();
			return;
		}
		
		holdSpinnerOverlay.style.display = 'flex';
		updateHoldSpinner();
	}, { passive: false });
	
	const releaseSpeakNextHandler = () => {
		if (isHoldingSpeakNext) {
			cancelSpeakNextHold();
		}
	};
	document.addEventListener('mouseup', releaseSpeakNextHandler);
	document.addEventListener('touchend', releaseSpeakNextHandler);
	document.addEventListener('touchcancel', releaseSpeakNextHandler);
	// Also cancel if mouse leaves button while holding (optional, but good UX)
	speakNextBtn.addEventListener('mouseleave', () => {
		if (isHoldingSpeakNext) {
			// Check if mouse button is still pressed (e.g. dragging off)
			if (!(event.buttons & 1)) { // If primary button is NOT pressed
				cancelSpeakNextHold();
			}
		}
	});
	
	
	mainTextarea.addEventListener('input', () => {
		currentTextPosition = 0;
		newTextLoadedForSinglePlay = true;
		displayText.innerHTML = "Text changed. Click 'Speak Next Chunk' or 'Play All'.";
		stopCurrentPlayback(); // Stop any active playback if text changes
		audioCache = {}; // Clear cache as text changed
	});
	
	const playAllChunks = async () => {
		if (isPlaying) return;
		stopCurrentPlayback();
		playAllAbortController = new AbortController();
		const signal = playAllAbortController.signal;
		
		const fullText = mainTextarea.value;
		if (!fullText.trim()) {
			showStatus('Textarea is empty.', 'warning');
			return;
		}
		
		displayText.innerHTML = ''; // Clear display area initially
		let tempPosition = 0;
		const chunksToPlay = []; // Stores {text: "trimmed for tts", originalChunk: "original", id: "chunkId"}
		let highlightedTextHtml = "";
		let displayChunkIndex = 0; // Used for generating unique IDs for all spans
		
		while (tempPosition < fullText.length) {
			const wordsToRead = parseInt(wordsPerChunkInput.value) || 10;
			const remainingTextForPlayAll = fullText.substring(tempPosition);
			
			if (remainingTextForPlayAll.trim() === "" && tempPosition < fullText.length) {
				// If only whitespace remains, add it to display and break
				highlightedTextHtml += remainingTextForPlayAll.replace(/\n/g, '<br>');
				break;
			}
			if (remainingTextForPlayAll === "") break;
			
			
			const chunkResultPlayAll = _extractChunkInternal(remainingTextForPlayAll, wordsToRead);
			
			if (chunkResultPlayAll.length === 0 && remainingTextForPlayAll.length > 0) {
				// Safety break for rare _extractChunkInternal issues with certain inputs
				console.warn("PlayAll: _extractChunkInternal returned empty for non-empty input. Appending rest.");
				highlightedTextHtml += remainingTextForPlayAll.substring(0).replace(/\n/g, '<br>');
				tempPosition += remainingTextForPlayAll.length;
				break;
			}
			if (chunkResultPlayAll.length === 0) break; // End of text or no more processable content
			
			let originalChunkText = chunkResultPlayAll.text;
			const chunkId = `playall-chunk-${displayChunkIndex}`;
			
			// Add all chunks (including whitespace-only) to the display HTML
			highlightedTextHtml += `<span id="${chunkId}">${originalChunkText.replace(/\n/g, '<br>')}</span>`;
			
			if (originalChunkText.trim() !== "") {
				// Only add non-whitespace chunks to the list of chunks to be spoken
				chunksToPlay.push({
					text: originalChunkText.trim(), // Trimmed text for TTS
					originalChunk: originalChunkText, // Keep original for reference
					id: chunkId // This ID will be used for highlighting
				});
			}
			
			tempPosition += chunkResultPlayAll.length;
			displayChunkIndex++;
		}
		
		// Set the full text display once before starting playback
		displayText.innerHTML = highlightedTextHtml;
		if (chunksToPlay.length === 0) {
			showStatus('No speakable chunks found.', 'info');
			if(displayText.innerHTML.trim() === "") displayText.innerHTML = "No speakable content found in the textarea.";
			// Reset buttons if no chunks to play
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.style.display = 'none';
			playAllAbortController = null;
			return;
		}
		
		isPlaying = true; // Set isPlaying true for the whole "Play All" sequence
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		stopPlaybackBtn.style.display = 'inline-block';
		
		let currentOverallTextPosition = 0; // For updating main currentTextPosition after playAll
		
		for (let i = 0; i < chunksToPlay.length; i++) {
			if (signal.aborted) {
				showStatus('Playback stopped.', 'info');
				break;
			}
			const currentChunkData = chunksToPlay[i];
			
			// Update currentTextPosition based on the original chunk length before playing it
			// Find the start of this chunk in the original fullText
			let chunkStartIndexInFullText = fullText.indexOf(currentChunkData.originalChunk, currentOverallTextPosition);
			if(chunkStartIndexInFullText === -1 && i === 0) chunkStartIndexInFullText = 0; // First chunk might be slightly different due to processing
			
			if(chunkStartIndexInFullText !== -1) {
				currentOverallTextPosition = chunkStartIndexInFullText + currentChunkData.originalChunk.length;
			} else {
				// Fallback: advance by length of original chunk if not found (less accurate)
				currentOverallTextPosition += currentChunkData.originalChunk.length;
			}
			
			
			try {
				await new Promise((resolve, reject) => {
					if (signal.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
						return;
					}
					getAndPlayAudio(
						currentChunkData.text, // Trimmed text for TTS
						(err) => { // onEnded
							const playedChunkSpan = document.getElementById(currentChunkData.id);
							if (playedChunkSpan) playedChunkSpan.classList.remove('highlight');
							if (err) reject(err);
							else resolve();
						},
						() => { // onPlayStart
							// Full text is already in DOM. Just highlight.
							document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
							const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
							if (currentChunkSpanInDOM) {
								currentChunkSpanInDOM.classList.add('highlight');
								currentChunkSpanInDOM.scrollIntoView({behavior: 'smooth', block: 'nearest'});
							}
						}
					);
					signal.addEventListener('abort', () => {
						// stopCurrentPlayback(); // This is now called by the main stopPlaybackBtn handler
						reject(new DOMException('Aborted', 'AbortError'));
					});
				});
			} catch (error) {
				if (error.name === 'AbortError') {
					showStatus('Playback stopped by user.', 'info');
				} else {
					showStatus(`Error playing chunk ${i + 1}: ${error.message}`, 'danger');
					console.error(`Error playing chunk ${i + 1}:`, error);
				}
				break; // Stop playing further chunks on error or abort
			}
		}
		
		isPlaying = false; // Reset isPlaying after loop finishes or breaks
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		stopPlaybackBtn.style.display = 'none';
		
		if (!signal.aborted && chunksToPlay.length > 0) {
			showStatus('Finished playing all chunks.', 'success');
			currentTextPosition = fullText.length; // Mark as end of text
		} else if (chunksToPlay.length === 0 && !signal.aborted) {
			// Message already shown if no speakable chunks
		}
		
		if (signal.aborted) {
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
			// currentTextPosition should reflect where it stopped.
			// The currentOverallTextPosition should be close.
			currentTextPosition = Math.min(currentOverallTextPosition, fullText.length);
			
		}
		
		playAllAbortController = null;
		newTextLoadedForSinglePlay = true; // Ready for a fresh "Speak Next" or "Play All"
	};
	
	playAllBtn.addEventListener('click', playAllChunks);
});
