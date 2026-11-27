import { describe, it, expect, vi } from 'vitest';
import { writable, get } from 'svelte/store';
import { createFleetDayController, FLEET_DAY_REFRESH_MS } from '$lib/stores/fleetDayStore.js';
import { EnConstruccionError } from '$lib/services/fleetDayService.js';

function setup({ load, visibility = 'visible' } = {}) {
	const store = writable({ status: 'idle', data: null, error: null, refreshing: false });
	let tick = null;
	let clock = 1_000_000;
	const listeners = {};
	const doc = {
		visibilityState: visibility,
		addEventListener: vi.fn((ev, fn) => (listeners[ev] = fn)),
		removeEventListener: vi.fn((ev) => delete listeners[ev])
	};
	const cancel = vi.fn();
	const ctrl = createFleetDayController({
		load,
		store,
		now: () => clock,
		schedule: (fn) => {
			tick = fn;
			return 'timer';
		},
		cancel,
		doc
	});
	return {
		ctrl,
		store,
		doc,
		cancel,
		listeners,
		tick: () => tick?.(),
		advance: (ms) => (clock += ms)
	};
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createFleetDayController', () => {
	it('arranca cargando y queda listo con los datos', async () => {
		const load = vi.fn(async () => ({ km: 10 }));
		const { ctrl, store } = setup({ load });
		ctrl.start();
		expect(get(store).status).toBe('loading');
		await flush();
		expect(get(store)).toEqual({
			status: 'ready',
			data: { km: 10 },
			error: null,
			refreshing: false
		});
		ctrl.stop();
	});

	it('no duplica peticiones si una sigue en vuelo', async () => {
		let resolve;
		const load = vi.fn(() => new Promise((r) => (resolve = r)));
		const { ctrl } = setup({ load });
		ctrl.start();
		ctrl.refresh();
		ctrl.start();
		expect(load).toHaveBeenCalledTimes(1);
		resolve({});
		await flush();
		ctrl.stop();
	});

	it('refresca en cada intervalo solo con la pestaña visible', async () => {
		const load = vi.fn(async () => ({}));
		const t = setup({ load });
		t.ctrl.start();
		await flush();
		t.tick();
		await flush();
		expect(load).toHaveBeenCalledTimes(2);
		t.doc.visibilityState = 'hidden';
		t.tick();
		await flush();
		expect(load).toHaveBeenCalledTimes(2);
		t.ctrl.stop();
	});

	it('al volver a la pestaña refresca solo si los datos ya son viejos', async () => {
		const load = vi.fn(async () => ({}));
		const t = setup({ load });
		t.ctrl.start();
		await flush();
		t.listeners.visibilitychange();
		await flush();
		expect(load).toHaveBeenCalledTimes(1);
		t.advance(FLEET_DAY_REFRESH_MS);
		t.listeners.visibilitychange();
		await flush();
		expect(load).toHaveBeenCalledTimes(2);
		t.ctrl.stop();
	});

	it('un fallo conserva los últimos datos buenos', async () => {
		const load = vi
			.fn()
			.mockResolvedValueOnce({ km: 1 })
			.mockRejectedValueOnce(new Error('sin red'));
		const { ctrl, store } = setup({ load });
		ctrl.start();
		await flush();
		await ctrl.refresh();
		expect(get(store)).toMatchObject({ status: 'error', data: { km: 1 }, error: 'sin red' });
		ctrl.stop();
	});

	it('un endpoint que aún no existe queda como «en construcción»', async () => {
		const load = vi.fn(async () => {
			throw new EnConstruccionError();
		});
		const { ctrl, store } = setup({ load });
		ctrl.start();
		await flush();
		expect(get(store).status).toBe('en_construccion');
		ctrl.stop();
	});

	it('acepta errores que no son Error', async () => {
		const load = vi.fn(() => Promise.reject('texto'));
		const { ctrl, store } = setup({ load });
		ctrl.start();
		await flush();
		expect(get(store)).toMatchObject({ status: 'error', error: 'texto' });
		ctrl.stop();
	});

	it('stop cancela el intervalo, quita el listener e ignora respuestas tardías', async () => {
		let resolve;
		const load = vi.fn(() => new Promise((r) => (resolve = r)));
		const t = setup({ load });
		t.ctrl.start();
		t.ctrl.stop();
		expect(t.cancel).toHaveBeenCalledWith('timer');
		expect(t.doc.removeEventListener).toHaveBeenCalled();
		resolve({ tarde: true });
		await flush();
		expect(get(t.store).status).toBe('loading');
	});
});
