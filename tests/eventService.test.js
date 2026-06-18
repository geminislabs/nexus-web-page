import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

describe('eventService', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('fetch', vi.fn());
		localStorage.getItem.mockReturnValue('access-token');
	});

	it('getEventsForUnit normalizes API payload', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [
						{
							event_type: 'ignition_on',
							source_id: 's1',
							source_epoch: 1,
							unit_id: 'u1'
						}
					],
					next_cursor: 'cur-1'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const { eventService } = await import('../src/lib/services/eventService.js');
		const result = await eventService.getEventsForUnit('u1', { hours: 1, limit: 5 });

		expect(result.nextCursor).toBe('cur-1');
		expect(result.events[0]).toMatchObject({
			unitId: 'u1',
			eventType: 'ignition_on',
			id: 's1_1_ignition_on'
		});
		expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer access-token');
	});

	it('getEventsForUnit throws on HTTP error', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(new Response('fail', { status: 500 }));

		const { eventService } = await import('../src/lib/services/eventService.js');
		await expect(eventService.getEventsForUnit('u1')).rejects.toThrow('fail');
	});
});
