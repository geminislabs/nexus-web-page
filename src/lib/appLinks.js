/**
 * Enlaces que abren las apps móviles desde este dominio.
 *
 * admin-api arma las invitaciones a equipos como
 * `https://nexus.geminislabs.com/invite/<token>` (`INVITE_BASE_URL`). Para que iOS
 * le entregue ese enlace a la app en vez de abrir Safari, este dominio sirve el
 * `apple-app-site-association` y la app declara `applinks:nexus.geminislabs.com`.
 * Si la app no está instalada, se abre `/invite/[token]` en el navegador.
 */

/** Team ID de Apple + bundle id de INexus. */
export const IOS_APP_ID = 'GCNV65DKL8.GeminisLabs.INexus';

/** Id numérico de la ficha de App Store, para el Smart App Banner. */
export const IOS_APP_STORE_ID = '6760983231';

export const IOS_APP_STORE_URL = `https://apps.apple.com/mx/app/nexus-geminislabs/id${IOS_APP_STORE_ID}`;

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
