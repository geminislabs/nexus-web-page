import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const reduced = { current: false };
vi.mock('svelte/motion', () => ({ prefersReducedMotion: reduced }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/services/googleMapsLoader.js', () => ({ cargarGoogleMaps: vi.fn() }));
vi.mock('@googlemaps/markerclusterer', () => ({
	MarkerClusterer: vi.fn(),
	SuperClusterAlgorithm: vi.fn()
}));

describe('breathe', () => {
	it('va de 0 a 1 y vuelve a 0 en un periodo', async () => {
		const { breathe } = await import('../src/lib/motion/index.js');
		expect(breathe(0, 1000)).toBe(0);
		expect(breathe(500, 1000)).toBe(1);
		expect(breathe(250, 1000)).toBeCloseTo(0.5, 3);
		expect(breathe(1000, 1000)).toBe(0);
		expect(breathe(-5, 1000)).toBe(0);
	});
});

/** Mapa falso: guarda los `idle` pendientes para dispararlos a mano. */
function fakeMap({ center = { lat: 0, lng: 0 }, zoom = 10 } = {}) {
	/** @type {Array<() => void>} */
	const idle = [];
	const map = {
		center,
		zoom,
		getCenter: () => ({ lat: () => map.center.lat, lng: () => map.center.lng }),
		getZoom: () => map.zoom,
		panTo: vi.fn((p) => (map.center = p)),
		setCenter: vi.fn((p) => (map.center = p)),
		setZoom: vi.fn((z) => (map.zoom = z))
	};
	const google = {
		maps: {
			event: {
				addListenerOnce: vi.fn((_target, name, fn) => {
					if (name === 'idle') idle.push(fn);
					return { remove: vi.fn() };
				})
			}
		}
	};
	const fireIdle = () => idle.splice(0).forEach((fn) => fn());
	return { map, google, fireIdle };
}

describe('mapService: cámara al seleccionar una unidad', () => {
	beforeEach(() => {
		reduced.current = false;
		vi.useFakeTimers();
		vi.stubGlobal(
			'requestAnimationFrame',
			vi.fn(() => 1)
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	async function setup(opts) {
		const { mapService } = await import('../src/lib/services/mapService.js');
		const fake = fakeMap(opts);
		mapService.map = fake.map;
		mapService.google = fake.google;
		mapService._tripViewActive = false;
		const open = vi.spyOn(mapService, 'openVehicleInfoWindow').mockImplementation(() => {});
		vi.spyOn(mapService, 'setFollowVehicle').mockImplementation(() => {});
		return { mapService, open, ...fake };
	}

	const vehicle = { id: 'u1', latitude: 19.43, longitude: -99.13 };

	it('se desliza, luego ajusta el zoom y abre el popup al final', async () => {
		const { mapService, map, open, fireIdle } = await setup();
		mapService.centerOnVehicle(vehicle, { zoom: 15 });

		expect(map.panTo).toHaveBeenCalledWith({ lat: 19.43, lng: -99.13 });
		expect(map.setCenter).not.toHaveBeenCalled();
		expect(map.setZoom).not.toHaveBeenCalled();

		fireIdle();
		expect(map.setZoom).toHaveBeenCalledWith(15);
		expect(open).not.toHaveBeenCalled();

		fireIdle();
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('si ya estaba ahí con ese zoom, abre el popup sin esperar', async () => {
		const { mapService, map, open } = await setup({
			center: { lat: 19.43, lng: -99.13 },
			zoom: 15
		});
		mapService.centerOnVehicle(vehicle, { zoom: 15 });
		expect(map.panTo).not.toHaveBeenCalled();
		expect(map.setZoom).not.toHaveBeenCalled();
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('si el mapa nunca emite idle, sigue tras el tope', async () => {
		const { mapService, map, open } = await setup();
		mapService.centerOnVehicle(vehicle, { zoom: 15 });
		vi.advanceTimersByTime(1500);
		expect(map.setZoom).toHaveBeenCalledWith(15);
		vi.advanceTimersByTime(1500);
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('seleccionar otra unidad a medio camino cancela lo pendiente de la primera', async () => {
		const { mapService, open, fireIdle } = await setup();
		mapService.centerOnVehicle(vehicle, { zoom: 15 });
		const other = { id: 'u2', latitude: 19.5, longitude: -99.2 };
		mapService.centerOnVehicle(other, { zoom: 15 });
		fireIdle();
		fireIdle();
		expect(open).toHaveBeenCalledTimes(1);
		expect(open).toHaveBeenCalledWith(other);
	});

	it('con movimiento reducido salta como antes', async () => {
		reduced.current = true;
		const { mapService, map, open, fireIdle } = await setup();
		mapService.centerOnVehicle(vehicle, { zoom: 15 });
		expect(map.panTo).not.toHaveBeenCalled();
		expect(map.setCenter).toHaveBeenCalledWith({ lat: 19.43, lng: -99.13 });
		expect(map.setZoom).toHaveBeenCalledWith(15);
		fireIdle();
		expect(open).toHaveBeenCalledTimes(1);
	});
});
