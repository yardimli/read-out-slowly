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
	
	let currentTextPosition = 0;
	let audioCache = {}; // Store { textHash: audioUrl }
	let isPlaying = false;
	let playAllAbortController = null;
	let newTextLoadedForSinglePlay = true;
	
	const showStatus = (message, type = 'info', duration = 3000) => {
		statusMessage.textContent = message;
		statusMessage.className = `alert alert-${type} mt-2`;
		statusMessage.style.display = 'block';
		if (duration) {
			setTimeout(() => {
				statusMessage.style.display = 'none';
			}, duration);
		}
	};
	
	toggleTextareaBtn.addEventListener('click', () => {
		if (mainTextarea.style.display === 'none') {
			mainTextarea.style.display = 'block';
			toggleTextareaBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Textarea';
		} else {
			mainTextarea.style.display = 'none';
			toggleTextareaBtn.innerHTML = '<i class="fas fa-eye"></i> Show Textarea';
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
	const _extractChunkInternal = (textToProcess, wordsPerChunkTarget) => {
		let chunkEndIndex = -1; // Initialize to -1 to indicate no valid end found yet
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
			
			// Check for punctuation or newline to end chunk
			if (char === '.' || char === ',' || char === '\n') {
				if (inWord) { // If punctuation is hit while "in a word" (e.g. "word.")
					wordsInChunk++; // Count this word
					inWord = false; // Word ends here
				}
				chunkEndIndex = i; // Include the punctuation
				break;
			}
			
			// Check if word count is met
			if (wordsInChunk >= wordsPerChunkTarget) {
				chunkEndIndex = lastWordEndIndex; // End of the last full word
				break;
			}
			
			// If no break condition met yet, the potential end is the current character
			chunkEndIndex = i;
		}
		
		// After loop, if still inWord (text ends mid-word, or loop finished before space after last word)
		if (inWord) {
			wordsInChunk++;
		}
		
		// If loop finished naturally (no break), chunkEndIndex is already the last char index.
		// If a break happened, chunkEndIndex is set.
		// If textToProcess was very short (e.g., one word less than target), chunkEndIndex is last char.
		
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
		
		if (remainingText.trim() === "") { // Handle if only whitespace remains
			currentTextPosition = fullText.length;
			showStatus('End of text reached (trailing whitespace).', 'info');
			newTextLoadedForSinglePlay = true;
			return null;
		}
		
		const chunkResult = _extractChunkInternal(remainingText, wordsToRead);
		
		if (chunkResult.text.trim() === "") {
			// If the extracted chunk is all whitespace, try to advance past it.
			// This might happen if _extractChunkInternal is given e.g. "   " and stops early.
			if (chunkResult.length > 0 && currentTextPosition + chunkResult.length < fullText.length) {
				currentTextPosition += chunkResult.length;
				return getNextChunk(); // Recursively get the next actual content chunk
			}
			// Otherwise, no meaningful chunk found or end of text.
			currentTextPosition = fullText.length; // Ensure we are at the end
			newTextLoadedForSinglePlay = true;
			return null;
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
				speakNextBtn.disabled = true;
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
		if (!isPlaying) return;
		audioPlayer.pause();
		audioPlayer.currentTime = 0;
		audioPlayer.src = "";
		isPlaying = false;
		speakNextBtn.disabled = false;
		playAllBtn.disabled = false;
		stopPlaybackBtn.style.display = 'none';
		document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		if (playAllAbortController) {
			playAllAbortController.abort();
			playAllAbortController = null;
		}
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
		
		showStatus(`Requesting TTS for: "${trimmedTextChunk.substring(0, 30)}..."`, 'info', null);
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
	
	speakNextBtn.addEventListener('click', () => {
		if (isPlaying) return;
		stopCurrentPlayback();
		
		const chunkData = getNextChunk(); // Returns { text: "original chunk", newPosition: pos }
		
		if (chunkData && chunkData.text.trim() !== "") {
			currentTextPosition = chunkData.newPosition; // Update position as chunk is taken
			const chunkId = 'chunk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			
			getAndPlayAudio(
				chunkData.text.trim(), // Text for TTS API (trimmed)
				() => { // onEnded
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.remove('highlight');
				},
				() => { // onPlayStart (this is when audio actually starts)
					if (newTextLoadedForSinglePlay) {
						displayText.innerHTML = '';
						newTextLoadedForSinglePlay = false;
					}
					// Use chunkData.text (original spacing, untrimmed) for display
					const newChunkHtml = `<span id="${chunkId}">${chunkData.text.replace(/\n/g, '<br>')}</span>`;
					displayText.insertAdjacentHTML('beforeend', newChunkHtml);
					// If you want a space between chunks that don't end with a space or newline:
					// displayText.insertAdjacentHTML('beforeend', ' ');
					
					displayText.scrollTop = displayText.scrollHeight;
					
					document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
					const currentChunkSpan = document.getElementById(chunkId);
					if (currentChunkSpan) currentChunkSpan.classList.add('highlight');
				}
			);
		} else {
			// getNextChunk handles "end of text" or empty textarea messages and resets.
			if (mainTextarea.value.trim().length > 0 && currentTextPosition === 0 && newTextLoadedForSinglePlay) {
				// End of text was reached, and user clicks again.
				// newTextLoadedForSinglePlay is true, so display will clear.
				// getNextChunk will be called again if they click, and it will start from beginning.
				displayText.innerHTML = "End of text. Click again to restart or load new text.";
			} else if (mainTextarea.value.trim().length === 0) {
				displayText.innerHTML = "Textarea is empty. Please enter or generate text.";
			} else if (!chunkData || chunkData.text.trim() === "") {
				// This case implies end of text or no more valid chunks.
				// getNextChunk should have shown a status.
				displayText.innerHTML = "End of text. Load new text or click 'Speak Next Chunk' to restart.";
			}
		}
	});
	
	mainTextarea.addEventListener('input', () => {
		currentTextPosition = 0;
		newTextLoadedForSinglePlay = true;
		displayText.innerHTML = "Text changed. Click 'Speak Next Chunk' or 'Play All'.";
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
		const chunksToPlay = [];
		let highlightedTextHtml = "";
		let chunkIndex = 0;
		
		while (tempPosition < fullText.length) {
			const wordsToRead = parseInt(wordsPerChunkInput.value) || 10;
			const remainingTextForPlayAll = fullText.substring(tempPosition);
			
			if (remainingTextForPlayAll.trim() === "") break;
			
			const chunkResultPlayAll = _extractChunkInternal(remainingTextForPlayAll, wordsToRead);
			let originalChunkText = chunkResultPlayAll.text;
			
			if (originalChunkText.trim() === "") {
				if (chunkResultPlayAll.length > 0) {
					tempPosition += chunkResultPlayAll.length;
					continue;
				}
				break;
			}
			
			const chunkId = `playall-chunk-${chunkIndex}`;
			chunksToPlay.push({
				text: originalChunkText.trim(),
				originalChunk: originalChunkText,
				id: chunkId
			});
			highlightedTextHtml += `<span id="${chunkId}">${originalChunkText.replace(/\n/g, '<br>')}</span>`;
			
			tempPosition += chunkResultPlayAll.length;
			chunkIndex++;
		}
		
		if (chunksToPlay.length === 0) {
			showStatus('No speakable chunks found.', 'info');
			displayText.innerHTML = "No speakable content found in the textarea.";
			return;
		}
		
		isPlaying = true;
		speakNextBtn.disabled = true;
		playAllBtn.disabled = true;
		stopPlaybackBtn.style.display = 'inline-block';
		let isFullTextInDOM = false;
		
		for (let i = 0; i < chunksToPlay.length; i++) {
			if (signal.aborted) {
				showStatus('Playback stopped.', 'info');
				break;
			}
			const currentChunkData = chunksToPlay[i];
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
							if (!isFullTextInDOM) {
								displayText.innerHTML = highlightedTextHtml;
								isFullTextInDOM = true;
							}
							document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
							const currentChunkSpanInDOM = document.getElementById(currentChunkData.id);
							if (currentChunkSpanInDOM) {
								currentChunkSpanInDOM.classList.add('highlight');
								currentChunkSpanInDOM.scrollIntoView({behavior: 'smooth', block: 'nearest'});
							}
						}
					);
					signal.addEventListener('abort', () => {
						stopCurrentPlayback(); // Ensure audio stops immediately on abort
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
		stopPlaybackBtn.style.display = 'none';
		
		if (!signal.aborted && chunksToPlay.length > 0) {
			showStatus('Finished playing all chunks.', 'success');
			// displayText.innerHTML = "Playback complete. Load new text or play again."; // Keep the full text displayed
		} else if (chunksToPlay.length === 0 && !signal.aborted) {
			displayText.innerHTML = "No content to play.";
		}
		if (signal.aborted) {
			// Text is already in display, just ensure highlighting is off
			document.querySelectorAll('#displayText .highlight').forEach(el => el.classList.remove('highlight'));
		}
		
		playAllAbortController = null;
		newTextLoadedForSinglePlay = true;
	};
	playAllBtn.addEventListener('click', playAllChunks);
});
