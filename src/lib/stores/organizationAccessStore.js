import { writable, get } from 'svelte/store';
import { getCompanyBaseUrl } from '$lib/constants/legal.js';
import { organizations, activeOrganizationId, isActiveOrganization } from './organizationStore.js';

/**
 * Si la organización en la que actúa la sesión está suspendida o borrada
 * (siscom-admin-api `docs/api/suspension.md`).
 *
 * Dos fuentes, las mismas que en los móviles:
 *
 * 1. La fila de la organización activa en `GET /auth/organizations`
 *    (`access_blocked`), al iniciar sesión y al pulsar «Reintentar». No
 *    `/auth/me`: el panel no manda `X-Organization-Id` a `/auth/*`, así que
 *    `/auth/me` describe la organización por defecto, no la activa.
 * 2. Cualquier 403 de admin-api con `error_code` de suspensión cuyo
 *    `organization_id` sea el de la organización activa (`api.js`).
 *
 * Mientras esté bloqueada, el layout del dashboard no monta nada: sin mapa,
 * sin stream y sin pedir data token.
 *
 * @typedef {{
 *   organizationId: string | null,
 *   errorCode: 'organization_suspended' | 'organization_deleted',
 *   suspendedBy: 'organization' | 'account' | null,
 *   canManageBilling: boolean
 * }} OrganizationBlock
 */

export const ORGANIZATION_SUSPENDED = 'organization_suspended';
export const ORGANIZATION_DELETED = 'organization_deleted';

const BLOCK_CODES = new Set([ORGANIZATION_SUSPENDED, ORGANIZATION_DELETED]);

/**
 * El bloqueo que describe un cuerpo del backend —el del 403 o el
 * `access_blocked` de una fila—, o `null` si no lo es.
 * @param {any} body
 * @param {string | null} [organizationId]
 * @returns {OrganizationBlock | null}
 */
export function parseOrganizationBlock(body, organizationId = null) {
	if (!body || typeof body !== 'object' || !BLOCK_CODES.has(body.error_code)) return null;
	return {
		organizationId: body.organization_id ? String(body.organization_id) : organizationId,
		errorCode: body.error_code,
		suspendedBy: body.suspended_by ?? null,
		canManageBilling: body.error_code === ORGANIZATION_SUSPENDED && body.can_manage_billing === true
	};
}

/** La fila de la organización en la que actúa la sesión, si la hay. */
export function activeOrganizationRow() {
	const list = get(organizations);
	const activeId = activeOrganizationId.get();
	return list.find((org) => isActiveOrganization(org, activeId, list)) ?? null;
}

function createOrganizationAccessStore() {
	const { subscribe, set } = writable(/** @type {OrganizationBlock | null} */ (null));

	return {
		subscribe,

		/**
		 * Un 403 de admin-api. Bloquea sólo si es de la organización activa: un
		 * 403 de otra organización (una petición vieja tras cambiar) no es el
		 * estado de ésta.
		 * @param {any} body
		 * @returns {boolean} si el cuerpo era de suspensión
		 */
		reportForbidden(body) {
			const block = parseOrganizationBlock(body);
			if (!block) return false;
			const active = activeOrganizationRow();
			const activeId = active ? String(active.organization_id) : activeOrganizationId.get();
			// Sin lista todavía no se sabe cuál es la activa; el backend sólo
			// contesta este 403 por la organización en la que se actuó, así que
			// se le cree.
			if (!activeId || !block.organizationId || block.organizationId === activeId) {
				set(block);
			}
			return true;
		},

		/** Recalcula el estado con la lista recién pedida a `/auth/organizations`. */
		syncFromOrganizations() {
			const active = activeOrganizationRow();
			set(
				active
					? parseOrganizationBlock(active.access_blocked, String(active.organization_id))
					: null
			);
		},

		clear: () => set(null)
	};
}

export const organizationAccess = createOrganizationAccessStore();

/** Lectura síncrona, para los servicios que no se suscriben. */
export function isOrganizationBlocked() {
	return get(organizationAccess) !== null;
}

/**
 * Facturación vive en el portal (geminislabs.com), que es el que deja pagar a
 * una organización suspendida. Se arma en un solo sitio: con las marcas
 * blancas el portal podría cambiar.
 */
export function getBillingUrl() {
	return `${getCompanyBaseUrl()}/control-panel/billing/summary`;
}

/**
 * Los textos de la pantalla. Una función pura para poder probar los tres casos
 * sin montar el componente.
 *
 * @param {OrganizationBlock} block
 * @param {string | null | undefined} organizationName
 * @returns {{ title: string, message: string, hint: string | null, showBilling: boolean }}
 */
export function organizationBlockCopy(block, organizationName) {
	const given = organizationName?.trim() || null;
	const name = given ?? 'esta organización';
	if (block.errorCode === ORGANIZATION_DELETED) {
		return {
			title: 'Organización no disponible',
			message: `${given ?? 'Esta organización'} ya no está disponible.`,
			hint: null,
			showBilling: false
		};
	}
	if (block.canManageBilling) {
		return {
			title: 'Servicio suspendido',
			message: `El servicio de ${name} está suspendido. Revisa tu facturación para reactivarlo.`,
			hint: 'En cuanto se registre el pago, el servicio vuelve solo. Después pulsa «Reintentar».',
			showBilling: true
		};
	}
	return {
		title: 'Servicio suspendido',
		message: `El servicio de ${name} está suspendido. Contacta al administrador de tu cuenta.`,
		hint: null,
		showBilling: false
	};
}

/**
 * Las otras organizaciones a las que se puede cambiar: las que dan acceso.
 * @param {import('./organizationStore.js').UserOrganization[]} list
 * @param {string | null} activeId el id de la activa
 */
export function switchableOrganizations(list, activeId) {
	return list.filter(
		(org) => String(org.organization_id) !== String(activeId) && !org.access_blocked
	);
}
