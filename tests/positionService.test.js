import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/stores/vehicleStore.js', () => ({
	vehicleActions: { updateVehiclePosition: vi.fn() }
}));

describe('positionService', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('normalizePositionData maps communication fields', async () => {
		const { positionService } = await import('../src/lib/services/positionService.js');
		const normalized = positionService.normalizePositionData({
			device_id: 'dev-1',
			latitude: 19.43,
			longitude: -99.13,
			gps_datetime: '2026-06-18T10:00:00Z',
			engine_status: 'ON',
			satellites: 8
		});

		expect(normalized).toMatchObject({
			deviceId: 'dev-1',
			latitude: 19.43,
			longitude: -99.13,
			isOnline: true,
			satellites: 8
		});
		expect(normalized.lastUpdateFormatted).toBeTruthy();
	});

	it('getLatestCommunications returns empty list without device ids', async () => {
		const { positionService } = await import('../src/lib/services/positionService.js');
		await expect(positionService.getLatestCommunications([])).resolves.toEqual({
			communications: []
		});
	});

	it('formatLastUpdate returns relative Spanish text', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
		const { positionService } = await import('../src/lib/services/positionService.js');
		expect(positionService.formatLastUpdate('2026-06-18T11:55:00Z')).toBe('Hace 5 minutos');
		vi.useRealTimers();
	});
});
