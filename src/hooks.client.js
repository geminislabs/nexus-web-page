import { installBrowserErrorCapture, reportUnhandled } from '$lib/observability/capture.js';
import { init } from '$lib/observability/index.js';

await init();
installBrowserErrorCapture();

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, message }) {
	reportUnhandled(error, 'sveltekit');
	return { message };
}
