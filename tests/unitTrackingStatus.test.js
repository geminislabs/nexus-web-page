import { describe, it, expect } from 'vitest';
import {
	isUnitMoving,
	getUnitTrackingStatus,
	unitMatchesTrackingFilter
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
});
