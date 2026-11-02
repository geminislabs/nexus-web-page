import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('themeStore', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.getItem.mockReturnValue(null);
		localStorage.setItem.mockClear();
		document.documentElement.className = '';
		delete document.documentElement.dataset.theme;
	});

	it('themeActions.init reads saved preference', async () => {
		localStorage.getItem.mockImplementation((key) => (key === 'nexus-theme' ? 'light' : null));
		const { theme, themeActions } = await import('../src/lib/stores/themeStore.js');
		themeActions.init();
		expect(get(theme)).toBe('light');
	});

	it('themeActions.set applies dark class and persists', async () => {
		const { theme, themeActions } = await import('../src/lib/stores/themeStore.js');
		themeActions.set('dark');
		expect(get(theme)).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.setItem).toHaveBeenCalledWith('nexus-theme', 'dark');
	});

	it('themeActions.toggle switches between light and dark', async () => {
		const { theme, themeActions } = await import('../src/lib/stores/themeStore.js');
		themeActions.set('dark');
		themeActions.toggle();
		expect(get(theme)).toBe('light');
	});
});
