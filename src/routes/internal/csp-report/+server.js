/**
 * Receptor de `report-uri` del CSP (ver `src/lib/security/csp.js`).
 *
 * Cada violación sale como una línea JSON en stdout, así que se leen con
 * `docker logs nexus-web-page | grep csp_violation` sin depender de que haya
 * collector OTLP. Es una ruta pública por necesidad —el navegador manda el
 * reporte sin credenciales—, así que se acota igual que el proxy OTLP: cuerpo
 * pequeño, y cada violación distinta se registra una sola vez por proceso, para
 * que nadie pueda llenar los logs repitiendo la misma.
 */
import { logWarn } from '$lib/observability/capture.js';
import { scrubUrl } from '$lib/observability/scrubber.js';

/** Un reporte `application/csp-report` mide unos cientos de bytes. */
const MAX_BODY_BYTES = 16 * 1024;
/** Techo de violaciones distintas recordadas; por encima se deja de registrar. */
const MAX_DISTINTAS = 500;

/** @type {Set<string>} */
const vistas = new Set();

export function _reiniciarParaTests() {
	vistas.clear();
}

/**
 * Del recurso bloqueado basta el origen: la ruta puede llevar tokens.
 * `inline`, `eval`, `data`… se conservan tal cual.
 * @param {unknown} raw
 */
export function _origenBloqueado(raw) {
	const text = String(raw ?? '').trim();
	if (!text) return '';
	try {
		const url = new URL(text);
		return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol.startsWith('ws')
			? url.origin
			: url.protocol.replace(/:$/, '');
	} catch {
		return text.slice(0, 40);
	}
}

/**
 * Página en la que ocurrió, sin query y sin el token de `/share/…`.
 * @param {unknown} raw
 */
export function _paginaSinToken(raw) {
	let path;
	try {
		path = new URL(String(raw ?? '')).pathname;
	} catch {
		path = scrubUrl(raw);
	}
	return path.startsWith('/share/') ? '/share/[token]' : path;
}

export async function POST({ request }) {
	try {
		const declarado = Number(request.headers.get('content-length') || 0);
		if (Number.isFinite(declarado) && declarado > MAX_BODY_BYTES) {
			return new Response(null, { status: 413 });
		}

		const body = await request.text();
		if (body.length > MAX_BODY_BYTES) {
			return new Response(null, { status: 413 });
		}

		const report = JSON.parse(body)?.['csp-report'];
		if (!report || typeof report !== 'object') {
			return new Response(null, { status: 204 });
		}

		const violation = {
			directive: String(report['effective-directive'] || report['violated-directive'] || ''),
			blocked: _origenBloqueado(report['blocked-uri']),
			page: _paginaSinToken(report['document-uri']),
			source: _origenBloqueado(report['source-file']),
			disposition: String(report.disposition || '')
		};

		const clave = `${violation.directive}|${violation.blocked}|${violation.page}`;
		if (vistas.has(clave) || vistas.size >= MAX_DISTINTAS) {
			return new Response(null, { status: 204 });
		}
		vistas.add(clave);

		console.warn(JSON.stringify({ event: 'csp_violation', ...violation }));
		logWarn('csp_violation', violation);
	} catch {
		/* fail-open: un reporte malformado no merece un 500 */
	}
	return new Response(null, { status: 204 });
}
