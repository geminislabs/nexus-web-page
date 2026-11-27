<script>
	/**
	 * Modo gestión de la columna de flota (vista Panel). Sustituye al cajón
	 * «Unidades» de la vista Clásica sin perder nada: buscar, filtrar por estado
	 * y avanzados, mostrar u ocultar en el mapa (una o todas), centrar, ver
	 * detalles, editar y eliminar. Detalle y edición reutilizan los mismos
	 * formularios del cajón.
	 */
	import { createEventDispatcher, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Icon from '$lib/components/Icon.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import UnitProfileDetails from '$lib/components/Unit/UnitProfileDetails.svelte';
	import UnitEditPanel from '$lib/components/Unit/UnitEditPanel.svelte';
	import { vehicles, vehicleActions, mapVisibleUnitIds } from '$lib/stores/vehicleStore.js';
	import { mapService } from '$lib/services/mapService.js';
	import { user } from '$lib/stores/auth.js';
	import { getUnitTrackingStatus } from '$lib/utils/unitTrackingStatus.js';
	import { getStatusText } from '$lib/utils/vehicleUtils.js';
	import {
		filterAndSortUnits,
		advancedFilterCount,
		unitHasGps
	} from '$lib/utils/unitListFilter.js';
	import { logger } from '$lib/utils/logger.js';

	const dispatch = createEventDispatcher();

	// Igual que el cajón clásico: si las unidades aún no se cargaron, se piden.
	onMount(() => {
		if (get(vehicles).length === 0) vehicleActions.loadVehicles();
	});
	const PAGE = 30;

	$: isMaster = !!$user?.is_master;

	let search = '';
	/** @type {'all' | 'active' | 'maintenance' | 'inactive'} */
	let status = 'all';
	/** @type {'all' | 'on' | 'off'} */
	let ignition = 'all';
	/** @type {'all' | 'moving' | 'stopped'} */
	let motion = 'all';
	/** @type {'all' | 'with' | 'without'} */
	let gps = 'all';
	/** @type {'name' | 'speed' | 'updated'} */
	let sortBy = 'name';
	let showAdvanced = false;
	let limit = PAGE;
	let refreshing = false;
	/** @type {string | null} */
	let menuFor = null;
	let hint = '';
	let hintOk = true;

	/** @type {'list' | 'detail' | 'edit'} */
	let sub = 'list';
	/** @type {any} */
	let detail = null;
	/** @type {any} */
	let editing = null;
	/** @type {any} */
	let toDelete = null;
	let busy = false;

	$: filters = { search, status, ignition, motion, gps, sortBy };
	$: filtered = filterAndSortUnits($vehicles, filters);
	$: visible = filtered.slice(0, limit);
	$: advCount = advancedFilterCount(filters);
	$: visibleSet = new Set(($mapVisibleUnitIds || []).map(String));
	$: allOnMap = filtered.length > 0 && filtered.every((v) => visibleSet.has(String(v.id)));
	$: someOnMap = !allOnMap && filtered.some((v) => visibleSet.has(String(v.id)));
	$: counts = {
		all: $vehicles.length,
		active: $vehicles.filter((v) => v.status === 'active').length,
		maintenance: $vehicles.filter((v) => v.status === 'maintenance').length,
		inactive: $vehicles.filter((v) => v.status === 'inactive').length
	};
	$: {
		filters;
		limit = PAGE;
	}

	const STATUS_TABS = [
		{ id: 'all', label: 'Todas' },
		{ id: 'active', label: 'Activas' },
		{ id: 'maintenance', label: 'Mantenimiento' },
		{ id: 'inactive', label: 'Inactivas' }
	];
	const SELECTS = [
		{
			key: 'ignition',
			label: 'Ignición',
			options: [
				['all', 'Todas'],
				['on', 'Encendida'],
				['off', 'Apagada']
			]
		},
		{
			key: 'motion',
			label: 'Movimiento',
			options: [
				['all', 'Todos'],
				['moving', 'En movimiento'],
				['stopped', 'Detenidas']
			]
		},
		{
			key: 'gps',
			label: 'GPS',
			options: [
				['all', 'Todos'],
				['with', 'Con posición'],
				['without', 'Sin posición']
			]
		},
		{
			key: 'sortBy',
			label: 'Ordenar por',
			options: [
				['name', 'Nombre'],
				['speed', 'Velocidad'],
				['updated', 'Última actualización']
			]
		}
	];
	/** @type {Record<string, string>} */
	$: selectValues = { ignition, motion, gps, sortBy };

	function setSelect(/** @type {string} */ key, /** @type {string} */ value) {
		if (key === 'ignition') ignition = /** @type {any} */ (value);
		else if (key === 'motion') motion = /** @type {any} */ (value);
		else if (key === 'gps') gps = /** @type {any} */ (value);
		else if (key === 'sortBy') sortBy = /** @type {any} */ (value);
	}

	function clearAdvanced() {
		ignition = 'all';
		motion = 'all';
		gps = 'all';
		sortBy = 'name';
	}

	function showHint(/** @type {string} */ msg, ok = true) {
		hint = msg;
		hintOk = ok;
		setTimeout(() => (hint = ''), 3500);
	}

	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await vehicleActions.loadVehiclePositions();
		} finally {
			refreshing = false;
		}
	}

	function toggleAllOnMap() {
		vehicleActions.setMapVisibilityForIds(
			filtered.map((v) => v.id),
			!allOnMap
		);
	}

	function subtitle(/** @type {any} */ u) {
		const car = [u.brand, u.model].filter(Boolean).join(' ');
		return [car, u.plate].filter(Boolean).join(' · ') || u.description || 'Sin datos del vehículo';
	}

	function center(/** @type {any} */ v) {
		menuFor = null;
		if (!unitHasGps(v)) return;
		vehicleActions.setMapVisibility(v.id, true);
		mapService.centerOnVehicle(v);
	}

	async function openDetail(/** @type {any} */ v) {
		menuFor = null;
		if (busy) return;
		busy = true;
		try {
			detail = await vehicleActions.fetchVehicle(v.id);
			editing = null;
			sub = 'detail';
		} catch (error) {
			logger.error('Error obteniendo detalle de unidad:', error);
			showHint('No se pudo obtener el detalle de la unidad', false);
		} finally {
			busy = false;
		}
	}

	function openEdit(/** @type {any} */ v) {
		menuFor = null;
		if (!isMaster) return;
		editing = get(vehicles).find((x) => x.id === v.id) || v;
		detail = null;
		sub = 'edit';
	}

	function backToList() {
		sub = 'list';
		detail = null;
		editing = null;
	}

	function askDelete(/** @type {any} */ v) {
		menuFor = null;
		if (isMaster) toDelete = v;
	}

	async function confirmDelete() {
		if (!toDelete?.id || busy) return;
		busy = true;
		try {
			await vehicleActions.deleteVehicle(toDelete.id);
			showHint('Unidad eliminada', true);
			if (detail?.id === toDelete.id) backToList();
			toDelete = null;
		} catch (error) {
			logger.error('Error eliminando unidad:', error);
			showHint('No se pudo eliminar la unidad', false);
		} finally {
			busy = false;
		}
	}

	function onWindowClick(/** @type {MouseEvent} */ e) {
		const t = /** @type {Element | null} */ (e.target);
		if (menuFor && !t?.closest?.('[data-unit-menu]')) menuFor = null;
	}
	function onWindowKey(/** @type {KeyboardEvent} */ e) {
		if (e.key === 'Escape' && menuFor) menuFor = null;
	}

	/** Checkbox con estado intermedio (no es un atributo reactivo). */
	function indeterminate(/** @type {HTMLInputElement} */ node, /** @type {boolean} */ value) {
		node.indeterminate = value;
		return {
			update(/** @type {boolean} */ v) {
				node.indeterminate = v;
			}
		};
	}

	const iconBtn =
		'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.07]';
</script>

<svelte:window on:click={onWindowClick} on:keydown={onWindowKey} />

<section
	class="nx-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px]"
	aria-labelledby="fleet-manage-title"
>
	{#if sub !== 'list'}
		<header
			class="flex shrink-0 items-center gap-2 border-b border-slate-200/80 px-3 py-3 dark:border-white/[0.07]"
		>
			<button type="button" class={iconBtn} on:click={backToList} aria-label="Volver a unidades">
				<Icon icon="mdi:chevron-left" class="h-5 w-5" aria-hidden="true" />
			</button>
			<div class="min-w-0 flex-1">
				<h2 id="fleet-manage-title" class="m-0 truncate text-[13px] font-medium">
					{sub === 'detail' ? 'Detalles de la unidad' : 'Editar unidad'}
				</h2>
				<p class="m-0 truncate text-[11px] nx-muted">
					{sub === 'detail' ? detail?.name : editing?.name}
				</p>
			</div>
			{#if isMaster && sub === 'detail' && detail}
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.07]"
					on:click={() => openEdit(detail)}
				>
					<Icon icon="mdi:pencil-outline" class="h-3.5 w-3.5" aria-hidden="true" />Editar
				</button>
			{/if}
		</header>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
			{#if sub === 'detail' && detail}
				<UnitProfileDetails unit={detail} variant="drawer" active={true} />
			{:else if sub === 'edit' && editing}
				<div class="px-2 pb-6">
					<UnitEditPanel
						unit={editing}
						compact={false}
						on:cancel={backToList}
						on:saved={() => {
							showHint('Unidad actualizada', true);
							backToList();
						}}
						on:deleted={() => {
							showHint('Unidad eliminada', true);
							backToList();
						}}
					/>
				</div>
			{/if}
		</div>
	{:else}
		<header class="shrink-0 space-y-3 border-b border-slate-200/80 p-3 dark:border-white/[0.07]">
			<div class="flex items-center gap-2 px-1">
				<h2 id="fleet-manage-title" class="m-0 flex-1 text-[13px] font-medium">
					Gestionar unidades <span class="nx-muted font-normal">{filtered.length}</span>
				</h2>
				<button
					type="button"
					class={iconBtn}
					on:click={refresh}
					disabled={refreshing}
					aria-label="Actualizar posiciones"
					title="Actualizar posiciones"
				>
					<Icon
						icon="mdi:refresh"
						class="h-4 w-4 {refreshing ? 'animate-spin motion-reduce:animate-none' : ''}"
						aria-hidden="true"
					/>
				</button>
				<button
					type="button"
					class="inline-flex h-8 items-center rounded-full bg-slate-900 px-3.5 text-[12px] font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
					on:click={() => dispatch('done')}
				>
					Listo
				</button>
			</div>

			<div class="flex items-center gap-2">
				<label class="relative block min-w-0 flex-1">
					<span class="sr-only">Buscar unidad</span>
					<Icon
						icon="mdi:magnify"
						class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 nx-muted"
						aria-hidden="true"
					/>
					<input
						type="search"
						bind:value={search}
						placeholder="Buscar unidad, conductor, marca o placa"
						class="h-9 w-full rounded-full border border-slate-200 bg-white/70 pl-9 pr-3 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/25"
					/>
				</label>
				<button
					type="button"
					class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 transition-colors hover:bg-slate-900/5 focus-visible:outline-2 dark:border-white/[0.08] dark:hover:bg-white/[0.07] {showAdvanced
						? 'bg-slate-900/[0.06] dark:bg-white/[0.08]'
						: ''}"
					on:click={() => (showAdvanced = !showAdvanced)}
					aria-expanded={showAdvanced}
					aria-controls="fleet-manage-advanced"
					aria-label="Filtros avanzados"
					title="Filtros avanzados"
				>
					<Icon icon="mdi:filter-variant" class="h-4 w-4" aria-hidden="true" />
					{#if advCount > 0}
						<span
							class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9.5px] font-semibold text-white dark:bg-white dark:text-slate-900"
							>{advCount}</span
						>
					{/if}
				</button>
			</div>

			<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
				{#each STATUS_TABS as tab (tab.id)}
					{@const on = status === tab.id}
					<button
						type="button"
						class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] transition-colors focus-visible:outline-2 {on
							? 'border-slate-900/30 bg-slate-900/[0.06] font-medium dark:border-white/25 dark:bg-white/[0.08]'
							: 'border-slate-200 nx-muted hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/15'}"
						aria-pressed={on}
						on:click={() => (status = /** @type {any} */ (tab.id))}
					>
						{tab.label}
						<span class="opacity-70">{counts[tab.id]}</span>
					</button>
				{/each}
			</div>

			{#if showAdvanced}
				<div id="fleet-manage-advanced" class="grid grid-cols-2 gap-2">
					{#each SELECTS as sel (sel.key)}
						<label class="flex flex-col gap-1">
							<span class="nx-label">{sel.label}</span>
							<select
								value={selectValues[sel.key]}
								on:change={(e) => setSelect(sel.key, e.currentTarget.value)}
								class="h-8 rounded-lg border border-slate-200 bg-white/70 px-2 text-[12px] text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/[0.08] dark:bg-[#1b1e22] dark:text-white"
							>
								{#each sel.options as [value, label] (value)}
									<option {value}>{label}</option>
								{/each}
							</select>
						</label>
					{/each}
					{#if advCount > 0}
						<button
							type="button"
							class="col-span-2 h-8 rounded-lg text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.06]"
							on:click={clearAdvanced}>Quitar filtros avanzados</button
						>
					{/if}
				</div>
			{/if}

			<label class="flex cursor-pointer items-center gap-2 px-1 text-[12px]">
				<input
					type="checkbox"
					class="h-4 w-4 rounded accent-slate-900 dark:accent-white"
					checked={allOnMap}
					use:indeterminate={someOnMap}
					disabled={filtered.length === 0}
					on:change={toggleAllOnMap}
				/>
				Mostrar en el mapa las {filtered.length} unidades de la lista
			</label>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
			{#if filtered.length === 0}
				<p class="m-0 p-3 text-[12px] nx-muted">
					{$vehicles.length === 0
						? 'Todavía no hay unidades en esta organización.'
						: 'Ninguna unidad coincide con los filtros.'}
				</p>
			{:else}
				<ul class="m-0 flex list-none flex-col gap-1 p-0">
					{#each visible as v (v.id)}
						{@const st = getUnitTrackingStatus(v)}
						{@const onMap = visibleSet.has(String(v.id))}
						<li
							class="flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.03]"
						>
							<button
								type="button"
								class="{iconBtn} {onMap ? '' : 'nx-muted'}"
								aria-pressed={onMap}
								aria-label="{onMap ? 'Ocultar' : 'Mostrar'} {v.name} en el mapa"
								title={onMap ? 'Visible en el mapa' : 'Oculta en el mapa'}
								on:click={() => vehicleActions.toggleMapVisibility(v.id)}
							>
								<Icon
									icon={onMap ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}
									class="h-4 w-4"
									aria-hidden="true"
								/>
							</button>
							<button
								type="button"
								class="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2"
								on:click={() => openDetail(v)}
								title="Ver detalles"
							>
								<span class="flex items-center gap-2">
									<span class="truncate text-[12.5px] font-medium">{v.name}</span>
									{#if v.status && v.status !== 'active'}
										<span
											class="shrink-0 rounded-full border border-slate-200 px-1.5 text-[10px] nx-muted dark:border-white/10"
											>{getStatusText(v.status)}</span
										>
									{/if}
								</span>
								<span class="mt-0.5 block truncate text-[10.5px] nx-muted">{subtitle(v)}</span>
							</button>
							<span class="hidden shrink-0 items-center gap-1.5 text-[11px] nx-muted sm:flex">
								<i class="inline-block h-1.5 w-1.5 rounded-full {st.dotClass}" aria-hidden="true"
								></i>
								{st.shortLabel}
							</span>
							<div class="relative shrink-0" data-unit-menu>
								<button
									type="button"
									class={iconBtn}
									aria-haspopup="menu"
									aria-expanded={menuFor === String(v.id)}
									aria-label="Acciones de {v.name}"
									on:click|stopPropagation={() =>
										(menuFor = menuFor === String(v.id) ? null : String(v.id))}
								>
									<Icon icon="mdi:dots-horizontal" class="h-4 w-4" aria-hidden="true" />
								</button>
								{#if menuFor === String(v.id)}
									<div
										class="nx-glass absolute right-0 top-[calc(100%+4px)] z-10 w-48 rounded-xl bg-white p-1 shadow-[0_16px_32px_rgb(15_23_42/0.14)] dark:bg-[#1b1e22] dark:shadow-[0_16px_32px_rgb(0_0_0/0.5)]"
										role="menu"
									>
										<button
											type="button"
											role="menuitem"
											class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] hover:bg-slate-900/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
											disabled={!unitHasGps(v)}
											title={unitHasGps(v) ? undefined : 'La unidad no tiene posición'}
											on:click={() => center(v)}
										>
											<Icon icon="mdi:crosshairs-gps" class="h-4 w-4" aria-hidden="true" />Centrar
											en el mapa
										</button>
										<button
											type="button"
											role="menuitem"
											class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] hover:bg-slate-900/5 dark:hover:bg-white/[0.06]"
											on:click={() => openDetail(v)}
										>
											<Icon
												icon="mdi:information-outline"
												class="h-4 w-4"
												aria-hidden="true"
											/>Detalles
										</button>
										{#if isMaster}
											<button
												type="button"
												role="menuitem"
												class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] hover:bg-slate-900/5 dark:hover:bg-white/[0.06]"
												on:click={() => openEdit(v)}
											>
												<Icon icon="mdi:pencil-outline" class="h-4 w-4" aria-hidden="true" />Editar
											</button>
											<div class="my-1 h-px bg-slate-200 dark:bg-white/[0.07]"></div>
											<button
												type="button"
												role="menuitem"
												class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
												on:click={() => askDelete(v)}
											>
												<Icon
													icon="mdi:delete-outline"
													class="h-4 w-4"
													aria-hidden="true"
												/>Eliminar
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				{#if filtered.length > visible.length}
					<button
						type="button"
						class="mt-2 h-8 w-full rounded-xl text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.05]"
						on:click={() => (limit += PAGE)}
					>
						Mostrar {Math.min(PAGE, filtered.length - visible.length)} más
					</button>
				{/if}
			{/if}
		</div>
	{/if}

	{#if hint}
		<p
			class="m-0 shrink-0 border-t border-slate-200/80 px-4 py-2 text-[12px] dark:border-white/[0.07] {hintOk
				? ''
				: 'text-rose-600 dark:text-rose-400'}"
			role="status"
		>
			{hint}
		</p>
	{/if}
</section>

<ConfirmModal
	open={!!toDelete}
	title="Eliminar unidad"
	confirmLabel="Eliminar"
	cancelLabel="Cancelar"
	destructive
	loading={busy}
	zIndexClass="z-[200]"
	on:cancel={() => (toDelete = null)}
	on:confirm={confirmDelete}
>
	{#if toDelete}
		<p class="m-0">
			¿Eliminar la unidad <strong>{toDelete.name}</strong>? Deja de aparecer en el panel y en el
			mapa.
		</p>
	{/if}
</ConfirmModal>
