import { dev } from '$app/environment';

function parseBooleanEnv(value, defaultValue) {
	if (value === undefined || value === null || value === '') return defaultValue;
	const normalized = String(value).trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return defaultValue;
}

// ByPass:
// - false => usar API real en dev
// - true  => bypass/mock en dev
export const bypassAuthInDev =
	dev && parseBooleanEnv(import.meta.env.VITE_BYPASS_AUTH_IN_DEV, false);
