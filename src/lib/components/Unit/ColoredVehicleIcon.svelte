<script>
	import { browser } from '$app/environment';
	import { buildColoredUnitIconDataUrl } from '$lib/utils/vehicleMarkerIcon.js';

	export let src = '';
	export let colorHex = '#334155';
	export let sizeClass = 'h-8 w-8';
	export let alt = 'Icono de vehículo';

	/** @type {string} */
	let dataUrl = '';
	/** @type {number} */
	let loadGen = 0;

	$: if (browser) {
		void loadColored(src, colorHex);
	}

	/**
	 * @param {string} nextSrc
	 * @param {string} nextColor
	 */
	async function loadColored(nextSrc, nextColor) {
		const gen = ++loadGen;
		if (!nextSrc) {
			dataUrl = '';
			return;
		}
		try {
			const url = await buildColoredUnitIconDataUrl(nextSrc, nextColor || '#334155', 128);
			if (gen !== loadGen) return;
			dataUrl = url || '';
		} catch {
			if (gen !== loadGen) return;
			dataUrl = '';
		}
	}
</script>

{#if dataUrl}
	<img src={dataUrl} {alt} class="pointer-events-none object-contain {sizeClass}" />
{:else}
	<!-- Fallback inmediato: silueta con el color de perfil (antes de que cargue el canvas) -->
	<div
		class="pointer-events-none {sizeClass}"
		style="
			background-color: {colorHex};
			-webkit-mask-image: url('{src}');
			mask-image: url('{src}');
			-webkit-mask-size: contain;
			mask-size: contain;
			-webkit-mask-repeat: no-repeat;
			mask-repeat: no-repeat;
			-webkit-mask-position: center;
			mask-position: center;
		"
		role="img"
		aria-label={alt}
	></div>
{/if}
