/**
 * Estado del formulario de la pantalla de marca (B4), sin Svelte.
 *
 * El contrato es el `version: 1` de siscom-admin-api (`app/schemas/branding.py`).
 * El servidor es la única autoridad: valida, deriva los tokens y decide qué pasa
 * AA. Lo que se valida aquí repite sus reglas solo para avisar antes de enviar;
 * si las dos versiones discrepan, gana el 422 del servidor, que se muestra
 * campo por campo (`fieldErrorsFromApi`).
 */

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const MAX_URL_LENGTH = 2048;
const MAX_NAME_LENGTH = 80;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
// Igual de permisivo que haga falta para avisar; el servidor usa EmailStr.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pausa al escribir una URL antes de pedir la imagen de la vista previa. */
export const PREVIEW_DELAY_MS = 600;

/** El color con el que arranca una marca nueva: el azul de la paleta de Tailwind. */
export const DEFAULT_PRIMARY = '#2563eb';

/**
 * @typedef {{
 *   brand_name: string,
 *   logo_url: string,
 *   logo_dark_url: string,
 *   favicon_url: string,
 *   support_email: string,
 *   legal_url: string,
 *   primary: string,
 *   accent: string,
 *   useAccent: boolean
 * }} BrandForm
 */

/** @returns {BrandForm} */
export function emptyBrandForm() {
	return {
		brand_name: '',
		logo_url: '',
		logo_dark_url: '',
		favicon_url: '',
		support_email: '',
		legal_url: '',
		primary: DEFAULT_PRIMARY,
		accent: '',
		useAccent: false
	};
}

/** @param {unknown} value */
export function isHexColor(value) {
	return typeof value === 'string' && HEX_RE.test(value);
}

/**
 * El formulario a partir de lo que devolvió `GET /branding`. Se edita el
 * borrador si existe; si no, una copia de lo publicado; si tampoco, en blanco.
 * @param {Record<string, any> | null | undefined} branding
 * @returns {{ form: BrandForm, source: 'draft' | 'published' | 'empty' }}
 */
export function formFromBranding(branding) {
	const draft = branding?.draft;
	const published = branding?.published;

	/** @type {Record<string, any> | null} */
	let content = null;
	/** @type {'draft' | 'published' | 'empty'} */
	let source = 'empty';
	if (draft && typeof draft === 'object') {
		content = draft;
		source = 'draft';
	} else if (published && typeof published === 'object' && Object.keys(published).length) {
		// El nombre publicado vive en la columna, no dentro de `published`.
		content = { ...published, brand_name: branding?.brand_name ?? '' };
		source = 'published';
	}

	const form = emptyBrandForm();
	if (!content) {
		if (branding?.brand_name) form.brand_name = branding.brand_name;
		return { form, source };
	}

	for (const key of [
		'brand_name',
		'logo_url',
		'logo_dark_url',
		'favicon_url',
		'support_email',
		'legal_url'
	]) {
		if (typeof content[key] === 'string') form[key] = content[key];
	}
	if (isHexColor(content.seed?.primary)) form.primary = content.seed.primary.toLowerCase();
	if (isHexColor(content.seed?.accent)) {
		form.accent = content.seed.accent.toLowerCase();
		form.useAccent = true;
	}
	return { form, source };
}

/**
 * El cuerpo de `PUT /branding/draft`. Los opcionales vacíos no se mandan: el
 * contrato los quiere ausentes, no como cadena vacía.
 * @param {BrandForm} form
 */
export function draftPayload(form) {
	/** @type {Record<string, any>} */
	const payload = {
		brand_name: form.brand_name.trim(),
		logo_url: form.logo_url.trim(),
		support_email: form.support_email.trim(),
		legal_url: form.legal_url.trim(),
		seed: { primary: form.primary.toLowerCase() }
	};
	const dark = form.logo_dark_url.trim();
	const favicon = form.favicon_url.trim();
	if (dark) payload.logo_dark_url = dark;
	if (favicon) payload.favicon_url = favicon;
	if (form.useAccent && form.accent) payload.seed.accent = form.accent.toLowerCase();
	return payload;
}

/** @param {string} host */
function isIpLiteral(host) {
	if (host.startsWith('[')) return true; // IPv6 entre corchetes
	return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * La regla de las URLs del tema, la misma que `validar_url_publica` del
 * backend: `https://`, sin usuario ni contraseña, con nombre de dominio (no
 * IP ni `localhost`) y 2 048 caracteres como máximo.
 * @param {string} raw
 * @returns {string | null} el problema, o `null` si es válida
 */
export function urlProblem(raw) {
	const value = String(raw ?? '').trim();
	if (value.length > MAX_URL_LENGTH) return `La URL supera ${MAX_URL_LENGTH} caracteres.`;
	/** @type {URL} */
	let url;
	try {
		url = new URL(value);
	} catch {
		return 'No es una URL válida.';
	}
	if (url.protocol !== 'https:') return 'La URL debe empezar con https://';
	if (url.username || url.password) return 'La URL no puede llevar usuario ni contraseña.';
	const host = url.hostname.replace(/\.$/, '');
	if (host === 'localhost' || host.endsWith('.localhost'))
		return 'La URL no puede apuntar a localhost.';
	if (isIpLiteral(host)) return 'La URL debe usar un nombre de dominio, no una IP.';
	if (!host.includes('.')) return 'La URL necesita un nombre de dominio.';
	return null;
}

/**
 * Los problemas que se ven sin preguntar al servidor, por campo.
 * @param {BrandForm} form
 * @returns {Record<string, string>}
 */
export function validateBrandForm(form) {
	/** @type {Record<string, string>} */
	const errors = {};
	const name = form.brand_name.trim();
	if (!name) errors.brand_name = 'Escribe el nombre de la marca.';
	else if (name.length > MAX_NAME_LENGTH)
		errors.brand_name = `Máximo ${MAX_NAME_LENGTH} caracteres.`;

	if (!form.support_email.trim()) errors.support_email = 'Escribe el correo de soporte.';
	else if (!EMAIL_RE.test(form.support_email.trim()))
		errors.support_email = 'No es un correo válido.';

	for (const [field, required] of [
		['logo_url', true],
		['legal_url', true],
		['logo_dark_url', false],
		['favicon_url', false]
	]) {
		const value = form[/** @type {keyof BrandForm} */ (field)];
		if (typeof value !== 'string' || !value.trim()) {
			if (required) errors[field] = 'Este campo es obligatorio.';
			continue;
		}
		const problem = urlProblem(value);
		if (problem) errors[field] = problem;
	}

	if (!isHexColor(form.primary)) errors.primary = 'El color debe ser #rrggbb.';
	if (form.useAccent && !isHexColor(form.accent)) errors.accent = 'El color debe ser #rrggbb.';
	return errors;
}

/**
 * Si dos formularios mandarían lo mismo al servidor. Es lo que decide si hay
 * cambios sin guardar.
 * @param {BrandForm} a
 * @param {BrandForm} b
 */
export function sameBrandForm(a, b) {
	return JSON.stringify(draftPayload(a)) === JSON.stringify(draftPayload(b));
}

/** Campo del contrato → campo del formulario. */
const FIELD_FROM_LOC = {
	brand_name: 'brand_name',
	logo_url: 'logo_url',
	logo_dark_url: 'logo_dark_url',
	favicon_url: 'favicon_url',
	support_email: 'support_email',
	legal_url: 'legal_url',
	primary: 'primary',
	accent: 'accent'
};

/**
 * Nuestros validadores responden en español con el prefijo «Value error,»;
 * los de Pydantic (EmailStr, largos, faltantes) en inglés, y esos no se
 * muestran tal cual.
 * @param {string} field
 * @param {string} msg
 */
function messageFor(field, msg) {
	const raw = String(msg ?? '');
	if (/^Value error,/i.test(raw) && field !== 'support_email') {
		const clean = raw.replace(/^Value error,\s*/i, '').trim();
		if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1);
	}
	if (field === 'support_email') return 'No es un correo válido.';
	if (field === 'brand_name') return `Entre 1 y ${MAX_NAME_LENGTH} caracteres.`;
	return 'Valor no válido.';
}

/**
 * Traduce un 422 del servidor a errores por campo.
 *
 * Hay dos formas: la de Pydantic (`detail` es una lista con `loc`) y la del
 * contraste (`detail.code === 'contraste_insuficiente'`, con los pares que no
 * llegan). La segunda casi no debería verse —el servidor ajusta la semilla
 * antes de rendirse—, pero si llega, se dice qué par y con qué ratio.
 *
 * @param {{ status?: number, detail?: unknown } | null | undefined} error
 * @returns {{ fields: Record<string, string>, contrast: Array<Record<string, any>> } | null}
 */
export function fieldErrorsFromApi(error) {
	if (!error || error.status !== 422) return null;
	const detail = /** @type {any} */ (error.detail);

	if (detail && typeof detail === 'object' && detail.code === 'contraste_insuficiente') {
		return { fields: {}, contrast: Array.isArray(detail.pairs) ? detail.pairs : [] };
	}

	/** @type {Record<string, string>} */
	const fields = {};
	if (Array.isArray(detail)) {
		for (const item of detail) {
			const loc = Array.isArray(item?.loc) ? item.loc : [];
			const last = loc[loc.length - 1];
			const field = FIELD_FROM_LOC[/** @type {keyof typeof FIELD_FROM_LOC} */ (last)];
			if (field && !fields[field]) fields[field] = messageFor(field, item.msg);
		}
	}
	return { fields, contrast: [] };
}

const MODE_LABEL = { light: 'modo claro', dark: 'modo oscuro' };
const ROLE_LABEL = { '--color-brand-primary': 'primario', '--color-brand-accent': 'acento' };

/**
 * El ajuste que hizo el servidor a una semilla, en una frase.
 * @param {{ modo?: string, token?: string, semilla?: string, usado?: string }} adjustment
 */
export function describeAdjustment(adjustment) {
	const mode =
		MODE_LABEL[/** @type {keyof typeof MODE_LABEL} */ (adjustment.modo)] ?? adjustment.modo;
	const role =
		ROLE_LABEL[/** @type {keyof typeof ROLE_LABEL} */ (adjustment.token)] ?? adjustment.token;
	return `En ${mode}, el color ${role} ${adjustment.semilla} no contrasta lo suficiente con el fondo; se usa ${adjustment.usado}.`;
}

/**
 * Un par que no llega a AA, en una frase.
 * @param {{ modo?: string, par?: string, ratio?: number, minimo?: number }} pair
 */
export function describePair(pair) {
	const mode = MODE_LABEL[/** @type {keyof typeof MODE_LABEL} */ (pair.modo)] ?? pair.modo;
	return `En ${mode}, «${pair.par}» tiene contraste ${pair.ratio}:1 y necesita ${pair.minimo}:1.`;
}

/**
 * Los tokens con los que se pinta la previsualización: los del borrador; sin
 * borrador, los publicados; sin nada, `null` (la maqueta usa el tema de Nexus).
 * @param {Record<string, any> | null | undefined} branding
 * @param {'light' | 'dark'} mode
 * @returns {Record<string, string> | null}
 */
export function previewTokens(branding, mode) {
	const fromDraft = branding?.draft?.tokens?.[mode];
	if (fromDraft && typeof fromDraft === 'object') return fromDraft;
	const fromPublished = branding?.published?.tokens?.[mode];
	if (fromPublished && typeof fromPublished === 'object') return fromPublished;
	return null;
}

/**
 * La rampa 50…950 de unos tokens, en orden. Los pasos que falten se saltan.
 * @param {Record<string, string> | null | undefined} tokens
 * @returns {Array<{ step: number, color: string }>}
 */
export function rampFromTokens(tokens) {
	if (!tokens) return [];
	return RAMP_STEPS.map((step) => ({ step, color: tokens[`--color-brand-${step}`] })).filter(
		(entry) => isHexColor(entry.color)
	);
}

/**
 * Solo las variables `--color-brand-*` con un color válido. Es lo único que se
 * escribe en el contenedor de la previsualización: aunque los tokens los
 * genera nuestro servidor, la página no escribe CSS arbitrario que venga de la
 * red.
 * @param {Record<string, string> | null | undefined} tokens
 * @returns {Array<[string, string]>}
 */
export function safeCssVars(tokens) {
	if (!tokens || typeof tokens !== 'object') return [];
	return Object.entries(tokens).filter(
		([name, value]) => /^--color-brand-[a-z0-9-]+$/.test(name) && isHexColor(value)
	);
}

/**
 * Quién publicó por última vez y cuándo, en una frase. `null` si nunca se
 * publicó. El backend da el id de quien publicó, no su nombre: se distingue
 * solo si fue el propio usuario.
 * @param {Record<string, any> | null | undefined} branding
 * @param {string | null | undefined} currentUserId
 * @param {string} [locale]
 */
export function describeLastPublished(branding, currentUserId, locale = 'es-MX') {
	const at = branding?.published_at ? new Date(branding.published_at) : null;
	if (!at || Number.isNaN(at.getTime())) return null;
	const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
		at
	);
	const by = branding?.published_by;
	if (!by) return `Publicado el ${when}`;
	const who =
		currentUserId && String(by) === String(currentUserId) ? 'por ti' : 'por otro administrador';
	return `Publicado el ${when} ${who}`;
}
