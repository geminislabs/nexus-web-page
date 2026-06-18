import { describe, it, expect } from 'vitest';
import {
	formatEventType,
	eventIcon,
	eventColorClass,
	normalizeEvent
} from '../src/lib/utils/eventUtils.js';

describe('eventUtils', () => {
	it('formatEventType humaniza códigos snake_case', () => {
		expect(formatEventType('ignition_on')).toBe('Ignition On');
		expect(formatEventType('')).toBe('Evento');
	});

	it('eventIcon devuelve icono conocido o default', () => {
		expect(eventIcon('ignition_on')).toBe('mdi:key');
		expect(eventIcon('unknown_code')).toBe('mdi:bell-outline');
	});

	it('eventColorClass asigna paleta por tipo', () => {
		expect(eventColorClass('panic_button')).toContain('text-red-400');
		expect(eventColorClass('unknown')).toContain('text-blue-400');
	});

	it('normalizeEvent unifica campos del backend', () => {
		const event = normalizeEvent({
			event_type: 'speed_alert',
			source_id: 'dev-1',
			source_epoch: 42,
			unit_id: 'unit-9',
			occurred_at: '2026-01-01T00:00:00Z'
		});
		expect(event).toEqual({
			id: 'dev-1_42_speed_alert',
			unitId: 'unit-9',
			sourceId: 'dev-1',
			eventType: 'speed_alert',
			occurredAt: '2026-01-01T00:00:00Z',
			receivedAt: undefined,
			sourceEpoch: 42
		});
	});
});
