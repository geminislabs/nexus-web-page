import { describe, it, expect } from 'vitest';
import {
	IOS_APP_ID,
	appleAppSiteAssociation,
	enlaceDeLaAppParaInvitacion
} from '../src/lib/appLinks.js';
import { GET } from '../src/routes/.well-known/apple-app-site-association/+server.js';

/**
 * Los universal links de las invitaciones. Si el AASA no llega como JSON o
 * reclama otra ruta, iOS abre Safari en vez de la app y nadie se entera: el
 * enlace «funciona», solo que en el sitio equivocado.
 */
describe('apple-app-site-association', () => {
	it('se sirve como JSON, sin redirección', async () => {
		const response = GET();
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(await response.json()).toEqual(appleAppSiteAssociation());
	});

	it('reclama solo /invite/* para INexus', () => {
		const [detalle] = appleAppSiteAssociation().applinks.details;
		expect(detalle.appIDs).toEqual(['GCNV65DKL8.GeminisLabs.INexus']);
		expect(IOS_APP_ID).toBe('GCNV65DKL8.GeminisLabs.INexus');
		expect(detalle.components.map((c) => c['/'])).toEqual(['/invite/*']);
	});
});

describe('enlaceDeLaAppParaInvitacion', () => {
	it('usa el esquema de la app con el token', () => {
		expect(enlaceDeLaAppParaInvitacion('bQJue_AK-Goi')).toBe('inexus://invite/bQJue_AK-Goi');
	});

	it('no deja que el token cambie la ruta', () => {
		expect(enlaceDeLaAppParaInvitacion('a/../b?x=1')).toBe('inexus://invite/a%2F..%2Fb%3Fx%3D1');
	});
});
