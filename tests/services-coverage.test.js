import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('svelte/store', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		get: vi.fn(() => ({ email: 'user@test.com' }))
	};
});

const authMocks = vi.hoisted(() => ({
	setSession: vi.fn(),
	getToken: vi.fn(() => 'access-token'),
	getRefreshToken: vi.fn(() => 'refresh-token')
}));

vi.mock('../src/lib/stores/auth.js', () => ({
	authToken: {
		getToken: authMocks.getToken,
		getRefreshToken: authMocks.getRefreshToken,
		setSession: authMocks.setSession
	},
	user: { subscribe: vi.fn() }
}));

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('apiService method coverage', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
		);
		authMocks.getToken.mockReturnValue('access-token');
		authMocks.getRefreshToken.mockReturnValue('refresh-token');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('covers auth, users, units, devices, and assignments', async () => {
		const { apiService } = await import('../src/lib/services/api.js');

		await apiService.login({ email: 'a@b.com', password: 'x' });
		await apiService.register({ email: 'a@b.com', password: 'x' });
		await apiService.logout();
		await apiService.verifyToken();
		await apiService.changePassword({ old_password: 'a', new_password: 'b' });
		await apiService.forgotPassword('a@b.com');
		await apiService.resetPassword({ email: 'a@b.com', code: '123', new_password: 'b' });

		await apiService.getCurrentUser();
		await apiService.getUsers();
		await apiService.inviteUser({ email: 'a@b.com', full_name: 'Ana' });
		await apiService.resendInvitation({ email: 'a@b.com' });

		await apiService.getUnits();
		await apiService.getVehicle('u1');
		await apiService.createUnit({ name: 'U1' });
		await apiService.updateVehicle('u1', { name: 'U2' });
		await apiService.deleteVehicle('u1');
		await apiService.getUnitProfile('u1');
		await apiService.updateUnitProfile('u1', { plate: 'ABC' });
		await apiService.shareUnitLocation('u1');
		await apiService.getVehicleLocation('u1');
		await apiService.getVehicleStatus('u1');

		await apiService.getMyDevices();
		await apiService.getUnassignedDevices();
		await apiService.assignDeviceToUnit('u1', 'd1');
		await apiService.assignUnitDevice('u1', 'd1');
		await apiService.getUnitAssignedDevice('u1');
		await apiService.getUnitDevices({ active_only: true });
		await apiService.unassignDeviceFromUnit('asg-1');

		await apiService.getUserUnits('user-1');
		await apiService.createUserUnit({ user_id: 'user-1', unit_id: 'u1' });
		await apiService.deleteUserUnit('uu-1');

		expect(globalThis.fetch).toHaveBeenCalled();
	});

	it('covers geofences, alerts, trips, telemetry, and shortcuts', async () => {
		const fetchMock = vi.fn().mockImplementation((url) => {
			if (String(url).includes('/unit-devices')) {
				return Promise.resolve(jsonResponse([{ id: 'asg-1', unit_id: 'u1' }]));
			}
			return Promise.resolve(jsonResponse({ ok: true }));
		});
		vi.stubGlobal('fetch', fetchMock);

		const { apiService } = await import('../src/lib/services/api.js');

		await apiService.getGeofences();
		await apiService.getGeofence('g1');
		await apiService.createGeofence({ name: 'Z' });
		await apiService.updateGeofence('g1', { name: 'Z2' });
		await apiService.toggleGeofenceActive('g1', true);
		await apiService.deleteGeofence('g1');

		await apiService.getAlertRules();
		await apiService.getAlertRule('r1');
		await apiService.createAlertRule({ name: 'R' });
		await apiService.updateAlertRule('r1', { name: 'R2' });
		await apiService.deleteAlertRule('r1');
		await apiService.getAlerts({ limit: 10 });

		await apiService.getTrips({ unit_id: 'u1' });
		await apiService.getTrip('t1', { include_alerts: true });
		await apiService.getDeviceTelemetry('d1', { limit: 5 });
		await apiService.queryTelemetry({ device_id: 'd1' });

		await apiService.get('/health');
		await apiService.post('/echo', { ping: true });
		await apiService.put('/echo', { ping: true });
		await apiService.delete('/echo');

		await apiService.unassignUnitDevice('u1');
	});

	it('refreshSession persists tokens from refresh endpoint', async () => {
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				jsonResponse({
					access_token: 'new-access',
					refresh_token: 'new-refresh',
					expires_in: 3600
				})
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const { apiService } = await import('../src/lib/services/api.js');
		await apiService.refreshSession();

		expect(authMocks.setSession).toHaveBeenCalledWith(
			expect.objectContaining({ access_token: 'new-access' })
		);
	});
});
