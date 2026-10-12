import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { accessFromMe, accountAccess, canEditBrand } from '../src/lib/stores/accountStore.js';

const ME = {
	account: { id: 'acc-1', account_name: 'Rastreo Norte' },
	role: 'owner',
	organization_id: 'org-1',
	account_role: 'owner',
	account_permissions: ['branding.write'],
	account_capabilities: { white_label_enabled: true, max_custom_domains: 0 }
};

describe('accessFromMe', () => {
	it('toma cuenta, rol, permisos y capabilities de /auth/me', () => {
		expect(accessFromMe(ME)).toEqual({
			accountId: 'acc-1',
			accountName: 'Rastreo Norte',
			role: 'owner',
			permissions: ['branding.write'],
			capabilities: { white_label_enabled: true, max_custom_domains: 0 }
		});
	});

	it('contra un backend anterior a la rebanada 1 queda sin permisos', () => {
		const viejo = { account: { id: 'acc-1' }, role: 'owner', organization_id: 'org-1' };
		expect(accessFromMe(viejo)).toMatchObject({ permissions: [], capabilities: {}, role: null });
	});

	it('ignora formas inesperadas en lugar de romper', () => {
		expect(accessFromMe(null).accountId).toBeNull();
		expect(
			accessFromMe({ account: { id: 1 }, account_permissions: 'x', account_capabilities: [] })
		).toMatchObject({ accountId: '1', permissions: [], capabilities: {} });
		expect(accessFromMe({ account_permissions: ['a', 3, null] }).permissions).toEqual(['a']);
	});
});

describe('canEditBrand', () => {
	it('exige el permiso y la capability, las dos', () => {
		expect(canEditBrand(accessFromMe(ME))).toBe(true);
		expect(canEditBrand(accessFromMe({ ...ME, account_permissions: [] }))).toBe(false);
		expect(
			canEditBrand(accessFromMe({ ...ME, account_capabilities: { white_label_enabled: false } }))
		).toBe(false);
	});

	it('la capability tiene que ser true, no solo verdadera', () => {
		expect(
			canEditBrand(accessFromMe({ ...ME, account_capabilities: { white_label_enabled: 'true' } }))
		).toBe(false);
	});

	it('sin cuenta no hay marca que editar', () => {
		expect(canEditBrand(accessFromMe({ ...ME, account: null }))).toBe(false);
		expect(canEditBrand(null)).toBe(false);
	});
});

describe('accountAccess', () => {
	it('se llena desde /auth/me y se vacía al limpiar', () => {
		accountAccess.setFromMe(ME);
		expect(get(accountAccess).accountId).toBe('acc-1');
		accountAccess.clear();
		expect(get(accountAccess)).toMatchObject({ accountId: null, permissions: [] });
	});
});
