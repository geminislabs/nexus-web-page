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
			const normalized = {
				...userData,
				name: userData.name || userData.full_name || ''
			};
			set(normalized);
			if (browser) {
				sessionStorage.removeItem('dev_logout');
				localStorage.setItem('user', JSON.stringify(normalized));
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
				localStorage.removeItem('token_expires_at');
			}
		},
		/**
		 * Inicializar el store desde localStorage si existe
		 */
		init: () => {
			if (!browser) return;
			const userData = localStorage.getItem('user');
			if (userData) {
				try {
					const parsed = JSON.parse(userData);
					const normalized = {
						...parsed,
						name: parsed.name || parsed.full_name || ''
					};
					set(normalized);
				} catch {
					set(null);
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
				const updatedUser = {
					...currentUser,
					...updates,
					name: updates.name || updates.full_name || currentUser.name || currentUser.full_name || ''
				};
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
			const { access_token, expires_in } = tokens;

			set(access_token);

			if (browser) {
				localStorage.setItem('token', access_token);
				if (tokens.refresh_token) {
					localStorage.setItem('refresh_token', tokens.refresh_token);
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
		 * Obtener el refresh token actual
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
		 * Verificar si el token está próximo a expirar
		 * @param {number} thresholdSeconds - Segundos antes de expirar para considerar "próximo"
		 * @returns {boolean} true si está próximo a expirar o ya expiró
		 */
		isTokenExpiringSoon: (thresholdSeconds = 300) => {
			if (!browser) return false;

			const expiresAt = localStorage.getItem('token_expires_at');
			if (!expiresAt) return true; // Si no hay expiración, asumir que necesitamos refresh

			// Calcular tiempo restante
			const timeLeft = parseInt(expiresAt) - Date.now();
			// Convertir a segundos
			const secondsLeft = timeLeft / 1000;

			return secondsLeft < thresholdSeconds;
		},
		/**
		 * Limpiar todos los tokens
		 */
		clearToken: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('token');
				localStorage.removeItem('refresh_token');
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
