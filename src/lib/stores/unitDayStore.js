import { writable } from 'svelte/store';

/**
 * El día de la unidad enfocada en la vista Panel («modo unidad»). Lo llena un
 * `createFleetDayController` de `fleetDayStore.js` con `loadUnitDay`: mismo
 * refresco (5 min, solo con la pestaña visible, una petición a la vez).
 *
 * @type {import('svelte/store').Writable<import('./fleetDayStore.js').FleetDayState>}
 */
export const unitDay = writable({ status: 'idle', data: null, error: null, refreshing: false });
