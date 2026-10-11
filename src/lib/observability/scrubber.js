const FORBIDDEN_KEYS = [
	'password',
	'passwd',
	'pass',
	'token',
	'access_token',
	'refresh_token',
	'id_token',
	'authorization',
	'auth',
	'jwt',
	'bearer',
	'secret',
	'client_secret',
	'api_secret',
	'api_key',
	'apikey',
	'x-api-key',
	'stripe_secret',
	'stripe_key',
	'recaptcha',
	'recaptcha_token',
	'g-recaptcha-response',
	'cookie',
	'set-cookie',
	'session',
	'email',
	'lat',
	'lng',
	'latitude',
	'longitude',
	'otp',
	'curp',
	'rfc',
	'phone',
	'telefono',
	'nombre',
	'name',
	'message',
	'credit_card',
	'card_number',
	'cvv',
	'imei',
	'user_data',
	'payload',
	'body',
	'request_body',
	'response_body'
];

const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_KEYS);

const FORBIDDEN_HEADERS = [
	'authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-auth-token',
	'x-session-token'
];

const FORBIDDEN_HEADER_SET = new Set(FORBIDDEN_HEADERS);
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_MESSAGE = 300;
/**
 * Un stack recortado a 300 caracteres no sirve para depurar: cabe el mensaje y
 * dos marcos. Se le deja su propio techo, generoso pero acotado.
 */
const MAX_STACK = 8_000;
const MAX_DEPTH = 8;

function isForbiddenKey(key) {
	return FORBIDDEN_KEY_SET.has(String(key).toLowerCase());
}

function scrubValue(value, depth) {
	if (depth > MAX_DEPTH) return '[REDACTED]';
	if (value == null) return value;
	if (typeof value === 'string') return value.replace(EMAIL_RE, '[REDACTED]');
	if (typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) =>
			item && typeof item === 'object' ? scrubValue(item, depth + 1) : item
		);
	}
	if (typeof value === 'object') {
		return scrubCopy(value, depth + 1);
	}
	return '[REDACTED]';
}

function scrubCopy(input, depth) {
	const out = {};
	for (const [key, value] of Object.entries(input)) {
		if (isForbiddenKey(key)) {
			out[key] = '[REDACTED]';
			continue;
		}
		out[key] = scrubValue(value, depth);
	}
	return out;
}

export function scrubAttrs(attrs) {
	try {
		if (attrs == null || typeof attrs !== 'object' || Array.isArray(attrs)) return {};
		return scrubCopy(attrs, 0);
	} catch {
		return {};
	}
}

export function scrubUrl(url) {
	try {
		const text = String(url ?? '');
		return text.split('?')[0];
	} catch {
		return '';
	}
}

export function scrubHeaders(headersObj) {
	try {
		const out = {};
		if (headersObj == null || typeof headersObj !== 'object') return out;
		const entries =
			typeof Headers !== 'undefined' && headersObj instanceof Headers
				? headersObj.entries()
				: Object.entries(headersObj);
		for (const [key, value] of entries) {
			if (FORBIDDEN_HEADER_SET.has(String(key).toLowerCase())) continue;
			out[String(key)] = String(value);
		}
		return out;
	} catch {
		return {};
	}
}

export function scrubMessage(msg) {
	try {
		let text = String(msg ?? '');
		const queryAt = text.indexOf('?');
		if (queryAt >= 0) text = text.slice(0, queryAt);
		text = text.replace(EMAIL_RE, '[REDACTED]');
		return text.length > MAX_MESSAGE ? text.slice(0, MAX_MESSAGE) : text;
	} catch {
		return '';
	}
}

/**
 * Como `scrubMessage` pero para stacks.
 *
 * `scrubMessage` corta el texto entero en el primer `?`, lo que en un stack
 * deja fuera todos los marcos que vengan detrás del primero que lleve una URL
 * con query. Aquí se quita **cada** query por separado y se conserva el resto,
 * porque el recorte no era una decision de privacidad: era un efecto colateral
 * que ademas se llevaba por delante la informacion util.
 * @param {unknown} stack
 */
export function scrubStack(stack) {
	try {
		const sinQuery = String(stack ?? '').replace(/\?[^\s)'"]*/g, '');
		return sinQuery.length > MAX_STACK ? sinQuery.slice(0, MAX_STACK) : sinQuery;
	} catch {
		return '';
	}
}

export const scrubber = {
	scrubAttrs,
	scrubUrl,
	scrubHeaders,
	scrubMessage,
	scrubStack
};
