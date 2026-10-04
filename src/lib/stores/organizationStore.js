import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LS_ACTIVE_ORGANIZATION_ID = 'active_organization_id';

/** @typedef {{ organization_id: string, name: string, role: string }} UserOrganization */

function createOrganizationsStore() {
	const { subscribe, set } = writable(/** @type {UserOrganization[]} */ ([]));

	return {
		subscribe,
		/** @param {UserOrganization[] | null | undefined} list */
		setOrganizations: (list) => {
			set(Array.isArray(list) ? list : []);
		},
		clear: () => set([])
	};
}

/** Las membresías activas del usuario autenticado (GET /auth/organizations). */
export const organizations = createOrganizationsStore();

function createActiveOrganizationStore() {
	const { subscribe, set } = writable(/** @type {string | null} */ (null));

	return {
		subscribe,
		/** @param {string | null | undefined} organizationId */
		setActive: (organizationId) => {
			const id = organizationId || null;
			set(id);
			if (!browser) return;
			if (id) localStorage.setItem(LS_ACTIVE_ORGANIZATION_ID, id);
			else localStorage.removeItem(LS_ACTIVE_ORGANIZATION_ID);
		},
		/** Lectura síncrona para `api.js`, igual que `authToken.getToken()`. */
		get: () => {
			if (!browser) return null;
			return localStorage.getItem(LS_ACTIVE_ORGANIZATION_ID);
		},
		clear: () => {
			set(null);
			if (browser) localStorage.removeItem(LS_ACTIVE_ORGANIZATION_ID);
		},
		init: () => {
			if (!browser) return;
			const id = localStorage.getItem(LS_ACTIVE_ORGANIZATION_ID);
			if (id) set(id);
		}
	};
}

/**
 * La organización en la que actúa esta sesión — se manda como cabecera
 * `X-Organization-Id`. `null` significa «la de siempre»
 * (`default_organization_id`): nunca es un error, igual que en el backend.
 */
export const activeOrganizationId = createActiveOrganizationStore();
