/**
 * Servicio para consultar posiciones de vehículos desde la API de comunicaciones (SISCOM-API)
 */

import { vehicleActions } from '../stores/vehicleStore.js';
import { authToken } from '../stores/auth.js';
import { logger } from '$lib/utils/logger.js';

/** Fail-closed: sin VITE_COMM_API_URL no hay llamadas a hosts hardcodeados. */
const COMM_API_URL = String(import.meta.env?.VITE_COMM_API_URL ?? '')
	.trim()
	.replace(/\/$/, '');

function requireCommApiUrl() {
	if (!COMM_API_URL) {
		const err = new Error('VITE_COMM_API_URL is not configured');
		logger.error({
			code: 'COMM_API_URL_MISSING',
			message: 'Communications API base URL missing'
		});
		throw err;
	}
	return COMM_API_URL;
}

/** @returns {Record<string, string>} */
function authHeaders() {
	/** @type {Record<string, string>} */
	const headers = { Accept: 'application/json' };
	const token = authToken.getToken?.();
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

class PositionService {
	constructor() {
		this.cache = new Map();
		this.cacheTimeout = 30000; // 30 segundos
	}

	/**
	 * Obtiene las últimas comunicaciones por lista de device_ids
	 * @param {string[]} deviceIds - IDs de dispositivos
	 * @returns {Promise<Object>} Respuesta de comunicaciones
	 */
	async getLatestCommunications(deviceIds = []) {
		if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
			return { communications: [] };
		}
		const token = authToken.getToken?.();
		if (!token) {
			logger.warn({
				code: 'COMM_AUTH_REQUIRED',
				message: 'Refusing communications fetch without session'
			});
			return { communications: [] };
		}
		const base = requireCommApiUrl();
		const url = new URL('/api/v1/communications/latest', base);
		deviceIds.forEach((id) => url.searchParams.append('device_ids', String(id)));
		try {
			const res = await fetch(url.toString(), { method: 'GET', headers: authHeaders() });
			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			return await res.json();
		} catch (err) {
			logger.error({
				code: 'COMM_LATEST_FAILED',
				message: 'Error fetching latest communications',
				err,
				context: { deviceCount: deviceIds.length }
			});
			throw err;
		}
	}

	/**
	 * Obtiene la última posición de un dispositivo
	 * @param {string} deviceId - ID del dispositivo
	 * @returns {Promise<Object>} Datos de posición
	 */
	async getLastPosition(deviceId) {
		const results = await this.getMultiplePositions([deviceId]);
		const match = results.find((p) => String(p?.deviceId) === String(deviceId));
		if (!match) {
			throw new Error(`Sin posición para dispositivo ${deviceId}`);
		}
		return match;
	}

	/**
	 * Obtiene posiciones de múltiples dispositivos
	 * @param {string[]} deviceIds - Array de IDs de dispositivos
	 * @returns {Promise<Object[]>} Array de datos de posición
	 */
	async getMultiplePositions(deviceIds) {
		if (!Array.isArray(deviceIds) || deviceIds.length === 0) return [];

		try {
			const rawList = await this.getLatestCommunications(deviceIds);
			const list = Array.isArray(rawList) ? rawList : (rawList?.communications ?? []);

			return list
				.map((row) => {
					try {
						return this.normalizePositionData(row);
					} catch (e) {
						logger.warn({
							code: 'COMM_NORMALIZE_FAILED',
							message: 'Error normalizando posición',
							err: e
						});
						return null;
					}
				})
				.filter(Boolean);
		} catch (error) {
			logger.error({
				code: 'COMM_POSITIONS_FAILED',
				message: 'Error obteniendo posiciones',
				err: error
			});
			return [];
		}
	}

	/**
	 * Helper: extrae string de múltiples keys posibles (como Android/iOS)
	 */
	_str(obj, ...keys) {
		for (const k of keys) {
			const v = obj?.[k];
			if (v != null && v !== '') return String(v);
		}
		return null;
	}

	/**
	 * Helper: extrae number de múltiples keys posibles (como Android/iOS)
	 */
	_num(obj, ...keys) {
		for (const k of keys) {
			const v = obj?.[k];
			if (v == null) continue;
			const n = typeof v === 'number' ? v : parseFloat(v);
			if (!Number.isNaN(n)) return n;
		}
		return null;
	}

	/**
	 * Helper: extrae int de múltiples keys posibles (como Android/iOS)
	 */
	_int(obj, ...keys) {
		for (const k of keys) {
			const v = obj?.[k];
			if (v == null) continue;
			const n = typeof v === 'number' ? Math.floor(v) : parseInt(v, 10);
			if (!Number.isNaN(n)) return n;
		}
		return null;
	}

	/**
	 * Normaliza los datos de comunicación de la API (igual que CommunicationDTO en Android/iOS)
	 * @param {Object} rawData - Datos crudos de la API
	 * @returns {Object} Datos normalizados tipo CommunicationDTO
	 */
	normalizePositionData(rawData) {
		const attrs = rawData?.attributes || {};

		// Extraer campos exactamente como Android/iOS CommunicationDTO
		const deviceId = this._str(rawData, 'deviceId', 'device_id', 'DEVICE_ID') || '';
		const latitude = this._num(rawData, 'latitude', 'LATITUD') ?? 0;
		const longitude = this._num(rawData, 'longitude', 'LONGITUD') ?? 0;
		const gpsDatetime = this._str(rawData, 'gpsDatetime', 'gps_datetime', 'GPS_DATETIME');

		// mainBatteryVoltage: buscar en root y luego en attributes (igual que Android/iOS)
		let mainBatteryVoltage = this._num(
			rawData,
			'mainBatteryVoltage',
			'main_battery_voltage',
			'MAIN_VOLTAGE',
			'main_voltage',
			'battery_voltage',
			'battery'
		);
		if (mainBatteryVoltage == null) {
			mainBatteryVoltage = this._num(
				attrs,
				'main_battery_voltage',
				'MAIN_VOLTAGE',
				'main_voltage',
				'battery_voltage',
				'battery',
				'voltage',
				'io220',
				'power'
			);
		}

		// backupBatteryVoltage: buscar en root y luego en attributes
		let backupBatteryVoltage = this._num(
			rawData,
			'backupBatteryVoltage',
			'backup_battery_voltage',
			'BACKUP_VOLTAGE',
			'backup_voltage',
			'battery_level'
		);
		if (backupBatteryVoltage == null) {
			backupBatteryVoltage = this._num(
				attrs,
				'backup_battery_voltage',
				'BACKUP_VOLTAGE',
				'backup_voltage',
				'battery_level',
				'batteryLevel',
				'io219'
			);
		}

		const engineStatus = this._str(rawData, 'engineStatus', 'engine_status', 'ENGINE_STATUS');
		const fixStatus = this._str(rawData, 'fixStatus', 'fix_status', 'FIX_STATUS');
		// "stellites" es un typo conocido del firmware
		const satellites = this._int(rawData, 'satellites', 'stellites', 'SATELLITES');
		const rxLvl = this._int(rawData, 'rxLvl', 'rx_lvl', 'RX_LVL');
		const receivedAt = this._str(rawData, 'receivedAt', 'received_at');
		const deliveryType = this._str(rawData, 'deliveryType', 'delivery_type', 'DELIVERY_TYPE');
		const networkStatus = this._str(rawData, 'networkStatus', 'network_status', 'NETWORK_STATUS');
		const networkType = this._str(
			rawData,
			'networkType',
			'network_type',
			'NETWORK_TYPE',
			'RAT',
			'rat'
		);

		// lastUpdate: preferir gps_datetime, luego received_at, luego timelastposition
		const lastUpdate = gpsDatetime || receivedAt || rawData?.timelastposition || null;

		return {
			deviceId: String(deviceId),
			latitude,
			longitude,
			lastUpdate,
			altitude: parseFloat(rawData.altitude || 0),
			speed: parseFloat(rawData.speed || 0),
			battery: parseFloat(
				rawData.main_battery_voltage ?? rawData.backup_battery_voltage ?? rawData.battery ?? 0
			),
			status: engineStatus || 'Desconocido',
			isOnline: String(engineStatus ?? '').toUpperCase() === 'ON',
			lastUpdateFormatted: this.formatLastUpdate(lastUpdate),
			coordinates: { lat: latitude, lng: longitude },
			fixStatus,
			engineStatus,
			satellites,
			rxLvl,
			mainBatteryVoltage,
			backupBatteryVoltage,
			deliveryType,
			networkStatus,
			networkType
		};
	}

	/**
	 * Formatea la fecha de última actualización
	 * @param {string} dateString - Fecha en formato ISO
	 * @returns {string} Fecha formateada
	 */
	formatLastUpdate(dateString) {
		try {
			const date = new Date(dateString);
			const now = new Date();
			const diffInMinutes = Math.floor((now - date) / (1000 * 60));

			if (diffInMinutes < 1) {
				return 'Hace menos de 1 minuto';
			} else if (diffInMinutes < 60) {
				return `Hace ${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''}`;
			} else if (diffInMinutes < 1440) {
				const hours = Math.floor(diffInMinutes / 60);
				return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
			} else {
				const days = Math.floor(diffInMinutes / 1440);
				return `Hace ${days} día${days !== 1 ? 's' : ''}`;
			}
		} catch {
			return 'Fecha inválida';
		}
	}

	/**
	 * Normaliza los datos del stream de posición para el formato interno
	 * @param {Object} streamData - Datos crudos del stream
	 * @returns {Object} Datos normalizados
	 */
	normalizeStreamData(streamData) {
		// Extraer coordenadas - intentar múltiples fuentes
		let latitude = null;
		let longitude = null;

		// Intentar desde los campos principales primero
		if (streamData.LATITUD && streamData.LONGITUD) {
			latitude = parseFloat(streamData.LATITUD);
			longitude = parseFloat(streamData.LONGITUD);
		}
		// Si no están disponibles, intentar desde decoded
		else if (streamData.decoded?.QueclinkRaw?.LAT && streamData.decoded?.QueclinkRaw?.LON) {
			latitude = parseFloat(streamData.decoded.QueclinkRaw.LAT);
			longitude = parseFloat(streamData.decoded.QueclinkRaw.LON);
		}

		// Extraer otros datos importantes
		const deviceId = streamData.DEVICE_ID || streamData.decoded?.QueclinkRaw?.DEVICE_ID;
		const speed = streamData.SPEED
			? parseFloat(streamData.SPEED)
			: streamData.decoded?.QueclinkRaw?.SPD
				? parseFloat(streamData.decoded.QueclinkRaw.SPD)
				: 0;
		const odometer = streamData.ODOMETER
			? parseFloat(streamData.ODOMETER)
			: streamData.decoded?.QueclinkRaw?.KILOMETERS
				? parseFloat(streamData.decoded.QueclinkRaw.KILOMETERS)
				: 0;
		const altitude = streamData.ALTITUDE
			? parseFloat(streamData.ALTITUDE)
			: streamData.decoded?.QueclinkRaw?.ALTITUDE
				? parseFloat(streamData.decoded.QueclinkRaw.ALTITUDE)
				: 0;

		// Determinar el estado basado en si hay coordenadas válidas
		const status =
			latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude)
				? 'active'
				: 'inactive';

		return {
			deviceId,
			latitude,
			longitude,
			speed,
			altitude,
			odometer,
			status,
			// Datos adicionales para debugging
			rawLatitude: streamData.LATITUD || streamData.decoded?.QueclinkRaw?.LAT,
			rawLongitude: streamData.LONGITUD || streamData.decoded?.QueclinkRaw?.LON,
			fix: streamData.FIX_ || streamData.decoded?.QueclinkRaw?.FIX,
			course: streamData.COURSE || streamData.decoded?.QueclinkRaw?.CRS,
			// Campos críticos para lógica de animación/stop
			msg_class: streamData.MSG_CLASS || streamData.decoded?.QueclinkRaw?.MSG_CLASS,
			alert: streamData.ALERT || streamData.decoded?.QueclinkRaw?.ALERT,
			engine_status: streamData.ENGINE_STATUS || streamData.decoded?.QueclinkRaw?.ENGINE_STATUS
		};
	}

	/**
	 * Limpia el cache
	 */
	clearCache() {
		this.cache.clear();
	}

	/**
	 * Obtiene posiciones en tiempo real usando Server-Sent Events (SSE)
	 * @param {string[]} deviceIds - IDs de dispositivos a monitorear
	 * @param {Function} onUpdate - Callback para manejar actualizaciones de posición
	 * @param {Function} onError - Callback para manejar errores
	 * @returns {Object} Controlador para manejar la conexión
	 */
	/**
	 * Convierte una URL HTTP (http/https) a WebSocket (ws/wss)
	 * @param {string} urlStr - URL base
	 * @returns {string} URL de WebSocket
	 */
	_getWebSocketUrl(urlStr) {
		try {
			// Si ya empieza con ws, devolver tal cual
			if (urlStr.startsWith('ws://') || urlStr.startsWith('wss://')) {
				return urlStr;
			}

			const url = new URL(urlStr);
			if (url.protocol === 'https:') {
				url.protocol = 'wss:';
			} else {
				url.protocol = 'ws:';
			}
			return url.toString();
		} catch {
			// Fallback simple string replacement si URL falla
			return urlStr.replace(/^http/, 'ws');
		}
	}

	/**
	 * Obtiene posiciones en tiempo real usando WebSocket
	 * @param {string[]} deviceIds - IDs de dispositivos a monitorear
	 * @param {Function} onUpdate - Callback para manejar actualizaciones de posición
	 * @param {Function} onError - Callback para manejar errores
	 * @returns {Object} Controlador para manejar la conexión
	 */
	connectToRealtimeStream(deviceIds = [], onUpdate = null, onError = null) {
		if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
			logger.warn({
				code: 'WS_STREAM_NO_DEVICES',
				message: 'No device IDs provided for real-time streaming'
			});
			return null;
		}

		if (!authToken.getToken?.()) {
			logger.warn({
				code: 'WS_STREAM_AUTH_REQUIRED',
				message: 'Refusing private position stream without session'
			});
			return null;
		}

		let base;
		try {
			base = requireCommApiUrl();
		} catch {
			return null;
		}

		const deviceIdsParam = deviceIds.map((id) => encodeURIComponent(String(id))).join(',');
		const baseUrl = this._getWebSocketUrl(base);
		const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		// No poner access_token en query (aparecería en logs/Referer). El backend debe
		// exigir auth en /stream; el cliente solo abre stream con sesión local válida.
		const streamUrl = `${sanitizedBaseUrl}/api/v1/stream?device_ids=${deviceIdsParam}`;

		let websocket = null;
		let reconnectTimer = null;
		let isClosed = false;

		const connect = () => {
			if (isClosed) return;
			if (!authToken.getToken?.()) {
				isClosed = true;
				return;
			}

			try {
				websocket = new WebSocket(streamUrl);

				websocket.onopen = () => {};

				websocket.onmessage = (event) => {
					try {
						const rawData = JSON.parse(event.data);

						if (rawData.event === 'ping' || !rawData) {
							return;
						}

						let streamData = rawData;

						if (rawData.data && rawData.event === 'message') {
							streamData = rawData.data;
						} else if (rawData.data && !rawData.LAT && !rawData.LATITUD) {
							streamData = rawData.data;
						}

						const normalizedData = this.normalizeStreamData(streamData);

						if (
							normalizedData.deviceId &&
							normalizedData.latitude != null &&
							normalizedData.longitude != null
						) {
							vehicleActions.updateVehiclePosition(normalizedData.deviceId, {
								latitude: normalizedData.latitude,
								longitude: normalizedData.longitude,
								speed: normalizedData.speed || 0,
								altitude: normalizedData.altitude || 0,
								odometer: normalizedData.odometer || 0,
								lastUpdate: new Date().toISOString(),
								status: normalizedData.status || 'active',
								cellId: streamData.CELL_ID,
								lac: streamData.LAC,
								mcc: streamData.MCC,
								mnc: streamData.MNC,
								fix: streamData.FIX_,
								course: streamData.COURSE,
								msgCounter: streamData.MSG_COUNTER,
								rawData: streamData,
								msg_class: normalizedData.msg_class,
								alert: normalizedData.alert,
								engine_status: normalizedData.engine_status
							});
						}

						if (onUpdate && typeof onUpdate === 'function') {
							const dashboardData = {
								device_id: normalizedData.deviceId,
								latitude: normalizedData.latitude,
								longitude: normalizedData.longitude,
								speed: normalizedData.speed || 0,
								altitude: normalizedData.altitude || 0,
								gps_datetime: new Date().toISOString(),
								main_battery_voltage: 0,
								backup_battery_voltage: 0,
								status: normalizedData.status || 'active',
								heading: normalizedData.course,
								msg_class: normalizedData.msg_class,
								alert: normalizedData.alert,
								engine_status: normalizedData.engine_status
							};
							onUpdate(dashboardData);
						}
					} catch (parseError) {
						logger.error({
							code: 'WS_STREAM_PARSE_FAILED',
							message: 'Error parsing real-time data',
							err: parseError
						});
					}
				};

				websocket.onerror = (error) => {
					logger.error({
						code: 'WS_STREAM_ERROR',
						message: 'Real-time stream error',
						err: error
					});
					if (onError && typeof onError === 'function') {
						onError(error);
					}
				};

				websocket.onclose = (event) => {
					if (isClosed) return;

					logger.warn({
						code: 'WS_STREAM_DISCONNECT',
						message: 'Real-time stream disconnected, reconnecting',
						context: { status: event.code }
					});

					clearTimeout(reconnectTimer);
					reconnectTimer = setTimeout(() => {
						connect();
					}, 3000);
				};
			} catch (error) {
				logger.error({
					code: 'WS_STREAM_CONNECT_FAILED',
					message: 'Error creating WebSocket connection',
					err: error
				});
				if (onError && typeof onError === 'function') {
					onError(error);
				}
			}
		};

		// Iniciar conexión
		connect();

		return {
			close: () => {
				isClosed = true;
				clearTimeout(reconnectTimer);
				if (websocket) {
					websocket.close();
				}
			}
		};
	}
	/**
	 * Inicializar vista de ubicación compartida (Público)
	 * GET /public/share-location/init
	 * @param {string} token - Token de compartición
	 * @returns {Promise<Object>} Datos de la unidad y configuración
	 */
	async initShareLocation(token) {
		const base = requireCommApiUrl();
		try {
			const response = await fetch(
				`${base}/api/v1/public/share-location/init?token=${encodeURIComponent(token)}`,
				{
					method: 'GET',
					headers: {
						Accept: 'application/json'
					}
				}
			);

			if (!response.ok) {
				logger.error({
					code: 'SHARE_INIT_FAILED',
					message: 'Error initializing share location',
					context: { status: response.status }
				});
				throw new Error('No se pudo abrir el enlace de seguimiento.');
			}

			return await response.json();
		} catch (error) {
			logger.error({
				code: 'SHARE_INIT_FAILED',
				message: 'Error initializing share location',
				err: error
			});
			throw error;
		}
	}
	/**
	 * Conectar al stream de ubicación compartida (WebSocket)
	 * @param {string} token - Token de compartición
	 * @param {Function} onUpdate - Callback para actualizaciones de ubicación
	 * @param {Function} onError - Callback para errores
	 * @returns {Object} Controlador del stream { close: Function }
	 */
	connectToShareStream(token, onUpdate, onError) {
		let base;
		try {
			base = requireCommApiUrl();
		} catch (err) {
			if (onError) onError(err);
			return { close: () => {} };
		}

		const baseUrl = this._getWebSocketUrl(base);
		const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

		const streamUrl = `${sanitizedBaseUrl}/api/v1/public/share-location/stream?token=${encodeURIComponent(token)}`;

		let websocket = null;

		try {
			websocket = new WebSocket(streamUrl);

			websocket.onopen = () => {};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.event === 'message') {
						if (onUpdate) onUpdate(data.data);
					} else if (data.event === 'expired') {
						logger.warn({
							code: 'SHARE_TOKEN_EXPIRED',
							message: 'Share token expired'
						});
						websocket.close();
						if (onError) onError(new Error('El enlace ha expirado'));
					} else if (data.event === 'ping') {
						// Keep-alive, ignorar
					}
				} catch (e) {
					logger.error({
						code: 'SHARE_STREAM_PARSE_FAILED',
						message: 'Error parsing share stream data',
						err: e
					});
				}
			};

			websocket.onclose = (event) => {
				if (event.code === 1008) {
					if (onError) onError(new Error('Token inválido o expirado'));
				}
			};

			websocket.onerror = (err) => {
				logger.error({
					code: 'SHARE_STREAM_ERROR',
					message: 'Share stream error',
					err
				});
				if (onError) onError(err);
			};
		} catch (err) {
			logger.error({
				code: 'SHARE_STREAM_CONNECT_FAILED',
				message: 'Error creating share stream',
				err
			});
			if (onError) onError(err);
		}

		return {
			close: () => {
				if (websocket) {
					websocket.close();
				}
			}
		};
	}
}
export const positionService = new PositionService();
