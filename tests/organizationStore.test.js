import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('organizationStore', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.getItem.mockReturnValue(null);
		localStorage.setItem.mockClear();
		localStorage.removeItem.mockClear();
	});

	it('organizations defaults to an empty list', async () => {
		const { organizations } = await import('../src/lib/stores/organizationStore.js');
		expect(get(organizations)).toEqual([]);
	});

	it('setOrganizations stores the list and ignores non-array input', async () => {
		const { organizations } = await import('../src/lib/stores/organizationStore.js');
		const list = [{ organization_id: 'org-1', name: 'Mero Mero', role: 'owner' }];

		organizations.setOrganizations(list);
		expect(get(organizations)).toEqual(list);

		organizations.setOrganizations(null);
		expect(get(organizations)).toEqual([]);
	});

	it('organizations.clear empties the list', async () => {
		const { organizations } = await import('../src/lib/stores/organizationStore.js');
		organizations.setOrganizations([{ organization_id: 'org-1', name: 'A', role: 'owner' }]);
		organizations.clear();
		expect(get(organizations)).toEqual([]);
	});

	it('activeOrganizationId defaults to null', async () => {
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		expect(get(activeOrganizationId)).toBeNull();
	});

	it('setActive persists the id and updates the store', async () => {
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		activeOrganizationId.setActive('org-2');
		expect(get(activeOrganizationId)).toBe('org-2');
		expect(localStorage.setItem).toHaveBeenCalledWith('active_organization_id', 'org-2');
	});

	it('setActive with a falsy id clears storage', async () => {
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		activeOrganizationId.setActive(null);
		expect(get(activeOrganizationId)).toBeNull();
		expect(localStorage.removeItem).toHaveBeenCalledWith('active_organization_id');
	});

	it('get() reads synchronously from localStorage', async () => {
		localStorage.getItem.mockImplementation((key) =>
			key === 'active_organization_id' ? 'org-3' : null
		);
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		expect(activeOrganizationId.get()).toBe('org-3');
	});

	it('init hydrates the store from localStorage', async () => {
		localStorage.getItem.mockImplementation((key) =>
			key === 'active_organization_id' ? 'org-4' : null
		);
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		activeOrganizationId.init();
		expect(get(activeOrganizationId)).toBe('org-4');
	});

	it('clear resets the store and removes the persisted id', async () => {
		const { activeOrganizationId } = await import('../src/lib/stores/organizationStore.js');
		activeOrganizationId.setActive('org-5');
		activeOrganizationId.clear();
		expect(get(activeOrganizationId)).toBeNull();
		expect(localStorage.removeItem).toHaveBeenCalledWith('active_organization_id');
	});
});
