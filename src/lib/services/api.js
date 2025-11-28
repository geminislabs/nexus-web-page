import { authToken, user } from '../stores/auth.js';
import { get } from 'svelte/store';

// Configuración de las APIs
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8000';
const COMM_API_URL = import.meta.env.VITE_COMM_API_URL || 'http://34.237.30.30:8080';

/**
 * Servicio de API para comunicación con SISCOM-ADMIN-API y SISCOM-API
 * - ADMIN_API_URL: API administrativa (usuarios, clientes, dispositivos)
 * - COMM_API_URL: API de comunicaciones (rastreo GPS)
 */
class ApiService {
	constructor() {
		this.adminBaseURL = ADMIN_API_URL;
		this.commBaseURL = COMM_API_URL;
	}

	/**
	 * Método genérico para hacer peticiones HTTP
	 * @param {string} endpoint - Endpoint de la API
	 * @param {Object} options - Opciones de fetch
	 * @param {string} baseURL - URL base a usar (por defecto ADMIN_API)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async request(endpoint, options = {}, baseURL = this.adminBaseURL) {
		const url = `${baseURL}${endpoint}`;
		let token = get(authToken) || authToken.getToken();

		const config = {
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		};

		// Agregar token de autorización si existe
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		try {
			let response = await fetch(url, config);

			// Intercept 401 errors for token refresh
			// Intercept 401 errors for token refresh
			if (response.status === 401) {
				// Avoid infinite loops if the refresh endpoint itself returns 401
				if (endpoint.includes('/auth/refresh')) {
					throw new Error('Refresh token expired');
				}

				try {
					const refreshResponse = await this.refreshSession();

					if (refreshResponse) {
						// Update token for the retry
						token = refreshResponse.access_token;
						config.headers.Authorization = `Bearer ${token}`;

						// Retry original request
						response = await fetch(url, config);
					}
				} catch (refreshError) {
					// If refresh fails completely
					user.logout();
					if (typeof window !== 'undefined') {
						window.location.href = '/login';
					}
					throw refreshError;
				}
			}

			// Si la respuesta no es OK (y no fue 401 o falló el refresh), lanzar error
			if (!response.ok) {
				let errorMessage = `HTTP error! status: ${response.status}`;
				let errorDetail = null;

				try {
					const errorData = await response.json();
					errorDetail = errorData.detail || errorData.message || null;
					if (errorDetail) {
						errorMessage = errorDetail;
					}
				} catch (e) {
					// Si no se puede parsear el error, usar el mensaje por defecto
				}

				// Crear error con información del status code
				const error = new Error(errorMessage);
				error.status = response.status;
				error.statusText = response.statusText;
				error.detail = errorDetail;
				throw error;
			}

			return await response.json();
		} catch (error) {
			console.error('API request failed:', error);
			throw error;
		}
	}

	// ============================================
	// MÉTODOS DE AUTENTICACIÓN (SISCOM-ADMIN-API)
	// ============================================

	/**
	 * Refrescar la sesión actual
	 * POST /api/v1/auth/refresh
	 * @returns {Promise<Object>} Nuevos tokens
	 */
	async refreshSession() {
		const refreshToken = authToken.getRefreshToken();
		const currentUser = get(user);
		const email = currentUser?.email;

		if (!refreshToken || !email) {
			throw new Error('No refresh token or email available');
		}

		try {
			const response = await fetch(`${this.adminBaseURL}/api/v1/auth/refresh`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: email,
					refresh_token: refreshToken
				})
			});

			if (!response.ok) {
				throw new Error('Failed to refresh token');
			}

			const data = await response.json();
			authToken.setTokens(data);
			return data;
		} catch (error) {
			console.error('Session refresh failed:', error);
			authToken.clearToken();
			user.logout();
			throw error;
		}
	}

	/**
	 * Iniciar sesión
	 * POST /api/v1/auth/login
	 * @param {Object} credentials - {email, password}
	 * @returns {Promise<Object>} Tokens y datos del usuario
	 */
	async login(credentials) {
		const { email, password } = credentials;
		return this.request('/api/v1/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password })
		});
	}

	/**
	 * Cerrar sesión
	 * POST /api/v1/auth/logout
	 * @returns {Promise<Object>} Mensaje de confirmación
	 */
	async logout() {
		return this.request('/api/v1/auth/logout', {
			method: 'POST'
		});
	}

	/**
	 * Solicitar código de recuperación de contraseña
	 * POST /api/v1/auth/forgot-password
	 * @param {string} email - Email del usuario
	 * @returns {Promise<Object>} Mensaje de confirmación
	 */
	async forgotPassword(email) {
		return this.request('/api/v1/auth/forgot-password', {
			method: 'POST',
			body: JSON.stringify({ email })
		});
	}

	/**
	 * Restablecer contraseña con código
	 * POST /api/v1/auth/reset-password
	 * @param {Object} data - {email, code, new_password}
	 * @returns {Promise<Object>} Mensaje de confirmación
	 */
	async resetPassword(data) {
		return this.request('/api/v1/auth/reset-password', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Cambiar contraseña (usuario autenticado)
	 * PATCH /api/v1/auth/password
	 * @param {Object} data - {old_password, new_password}
	 * @returns {Promise<Object>} Mensaje de confirmación
	 */
	async changePassword(data) {
		return this.request('/api/v1/auth/password', {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	// ============================================
	// MÉTODOS DE USUARIOS (SISCOM-ADMIN-API)
	// ============================================

	/**
	 * Obtener datos del usuario actual
	 * GET /api/v1/users/me
	 * @returns {Promise<Object>} Datos del usuario
	 */
	async getCurrentUser() {
		return this.request('/api/v1/users/me', {
			method: 'GET'
		});
	}

	/**
	 * Listar todos los usuarios del cliente
	 * GET /api/v1/users/
	 * @returns {Promise<Array>} Lista de usuarios
	 */
	async getUsers() {
		return this.request('/api/v1/users', {
			method: 'GET'
		});
	}

	/**
	 * Invitar un nuevo usuario (solo maestros)
	 * POST /api/v1/users/invite
	 * @param {Object} data - {email, full_name}
	 * @returns {Promise<Object>} Confirmación de invitación
	 */
	async inviteUser(data) {
		return this.request('/api/v1/users/invite', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Reenviar invitación a un usuario
	 * POST /api/v1/users/resend-invitation
	 * @param {Object} data - {email}
	 * @returns {Promise<Object>} Confirmación de reenvío
	 */
	async resendInvitation(data) {
		return this.request('/api/v1/users/resend-invitation', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	// ============================================
	// MÉTODOS DE CLIENTES (SISCOM-ADMIN-API)
	// ============================================

	/**
	 * Crear un nuevo cliente (registro público)
	 * POST /api/v1/clients/
	 * @param {Object} data - {name, email, password}
	 * @returns {Promise<Object>} Datos del cliente creado
	 */
	async createClient(data) {
		return this.request('/api/v1/clients', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Obtener datos del cliente actual
	 * GET /api/v1/clients/
	 * @returns {Promise<Object>} Datos del cliente
	 */
	async getCurrentClient() {
		return this.request('/api/v1/clients', {
			method: 'GET'
		});
	}

	// ============================================
	// MÉTODOS GENÉRICOS HTTP
	// ============================================

	/**
	 * Petición GET genérica
	 * @param {string} endpoint - Endpoint de la API
	 * @param {string} baseURL - URL base (opcional)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async get(endpoint, baseURL = this.adminBaseURL) {
		return this.request(endpoint, { method: 'GET' }, baseURL);
	}

	/**
	 * Petición POST genérica
	 * @param {string} endpoint - Endpoint de la API
	 * @param {Object} data - Datos a enviar
	 * @param {string} baseURL - URL base (opcional)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async post(endpoint, data, baseURL = this.adminBaseURL) {
		return this.request(
			endpoint,
			{
				method: 'POST',
				body: JSON.stringify(data)
			},
			baseURL
		);
	}

	/**
	 * Petición PUT genérica
	 * @param {string} endpoint - Endpoint de la API
	 * @param {Object} data - Datos a enviar
	 * @param {string} baseURL - URL base (opcional)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async put(endpoint, data, baseURL = this.adminBaseURL) {
		return this.request(
			endpoint,
			{
				method: 'PUT',
				body: JSON.stringify(data)
			},
			baseURL
		);
	}

	/**
	 * Petición PATCH genérica
	 * @param {string} endpoint - Endpoint de la API
	 * @param {Object} data - Datos a enviar
	 * @param {string} baseURL - URL base (opcional)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async patch(endpoint, data, baseURL = this.adminBaseURL) {
		return this.request(
			endpoint,
			{
				method: 'PATCH',
				body: JSON.stringify(data)
			},
			baseURL
		);
	}

	/**
	 * Petición DELETE genérica
	 * @param {string} endpoint - Endpoint de la API
	 * @param {string} baseURL - URL base (opcional)
	 * @returns {Promise<Object>} Respuesta de la API
	 */
	async delete(endpoint, baseURL = this.adminBaseURL) {
		return this.request(endpoint, { method: 'DELETE' }, baseURL);
	}

	// ============================================
	// MÉTODOS DE DISPOSITIVOS (SISCOM-ADMIN-API)
	// ============================================

	/**
	 * Obtener dispositivos del cliente actual
	 * GET /api/v1/devices/my-devices
	 * @param {string} status_filter - Filtro opcional por estado
	 * @returns {Promise<Array>} Lista de dispositivos del cliente
	 */
	async getMyDevices(status_filter = null) {
		let endpoint = '/api/v1/devices/my-devices';
		if (status_filter) {
			endpoint += `?status_filter=${encodeURIComponent(status_filter)}`;
		}
		return this.request(endpoint, {
			method: 'GET'
		});
	}

	// ============================================
	// MÉTODOS DE UNIDADES (SISCOM-ADMIN-API)
	// ============================================

	/**
	 * Listar unidades del cliente
	 * GET /api/v1/units/
	 * @param {boolean} include_deleted - Incluir unidades eliminadas (solo maestros)
	 * @returns {Promise<Array>} Lista de unidades
	 */
	async getUnits(include_deleted = false) {
		let endpoint = '/api/v1/units';
		if (include_deleted) {
			endpoint += '?include_deleted=true';
		}
		return this.request(endpoint, {
			method: 'GET'
		});
	}

	/**
	 * Crear una nueva unidad
	 * POST /api/v1/units/
	 * @param {Object} data - {name, description}
	 * @returns {Promise<Object>} Unidad creada
	 */
	async createUnit(data) {
		return this.request('/api/v1/units', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Actualizar una unidad
	 * PATCH /api/v1/units/{unit_id}
	 * @param {string} unit_id - ID de la unidad
	 * @param {Object} data - {name, description}
	 * @returns {Promise<Object>} Unidad actualizada
	 */
	async updateUnit(unit_id, data) {
		return this.request(`/api/v1/units/${unit_id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Eliminar una unidad
	 * DELETE /api/v1/units/{unit_id}
	 * @param {string} unit_id - ID de la unidad
	 * @returns {Promise<Object>} Confirmación de eliminación
	 */
	async deleteUnit(unit_id) {
		return this.request(`/api/v1/units/${unit_id}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Obtener el perfil completo de una unidad
	 * GET /api/v1/units/{unit_id}/profile
	 * @param {string} unit_id - ID de la unidad
	 * @returns {Promise<Object>} Perfil de la unidad
	 */
	async getUnitProfile(unit_id) {
		return this.request(`/api/v1/units/${unit_id}/profile`, {
			method: 'GET'
		});
	}

	/**
	 * Actualizar el perfil de una unidad
	 * PATCH /api/v1/units/{unit_id}/profile
	 * @param {string} unit_id - ID de la unidad
	 * @param {Object} data - Datos a actualizar
	 * @returns {Promise<Object>} Perfil actualizado
	 */
	async updateUnitProfile(unit_id, data) {
		return this.request(`/api/v1/units/${unit_id}/profile`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	/**
	 * Obtener dispositivos no asignados del cliente
	 * GET /api/v1/devices/unassigned
	 * @returns {Promise<Array>} Lista de dispositivos sin asignar
	 */
	async getUnassignedDevices() {
		return this.request('/api/v1/devices/unassigned', {
			method: 'GET'
		});
	}

	/**
	 * Asignar dispositivo a una unidad
	 * POST /api/v1/units/{unit_id}/device
	 * @param {string} unit_id - ID de la unidad
	 * @param {string} device_id - ID del dispositivo
	 * @returns {Promise<Object>} Confirmación de asignación
	 */
	async assignDeviceToUnit(unit_id, device_id) {
		return this.request(`/api/v1/units/${unit_id}/device`, {
			method: 'POST',
			body: JSON.stringify({ device_id })
		});
	}

	/**
	 * Desasignar dispositivo de una unidad
	 * DELETE /api/v1/user-units/{assignment_id}
	 * @param {string} assignment_id - ID de la asignación
	 * @returns {Promise<Object>} Confirmación de desasignación
	 */
	async unassignDeviceFromUnit(assignment_id) {
		return this.request(`/api/v1/user-units/${assignment_id}`, {
			method: 'DELETE'
		});
	}
	/**
	 * Obtener unidades asignadas al usuario
	 * GET /api/v1/user-units/
	 * @returns {Promise<Array>} Lista de unidades asignadas
	 */
	async getUserUnits() {
		return this.request('/api/v1/units?include_deleted=false', {
			method: 'GET'
		});
	}
}

export const apiService = new ApiService();
