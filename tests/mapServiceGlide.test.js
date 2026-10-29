import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const reduced = { current: false };
vi.mock('svelte/motion', () => ({ prefersReducedMotion: reduced }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/services/googleMapsLoader.js', () => ({ cargarGoogleMaps: vi.fn() }));
vi.mock('@googlemaps/markerclusterer', () => ({
	MarkerClusterer: vi.fn(),
	SuperClusterAlgorithm: vi.fn()
}));

/** Marcador falso con la API mínima de google.maps.Marker. */
function fakeMarker(lat, lng, onMap = true) {
	let pos = { lat, lng };
	return {
		setPosition: vi.fn((p) => (pos = p)),
		getPosition: () => ({ lat: () => pos.lat, lng: () => pos.lng }),
		getMap: () => (onMap ? {} : null),
		current: () => pos
	};
}

describe('mapService._glideMarker', () => {
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

	/** Avanza el reloj y corre el siguiente cuadro pendiente. */
	function tick(ms) {
		now += ms;
		const cb = frames.shift();
		cb?.(now);
	}

	it('desliza el marcador y termina exactamente en el destino', async () => {
		const { mapService } = await import('../src/lib/services/mapService.js');
		const marker = fakeMarker(19.4326, -99.1332);
		const to = { lat: 19.4336, lng: -99.1342 };

		mapService._glideMarker('u1', marker, to);
		expect(marker.setPosition).not.toHaveBeenCalled();

		tick(450);
		const mid = marker.current();
		expect(mid.lat).toBeGreaterThan(19.4326);
		expect(mid.lat).toBeLessThan(19.4336);

		tick(500);
		expect(marker.current()).toEqual(to);
		expect(frames).toHaveLength(0);
		expect(mapService._markerGlides.has('u1')).toBe(false);
	});

	it('salta directo si el marcador no se ve, el salto es enorme o hay movimiento reducido', async () => {
		const { mapService } = await import('../src/lib/services/mapService.js');
		const near = { lat: 19.4336, lng: -99.1332 };

		const clustered = fakeMarker(19.4326, -99.1332, false);
		mapService._glideMarker('a', clustered, near);
		expect(clustered.current()).toEqual(near);

		const far = fakeMarker(19.4326, -99.1332);
		mapService._glideMarker('b', far, { lat: 20.4, lng: -99.1 });
		expect(far.current()).toEqual({ lat: 20.4, lng: -99.1 });

		reduced.current = true;
		const calm = fakeMarker(19.4326, -99.1332);
		mapService._glideMarker('c', calm, near);
		expect(calm.current()).toEqual(near);
		expect(frames).toHaveLength(0);
	});

	it('una posición nueva cancela el deslizamiento en curso', async () => {
		const { mapService } = await import('../src/lib/services/mapService.js');
		const marker = fakeMarker(19.4326, -99.1332);
		mapService._glideMarker('u2', marker, { lat: 19.4336, lng: -99.1332 });
		mapService._glideMarker('u2', marker, { lat: 19.4346, lng: -99.1332 });
		expect(cancelAnimationFrame).toHaveBeenCalled();
		mapService._cancelMarkerGlides();
		expect(mapService._markerGlides.size).toBe(0);
	});
});
