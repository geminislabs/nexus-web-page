<script>
	import Icon from '@iconify/svelte';
	import {
		h3Resolution,
		h3FollowZoom,
		h3Actions,
		H3_RES_MIN,
		H3_RES_MAX
	} from '$lib/stores/h3Store.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { mapService } from '$lib/services/mapService.js';

	/** Invertido: arriba = hexágonos grandes (res baja), abajo = pequeños (res alta). */
	$: sliderValue = H3_RES_MAX + H3_RES_MIN - $h3Resolution;
	$: isLight = $theme === 'light';

	function onSliderInput(e) {
		const inverted = Number(e.currentTarget.value);
		const res = H3_RES_MAX + H3_RES_MIN - inverted;
		h3Actions.setResolution(res, { source: 'user' });
	}

	function enableAuto() {
		h3Actions.enableFollowZoomAndSync(mapService.map?.getZoom?.());
	}
</script>

<div
	class="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl border px-2.5 py-3 shadow-lg backdrop-blur-xl
		{isLight
		? 'border-slate-200/90 bg-white/95 text-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.12)]'
		: 'border-white/12 bg-[rgb(8_12_22_/0.88)] text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]'}"
	role="group"
	aria-label="Tamaño de hexágonos H3"
	data-theme={$theme}
>
	<div class="flex flex-col items-center gap-0.5">
		<span
			class="flex h-7 w-7 items-center justify-center rounded-lg
				{isLight ? 'bg-cyan-500/15 text-cyan-700' : 'bg-cyan-400/15 text-cyan-300'}"
			aria-hidden="true"
		>
			<Icon icon="mdi:hexagon-outline" width={16} />
		</span>
		<span
			class="text-[9px] font-bold uppercase tracking-[0.12em]
				{isLight ? 'text-slate-500' : 'text-white/45'}">Wide</span
		>
	</div>

	<div class="relative flex h-[9.5rem] w-9 items-center justify-center">
		<div
			class="pointer-events-none absolute inset-y-1 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-400/70 via-emerald-400/50 to-cyan-400/80"
			aria-hidden="true"
		></div>
		<input
			type="range"
			class="h3-res-slider relative z-[1] h-[9.5rem] w-9 cursor-pointer appearance-none bg-transparent"
			min={H3_RES_MIN}
			max={H3_RES_MAX}
			step="1"
			value={sliderValue}
			aria-valuemin={H3_RES_MIN}
			aria-valuemax={H3_RES_MAX}
			aria-valuenow={$h3Resolution}
			aria-valuetext={`Resolución ${$h3Resolution}: hexágonos ${$h3Resolution >= 9 ? 'pequeños' : $h3Resolution <= 6 ? 'grandes' : 'medios'}`}
			aria-label="Graduar tamaño de hexágonos"
			title="Tamaño de hexágonos"
			on:input={onSliderInput}
		/>
	</div>

	<div class="flex flex-col items-center gap-0.5">
		<span
			class="text-[9px] font-bold uppercase tracking-[0.12em]
				{isLight ? 'text-slate-500' : 'text-white/45'}">Fine</span
		>
		<span
			class="mt-0.5 min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] font-bold tabular-nums
				{isLight ? 'bg-slate-100 text-cyan-800' : 'bg-white/10 text-cyan-200'}"
			aria-live="polite"
		>
			{$h3Resolution}
		</span>
	</div>

	{#if $h3FollowZoom}
		<span
			class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide
				{isLight ? 'bg-emerald-500/15 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300'}"
			title="La rejilla sigue el zoom del mapa"
		>
			Auto
		</span>
	{:else}
		<button
			type="button"
			class="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50
				{isLight
				? 'border-cyan-500/40 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
				: 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'}"
			on:click={enableAuto}
			title="Volver a ajustar con el zoom"
		>
			Auto
		</button>
	{/if}
</div>

<style>
	.h3-res-slider {
		writing-mode: vertical-lr;
		direction: rtl;
		appearance: slider-vertical;
		-webkit-appearance: slider-vertical;
	}

	.h3-res-slider::-webkit-slider-runnable-track {
		width: 6px;
		border-radius: 9999px;
		background: transparent;
	}

	.h3-res-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		margin-left: -6px;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.95);
		background: linear-gradient(145deg, #22d3ee, #10b981);
		box-shadow:
			0 0 0 3px rgba(34, 211, 238, 0.25),
			0 4px 12px rgba(0, 0, 0, 0.25);
		cursor: grab;
	}

	.h3-res-slider::-webkit-slider-thumb:active {
		cursor: grabbing;
		transform: scale(1.08);
	}

	.h3-res-slider::-moz-range-track {
		width: 6px;
		border-radius: 9999px;
		background: transparent;
	}

	.h3-res-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.95);
		background: linear-gradient(145deg, #22d3ee, #10b981);
		box-shadow:
			0 0 0 3px rgba(34, 211, 238, 0.25),
			0 4px 12px rgba(0, 0, 0, 0.25);
		cursor: grab;
	}
</style>
