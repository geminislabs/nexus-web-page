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
		/**
		 * Iniciar sesión y guardar datos del usuario
		 * @param {Object} userData - Datos del usuario
		 */
		login: (userData) => {
			set(userData);
			if (browser) {
				localStorage.setItem('user', JSON.stringify(userData));
			}
		},
		/**
		 * Cerrar sesión y limpiar datos
		 */
		logout: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('user');
				localStorage.removeItem('token');
				localStorage.removeItem('refresh_token');
				localStorage.removeItem('id_token');
			}
		},
		/**
		 * Inicializar el store desde localStorage si existe
		 */
		init: () => {
			if (browser) {
				const userData = localStorage.getItem('user');
				if (userData) {
					try {
						set(JSON.parse(userData));
					} catch (error) {
						console.error('Error parsing user data from localStorage:', error);
						// Limpiar datos corruptos
						localStorage.removeItem('user');
					}
				}
			}
		},
		/**
		 * Actualizar datos del usuario
		 * @param {Object} updates - Actualizaciones parciales
		 */
		update: (updates) => {
			update((currentUser) => {
				if (!currentUser) return null;
				const updatedUser = { ...currentUser, ...updates };
				if (browser) {
					localStorage.setItem('user', JSON.stringify(updatedUser));
				}
				return updatedUser;
			});
		}
	};
}

export const user = createAuthStore();

/**
 * Store para los tokens de autenticación
 * Maneja access_token, refresh_token e id_token
 */
function createTokenStore() {
	const { subscribe, set } = writable(null);

	return {
		subscribe,
		/**
		 * Guardar todos los tokens de autenticación
		 * @param {Object} tokens - {access_token, refresh_token, id_token, expires_in}
		 */
		setTokens: (tokens) => {
			const { access_token, refresh_token, id_token, expires_in } = tokens;
			
			set(access_token);
			
			if (browser) {
				localStorage.setItem('token', access_token);
				if (refresh_token) {
					localStorage.setItem('refresh_token', refresh_token);
				}
				if (id_token) {
					localStorage.setItem('id_token', id_token);
				}
				if (expires_in) {
					// Guardar timestamp de expiración
					const expiresAt = Date.now() + expires_in * 1000;
					localStorage.setItem('token_expires_at', expiresAt.toString());
				}
			}
		},
		/**
		 * Guardar solo el access token (para compatibilidad)
		 * @param {string} token - Access token
		 */
		setToken: (token) => {
			set(token);
			if (browser) {
				localStorage.setItem('token', token);
			}
		},
		/**
		 * Obtener el access token actual
		 * @returns {string|null} Access token o null
		 */
		getToken: () => {
			if (browser) {
				return localStorage.getItem('token');
			}
			return null;
		},
		/**
		 * Obtener el refresh token
		 * @returns {string|null} Refresh token o null
		 */
		getRefreshToken: () => {
			if (browser) {
				return localStorage.getItem('refresh_token');
			}
			return null;
		},
		/**
		 * Verificar si el token ha expirado
		 * @returns {boolean} true si expiró o no existe
		 */
		isTokenExpired: () => {
			if (!browser) return true;
			
			const expiresAt = localStorage.getItem('token_expires_at');
			if (!expiresAt) return true;
			
			return Date.now() >= parseInt(expiresAt);
		},
		/**
		 * Limpiar todos los tokens
		 */
		clearToken: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('token');
				localStorage.removeItem('refresh_token');
				localStorage.removeItem('id_token');
				localStorage.removeItem('token_expires_at');
			}
		},
		/**
		 * Inicializar el store desde localStorage si existe
		 */
		init: () => {
			if (browser) {
				const token = localStorage.getItem('token');
				if (token) {
					set(token);
				}
			}
		}
	};
}

export const authToken = createTokenStore();
