/**
 * URLs del juego documental legal corporativo (geminislabs.com).
 * Fuente única: no duplicar estos paths en plantillas.
 */

const FALLBACK_COMPANY_URL = 'https://www.geminislabs.com';

/**
 * @returns {string} Origen del sitio corporativo sin barra final.
 */
export function getCompanyBaseUrl() {
	const fromEnv = String(import.meta.env.VITE_COMPANY_URL || '')
		.trim()
		.replace(/\/$/, '');
	return fromEnv || FALLBACK_COMPANY_URL;
}

/** @typedef {{ id: string, label: string, href: string }} LegalLink */

/**
 * @returns {readonly LegalLink[]}
 */
export function getLegalLinks() {
	const base = getCompanyBaseUrl();
	return Object.freeze([
		{ id: 'privacidad', label: 'Privacidad', href: `${base}/legal/privacidad` },
		{ id: 'terminos', label: 'Términos', href: `${base}/legal/terminos` },
		{ id: 'aviso-legal', label: 'Aviso legal', href: `${base}/legal/aviso-legal` },
		{ id: 'cookies', label: 'Cookies', href: `${base}/legal/cookies` }
	]);
}
