import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'nexus-theme';

/** @type {'light' | 'dark'} */
function readInitialTheme() {
	if (!browser) return 'dark';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable(readInitialTheme());

export const themeActions = {
	init() {
		if (!browser) return;
		const t = readInitialTheme();
		theme.set(t);
		themeActions.applyDom(t);
	},
	set(/** @type {'light' | 'dark'} */ next) {
		theme.set(next);
		themeActions.applyDom(next);
		if (browser) localStorage.setItem(STORAGE_KEY, next);
	},
	toggle() {
		const t = get(theme);
		themeActions.set(t === 'dark' ? 'light' : 'dark');
	},
	applyDom(/** @type {'light' | 'dark'} */ t) {
		if (!browser) return;
		document.documentElement.dataset.theme = t;
		document.documentElement.classList.toggle('dark', t === 'dark');
	}
};
