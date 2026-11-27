<script>
	/**
	 * Vista Panel: «En vivo · 12 unidades · hace 2 s». Late mientras llegan
	 * posiciones por el stream; pasa a ámbar al reconectar y a gris sin datos.
	 * Con la retícula encendida muestra también las coordenadas del centro.
	 */
	import { streamStatus } from '$lib/services/vehiclePositionStream.js';
	import { mapView } from '$lib/services/mapService.js';
	import { clock, sinceLabel } from '$lib/stores/clockStore.js';

	let { showCoords = false } = $props();

	/** Más de 2 min sin posiciones: el stream está abierto pero callado. */
	const QUIET_MS = 120_000;

	const st = $derived($streamStatus);
	const quiet = $derived(
		st.state === 'live' && (st.lastMessageAt == null || $clock - st.lastMessageAt > QUIET_MS)
	);
	const tone = $derived(
		st.state === 'live' && !quiet
			? 'text-emerald-500'
			: st.state === 'reconnecting' || st.state === 'connecting'
				? 'text-amber-500'
				: 'text-slate-400 dark:text-white/40'
	);
	const label = $derived(
		st.state === 'off'
			? 'Sin conexión en vivo'
			: st.state === 'connecting'
				? 'Conectando…'
				: st.state === 'reconnecting'
					? 'Reconectando…'
					: 'En vivo'
	);
	const since = $derived(sinceLabel(st.lastMessageAt, $clock));

	/** 20.597227 → «20.5972° N». */
	function coord(/** @type {number} */ v, /** @type {'lat'|'lng'} */ axis) {
		const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'O';
		return `${Math.abs(v).toFixed(4)}° ${hemi}`;
	}
</script>

<div
	class="nx-reopen inline-flex h-8 items-center gap-2 rounded-full px-3 text-[11.5px]"
	role="status"
	aria-live="polite"
>
	<span class="nx-live-dot bg-current {tone} {st.state === 'live' && !quiet ? '' : 'after:hidden'}"
	></span>
	<span class="font-medium">{label}</span>
	{#if st.devices}
		<span class="nx-muted">· {st.devices} {st.devices === 1 ? 'unidad' : 'unidades'}</span>
	{/if}
	{#if since && st.state === 'live'}
		<span class="nx-mono nx-muted">· {since}</span>
	{/if}
	{#if showCoords && $mapView}
		<span class="nx-mono nx-muted hidden lg:inline"
			>· {coord($mapView.lat, 'lat')}
			{coord($mapView.lng, 'lng')} · z{Math.round($mapView.zoom)}</span
		>
	{/if}
</div>
