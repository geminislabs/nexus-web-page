import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { bypassAuthInDev } from '$lib/config/env.js';

// Mock user para desarrollo
const mockUser = {
	id: 1,
	name: 'Usuario Dev',
	email: 'dev@tracker-monitor.com'
};

// Crear el store para el usuario autenticado
const DEV_LOGOUT_KEY = 'nexus-dev-logged-out';

function createAuthStore() {
	const { subscribe, set, update } = writable(null);

	return {
		subscribe,

		login: (userData) => {
			set(userData);
			if (browser) {
				sessionStorage.removeItem(DEV_LOGOUT_KEY);
				localStorage.setItem('user', JSON.stringify(userData));
			}
		},
		logout: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('user');
				localStorage.removeItem('token');
				if (bypassAuthInDev) sessionStorage.setItem(DEV_LOGOUT_KEY, '1');
			}
		},

		init: () => {
			if (!browser) return;

			// En modo desarrollo, usar mock user automáticamente
			if (bypassAuthInDev) {
				const wasLoggedOut = sessionStorage.getItem(DEV_LOGOUT_KEY);
				if (!wasLoggedOut) {
					set(mockUser);
					localStorage.setItem('user', JSON.stringify(mockUser));
					return;
				}
				set(null);
				return;
			}
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
			// En modo desarrollo, devolver token mock
			if (bypassAuthInDev) return 'mock-dev-token';
			return localStorage.getItem('token');
		},
		clearToken: () => {
			set(null);
			if (browser) localStorage.removeItem('token');
		},
		init: () => {
			if (!browser) return;
			if (bypassAuthInDev) {
				const wasLoggedOut = sessionStorage.getItem(DEV_LOGOUT_KEY);
				if (!wasLoggedOut) set('mock-dev-token');
				return;
			}
			const token = localStorage.getItem('token');
			if (token) set(token);
		}
	};
}

export const authToken = createTokenStore();
