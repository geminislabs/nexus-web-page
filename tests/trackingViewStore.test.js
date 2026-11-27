import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
	TRACKING_VIEW_KEY,
	DEFAULT_PANELS,
	defaultPrefs,
	parsePrefs,
	createTrackingViewStore
} from '$lib/stores/trackingViewStore.js';

function memoryStorage(initial = {}) {
	const data = { ...initial };
	return {
		data,
		getItem: (k) => (k in data ? data[k] : null),
		setItem: (k, v) => {
			data[k] = v;
		}
	};
}

describe('parsePrefs', () => {
	it('sin nada guardado arranca en la vista clásica con todos los paneles', () => {
		expect(parsePrefs(null)).toEqual({ view: 'clasica', panels: { ...DEFAULT_PANELS } });
		expect(defaultPrefs().view).toBe('clasica');
	});

	it('lee la vista y los paneles guardados', () => {
		const raw = JSON.stringify({ view: 'panel', panels: { alertas: false } });
		expect(parsePrefs(raw)).toEqual({
			view: 'panel',
			panels: { flota: true, alertas: false, hoy: true }
		});
	});

	it('ignora valores raros y JSON roto', () => {
		expect(parsePrefs('{roto').view).toBe('clasica');
		expect(
			parsePrefs(JSON.stringify({ view: 'otra', panels: { hoy: 'no', extra: true } }))
		).toEqual(defaultPrefs());
	});
});

describe('createTrackingViewStore', () => {
	it('cambia de vista y lo guarda', () => {
		const storage = memoryStorage();
		const s = createTrackingViewStore(storage);
		s.setView('panel');
		expect(get(s).view).toBe('panel');
		expect(JSON.parse(storage.data[TRACKING_VIEW_KEY]).view).toBe('panel');
		s.setView('cualquiera');
		expect(get(s).view).toBe('clasica');
	});

	it('enciende y apaga paneles, e ignora paneles que no existen', () => {
		const s = createTrackingViewStore(memoryStorage());
		s.togglePanel('alertas');
		expect(get(s).panels.alertas).toBe(false);
		s.setPanel('alertas', true);
		s.setPanel('hoy', false);
		expect(get(s).panels).toEqual({ flota: true, alertas: true, hoy: false });
		s.togglePanel('inventado');
		s.setPanel('inventado', true);
		expect(get(s).panels).toEqual({ flota: true, alertas: true, hoy: false });
	});

	it('arranca con lo guardado', () => {
		const storage = memoryStorage({
			[TRACKING_VIEW_KEY]: JSON.stringify({ view: 'panel', panels: { flota: false } })
		});
		expect(get(createTrackingViewStore(storage))).toEqual({
			view: 'panel',
			panels: { flota: false, alertas: true, hoy: true }
		});
	});

	it('funciona sin almacenamiento o con uno que falla', () => {
		const roto = {
			getItem: () => {
				throw new Error('bloqueado');
			},
			setItem: () => {
				throw new Error('bloqueado');
			}
		};
		const s = createTrackingViewStore(roto);
		expect(get(s).view).toBe('clasica');
		s.setView('panel');
		expect(get(s).view).toBe('panel');
		const sinNada = createTrackingViewStore(null);
		sinNada.togglePanel('hoy');
		expect(get(sinNada).panels.hoy).toBe(false);
	});
});
