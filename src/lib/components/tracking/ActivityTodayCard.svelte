<script>
	/**
	 * Línea de tiempo del día por unidad: tramos en ruta (trayectos) y marcas de
	 * alarma (zona, ignición). Las filas llevan a la unidad en el mapa.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { fleetDay } from '$lib/stores/fleetDayStore.js';
	import { vehicles, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { hourWindow } from '$lib/services/fleetDayService.js';
	import FleetDayState from './FleetDayState.svelte';

	let { onRetry = () => {}, onSelectUnit = () => {}, activeUnitId = null } = $props();

	const LABEL_W = 104;
	/** Ancho real del gráfico: el SVG se dibuja 1:1 para que el texto no crezca con la tarjeta. */
	let measured = $state(0);
	const W = $derived(Math.max(300, measured));
	const X1 = $derived(W - 8);
	const ROW_H = 26;

	const activity = $derived($fleetDay.data?.activity ?? null);
	const t = $derived($fleetDay.data?.telemetry ?? null);
	const win = $derived(t ? hourWindow(t.kmByHour, t.currentHour) : [6, 22]);
	const rows = $derived(activity?.rows ?? []);
	const X = (/** @type {number} */ h) =>
		LABEL_W +
		((X1 - LABEL_W) * (Math.min(win[1], Math.max(win[0], h)) - win[0])) / (win[1] - win[0]);
	const ticks = $derived(
		Array.from({ length: Math.floor((win[1] - win[0]) / 4) + 1 }, (_, i) => win[0] + i * 4)
	);
	const height = $derived(rows.length * ROW_H + 22);
	const nowH = $derived(activity?.nowHour ?? null);
	const nowLabel = $derived(
		nowH == null
			? ''
			: `${String(Math.floor(nowH)).padStart(2, '0')}:${String(Math.floor((nowH % 1) * 60)).padStart(2, '0')}`
	);
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="act-title"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="act-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon
				icon="mdi:timeline-clock-outline"
				class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
				aria-hidden="true"
			/>
			Actividad de hoy
		</h2>
		<span class="text-[11px] nx-muted"
			>{String(win[0]).padStart(2, '0')}:00 – {String(win[1] % 24).padStart(2, '0')}:00</span
		>
	</div>

	{#if ($fleetDay.status === 'ready' || ($fleetDay.status === 'error' && activity)) && rows.length}
		<div
			class="mt-2 max-h-[156px] min-h-0 overflow-y-auto overflow-x-hidden pr-1"
			bind:clientWidth={measured}
		>
			<svg
				class="block w-full overflow-visible"
				width={W}
				{height}
				viewBox="0 0 {W} {height}"
				role="group"
				aria-label="Línea de tiempo de cada unidad"
			>
				{#each ticks as h (h)}
					<line
						x1={X(h)}
						x2={X(h)}
						y1="0"
						y2={rows.length * ROW_H}
						class="stroke-slate-200 dark:stroke-white/[0.06]"
					/>
					<text
						x={X(h)}
						y={rows.length * ROW_H + 14}
						text-anchor="middle"
						class="fill-slate-400 text-[9.5px] dark:fill-white/35"
						>{String(h % 24).padStart(2, '0')}:00</text
					>
				{/each}
				{#each rows as row, i (row.unitId)}
					{@const cy = i * ROW_H + ROW_H / 2}
					{@const sel = row.unitId === activeUnitId}
					<g
						role="button"
						tabindex="0"
						aria-label="Ver {row.name} en el mapa"
						class="act-row cursor-pointer outline-none"
						onclick={() => onSelectUnit(row.unitId)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelectUnit(row.unitId);
							}
						}}
					>
						<rect
							x="0"
							y={cy - ROW_H / 2}
							width={W}
							height={ROW_H}
							rx="6"
							class={sel ? 'fill-slate-900/[0.05] dark:fill-white/[0.05]' : 'fill-transparent'}
						/>
						<text
							x="4"
							y={cy + 3.5}
							class="text-[12.5px] {sel
								? 'fill-slate-900 font-medium dark:fill-white'
								: 'fill-slate-500 dark:fill-white/50'}"
							>{row.name.length > 13 ? `${row.name.slice(0, 12)}…` : row.name}<title
								>{row.name}</title
							></text
						>
						<rect
							x={LABEL_W}
							y={cy - 0.5}
							width={X1 - LABEL_W}
							height="1"
							class="fill-slate-200 dark:fill-white/[0.05]"
						/>
						{#each row.segments as s, j (j)}
							<rect
								x={X(s.start)}
								y={cy - 3}
								width={Math.max(2, X(s.end) - X(s.start))}
								height="6"
								rx="3"
								class={sel
									? 'fill-emerald-600 dark:fill-emerald-400'
									: 'fill-emerald-500/45 dark:fill-emerald-400/40'}
							/>
						{/each}
						{#each row.marks as m, j (j)}
							<circle
								cx={X(m.at)}
								{cy}
								r="4"
								stroke-width="1.5"
								class={m.type === 'zone'
									? 'fill-amber-400 stroke-white dark:stroke-[#16181c]'
									: 'fill-white stroke-slate-500 dark:fill-[#16181c] dark:stroke-white/70'}
							>
								<title>{m.label}</title>
							</circle>
						{/each}
					</g>
				{/each}
				{#if nowH != null && nowH >= win[0] && nowH <= win[1]}
					<line
						x1={X(nowH)}
						x2={X(nowH)}
						y1="-4"
						y2={rows.length * ROW_H}
						class="stroke-brand-500 dark:stroke-brand-400"
						stroke-width="1"
					/>
					<circle cx={X(nowH)} cy="-4" r="2.5" class="fill-brand-500 dark:fill-brand-400">
						<title>Ahora · {nowLabel}</title>
					</circle>
				{/if}
			</svg>
		</div>
		<div class="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[10.5px] nx-muted">
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[5px] w-4 rounded bg-emerald-500/60 dark:bg-emerald-400/50"></i>En
				ruta</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[7px] w-[7px] rounded-full bg-amber-400"></i>Alerta de zona</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i
					class="inline-block h-[7px] w-[7px] rounded-full border border-slate-500 dark:border-white/70"
				></i>Ignición</span
			>
			{#if $fleetDay.data?.tripsTruncated}
				<span>· Trayectos recortados: el día tiene más de los que se piden de una vez</span>
			{/if}
		</div>
	{:else if $fleetDay.status === 'ready'}
		<p class="m-0 mt-2 text-[12px] nx-muted">Sin unidades que mostrar.</p>
	{:else}
		<FleetDayState
			empty={$vehicles.length === 0 && !$loadingVehicles}
			status={$fleetDay.status}
			error={$fleetDay.error}
			{onRetry}
			rows={4}
		/>
	{/if}
</section>

<style>
	.act-row:focus-visible > rect:first-child {
		fill: rgb(15 23 42 / 0.08);
		stroke: rgb(15 23 42 / 0.35);
	}
	:global(html.dark) .act-row:focus-visible > rect:first-child {
		fill: rgb(255 255 255 / 0.06);
		stroke: rgb(255 255 255 / 0.35);
	}
</style>
