import { writable, derived, get } from 'svelte/store';
import { withZoneDbRow } from '$lib/utils/zoneDbMapper.js';
import { bypassAuthInDev } from '$lib/config/env.js';
import { apiService } from '$lib/services/api.js';

function cloneDeep(value) {
	return JSON.parse(JSON.stringify(value));
}

const INITIAL_MOCK_ALERTS = [
	{
		id: 'alert_mock_ign_on',
		type: 'ignition',
		condition: 'on',
		units: ['unit_001', 'unit_004'],
		zone: null,
		name: 'Ignición encendida - Operación',
		notificationMethod: 'push',
		notificationEvent: 'ignition_on',
		enabled: true,
		createdAt: '2026-04-10T08:12:00.000Z'
	},
	{
		id: 'alert_mock_zone_enter',
		type: 'zone',
		condition: 'enter',
		units: ['unit_002'],
		zone: 'zone_mock_deposito',
		name: 'Entrada a depósito central',
		notificationMethod: 'push',
		notificationEvent: 'geofence_entered',
		enabled: true,
		createdAt: '2026-04-10T08:18:00.000Z'
	}
];

const INITIAL_MOCK_ALARM_EVENTS = [
	{
		id: 'ev_mock_01',
		name: 'Ignición encendida',
		type: 'ignition',
		vehicle: 'Unidad 04',
		read: false,
		at: '2026-04-16T13:05:00.000Z'
	},
	{
		id: 'ev_mock_02',
		name: 'Entrada a depósito central',
		type: 'zone',
		vehicle: 'Unidad 02',
		read: false,
		at: '2026-04-16T12:47:00.000Z'
	},
	{
		id: 'ev_mock_03',
		name: 'Ignición apagada',
		type: 'ignition',
		vehicle: 'Unidad 01',
		read: true,
		at: '2026-04-16T11:54:00.000Z'
	}
];

export const alerts = writable([]);
export const alertWizard = writable(null);

export const alarmEvents = writable([]);

export const alertCount = derived(alerts, ($a) => $a.length);
export const unreadAlarmCount = derived(alarmEvents, ($e) => $e.filter((e) => !e.read).length);

export const zones = writable([]);
export const zoneCount = derived(zones, ($z) => $z.length);

export function normalizeZoneNameKey(name) {
	return String(name || '')
		.trim()
		.toLowerCase();
}

/** @param {string | null} [excludeId] */
export function isZoneNameTaken(name, excludeId = null) {
	const key = normalizeZoneNameKey(name);
	if (!key) return false;
	return get(zones).some(
		(z) => normalizeZoneNameKey(z.name) === key && (excludeId == null || z.id !== excludeId)
	);
}

function normalizeImportedZone(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const id = typeof raw.id === 'string' && raw.id ? raw.id : createId('zone');
	const name = typeof raw.name === 'string' ? raw.name : 'Zona';
	const cells = Array.isArray(raw.cells) ? raw.cells.filter((c) => typeof c === 'string') : [];
	const color = typeof raw.color === 'string' && raw.color ? raw.color : '#3B82F6';
	const createdAt =
		typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
	const metadata =
		raw.metadata && typeof raw.metadata === 'object'
			? {
					alertType:
						raw.metadata.alertType === 'outside' || raw.metadata.alertType === 'exit'
							? 'outside'
							: 'inside',
					status: raw.metadata.status === 'inactive' ? 'inactive' : 'active',
					...(raw.metadata.device_id ? { device_id: String(raw.metadata.device_id) } : {})
				}
			: { alertType: 'inside', status: 'active' };
	return withZoneDbRow({ id, name, cells, color, createdAt, metadata });
}

const INITIAL_WIZARD = {
	step: 1, // 1..5
	type: null, // 'ignition' | 'zone'
	condition: null, // 'on' | 'off' | 'enter' | 'exit'
	units: [], // vehicle ids
	zone: null, // zone id
	name: '',
	notificationMethod: 'push'
};

function createId(prefix = 'item') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function notificationEventFromWizard(w) {
	if (!w?.type || !w?.condition) return null;
	if (w.type === 'ignition') return w.condition === 'on' ? 'ignition_on' : 'ignition_off';
	return w.condition === 'enter' ? 'geofence_entered' : 'geofence_exited';
}

function h3HexToDecimalString(h3Hex) {
	try {
		return BigInt(`0x${String(h3Hex).toLowerCase()}`).toString(10);
	} catch {
		return null;
	}
}

function h3DecimalToHexString(value) {
	try {
		return BigInt(String(value)).toString(16).toLowerCase();
	} catch {
		return null;
	}
}

function mapGeofenceToZone(geofence) {
	const rawIndexes = Array.isArray(geofence?.h3_indexes) ? geofence.h3_indexes : [];
	const cells = rawIndexes.map(h3DecimalToHexString).filter((x) => typeof x === 'string' && x.length > 0);
	return withZoneDbRow({
		id: String(geofence?.id || createId('zone')),
		name: geofence?.name || 'Zona',
		cells,
		color: '#3B82F6',
		createdAt: geofence?.created_at || new Date().toISOString(),
		metadata: {
			alertType: geofence?.config?.alertType === 'outside' ? 'outside' : 'inside',
			status: geofence?.is_active === false ? 'inactive' : 'active',
			...(typeof geofence?.description === 'string' && geofence.description.trim()
				? { description: geofence.description.trim() }
				: {})
		}
	});
}

function inferConditionFromRule(ruleType, config) {
	const explicit = config?.condition;
	if (explicit === 'on' || explicit === 'off' || explicit === 'enter' || explicit === 'exit') {
		return explicit;
	}
	const ev = String(config?.notification_event || config?.notificationEvent || '').toLowerCase();
	if (ruleType === 'ignition') {
		return ev.includes('off') ? 'off' : 'on';
	}
	return ev.includes('exit') ? 'exit' : 'enter';
}

function mapRuleToAlert(rule) {
	const config = rule?.config && typeof rule.config === 'object' ? rule.config : {};
	const type = rule?.type === 'zone' ? 'zone' : 'ignition';
	return {
		id: String(rule?.id || createId('alert')),
		type,
		condition: inferConditionFromRule(type, config),
		units: Array.isArray(rule?.unit_ids) ? rule.unit_ids.map((id) => String(id)) : [],
		zone: config?.zone_id ? String(config.zone_id) : null,
		name: rule?.name || defaultAlertName({ type, condition: inferConditionFromRule(type, config) }),
		notificationMethod: config?.notification_method || config?.notificationMethod || 'push',
		notificationEvent: config?.notification_event || notificationEventFromWizard({ type, condition: inferConditionFromRule(type, config) }),
		enabled: rule?.is_active !== false,
		createdAt: rule?.created_at || new Date().toISOString()
	};
}

function mapAlarmEvent(alertEvent) {
	const payload = alertEvent?.payload && typeof alertEvent.payload === 'object' ? alertEvent.payload : {};
	const type = String(alertEvent?.type || payload?.type || 'alert').toLowerCase();
	const normalizedType = type.includes('ignition') ? 'ignition' : 'zone';
	return {
		id: String(alertEvent?.id || createId('ev')),
		name: payload?.message || payload?.name || alertEvent?.type || 'Alerta',
		type: normalizedType,
		vehicle: payload?.unit_name || payload?.vehicle_name || (alertEvent?.unit_id ? `Unidad ${String(alertEvent.unit_id).slice(0, 8)}` : 'Unidad'),
		read: false,
		at: alertEvent?.occurred_at || alertEvent?.created_at || new Date().toISOString()
	};
}

function logGeofenceGenerationPreview(zone) {
	if (!zone || typeof zone !== 'object') return;
	const geofenceRow = zone.dbRow && typeof zone.dbRow === 'object' ? zone.dbRow : null;
	if (!geofenceRow) return;

	const payload = {
		geofence_id: geofenceRow.geofence_id,
		device_id: geofenceRow.device_id,
		name: geofenceRow.name,
		type: geofenceRow.type,
		latitude: geofenceRow.latitude,
		longitude: geofenceRow.longitude,
		radius: geofenceRow.radius,
		status: geofenceRow.status
	};

	console.groupCollapsed('[ZONA->GEOFENCE] Vista previa de integración');
	console.log('Zona guardada en frontend:', zone);
	console.log('Fila compatible con public.geofences:', payload);
	console.log('Ejemplo PostgREST (insert):', {
		method: 'POST',
		url: 'http://localhost:4000/geofences',
		body: payload
	});
	console.log('Ejemplo estado inicial en geofence_states:', {
		method: 'POST',
		url: 'http://localhost:4000/geofence_states',
		body: {
			device_id: payload.device_id,
			geofence_id: payload.geofence_id,
			is_inside: false
		}
	});
	console.groupEnd();
}

export const alertActions = {
	// Wizard
	openWizard() {
		alertWizard.set({ ...INITIAL_WIZARD });
	},
	closeWizard() {
		alertWizard.set(null);
	},
	setWizardStep(step) {
		alertWizard.update((w) => (w ? { ...w, step } : null));
	},
	nextStep() {
		alertWizard.update((w) => (w ? { ...w, step: Math.min(w.step + 1, 5) } : null));
	},
	prevStep() {
		alertWizard.update((w) => (w ? { ...w, step: Math.max(w.step - 1, 1) } : null));
	},
	setType(type) {
		alertWizard.update((w) => (w ? { ...w, type } : null));
	},
	setCondition(condition) {
		alertWizard.update((w) => (w ? { ...w, condition } : null));
	},
	toggleUnit(id) {
		alertWizard.update((w) => {
			if (!w) return null;
			const units = w.units.includes(id) ? w.units.filter((u) => u !== id) : [...w.units, id];
			return { ...w, units };
		});
	},
	selectAllUnits(ids) {
		alertWizard.update((w) => (w ? { ...w, units: ids } : null));
	},
	setZone(zoneId) {
		alertWizard.update((w) => (w ? { ...w, zone: zoneId } : null));
	},
	setName(name) {
		alertWizard.update((w) => (w ? { ...w, name } : null));
	},
	async saveAlert() {
		const w = get(alertWizard);
		if (!w) return;

		const newAlert = {
			id: createId('alert'),
			type: w.type,
			condition: w.condition,
			units: w.units,
			zone: w.zone,
			name: w.name || defaultAlertName(w),
			notificationMethod: w.notificationMethod,
			notificationEvent: notificationEventFromWizard(w),
			enabled: true,
			createdAt: new Date().toISOString()
		};

		if (bypassAuthInDev) {
			alerts.update((list) => [...list, newAlert]);
			alertWizard.set(null);
			return;
		}

		const createdRule = await apiService.createAlertRule({
			name: newAlert.name,
			type: newAlert.type,
			config: {
				condition: newAlert.condition,
				notification_method: newAlert.notificationMethod,
				notification_event: newAlert.notificationEvent,
				...(newAlert.zone ? { zone_id: newAlert.zone } : {})
			},
			unit_ids: newAlert.units
		});
		const mapped = mapRuleToAlert(createdRule);
		alerts.update((list) => [...list, mapped]);
		alertWizard.set(null);
	},

	async deleteAlert(id) {
		if (!bypassAuthInDev) {
			await apiService.deleteAlertRule(id);
		}
		alerts.update((list) => list.filter((a) => a.id !== id));
	},
	async toggleAlert(id) {
		if (bypassAuthInDev) {
			alerts.update((list) => list.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
			return;
		}

		const current = get(alerts).find((a) => a.id === id);
		if (!current) return;

		// La API no expone "disable"; simulamos el apagado eliminando la regla.
		if (current.enabled) {
			await apiService.deleteAlertRule(id);
			alerts.update((list) => list.filter((a) => a.id !== id));
			return;
		}

		const recreated = await apiService.createAlertRule({
			name: current.name,
			type: current.type,
			config: {
				condition: current.condition,
				notification_method: current.notificationMethod || 'push',
				notification_event: current.notificationEvent || notificationEventFromWizard(current),
				...(current.zone ? { zone_id: current.zone } : {})
			},
			unit_ids: current.units
		});
		const mapped = mapRuleToAlert(recreated);
		alerts.update((list) => [...list.filter((a) => a.id !== id), mapped]);
	},

	/**
	 * @param {string} name
	 * @param {string[]} cells
	 * @param {string} [color]
	 * @param {{ description?: string }} [opts]
	 */
	async createZone(name, cells, color = '#3B82F6', opts = {}) {
		const description =
			typeof opts.description === 'string' ? opts.description.trim().slice(0, 2000) : '';
		const localZone = withZoneDbRow({
			id: createId('zone'),
			name,
			cells: Array.isArray(cells) ? cells : [],
			color,
			createdAt: new Date().toISOString(),
			metadata: {
				alertType: 'inside',
				status: 'active',
				...(description ? { description } : {})
			}
		});
		logGeofenceGenerationPreview(localZone);

		const shouldUseApi = !bypassAuthInDev;
		if (!shouldUseApi) {
			zones.update((list) => [...list, localZone]);
			return localZone.id;
		}

		const h3Indexes = (Array.isArray(cells) ? cells : [])
			.map(h3HexToDecimalString)
			.filter((v) => typeof v === 'string');

		const createdGeofence = await apiService.createGeofence({
			name,
			description: description || null,
			config: { alertType: 'inside' },
			h3_indexes: h3Indexes
		});

		const syncedZone = mapGeofenceToZone(createdGeofence);
		zones.update((list) => [...list, syncedZone]);
		return syncedZone.id;
	},
	async updateZone(id, patch) {
		const currentZone = get(zones).find((z) => z.id === id);
		if (!currentZone) return;

		const meta = {
			...(currentZone.metadata && typeof currentZone.metadata === 'object' ? currentZone.metadata : {}),
			...(patch.metadata && typeof patch.metadata === 'object' ? patch.metadata : {})
		};
		const nextLocal = withZoneDbRow({
			...currentZone,
			...patch,
			metadata: meta
		});

		const shouldUseApi = !bypassAuthInDev;
		if (!shouldUseApi) {
			zones.update((list) => list.map((z) => (z.id === id ? nextLocal : z)));
			return;
		}

		const updatedGeofence = await apiService.updateGeofence(id, {
			name: nextLocal.name,
			description: nextLocal.metadata?.description || null,
			config: { alertType: nextLocal.metadata?.alertType === 'outside' ? 'outside' : 'inside' },
			h3_indexes: nextLocal.cells.map(h3HexToDecimalString).filter((v) => typeof v === 'string')
		});
		const syncedZone = mapGeofenceToZone(updatedGeofence);
		zones.update((list) => list.map((z) => (z.id === id ? syncedZone : z)));
	},
	setZones(items) {
		if (!Array.isArray(items)) {
			zones.set([]);
			return;
		}
		const out = items.map((x) => normalizeImportedZone(x)).filter(Boolean);
		zones.set(/** @type {any[]} */ (out));
	},
	async deleteZone(id) {
		if (!bypassAuthInDev) {
			await apiService.deleteGeofence(id);
		}
		zones.update((list) => list.filter((z) => z.id !== id));
		// Remove from any alerts using this zone
		alerts.update((list) => list.map((a) => (a.zone === id ? { ...a, zone: null } : a)));
	},

	async syncZonesFromApi() {
		if (bypassAuthInDev) return;
		const geofences = await apiService.getGeofences();
		const mapped = Array.isArray(geofences) ? geofences.map(mapGeofenceToZone) : [];
		zones.set(mapped);
	},

	async syncAlertRulesFromApi() {
		if (bypassAuthInDev) {
			alerts.set(cloneDeep(INITIAL_MOCK_ALERTS));
			return;
		}
		const rules = await apiService.getAlertRules();
		const mapped = Array.isArray(rules) ? rules.map(mapRuleToAlert) : [];
		alerts.set(mapped);
	},

	async syncAlarmEventsFromApi() {
		if (bypassAuthInDev) {
			alarmEvents.set(cloneDeep(INITIAL_MOCK_ALARM_EVENTS));
			return;
		}
		const events = await apiService.getAlerts();
		const mapped = Array.isArray(events) ? events.map(mapAlarmEvent) : [];
		alarmEvents.set(mapped);
	},

	addAlarmEvent(event) {
		alarmEvents.update((list) => [
			{ ...event, id: createId('ev'), read: false, at: new Date().toISOString() },
			...list
		]);
	},
	deleteAlarmEvent(id) {
		alarmEvents.update((list) => list.filter((e) => e.id !== id));
	},
	markAllRead() {
		alarmEvents.update((list) => list.map((e) => ({ ...e, read: true })));
	},
	resetMockData() {
		alerts.set(cloneDeep(INITIAL_MOCK_ALERTS));
		alarmEvents.set(cloneDeep(INITIAL_MOCK_ALARM_EVENTS));
	}
};

function defaultAlertName(w) {
	if (w.type === 'ignition')
		return w.condition === 'on' ? 'Ignición encendida' : 'Ignición apagada';
	if (w.type === 'zone') return w.condition === 'enter' ? 'Entrada a zona' : 'Salida de zona';
	return 'Nueva alerta';
}
