import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	formatAlarmWhen,
	getLocalDayBounds,
	isSameLocalDay
} from '../src/lib/utils/alarmFormat.js';

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

describe('day helpers', () => {
	it('getLocalDayBounds spans local midnight to end of day', () => {
		const ref = new Date(2026, 5, 18, 15, 30, 0);
		const { from, to } = getLocalDayBounds(ref);
		expect(from.getHours()).toBe(0);
		expect(from.getMinutes()).toBe(0);
		expect(to.getHours()).toBe(23);
		expect(to.getMinutes()).toBe(59);
		expect(from.getDate()).toBe(18);
		expect(to.getDate()).toBe(18);
	});

	it('isSameLocalDay accepts same-day ISO and Date', () => {
		const ref = new Date(2026, 5, 18, 12, 0, 0);
		expect(isSameLocalDay(new Date(2026, 5, 18, 1, 0, 0), ref)).toBe(true);
		expect(isSameLocalDay(new Date(2026, 5, 17, 23, 0, 0), ref)).toBe(false);
		expect(isSameLocalDay(null, ref)).toBe(false);
		expect(isSameLocalDay('not-a-date', ref)).toBe(false);
	});
});
