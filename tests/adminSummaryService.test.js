import { describe, it, expect, vi } from 'vitest';
import { asList, fetchAdminSummary, summarizeAdmin } from '$lib/services/adminSummaryService.js';

const okAlerts = () => ({
	syncAlertRulesFromApi: vi.fn().mockResolvedValue(undefined),
	syncZonesFromApi: vi.fn().mockResolvedValue(undefined),
	syncAlarmEventsFromApi: vi.fn().mockResolvedValue(undefined)
});

describe('asList', () => {
	it('acepta lista, { items } o { data }', () => {
		expect(asList([1])).toEqual([1]);
		expect(asList({ items: [2] })).toEqual([2]);
		expect(asList({ data: [3] })).toEqual([3]);
		expect(asList(null)).toEqual([]);
	});
});

describe('fetchAdminSummary', () => {
	it('devuelve las listas y deja en null la que falla', async () => {
		const api = {
			getUsers: vi.fn().mockResolvedValue({ items: [{ id: 1 }] }),
			getMyDevices: vi.fn().mockRejectedValue(new Error('x')),
			getUnassignedDevices: vi.fn().mockResolvedValue([])
		};
		const r = await fetchAdminSummary({ api, alerts: okAlerts() });
		expect(r).toEqual({ users: [{ id: 1 }], devices: null, unassigned: [], error: '' });
	});

	it('avisa solo cuando falla todo', async () => {
		const fail = vi.fn().mockRejectedValue(new Error('x'));
		const r = await fetchAdminSummary({
			api: { getUsers: fail, getMyDevices: fail, getUnassignedDevices: fail },
			alerts: { syncAlertRulesFromApi: fail, syncZonesFromApi: fail, syncAlarmEventsFromApi: fail }
		});
		expect(r.error).toMatch(/No se pudo cargar/);
		expect(r.users).toBeNull();
	});
});

describe('summarizeAdmin', () => {
	it('cuenta pendientes, asignados y alertas activas', () => {
		const s = summarizeAdmin({
			users: [{ email_verified: true }, { email_verified: false }, { status: 'INACTIVE' }],
			devices: [{}, {}, {}],
			unassigned: [{}],
			alerts: [{ enabled: true }, { enabled: false }, { is_enabled: false }, {}]
		});
		expect(s).toEqual({
			userCount: 3,
			verifiedUsers: 1,
			pendingUsers: 2,
			deviceCount: 3,
			unassignedCount: 1,
			assignedDevices: 2,
			alertCount: 4,
			enabledAlerts: 2
		});
	});

	it('sin datos todo es cero', () => {
		expect(summarizeAdmin().userCount).toBe(0);
		expect(summarizeAdmin().assignedDevices).toBe(0);
	});
});
