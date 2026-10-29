import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const reduced = { current: false };
vi.mock('svelte/motion', () => ({ prefersReducedMotion: reduced }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/services/googleMapsLoader.js', () => ({ cargarGoogleMaps: vi.fn() }));
vi.mock('@googlemaps/markerclusterer', () => ({
	MarkerClusterer: vi.fn(),
	SuperClusterAlgorithm: vi.fn()
}));

describe('pathAtProgress', () => {
	const path = [
		{ lat: 0, lng: 0 },
		{ lat: 0, lng: 0.001 },
		{ lat: 0, lng: 0.0011 },
		{ lat: 0, lng: 0.003 }
	];

	it('avanza por distancia, no por índice', async () => {
		const { cumulativeDistances, pathAtProgress } = await import('../src/lib/motion/geo.js');
		const cum = cumulativeDistances(path);
		expect(cum[0]).toBe(0);
		expect(cum[3]).toBeGreaterThan(cum[2]);

		const half = pathAtProgress(path, cum, 0.5);
		// La mitad de 0.003° de longitud cae en el último tramo (0.0011 → 0.003).
		expect(half.head.lng).toBeCloseTo(0.0015, 6);
		expect(half.path).toHaveLength(4);
		expect(half.path.at(-1)).toEqual(half.head);

		expect(pathAtProgress(path, cum, 0).path).toEqual([path[0], path[0]]);
		expect(pathAtProgress(path, cum, 1)).toEqual({ path, head: path[3] });
	});

	it('un recorrido sin longitud se devuelve completo', async () => {
		const { cumulativeDistances, pathAtProgress } = await import('../src/lib/motion/geo.js');
		const still = [path[0], path[0], path[0]];
		expect(pathAtProgress(still, cumulativeDistances(still), 0.3).path).toBe(still);
	});
});

/** google.maps falso: guarda cada marcador y polilínea creados. */
function fakeGoogle() {
	const created = { markers: [], polylines: [] };
	class Marker {
		constructor(opts) {
			this.opts = opts;
			this.map = opts.map ?? null;
			this.position = opts.position;
			created.markers.push(this);
		}
		setMap(m) {
			this.map = m;
		}
		setPosition(p) {
			this.position = p;
		}
	}
	class Polyline {
		constructor(opts) {
			this.path = opts.path;
			this.map = opts.map;
			created.polylines.push(this);
		}
		setPath(p) {
			this.path = p;
		}
		setMap(m) {
			this.map = m;
		}
	}
	return { created, google: { maps: { Marker, Polyline, SymbolPath: { CIRCLE: 0 } } } };
}

describe('mapService: dibujo de la ruta y reproducción', () => {
	/** @type {FrameRequestCallback[]} */
	let frames;
	let now;

	beforeEach(() => {
		reduced.current = false;
		frames = [];
		now = 0;
		vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		vi.spyOn(performance, 'now').mockImplementation(() => now);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function tick(ms) {
		now += ms;
		frames.shift()?.(now);
	}

	const points = [
		{ lat: 19.43, lon: -99.13 },
		{ lat: 19.431, lon: -99.13 },
		{ lat: 19.432, lon: -99.131 },
		{ lat: 19.433, lon: -99.132 }
	];

	async function setup() {
		const { mapService } = await import('../src/lib/services/mapService.js');
		const fake = fakeGoogle();
		mapService.map = {};
		mapService.google = fake.google;
		vi.spyOn(mapService, 'clearFollowVehicle').mockImplementation(() => {});
		vi.spyOn(mapService, '_hideAllLiveTrails').mockImplementation(() => {});
		vi.spyOn(mapService, '_panIfNearEdge').mockImplementation(() => {});
		return { mapService, ...fake };
	}

	it('la línea crece con una punta y el marcador de fin aparece al llegar', async () => {
		const { mapService, created } = await setup();
		mapService.drawTripRoute(points);

		const line = created.polylines[0];
		const end = mapService._tripEndMarker;
		expect(line.path).toHaveLength(1);
		expect(end.map).toBeNull();
		expect(mapService._tripDrawHead).not.toBeNull();

		tick(700);
		expect(line.path.length).toBeGreaterThan(1);
		expect(line.path.length).toBeLessThanOrEqual(points.length + 1);

		tick(800);
		expect(line.path).toHaveLength(points.length);
		expect(end.map).not.toBeNull();
		expect(mapService._tripDrawHead).toBeNull();
		mapService.clearTripRoute();
	});

	it('con movimiento reducido se dibuja completa al instante', async () => {
		reduced.current = true;
		const { mapService, created } = await setup();
		mapService.drawTripRoute(points);
		expect(created.polylines[0].path).toHaveLength(points.length);
		expect(mapService._tripEndMarker.map).not.toBeNull();
		expect(frames).toHaveLength(0);
		mapService.clearTripRoute();
	});

	it('limpiar la ruta a medio dibujo cancela la animación y quita la punta', async () => {
		const { mapService } = await setup();
		mapService.drawTripRoute(points);
		const head = mapService._tripDrawHead;
		mapService.clearTripRoute();
		expect(cancelAnimationFrame).toHaveBeenCalled();
		expect(head.map).toBeNull();
		expect(mapService._tripDrawHead).toBeNull();
	});

	it('el slider lleva el marcador de reproducción al punto pedido', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		const { mapService } = await setup();
		const progress = vi.fn();
		mapService.startTripPlayback(points, { onProgress: progress });
		mapService.pauseTripPlayback();

		mapService.seekTripPlayback(2 / 3);
		expect(mapService._playbackIndex).toBe(2);
		expect(mapService._playbackMarker.position).toEqual({ lat: 19.432, lng: -99.131 });
		expect(progress).toHaveBeenLastCalledWith(2 / 3);

		mapService.resumeTripPlayback();
		vi.advanceTimersByTime(400);
		// Avanza deslizándose: el primer cuadro aún está entre el punto 2 y el 3.
		tick(100);
		expect(mapService._playbackMarker.position.lat).toBeGreaterThan(19.432);
		expect(mapService._playbackMarker.position.lat).toBeLessThan(19.433);

		mapService.stopTripPlayback();
		vi.useRealTimers();
	});
});
