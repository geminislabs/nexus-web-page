<script>
	import Icon from '@iconify/svelte';
	import { theme, themeActions } from '$lib/stores/themeStore.js';
	import {
		vehicles,
		loadingVehicles,
		loadingPositions,
		activeVehicles,
		vehicleActions
	} from '$lib/stores/vehicleStore.js';
	import {
		alerts,
		alertWizard,
		alarmEvents,
		zones,
		alertActions,
		unreadAlarmCount
	} from '$lib/stores/alertStore.js';
	import CrearAlertaWizard from './CrearAlertaWizard.svelte';
	import ZonasPanel from './ZonasPanel.svelte';
	import { mapService } from '$lib/services/mapService.js';
	import { getStatusText } from '$lib/utils/vehicleUtils.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import { onMount, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let initialSection = 'apariencia';
	export let showSectionSidebar = true;

	let activeSection = initialSection;
	/** Con barra interna: tabs locales. Sin ella: el padre manda la sección vía `initialSection`. */
	$: displaySection = showSectionSidebar ? activeSection : initialSection;
	let toolHint = '';
	let toolHintOk = true;
	let drawerZoneSubView = 'zonas';

	// ── Unidades: vista, paginación, filtros ──────────────────
	let vehicleView = 'grid';
	let vehiclePage = 1;
	const PAGE_SIZE = 10;
	let filterStatus = 'all';
	let filterSearch = '';
	let actionLoading = false;
	let vehicleToDelete = null;
	let editVehicleId = '';
	let editVehicleName = '';
	let editVehicleDescription = '';
	let vehicleDetail = null;
	let vehicleDetailOpen = false;

	$: filteredVehicles = $vehicles.filter((v) => {
		const matchStatus = filterStatus === 'all' || v.status === filterStatus;
		const q = filterSearch.toLowerCase();
		const matchSearch =
			!q ||
			v.name?.toLowerCase().includes(q) ||
			v.driver?.toLowerCase().includes(q) ||
			v.location?.toLowerCase().includes(q) ||
			v.description?.toLowerCase().includes(q);
		return matchStatus && matchSearch;
	});
	$: totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
	$: pagedVehicles = filteredVehicles.slice((vehiclePage - 1) * PAGE_SIZE, vehiclePage * PAGE_SIZE);
	// reset page when filters change
	$: {
		filterStatus;
		filterSearch;
		vehiclePage = 1;
	}

	// ── Sidebar sections ──────────────────────────────────────
	const sections = [
		{ id: 'apariencia', label: 'Apariencia', icon: 'mdi:theme-light-dark' },
		{ id: 'unidades', label: 'Unidades', icon: 'mdi:car-side' },
		{ id: 'zonas', label: 'Zonas', icon: 'mdi:hexagon-multiple-outline' },
		{ id: 'gestionar_alertas', label: 'Gestionar', icon: 'mdi:format-list-bulleted' },
		{
			id: 'alertas',
			label: 'Historial',
			title: 'Historial de alarmas',
			icon: 'mdi:bell-badge-outline'
		}
	];

	onMount(async () => {
		if ($vehicles.length === 0) await vehicleActions.loadVehicles();
	});

	// ── helpers ───────────────────────────────────────────────
	const alertCondLabel = (c) =>
		({ on: 'Encendido', off: 'Apagado', enter: 'Entrada', exit: 'Salida' })[c] ?? c;
	const alarmTypeLabel = (t) =>
		({ ignition: 'Ignición', zone: 'Zona' })[t] ?? (t ? String(t) : '—');

	function showHint(msg, ok = true) {
		toolHint = msg;
		toolHintOk = ok;
		setTimeout(() => (toolHint = ''), 3500);
	}
	async function refreshPositions() {
		await vehicleActions.loadVehiclePositions();
	}
	function centerOnVehicle(v) {
		if ((v.latitude || v.lat) && (v.longitude || v.lng)) {
			mapService.centerOnVehicle(v);
			dispatch('close');
		}
	}
	async function fetchVehicleDetail(vehicleId) {
		if (!vehicleId || actionLoading) return;
		actionLoading = true;
		try {
			const data = await vehicleActions.fetchVehicle(vehicleId);
			vehicleDetail = data;
			vehicleDetailOpen = true;
			showHint('Detalle de unidad actualizado', true);
		} catch (error) {
			console.error('Error obteniendo detalle de unidad:', error);
			showHint('No se pudo obtener el detalle de la unidad', false);
		} finally {
			actionLoading = false;
		}
	}
	function openEditVehicle(v) {
		editVehicleId = v.id;
		editVehicleName = v.name || '';
		editVehicleDescription = v.description || '';
	}
	function cancelEditVehicle() {
		editVehicleId = '';
		editVehicleName = '';
		editVehicleDescription = '';
	}
	async function saveVehicleEdit() {
		if (!editVehicleId || actionLoading) return;
		const name = editVehicleName.trim();
		if (!name) {
			showHint('El nombre de la unidad es obligatorio', false);
			return;
		}
		actionLoading = true;
		try {
			await vehicleActions.updateVehicle(editVehicleId, {
				name,
				description: editVehicleDescription
			});
			showHint('Unidad actualizada', true);
			cancelEditVehicle();
		} catch (error) {
			console.error('Error actualizando unidad:', error);
			showHint('No se pudo actualizar la unidad', false);
		} finally {
			actionLoading = false;
		}
	}
	function requestDeleteVehicle(v) {
		vehicleToDelete = v;
	}
	function cancelDeleteVehicle() {
		vehicleToDelete = null;
	}
	async function confirmDeleteVehicle() {
		if (!vehicleToDelete?.id || actionLoading) return;
		actionLoading = true;
		try {
			await vehicleActions.deleteVehicle(vehicleToDelete.id);
			showHint('Unidad eliminada', true);
			if (vehicleDetail?.id === vehicleToDelete.id) {
				vehicleDetail = null;
				vehicleDetailOpen = false;
			}
			vehicleToDelete = null;
		} catch (error) {
			console.error('Error eliminando unidad:', error);
			showHint('No se pudo eliminar la unidad', false);
		} finally {
			actionLoading = false;
		}
	}
	function sectionBadge(id) {
		if (id === 'unidades') return $vehicles.length;
		if (id === 'zonas') return $zones.length;
		if (id === 'alertas') return $unreadAlarmCount;
		if (id === 'gestionar_alertas') return $alerts.length;
		return 0;
	}
	const statusColor = (s) =>
		s === 'active'
			? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,.55)]'
			: s === 'maintenance'
				? 'bg-amber-500'
				: 'bg-red-500';
	const statusPill = (s) =>
		s === 'active'
			? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
			: s === 'maintenance'
				? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
				: 'bg-red-100 text-red-700 dark:bg-red-500/12 dark:text-red-300';
	const speedColor = (n) =>
		n > 60
			? 'text-red-600 dark:text-red-300'
			: n > 40
				? 'text-amber-600 dark:text-amber-200'
				: 'text-emerald-600 dark:text-emerald-300';
	const battColor = (n) =>
		n < 25
			? 'text-red-600 dark:text-red-300'
			: n < 50
				? 'text-amber-600 dark:text-amber-200'
				: 'text-emerald-600 dark:text-emerald-300';

</script>

{#if $alertWizard}
	<CrearAlertaWizard on:close={() => alertActions.closeWizard()} />
{/if}

<div
	class="flex h-full min-h-0 overflow-hidden bg-slate-100 text-slate-900 text-[13px] dark:bg-[#080d1a] dark:text-white/90"
	role="region"
	aria-label="Preferencias y herramientas del mapa"
>
	<!-- SIDEBAR -->
	{#if showSectionSidebar}
		<div
			class="flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-slate-200 bg-white py-3 dark:border-white/[0.07] dark:bg-[#060a15]"
			role="tablist"
		>
			{#each sections as sec}
				{@const badge = sectionBadge(sec.id)}
				<button
					type="button"
					class="relative flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-all duration-150
						{activeSection === sec.id
						? 'bg-blue-100 text-blue-700 dark:bg-blue-600/15 dark:text-blue-300'
						: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/38 dark:hover:bg-white/[0.06] dark:hover:text-white/65'}"
					role="tab"
					aria-selected={activeSection === sec.id}
					tabindex={activeSection === sec.id ? 0 : -1}
					on:click={() => (activeSection = sec.id)}
					title={sec.title ?? sec.label}
				>
					<span class="relative">
						<Icon icon={sec.icon} width={20} height={20} aria-hidden="true" />
						{#if badge > 0}
							<span
								class="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#060a15]"
							>
								{badge > 99 ? '99+' : badge}
							</span>
						{/if}
					</span>
					<span class="text-[10px] font-medium leading-none">{sec.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- PANEL -->
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-white dark:bg-transparent"
	>
		<!-- ═══ APARIENCIA ═══ -->
		{#if displaySection === 'apariencia'}
			<div class="px-4 py-4">
				<div class="mb-3 flex items-center gap-2">
					<Icon icon="mdi:theme-light-dark" width={14} class="text-slate-500 dark:text-white/35" aria-hidden="true" />
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">Apariencia</h3>
				</div>
				<div class="flex gap-2.5">
					<!-- Dark -->
					<button
						type="button"
						class="group flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all
						{$theme === 'dark'
							? 'border-blue-500/50 bg-blue-600/10'
							: 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]'}"
						on:click={() => themeActions.set('dark')}
						aria-pressed={$theme === 'dark'}
					>
						<div class="relative h-8 w-12 shrink-0 overflow-hidden rounded-md bg-[#07111f]">
							<div class="absolute inset-1 flex flex-col gap-0.5">
								<div class="h-1 w-[60%] rounded-sm bg-white/10"></div>
								<div class="flex flex-1 gap-0.5">
									<div class="w-[30%] rounded-sm bg-white/[0.05]"></div>
									<div class="flex-1 rounded-sm bg-slate-800/60"></div>
								</div>
							</div>
							{#if $theme === 'dark'}
								<span
									class="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-white"
								>
									<Icon icon="mdi:check" width={9} aria-hidden="true" />
								</span>
							{/if}
						</div>
						<div>
							<span
								class="flex items-center gap-1.5 text-[12px] font-semibold {$theme === 'dark'
									? 'text-slate-900 dark:text-white'
									: 'text-slate-600 dark:text-white/55'}"
							>
								<Icon
									icon="mdi:weather-night"
									width={13}
									class="text-indigo-300"
									aria-hidden="true"
								/>Oscuro
							</span>
							<span class="block text-[10px] text-slate-500 dark:text-white/28">Mapa nocturno</span>
						</div>
					</button>
					<!-- Light -->
					<button
						type="button"
						class="group flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all
						{$theme === 'light'
							? 'border-sky-500/50 bg-sky-500/10'
							: 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]'}"
						on:click={() => themeActions.set('light')}
						aria-pressed={$theme === 'light'}
					>
						<div class="relative h-8 w-12 shrink-0 overflow-hidden rounded-md bg-[#dde4ef]">
							<div class="absolute inset-1 flex flex-col gap-0.5">
								<div class="h-1 w-[60%] rounded-sm bg-slate-300/70"></div>
								<div class="flex flex-1 gap-0.5">
									<div class="w-[30%] rounded-sm bg-slate-100"></div>
									<div class="flex-1 rounded-sm bg-sky-100/80"></div>
								</div>
							</div>
							{#if $theme === 'light'}
								<span
									class="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-600 text-white"
								>
									<Icon icon="mdi:check" width={9} aria-hidden="true" />
								</span>
							{/if}
						</div>
						<div>
							<span
								class="flex items-center gap-1.5 text-[12px] font-semibold {$theme === 'light'
									? 'text-slate-900 dark:text-white'
									: 'text-slate-600 dark:text-white/55'}"
							>
								<Icon
									icon="mdi:white-balance-sunny"
									width={13}
									class="text-amber-300"
									aria-hidden="true"
								/>Claro
							</span>
							<span class="block text-[10px] text-slate-500 dark:text-white/28">Contraste diurno</span>
						</div>
					</button>
				</div>
			</div>

			<!-- ═══ UNIDADES ═══ -->
		{:else if displaySection === 'unidades'}
			<div class="flex h-full min-h-0 flex-col">
				<div
					class="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 space-y-2.5 dark:border-white/[0.06] dark:bg-[#080d1a]"
				>
					<div class="flex items-center gap-2">
						<Icon
							icon="mdi:car-side"
							width={14}
							class="shrink-0 text-slate-500 dark:text-white/35"
							aria-hidden="true"
						/>
						<span class="text-[14px] font-bold text-slate-900 dark:text-white">Unidades</span>
						<div class="flex items-center gap-1 ml-auto">
							<div
								class="flex overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]"
							>
								<button
									type="button"
									class="flex h-7 w-7 items-center justify-center transition-colors {vehicleView ===
									'grid'
										? 'bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300'
										: 'text-slate-500 hover:text-slate-800 dark:text-white/35 dark:hover:text-white/60'}"
									on:click={() => (vehicleView = 'grid')}
									title="Vista tarjeta"
									aria-pressed={vehicleView === 'grid'}
								>
									<Icon icon="mdi:view-grid-outline" width={15} aria-hidden="true" />
								</button>
								<button
									type="button"
									class="flex h-7 w-7 items-center justify-center transition-colors {vehicleView ===
									'list'
										? 'bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300'
										: 'text-slate-500 hover:text-slate-800 dark:text-white/35 dark:hover:text-white/60'}"
									on:click={() => (vehicleView = 'list')}
									title="Vista lista"
									aria-pressed={vehicleView === 'list'}
								>
									<Icon icon="mdi:view-list-outline" width={15} aria-hidden="true" />
								</button>
							</div>
							<button
								type="button"
								class="flex h-7 items-center gap-1 rounded-lg border border-blue-500/25 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-40 dark:bg-blue-600/12 dark:text-blue-300 dark:hover:bg-blue-600/20"
								on:click={refreshPositions}
								disabled={$loadingPositions}
							>
								<Icon
									icon="mdi:refresh"
									width={13}
									class={$loadingPositions ? 'animate-spin' : ''}
									aria-hidden="true"
								/>
								{$loadingPositions ? 'Actualizando…' : 'Actualizar'}
							</button>
						</div>
					</div>
					<div class="flex gap-2">
						<div class="relative flex-1">
							<Icon
								icon="mdi:magnify"
								width={13}
								class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/28"
								aria-hidden="true"
							/>
							<input
								type="search"
								placeholder="Buscar unidad, conductor…"
								class="h-7 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 text-[11px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white dark:placeholder:text-white/22"
								bind:value={filterSearch}
							/>
						</div>
						<select
							bind:value={filterStatus}
							class="h-7 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-900 outline-none focus:border-blue-500/50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white"
						>
							<option value="all">Todos</option>
							<option value="active">Activos</option>
							<option value="maintenance">Mantenimiento</option>
							<option value="inactive">Inactivos</option>
						</select>
					</div>
					<div class="flex items-center gap-2 flex-wrap">
						<span
							class="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
						>
							<span class="h-1 w-1 rounded-full bg-emerald-500"></span>{$activeVehicles.length} activos
						</span>
						<span
							class="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
						>
							<span class="h-1 w-1 rounded-full bg-amber-500"></span>{$vehicles.filter(
								(v) => v.status === 'maintenance'
							).length} mantenimiento
						</span>
						<span
							class="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-300"
						>
							<span class="h-1 w-1 rounded-full bg-red-500"></span>{$vehicles.filter(
								(v) => v.status === 'inactive'
							).length} inactivos
						</span>
						<span class="ml-auto text-[10px] text-slate-500 dark:text-white/22"
							>{filteredVehicles.length} resultados</span
						>
					</div>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
					{#if $loadingVehicles}
						<div class="flex items-center justify-center gap-3 py-12 text-slate-500 dark:text-white/38">
							<span
								class="h-5 w-5 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-500"
							></span>
							<span class="text-[12px]">Cargando unidades…</span>
						</div>
					{:else if pagedVehicles.length === 0}
						<div class="flex flex-col items-center gap-2 py-12 text-slate-500 dark:text-white/28">
							<Icon
								icon="mdi:car-search-outline"
								width={32}
								class="opacity-20"
								aria-hidden="true"
							/>
							<span class="text-[12px]">Sin resultados</span>
						</div>
					{:else if vehicleView === 'grid'}
						<ul
							class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5 list-none p-0 m-0"
						>
							{#each pagedVehicles as v}
								<li
									class="flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.05]
								{v.status === 'active'
										? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.03]'
										: v.status === 'maintenance'
											? 'border-amber-300 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.03]'
											: 'border-slate-200 bg-white dark:border-white/[0.07] dark:bg-white/[0.02]'}"
								>
									<div class="flex items-center gap-1.5">
										<span
											class="h-2 w-2 shrink-0 rounded-full {statusColor(v.status)}"
											aria-hidden="true"
										></span>
										<span class="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-900 dark:text-white"
											>{v.name}</span
										>
										<span
											class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {statusPill(
												v.status
											)}">{getStatusText(v.status)}</span
										>
									</div>
									<div class="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-white/40">
										<span class="flex items-center gap-1"
											><Icon icon="mdi:account" width={11} aria-hidden="true" />{v.driver ||
												'Sin conductor'}</span
										>
										<span class="flex items-center gap-1 truncate"
											><Icon icon="mdi:map-marker" width={11} aria-hidden="true" />{v.location ||
												'—'}</span
										>
									</div>
									{#if v.speed !== undefined}
										<div class="flex gap-3 border-t border-slate-100 pt-1.5 dark:border-white/[0.05]">
											<div class="flex items-baseline gap-0.5">
												<span class="text-[14px] font-bold {speedColor(v.speed)}">{v.speed}</span>
												<span class="text-[9px] text-slate-500 dark:text-white/25">km/h</span>
											</div>
											<div class="flex items-baseline gap-0.5">
												<span class="text-[14px] font-bold {battColor(v.battery || 0)}"
													>{v.battery || 0}</span
												>
												<span class="text-[9px] text-slate-500 dark:text-white/25">%bat</span>
											</div>
										</div>
									{/if}
									{#if v.lastUpdateFormatted}<div class="text-[9px] text-slate-500 dark:text-white/22">
											{v.lastUpdateFormatted}
										</div>{/if}
									<div class="mt-1 flex flex-wrap gap-1.5 border-t border-slate-100 pt-1.5 dark:border-white/[0.05]">
										<button
											type="button"
											class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
											on:click={() => fetchVehicleDetail(v.id)}
											disabled={actionLoading}
										>
											<Icon icon="mdi:database-search-outline" width={11} aria-hidden="true" />Obtener
										</button>
										<button
											type="button"
											class="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
											on:click={() => openEditVehicle(v)}
											disabled={actionLoading}
										>
											<Icon icon="mdi:pencil-outline" width={11} aria-hidden="true" />Editar
										</button>
										<button
											type="button"
											class="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-600/12 dark:text-red-300 dark:hover:bg-red-600/20"
											on:click={() => requestDeleteVehicle(v)}
											disabled={actionLoading}
										>
											<Icon icon="mdi:trash-can-outline" width={11} aria-hidden="true" />Eliminar
										</button>
									</div>
									{#if v.latitude && v.longitude}
										<button
											type="button"
											class="flex w-full items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-600/10 dark:text-blue-300 dark:hover:bg-blue-600/18"
											on:click={() => centerOnVehicle(v)}
										>
											<Icon icon="mdi:crosshairs-gps" width={11} aria-hidden="true" />Localizar
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<ul class="flex flex-col gap-1 list-none p-0 m-0">
							{#each pagedVehicles as v}
								<li
									class="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.05]
								{v.status === 'active'
										? 'border-emerald-300 dark:border-emerald-500/18'
										: v.status === 'maintenance'
											? 'border-amber-300 dark:border-amber-500/18'
											: 'border-slate-200 dark:border-white/[0.06]'}"
								>
									<span
										class="h-2 w-2 shrink-0 rounded-full {statusColor(v.status)}"
										aria-hidden="true"
									></span>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-900 dark:text-white"
												>{v.name}</span
											>
											<span
												class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {statusPill(
													v.status
												)}">{getStatusText(v.status)}</span
											>
										</div>
										<div class="mt-0.5 flex gap-2 text-[10px] text-slate-600 dark:text-white/38">
											<span class="flex items-center gap-0.5"
												><Icon icon="mdi:account" width={10} aria-hidden="true" />{v.driver ||
													'—'}</span
											>
											{#if v.speed !== undefined}
												<span class={speedColor(v.speed)}>{v.speed} km/h</span>
												<span class={battColor(v.battery || 0)}>{v.battery || 0}%</span>
											{/if}
										</div>
									</div>
									{#if v.latitude && v.longitude}
										<button
											type="button"
											class="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-600/10 dark:text-blue-300 dark:hover:bg-blue-600/20"
											on:click={() => centerOnVehicle(v)}
										>
											<Icon icon="mdi:crosshairs-gps" width={13} aria-hidden="true" />
										</button>
									{/if}
									<div class="ml-1 flex shrink-0 items-center gap-1">
										<button
											type="button"
											class="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
											on:click={() => fetchVehicleDetail(v.id)}
											title="Obtener detalle"
											disabled={actionLoading}
										>
											<Icon icon="mdi:database-search-outline" width={13} aria-hidden="true" />
										</button>
										<button
											type="button"
											class="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
											on:click={() => openEditVehicle(v)}
											title="Editar"
											disabled={actionLoading}
										>
											<Icon icon="mdi:pencil-outline" width={13} aria-hidden="true" />
										</button>
										<button
											type="button"
											class="flex h-7 w-7 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-600/12 dark:text-red-300 dark:hover:bg-red-600/20"
											on:click={() => requestDeleteVehicle(v)}
											title="Eliminar"
											disabled={actionLoading}
										>
											<Icon icon="mdi:trash-can-outline" width={13} aria-hidden="true" />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if editVehicleId}
					<div
						class="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.06] dark:bg-[#080d1a]"
					>
						<div class="mb-2 flex items-center gap-2">
							<Icon icon="mdi:pencil-outline" width={13} class="text-emerald-600 dark:text-emerald-300" />
							<span class="text-[12px] font-semibold text-slate-900 dark:text-white">Editar unidad</span>
						</div>
						<div class="grid gap-2 sm:grid-cols-2">
							<input
								type="text"
								class="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-900 outline-none focus:border-emerald-500/50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white"
								placeholder="Nombre"
								bind:value={editVehicleName}
							/>
							<input
								type="text"
								class="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-900 outline-none focus:border-emerald-500/50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white"
								placeholder="Descripción"
								bind:value={editVehicleDescription}
							/>
						</div>
						<div class="mt-2 flex justify-end gap-2">
							<button
								type="button"
								class="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
								on:click={cancelEditVehicle}
								disabled={actionLoading}
							>
								Cancelar
							</button>
							<button
								type="button"
								class="h-8 rounded-lg border border-emerald-500/25 bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
								on:click={saveVehicleEdit}
								disabled={actionLoading}
							>
								Guardar
							</button>
						</div>
					</div>
				{/if}
				{#if totalPages > 1}
					<div
						class="flex shrink-0 items-center justify-between border-t border-slate-200 px-4 py-2.5 dark:border-white/[0.06]"
					>
						<button
							type="button"
							class="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.08]"
							on:click={() => (vehiclePage = Math.max(1, vehiclePage - 1))}
							disabled={vehiclePage === 1}
						>
							<Icon icon="mdi:chevron-left" width={13} aria-hidden="true" />Anterior
						</button>
						<span class="text-[11px] text-slate-500 dark:text-white/35"
							>Pág. <strong class="text-slate-800 dark:text-white/65">{vehiclePage}</strong> /
							<strong class="text-slate-800 dark:text-white/65">{totalPages}</strong></span
						>
						<button
							type="button"
							class="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.08]"
							on:click={() => (vehiclePage = Math.min(totalPages, vehiclePage + 1))}
							disabled={vehiclePage === totalPages}
						>
							Siguiente<Icon icon="mdi:chevron-right" width={13} aria-hidden="true" />
						</button>
					</div>
				{/if}
			</div>
			{#if vehicleDetailOpen && vehicleDetail}
				<div
					class="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-700 dark:border-white/[0.06] dark:bg-[#080d1a] dark:text-white/60"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="font-semibold">Detalle unidad</span>
						<button
							type="button"
							class="rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200 dark:text-white/40 dark:hover:bg-white/[0.08]"
							on:click={() => (vehicleDetailOpen = false)}
						>
							Cerrar
						</button>
					</div>
					<p class="m-0 mt-1 truncate"><strong>ID:</strong> {vehicleDetail.id}</p>
					<p class="m-0 truncate"><strong>Nombre:</strong> {vehicleDetail.name}</p>
					<p class="m-0 truncate"><strong>Descripción:</strong> {vehicleDetail.description || '—'}</p>
					<p class="m-0 truncate"><strong>Dispositivo:</strong> {vehicleDetail.deviceId || 'Sin asignar'}</p>
				</div>
			{/if}
			{#if vehicleToDelete}
				<div
					class="border-t border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/25 dark:bg-red-600/10"
				>
					<p class="m-0 text-[11px] text-red-800 dark:text-red-300">
						¿Eliminar unidad <strong>{vehicleToDelete.name}</strong>? (soft delete en API)
					</p>
					<div class="mt-2 flex justify-end gap-2">
						<button
							type="button"
							class="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
							on:click={cancelDeleteVehicle}
							disabled={actionLoading}
						>
							Cancelar
						</button>
						<button
							type="button"
							class="h-8 rounded-lg border border-red-500/25 bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
							on:click={confirmDeleteVehicle}
							disabled={actionLoading}
						>
							Eliminar
						</button>
					</div>
				</div>
			{/if}

		<!-- ═══ ZONAS ═══ -->
		{:else if displaySection === 'zonas'}
			<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
				<ZonasPanel
					variant="desktop"
					bind:subView={drawerZoneSubView}
					on:navigate={(e) => dispatch('navigate', e.detail)}
					on:requestCloseDrawer={() => dispatch('close')}
				/>
			</div>

		{:else if displaySection === 'alertas'}
			<div class="px-4 py-4">
				<div class="mb-1 flex items-center gap-2">
					<Icon
						icon="mdi:bell-outline"
						width={14}
						class="text-slate-500 dark:text-white/35"
						aria-hidden="true"
					/>
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">
						Historial de alarmas
					</h3>
					{#if $unreadAlarmCount > 0}
						<span
							class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-600/18 dark:text-blue-300"
							>{$unreadAlarmCount} nuevas</span
						>
					{/if}
				</div>
				{#if $alarmEvents.length === 0}
					<div
						class="flex flex-col items-center gap-2 py-12 text-center text-[12px] text-slate-500 dark:text-white/25"
					>
						<Icon icon="mdi:bell-off-outline" width={32} class="opacity-20" aria-hidden="true" />Sin
						alarmas recientes
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2 p-0">
						{#each $alarmEvents as ev}
							<li
								class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 {!ev.read
									? 'border-blue-300/70 bg-blue-50 dark:border-blue-500/18 dark:bg-blue-600/[0.07]'
									: 'border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.03]'}"
							>
								<span
									class="h-1.5 w-1.5 shrink-0 rounded-full {!ev.read
										? 'bg-blue-500 shadow-[0_0_6px_rgba(96,165,250,.7)] dark:bg-blue-400 dark:shadow-[0_0_6px_rgba(96,165,250,.7)]'
										: 'bg-slate-300 dark:bg-white/18'}"
									aria-hidden="true"
								></span>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[12px] font-semibold text-slate-900 dark:text-white">
										{ev.name || 'Alerta'}
									</p>
									<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/33">
										{ev.vehicle || 'Unidad'} · <time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
									</p>
								</div>
								<span
									class="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-600/15 dark:text-blue-300"
									>{alarmTypeLabel(ev.type)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

		{:else if displaySection === 'gestionar_alertas'}
			<div class="px-4 py-4">
				<div class="mb-4 flex items-center gap-2">
					<Icon
						icon="mdi:format-list-bulleted"
						width={14}
						class="text-slate-500 dark:text-white/35"
						aria-hidden="true"
					/>
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">Gestionar alertas</h3>
					<button
						type="button"
						class="ml-auto flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-500/28 dark:bg-blue-600/15 dark:text-blue-300 dark:hover:bg-blue-600/25"
						on:click={() => alertActions.openWizard()}
					>
						<Icon icon="mdi:plus-circle-outline" width={13} aria-hidden="true" />Nueva alerta
					</button>
				</div>
				{#if $alerts.length === 0}
					<div class="flex flex-col items-center gap-3 py-10">
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-600/10"
						>
							<Icon
								icon="mdi:bell-plus-outline"
								width={28}
								class="text-blue-600/80 dark:text-blue-300/70"
								aria-hidden="true"
							/>
						</div>
						<div class="text-center">
							<p class="m-0 text-[13px] font-semibold text-slate-800 dark:text-white/70">Sin alertas configuradas</p>
							<p class="m-0 mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-600 dark:text-white/35">
								Crea alertas de ignición o zona para recibir notificaciones en tiempo real.
							</p>
						</div>
						<button
							type="button"
							class="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[12px] font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-600/15 dark:text-blue-300 dark:hover:bg-blue-600/25"
							on:click={() => alertActions.openWizard()}
						>
							<Icon icon="mdi:plus" width={14} aria-hidden="true" />Crear primera alerta
						</button>
					</div>
				{:else}
					<ul class="flex flex-col gap-2 list-none p-0 m-0">
						{#each $alerts as alert}
							<li
								class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
								{alert.type === 'ignition'
									? 'bg-blue-100 text-blue-800 dark:bg-blue-600/15 dark:text-blue-300'
									: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'}"
								>
									<Icon
										icon={alert.type === 'ignition'
											? 'mdi:lightning-bolt'
											: 'mdi:map-marker-radius'}
										width={15}
										aria-hidden="true"
									/>
								</div>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">{alert.name}</p>
									<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/38">
										{alertCondLabel(alert.condition)} · {alert.units.length} unidad{alert.units
											.length !== 1
											? 'es'
											: ''}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<button
										type="button"
										class="relative h-5 w-9 shrink-0 rounded-full border-0 transition-colors duration-200 {alert.enabled
											? 'bg-blue-500'
											: 'bg-slate-300 dark:bg-white/[0.12]'}"
										on:click={() =>
											alertActions.toggleAlert(alert.id).catch((err) => {
												console.error('No se pudo cambiar estado de alerta:', err);
											})}
										role="switch"
										aria-checked={alert.enabled}
										aria-label={alert.enabled ? 'Desactivar' : 'Activar'}
									>
										<span
											class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 {alert.enabled
												? 'translate-x-4'
												: ''}"
										></span>
									</button>
									<button
										type="button"
										class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
										on:click={() =>
											alertActions.deleteAlert(alert.id).catch((err) => {
												console.error('No se pudo eliminar alerta:', err);
											})}
									>
										<Icon icon="mdi:trash-can-outline" width={13} aria-hidden="true" />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
</div>
