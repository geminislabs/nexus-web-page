import { writable, derived } from 'svelte/store';

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

export const alerts = writable(cloneDeep(INITIAL_MOCK_ALERTS));
export const alertWizard = writable(null);

export const alarmEvents = writable(cloneDeep(INITIAL_MOCK_ALARM_EVENTS));

export const alertCount = derived(alerts, ($a) => $a.length);
export const unreadAlarmCount = derived(alarmEvents, ($e) => $e.filter((e) => !e.read).length);

export const zones = writable([]);
export const zoneCount = derived(zones, ($z) => $z.length);

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
	saveAlert() {
		alertWizard.update((w) => {
			if (!w) return null;
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
			alerts.update((list) => [...list, newAlert]);
			return null; // close wizard
		});
	},

	deleteAlert(id) {
		alerts.update((list) => list.filter((a) => a.id !== id));
	},
	toggleAlert(id) {
		alerts.update((list) => list.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
	},

	createZone(name, cells, color = '#3B82F6') {
		const zone = { id: createId('zone'), name, cells, color, createdAt: new Date().toISOString() };
		zones.update((list) => [...list, zone]);
		return zone.id;
	},
	deleteZone(id) {
		zones.update((list) => list.filter((z) => z.id !== id));
		// Remove from any alerts using this zone
		alerts.update((list) => list.map((a) => (a.zone === id ? { ...a, zone: null } : a)));
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
