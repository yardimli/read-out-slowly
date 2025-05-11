document.addEventListener('DOMContentLoaded', () => {
	const mainTextarea = document.getElementById('mainTextarea');
	// const toggleTextareaBtn = document.getElementById('toggleTextareaBtn'); // Will be replaced
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
	
	// Hold-to-activate spinner
	const holdSpinnerOverlay = document.getElementById('holdSpinnerOverlay');
	const holdSpinner = document.getElementById('holdSpinner');
	const holdSpinnerProgressText = document.getElementById('holdSpinnerProgressText');
	
	// New elements for "Hide Controls"
	const toggleControlsBtn = document.getElementById('toggleControlsBtn');
	const h1Title = document.querySelector('h1');
	const mainControlsContainer = document.getElementById('mainControlsContainer'); // Parent of action buttons
	const playbackControlsContainer = document.getElementById('playbackControlsContainer'); // Parent of playback buttons
	const mainTextareaLabel = document.querySelector('label[for="mainTextarea"]');
	
	const controlElementsToToggle = [
		settingsCard,
		mainControlsContainer,
		mainTextarea,
		mainTextareaLabel
	];
	
	// New elements for chunking unit
	const chunkUnitSelect = document.getElementById('chunkUnitSelect');
	const wordsPerChunkLabel = document.querySelector('label[for="wordsPerChunkInput"]');
	
	// New element for pregeneration
	const pregenerateAllBtn = document.getElementById('pregenerateAllBtn');
	let pregenerateAbortController = null;
	
	
	let currentTextPosition = 0;
	let audioCache = {}; // Store { textHash: audioUrl }
	let isPlaying = false;
	let playAllAbortController = null;
	let newTextLoadedForSinglePlay = true;
	
	// Settings variables
	let statusVerbosity = 'errors'; // 'all', 'errors', 'none'
	
	// Hold-to-activate variables for Speak Next button
	let holdTimeoutId = null;
	let holdStartTime = 0;
	let holdAnimationId = null;
	let isHoldingSpeakNext = false;
	
	const showStatus = (message, type = 'info', duration = 3000) => {
		if (statusVerbosity === 'none') return;
		if (statusVerbosity === 'errors' && type !== 'danger' && type !== 'warning') return; // Show warnings too
		statusMessage.textContent = message;
		statusMessage.className = `alert alert-${type} mt-2`;
		statusMessage.style.display = 'block';
		if (duration) {
			setTimeout(() => {
				statusMessage.style.display = 'none';
			}, duration);
		}
	};
	
	// --- "Hide/Show Controls" Logic ---
	function updateControlsVisibility(show) {
		controlElementsToToggle.forEach(el => {
			if (el) {
				if (show) {
					el.classList.remove('d-none');
				} else {
					el.classList.add('d-none');
				}
			}
		});
		if (show) {
			toggleControlsBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Controls';
		}
		// Button itself is hidden when controls are hidden, so no "Show Controls" text needed on it.
	}
	
	toggleControlsBtn.addEventListener('click', () => {
		updateControlsVisibility(false); // Hide all controls
	});
	
	h1Title.addEventListener('dblclick', () => {
		updateControlsVisibility(true); // Show all controls
	});
	
	// Initialize stop button state
	stopPlaybackBtn.disabled = true;
	
	
	// Event Listeners for new settings
	statusVerbositySelect.addEventListener('change', (e) => {
		statusVerbosity = e.target.value;
		showStatus(`Status messages set to: ${statusVerbosity}`, 'info', 1500);
	});
	
	togglePlayAllBtnSwitch.addEventListener('change', (e) => {
		playAllBtn.style.display = e.target.checked ? 'inline-block' : 'none';
	});
	playAllBtn.style.display = togglePlayAllBtnSwitch.checked ? 'inline-block' : 'none';
	
	
	// AI Generation
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
			const response = await fetch(window.location.href, { method: 'POST', body: formData });
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
		audioCache = {}; // Clear cache for new text
		displayText.innerHTML = "New AI text loaded. Click 'Speak Next Chunk' or 'Play All'.";
		bootstrap.Modal.getInstance(document.getElementById('aiGenerateModal')).hide();
		showStatus('Text loaded into textarea.', 'success');
	});
	
	// Local Storage
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
		texts.push({ id: Date.now().toString(), name: name || defaultName, text: text });
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
		texts.sort((a, b) => b.id - a.id);
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
				audioCache = {}; // Clear cache for new text
				displayText.innerHTML = `Text "${item.name}" loaded. Click 'Speak Next Chunk' or 'Play All'.`;
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
					populateLoadModal();
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
	const _extractChunkInternal = (textToProcess, targetCount, unit) => {
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
				
				if (char === '.' || char === ',' || char === '\n') {
					if (inWord) {
						itemsInChunk++;
						inWord = false;
					}
					// Break on major punctuation if target met or it's a strong break
					if (itemsInChunk >= targetCount || (itemsInChunk > 0 && (char === '\n' || char === '.'))) {
						chunkEndIndex = i;
						break;
					}
				}
				
				if (itemsInChunk >= targetCount && lastWordEndIndex !== -1) {
					chunkEndIndex = lastWordEndIndex;
					break;
				}
				chunkEndIndex = i;
			}
			if (inWord) itemsInChunk++;
			
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
		
		const countPerChunk = parseInt(wordsPerChunkInput.value) || (chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = chunkUnitSelect.value;
		const remainingText = fullText.substring(currentTextPosition);
		
		if (remainingText.trim() === "") {
			currentTextPosition = fullText.length;
			showStatus('End of text reached (trailing whitespace).', 'info');
			newTextLoadedForSinglePlay = true;
			return null;
		}
		
		const chunkResult = _extractChunkInternal(remainingText, countPerChunk, unit);
		if (chunkResult.text.trim() === "") {
			if (chunkResult.length > 0 && currentTextPosition + chunkResult.length < fullText.length) {
				currentTextPosition += chunkResult.length;
				return getNextChunk();
			}
			currentTextPosition = fullText.length;
			newTextLoadedForSinglePlay = true;
			return null;
		}
		return { text: chunkResult.text, newPosition: currentTextPosition + chunkResult.length };
	};
	
	// Chunk Unit Select Listener
	chunkUnitSelect.addEventListener('change', (e) => {
		const unit = e.target.value;
		if (unit === 'sentences') {
			wordsPerChunkLabel.textContent = 'Sentences per chunk (approx):';
			if (parseInt(wordsPerChunkInput.value) > 5) wordsPerChunkInput.value = '1'; // Default for sentences
		} else {
			wordsPerChunkLabel.textContent = 'Words per chunk (approx):';
			if (parseInt(wordsPerChunkInput.value) < 3) wordsPerChunkInput.value = '10'; // Default for words
		}
		currentTextPosition = 0;
		newTextLoadedForSinglePlay = true;
		displayText.innerHTML = "Chunking unit changed. Click 'Speak Next Chunk' or 'Play All'.";
		stopCurrentPlayback();
		audioCache = {}; // Clear cache as chunking parameters changed
	});
	
	
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
				speakNextBtn.disabled = true;
				playAllBtn.disabled = true;
				pregenerateAllBtn.disabled = true;
				stopPlaybackBtn.disabled = false;
				if (onPlayStartCallback) onPlayStartCallback();
			})
			.catch(error => {
				console.error("Error playing audio:", error);
				showStatus("Error playing audio: " + error.message, 'danger');
				isPlaying = false;
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
				pregenerateAllBtn.disabled = false;
				stopPlaybackBtn.disabled = true;
				if (onEndedCallback) onEndedCallback(error);
			});
		audioPlayer.onended = () => {
			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			pregenerateAllBtn.disabled = false;
			stopPlaybackBtn.disabled = true;
			if (onEndedCallback) onEndedCallback();
		};
		audioPlayer.onerror = (e) => {
			console.error("Audio player error:", e);
			showStatus("Audio player error. Check console.", 'danger');
			isPlaying = false;
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			pregenerateAllBtn.disabled = false;
			stopPlaybackBtn.disabled = true;
			if (onEndedCallback) onEndedCallback(e);
		};
	};
	
	const stopCurrentPlayback = (fromPregenerate = false) => {
		const wasPlayingOrPregenerating = isPlaying || playAllAbortController || (fromPregenerate && pregenerateAbortController);
		
		audioPlayer.pause();
		audioPlayer.currentTime = 0;
		audioPlayer.src = "";
		isPlaying = false;
		
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		pregenerateAllBtn.disabled = false;
		stopPlaybackBtn.disabled = true;
		document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		
		if (playAllAbortController) {
			playAllAbortController.abort();
			playAllAbortController = null;
		}
		if (fromPregenerate && pregenerateAbortController) {
			pregenerateAbortController.abort();
			pregenerateAbortController = null;
			pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		}
		cancelSpeakNextHold();
		// if (wasPlayingOrPregenerating) showStatus('Playback/Pregeneration stopped.', 'info');
	};
	stopPlaybackBtn.addEventListener('click', () => stopCurrentPlayback(true)); // Pass true to indicate it might be stopping pregeneration too
	
	
	const fetchAndCacheChunk = async (textChunk, signal) => {
		if (!textChunk || textChunk.trim() === "") return { success: false, message: "Empty chunk" };
		const trimmedTextChunk = textChunk.trim();
		const chunkHash = simpleHash(trimmedTextChunk + voiceSelect.value + volumeInput.value);
		
		if (audioCache[chunkHash]) {
			return { success: true, cached: true, url: audioCache[chunkHash] };
		}
		
		showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null);
		
		try {
			const formData = new FormData();
			formData.append('action', 'text_to_speech_chunk');
			formData.append('text_chunk', trimmedTextChunk);
			formData.append('voice', voiceSelect.value);
			formData.append('volume', volumeInput.value);
			
			const fetchOptions = { method: 'POST', body: formData };
			if (signal) fetchOptions.signal = signal;
			
			const response = await fetch(window.location.href, fetchOptions);
			if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
			
			const result = await response.json();
			
			if (result.success && result.fileUrl) {
				audioCache[chunkHash] = result.fileUrl;
				// showStatus(`TTS generated for: "${trimmedTextChunk.substring(0,20)}..."`, 'success', 1500); // Status shown by caller
				return { success: true, cached: false, url: result.fileUrl };
			} else {
				throw new Error(result.message || 'TTS generation failed');
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				showStatus('TTS request aborted.', 'info');
			} else {
				console.error("TTS request error:", error);
				showStatus('TTS Request Error: ' + error.message, 'danger');
			}
			throw error; // Re-throw for the caller to handle
		}
	};
	
	
	const getAndPlayAudio = async (textChunk, onEndedCallback, onPlayStartCallback, signal) => {
		if (!textChunk || textChunk.trim() === "") {
			if (onEndedCallback) onEndedCallback();
			return;
		}
		const trimmedTextChunk = textChunk.trim();
		
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		pregenerateAllBtn.disabled = true;
		
		try {
			const { success, cached, url } = await fetchAndCacheChunk(trimmedTextChunk, signal);
			if (success) {
				if (cached) {
					showStatus(`Playing cached audio for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', 1500);
				} else {
					showStatus('TTS generated. Playing...', 'success', 1500);
				}
				playAudio(url, onEndedCallback, onPlayStartCallback);
			} else {
				// Error already shown by fetchAndCacheChunk or caught below
				if (onEndedCallback) onEndedCallback(new Error('Failed to fetch or cache audio'));
				speakNextBtn.disabled = false;
				playAllBtn.disabled = false;
				pregenerateAllBtn.disabled = false;
			}
		} catch (error) {
			// Error handling for fetchAndCacheChunk failure
			if (error.name !== 'AbortError') { // AbortError already handled by showStatus in fetchAndCacheChunk
				showStatus('TTS Error: ' + error.message, 'danger');
			}
			if (onEndedCallback) onEndedCallback(error);
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			pregenerateAllBtn.disabled = false;
		}
	};
	
	
	// --- Speak Next Chunk Logic (with Hold-to-Activate) ---
	const executeSpeakNextAction = () => {
		if (isPlaying) return;
		stopCurrentPlayback();
		const chunkData = getNextChunk();
		if (chunkData && chunkData.text.trim() !== "") {
			currentTextPosition = chunkData.newPosition;
			const chunkId = 'chunk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			getAndPlayAudio(
				chunkData.text.trim(),
				() => {
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
				},
				() => {
					if (newTextLoadedForSinglePlay) {
						displayText.innerHTML = '';
						newTextLoadedForSinglePlay = false;
					}
					const newChunkHtml = `<span id="${chunkId}">${chunkData.text.replace(/\n/g, '<br>')}</span>`;
					displayText.insertAdjacentHTML('beforeend', newChunkHtml);
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
			cancelSpeakNextHold(false);
			executeSpeakNextAction();
			isHoldingSpeakNext = false;
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
		if (resetIsHolding) isHoldingSpeakNext = false;
	};
	
	speakNextBtn.addEventListener('mousedown', (e) => {
		if (e.button !== 0 || isPlaying || isHoldingSpeakNext) return;
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
	});
	speakNextBtn.addEventListener('touchstart', (e) => {
		if (isPlaying || isHoldingSpeakNext) return;
		e.preventDefault();
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
	speakNextBtn.addEventListener('mouseleave', (event) => { // Added event param
		if (isHoldingSpeakNext) {
			if (!(event.buttons & 1)) {
				cancelSpeakNextHold();
			}
		}
	});
	
	mainTextarea.addEventListener('input', () => {
		currentTextPosition = 0;
		newTextLoadedForSinglePlay = true;
		displayText.innerHTML = "Text changed. Click 'Speak Next Chunk' or 'Play All'.";
		stopCurrentPlayback();
		audioCache = {};
	});
	
	// --- Play All Chunks ---
	const playAllChunks = async () => {
		if (isPlaying) return;
		stopCurrentPlayback();
		playAllAbortController = new AbortController();
		const signal = playAllAbortController.signal;
		const fullText = mainTextarea.value;
		
		if (!fullText.trim()) {
			showStatus('Textarea is empty.', 'warning');
			playAllAbortController = null; // Clear controller
			return;
		}
		displayText.innerHTML = '';
		let tempPosition = 0;
		const chunksToPlay = [];
		let highlightedTextHtml = "";
		let displayChunkIndex = 0;
		
		const countPerChunk = parseInt(wordsPerChunkInput.value) || (chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = chunkUnitSelect.value;
		
		while (tempPosition < fullText.length) {
			const remainingTextForPlayAll = fullText.substring(tempPosition);
			if (remainingTextForPlayAll.trim() === "" && tempPosition < fullText.length) {
				highlightedTextHtml += remainingTextForPlayAll.replace(/\n/g, '<br>');
				break;
			}
			if (remainingTextForPlayAll === "") break;
			
			const chunkResultPlayAll = _extractChunkInternal(remainingTextForPlayAll, countPerChunk, unit);
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
				chunksToPlay.push({
					text: originalChunkText.trim(),
					originalChunk: originalChunkText,
					id: chunkId
				});
			}
			tempPosition += chunkResultPlayAll.length;
			displayChunkIndex++;
		}
		
		displayText.innerHTML = highlightedTextHtml;
		if (chunksToPlay.length === 0) {
			showStatus('No speakable chunks found.', 'info');
			if (displayText.innerHTML.trim() === "") displayText.innerHTML = "No speakable content found in the textarea.";
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			pregenerateAllBtn.disabled = false;
			stopPlaybackBtn.disabled = true;
			playAllAbortController = null;
			return;
		}
		
		isPlaying = true;
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		pregenerateAllBtn.disabled = true;
		stopPlaybackBtn.disabled = false;
		let currentOverallTextPosition = 0;
		
		for (let i = 0; i < chunksToPlay.length; i++) {
			if (signal.aborted) {
				showStatus('Playback stopped.', 'info');
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
			
			try {
				await new Promise((resolve, reject) => {
					if (signal.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
						return;
					}
					getAndPlayAudio(
						currentChunkData.text,
						(err) => {
							const playedChunkSpan = document.getElementById(currentChunkData.id);
							if (playedChunkSpan) playedChunkSpan.classList.remove('highlight');
							if (err) reject(err); else resolve();
						},
						() => {
							document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
							const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
							if (currentChunkSpanInDOM) {
								currentChunkSpanInDOM.classList.add('highlight');
								currentChunkSpanInDOM.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
							}
						},
						signal // Pass signal to getAndPlayAudio
					);
					signal.addEventListener('abort', () => {
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
				break;
			}
		}
		
		isPlaying = false;
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		pregenerateAllBtn.disabled = false;
		stopPlaybackBtn.disabled = true;
		
		if (!signal.aborted && chunksToPlay.length > 0) {
			showStatus('Finished playing all chunks.', 'success');
			currentTextPosition = fullText.length;
		} else if (chunksToPlay.length === 0 && !signal.aborted) {
			// Message already shown
		}
		if (signal.aborted) {
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
			currentTextPosition = Math.min(currentOverallTextPosition, fullText.length);
		}
		playAllAbortController = null;
		newTextLoadedForSinglePlay = true;
	};
	playAllBtn.addEventListener('click', playAllChunks);
	
	// --- Pregenerate All Audio ---
	const pregenerateAllAudioHandler = async () => {
		if (isPlaying || pregenerateAbortController) { // Don't start if already playing or pregenerating
			showStatus('Cannot pregenerate while another operation is active.', 'warning');
			return;
		}
		stopCurrentPlayback(); // Stop any existing playback/hold
		
		pregenerateAbortController = new AbortController();
		const signal = pregenerateAbortController.signal;
		const fullText = mainTextarea.value;
		
		if (!fullText.trim()) {
			showStatus('Textarea is empty. Nothing to pregenerate.', 'warning');
			pregenerateAbortController = null;
			return;
		}
		
		pregenerateAllBtn.disabled = true;
		pregenerateAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pregenerating...';
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		stopPlaybackBtn.disabled = false; // Allow stopping pregeneration
		
		let tempPosition = 0;
		const chunksToFetch = [];
		const countPerChunk = parseInt(wordsPerChunkInput.value) || (chunkUnitSelect.value === 'words' ? 10 : 1);
		const unit = chunkUnitSelect.value;
		
		// First, gather all chunks
		while (tempPosition < fullText.length) {
			const remainingText = fullText.substring(tempPosition);
			if (remainingText.trim() === "") break;
			const chunkResult = _extractChunkInternal(remainingText, countPerChunk, unit);
			if (chunkResult.length === 0) break;
			if (chunkResult.text.trim() !== "") {
				chunksToFetch.push(chunkResult.text.trim());
			}
			tempPosition += chunkResult.length;
		}
		
		if (chunksToFetch.length === 0) {
			showStatus('No speakable chunks found to pregenerate.', 'info');
			pregenerateAllBtn.disabled = false;
			pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
			speakNextBtn.disabled = false;
			playAllBtn.disabled = false;
			stopPlaybackBtn.disabled = true;
			pregenerateAbortController = null;
			return;
		}
		
		let successCount = 0;
		let failCount = 0;
		showStatus(`Starting pregeneration for ${chunksToFetch.length} chunks...`, 'info', null);
		
		for (let i = 0; i < chunksToFetch.length; i++) {
			if (signal.aborted) {
				showStatus(`Pregeneration stopped by user. ${successCount} chunks cached.`, 'info');
				break;
			}
			const chunkText = chunksToFetch[i];
			const chunkHash = simpleHash(chunkText + voiceSelect.value + volumeInput.value);
			if (audioCache[chunkHash]) {
				successCount++;
				showStatus(`Chunk ${i + 1}/${chunksToFetch.length} already cached. Skipped.`, 'info', 1500);
				continue;
			}
			
			showStatus(`Pregenerating chunk ${i + 1}/${chunksToFetch.length}: "${chunkText.substring(0,20)}..."`, 'info', null);
			try {
				await fetchAndCacheChunk(chunkText, signal);
				successCount++;
				// showStatus(`Chunk ${i + 1}/${chunksToFetch.length} cached.`, 'success', 1500); // fetchAndCacheChunk shows its own status
			} catch (error) {
				failCount++;
				if (error.name === 'AbortError') break; // Already handled by signal.aborted check
				showStatus(`Failed to pregenerate chunk ${i + 1}: ${error.message}`, 'danger');
			}
		}
		
		if (!signal.aborted) {
			if (failCount > 0) {
				showStatus(`Pregeneration complete. ${successCount} chunks cached, ${failCount} failed.`, 'warning');
			} else {
				showStatus(`Pregeneration complete. All ${successCount} chunks cached successfully.`, 'success');
			}
		}
		
		pregenerateAllBtn.disabled = false;
		pregenerateAllBtn.innerHTML = '<i class="fas fa-cogs"></i> Pregenerate All Audio';
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		stopPlaybackBtn.disabled = true;
		pregenerateAbortController = null;
	};
	pregenerateAllBtn.addEventListener('click', pregenerateAllAudioHandler);
	
});
