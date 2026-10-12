import { writable } from 'svelte/store';

/**
 * Lo que el usuario puede hacer en su cuenta comercial, tal como lo resuelve
 * `GET /auth/me` (siscom-admin-api, B4 rebanada 1).
 *
 * Sirve para decidir qué se **muestra**, nunca qué se permite: quien autoriza
 * es el backend, en cada endpoint. Un menú que enseña de más acaba en un 403;
 * uno que enseña de menos esconde una función que el usuario sí tiene.
 *
 * @typedef {{
 *   accountId: string | null,
 *   accountName: string | null,
 *   role: string | null,
 *   permissions: string[],
 *   capabilities: Record<string, boolean | number | string | null>
 * }} AccountAccess
 */

/** @returns {AccountAccess} */
function emptyAccess() {
	return { accountId: null, accountName: null, role: null, permissions: [], capabilities: {} };
}

/**
 * Normaliza la respuesta de `/auth/me`. Contra un backend anterior a la
 * rebanada 1 faltan `account_permissions` y `account_capabilities`: el
 * resultado es «sin permisos», que es lo seguro.
 * @param {Record<string, any> | null | undefined} me
 * @returns {AccountAccess}
 */
export function accessFromMe(me) {
	if (!me || typeof me !== 'object') return emptyAccess();
	const capabilities = me.account_capabilities;
	return {
		accountId: me.account?.id != null ? String(me.account.id) : null,
		accountName: me.account?.account_name ?? null,
		role: me.account_role ?? null,
		permissions: Array.isArray(me.account_permissions)
			? me.account_permissions.filter((p) => typeof p === 'string')
			: [],
		capabilities:
			capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)
				? capabilities
				: {}
	};
}

/**
 * Si se muestra la pantalla de marca: el permiso `branding.write` y la
 * capability `white_label_enabled`, las mismas dos condiciones que exige el
 * backend en los cuatro endpoints.
 * @param {AccountAccess | null | undefined} access
 */
export function canEditBrand(access) {
	if (!access?.accountId) return false;
	return (
		access.permissions.includes('branding.write') &&
		access.capabilities.white_label_enabled === true
	);
}

function createAccountAccessStore() {
	const { subscribe, set } = writable(emptyAccess());

	return {
		subscribe,
		/** @param {Record<string, any> | null | undefined} me */
		setFromMe: (me) => set(accessFromMe(me)),
		clear: () => set(emptyAccess())
	};
}

/** Vive solo en memoria: se vuelve a pedir en cada arranque de sesión. */
export const accountAccess = createAccountAccessStore();
