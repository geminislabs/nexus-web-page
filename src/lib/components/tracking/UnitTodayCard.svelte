<script>
	/**
	 * Modo unidad: «Hoy en números». Kilómetros como cifra grande (con la
	 * comparación contra ayer a la misma hora) y, debajo, tiempo en ruta,
	 * ralentí, paradas y velocidad máxima. Un clic en los kilómetros cambia a la
	 * gráfica por hora.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import { hourWindow, niceMax } from '$lib/services/fleetDayService.js';
	import BigNumber from './BigNumber.svelte';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {} } = $props();

	let showChart = $state(false);
	let measured = $state(0);

	const d = $derived($unitDay.data);
	const ready = $derived(($unitDay.status === 'ready' || ($unitDay.status === 'error' && d)) && d);

	const W = $derived(Math.max(200, measured));
	const H = 96;
	const X1 = $derived(W - 26);
	const Y0 = 6;
	const Y1 = 78;
	const kmByHour = $derived((d?.hours ?? []).map((h) => (h ? h.km : null)));
	const win = $derived(d ? hourWindow(kmByHour, d.currentHour) : [6, 22]);
	const hrs = $derived(Array.from({ length: win[1] - win[0] }, (_, i) => win[0] + i));
	const bw = $derived(X1 / Math.max(1, hrs.length));
	const max = $derived(niceMax(Math.max(0, ...kmByHour.map((v) => v ?? 0))));
	const Y = (/** @type {number} */ v) => Y1 - ((Y1 - Y0) * v) / max;

	/** 95 → «1 h 35 min». */
	function dur(/** @type {number} */ min) {
		const m = Math.round(min || 0);
		if (m < 60) return `${m} min`;
		const h = Math.floor(m / 60);
		return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
	}

	const trend = $derived.by(() => {
		if (!d) return null;
		if (d.kmTrend == null)
			return d.kmYesterdaySameTime === 0 ? 'Ayer a esta hora: 0 km' : 'Sin dato de ayer';
		const p = Math.round(d.kmTrend);
		return `${p > 0 ? '+' : ''}${p} % vs ayer a esta hora`;
	});
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="unit-today-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="unit-today-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon
				icon="mdi:map-marker-distance"
				class="h-4 w-4 text-sky-600 dark:text-sky-400"
				aria-hidden="true"
			/>
			Hoy en números
		</h2>
		{#if ready}
			<button
				type="button"
				class="nx-muted rounded-md px-1 text-[11px] hover:underline focus-visible:outline-2"
				onclick={() => (showChart = !showChart)}
				aria-pressed={showChart}>{showChart ? 'Resumen' : 'Km por hora'}</button
			>
		{/if}
	</div>

	{#if ready && d}
		<button
			type="button"
			class="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg text-left focus-visible:outline-2"
			onclick={() => (showChart = !showChart)}
			title={showChart ? 'Ver el resumen' : 'Ver los kilómetros por hora'}
		>
			<span class="text-sky-600 dark:text-sky-400"
				><BigNumber value={d.kmToday} suffix="km" sizeClass="text-[38px]" /></span
			>
			<span class="nx-muted text-[11.5px]">{trend}</span>
		</button>

		{#if showChart}
			<div class="mt-2" bind:clientWidth={measured}>
				<svg
					class="block w-full overflow-visible"
					width={W}
					height={H}
					viewBox="0 0 {W} {H}"
					role="img"
					aria-label="Kilómetros por hora de hoy"
				>
					{#each [0, max] as v (v)}
						<line
							x1="0"
							x2={X1}
							y1={Y(v)}
							y2={Y(v)}
							class="stroke-slate-200 dark:stroke-white/[0.06]"
						/>
						<text x={X1 + 5} y={Y(v) + 3} class="fill-slate-400 text-[9.5px] dark:fill-white/35"
							>{v}</text
						>
					{/each}
					{#each hrs as h, i (h)}
						{@const v = kmByHour[h]}
						{#if v != null}
							<rect
								x={i * bw + 2}
								y={Y(v)}
								width={Math.max(1, bw - 4)}
								height={Math.max(0, Y1 - Y(v))}
								rx="2.5"
								class={h === d.currentHour
									? 'fill-sky-600 dark:fill-sky-400'
									: 'fill-sky-500/35 dark:fill-sky-400/30'}
								><title>{String(h).padStart(2, '0')}:00 · {v.toFixed(1)} km</title></rect
							>
						{/if}
					{/each}
					{#each hrs.filter((h) => (h - win[0]) % 4 === 0) as h (h)}
						<text
							x={(h - win[0]) * bw}
							y={H - 3}
							text-anchor={h === win[0] ? 'start' : 'middle'}
							class="fill-slate-400 text-[9.5px] dark:fill-white/35"
							>{String(h % 24).padStart(2, '0')}</text
						>
					{/each}
				</svg>
			</div>
		{:else}
			<dl class="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
				<div>
					<dt class="nx-label flex items-center gap-1.5">
						<i class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></i>En ruta
					</dt>
					<dd class="nx-num m-0 mt-0.5 text-[17px]">{dur(d.movingMinutes)}</dd>
				</div>
				<div>
					<dt class="nx-label flex items-center gap-1.5">
						<i class="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"></i>Ralentí
					</dt>
					<dd
						class="nx-num m-0 mt-0.5 text-[17px] {d.idleMinutes >= 30
							? 'text-amber-600 dark:text-amber-400'
							: ''}"
					>
						{dur(d.idleMinutes)}
					</dd>
				</div>
				<div>
					<dt class="nx-label">Paradas</dt>
					<dd class="nx-num m-0 mt-0.5 text-[17px]">{d.stops}</dd>
				</div>
				<div>
					<dt class="nx-label">Vel. máxima</dt>
					<dd class="nx-num m-0 mt-0.5 text-[17px]">
						{d.maxSpeed != null ? `${Math.round(d.maxSpeed)} km/h` : '—'}
					</dd>
				</div>
			</dl>
		{/if}
	{:else}
		<FleetDayState status={$unitDay.status} error={$unitDay.error} {onRetry} rows={2} />
	{/if}
</section>
