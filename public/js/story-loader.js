function initializeStoryLoader(uiManager) {
	const storiesModal = document.getElementById('storiesModal');
	if (!storiesModal) return;
	
	const storiesListEl = document.getElementById('storiesList');
	const storyPreviewAreaEl = document.getElementById('storyPreviewArea');
	const copyBtn = document.getElementById('copyStoryToTextboxBtn');
	const copyAndSaveBtn = document.getElementById('copyAndSaveStoryBtn');
	const mainTextarea = document.getElementById('mainTextarea');
	
	let storiesData = [];
	let selectedStory = null;
	let isDataLoaded = false;
	
	const fetchStories = async () => {
		if (isDataLoaded) return;
		
		try {
			const response = await fetch('public/short-stories.json');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			storiesData = await response.json();
			isDataLoaded = true;
			populateStoriesList();
		} catch (error) {
			console.error("Could not fetch stories:", error);
			storiesListEl.innerHTML = '<div class="list-group-item text-danger">Failed to load stories.</div>';
		}
	};
	
	const populateStoriesList = () => {
		storiesListEl.innerHTML = ''; // Clear spinner
		storiesData.forEach((story, index) => {
			const storyItem = document.createElement('a');
			storyItem.href = '#';
			storyItem.className = 'list-group-item list-group-item-action';
			storyItem.dataset.index = index;
			storyItem.innerHTML = `
                <div class="w-100 mb-1">
                    ${story.title}
                    <small class="text-muted">${story.word_count} words</small>
                </div>
            `;
			storyItem.addEventListener('click', (e) => {
				e.preventDefault();
				handleStorySelection(index);
			});
			storiesListEl.appendChild(storyItem);
		});
	};
	
	const handleStorySelection = (index) => {
		selectedStory = storiesData[index];
		if (!selectedStory) return;
		
		// Update preview area
		storyPreviewAreaEl.innerHTML = `${selectedStory.title}<br><br>${selectedStory.story.replace(/\n/g, '<br>')}`;
		
		// Highlight selected item
		document.querySelectorAll('#storiesList .list-group-item-action').forEach(item => {
			item.classList.remove('active');
		});
		const activeItem = document.querySelector(`#storiesList [data-index='${index}']`);
		if (activeItem) {
			activeItem.classList.add('active');
		}
		
		// Enable buttons
		copyBtn.disabled = false;
		copyAndSaveBtn.disabled = false;
	};
	
	storiesModal.addEventListener('show.bs.modal', fetchStories);
	
	copyBtn.addEventListener('click', () => {
		if (!selectedStory || !mainTextarea) return;
		mainTextarea.value = selectedStory.title+"\n\n"+selectedStory.story;
		
		const modalInstance = bootstrap.Modal.getInstance(storiesModal);
		if (modalInstance) modalInstance.hide();
		
		// Use the passed-in uiManager instance
		if (uiManager) {
			uiManager.showStatus(`Story "${selectedStory.title}" copied to textbox.`, 'success');
		}
	});
	
	copyAndSaveBtn.addEventListener('click', async () => {
		if (!selectedStory || !mainTextarea || !uiManager) return;
		
		// 1. Copy text to textarea
		mainTextarea.value = selectedStory.title+"\n\n"+selectedStory.story;
		
		// 2. Call the UIManager's save function
		try {
			// Use the passed-in uiManager instance
			await uiManager.saveTextToDb(selectedStory.title+"\n\n"+selectedStory.story, selectedStory.title);
		} catch (error) {
			console.error("Failed to save story via UIManager:", error);
			uiManager.showStatus('Failed to save the story to your account.', 'danger');
		}
		
		// 3. Close modal
		const modalInstance = bootstrap.Modal.getInstance(storiesModal);
		if (modalInstance) modalInstance.hide();
	});
}
