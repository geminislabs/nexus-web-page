import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LS_ACTIVE_ORGANIZATION_ID = 'active_organization_id';

/**
 * `is_default` llega desde siscom-admin-api v1.51.0; contra un backend anterior
 * falta y se cae al primero de la lista (ver `isActiveOrganization`).
 * @typedef {{ organization_id: string, name: string, role: string, is_default?: boolean }} UserOrganization
 */

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

/**
 * Si `org` es la organización en la que actúa la sesión.
 *
 * Con una elegida, es esa. Sin elegir (`null`), es la de siempre — la que el
 * backend marca con `is_default`. Si el backend todavía no manda el campo, la
 * primera de la lista: era el comportamiento antes de existir, y puede no ser
 * la de verdad porque la lista viene ordenada por nombre.
 *
 * @param {UserOrganization} org
 * @param {string | null | undefined} activeId
 * @param {UserOrganization[]} list
 */
export function isActiveOrganization(org, activeId, list) {
	if (activeId) return String(org.organization_id) === String(activeId);
	if (list.some((o) => typeof o.is_default === 'boolean')) return org.is_default === true;
	return org === list[0];
}
