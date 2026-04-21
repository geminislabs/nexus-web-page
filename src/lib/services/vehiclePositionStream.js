/**
 * Cliente WebSocket para posiciones en vivo (siscom-api /api/v1/stream).
 * Requiere VITE_POSITION_STREAM_WS_BASE (ej. ws://localhost:8000).
 */

const STREAM_PATH = '/api/v1/stream';

function streamBaseUrl() {
	const raw = import.meta.env.VITE_POSITION_STREAM_WS_BASE;
	if (raw == null || String(raw).trim() === '') return '';
	return String(raw).trim().replace(/\/$/, '');
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
		try {
			ws = new WebSocket(url);
		} catch (e) {
			console.warn('[position-stream] WebSocket:', e);
			scheduleReconnect();
			return;
		}

		ws.onmessage = (ev) => {
			try {
				const parsed = JSON.parse(ev.data);
				const pos = parsePositionStreamMessage(parsed);
				if (pos) onPosition(pos);
			} catch (e) {
				console.warn('[position-stream] Mensaje inválido:', e);
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
