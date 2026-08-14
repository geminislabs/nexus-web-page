import { logger } from '$lib/utils/logger.js';
import { authToken } from '$lib/stores/auth.js';
/**
 * Cliente WebSocket para posiciones en vivo (siscom-api /api/v1/stream).
 * La base WS se deriva de VITE_COMM_API_URL (http→ws, https→wss), igual que positionService.
 * Requiere sesión local; el backend debe exigir auth en /stream (pendiente en API).
 */

const STREAM_PATH = '/api/v1/stream';

const COMM_API_URL = import.meta.env?.VITE_COMM_API_URL || '';

/**
 * @param {string} urlStr
 * @returns {string}
 */
export function httpUrlToWebSocketUrl(urlStr) {
	if (urlStr.startsWith('ws://') || urlStr.startsWith('wss://')) {
		return urlStr;
	}

	try {
		const url = new URL(urlStr);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		return url.toString();
	} catch {
		return urlStr.replace(/^http/, 'ws');
	}
}

function streamBaseUrl() {
	const raw = String(COMM_API_URL ?? '').trim();
	if (!raw) return '';
	return httpUrlToWebSocketUrl(raw).replace(/\/$/, '');
}

export function extraStreamDeviceIds() {
	const raw = import.meta.env.VITE_POSITION_STREAM_EXTRA_DEVICE_IDS;
	if (raw == null || typeof raw !== 'string') return [];
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isPositionStreamEnabled() {
	return Boolean(streamBaseUrl());
}

/**
 * Interpreta mensajes del stream siscom-api: { event, data }.
 * @param {unknown} parsed
 * @returns {{ deviceId: string, latitude: number, longitude: number, speed?: number } | null}
 */
export function parsePositionStreamMessage(parsed) {
	if (!parsed || typeof parsed !== 'object') return null;
	const event = /** @type {{ event?: string; data?: unknown }} */ (parsed).event;
	if (event === 'ping') return null;
	if (event === 'error') return null;
	if (event !== 'message') return null;

	const envelope = /** @type {{ event?: string; data?: Record<string, unknown> }} */ (parsed).data;
	if (!envelope || typeof envelope !== 'object') return null;

	/** Kafka positions: { data: { device_id, latitude, ... } } */
	const inner =
		envelope.data && typeof envelope.data === 'object'
			? /** @type {Record<string, unknown>} */ (envelope.data)
			: envelope;

	const deviceId = pickDeviceId(inner, envelope);
	if (!deviceId) return null;

	const lat = pickNumber(inner, envelope, ['latitude', 'LAT', 'lat']);
	const lng = pickNumber(inner, envelope, ['longitude', 'LON', 'lng', 'lon']);
	if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

	let speed;
	for (const k of ['speed', 'SPEED']) {
		const v = inner[k] ?? envelope[k];
		if (v != null && v !== '') {
			const n = Number(v);
			if (!Number.isNaN(n)) {
				speed = n;
				break;
			}
		}
	}

	return {
		deviceId: String(deviceId),
		latitude: lat,
		longitude: lng,
		...(speed != null ? { speed } : {})
	};
}

/**
 * @param {Record<string, unknown>} inner
 * @param {Record<string, unknown>} envelope
 */
function pickDeviceId(inner, envelope) {
	const a = inner.device_id ?? inner.DEVICE_ID;
	if (a != null && String(a) !== '') return String(a);
	const b = envelope.device_id ?? envelope.DEVICE_ID;
	if (b != null && String(b) !== '') return String(b);
	return null;
}

/**
 * @param {Record<string, unknown>} inner
 * @param {Record<string, unknown>} envelope
 * @param {string[]} keys
 */
function pickNumber(inner, envelope, keys) {
	for (const k of keys) {
		const v = inner[k] ?? envelope[k];
		if (v != null && v !== '') {
			const n = Number(v);
			if (!Number.isNaN(n)) return n;
		}
	}
	return null;
}

/**
 * @param {string[]} deviceIds
 * @param {(payload: { deviceId: string; latitude: number; longitude: number; speed?: number }) => void} onPosition
 * @returns {() => void}
 */
export function startVehiclePositionStream(deviceIds, onPosition) {
	const base = streamBaseUrl();
	if (!base || typeof WebSocket === 'undefined') {
		return () => {};
	}

	if (!authToken.getToken?.()) {
		logger.warn({
			code: 'WS_STREAM_AUTH_REQUIRED',
			message: 'Refusing position stream without session'
		});
		return () => {};
	}

	const unique = [...new Set(deviceIds.map((id) => String(id).trim()).filter(Boolean))];
	if (unique.length === 0) {
		return () => {};
	}

	let ws = /** @type {WebSocket | null} */ (null);
	let stopped = false;
	let reconnectTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
	const reconnectDelayMs = 3200;

	const url = `${base}${STREAM_PATH}?device_ids=${encodeURIComponent(unique.join(','))}`;

	const connect = () => {
		if (stopped) return;
		if (!authToken.getToken?.()) {
			stopped = true;
			return;
		}
		try {
			ws = new WebSocket(url);
		} catch (e) {
			logger.warn({
				code: 'WS_STREAM_CONNECT_FAILED',
				message: 'WebSocket connect failed',
				err: e
			});
			scheduleReconnect();
			return;
		}

		ws.onmessage = (ev) => {
			try {
				const parsed = JSON.parse(ev.data);
				const pos = parsePositionStreamMessage(parsed);
				if (pos) onPosition(pos);
			} catch (e) {
				logger.warn({
					code: 'WS_STREAM_PARSE_FAILED',
					message: 'Invalid position stream message',
					err: e
				});
			}
		};

		ws.onerror = () => {
			try {
				ws?.close();
			} catch {
				/* noop */
			}
		};

		ws.onclose = () => {
			ws = null;
			if (!stopped) scheduleReconnect();
		};
	};

	function scheduleReconnect() {
		if (stopped || reconnectTimer != null) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (!stopped) connect();
		}, reconnectDelayMs);
	}

	connect();

	return () => {
		stopped = true;
		if (reconnectTimer != null) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		try {
			ws?.close();
		} catch {
			/* noop */
		}
		ws = null;
	};
}
