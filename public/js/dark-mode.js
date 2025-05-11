// public/js/dark-mode.js
document.addEventListener('DOMContentLoaded', () => {
	const darkModeSwitch = document.getElementById('darkModeSwitch');
	
	// Function to apply the selected theme
	const applyTheme = (theme) => {
		if (theme === 'dark') {
			document.documentElement.setAttribute('data-bs-theme', 'dark');
			if (darkModeSwitch) darkModeSwitch.checked = true;
		} else {
			document.documentElement.setAttribute('data-bs-theme', 'light');
			if (darkModeSwitch) darkModeSwitch.checked = false;
		}
		localStorage.setItem('theme', theme); // Save preference
	};
	
	// Check for saved theme in localStorage
	const currentTheme = localStorage.getItem('theme');
	if (currentTheme) {
		applyTheme(currentTheme);
	} else {
		// If no saved theme, check system preference
		const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyTheme(prefersDark ? 'dark' : 'light'); // Default to light if no system preference detected
	}
	
	// Add event listener to the switch
	if (darkModeSwitch) {
		darkModeSwitch.addEventListener('change', function() {
			applyTheme(this.checked ? 'dark' : 'light');
		});
	}
});
