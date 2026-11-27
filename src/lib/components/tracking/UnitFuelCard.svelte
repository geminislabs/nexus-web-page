<script>
	/**
	 * Modo unidad: combustible calculado de los últimos 7 días (litros por día)
	 * y el rendimiento de la semana en L/100 km. El combustible no lo reporta el
	 * equipo: lo calcula la plataforma (`fuel_consumed_liters`).
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import { niceMax } from '$lib/services/fleetDayService.js';
	import BigNumber from './BigNumber.svelte';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {} } = $props();

	let measured = $state(0);
	const d = $derived($unitDay.data);
	const ready = $derived(($unitDay.status === 'ready' || ($unitDay.status === 'error' && d)) && d);

	const W = $derived(Math.max(200, measured));
	const H = 70;
	const Y1 = 54;
	const days = $derived(d?.days ?? []);
	const bw = $derived(W / Math.max(1, days.length));
	const max = $derived(niceMax(Math.max(0.1, ...days.map((x) => x.liters ?? 0))));
	const Y = (/** @type {number} */ v) => Y1 - ((Y1 - 4) * v) / max;
	const fmt = (/** @type {number} */ v) =>
		v.toLocaleString('es-MX', { maximumFractionDigits: v < 10 ? 1 : 0 });
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="unit-fuel-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="unit-fuel-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon
				icon="mdi:gas-station"
				class="h-4 w-4 text-teal-600 dark:text-teal-400"
				aria-hidden="true"
			/>
			Combustible · 7 días
		</h2>
		{#if ready && d?.fuelToday != null}
			<span class="nx-muted text-[11.5px]">Hoy {fmt(d.fuelToday)} L</span>
		{/if}
	</div>

	{#if ready && d}
		{#if !d.hasFuel}
			<p class="nx-muted m-0 mt-3 text-[12px]">Sin consumo calculado en estos 7 días.</p>
		{:else}
			<div class="mt-2 text-teal-600 dark:text-teal-400">
				<BigNumber value={d.fuelWeekPer100} suffix="L/100 km" sizeClass="text-[30px]" />
			</div>
			<div class="mt-2" bind:clientWidth={measured}>
				<svg
					class="block w-full overflow-visible"
					width={W}
					height={H}
					viewBox="0 0 {W} {H}"
					role="img"
					aria-label="Litros por día de los últimos 7 días"
				>
					{#each days as day, i (day.date.getTime())}
						{@const isToday = i === days.length - 1}
						{#if day.liters != null}
							<rect
								x={i * bw + 3}
								y={Y(day.liters)}
								width={Math.max(1, bw - 6)}
								height={Math.max(1, Y1 - Y(day.liters))}
								rx="3"
								class={isToday
									? 'fill-teal-600 dark:fill-teal-400'
									: 'fill-teal-500/40 dark:fill-teal-400/35'}
								><title
									>{day.label} · {fmt(day.liters)} L{day.per100 != null
										? ` · ${fmt(day.per100)} L/100 km`
										: ''}</title
								></rect
							>
						{:else}
							<rect
								x={i * bw + 3}
								y={Y1 - 2}
								width={Math.max(1, bw - 6)}
								height="2"
								rx="1"
								class="fill-slate-200 dark:fill-white/[0.07]"
							/>
						{/if}
						<text
							x={i * bw + bw / 2}
							y={H - 2}
							text-anchor="middle"
							class="text-[9.5px] {isToday
								? 'fill-slate-700 dark:fill-white/80'
								: 'fill-slate-400 dark:fill-white/35'}">{isToday ? 'hoy' : day.label}</text
						>
					{/each}
				</svg>
			</div>
		{/if}
	{:else}
		<FleetDayState status={$unitDay.status} error={$unitDay.error} {onRetry} rows={2} />
	{/if}
</section>
