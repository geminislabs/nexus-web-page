import { describe, it, expect } from 'vitest';
import {
	isUnitMoving,
	getUnitTrackingStatus,
	unitMatchesTrackingFilter,
	formatUnitStatusDate
} from '../src/lib/utils/unitTrackingStatus.js';

describe('unitTrackingStatus', () => {
	it('isUnitMoving usa umbral de 3 km/h', () => {
		expect(isUnitMoving({ speed: 4 })).toBe(true);
		expect(isUnitMoving({ speed: 3 })).toBe(false);
		expect(isUnitMoving({ speed: 'bad' })).toBe(false);
	});

	it('getUnitTrackingStatus prioriza movimiento', () => {
		const status = getUnitTrackingStatus({ speed: 40, engineStatus: 'ON' });
		expect(status.filter).toBe('moving');
		expect(status.shortLabel).toBe('40 km/h');
	});

	it('getUnitTrackingStatus marca sin señal', () => {
		const status = getUnitTrackingStatus({ speed: 0, engineStatus: 'OFF' });
		expect(status.shortLabel).toBe('Sin señal');
	});

	it('unitMatchesTrackingFilter respeta filtro moving/stopped', () => {
		const unit = { speed: 10 };
		expect(unitMatchesTrackingFilter(unit, 'all')).toBe(true);
		expect(unitMatchesTrackingFilter(unit, 'moving')).toBe(true);
		expect(unitMatchesTrackingFilter(unit, 'stopped')).toBe(false);
	});

	it('formatUnitStatusDate and engine online / detenido branches', () => {
		expect(formatUnitStatusDate({})).toBe('');
		const withDate = getUnitTrackingStatus({
			speed: 0,
			engineStatus: 'ON',
			gpsDatetime: '2026-06-18T10:30:00Z'
		});
		expect(withDate.shortLabel).toBe('Online');

		const stopped = getUnitTrackingStatus({
			speed: 0,
			engineStatus: 'OFF',
			lastUpdate: '2026-06-18T08:00:00Z'
		});
		expect(stopped.shortLabel).toBe('Detenido');
	});
});
