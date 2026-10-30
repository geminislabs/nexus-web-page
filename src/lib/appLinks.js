/**
 * Enlaces que abren las apps móviles desde este dominio.
 *
 * admin-api arma las invitaciones a equipos como
 * `https://nexus.geminislabs.com/invite/<token>` (`INVITE_BASE_URL`). Para que iOS
 * le entregue ese enlace a la app en vez de abrir Safari, este dominio sirve el
 * `apple-app-site-association` y la app declara `applinks:nexus.geminislabs.com`.
 * En Android hace lo mismo `assetlinks.json`, con el intent-filter
 * `autoVerify` de la app sobre `/invite/`.
 * Si la app no está instalada, se abre `/invite/[token]` en el navegador.
 */

/** Team ID de Apple + bundle id de INexus. */
export const IOS_APP_ID = 'GCNV65DKL8.GeminisLabs.INexus';

/** Id numérico de la ficha de App Store, para el Smart App Banner. */
export const IOS_APP_STORE_ID = '6760983231';

export const IOS_APP_STORE_URL = `https://apps.apple.com/mx/app/nexus-geminislabs/id${IOS_APP_STORE_ID}`;

/** applicationId del flavor prod de nexus-android. */
export const ANDROID_PACKAGE_NAME = 'com.geminislabs.nexus';

/**
 * SHA-256 de los certificados que firman la app. Hoy solo el keystore de
 * release (alias `nexus`). Si la app sale por Google Play con Firma de apps de
 * Play, lo instalado desde la tienda trae la huella de Google: va aquí también.
 */
export const ANDROID_SHA256_CERT_FINGERPRINTS = [
	'C6:F1:B7:0D:8C:5C:BD:FE:56:48:57:97:30:66:5E:DF:AC:BE:E6:F1:4B:B1:52:72:C4:7B:27:9C:EC:32:9C:A8'
];

/**
 * Lo que sirve `/.well-known/assetlinks.json`. Android verifica el dominio
 * completo; qué rutas abren la app lo decide el intent-filter del manifest.
 */
export function androidAssetLinks() {
	return [
		{
			relation: ['delegate_permission/common.handle_all_urls'],
			target: {
				namespace: 'android_app',
				package_name: ANDROID_PACKAGE_NAME,
				sha256_cert_fingerprints: ANDROID_SHA256_CERT_FINGERPRINTS
			}
		}
	];
}

/**
 * Lo que sirve `/.well-known/apple-app-site-association`. Solo reclama
 * `/invite/*`: el resto del dominio es el panel y debe seguir abriendo en el
 * navegador.
 */
export function appleAppSiteAssociation() {
	return {
		applinks: {
			details: [
				{
					appIDs: [IOS_APP_ID],
					components: [{ '/': '/invite/*', comment: 'Invitaciones a equipos' }]
				}
			]
		}
	};
}

/**
 * El esquema propio de la app, para el botón «Abrir en la app» cuando el
 * universal link no entró (por ejemplo, si se pegó en la barra del navegador).
 * @param {string} token
 */
export function enlaceDeLaAppParaInvitacion(token) {
	return `inexus://invite/${encodeURIComponent(token)}`;
}
