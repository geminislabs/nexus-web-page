<script>
	/**
	 * Columna izquierda del seguimiento en escritorio: resumen de estados (que
	 * también filtra), utilización del día y las unidades como tarjetas.
	 * La gestión completa (editar, borrar, visibilidad en el mapa, filtros
	 * avanzados) sigue en el cajón «Unidades»; aquí se llega con «Gestionar».
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { vehicles, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { liveTrails, liveSpeeds, projectTrail } from '$lib/stores/liveTrailStore.js';
	import { clock, sinceLabel } from '$lib/stores/clockStore.js';
	import { getUnitTrackingStatus } from '$lib/utils/unitTrackingStatus.js';
	import UtilizationCard from './UtilizationCard.svelte';

	let {
		onSelectUnit = () => {},
		onManageUnits = () => {},
		onOpenReports = null,
		onRetry = () => {},
		onCollapse = null,
		/** Con una sola unidad, su día ya está en la franja de abajo (modo unidad). */
		showUtilization = true
	} = $props();

	const PAGE = 40;

	/**
	 * Mini-gráfica de la velocidad de los últimos 30 min. Solo si hubo
	 * movimiento: una línea plana en cero no dice nada.
	 * @param {Array<{ t: number, v: number }>} pts
	 */
	function sparkline(pts) {
		if (pts.length < 2 || !pts.some((p) => p.v > 0)) return null;
		const t0 = pts[0].t;
		const span = Math.max(1, pts[pts.length - 1].t - t0);
		const max = Math.max(20, ...pts.map((p) => p.v));
		const xy = pts.map((p) => [((p.t - t0) / span) * 140, 17 - (p.v / max) * 15]);
		const line = `M${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`;
		return { line, area: `${line}L140,18L0,18Z` };
	}

	/** @type {'all' | 'moving' | 'stopped' | 'no_signal'} */
	let filter = $state('all');
	let query = $state('');
	let limit = $state(PAGE);

	const bucketOf = (/** @type {string} */ kind) =>
		kind === 'moving' ? 'moving' : kind === 'no_signal' ? 'no_signal' : 'stopped';

	const withStatus = $derived(
		$vehicles.map((u) => {
			const status = getUnitTrackingStatus(u);
			return { u, status, bucket: bucketOf(status.kind) };
		})
	);
	const counts = $derived(
		withStatus.reduce(
			(acc, x) => {
				acc[x.bucket] += 1;
				return acc;
			},
			{ moving: 0, stopped: 0, no_signal: 0 }
		)
	);
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return withStatus.filter(({ u, bucket }) => {
			if (filter !== 'all' && bucket !== filter) return false;
			if (!q) return true;
			return [u.name, u.brand, u.model, u.plate, u.description]
				.filter(Boolean)
				.some((s) => String(s).toLowerCase().includes(q));
		});
	});
	const visible = $derived(filtered.slice(0, limit));

	const tiles = [
		// Mismos colores de estado que la pastilla de cada unidad (unitTrackingStatus).
		{
			id: 'moving',
			label: 'En movimiento',
			dot: 'bg-emerald-400',
			num: 'text-emerald-600 dark:text-emerald-400'
		},
		{
			id: 'stopped',
			label: 'Detenidas',
			dot: 'bg-orange-400',
			num: 'text-orange-600 dark:text-orange-400'
		},
		{
			id: 'no_signal',
			label: 'Sin señal',
			dot: 'bg-amber-400',
			num: 'text-amber-600 dark:text-amber-400'
		}
	];

	function toggleFilter(/** @type {any} */ id) {
		filter = filter === id ? 'all' : id;
		limit = PAGE;
	}

	function subtitle(/** @type {any} */ u) {
		const car = [u.brand, u.model].filter(Boolean).join(' ');
		return [car, u.plate].filter(Boolean).join(' · ') || u.description || 'Sin datos del vehículo';
	}
</script>

<div class="flex min-h-0 flex-col gap-2.5">
	<div class="grid grid-cols-3 gap-2" role="group" aria-label="Filtrar unidades por estado">
		{#each tiles as tile (tile.id)}
			{@const on = filter === tile.id}
			<button
				type="button"
				class="nx-glass nx-float flex flex-col items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 {on
					? 'nx-glass-hi'
					: 'hover:border-slate-300 dark:hover:border-white/15'}"
				aria-pressed={on}
				onclick={() => toggleFilter(tile.id)}
			>
				<span class="flex items-center gap-1.5 text-[11px] leading-none nx-muted">
					<i class="inline-block h-1.5 w-1.5 rounded-full {tile.dot}" aria-hidden="true"></i>
					{tile.label}
				</span>
				{#key counts[tile.id]}
					<!-- Al cambiar la cifra, destella un instante (dato en vivo). -->
					<span
						class="nx-num nx-tick text-[26px] leading-none {counts[tile.id] > 0 ? tile.num : ''}"
						>{counts[tile.id]}</span
					>
				{/key}
			</button>
		{/each}
	</div>

	{#if showUtilization}
		<UtilizationCard {onRetry} {onOpenReports} />
	{/if}

	<section
		class="nx-glass nx-float flex min-h-0 flex-col rounded-[18px] p-3"
		aria-labelledby="fleet-title"
	>
		<div class="mb-2.5 flex items-center justify-between gap-2 px-1">
			<h2 id="fleet-title" class="m-0 flex items-center gap-1.5 text-[13px] font-medium">
				<Icon
					icon="mdi:car-side"
					class="h-4 w-4 text-indigo-500 dark:text-indigo-400"
					aria-hidden="true"
				/>
				Unidades <span class="nx-muted font-normal">{filtered.length}</span>
			</h2>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.06]"
					onclick={onManageUnits}
					title="Editar unidades, visibilidad en el mapa y filtros avanzados"
				>
					<Icon icon="mdi:tune-variant" class="h-3.5 w-3.5" aria-hidden="true" />
					Gestionar
				</button>
				{#if onCollapse}
					<button
						type="button"
						class="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.06]"
						onclick={onCollapse}
						aria-label="Ocultar la columna de flota"
						title="Ocultar"
					>
						<Icon icon="mdi:chevron-double-left" class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>
		</div>

		<label class="relative mb-2.5 block">
			<span class="sr-only">Buscar unidad</span>
			<Icon
				icon="mdi:magnify"
				class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 nx-muted"
				aria-hidden="true"
			/>
			<input
				type="search"
				bind:value={query}
				oninput={() => (limit = PAGE)}
				placeholder="Buscar unidad, marca o placa"
				class="h-9 w-full rounded-full border border-slate-200 bg-white/70 pl-9 pr-3 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/25"
			/>
		</label>

		{#if $loadingVehicles && $vehicles.length === 0}
			<p class="m-0 px-1 py-2 text-[12px] nx-muted">Cargando unidades…</p>
		{:else if filtered.length === 0}
			<p class="m-0 px-1 py-2 text-[12px] nx-muted">
				{$vehicles.length === 0
					? 'Todavía no hay unidades en esta organización.'
					: 'Ninguna unidad coincide con el filtro.'}
			</p>
		{:else}
			<ul class="m-0 grid list-none grid-cols-2 gap-2 p-0">
				{#each visible as { u, status } (u.id)}
					{@const trail = projectTrail($liveTrails[String(u.id)] ?? [], 140, 52, 7)}
					{@const sp = sparkline($liveSpeeds[String(u.id)] ?? [])}
					<li class="min-w-0">
						<button
							type="button"
							class="flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/60 p-2.5 text-left transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15"
							onclick={() => onSelectUnit(u)}
						>
							<span class="min-w-0">
								<span class="block truncate text-[12.5px] font-medium leading-tight">{u.name}</span>
								<span class="mt-0.5 block truncate text-[10.5px] nx-muted">{subtitle(u)}</span>
							</span>
							<span
								class="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] dark:border-white/10"
							>
								<i class="inline-block h-1.5 w-1.5 shrink-0 rounded-full {status.dotClass}"></i>
								<span class="truncate {status.colorClass}">{status.shortLabel}</span>
							</span>
							<span
								class="block overflow-hidden rounded-[10px] border border-slate-200/70 bg-slate-100/70 dark:border-white/[0.05] dark:bg-black/20"
							>
								<svg viewBox="0 0 140 52" class="block h-auto w-full" aria-hidden="true">
									{#each [10, 24, 38, 52, 66, 80, 94, 108, 122] as x (x)}
										<line
											x1={x}
											x2={x}
											y1="0"
											y2="52"
											class="stroke-slate-300/40 dark:stroke-white/[0.04]"
										/>
									{/each}
									{#each [10, 24, 38] as y (y)}
										<line
											x1="0"
											x2="140"
											y1={y}
											y2={y}
											class="stroke-slate-300/40 dark:stroke-white/[0.04]"
										/>
									{/each}
									{#if trail}
										<path
											d={trail.d}
											fill="none"
											stroke-width="1.4"
											stroke-linejoin="round"
											class={status.dotClass === 'bg-emerald-400'
												? 'stroke-emerald-500 dark:stroke-emerald-400'
												: 'stroke-slate-700 dark:stroke-white/85'}
										/>
										<circle
											cx={trail.end[0]}
											cy={trail.end[1]}
											r="5"
											class="fill-slate-900/10 dark:fill-white/15"
										/>
										<circle
											cx={trail.end[0]}
											cy={trail.end[1]}
											r="2.4"
											class="fill-slate-800 dark:fill-white"
										/>
									{:else}
										<circle cx="70" cy="26" r="2.4" class="fill-slate-400 dark:fill-white/40" />
									{/if}
								</svg>
							</span>
							{#if sp}
								<!-- Velocidad de los últimos 30 min -->
								<svg viewBox="0 0 140 18" class="block h-auto w-full" aria-hidden="true">
									<path d={sp.area} class="fill-cyan-500/15 dark:fill-cyan-400/15" />
									<path
										d={sp.line}
										fill="none"
										stroke-width="1.2"
										class="stroke-cyan-600 dark:stroke-cyan-400"
									/>
								</svg>
							{/if}
							<span
								class="flex items-center justify-between gap-1 text-[10px] leading-tight nx-muted"
							>
								<span class="truncate"
									>{trail
										? 'Recorrido desde que abriste el panel'
										: 'Sin movimiento reciente'}</span
								>
								{#if sinceLabel(u.lastUpdate, $clock)}
									<span class="nx-mono shrink-0">{sinceLabel(u.lastUpdate, $clock)}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if filtered.length > visible.length}
				<button
					type="button"
					class="mt-2 h-8 w-full rounded-xl text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.05]"
					onclick={() => (limit += PAGE)}
				>
					Mostrar {Math.min(PAGE, filtered.length - visible.length)} más
				</button>
			{/if}
			<p class="m-0 mt-2.5 flex items-start gap-1.5 px-1 text-[10.5px] leading-snug nx-muted">
				<Icon icon="mdi:hammer-wrench" class="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
				<span
					>El mini-recorrido muestra lo recibido desde que abriste el panel. El recorrido completo
					del día está en construcción.</span
				>
			</p>
		{/if}
	</section>
</div>
