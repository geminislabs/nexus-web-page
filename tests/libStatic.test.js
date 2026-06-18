import { describe, it, expect, vi } from 'vitest';
import { grayBlueMapStyle, COLORS } from '../src/lib/mapStyles.js';
import { unitIcons } from '../src/lib/data/unitIcons.js';
import {
	colorSlugToHex,
	getStatusColor,
	getStatusBadgeClass,
	getStatusText,
	getStatusBgColor,
	getStatusPillClass,
	formatLastUpdate,
	getFuelLevelColor,
	getSpeedColor
} from '../src/lib/utils/vehicleUtils.js';

describe('mapStyles', () => {
	it('exports palette and map style rules', () => {
		expect(COLORS.waterBlue).toBeTruthy();
		expect(grayBlueMapStyle.length).toBeGreaterThan(0);
	});
});

describe('unitIcons', () => {
	it('exports icon paths', () => {
		expect(unitIcons['vehicle-car-sedan']).toContain('/unit/icons/');
	});
});

describe('vehicleUtils', () => {
	it('colorSlugToHex resolves known slugs', () => {
		expect(colorSlugToHex('red')).toBe('#B80C09');
		expect(colorSlugToHex('unknown')).toBeNull();
	});

	it('status helpers return classes and labels', () => {
		expect(getStatusColor('active')).toContain('green');
		expect(getStatusBadgeClass('inactive')).toContain('badge');
		expect(getStatusText('maintenance')).toBe('Mantenimiento');
		expect(getStatusBgColor('active')).toContain('green');
		expect(getStatusPillClass('inactive')).toContain('red');
	});

	it('formatLastUpdate returns relative Spanish text', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
		expect(formatLastUpdate('2026-06-18T11:30:00Z')).toBe('Hace 30 minutos');
		vi.useRealTimers();
	});

	it('fuel and speed colors follow thresholds', () => {
		expect(getFuelLevelColor(80)).toContain('green');
		expect(getFuelLevelColor(30)).toContain('yellow');
		expect(getFuelLevelColor(10)).toContain('red');
		expect(getSpeedColor(0)).toContain('gray');
		expect(getSpeedColor(45)).toContain('yellow');
		expect(getSpeedColor(30)).toContain('green');
		expect(getSpeedColor(70)).toContain('red');
		expect(getStatusColor('unknown')).toContain('gray');
		expect(getStatusText('unknown')).toBe('Desconocido');
	});
});
