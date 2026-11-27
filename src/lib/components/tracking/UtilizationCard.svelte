<script>
	/**
	 * Utilización de la flota hoy: minutos en movimiento sobre minutos en servicio,
	 * con la serie por hora. Sale de `moving_minutes`/`idle_minutes` de la
	 * telemetría horaria (ver fleetDayService).
	 */
	import { fleetDay } from '$lib/stores/fleetDayStore.js';
	import { vehicles, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { hourWindow } from '$lib/services/fleetDayService.js';
	import BigNumber from './BigNumber.svelte';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {}, onOpenReports = null } = $props();

	const W = 300;
	const X0 = 0;
	const X1 = 272;
	const Y0 = 8;
	const Y1 = 80;

	const t = $derived($fleetDay.data?.telemetry ?? null);
	const win = $derived(t ? hourWindow(t.kmByHour, t.currentHour) : [6, 22]);
	const X = (/** @type {number} */ h) => X0 + ((X1 - X0) * (h - win[0])) / (win[1] - win[0]);
	const Y = (/** @type {number} */ v) => Y1 - ((Y1 - Y0) * v) / 100;

	const points = $derived(
		t
			? t.utilizationByHour
					.map((v, h) => (v == null || h < win[0] || h >= win[1] ? null : [X(h + 0.5), Y(v)]))
					.filter(Boolean)
			: []
	);
	const line = $derived(
		points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
	);
	const area = $derived(
		points.length > 1
			? `${line}L${points[points.length - 1][0].toFixed(1)},${Y1}L${points[0][0].toFixed(1)},${Y1}Z`
			: ''
	);
	const last = $derived(points.length ? points[points.length - 1] : null);
	const ticks = $derived(
		[win[0], win[0] + 4, win[0] + 8, win[0] + 12, win[0] + 16].filter((h) => h <= win[1])
	);

	function hoursLabel(/** @type {number} */ min) {
		const h = Math.floor(min / 60);
		const m = Math.round(min % 60);
		return h > 0 ? `${h} h ${m} min` : `${m} min`;
	}
</script>

<section class="nx-glass nx-float rounded-[18px] p-4" aria-labelledby="util-title">
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="util-title" class="m-0 text-[13px] font-medium">Utilización de la flota</h2>
		{#if onOpenReports}
			<button
				type="button"
				class="nx-muted rounded-md px-1 text-[11px] hover:underline focus-visible:outline-2"
				onclick={onOpenReports}>Informes</button
			>
		{/if}
	</div>

	{#if $fleetDay.status === 'ready' || ($fleetDay.status === 'error' && t)}
		<div class="mt-2">
			<BigNumber value={t?.utilization} suffix="%" />
		</div>
		<p class="m-0 mt-1 text-[11.5px] nx-muted">
			{#if t?.utilization != null}
				En ruta {hoursLabel(t.movingMinutes)} de {hoursLabel(t.movingMinutes + t.idleMinutes)} en servicio
			{:else}
				Aún sin minutos en servicio hoy
			{/if}
		</p>
		<svg
			class="mt-2 block h-auto w-full overflow-visible"
			viewBox="0 0 {W} 104"
			role="img"
			aria-label="Utilización por hora de hoy"
		>
			{#each [25, 50, 75, 100] as v (v)}
				<line
					x1={X0}
					x2={X1}
					y1={Y(v)}
					y2={Y(v)}
					class="stroke-slate-200 dark:stroke-white/[0.06]"
					stroke-width="1"
				/>
				<text x={X1 + 6} y={Y(v) + 3} class="fill-slate-400 text-[9.5px] dark:fill-white/35"
					>{v}</text
				>
			{/each}
			{#if area}
				<path d={area} class="fill-slate-900/[0.06] dark:fill-white/[0.08]" />
				<path
					d={line}
					fill="none"
					class="stroke-slate-700 dark:stroke-white/85"
					stroke-width="1.4"
					stroke-linejoin="round"
				/>
			{/if}
			{#if last}
				<circle cx={last[0]} cy={last[1]} r="6" class="fill-slate-900/10 dark:fill-white/15" />
				<circle cx={last[0]} cy={last[1]} r="2.8" class="fill-slate-800 dark:fill-white" />
			{/if}
			{#each ticks as h (h)}
				<text
					x={X(h)}
					y="100"
					text-anchor={h === win[0] ? 'start' : 'middle'}
					class="fill-slate-400 text-[9.5px] dark:fill-white/35"
					>{String(h % 24).padStart(2, '0')}:00</text
				>
			{/each}
		</svg>
	{:else}
		<FleetDayState
			empty={$vehicles.length === 0 && !$loadingVehicles}
			status={$fleetDay.status}
			error={$fleetDay.error}
			{onRetry}
		/>
	{/if}
</section>
