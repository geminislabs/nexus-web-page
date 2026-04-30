import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Store para el usuario autenticado
 * Almacena los datos del usuario en memoria y localStorage
 */
function createAuthStore() {
	const { subscribe, set, update } = writable(null);

	return {
		subscribe,

		login: (userData) => {
			set(userData);
			if (browser) {
				localStorage.setItem('user', JSON.stringify(userData));
			}
		},
		logout: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('user');
				localStorage.removeItem('token');
			}
		},

		init: () => {
			if (!browser) return;
			// En producción, verificar localStorage
			const userData = localStorage.getItem('user');
			if (userData) {
				try {
					set(JSON.parse(userData));
				} catch {
					set(null);
				}
			}
		}
	};
}

export const user = createAuthStore();

// Store para el token de autenticación
function decodeJwtPayload(token) {
	try {
		const parts = String(token || '').split('.');
		if (parts.length < 2) return null;
		const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const payload = atob(payloadBase64);
		return JSON.parse(payload);
	} catch {
		return null;
	}
}

function createTokenStore() {
	const { subscribe, set } = writable(null);

	return {
		subscribe,
		setToken: (token) => {
			set(token);
			if (browser) localStorage.setItem('token', token);
		},
		getToken: () => {
			if (!browser) return null;
			return localStorage.getItem('token');
		},
		isTokenExpiringSoon: (thresholdSeconds = 300) => {
			if (!browser) return false;
			const token = localStorage.getItem('token');
			if (!token) return false;
			const payload = decodeJwtPayload(token);
			if (!payload || typeof payload.exp !== 'number') return false;
			const nowInSeconds = Math.floor(Date.now() / 1000);
			return payload.exp - nowInSeconds <= thresholdSeconds;
		},
		clearToken: () => {
			set(null);
			if (browser) localStorage.removeItem('token');
		},
		init: () => {
			if (!browser) return;
			const token = localStorage.getItem('token');
			if (token) set(token);
		}
	};
}

export const authToken = createTokenStore();
