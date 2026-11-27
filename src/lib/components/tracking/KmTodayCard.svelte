<script>
	/** Kilómetros recorridos hoy por toda la flota, con barras por hora. */
	import Icon from '$lib/components/Icon.svelte';
	import { fleetDay } from '$lib/stores/fleetDayStore.js';
	import { vehicles, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { hourWindow, niceMax } from '$lib/services/fleetDayService.js';
	import BigNumber from './BigNumber.svelte';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {}, onOpenReports = null } = $props();

	/** Ancho real del gráfico: el SVG se dibuja 1:1 para que el texto no crezca con la tarjeta. */
	let measured = $state(0);
	const W = $derived(Math.max(220, measured));
	const H = 112;
	const X0 = 0;
	const X1 = $derived(W - 28);
	const Y0 = 8;
	const Y1 = 92;

	const t = $derived($fleetDay.data?.telemetry ?? null);
	const win = $derived(t ? hourWindow(t.kmByHour, t.currentHour) : [6, 22]);
	const hours = $derived(Array.from({ length: win[1] - win[0] }, (_, i) => win[0] + i));
	const bw = $derived((X1 - X0) / Math.max(1, hours.length));
	const max = $derived(
		niceMax(Math.max(0, ...(t?.kmByHour ?? []).map((v) => (v == null ? 0 : v))))
	);
	const Y = (/** @type {number} */ v) => Y1 - ((Y1 - Y0) * v) / max;
	const fmt = (/** @type {number} */ v) =>
		v.toLocaleString('es-MX', { maximumFractionDigits: v < 10 ? 1 : 0 });
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="km-title"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="km-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon
				icon="mdi:map-marker-distance"
				class="h-4 w-4 text-sky-600 dark:text-sky-400"
				aria-hidden="true"
			/>
			Kilómetros hoy
		</h2>
		{#if onOpenReports}
			<button
				type="button"
				class="nx-muted rounded-md px-1 text-[11px] hover:underline focus-visible:outline-2"
				onclick={onOpenReports}>Informes</button
			>
		{/if}
	</div>

	{#if $fleetDay.status === 'ready' || ($fleetDay.status === 'error' && t)}
		<div class="mt-2 text-sky-600 dark:text-sky-400">
			<BigNumber value={t?.kmTotal} suffix="km" />
		</div>
		<div class="mt-3" bind:clientWidth={measured}>
			<svg
				class="block w-full overflow-visible"
				width={W}
				height={H}
				viewBox="0 0 {W} {H}"
				role="img"
				aria-label="Kilómetros por hora de la flota"
			>
				{#each [0, max / 2, max] as v (v)}
					<line
						x1={X0}
						x2={X1}
						y1={Y(v)}
						y2={Y(v)}
						class="stroke-slate-200 dark:stroke-white/[0.06]"
						stroke-width="1"
					/>
					<text x={X1 + 6} y={Y(v) + 3} class="fill-slate-400 text-[9.5px] dark:fill-white/35"
						>{fmt(v)}</text
					>
				{/each}
				{#each hours as h, i (h)}
					{@const v = t?.kmByHour[h]}
					{@const x = X0 + i * bw + 2}
					{@const w = Math.max(1, bw - 4)}
					{#if v == null}
						<rect
							{x}
							y={Y1 - 2}
							width={w}
							height="2"
							rx="1"
							class="fill-slate-200 dark:fill-white/[0.07]"
						/>
					{:else}
						<rect
							{x}
							y={Y(v)}
							width={w}
							height={Math.max(0, Y1 - Y(v))}
							rx="2.5"
							class={h === t?.currentHour
								? 'fill-sky-600 dark:fill-sky-400'
								: 'fill-sky-500/35 dark:fill-sky-400/30'}
						>
							<title>{String(h).padStart(2, '0')}:00 · {fmt(v)} km</title>
						</rect>
					{/if}
				{/each}
				{#each hours.filter((h) => (h - win[0]) % 4 === 0) as h (h)}
					<text
						x={X0 + (h - win[0]) * bw}
						y={H - 4}
						text-anchor={h === win[0] ? 'start' : 'middle'}
						class="fill-slate-400 text-[9.5px] dark:fill-white/35"
						>{String(h % 24).padStart(2, '0')}</text
					>
				{/each}
			</svg>
		</div>
	{:else}
		<FleetDayState
			empty={$vehicles.length === 0 && !$loadingVehicles}
			status={$fleetDay.status}
			error={$fleetDay.error}
			{onRetry}
		/>
	{/if}
</section>
