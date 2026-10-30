import { describe, it, expect } from 'vitest';
import {
	IOS_APP_ID,
	androidAssetLinks,
	appleAppSiteAssociation,
	enlaceDeLaAppParaInvitacion
} from '../src/lib/appLinks.js';
import { GET } from '../src/routes/.well-known/apple-app-site-association/+server.js';
import { GET as getAssetLinks } from '../src/routes/.well-known/assetlinks.json/+server.js';

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

/**
 * El equivalente de Android. Si la huella no coincide con la del certificado que
 * firmó el APK, Android no verifica el dominio y pregunta con qué app abrir.
 */
describe('assetlinks.json', () => {
	it('se sirve como JSON, sin redirección', async () => {
		const response = getAssetLinks();
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(await response.json()).toEqual(androidAssetLinks());
	});

	it('delega los enlaces en la app de producción con la huella del keystore de release', () => {
		const [declaracion] = androidAssetLinks();
		expect(declaracion.relation).toEqual(['delegate_permission/common.handle_all_urls']);
		expect(declaracion.target.namespace).toBe('android_app');
		expect(declaracion.target.package_name).toBe('com.geminislabs.nexus');
		expect(declaracion.target.sha256_cert_fingerprints).toContain(
			'C6:F1:B7:0D:8C:5C:BD:FE:56:48:57:97:30:66:5E:DF:AC:BE:E6:F1:4B:B1:52:72:C4:7B:27:9C:EC:32:9C:A8'
		);
		for (const huella of declaracion.target.sha256_cert_fingerprints) {
			expect(huella).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
		}
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
