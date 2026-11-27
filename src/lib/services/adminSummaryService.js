/**
 * Datos del dashboard de Administración. Lo usan las dos vistas (Clásica y
 * Panel) para que pidan exactamente lo mismo.
 */

/** Acepta una lista suelta o un sobre `{ items }` / `{ data }`. */
export function asList(raw) {
	if (Array.isArray(raw)) return raw;
	return raw?.items ?? raw?.data ?? [];
}

/**
 * @param {{
 *   api: { getUsers: () => Promise<any>, getMyDevices: () => Promise<any>, getUnassignedDevices: () => Promise<any> },
 *   alerts: { syncAlertRulesFromApi: () => Promise<any>, syncZonesFromApi: () => Promise<any>, syncAlarmEventsFromApi: () => Promise<any> }
 * }} deps
 * @returns {Promise<{ users: any[] | null, devices: any[] | null, unassigned: any[] | null, error: string }>}
 *   Una lista en `null` significa que esa petición falló y conviene conservar la anterior.
 */
export async function fetchAdminSummary({ api, alerts }) {
	const settled = await Promise.allSettled([
		api.getUsers(),
		api.getMyDevices(),
		api.getUnassignedDevices(),
		alerts.syncAlertRulesFromApi(),
		alerts.syncZonesFromApi(),
		alerts.syncAlarmEventsFromApi()
	]);
	const pick = (i) => (settled[i].status === 'fulfilled' ? asList(settled[i].value) : null);
	const allFailed = settled.every((s) => s.status === 'rejected');
	return {
		users: pick(0),
		devices: pick(1),
		unassigned: pick(2),
		error: allFailed ? 'No se pudo cargar el resumen. Reintenta.' : ''
	};
}

/**
 * Cifras del dashboard a partir de las listas.
 * @param {{ users?: any[], devices?: any[], unassigned?: any[], alerts?: any[] }} lists
 */
export function summarizeAdmin({ users = [], devices = [], unassigned = [], alerts = [] } = {}) {
	// `status` recién empieza a llegar del API (ACTIVE/INACTIVE).
	const verifiedUsers = users.filter(
		(u) => u.email_verified !== false && u.status !== 'INACTIVE'
	).length;
	return {
		userCount: users.length,
		verifiedUsers,
		pendingUsers: Math.max(0, users.length - verifiedUsers),
		deviceCount: devices.length,
		unassignedCount: unassigned.length,
		assignedDevices: Math.max(0, devices.length - unassigned.length),
		alertCount: alerts.length,
		enabledAlerts: alerts.filter((a) => a.enabled !== false && a.is_enabled !== false).length
	};
}
