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

			const response = await fetch(`${COMM_API_URL}/api/v1/positions?deviceId=${deviceId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Normalizar los datos
			const normalizedData = this.normalizePositionData(data);

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
	connectToRealtimeStream(deviceIds = [], onUpdate = null, onError = null) {
		if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
			console.warn('No device IDs provided for real-time streaming');
			return null;
		}

		// Crear la URL para el streaming
		const deviceIdsParam = deviceIds.join(',');
		const streamUrl = `${COMM_API_URL}/api/v1/stream?device_ids=${deviceIdsParam}`;

		console.warn('Connecting to real-time stream:', streamUrl);

		try {
			const eventSource = new EventSource(streamUrl, {
				withCredentials: false
			});

			// Manejar mensajes de actualización
			eventSource.onmessage = (event) => {
				try {
					const rawData = JSON.parse(event.data);
					console.warn('Real-time position update:', rawData);

					// Extraer datos del stream - la información está en la propiedad "data"
					const streamData = rawData?.data;
					if (!streamData) {
						console.warn('No data property found in stream message');
						return;
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

			// Manejar errores de conexión
			eventSource.onerror = (error) => {
				console.error('Real-time stream error:', error);

				if (onError && typeof onError === 'function') {
					onError(error);
				}
			};

			// Manejar conexión abierta
			eventSource.onopen = () => {
				console.warn('Real-time stream connected successfully');
			};

			return {
				eventSource,
				close: () => {
					eventSource.close();
					console.warn('Real-time stream disconnected');
				}
			};
		} catch (error) {
			console.error('Error creating EventSource connection:', error);
			if (onError && typeof onError === 'function') {
				onError(error);
			}
			return null;
		}
	}
}
export const positionService = new PositionService();
