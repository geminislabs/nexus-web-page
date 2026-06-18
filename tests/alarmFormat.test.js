import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatAlarmWhen } from '../src/lib/utils/alarmFormat.js';

describe('formatAlarmWhen', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns Ahora for very recent timestamps', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
		expect(formatAlarmWhen('2026-06-18T11:59:30Z')).toBe('Ahora');
	});

	it('returns relative minutes for recent past', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
		expect(formatAlarmWhen('2026-06-18T11:30:00Z')).toBe('hace 30 min');
	});

	it('falls back to string for invalid dates', () => {
		expect(formatAlarmWhen('not-a-date')).toBe('not-a-date');
	});

	it('formats hours, days, and absolute dates', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
		expect(formatAlarmWhen('2026-06-18T10:00:00Z')).toBe('hace 2 h');
		expect(formatAlarmWhen('2026-06-15T12:00:00Z')).toBe('hace 3 d');
		expect(formatAlarmWhen('2025-01-01T08:00:00Z')).toMatch(/ene/);
		vi.useRealTimers();
	});
});
