<script>
	import { onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import {
		getGpsIndicator,
		getCellularIndicator,
		inferNetworkTech,
		networkTechLabel
	} from '$lib/utils/signalIndicators.js';

	/** @type {Record<string, any> | null} */
	export let unit = null;
	/** compact | card | grid — grid usa display:contents para celdas en un padre 2×2 */
	export let variant = 'card';

	let openDetail = /** @type {null | 'gps' | 'cell'} */ (null);
	/** @type {{ top: number, left: number, width: number } | null} */
	let tipPos = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let hideTimer = null;

	$: gps = getGpsIndicator(unit?.satellites, { fixStatus: unit?.fixStatus ?? unit?.fix_status });
	$: tech = inferNetworkTech(unit);
	$: cell = getCellularIndicator(unit?.rxLvl ?? unit?.rx_lvl, tech);
	$: cellTitle = networkTechLabel(tech);

	$: tipEntries =
		openDetail === 'gps' && gps
			? Object.entries(gps.tech)
			: openDetail === 'cell' && cell
				? Object.entries(cell.tech)
				: [];
	$: tipTitle =
		openDetail === 'gps' ? 'Información GPS' : openDetail === 'cell' ? 'Información de señal' : '';

	function clearHide() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	/**
	 * @param {'gps' | 'cell'} kind
	 * @param {HTMLElement} el
	 */
	function showTip(kind, el) {
		clearHide();
		const r = el.getBoundingClientRect();
		const width = Math.min(Math.max(r.width, 200), 280);
		let left = r.left;
		if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
		const below = r.bottom + 8;
		const tipH = 120;
		const top = below + tipH > window.innerHeight - 8 ? Math.max(8, r.top - tipH - 8) : below;
		openDetail = kind;
		tipPos = { top, left, width };
	}

	function scheduleHide() {
		clearHide();
		hideTimer = setTimeout(() => {
			openDetail = null;
			tipPos = null;
			hideTimer = null;
		}, 120);
	}

	function onScrollOrResize() {
		openDetail = null;
		tipPos = null;
	}

	onDestroy(() => {
		clearHide();
	});

	/** @param {HTMLElement} node */
	function portal(node) {
		if (typeof document === 'undefined') return {};
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}
</script>

<svelte:window on:scroll={onScrollOrResize} on:resize={onScrollOrResize} />

{#if gps || cell}
	<div
		class={variant === 'grid'
			? 'contents'
			: `flex flex-wrap items-stretch gap-1.5 ${variant === 'compact' ? '' : 'w-full'}`}
	>
		{#if gps}
			<div
				class="relative min-h-[2.75rem] min-w-0 {variant === 'grid' ? 'h-full w-full' : 'flex-1'}"
				data-signal-meter
				role="group"
				aria-label="GPS: {gps.label}. Pasa el ratón para ver detalle."
				on:mouseenter={(e) => showTip('gps', /** @type {HTMLElement} */ (e.currentTarget))}
				on:mouseleave={scheduleHide}
				on:focusin={(e) => showTip('gps', /** @type {HTMLElement} */ (e.currentTarget))}
				on:focusout={scheduleHide}
			>
				<button
					type="button"
					class="flex h-full min-h-[2.75rem] w-full cursor-help items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
					aria-label="GPS: {gps.label}. Detalle técnico al enfocar o pasar el ratón."
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm"
						style="background: linear-gradient(145deg, {gps.hex}33, {gps.hex}14); color:{gps.hex}; box-shadow: 0 0 12px {gps.hex}33"
						aria-hidden="true"
					>
						<Icon icon="mdi:satellite-uplink" width={18} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center justify-between gap-1">
							<span
								class="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/45"
								>GPS</span
							>
							<span class="flex items-end gap-px" aria-hidden="true">
								{#each [1, 2, 3, 4, 5] as i (i)}
									<span
										class="w-[3px] rounded-sm"
										style="height:{6 + i * 2}px; background:{i <= gps.bars
											? gps.hex
											: 'rgba(148,163,184,0.35)'}"
									></span>
								{/each}
							</span>
						</span>
						<span class="mt-0.5 flex items-baseline justify-between gap-1">
							<span class="text-[11px] font-bold" style="color:{gps.hex}">{gps.label}</span>
							<span class="truncate text-[10px] font-medium text-slate-500 dark:text-white/40"
								>{gps.detail}</span
							>
						</span>
					</span>
					<Icon
						icon="mdi:information-outline"
						width={12}
						class="shrink-0 text-slate-400 dark:text-white/30"
						aria-hidden="true"
					/>
				</button>
			</div>
		{/if}

		{#if cell}
			<div
				class="relative min-h-[2.75rem] min-w-0 {variant === 'grid' ? 'h-full w-full' : 'flex-1'}"
				data-signal-meter
				role="group"
				aria-label="{cellTitle}: {cell.label}. Pasa el ratón para ver detalle."
				on:mouseenter={(e) => showTip('cell', /** @type {HTMLElement} */ (e.currentTarget))}
				on:mouseleave={scheduleHide}
				on:focusin={(e) => showTip('cell', /** @type {HTMLElement} */ (e.currentTarget))}
				on:focusout={scheduleHide}
			>
				<button
					type="button"
					class="flex h-full min-h-[2.75rem] w-full cursor-help items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
					aria-label="{cellTitle}: {cell.label}. Detalle técnico al enfocar o pasar el ratón."
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm"
						style="background: linear-gradient(145deg, {cell.hex}33, {cell.hex}14); color:{cell.hex}; box-shadow: 0 0 12px {cell.hex}33"
						aria-hidden="true"
					>
						<Icon icon="mdi:signal-cellular-3" width={18} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center justify-between gap-1">
							<span
								class="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/45"
								>{cellTitle}</span
							>
							<span class="flex items-end gap-px" aria-hidden="true">
								{#each [1, 2, 3, 4, 5] as i (i)}
									<span
										class="w-[3px] rounded-sm"
										style="height:{6 + i * 2}px; background:{i <= cell.bars
											? cell.hex
											: 'rgba(148,163,184,0.35)'}"
									></span>
								{/each}
							</span>
						</span>
						<span class="mt-0.5 flex items-baseline justify-between gap-1">
							<span class="text-[11px] font-bold" style="color:{cell.hex}">{cell.label}</span>
							<span class="truncate text-[10px] font-medium text-slate-500 dark:text-white/40"
								>{cell.detail}</span
							>
						</span>
					</span>
					<Icon
						icon="mdi:information-outline"
						width={12}
						class="shrink-0 text-slate-400 dark:text-white/30"
						aria-hidden="true"
					/>
				</button>
			</div>
		{/if}
	</div>
{/if}

{#if openDetail && tipPos && tipEntries.length}
	<!-- Popup flotante en body (evita overflow/transform de panel e InfoWindow) -->
	<div
		use:portal
		class="pointer-events-auto fixed z-[10050] rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl dark:border-white/10 dark:bg-[#0c1424]"
		style="top:{tipPos.top}px;left:{tipPos.left}px;width:{tipPos.width}px;"
		role="tooltip"
		aria-label={tipTitle}
		on:mouseenter={clearHide}
		on:mouseleave={scheduleHide}
	>
		<p
			class="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/45"
		>
			{tipTitle}
		</p>
		<dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
			{#each tipEntries as [k, v] (k)}
				<dt class="text-slate-500 dark:text-white/40">{k}</dt>
				<dd class="m-0 font-semibold text-slate-800 dark:text-white/85">{v}</dd>
			{/each}
		</dl>
	</div>
{/if}
