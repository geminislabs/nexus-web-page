import { user, authToken } from '$lib/stores/auth.js';
import { organizations, activeOrganizationId } from '$lib/stores/organizationStore.js';
import { apiService } from '$lib/services/api.js';
import { clearDataToken, primeDataToken } from '$lib/services/dataToken.js';
import { logger } from '$lib/utils/logger.js';

/**
 * Trae las membresías activas del usuario y las guarda en el store. Si la
 * organización activa persistida ya no aparece en la lista (la membresía se
 * revocó), se limpia y la sesión cae al default — nunca se manda una
 * cabecera para una organización que el usuario ya no tiene.
 *
 * Best effort: si la llamada falla, degrada a "nada que elegir" en vez de
 * romper el login (ver `getMyOrganizations`, selector de cuenta B3, §26).
 */
async function loadMyOrganizations() {
	try {
		const list = await apiService.getMyOrganizations();
		organizations.setOrganizations(list);

		const currentId = activeOrganizationId.get();
		const stillMember = Array.isArray(list)
			? list.some((org) => String(org.organization_id) === String(currentId))
			: false;
		if (currentId && !stillMember) {
			activeOrganizationId.clear();
		}
	} catch (err) {
		logger.warn({
			code: 'AUTH_ORGANIZATIONS_FETCH_FAILED',
			message: 'Failed to fetch user organizations',
			err
		});
		organizations.clear();
	}
}

/** @param {Record<string, unknown> | null | undefined} apiUser */
export function normalizeUser(apiUser) {
	if (!apiUser) return null;
	// Solo campos necesarios en cliente — evita persistir payload completo (PII extra) en localStorage.
	return {
		id: apiUser.id ?? null,
		email: apiUser.email ?? null,
		name: apiUser.name || apiUser.full_name || '',
		full_name: apiUser.full_name || apiUser.name || '',
		role: apiUser.role ?? null,
		is_master: apiUser.is_master ?? apiUser.role === 'master',
		// `client_id` es el alias legado de `organization_id` en UserOut — no es
		// PII, y el panel de miembros lo necesita para acotar sus llamadas.
		organization_id: apiUser.client_id ?? apiUser.organization_id ?? null
	};
}

/** @param {{ access_token?: string, refresh_token?: string, id_token?: string, expires_in?: number, data_token?: string | null, user?: Record<string, unknown> }} response */
export function persistLoginResponse(response) {
	authToken.setSession({
		access_token: response.access_token,
		refresh_token: response.refresh_token,
		id_token: response.id_token,
		expires_in: response.expires_in
	});
	// Conveniencia: si el login trae la credencial del plano de datos, el mapa
	// pinta sin un round trip extra. Si no la trae, se pide al endpoint dedicado.
	primeDataToken(response);
	user.login(normalizeUser(response.user));
	loadMyOrganizations();
}

export function clearLocalSession() {
	user.logout();
	authToken.clearToken();
	organizations.clear();
	activeOrganizationId.clear();
	// La credencial del plano de datos deriva de la sesión: si la sesión muere,
	// muere con ella. Vive solo en memoria, así que basta con soltarla.
	clearDataToken();
}

export async function logoutSession() {
	if (authToken.getToken()) {
		try {
			await apiService.logout();
		} catch (err) {
			logger.warn({
				code: 'AUTH_LOGOUT_API_FAILED',
				message: 'Logout API failed; clearing local session anyway',
				err
			});
		}
	}
	clearLocalSession();
}

export async function validateSessionWithApi() {
	user.init();
	authToken.init();

	if (!authToken.getToken()) {
		clearLocalSession();
		return false;
	}

	try {
		const apiUser = await apiService.getCurrentUser();
		user.login(normalizeUser(apiUser));
		await loadMyOrganizations();
		return true;
	} catch (err) {
		logger.warn({
			code: 'AUTH_SESSION_INVALID',
			message: 'Session validation failed',
			err
		});
		clearLocalSession();
		return false;
	}
}

export function getRecoverPasswordUrl() {
	const base = String(import.meta.env.VITE_COMPANY_URL || '')
		.trim()
		.replace(/\/$/, '');
	if (!base) return null;
	return `${base}/auth?mode=recover`;
}
