import { isUnitMoving } from '$lib/utils/unitTrackingStatus.js';

/**
 * Filtros y orden de la lista de unidades. Mismas reglas que el cajón
 * «Unidades» de la vista Clásica (DrawerConfiguracion), para que las dos
 * vistas muestren lo mismo con los mismos filtros.
 *
 * @typedef {{
 *   search?: string,
 *   status?: 'all' | 'active' | 'maintenance' | 'inactive',
 *   ignition?: 'all' | 'on' | 'off',
 *   motion?: 'all' | 'moving' | 'stopped',
 *   gps?: 'all' | 'with' | 'without',
 *   sortBy?: 'name' | 'speed' | 'updated'
 * }} UnitListFilter
 */

/** @param {Record<string, any>} v */
export function unitHasGps(v) {
	const lat = v?.latitude ?? v?.lat;
	const lng = v?.longitude ?? v?.lng;
	return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
}

/**
 * @param {Array<Record<string, any>>} units
 * @param {UnitListFilter} [f]
 */
export function filterAndSortUnits(units, f = {}) {
	const q = String(f.search ?? '')
		.trim()
		.toLowerCase();
	const status = f.status ?? 'all';
	const ignition = f.ignition ?? 'all';
	const motion = f.motion ?? 'all';
	const gps = f.gps ?? 'all';
	const sortBy = f.sortBy ?? 'name';

	const list = (units || []).filter((v) => {
		if (status !== 'all' && v.status !== status) return false;
		if (
			q &&
			![v.name, v.driver, v.location, v.description, v.brand, v.model, v.plate].some((s) =>
				String(s ?? '')
					.toLowerCase()
					.includes(q)
			)
		) {
			return false;
		}
		const engineOn = String(v.engineStatus ?? '').toUpperCase() === 'ON';
		if (ignition === 'on' && !engineOn) return false;
		if (ignition === 'off' && engineOn) return false;
		if (motion === 'moving' && !isUnitMoving(v)) return false;
		if (motion === 'stopped' && isUnitMoving(v)) return false;
		if (gps === 'with' && !unitHasGps(v)) return false;
		if (gps === 'without' && unitHasGps(v)) return false;
		return true;
	});

	return list.sort((a, b) => {
		if (sortBy === 'speed') return (Number(b.speed) || 0) - (Number(a.speed) || 0);
		if (sortBy === 'updated') {
			return (
				(new Date(b.lastUpdate || 0).getTime() || 0) - (new Date(a.lastUpdate || 0).getTime() || 0)
			);
		}
		return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
	});
}

/** Cuántos filtros avanzados (no el buscador ni el estado) se apartan del valor por defecto. */
export function advancedFilterCount(/** @type {UnitListFilter} */ f = {}) {
	return (
		(f.ignition && f.ignition !== 'all' ? 1 : 0) +
		(f.motion && f.motion !== 'all' ? 1 : 0) +
		(f.gps && f.gps !== 'all' ? 1 : 0) +
		(f.sortBy && f.sortBy !== 'name' ? 1 : 0)
	);
}
