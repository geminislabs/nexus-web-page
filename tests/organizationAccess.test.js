import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

/**
 * La pantalla de organización suspendida (siscom-admin-api
 * `docs/api/suspension.md`): qué la abre, qué no, y lo que dice.
 */

vi.mock('$app/environment', () => ({ browser: true }));

const SUSPENDIDA = {
	detail: 'El servicio de esta organización está suspendido',
	error_code: 'organization_suspended',
	organization_id: 'org-1',
	suspended_by: 'account',
	can_manage_billing: true
};

const BLOQUEO_FILA = {
	error_code: 'organization_suspended',
	suspended_by: 'organization',
	can_manage_billing: false
};

async function cargar({ activa = null, lista = [] } = {}) {
	vi.resetModules();
	localStorage.getItem.mockImplementation((k) => (k === 'active_organization_id' ? activa : null));
	const orgs = await import('../src/lib/stores/organizationStore.js');
	orgs.organizations.setOrganizations(lista);
	const acceso = await import('../src/lib/stores/organizationAccessStore.js');
	return { ...orgs, ...acceso };
}

const LISTA = [
	{ organization_id: 'org-1', name: 'Transportes García', role: 'owner', is_default: true },
	{ organization_id: 'org-2', name: 'Fletes Norte', role: 'member', is_default: false }
];

describe('parseOrganizationBlock', () => {
	it('lee el 403 de suspensión', async () => {
		const { parseOrganizationBlock } = await cargar();
		expect(parseOrganizationBlock(SUSPENDIDA)).toEqual({
			organizationId: 'org-1',
			errorCode: 'organization_suspended',
			suspendedBy: 'account',
			canManageBilling: true
		});
	});

	it('un 403 sin error_code no es una suspensión', async () => {
		const { parseOrganizationBlock } = await cargar();
		expect(parseOrganizationBlock({ detail: 'No tienes permiso' })).toBeNull();
		expect(parseOrganizationBlock(null)).toBeNull();
		expect(parseOrganizationBlock('texto')).toBeNull();
	});

	it('borrada nunca deja ir a facturación, aunque el cuerpo diga lo contrario', async () => {
		const { parseOrganizationBlock } = await cargar();
		const block = parseOrganizationBlock({
			...SUSPENDIDA,
			error_code: 'organization_deleted'
		});
		expect(block?.canManageBilling).toBe(false);
	});
});

describe('organizationAccess', () => {
	it('un 403 de la organización activa la bloquea', async () => {
		const { organizationAccess } = await cargar({ lista: LISTA });
		expect(organizationAccess.reportForbidden(SUSPENDIDA)).toBe(true);
		expect(get(organizationAccess)?.organizationId).toBe('org-1');
	});

	it('un 403 de otra organización no bloquea la activa', async () => {
		const { organizationAccess } = await cargar({ activa: 'org-2', lista: LISTA });
		organizationAccess.reportForbidden(SUSPENDIDA);
		expect(get(organizationAccess)).toBeNull();
	});

	it('un 403 cualquiera no toca el estado', async () => {
		const { organizationAccess } = await cargar({ lista: LISTA });
		expect(organizationAccess.reportForbidden({ detail: 'Sin permiso' })).toBe(false);
		expect(get(organizationAccess)).toBeNull();
	});

	it('la fila activa de /auth/organizations decide al cargar, y Reintentar la levanta', async () => {
		const { organizations, organizationAccess } = await cargar({
			lista: [{ ...LISTA[0], access_blocked: BLOQUEO_FILA }, LISTA[1]]
		});
		organizationAccess.syncFromOrganizations();
		expect(get(organizationAccess)).toEqual({
			organizationId: 'org-1',
			errorCode: 'organization_suspended',
			suspendedBy: 'organization',
			canManageBilling: false
		});

		organizations.setOrganizations([{ ...LISTA[0], access_blocked: null }, LISTA[1]]);
		organizationAccess.syncFromOrganizations();
		expect(get(organizationAccess)).toBeNull();
	});

	it('una fila bloqueada que no es la activa no bloquea', async () => {
		const { organizationAccess } = await cargar({
			activa: 'org-1',
			lista: [LISTA[0], { ...LISTA[1], access_blocked: BLOQUEO_FILA }]
		});
		organizationAccess.syncFromOrganizations();
		expect(get(organizationAccess)).toBeNull();
	});
});

describe('organizationBlockCopy', () => {
	it('owner o billing de una suspendida: ir a facturación', async () => {
		const { organizationBlockCopy, parseOrganizationBlock } = await cargar();
		const copy = organizationBlockCopy(parseOrganizationBlock(SUSPENDIDA), 'Transportes García');
		expect(copy.title).toBe('Servicio suspendido');
		expect(copy.message).toBe(
			'El servicio de Transportes García está suspendido. Revisa tu facturación para reactivarlo.'
		);
		expect(copy.showBilling).toBe(true);
	});

	it('sin permiso de facturación: contactar al administrador', async () => {
		const { organizationBlockCopy, parseOrganizationBlock } = await cargar();
		const copy = organizationBlockCopy(
			parseOrganizationBlock({ ...SUSPENDIDA, can_manage_billing: false }),
			'Transportes García'
		);
		expect(copy.message).toBe(
			'El servicio de Transportes García está suspendido. Contacta al administrador de tu cuenta.'
		);
		expect(copy.showBilling).toBe(false);
	});

	it('borrada', async () => {
		const { organizationBlockCopy, parseOrganizationBlock } = await cargar();
		const block = parseOrganizationBlock({ ...SUSPENDIDA, error_code: 'organization_deleted' });
		expect(organizationBlockCopy(block, 'Transportes García')).toMatchObject({
			title: 'Organización no disponible',
			message: 'Transportes García ya no está disponible.',
			showBilling: false
		});
		expect(organizationBlockCopy(block, null).message).toBe(
			'Esta organización ya no está disponible.'
		);
	});
});

describe('switchableOrganizations', () => {
	it('ofrece las otras que dan acceso, no las bloqueadas', async () => {
		const { switchableOrganizations } = await cargar();
		const lista = [
			...LISTA,
			{
				organization_id: 'org-3',
				name: 'Otra suspendida',
				role: 'owner',
				access_blocked: BLOQUEO_FILA
			}
		];
		expect(switchableOrganizations(lista, 'org-1').map((o) => o.organization_id)).toEqual([
			'org-2'
		]);
	});
});

describe('organizationStatusLabel', () => {
	it('marca las bloqueadas en el selector de Ajustes', async () => {
		const { organizationStatusLabel } = await cargar();
		expect(organizationStatusLabel(LISTA[0])).toBeNull();
		expect(organizationStatusLabel({ ...LISTA[0], access_blocked: BLOQUEO_FILA })).toBe(
			'Suspendida'
		);
		expect(
			organizationStatusLabel({
				...LISTA[0],
				access_blocked: { ...BLOQUEO_FILA, error_code: 'organization_deleted' }
			})
		).toBe('No disponible');
	});
});

describe('api.js con una organización suspendida', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.doUnmock('../src/lib/stores/auth.js');
	});

	it('el 403 con error_code abre la pantalla y no cierra la sesión', async () => {
		const { organizationAccess } = await cargar({ lista: LISTA });
		const logout = vi.fn();
		const clearToken = vi.fn();
		vi.doMock('../src/lib/stores/auth.js', () => ({
			authToken: { getToken: () => 'access', clearToken },
			user: { subscribe: vi.fn(), logout }
		}));
		fetch.mockResolvedValue(
			new Response(JSON.stringify(SUSPENDIDA), {
				status: 403,
				headers: { 'content-type': 'application/json' }
			})
		);
		const { apiService } = await import('../src/lib/services/api.js');

		await expect(apiService.request('/units')).rejects.toMatchObject({ status: 403 });

		expect(get(organizationAccess)?.errorCode).toBe('organization_suspended');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(logout).not.toHaveBeenCalled();
		expect(clearToken).not.toHaveBeenCalled();
	});
});

describe('dataToken con la organización bloqueada', () => {
	it('no pide token mientras la pantalla esté abierta', async () => {
		const { organizationAccess } = await cargar({ lista: LISTA });
		const request = vi.fn();
		vi.doMock('../src/lib/services/api.js', () => ({ apiService: { request } }));
		const { getDataToken, OrganizationUnavailableError } =
			await import('../src/lib/services/dataToken.js');

		organizationAccess.reportForbidden(SUSPENDIDA);
		await expect(getDataToken()).rejects.toBeInstanceOf(OrganizationUnavailableError);
		expect(request).not.toHaveBeenCalled();

		organizationAccess.clear();
		request.mockResolvedValue({ token: 't', expires_in: 600 });
		expect(await getDataToken()).toBe('t');
		vi.doUnmock('../src/lib/services/api.js');
	});
});
