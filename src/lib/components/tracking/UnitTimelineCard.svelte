<script>
	/**
	 * Modo unidad: «El día de la unidad». Una sola línea de tiempo con bandas de
	 * estado (en ruta, ralentí, apagado), la velocidad máxima de cada hora encima,
	 * encendidos y apagados, y alertas de zona. Un clic en un tramo en ruta
	 * dibuja ese trayecto en el mapa.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import { alarmEvents } from '$lib/stores/alertStore.js';
	import { hourWindow, hoursSince, todayRange, formatHour } from '$lib/services/fleetDayService.js';
	import FleetDayState from './FleetDayState.svelte';

	let {
		onRetry = () => {},
		/** @type {(tripId: string) => void} */
		onSelectTrip = () => {},
		onClearTrip = () => {},
		activeTripId = null
	} = $props();

	let measured = $state(0);
	const d = $derived($unitDay.data);
	const ready = $derived(($unitDay.status === 'ready' || ($unitDay.status === 'error' && d)) && d);

	const TOP_PAD = 13;
	const SPEED_H = 46;
	const TRACK_Y = SPEED_H + 10;
	const TRACK_H = 14;
	const H = TRACK_Y + TRACK_H + 20;
	const W = $derived(Math.max(300, measured));
	const X1 = $derived(W - 6);

	const kmByHour = $derived((d?.hours ?? []).map((h) => (h ? h.km : null)));
	const win = $derived(d ? hourWindow(kmByHour, d.currentHour) : [6, 22]);
	const X = (/** @type {number} */ h) =>
		(X1 * (Math.min(win[1], Math.max(win[0], h)) - win[0])) / (win[1] - win[0]);
	const ticks = $derived(
		Array.from({ length: Math.floor((win[1] - win[0]) / 4) + 1 }, (_, i) => win[0] + i * 4)
	);

	const speedMax = $derived(
		Math.max(60, ...(d?.hours ?? []).map((h) => (h?.maxSpeed != null ? h.maxSpeed : 0)))
	);
	const speedPath = $derived.by(() => {
		const pts = [];
		(d?.hours ?? []).forEach((h, i) => {
			if (!h || i < win[0] || i >= win[1]) return;
			const v = h.maxSpeed ?? 0;
			pts.push(`${X(i + 0.5).toFixed(1)},${(SPEED_H - (SPEED_H - 4) * (v / speedMax)).toFixed(1)}`);
		});
		// Sin movimiento en todo el día, una línea plana en cero solo estorba.
		const moved = (d?.hours ?? []).some((h) => (h?.maxSpeed ?? 0) > 0);
		return moved && pts.length > 1 ? `M${pts.join('L')}` : '';
	});

	const zoneMarks = $derived.by(() => {
		if (!d) return [];
		const dayStart = todayRange(new Date()).from;
		return $alarmEvents
			.filter((e) => e.type === 'zone' && String(e.unitId) === String(d.unitId))
			.map((e) => ({ at: hoursSince(dayStart, e.at), label: e.name }))
			.filter((m) => m.at != null && m.at >= 0 && m.at <= 24);
	});

	const activeSeg = $derived(
		d?.timeline.segments.find((s) => s.tripId && s.tripId === activeTripId)
	);
</script>

<section
	class="nx-glass nx-float flex min-w-0 flex-col rounded-[18px] p-4"
	aria-labelledby="unit-tl-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="unit-tl-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
			<Icon
				icon="mdi:timeline-clock-outline"
				class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
				aria-hidden="true"
			/>
			El día de la unidad
		</h2>
		<span class="flex items-center gap-2 text-[11px]">
			{#if activeSeg}
				<button
					type="button"
					class="nx-glass-hi inline-flex items-center gap-1 rounded-full border px-2 py-0.5 focus-visible:outline-2"
					onclick={onClearTrip}
					title="Quitar el trayecto del mapa"
				>
					Trayecto {formatHour(activeSeg.start)}–{formatHour(activeSeg.end)}
					<Icon icon="mdi:close" class="h-3 w-3" aria-hidden="true" />
				</button>
			{:else if ready}
				<span class="nx-muted">Clic en un tramo verde para verlo en el mapa</span>
			{/if}
		</span>
	</div>

	{#if ready && d}
		<div class="mt-2" bind:clientWidth={measured}>
			<svg
				class="block w-full overflow-visible"
				width={W}
				height={H + TOP_PAD}
				viewBox="0 {-TOP_PAD} {W} {H + TOP_PAD}"
				role="group"
				aria-label="Línea de tiempo del día de la unidad"
			>
				{#each ticks as h (h)}
					<line
						x1={X(h)}
						x2={X(h)}
						y1="0"
						y2={TRACK_Y + TRACK_H}
						class="stroke-slate-200 dark:stroke-white/[0.06]"
					/>
					<text
						x={X(h)}
						y={H - 4}
						text-anchor="middle"
						class="fill-slate-400 text-[9.5px] dark:fill-white/35"
						>{String(h % 24).padStart(2, '0')}:00</text
					>
				{/each}

				<!-- Velocidad máxima por hora -->
				{#if speedPath}
					<path
						d={speedPath}
						fill="none"
						stroke-width="1.5"
						stroke-linejoin="round"
						class="stroke-cyan-600 dark:stroke-cyan-400"
					/>
					<text x="0" y="8" class="fill-cyan-600 text-[9px] dark:fill-cyan-400"
						>{Math.round(speedMax)} km/h</text
					>
				{/if}

				<!-- Pista: apagado de fondo, ralentí y en ruta encima -->
				<rect
					x={X(win[0])}
					y={TRACK_Y}
					width={X(Math.min(win[1], d.nowHour)) - X(win[0])}
					height={TRACK_H}
					rx="4"
					class="fill-slate-300/50 dark:fill-white/[0.08]"
				/>
				{#each d.timeline.idle as i, j (j)}
					<rect
						x={X(i.start)}
						y={TRACK_Y}
						width={Math.max(2, X(i.end) - X(i.start))}
						height={TRACK_H}
						class={i.approx ? 'fill-amber-400/50' : 'fill-amber-400'}
					>
						<title
							>Ralentí {formatHour(i.start)}–{formatHour(i.end)}{i.approx
								? ' (aproximado)'
								: ''}</title
						>
					</rect>
				{/each}
				{#each d.timeline.segments as s, j (j)}
					{@const on = !!s.tripId && s.tripId === activeTripId}
					{@const tip = `En ruta ${formatHour(s.start)}–${formatHour(s.end)}${s.km != null ? ` · ${s.km.toFixed(1)} km` : ''}`}
					{#if s.tripId}
						{@const tripId = s.tripId}
						<rect
							x={X(s.start)}
							y={TRACK_Y - (on ? 2 : 0)}
							width={Math.max(3, X(s.end) - X(s.start))}
							height={TRACK_H + (on ? 4 : 0)}
							rx="3"
							role="button"
							tabindex="0"
							aria-label="Ver el trayecto de {formatHour(s.start)} a {formatHour(s.end)} en el mapa"
							class="cursor-pointer outline-none {on
								? 'fill-emerald-500 stroke-slate-900 dark:stroke-white'
								: 'fill-emerald-500/85 hover:fill-emerald-500'}"
							stroke-width={on ? 1.5 : 0}
							onclick={() => onSelectTrip(tripId)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onSelectTrip(tripId);
								}
							}}><title>{tip}</title></rect
						>
					{:else}
						<rect
							x={X(s.start)}
							y={TRACK_Y}
							width={Math.max(3, X(s.end) - X(s.start))}
							height={TRACK_H}
							rx="3"
							class="fill-emerald-500/85"><title>{tip}</title></rect
						>
					{/if}
				{/each}

				<!-- Encendidos, apagados y alertas de zona -->
				{#each d.timeline.marks as m, j (j)}
					<circle
						cx={X(/** @type {number} */ (m.at))}
						cy={TRACK_Y + TRACK_H / 2}
						r="3.6"
						stroke-width="1.5"
						class={m.type === 'ignition_on'
							? 'fill-orange-500 stroke-white dark:stroke-[#16181c]'
							: 'fill-white stroke-orange-500 dark:fill-[#16181c]'}
						><title
							>{m.type === 'ignition_on' ? 'Encendido' : 'Apagado'} · {formatHour(
								/** @type {number} */ (m.at)
							)}</title
						></circle
					>
				{/each}
				{#each zoneMarks as m, j (j)}
					<path
						d="M{X(/** @type {number} */ (m.at))},{TRACK_Y - 3} l-3.5,-5 h7 z"
						class="fill-amber-400"><title>{m.label}</title></path
					>
				{/each}

				<!-- Ahora -->
				{#if d.nowHour >= win[0] && d.nowHour <= win[1]}
					<line
						x1={X(d.nowHour)}
						x2={X(d.nowHour)}
						y1="-2"
						y2={TRACK_Y + TRACK_H + 2}
						stroke-width="1.2"
						stroke-dasharray="3 3"
						class="stroke-slate-900 dark:stroke-white"
					/>
					<rect
						x={X(d.nowHour) - 15}
						y="-11"
						width="30"
						height="11"
						rx="5.5"
						class="fill-slate-900 dark:fill-white"
					/>
					<text
						x={X(d.nowHour)}
						y="-3"
						text-anchor="middle"
						class="fill-white text-[8px] font-semibold dark:fill-[#111316]">ahora</text
					>
				{/if}
			</svg>
		</div>
		<div class="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[10.5px] nx-muted">
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[6px] w-4 rounded bg-emerald-500"></i>En ruta</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[6px] w-4 rounded bg-amber-400"></i>Ralentí</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[6px] w-4 rounded bg-slate-300 dark:bg-white/20"></i>Apagado</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[7px] w-[7px] rounded-full bg-orange-500"></i>Encendido</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[7px] w-[7px] rounded-full border-[1.5px] border-orange-500"
				></i>Apagado</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[2px] w-4 bg-cyan-500"></i>Velocidad máx.</span
			>
			{#if !d.timeline.ignitionKnown}
				<span>· Ralentí aproximado: no se pudieron leer los encendidos</span>
			{/if}
		</div>
	{:else}
		<FleetDayState status={$unitDay.status} error={$unitDay.error} {onRetry} rows={2} />
	{/if}
</section>
