import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/services/googleMapsLoader.js', () => ({ cargarGoogleMaps: vi.fn() }));
vi.mock('@googlemaps/markerclusterer', () => ({
	MarkerClusterer: vi.fn(),
	SuperClusterAlgorithm: vi.fn()
}));

const { tripPalette } = await import('$lib/services/mapService.js');

/** Colores del tráfico en vivo y de estado: el trayecto en Panel no debe usarlos. */
const TRAFFIC_AND_STATE = ['#10b981', '#22c55e', '#ef4444', '#f59e0b', '#eab308', '#22d3ee'];

describe('tripPalette', () => {
	it('la Clásica conserva sus colores de siempre', () => {
		const p = tripPalette('clasica', 'dark');
		expect(p.line).toBe('#10b981');
		expect(p.casing).toBeNull();
		expect(p.arrows).toBe(false);
		expect(p.start.fill).toBe('#22c55e');
		expect(p.end.fill).toBe('#ef4444');
		expect(p.playback.fill).toBe('#ef4444');
		expect(tripPalette('clasica', 'light')).toEqual(p);
	});

	it('en Panel la ruta es blanca en oscuro y casi negra en claro, con contorno y flechas', () => {
		const dark = tripPalette('panel', 'dark');
		const light = tripPalette('panel', 'light');
		expect(dark.line).toBe('#f5f6f7');
		expect(light.line).toBe('#111827');
		expect(dark.casing).not.toBeNull();
		expect(dark.arrows).toBe(true);
		expect(dark.start.fillOpacity).toBe(0);
		expect(dark.end.fillOpacity).toBe(1);
	});

	it('en Panel no usa colores de tráfico ni de estado', () => {
		for (const mode of ['dark', 'light']) {
			const p = tripPalette('panel', mode);
			const used = [p.line, p.start.stroke, p.end.fill, p.head.fill, p.playback.fill];
			for (const c of used) expect(TRAFFIC_AND_STATE).not.toContain(c);
		}
	});
});
