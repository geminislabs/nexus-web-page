/** @param {string} code */
export function formatEventType(code) {
	if (!code) return 'Evento';
	return code
		.replace(/_/g, ' ')
		.split(' ')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/** @param {string} code */
export function eventIcon(code) {
	switch ((code || '').toLowerCase()) {
		case 'ignition_on':
			return 'mdi:key';
		case 'ignition_off':
			return 'mdi:power';
		case 'speed_alert':
			return 'mdi:speedometer';
		case 'gps_signal_lost':
			return 'mdi:crosshairs-gps';
		case 'panic_button':
			return 'mdi:alert';
		case 'door_open':
			return 'mdi:door-open';
		case 'battery_low':
			return 'mdi:battery-alert';
		default:
			return 'mdi:bell-outline';
	}
}

/** @param {string} code */
export function eventColorClass(code) {
	switch ((code || '').toLowerCase()) {
		case 'ignition_on':
			return 'text-emerald-400 bg-emerald-400/15 border-emerald-400/40';
		case 'ignition_off':
			return 'text-slate-400 bg-slate-400/15 border-slate-400/40';
		case 'speed_alert':
			return 'text-amber-400 bg-amber-400/15 border-amber-400/40';
		case 'gps_signal_lost':
		case 'panic_button':
			return 'text-red-400 bg-red-400/15 border-red-400/40';
		case 'door_open':
			return 'text-yellow-400 bg-yellow-400/15 border-yellow-400/40';
		case 'battery_low':
			return 'text-amber-400 bg-amber-400/15 border-amber-400/40';
		default:
			return 'text-blue-400 bg-blue-400/15 border-blue-400/40';
	}
}

/** @param {string} iso */
export function formatEventDate(iso) {
	if (!iso) return '--';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const diffMs = Math.abs(Date.now() - d.getTime());
	if (diffMs < 86400000) {
		const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
		const mins = Math.round((d.getTime() - Date.now()) / 60000);
		if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
		const hours = Math.round(mins / 60);
		return rtf.format(hours, 'hour');
	}
	return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

/** @param {Record<string, unknown>} raw */
export function normalizeEvent(raw) {
	const eventType = raw.event_type || raw.code || raw.eventType || 'unknown';
	const sourceId = String(raw.source_id || raw.sourceId || '');
	const sourceEpoch = raw.source_epoch ?? raw.sourceEpoch ?? 0;
	const unitId = String(raw.unit_id || raw.unitId || '');
	return {
		id: `${sourceId}_${sourceEpoch}_${eventType}`,
		unitId,
		sourceId,
		eventType: String(eventType),
		occurredAt: raw.occurred_at || raw.occurredAt,
		receivedAt: raw.received_at || raw.receivedAt,
		sourceEpoch: Number(sourceEpoch)
	};
}
