import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('workspaceStore', () => {
	beforeEach(() => {
		vi.resetModules();
		sessionStorage.clear();
	});

	it('defaults to admin when sessionStorage is empty', async () => {
		const { workspace } = await import('../src/lib/stores/workspaceStore.js');
		expect(get(workspace)).toBe('admin');
	});

	it('hydrates tracking from sessionStorage', async () => {
		sessionStorage.setItem('nexus-workspace', 'tracking');
		const { workspace } = await import('../src/lib/stores/workspaceStore.js');
		expect(get(workspace)).toBe('tracking');
	});

	it('setWorkspace persists and goAdmin/goTracking switch sections', async () => {
		const { workspace, adminSection, workspaceActions } = await import(
			'../src/lib/stores/workspaceStore.js'
		);

		workspaceActions.goTracking();
		expect(get(workspace)).toBe('tracking');
		expect(sessionStorage.getItem('nexus-workspace')).toBe('tracking');

		workspaceActions.goAdmin('users');
		expect(get(workspace)).toBe('admin');
		expect(get(adminSection)).toBe('users');

		workspaceActions.ensureTrackingForUser();
		expect(get(workspace)).toBe('tracking');
	});
});
