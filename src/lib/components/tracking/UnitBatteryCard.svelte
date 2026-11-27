<script>
	/**
	 * Modo unidad: batería principal de las últimas 24 h. Bandas de fondo con
	 * los mismos umbrales que las fichas (12.2 V y 11.5 V) y marcas rojas donde
	 * bajó con el motor apagado: la señal típica de un consumo que deja al
	 * vehículo sin arranque.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import { BATTERY_OK_V, BATTERY_LOW_V } from '$lib/services/unitDayService.js';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {} } = $props();

	let measured = $state(0);
	const d = $derived($unitDay.data);
	const ready = $derived(($unitDay.status === 'ready' || ($unitDay.status === 'error' && d)) && d);

	const W = $derived(Math.max(200, measured));
	const H = 92;
	const X1 = $derived(W - 30);
	const Y0 = 4;
	const Y1 = 76;
	const VMIN = 10.5;
	const VMAX = 15;
	const X = (/** @type {number} */ hoursAgo) =>
		X1 - (X1 * Math.min(24, Math.max(0, hoursAgo))) / 24;
	const Y = (/** @type {number} */ v) =>
		Y1 - ((Y1 - Y0) * (Math.min(VMAX, Math.max(VMIN, v)) - VMIN)) / (VMAX - VMIN);

	const points = $derived((d?.battery ?? []).filter((b) => b.avg != null));
	const line = $derived(
		points
			.map((b, i) => `${i ? 'L' : 'M'}${X(b.hoursAgo).toFixed(1)},${Y(b.avg).toFixed(1)}`)
			.join('')
	);
	const minArea = $derived.by(() => {
		const pts = (d?.battery ?? []).filter((b) => b.min != null && b.avg != null);
		if (pts.length < 2) return '';
		const top = pts.map((b) => `${X(b.hoursAgo).toFixed(1)},${Y(b.avg).toFixed(1)}`);
		const bottom = [...pts]
			.reverse()
			.map((b) => `${X(b.hoursAgo).toFixed(1)},${Y(b.min).toFixed(1)}`);
		return `M${top.join('L')}L${bottom.join('L')}Z`;
	});

	const tone = $derived(
		d?.batteryNow == null
			? ''
			: d.batteryNow < BATTERY_LOW_V
				? 'text-red-600 dark:text-red-400'
				: d.batteryNow < BATTERY_OK_V
					? 'text-amber-600 dark:text-amber-400'
					: 'text-emerald-600 dark:text-emerald-400'
	);
	const worstDrop = $derived(
		(d?.batteryDrops ?? []).reduce(
			(w, b) => (w == null || (b.min ?? 99) < (w.min ?? 99) ? b : w),
			/** @type {any} */ (null)
		)
	);
	const fmtTime = (/** @type {Date} */ t) =>
		t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="unit-battery-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="unit-battery-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon icon="mdi:car-battery" class="h-4 w-4 {tone || 'nx-muted'}" aria-hidden="true" />
			Batería · 24 h
		</h2>
		{#if ready && d?.batteryNow != null}
			<span class="nx-num text-[15px] {tone}">{d.batteryNow.toFixed(1)} V</span>
		{/if}
	</div>

	{#if ready && d}
		{#if points.length < 2}
			<p class="nx-muted m-0 mt-3 text-[12px]">Sin lecturas de batería en las últimas 24 h.</p>
		{:else}
			<div class="mt-2" bind:clientWidth={measured}>
				<svg
					class="block w-full overflow-visible"
					width={W}
					height={H}
					viewBox="0 0 {W} {H}"
					role="img"
					aria-label="Voltaje de la batería principal en las últimas 24 horas"
				>
					<!-- Bandas: bien, baja, crítica -->
					<rect
						x="0"
						y={Y(VMAX)}
						width={X1}
						height={Y(BATTERY_OK_V) - Y(VMAX)}
						class="fill-emerald-500/[0.07]"
					/>
					<rect
						x="0"
						y={Y(BATTERY_OK_V)}
						width={X1}
						height={Y(BATTERY_LOW_V) - Y(BATTERY_OK_V)}
						class="fill-amber-400/[0.1]"
					/>
					<rect
						x="0"
						y={Y(BATTERY_LOW_V)}
						width={X1}
						height={Y(VMIN) - Y(BATTERY_LOW_V)}
						class="fill-red-500/[0.1]"
					/>
					{#each [BATTERY_OK_V, BATTERY_LOW_V] as v (v)}
						<text x={X1 + 4} y={Y(v) + 3} class="fill-slate-400 text-[9.5px] dark:fill-white/35"
							>{v}</text
						>
					{/each}
					{#if minArea}
						<path d={minArea} class="fill-slate-900/[0.08] dark:fill-white/[0.1]" />
					{/if}
					<path
						d={line}
						fill="none"
						stroke-width="1.6"
						stroke-linejoin="round"
						class="stroke-slate-800 dark:stroke-white/90"
					/>
					{#each d.batteryDrops as b (b.at.getTime())}
						<circle
							cx={X(b.hoursAgo)}
							cy={Y(b.min ?? VMIN)}
							r="3.5"
							class="fill-red-500 stroke-white dark:stroke-[#15171b]"
							stroke-width="1.5"
						>
							<title>{(b.min ?? 0).toFixed(1)} V con el motor apagado · {fmtTime(b.at)}</title>
						</circle>
					{/each}
					{#each [24, 12, 0] as h (h)}
						<text
							x={X(h)}
							y={H - 2}
							text-anchor={h === 24 ? 'start' : h === 0 ? 'end' : 'middle'}
							class="fill-slate-400 text-[9.5px] dark:fill-white/35"
							>{h === 0 ? 'ahora' : `-${h} h`}</text
						>
					{/each}
				</svg>
			</div>
			<p
				class="m-0 mt-1.5 text-[11.5px] {worstDrop ? 'text-red-600 dark:text-red-400' : 'nx-muted'}"
			>
				{#if worstDrop}
					Bajó a {(worstDrop.min ?? 0).toFixed(1)} V con el motor apagado ({fmtTime(worstDrop.at)})
				{:else}
					Sin caídas con el motor apagado
				{/if}
			</p>
		{/if}
	{:else}
		<FleetDayState status={$unitDay.status} error={$unitDay.error} {onRetry} rows={2} />
	{/if}
</section>
