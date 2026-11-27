import { describe, it, expect } from 'vitest';
import { sinceLabel } from '$lib/stores/clockStore.js';
import { appendSpeeds, SPEED_WINDOW_MS, SPEED_MIN_GAP_MS } from '$lib/stores/liveTrailStore.js';

describe('sinceLabel', () => {
	const now = Date.parse('2026-11-27T12:00:00Z');
	it('segundos, minutos, horas y días', () => {
		expect(sinceLabel(now - 3_000, now)).toBe('hace 3 s');
		expect(sinceLabel(now - 4 * 60_000, now)).toBe('hace 4 min');
		expect(sinceLabel(now - 2 * 3_600_000, now)).toBe('hace 2 h');
		expect(sinceLabel(now - 3 * 86_400_000, now)).toBe('hace 3 d');
		expect(sinceLabel('2026-11-27T11:59:50Z', now)).toBe('hace 10 s');
	});
	it('sin fecha o con fecha inválida, null', () => {
		expect(sinceLabel(null, now)).toBeNull();
		expect(sinceLabel('x', now)).toBeNull();
	});
});

describe('appendSpeeds', () => {
	it('agrega una muestra cada 20 s como mucho y olvida lo de hace más de 30 min', () => {
		const t0 = 1_000_000_000;
		let s = appendSpeeds({}, [{ id: 1, speed: 40 }], t0);
		s = appendSpeeds(s, [{ id: 1, speed: 50 }], t0 + SPEED_MIN_GAP_MS - 1);
		expect(s['1']).toEqual([{ t: t0, v: 40 }]);
		s = appendSpeeds(s, [{ id: 1, speed: 50 }], t0 + SPEED_MIN_GAP_MS);
		expect(s['1'].map((p) => p.v)).toEqual([40, 50]);
		s = appendSpeeds(s, [{ id: 1, speed: -5 }], t0 + SPEED_WINDOW_MS + SPEED_MIN_GAP_MS + 1);
		expect(s['1']).toEqual([{ t: t0 + SPEED_WINDOW_MS + SPEED_MIN_GAP_MS + 1, v: 0 }]);
	});
	it('ignora unidades sin id y velocidades que no son número', () => {
		const s = appendSpeeds({}, [{ speed: 10 }, { id: 2, speed: 'x' }], 5);
		expect(s).toEqual({ 2: [] });
	});
});
