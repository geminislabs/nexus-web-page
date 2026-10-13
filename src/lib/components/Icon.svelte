<script module>
	/**
	 * Ícono de Iconify sin red: los datos salen de `$lib/icons/mdi.json`, que
	 * genera `scripts/iconos.mjs` con los nombres que aparecen en `src/`.
	 * Misma API que `@iconify/svelte`; un nombre que no esté en el subconjunto
	 * no se pinta (y `tests/iconos.test.js` lo detecta antes).
	 */
	import { addCollection } from '@iconify/svelte/dist/offline-functions';
	import mdi from '$lib/icons/mdi.json';

	addCollection(mdi);
</script>

<script>
	import OfflineIcon from '@iconify/svelte/dist/OfflineIcon.svelte';

	let props = $props();
</script>

<OfflineIcon {...props} />
