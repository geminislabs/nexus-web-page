/**
 * Proxy same-origin para el exportador OTLP del browser.
 *
 * El cliente no puede hacer POST a :4318 (Chrome Private Network Access), así
 * que la telemetría del navegador pasa por aquí.
 *
 * Esta ruta es **pública**: el prefijo `internal` no la protege, igual que no
 * protegía `/internal/*` en la API. Lo que la protege es lo de abajo — techo de
 * tamaño, límite de tasa y comprobación de origen — porque en cuanto haya un
 * collector detrás, cualquiera puede inyectarle telemetría falsa o llenarlo.
 */

// Los ayudantes van con `_` porque SvelteKit solo admite en un `+server.js` los
// verbos HTTP y nombres con ese prefijo; sin el, el build falla al analizar la
// ruta — no las pruebas, el build.
const ALLOWED = new Set(['v1/logs', 'v1/metrics', 'v1/traces']);

/** Un lote OTLP del browser no llega a esto ni de lejos. */
const MAX_BODY_BYTES = 512 * 1024;

/** Ventana del límite de tasa, por dirección de cliente. */
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 240;
/** Techo de memoria del contador: por encima se tira entero y se reempieza. */
const MAX_CLIENTES = 5_000;

/** @type {Map<string, { desde: number, golpes: number }>} */
const contador = new Map();

/**
 * @param {string} cliente
 * @param {number} ahora
 * @returns {boolean} true si hay que rechazar
 */
export function _excedeLaTasa(cliente, ahora = Date.now()) {
	if (contador.size > MAX_CLIENTES) contador.clear();

	const previo = contador.get(cliente);
	if (!previo || ahora - previo.desde >= VENTANA_MS) {
		contador.set(cliente, { desde: ahora, golpes: 1 });
		return false;
	}
	previo.golpes += 1;
	return previo.golpes > MAX_POR_VENTANA;
}

export function _reiniciarContadorParaTests() {
	contador.clear();
}

/**
 * Same-origin de verdad: se compara contra el `Host` de la petición y no contra
 * `url.origin`, que detrás de un proxy puede no ser el que el cliente pidió.
 * Sin `Origin` no se rechaza: hay clientes legítimos que no lo mandan, y el
 * cuerpo ya va acotado y contado.
 * @param {Request} request
 */
export function _origenAjeno(request) {
	const origin = request.headers.get('origin');
	if (!origin) return false;

	const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
	if (!host) return true;

	try {
		return new URL(origin).host !== host;
	} catch {
		return true;
	}
}

function collectorBase() {
	const env = typeof process !== 'undefined' && process.env ? process.env : {};

	if ('OTLP_ENDPOINT' in env) {
		return String(env.OTLP_ENDPOINT || '')
			.trim()
			.replace(/\/$/, '');
	}

	// Fail-closed: solo en desarrollo declarado se asume el collector local.
	// Antes bastaba con que `NODE_ENV` no fuera 'production' — un contenedor mal
	// configurado se ponía a hacer POSTs con timeout de 3 s en cada beacon.
	const esDesarrollo = env.DEPLOY_ENV === 'local' || env.NODE_ENV === 'development';
	return esDesarrollo ? 'http://localhost:4318' : '';
}

function abortSignal(ms) {
	if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
		return AbortSignal.timeout(ms);
	}
	const controller = new AbortController();
	setTimeout(() => controller.abort(), ms);
	return controller.signal;
}

export async function POST({ params, request, getClientAddress }) {
	try {
		const path = String(params.path || '');
		if (!ALLOWED.has(path)) {
			return new Response(null, { status: 404 });
		}

		if (_origenAjeno(request)) {
			return new Response(null, { status: 403 });
		}

		let cliente = 'desconocido';
		try {
			cliente = typeof getClientAddress === 'function' ? getClientAddress() : 'desconocido';
		} catch {
			/* el adaptador puede no saberlo; se cuenta como uno solo */
		}
		if (_excedeLaTasa(cliente)) {
			return new Response(null, { status: 429 });
		}

		// El `content-length` puede mentir, así que se mira dos veces: antes de
		// leer, para no traerse el cuerpo, y después, sobre lo leído de verdad.
		const declarado = Number(request.headers.get('content-length') || 0);
		if (Number.isFinite(declarado) && declarado > MAX_BODY_BYTES) {
			return new Response(null, { status: 413 });
		}

		const base = collectorBase();
		if (!base) return new Response(null, { status: 204 });

		const body = await request.arrayBuffer();
		if (body.byteLength > MAX_BODY_BYTES) {
			return new Response(null, { status: 413 });
		}

		await fetch(`${base}/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			signal: abortSignal(3000)
		});
	} catch {
		/* fail-open: la telemetría nunca tumba una petición */
	}
	return new Response(null, { status: 204 });
}
