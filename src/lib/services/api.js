import { authToken } from '../stores/auth.js';
import { user } from '../stores/auth.js';
import { get } from 'svelte/store';
import { ApiError, apiErrorFromResponse } from './apiErrors.js';
import { withQuery } from './apiQuery.js';

export { ApiError } from './apiErrors.js';

function normalizeApiBaseUrl(raw) {
	const trimmed = raw == null ? '' : String(raw).trim().replace(/\/$/, '');
	if (!trimmed) return 'http://localhost:8100/api/v1';
	if (trimmed.endsWith('/api/v1')) return trimmed;
	return `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(
	import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_ADMIN_API_URL
);

/** Endpoints que no deben disparar refresh automático en 401. */
const AUTH_NO_RETRY_PATHS = new Set([
	'/auth/login',
	'/auth/register',
	'/auth/refresh',
	'/auth/forgot-password',
	'/auth/reset-password'
]);

class ApiService {
	constructor() {
		this.baseURL = API_BASE_URL.replace(/\/$/, '');
		/** @type {Promise<void> | null} */
		this._refreshPromise = null;
	}

	// ── Core HTTP ─────────────────────────────────────────────────────────────

	/**
	 * Petición autenticada con reintento único tras refresh en 401.
	 * @param {string} endpoint Path relativo (ej. `/units`) — sin duplicar `/api/v1`.
	 * @param {RequestInit & { skipAuth?: boolean, skipRefreshRetry?: boolean }} [options]
	 */
	async request(endpoint, options = {}) {
		return this._request(endpoint, { ...options, _isRetry: false });
	}

	/**
	 * @param {string} endpoint
	 * @param {RequestInit & { skipAuth?: boolean, skipRefreshRetry?: boolean, _isRetry?: boolean }} options
	 */
	async _request(endpoint, options = {}) {
		const path = this._normalizePath(endpoint);
		const response = await this._fetch(path, options);

		if (
			response.status === 401 &&
			!options.skipAuth &&
			!options.skipRefreshRetry &&
			!options._isRetry &&
			!AUTH_NO_RETRY_PATHS.has(path.split('?')[0])
		) {
			try {
				await this._refreshSessionOnce();
				return this._request(endpoint, { ...options, _isRetry: true });
			} catch (refreshErr) {
				console.error('Token refresh failed after 401:', refreshErr);
			}
		}

		return this._parseResponse(response);
	}

	/**
	 * Fetch sin lógica de refresh (usado por refresh mismo).
	 * @param {string} endpoint
	 * @param {RequestInit & { skipAuth?: boolean }} [options]
	 */
	async _rawRequest(endpoint, options = {}) {
		const path = this._normalizePath(endpoint);
		const response = await this._fetch(path, options);
		return this._parseResponse(response);
	}

	/** @param {string} endpoint */
	_normalizePath(endpoint) {
		if (!endpoint) return '/';
		if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
			const url = new URL(endpoint);
			if (url.origin + url.pathname === this.baseURL || endpoint.startsWith(this.baseURL)) {
				return url.pathname.slice(this.baseURL.length) + url.search;
			}
			return endpoint;
		}
		// Corrige rutas legacy que incluían `/api/v1` duplicado.
		const stripped = endpoint.replace(/^\/api\/v1/, '');
		return stripped.startsWith('/') ? stripped : `/${stripped}`;
	}

	/**
	 * @param {string} path
	 * @param {RequestInit & { skipAuth?: boolean }} options
	 */
	async _fetch(path, options = {}) {
		const url = `${this.baseURL}${path}`;
		const token = options.skipAuth ? null : authToken.getToken();

		/** @type {Record<string, string>} */
		const headers = {
			Accept: 'application/json',
			...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
			.../** @type {Record<string, string>} */ (options.headers)
		};

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const fetchOptions = { ...options };
		delete fetchOptions.skipAuth;
		delete fetchOptions.skipRefreshRetry;
		delete fetchOptions._isRetry;

		let response;
		try {
			response = await fetch(url, { ...fetchOptions, headers });
		} catch (err) {
			console.error('API request failed:', err);
			throw err instanceof ApiError
				? err
				: new ApiError(err instanceof Error ? err.message : 'Network request failed');
		}

		return response;
	}

	/** @param {Response} response */
	async _parseResponse(response) {
		if (response.status === 204) return null;

		const contentType = response.headers.get('content-type') || '';
		const isJson = contentType.includes('application/json');

		if (!response.ok) {
			throw await apiErrorFromResponse(response);
		}

		if (!isJson) {
			const text = await response.text();
			return text || null;
		}

		return response.json();
	}

	async _refreshSessionOnce() {
		if (!this._refreshPromise) {
			this._refreshPromise = this.refreshSession().finally(() => {
				this._refreshPromise = null;
			});
		}
		return this._refreshPromise;
	}

	// ── Auth ──────────────────────────────────────────────────────────────────

	async login(credentials) {
		return this._rawRequest('/auth/login', {
			method: 'POST',
			skipAuth: true,
			body: JSON.stringify(credentials)
		});
	}

	async register(userData) {
		return this._rawRequest('/auth/register', {
			method: 'POST',
			skipAuth: true,
			body: JSON.stringify(userData)
		});
	}

	async logout() {
		return this.request('/auth/logout', { method: 'POST' });
	}

	async verifyToken() {
		return this.request('/auth/verify', { method: 'GET' });
	}

	/**
	 * Renueva access/id token usando refresh_token + email (Cognito).
	 * Persiste tokens vía authToken.setSession().
	 */
	async refreshSession() {
		const refreshToken = authToken.getRefreshToken?.();
		const email = get(user)?.email;
		if (!refreshToken || !email) {
			throw new ApiError('No hay sesión renovable', { status: 401 });
		}

		const data = await this._rawRequest('/auth/refresh', {
			method: 'POST',
			skipAuth: true,
			body: JSON.stringify({ email, refresh_token: refreshToken })
		});

		authToken.setSession?.(data);
		return data;
	}

	/** @param {{ old_password: string, new_password: string }} payload */
	async changePassword(payload) {
		return this.request('/auth/password', {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
	}

	/** @param {string} email */
	async forgotPassword(email) {
		return this._rawRequest('/auth/forgot-password', {
			method: 'POST',
			skipAuth: true,
			body: JSON.stringify({ email })
		});
	}

	/** @param {{ email: string, code: string, new_password: string }} payload */
	async resetPassword(payload) {
		return this._rawRequest('/auth/reset-password', {
			method: 'POST',
			skipAuth: true,
			body: JSON.stringify(payload)
		});
	}

	// ── Usuario / usuarios ────────────────────────────────────────────────────

	async getCurrentUser() {
		return this.request('/users/me', { method: 'GET' });
	}

	async getUsers() {
		return this.request('/users', { method: 'GET' });
	}

	/** @param {{ email: string, full_name: string }} payload */
	async inviteUser(payload) {
		return this.request('/users/invite', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	}

	/** @param {{ email: string }} payload */
	async resendInvitation(payload) {
		return this.request('/users/resend-invitation', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	}

	// ── Unidades ──────────────────────────────────────────────────────────────

	async getVehicles() {
		return this.request('/units', { method: 'GET' });
	}

	/** Alias semántico usado por AdminPanel / AssignUnits. */
	async getUnits() {
		return this.getVehicles();
	}

	async getVehicle(vehicleId) {
		return this.request(`/units/${encodeURIComponent(vehicleId)}`, { method: 'GET' });
	}

	async createVehicle(data) {
		return this.request('/units', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	/** @param {{ name: string, description?: string }} data */
	async createUnit(data) {
		return this.createVehicle(data);
	}

	async updateVehicle(vehicleId, data) {
		return this.request(`/units/${encodeURIComponent(vehicleId)}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async deleteVehicle(vehicleId) {
		return this.request(`/units/${encodeURIComponent(vehicleId)}`, {
			method: 'DELETE'
		});
	}

	async getUnitProfile(unitId) {
		return this.request(`/units/${encodeURIComponent(unitId)}/profile`, { method: 'GET' });
	}

	async updateUnitProfile(unitId, data) {
		return this.request(`/units/${encodeURIComponent(unitId)}/profile`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async shareUnitLocation(unitId) {
		return this.request(`/units/${encodeURIComponent(unitId)}/share-location`, {
			method: 'POST'
		});
	}

	// Legacy — conservados por compatibilidad; pueden no existir en admin-api.
	async getVehicleLocation(vehicleId) {
		return this.request(`/vehicles/${encodeURIComponent(vehicleId)}/location`, { method: 'GET' });
	}

	async getVehicleStatus(vehicleId) {
		return this.request(`/vehicles/${encodeURIComponent(vehicleId)}/status`, { method: 'GET' });
	}

	// ── Dispositivos ──────────────────────────────────────────────────────────

	async getMyDevices() {
		return this.request('/devices/my-devices', { method: 'GET' });
	}

	async getUnassignedDevices() {
		return this.request('/devices/unassigned', { method: 'GET' });
	}

	// ── Asignación unit ↔ device ──────────────────────────────────────────────

	/**
	 * @param {string} unitId
	 * @param {string} deviceId
	 */
	async assignDeviceToUnit(unitId, deviceId) {
		return this.request('/unit-devices', {
			method: 'POST',
			body: JSON.stringify({ unit_id: unitId, device_id: deviceId })
		});
	}

	/** Asigna o reemplaza dispositivo (endpoint jerárquico, como móvil). */
	async assignUnitDevice(unitId, deviceId) {
		return this.request(`/units/${encodeURIComponent(unitId)}/device`, {
			method: 'POST',
			body: JSON.stringify({ device_id: deviceId })
		});
	}

	async getUnitAssignedDevice(unitId) {
		return this.request(`/units/${encodeURIComponent(unitId)}/device`, { method: 'GET' });
	}

	async unassignUnitDevice(unitId) {
		const assignments = await this.getUnitDevices({ active_only: true });
		const list = Array.isArray(assignments) ? assignments : [];
		const match = list.find((a) => String(a.unit_id) === String(unitId));
		if (!match?.id) {
			throw new ApiError('No hay dispositivo asignado a esta unidad');
		}
		return this.unassignDeviceFromUnit(match.id);
	}

	/** @param {string} assignmentId */
	async unassignDeviceFromUnit(assignmentId) {
		return this.request(`/unit-devices/${encodeURIComponent(assignmentId)}`, {
			method: 'DELETE'
		});
	}

	/** @param {{ active_only?: boolean }} [params] */
	async getUnitDevices(params = {}) {
		return this.request(withQuery('/unit-devices', params), { method: 'GET' });
	}

	// ── Asignación user ↔ unit ────────────────────────────────────────────────

	/** @param {string} userId */
	async getUserUnits(userId) {
		return this.request(withQuery('/user-units', { user_id: userId }), { method: 'GET' });
	}

	/** @param {{ user_id: string, unit_id: string, role?: string }} payload */
	async createUserUnit(payload) {
		return this.request('/user-units', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	}

	/** @param {string} assignmentId */
	async deleteUserUnit(assignmentId) {
		return this.request(`/user-units/${encodeURIComponent(assignmentId)}`, {
			method: 'DELETE'
		});
	}

	// ── Geocercas ─────────────────────────────────────────────────────────────

	async getGeofences() {
		return this.request('/geofences', { method: 'GET' });
	}

	async getGeofence(geofenceId) {
		return this.request(`/geofences/${encodeURIComponent(geofenceId)}`, { method: 'GET' });
	}

	async createGeofence(data) {
		return this.request('/geofences', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async updateGeofence(geofenceId, data) {
		return this.request(`/geofences/${encodeURIComponent(geofenceId)}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async toggleGeofenceActive(geofenceId, isActive) {
		return this.request(`/geofences/${encodeURIComponent(geofenceId)}`, {
			method: 'PATCH',
			body: JSON.stringify({ is_active: isActive })
		});
	}

	async deleteGeofence(geofenceId) {
		return this.request(`/geofences/${encodeURIComponent(geofenceId)}`, {
			method: 'DELETE'
		});
	}

	// ── Reglas de alerta ──────────────────────────────────────────────────────

	async getAlertRules() {
		return this.request('/alert_rules', { method: 'GET' });
	}

	async getAlertRule(ruleId) {
		return this.request(`/alert_rules/${encodeURIComponent(ruleId)}`, { method: 'GET' });
	}

	async createAlertRule(data) {
		return this.request('/alert_rules', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async updateAlertRule(ruleId, data) {
		return this.request(`/alert_rules/${encodeURIComponent(ruleId)}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async deleteAlertRule(ruleId) {
		return this.request(`/alert_rules/${encodeURIComponent(ruleId)}`, {
			method: 'DELETE'
		});
	}

	// ── Historial de alertas ───────────────────────────────────────────────────

	async getAlerts(params = {}) {
		return this.request(withQuery('/alerts', params), { method: 'GET' });
	}

	// ── Trayectos ─────────────────────────────────────────────────────────────

	/**
	 * @param {Record<string, unknown>} [params]
	 * unit_id, device_id, day, tz, start_date, end_date, limit, cursor, include_*
	 */
	async getTrips(params = {}) {
		return this.request(withQuery('/trips', params), { method: 'GET' });
	}

	/**
	 * @param {string} tripId
	 * @param {Record<string, unknown>} [params]
	 */
	async getTrip(tripId, params = {}) {
		return this.request(withQuery(`/trips/${encodeURIComponent(tripId)}`, params), {
			method: 'GET'
		});
	}

	// ── Telemetría ───────────────────────────────────────────────────────────

	/**
	 * @param {string} deviceId
	 * @param {Record<string, unknown>} [params]
	 */
	async getDeviceTelemetry(deviceId, params = {}) {
		return this.request(withQuery(`/devices/${encodeURIComponent(deviceId)}/telemetry`, params), {
			method: 'GET'
		});
	}

	/** @param {Record<string, unknown>} body */
	async queryTelemetry(body) {
		return this.request('/telemetry/query', {
			method: 'POST',
			body: JSON.stringify(body)
		});
	}

	// ── Atajos genéricos ──────────────────────────────────────────────────────

	async get(endpoint) {
		return this.request(endpoint, { method: 'GET' });
	}

	async post(endpoint, data) {
		return this.request(endpoint, {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async put(endpoint, data) {
		return this.request(endpoint, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
	}

	async delete(endpoint) {
		return this.request(endpoint, { method: 'DELETE' });
	}
}

export const apiService = new ApiService();
