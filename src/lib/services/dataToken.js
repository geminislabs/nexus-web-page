/**
 * Credencial del plano de datos (siscom-api).
 *
 * siscom-api no verifica el token de sesión: verifica un PASETO v4.public
 * emitido por la admin-api cuyo contenido es únicamente `{ jti, scope_ref,
 * aud, iat, nbf, exp }`. No lleva identidad de usuario ni de organización —
 * el alcance vive en Valkey y siscom-api lo resuelve sin saber de quién es.
 *
 * Este módulo es el único dueño de esa credencial. Los call sites no la
 * obtienen ni la refrescan: piden `withDataToken(...)` y se olvidan.
 *
 * Dos invariantes que no son cosméticas:
 *
 * 1. **Una sola emisión en vuelo.** Emitir revoca los tokens anteriores del
 *    mismo sujeto, así que dos emisiones concurrentes se revocan entre sí y
 *    dejan al usuario sin credencial válida. Se comparte la promesa.
 * 2. **Un solo reintento.** Por lo mismo: un bucle de reintentos es un bucle
 *    de revocaciones. Si el segundo intento falla, el error se propaga.
 *
 * Solo en memoria, nunca en `localStorage`: vive minutos, se re-obtiene con la
 * sesión y así no sobrevive a la pestaña ni se cruza entre marcas.
 */

import { apiService } from './api.js';
import { logger } from '$lib/utils/logger.js';

/** Se refresca al consumir esta fracción de la vida útil del token. */
const REFRESH_AT_FRACTION = 0.8;

/** Margen para no presentar un token que expira en vuelo. */
const EXPIRY_SKEW_MS = 5_000;

/** Vida asumida si el emisor no la declara. El contrato fija 10 min de techo. */
const FALLBACK_TTL_MS = 600_000;

/**
 * Marcador de subprotocolo del WebSocket. El servidor hace eco de ESTE valor,
 * nunca del token, para que la credencial no acabe en los logs del proxy.
 *
 * Nombra el protocolo y no a quien lo habla: son tres los frontends que hablan
 * con siscom-api, así que un marcador llamado «nexus» obligaría a gac-web a
 * anunciarse con el nombre de otro cliente. Lleva versión para poder negociar
 * el día que cambie el formato.
 */
export const WS_TOKEN_PROTOCOL = 'siscom.data-token.v1';

/** @typedef {{ token: string, expiresAtMs: number, refreshAtMs: number }} DataTokenEntry */

/** @type {DataTokenEntry | null} */
let cached = null;

/** @type {Promise<DataTokenEntry> | null} */
let inFlight = null;

/** Error del plano de datos que el token vigente no puede resolver. */
export class DataPlaneForbiddenError extends Error {
	/** @param {string} [message] */
	constructor(message = 'El plano de datos rechazó el alcance solicitado') {
		super(message);
		this.name = 'DataPlaneForbiddenError';
	}
}

/**
 * Vida útil declarada por el emisor. El TTL es adaptativo —la admin-api lo
 * recorta al siguiente límite de ventana horaria—, así que se lee de la
 * respuesta y no se asume constante.
 * @param {any} payload
 * @returns {number} epoch ms
 */
function readExpiry(payload) {
	const seconds = Number(payload?.expires_in);
	if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000;

	const absolute = payload?.expires_at ?? payload?.exp;
	if (typeof absolute === 'number' && Number.isFinite(absolute)) {
		// Segundos epoch si viene como número.
		return absolute * 1000;
	}
	if (typeof absolute === 'string') {
		const parsed = Date.parse(absolute);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return Date.now() + FALLBACK_TTL_MS;
}

/**
 * La credencial tiene la **misma forma** en los dos caminos que la producen:
 * anidada bajo `data_token` en `/auth/login`, y como cuerpo entero en
 * `POST /auth/data-token`. Un solo parser para ambos — si se aplanara uno de
 * los dos, harían falta dos y se desincronizarían.
 *
 * @param {any} payload
 * @returns {DataTokenEntry | null}
 */
function parseCredential(payload) {
	// Una sola forma, sin alternativas toleradas: aceptar varios nombres para el
	// mismo campo esconde un renombrado del emisor hasta que algo falla en
	// producción por un motivo que parece no tener relación.
	const token = payload?.token;
	if (typeof token !== 'string' || !token) return null;

	const expiresAtMs = readExpiry(payload);
	const lifetime = Math.max(expiresAtMs - Date.now(), 0);

	return {
		token,
		expiresAtMs,
		// Margen proporcional: con un TTL adaptativo de 45 s un margen fijo se
		// comería casi toda la vida útil.
		refreshAtMs: Date.now() + lifetime * REFRESH_AT_FRACTION
	};
}

/**
 * @param {DataTokenEntry | null} entry
 * @returns {boolean}
 */
function isFresh(entry) {
	return (
		Boolean(entry) &&
		Date.now() + EXPIRY_SKEW_MS < /** @type {DataTokenEntry} */ (entry).refreshAtMs
	);
}

/**
 * @param {DataTokenEntry | null} entry
 * @returns {boolean}
 */
function isUsable(entry) {
	return (
		Boolean(entry) &&
		Date.now() + EXPIRY_SKEW_MS < /** @type {DataTokenEntry} */ (entry).expiresAtMs
	);
}

/**
 * Pide un token nuevo a la admin-api. No llamar directamente: pasa por
 * `getDataToken`, que garantiza una sola emisión en vuelo.
 * @returns {Promise<DataTokenEntry>}
 */
async function issue() {
	const entry = parseCredential(await apiService.request('/auth/data-token', { method: 'POST' }));

	if (!entry) {
		throw new Error('La admin-api no devolvió un token de plano de datos');
	}

	return entry;
}

/**
 * Devuelve un token utilizable, emitiendo o refrescando si hace falta.
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function getDataToken({ force = false } = {}) {
	if (!force && isFresh(cached)) return /** @type {DataTokenEntry} */ (cached).token;

	// Si ya hay una emisión en curso, esperarla en vez de lanzar otra: la
	// segunda revocaría a la primera.
	if (inFlight) return (await inFlight).token;

	if (force) cached = null;

	inFlight = issue()
		.then((entry) => {
			cached = entry;
			return entry;
		})
		.catch((err) => {
			// Un token todavía válido es mejor que ninguno si el refresco
			// preventivo falla por un corte puntual.
			if (!force && isUsable(cached)) {
				logger.warn({
					code: 'DATA_TOKEN_REFRESH_FAILED',
					message: 'Refresco del token de datos fallido; se conserva el vigente',
					err
				});
				return /** @type {DataTokenEntry} */ (cached);
			}
			cached = null;
			throw err;
		})
		.finally(() => {
			inFlight = null;
		});

	return (await inFlight).token;
}

/**
 * Siembra la credencial con la que `/auth/login` adjunta como conveniencia, y
 * ahorra un round trip en el arranque en frío — justo cuando el mapa tiene que
 * pintar.
 *
 * La admin-api la adjunta en *best effort*: si el plano de datos no está
 * configurado o Valkey no responde, viene a `null` y el login sigue siendo
 * válido. **Eso es funcionamiento normal, no un error**: sin mapa se entra
 * igual. En ese caso no se siembra nada y el token se pedirá al endpoint
 * dedicado, que es la autoridad.
 *
 * Ojo con la vida útil, porque hay dos `expires_in` en la misma respuesta: el
 * de primer nivel es el de la **sesión** —una hora—; el que vale está
 * **dentro** de `data_token` y son minutos, ya con el TTL adaptativo aplicado.
 * Tomar el de fuera daría por fresca una credencial caducada hace rato y
 * mandaría cada petición al camino de reintento.
 *
 * @param {{ data_token?: { token?: string, expires_in?: number, expires_at?: string } | null } | null | undefined} loginResponse
 */
export function primeDataToken(loginResponse) {
	const entry = parseCredential(loginResponse?.data_token);
	if (entry) cached = entry;
}

/** Descarta la credencial en memoria. Llamar al cerrar sesión. */
export function clearDataToken() {
	cached = null;
	inFlight = null;
}

/**
 * Ejecuta una operación con el token vigente y la reintenta **una sola vez**
 * con un token recién emitido si el plano de datos la rechaza.
 *
 * siscom-api responde 403 a la petición entera cuando alguna referencia no
 * está en el alcance —devolver el subconjunto permitido convertiría la API en
 * un oráculo para reconstruir flotas ajenas sondeando—. Como la emisión
 * recalcula el alcance, una referencia que quedó obsoleta desaparece en el
 * reintento y el caso se cura solo. Si vuelve a fallar, es un rechazo real:
 * quien llama debe recargar su lista de unidades.
 *
 * @template T
 * @param {(token: string) => Promise<Response>} run
 * @param {(response: Response) => Promise<T>} parse
 * @returns {Promise<T>}
 */
export async function withDataToken(run, parse) {
	let response = await run(await getDataToken());

	if (response.status === 401 || response.status === 403) {
		logger.warn({
			code: 'DATA_TOKEN_REJECTED',
			message: 'Plano de datos rechazó el token; reemitiendo y reintentando una vez',
			context: { status: response.status }
		});
		response = await run(await getDataToken({ force: true }));
	}

	if (response.status === 401 || response.status === 403) {
		throw new DataPlaneForbiddenError();
	}

	return parse(response);
}
