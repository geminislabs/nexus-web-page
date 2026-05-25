import { user, authToken } from '$lib/stores/auth.js';
import { apiService } from '$lib/services/api.js';

/** @param {Record<string, unknown> | null | undefined} apiUser */
export function normalizeUser(apiUser) {
	if (!apiUser) return null;
	return {
		...apiUser,
		name: apiUser.name || apiUser.full_name || '',
		is_master: apiUser.is_master ?? apiUser.role === 'master'
	};
}

/** @param {{ access_token?: string, refresh_token?: string, id_token?: string, expires_in?: number, user?: Record<string, unknown> }} response */
export function persistLoginResponse(response) {
	authToken.setSession({
		access_token: response.access_token,
		refresh_token: response.refresh_token,
		id_token: response.id_token,
		expires_in: response.expires_in
	});
	user.login(normalizeUser(response.user));
}

export function clearLocalSession() {
	user.logout();
	authToken.clearToken();
}

export async function logoutSession() {
	if (authToken.getToken()) {
		try {
			await apiService.logout();
		} catch (err) {
			console.warn('Logout API failed; clearing local session anyway:', err);
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
		return true;
	} catch (err) {
		console.warn('Session validation failed:', err);
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
