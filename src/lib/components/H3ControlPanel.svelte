<script>
	import Icon from '@iconify/svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import { theme } from '$lib/stores/themeStore.js';
	import {
		showH3Grid,
		h3Resolution,
		selectedH3Cells,
		selectedH3Count,
		renderedH3Cells,
		h3Actions
	} from '$lib/stores/h3Store.js';

	export let open = false;
	export let onTogglePanel = () => {};
	export let onClose = () => {};

	$: isLightTheme = $theme === 'light';
	$: h3CellsNewestFirst = [...$selectedH3Cells].reverse();

	function toggleH3Grid() {
		h3Actions.toggleGrid();
	}

	function popLastH3Selection() {
		h3Actions.popLastSelection();
	}

	function clearH3SelectionAll() {
		h3Actions.clearSelection();
	}
</script>

<button
	type="button"
	on:click={onTogglePanel}
	aria-label="Abrir panel de controles de rejilla H3"
	aria-haspopup="dialog"
	aria-expanded={open}
	class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 {isLightTheme
		? 'border border-slate-600/45 bg-gradient-to-br from-slate-700 to-slate-900 shadow-[0_2px_6px_rgb(15_23_42_/_0.2)] [box-shadow:inset_0_1px_0_rgb(255_255_255_/_0.08)] hover:brightness-[1.07]'
		: 'border border-white/10 bg-white/10 hover:bg-white/[0.16]'}"
	class:ring-2={open}
	class:ring-cyan-400={open}
	class:ring-offset-2={open}
	class:ring-offset-slate-900={open && isLightTheme}
	class:ring-offset-slate-950={open && !isLightTheme}
>
	<Icon icon="mdi:hexagon-multiple-outline" class="h-8 w-8 shrink-0" aria-hidden="true" />
</button>

<CenterSheet {open} title="Red H3" onClose={() => onClose()}>
	<div class="space-y-6">
		<section aria-labelledby="h3-visibility-heading">
			<h3
				id="h3-visibility-heading"
				class="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
			>
				Visibilidad
			</h3>
			<button
				type="button"
				class="flex w-full min-h-[2.75rem] cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-600/30 bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-900/20 transition-colors hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 dark:border-cyan-500/35 dark:shadow-cyan-950/30"
				on:click={toggleH3Grid}
				aria-pressed={$showH3Grid}
			>
				<Icon icon="mdi:format-list-bulleted" class="h-5 w-5 shrink-0" aria-hidden="true" />
				{$showH3Grid ? 'Ocultar red H3 en el mapa' : 'Mostrar red H3 en el mapa'}
			</button>
			<p
				class="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400"
				id="h3-map-hint"
			>
				Toca los hexágonos en el mapa para seleccionar o quitar celdas. El botón del mapa quita la
				<strong class="font-semibold">última</strong> selección (LIFO), una por una.
			</p>
		</section>

		<section aria-labelledby="h3-config-heading">
			<h3
				id="h3-config-heading"
				class="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
			>
				Configuración
			</h3>
			<fieldset
				class="m-0 min-w-0 rounded-xl border border-slate-200 bg-slate-50/95 p-4 dark:border-slate-600 dark:bg-slate-800/90"
			>
				<legend class="sr-only">Parámetros de resolución de la rejilla H3</legend>
				<label
					for="h3-resolution-sheet"
					class="block text-xs font-medium text-slate-600 dark:text-slate-300"
				>
					Resolución actual: <span class="font-mono text-slate-800 dark:text-slate-200"
						>{$h3Resolution}</span
					>
				</label>
				<input
					id="h3-resolution-sheet"
					type="range"
					min="5"
					max="11"
					step="1"
					value={$h3Resolution}
					aria-valuemin="5"
					aria-valuemax="11"
					aria-valuenow={$h3Resolution}
					aria-valuetext={`Resolución H3 nivel ${$h3Resolution}`}
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-600 dark:bg-slate-700 dark:accent-cyan-500"
					on:input={(event) => h3Actions.setResolution(Number(event.currentTarget.value))}
				/>
				<p
					id="h3-rendered-count"
					class="mt-2 text-xs text-slate-600 dark:text-slate-300"
					aria-live="polite"
				>
					Celdas visibles en pantalla: <strong
						class="font-semibold text-slate-800 dark:text-slate-100">{$renderedH3Cells}</strong
					>
				</p>
			</fieldset>
		</section>

		<section aria-labelledby="h3-actions-heading">
			<h3 id="h3-actions-heading" class="sr-only">Acciones sobre la selección</h3>
			<div class="flex flex-col gap-2">
				<button
					type="button"
					class="flex w-full min-h-[2.75rem] cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-600/40 bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-orange-900/25 transition-colors hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:border-orange-500/45"
					on:click={popLastH3Selection}
					disabled={$selectedH3Count === 0}
					aria-label="Quitar la última celda H3 seleccionada"
				>
					<Icon icon="mdi:undo-variant" class="h-5 w-5 shrink-0" aria-hidden="true" />
					Quitar última (LIFO) · {$selectedH3Count}
				</button>
				<button
					type="button"
					class="w-full rounded-lg border border-red-600/30 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/35 dark:text-red-300 dark:hover:bg-red-950/40"
					on:click={clearH3SelectionAll}
					disabled={$selectedH3Count === 0}
				>
					Limpiar todas
				</button>
			</div>
		</section>

		{#if $selectedH3Cells.length > 0}
			<section
				class="rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-600 dark:bg-slate-900/40"
				aria-labelledby="h3-cells-list-heading"
			>
				<h3
					id="h3-cells-list-heading"
					class="m-0 mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
				>
					Identificadores ({$selectedH3Count})
				</h3>
				<p class="m-0 mb-2 text-[10px] text-slate-500 dark:text-slate-400">
					Orden: más reciente arriba (coincide con “quitar última”).
				</p>
				<ul
					class="m-0 max-h-40 list-none space-y-1 overflow-y-auto overscroll-contain p-0 font-mono text-[11px] text-slate-900 dark:text-slate-100"
					aria-label="Lista de índices H3 seleccionados, más reciente primero"
				>
					{#each h3CellsNewestFirst as cellId (cellId)}
						<li>
							<div
								class="break-all rounded-md bg-slate-100 px-2 py-1.5 dark:bg-slate-800/90"
								title={cellId}
							>
								{cellId}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</CenterSheet>
