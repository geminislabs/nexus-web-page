import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const THEME_KEY = 'app_theme';
const DEFAULT_THEME = 'modern';

function createThemeStore() {
	const initial =
		browser && typeof localStorage !== 'undefined'
			? localStorage.getItem(THEME_KEY) || DEFAULT_THEME
			: DEFAULT_THEME;

	const { subscribe, set, update } = writable(initial);

	// Apply to DOM on init
	if (browser && typeof document !== 'undefined') {
		document.documentElement.dataset.theme = initial;
	}

	function apply(theme) {
		if (browser && typeof document !== 'undefined') {
			document.documentElement.dataset.theme = theme;
		}
		if (browser && typeof localStorage !== 'undefined') {
			localStorage.setItem(THEME_KEY, theme);
		}
	}

	return {
		subscribe,
		set: (theme) => {
			apply(theme);
			set(theme);
		},
		toggle: () =>
			update((curr) => {
				const next = curr === 'modern' ? 'classic' : 'modern';
				apply(next);
				return next;
			})
	};
}

export const theme = createThemeStore();
