/**
 * Servicio para consultar posiciones de vehículos desde la API de comunicaciones (SISCOM-API)
 */

import { vehicleActions } from '../stores/vehicleStore.js';

// URL base de la API de comunicaciones (SISCOM-API)
const COMM_API_URL = import.meta.env?.VITE_COMM_API_URL || 'http://34.237.30.30:8080';

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
		const url = new URL('/api/v1/communications/latest', COMM_API_URL);
		deviceIds.forEach((id) => url.searchParams.append('device_ids', id));
		try {
			const res = await fetch(url.toString(), { method: 'GET' });
			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			return await res.json();
		} catch (err) {
			console.error('Error fetching latest communications:', err);
			throw err;
		}
	}

	/**
	 * Obtiene la última posición de un dispositivo
	 * @param {string} deviceId - ID del dispositivo
	 * @returns {Promise<Object>} Datos de posición
	 */
	async getLastPosition(deviceId) {
		try {
			const cacheKey = `position_${deviceId}`;
			const cached = this.cache.get(cacheKey);

			// Verificar cache
			if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
				return cached.data;
			}

			const response = await fetch(
				`${COMM_API_URL}/api/v1/devices/${deviceId}/communications/latest`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Normalizar los datos
			const normalizedData = this.normalizePositionData(data);

			console.log('Normalized data:', normalizedData);

			// Guardar en cache
			this.cache.set(cacheKey, {
				data: normalizedData,
				timestamp: Date.now()
			});

			return normalizedData;
		} catch (error) {
			console.error(`Error obteniendo posición para dispositivo ${deviceId}:`, error);
			throw error;
		}
	}

	/**
	 * Obtiene posiciones de múltiples dispositivos
	 * @param {string[]} deviceIds - Array de IDs de dispositivos
	 * @returns {Promise<Object[]>} Array de datos de posición
	 */
	async getMultiplePositions(deviceIds) {
		const promises = deviceIds.map((deviceId) =>
			this.getLastPosition(deviceId).catch((error) => {
				console.warn(`Error obteniendo posición para ${deviceId}:`, error);
				return null;
			})
		);

		const results = await Promise.all(promises);
		return results.filter((result) => result !== null);
	}

	/**
	 * Normaliza los datos de posición de la API
	 * @param {Object} rawData - Datos crudos de la API
	 * @returns {Object} Datos normalizados
	 */
	normalizePositionData(rawData) {
		return {
			deviceId: rawData.deviceId,
			latitude: parseFloat(rawData.latitude),
			longitude: parseFloat(rawData.longitude),
			lastUpdate: rawData.timelastposition,
			altitude: parseFloat(rawData.altitude || 0),
			speed: parseFloat(rawData.speed || 0),
			battery: parseFloat(rawData.battery || 0),
			status: rawData.status || 'Desconocido',
			// Campos adicionales calculados
			isOnline: rawData.status !== 'Apagado',
			lastUpdateFormatted: this.formatLastUpdate(rawData.timelastposition),
			coordinates: {
				lat: parseFloat(rawData.latitude),
				lng: parseFloat(rawData.longitude)
			}
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
		} catch (error) {
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
			course: streamData.COURSE || streamData.decoded?.QueclinkRaw?.CRS
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
		} catch (e) {
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
			console.warn('No device IDs provided for real-time streaming');
			return null;
		}

		// Crear la URL para el streaming
		const deviceIdsParam = deviceIds.join(',');

		// Obtener base URL correcta para WebSocket
		const baseUrl = this._getWebSocketUrl(COMM_API_URL);
		// Eliminar trailing slash si existe para evitar doble slash
		const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		const streamUrl = `${sanitizedBaseUrl}/api/v1/stream?device_ids=${deviceIdsParam}`;

		console.warn('Connecting to real-time stream:', streamUrl);

		let websocket = null;
		let reconnectTimer = null;
		let isClosed = false;

		const connect = () => {
			if (isClosed) return;

			try {
				websocket = new WebSocket(streamUrl);

				websocket.onopen = () => {
					console.warn('Real-time stream connected successfully');
				};

				websocket.onmessage = (event) => {
					try {
						// El formato del mensaje puede variar, intentamos parsear
						const rawData = JSON.parse(event.data);
						console.warn('Real-time position update:', rawData);

						// Verificar si es un keep-alive o mensaje de control
						if (rawData.event === 'ping' || !rawData) {
							return;
						}

						// Extraer datos del stream
						// Según documentación, puede venir directo o envuelto
						// Intentamos detectar el formato
						let streamData = rawData;

						// Si tiene propiedad data y no es la data directa de rastreo (ej. { event: 'message', data: {...} })
						if (rawData.data && rawData.event === 'message') {
							streamData = rawData.data;
						} else if (rawData.data && !rawData.LAT && !rawData.LATITUD) {
							// Caso genérico wrapper { data: ... }
							streamData = rawData.data;
						}

						// Normalizar los datos para el formato esperado por el sistema
						const normalizedData = this.normalizeStreamData(streamData);

						// Actualizar posición en el store de vehículos
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
								// Datos adicionales del stream
								cellId: streamData.CELL_ID,
								lac: streamData.LAC,
								mcc: streamData.MCC,
								mnc: streamData.MNC,
								fix: streamData.FIX_,
								course: streamData.COURSE,
								msgCounter: streamData.MSG_COUNTER,
								rawData: streamData
							});
						}

						// Llamar al callback del dashboard si existe (para compatibilidad)
						if (onUpdate && typeof onUpdate === 'function') {
							// Crear objeto en formato esperado por el dashboard
							const dashboardData = {
								device_id: normalizedData.deviceId,
								latitude: normalizedData.latitude,
								longitude: normalizedData.longitude,
								speed: normalizedData.speed || 0,
								altitude: normalizedData.altitude || 0,
								gps_datetime: new Date().toISOString(),
								main_battery_voltage: 0, // No disponible en stream
								backup_battery_voltage: 0, // No disponible en stream
								status: normalizedData.status || 'active'
							};
							onUpdate(dashboardData);
						}
					} catch (parseError) {
						console.error('Error parsing real-time data:', parseError);
					}
				};

				websocket.onerror = (error) => {
					console.error('Real-time stream error:', error);
					if (onError && typeof onError === 'function') {
						onError(error);
					}
				};

				websocket.onclose = (event) => {
					if (isClosed) return;

					console.warn(
						`Real-time stream disconnected (code: ${event.code}), reconnecting in 3s...`
					);

					// Intentar reconexión básica
					clearTimeout(reconnectTimer);
					reconnectTimer = setTimeout(() => {
						connect();
					}, 3000);
				};
			} catch (error) {
				console.error('Error creating WebSocket connection:', error);
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
				console.warn('Real-time stream manually closed');
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
		try {
			const response = await fetch(
				`${COMM_API_URL}/api/v1/public/share-location/init?token=${encodeURIComponent(token)}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (!response.ok) {
				let errorDetail = null;
				try {
					const errorData = await response.json();
					errorDetail = errorData.detail;
				} catch (e) {
					// Ignore json parse error
				}

				console.error('Error initializing share location:', response.status, errorDetail);

				if (!errorDetail) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				throw new Error(errorDetail);
			}

			return await response.json();
		} catch (error) {
			console.error('Error initializing share location:', error);
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
		// Obtener base URL correcta para WebSocket
		const baseUrl = this._getWebSocketUrl(COMM_API_URL);
		// Eliminar trailing slash si existe
		const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

		const streamUrl = `${sanitizedBaseUrl}/api/v1/public/share-location/stream?token=${encodeURIComponent(token)}`;
		console.log('Connecting to share stream:', streamUrl);

		let websocket = null;

		try {
			websocket = new WebSocket(streamUrl);

			websocket.onopen = () => {
				console.log('Share stream connected');
			};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.event === 'message') {
						if (onUpdate) onUpdate(data.data);
					} else if (data.event === 'expired') {
						console.warn('Share token expired');
						websocket.close();
						if (onError) onError(new Error('El enlace ha expirado'));
					} else if (data.event === 'ping') {
						// Keep-alive, ignorar
						console.debug('Ping received');
					}
				} catch (e) {
					console.error('Error parsing share stream data:', e);
				}
			};

			websocket.onclose = (event) => {
				if (event.code === 1008) {
					console.log('🚫 Token inválido o expirado');
					if (onError) onError(new Error('Token inválido o expirado'));
				} else {
					console.log('Share stream closed');
				}
			};

			websocket.onerror = (err) => {
				console.error('Share stream error:', err);
				if (onError) onError(err);
			};
		} catch (err) {
			console.error('Error creating share stream:', err);
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

	_initEventSource(url, onUpdate, onError) {
		// Deprecated method, kept for reference or removal?
		// Removing content to avoid confusion as we fully switched to WebSocket
		console.warn(
			'_initEventSource is deprecated. Use connectToShareStream/connectToRealtimeStream with WebSocket.'
		);
	}
}
export const positionService = new PositionService();
