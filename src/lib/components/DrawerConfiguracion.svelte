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
		geofences,
		activeGeofenceType,
		pendingGeofenceColor,
		isDrawingGeofence,
		geofenceCount,
		geofenceActions
	} from '$lib/stores/geofenceStore.js';
	import { geofenceService } from '$lib/services/geofenceService.js';
	import {
		showH3Grid,
		h3Resolution,
		selectedH3Cells,
		selectedH3Count,
		renderedH3Cells,
		h3Actions
	} from '$lib/stores/h3Store.js';
	import {
		alerts,
		alertWizard,
		alarmEvents,
		zones,
		alertActions,
		unreadAlarmCount
	} from '$lib/stores/alertStore.js';
	import CrearAlertaWizard from './CrearAlertaWizard.svelte';
	import { mapService } from '$lib/services/mapService.js';
	import { buildMapScene, applyMapScene } from '$lib/services/sceneShareService.js';
	import { getStatusText } from '$lib/utils/vehicleUtils.js';
	import { withGeofenceDbRow } from '$lib/utils/geofenceDbMapper.js';
	import { onMount } from 'svelte';

	let activeSection = 'apariencia';
	let toolHint = '';
	let toolHintOk = true;
	let importInput;
	let showZoneNameModal = false;
	let zoneName = '';

	// ── Unidades: vista, paginación, filtros ──────────────────
	let vehicleView = 'grid';
	let vehiclePage = 1;
	const PAGE_SIZE = 10;
	let filterStatus = 'all';
	let filterSearch = '';

	$: filteredVehicles = $vehicles.filter((v) => {
		const matchStatus = filterStatus === 'all' || v.status === filterStatus;
		const q = filterSearch.toLowerCase();
		const matchSearch =
			!q ||
			v.name?.toLowerCase().includes(q) ||
			v.driver?.toLowerCase().includes(q) ||
			v.location?.toLowerCase().includes(q);
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

	// ── Geocercas: edición inline ──────────────────────────────
	// Estado de edición inline por geocerca
	let editingGfId = null;
	let editGfName = '';
	let editGfColor = '#10B981';
	let editGfDbType = 'inside'; // inside | outside
	let editGfStatus = 'active'; // active | inactive

	function openGfEdit(gf) {
		editingGfId = gf.id;
		editGfName = gf.name || typeLabel(gf.type);
		editGfColor = gf.color || '#10B981';
		editGfDbType = gf.metadata?.alertType === 'outside' ? 'outside' : 'inside';
		editGfStatus = gf.metadata?.status === 'inactive' ? 'inactive' : 'active';
	}
	function saveGfEdit(gf) {
		const trimmed = editGfName.trim();
		geofenceActions.updateGeofence(gf.id, {
			name: trimmed || typeLabel(gf.type),
			color: editGfColor,
			alertType: editGfDbType,
			dbStatus: editGfStatus
		});
		geofenceService.applyGeofenceColor(gf.id, editGfColor, gf.type);
		editingGfId = null;
	}
	function cancelGfEdit() {
		editingGfId = null;
	}

	// ── Sidebar sections ──────────────────────────────────────
	const sections = [
		{ id: 'apariencia', label: 'Apariencia', icon: 'mdi:theme-light-dark' },
		{ id: 'unidades', label: 'Unidades', icon: 'mdi:car-side' },
		{ id: 'geocercas', label: 'Geocercas', icon: 'mdi:map-marker-radius' },
		{ id: 'zonas', label: 'Zonas', icon: 'mdi:hexagon-multiple-outline' },
		{ id: 'alertas', label: 'Alertas', icon: 'mdi:bell-outline' },
		{ id: 'gestionar_alertas', label: 'Gestionar', icon: 'mdi:format-list-bulleted' }
	];

	onMount(async () => {
		if ($vehicles.length === 0) await vehicleActions.loadVehicles();
	});

	// ── helpers ───────────────────────────────────────────────
	function removeGeofence(id) {
		geofenceService.removeById(id);
		geofenceActions.removeGeofence(id);
	}
	function downloadGeofences() {
		const blob = new Blob([JSON.stringify($geofences, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `geocercas-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
	function triggerImport() {
		importInput?.click();
	}
	function isValidGeofenceImport(item) {
		return !!(
			item &&
			typeof item.id === 'string' &&
			typeof item.type === 'string' &&
			item.geometry &&
			typeof item.geometry === 'object'
		);
	}
	function onImportFile(e) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(String(reader.result));
				if (data?.type === 'nexus-map-scene') {
					applyMapScene(data);
					showHint('Escena aplicada');
					return;
				}
				if (!Array.isArray(data)) throw new Error();
				const cleaned = data.filter(isValidGeofenceImport).map(withGeofenceDbRow);
				geofenceService.cancelPending();
				geofenceActions.closeDraft();
				geofenceService.clearAll();
				geofenceActions.setGeofences(cleaned);
				geofenceService.restoreOverlays(cleaned);
				showHint('Geocercas importadas');
			} catch {
				showHint('Archivo JSON inválido o formato incorrecto.', false);
			}
		};
		reader.readAsText(file);
	}
	const alarmTypeLabel = (t) => ({ ignition: 'Ignición', zone: 'Zona' })[t] ?? t;
	const alertCondLabel = (c) =>
		({ on: 'Encendido', off: 'Apagado', enter: 'Entrada', exit: 'Salida' })[c] ?? c;
	const typeLabel = (t) =>
		({
			corridor: 'Corredor',
			polyline: 'Ruta',
			marker: 'Sitio',
			polygon: 'Polígono',
			circle: 'Círculo',
			rectangle: 'Rectángulo'
		})[t] ?? t;

	function zoneModalKeydown(e) {
		if (showZoneNameModal && e.key === 'Escape') showZoneNameModal = false;
	}
	async function copyScene() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(buildMapScene(), null, 2));
			showHint('Escena copiada');
		} catch {
			showHint('No se pudo copiar', false);
		}
	}
	async function pasteScene() {
		try {
			applyMapScene(JSON.parse(await navigator.clipboard.readText()));
			showHint('Escena aplicada');
		} catch {
			showHint('JSON de escena inválido', false);
		}
	}
	function showHint(msg, ok = true) {
		toolHint = msg;
		toolHintOk = ok;
		setTimeout(() => (toolHint = ''), 3500);
	}
	async function refreshPositions() {
		await vehicleActions.loadVehiclePositions();
	}
	function centerOnVehicle(v) {
		if ((v.latitude || v.lat) && (v.longitude || v.lng)) mapService.centerOnVehicle(v);
	}
	function startZoneSelection() {
		h3Actions.setGridVisibility(true);
		showHint('Selecciona celdas en el mapa principal');
	}
	function openCreateZone() {
		if ($selectedH3Count === 0) {
			h3Actions.setGridVisibility(true);
			showHint('Primero selecciona celdas en el mapa principal', false);
			return;
		}
		showZoneNameModal = true;
	}
	function saveZone() {
		if ($selectedH3Cells.length === 0) {
			showZoneNameModal = false;
			showHint('No hay celdas seleccionadas', false);
			return;
		}
		alertActions.createZone(zoneName.trim() || `Zona ${$zones.length + 1}`, $selectedH3Cells);
		h3Actions.clearSelection();
		zoneName = '';
		showZoneNameModal = false;
		showHint('Zona creada');
	}
	function formatAlarmDate(iso) {
		try {
			return new Date(iso).toLocaleString('es-MX', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}
	function sectionBadge(id) {
		if (id === 'unidades') return $vehicles.length;
		if (id === 'geocercas') return $geofenceCount;
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
			? 'bg-emerald-500/15 text-emerald-300'
			: s === 'maintenance'
				? 'bg-amber-500/15 text-amber-300'
				: 'bg-red-500/12 text-red-300';
	const speedColor = (n) =>
		n > 60 ? 'text-red-300' : n > 40 ? 'text-amber-200' : 'text-emerald-300';
	const battColor = (n) =>
		n < 25 ? 'text-red-300' : n < 50 ? 'text-amber-200' : 'text-emerald-300';

	// helper: label legible del tipo DB
	const dbTypeLabel = (t) => (t === 'outside' ? 'Alerta al salir' : 'Alerta al entrar');
	const dbStatusLabel = (s) => (s === 'inactive' ? 'Inactiva' : 'Activa');
</script>

<svelte:window on:keydown={zoneModalKeydown} />

<input
	bind:this={importInput}
	id="cfg-import-json"
	type="file"
	accept="application/json,.json"
	class="sr-only"
	tabindex="-1"
	aria-hidden="true"
	on:change={onImportFile}
/>

{#if $alertWizard}
	<CrearAlertaWizard on:close={() => alertActions.closeWizard()} />
{/if}

<div
	class="flex h-full min-h-0 overflow-hidden bg-[#080d1a] text-white/90 text-[13px]"
	role="region"
	aria-label="Preferencias y herramientas del mapa"
>
	<!-- SIDEBAR -->
	<div
		class="flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-white/[0.07] bg-[#060a15] py-3"
		role="tablist"
	>
		{#each sections as sec}
			{@const badge = sectionBadge(sec.id)}
			<button
				type="button"
				class="relative flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-all duration-150
					{activeSection === sec.id
					? 'bg-blue-600/15 text-blue-300'
					: 'text-white/38 hover:bg-white/[0.06] hover:text-white/65'}"
				role="tab"
				aria-selected={activeSection === sec.id}
				tabindex={activeSection === sec.id ? 0 : -1}
				on:click={() => (activeSection = sec.id)}
				title={sec.label}
			>
				<span class="relative">
					<Icon icon={sec.icon} width={20} height={20} aria-hidden="true" />
					{#if badge > 0}
						<span
							class="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#060a15]"
						>
							{badge > 99 ? '99+' : badge}
						</span>
					{/if}
				</span>
				<span class="text-[10px] font-medium leading-none">{sec.label}</span>
			</button>
		{/each}
	</div>

	<!-- PANEL -->
	<div class="min-w-0 flex-1 overflow-y-auto overscroll-contain">
		<!-- ═══ APARIENCIA ═══ -->
		{#if activeSection === 'apariencia'}
			<div class="px-4 py-4">
				<div class="mb-3 flex items-center gap-2">
					<Icon icon="mdi:theme-light-dark" width={14} class="text-white/35" aria-hidden="true" />
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-white">Apariencia</h3>
				</div>
				<div class="flex gap-2.5">
					<!-- Dark -->
					<button
						type="button"
						class="group flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all
						{$theme === 'dark'
							? 'border-blue-500/50 bg-blue-600/10'
							: 'border-white/[0.08] hover:border-white/[0.14]'}"
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
									? 'text-white'
									: 'text-white/55'}"
							>
								<Icon
									icon="mdi:weather-night"
									width={13}
									class="text-indigo-300"
									aria-hidden="true"
								/>Oscuro
							</span>
							<span class="block text-[10px] text-white/28">Mapa nocturno</span>
						</div>
					</button>
					<!-- Light -->
					<button
						type="button"
						class="group flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all
						{$theme === 'light'
							? 'border-sky-500/50 bg-sky-500/10'
							: 'border-white/[0.08] hover:border-white/[0.14]'}"
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
									? 'text-white'
									: 'text-white/55'}"
							>
								<Icon
									icon="mdi:white-balance-sunny"
									width={13}
									class="text-amber-300"
									aria-hidden="true"
								/>Claro
							</span>
							<span class="block text-[10px] text-white/28">Contraste diurno</span>
						</div>
					</button>
				</div>
			</div>

			<!-- ═══ UNIDADES ═══ -->
		{:else if activeSection === 'unidades'}
			<div class="flex h-full min-h-0 flex-col">
				<div class="shrink-0 border-b border-white/[0.06] bg-[#080d1a] px-4 py-3 space-y-2.5">
					<div class="flex items-center gap-2">
						<Icon
							icon="mdi:car-side"
							width={14}
							class="text-white/35 shrink-0"
							aria-hidden="true"
						/>
						<span class="text-[14px] font-bold text-white">Unidades</span>
						<div class="flex items-center gap-1 ml-auto">
							<div class="flex rounded-lg border border-white/[0.08] overflow-hidden">
								<button
									type="button"
									class="flex h-7 w-7 items-center justify-center transition-colors {vehicleView ===
									'grid'
										? 'bg-blue-600/20 text-blue-300'
										: 'text-white/35 hover:text-white/60'}"
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
										? 'bg-blue-600/20 text-blue-300'
										: 'text-white/35 hover:text-white/60'}"
									on:click={() => (vehicleView = 'list')}
									title="Vista lista"
									aria-pressed={vehicleView === 'list'}
								>
									<Icon icon="mdi:view-list-outline" width={15} aria-hidden="true" />
								</button>
							</div>
							<button
								type="button"
								class="flex h-7 items-center gap-1 rounded-lg border border-blue-500/25 bg-blue-600/12 px-2 text-[11px] font-semibold text-blue-300 transition-colors hover:bg-blue-600/20 disabled:opacity-40"
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
								class="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/28"
								aria-hidden="true"
							/>
							<input
								type="search"
								placeholder="Buscar unidad, conductor…"
								class="h-7 w-full rounded-lg border border-white/[0.1] bg-white/[0.05] pl-7 pr-3 text-[11px] text-white outline-none placeholder:text-white/22 focus:border-blue-500/50"
								bind:value={filterSearch}
							/>
						</div>
						<select
							bind:value={filterStatus}
							class="h-7 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2 text-[11px] text-white outline-none focus:border-blue-500/50 cursor-pointer"
						>
							<option value="all">Todos</option>
							<option value="active">Activos</option>
							<option value="maintenance">Mantenimiento</option>
							<option value="inactive">Inactivos</option>
						</select>
					</div>
					<div class="flex items-center gap-2 flex-wrap">
						<span
							class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
						>
							<span class="h-1 w-1 rounded-full bg-emerald-500"></span>{$activeVehicles.length} activos
						</span>
						<span
							class="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
						>
							<span class="h-1 w-1 rounded-full bg-amber-500"></span>{$vehicles.filter(
								(v) => v.status === 'maintenance'
							).length} mantenimiento
						</span>
						<span
							class="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300"
						>
							<span class="h-1 w-1 rounded-full bg-red-500"></span>{$vehicles.filter(
								(v) => v.status === 'inactive'
							).length} inactivos
						</span>
						<span class="ml-auto text-[10px] text-white/22"
							>{filteredVehicles.length} resultados</span
						>
					</div>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
					{#if $loadingVehicles}
						<div class="flex items-center justify-center gap-3 py-12 text-white/38">
							<span
								class="h-5 w-5 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-500"
							></span>
							<span class="text-[12px]">Cargando unidades…</span>
						</div>
					{:else if pagedVehicles.length === 0}
						<div class="flex flex-col items-center gap-2 py-12 text-white/28">
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
									class="flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:bg-white/[0.05]
								{v.status === 'active'
										? 'border-emerald-500/20 bg-emerald-500/[0.03]'
										: v.status === 'maintenance'
											? 'border-amber-500/20 bg-amber-500/[0.03]'
											: 'border-white/[0.07] bg-white/[0.02]'}"
								>
									<div class="flex items-center gap-1.5">
										<span
											class="h-2 w-2 shrink-0 rounded-full {statusColor(v.status)}"
											aria-hidden="true"
										></span>
										<span class="min-w-0 flex-1 truncate text-[12px] font-bold text-white"
											>{v.name}</span
										>
										<span
											class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {statusPill(
												v.status
											)}">{getStatusText(v.status)}</span
										>
									</div>
									<div class="flex flex-col gap-0.5 text-[11px] text-white/40">
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
										<div class="flex gap-3 border-t border-white/[0.05] pt-1.5">
											<div class="flex items-baseline gap-0.5">
												<span class="text-[14px] font-bold {speedColor(v.speed)}">{v.speed}</span>
												<span class="text-[9px] text-white/25">km/h</span>
											</div>
											<div class="flex items-baseline gap-0.5">
												<span class="text-[14px] font-bold {battColor(v.battery || 0)}"
													>{v.battery || 0}</span
												>
												<span class="text-[9px] text-white/25">%bat</span>
											</div>
										</div>
									{/if}
									{#if v.lastUpdateFormatted}<div class="text-[9px] text-white/22">
											{v.lastUpdateFormatted}
										</div>{/if}
									{#if v.latitude && v.longitude}
										<button
											type="button"
											class="flex w-full items-center justify-center gap-1 rounded-lg border border-blue-500/20 bg-blue-600/10 py-1 text-[10px] font-semibold text-blue-300 transition-colors hover:bg-blue-600/18"
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
									class="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors hover:bg-white/[0.05]
								{v.status === 'active'
										? 'border-emerald-500/18'
										: v.status === 'maintenance'
											? 'border-amber-500/18'
											: 'border-white/[0.06]'}"
								>
									<span
										class="h-2 w-2 shrink-0 rounded-full {statusColor(v.status)}"
										aria-hidden="true"
									></span>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-white"
												>{v.name}</span
											>
											<span
												class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {statusPill(
													v.status
												)}">{getStatusText(v.status)}</span
											>
										</div>
										<div class="mt-0.5 flex gap-2 text-[10px] text-white/38">
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
											class="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-600/10 text-blue-300 hover:bg-blue-600/20"
											on:click={() => centerOnVehicle(v)}
										>
											<Icon icon="mdi:crosshairs-gps" width={13} aria-hidden="true" />
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if totalPages > 1}
					<div
						class="shrink-0 border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between"
					>
						<button
							type="button"
							class="flex h-7 items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.08] disabled:opacity-30"
							on:click={() => (vehiclePage = Math.max(1, vehiclePage - 1))}
							disabled={vehiclePage === 1}
						>
							<Icon icon="mdi:chevron-left" width={13} aria-hidden="true" />Anterior
						</button>
						<span class="text-[11px] text-white/35"
							>Pág. <strong class="text-white/65">{vehiclePage}</strong> /
							<strong class="text-white/65">{totalPages}</strong></span
						>
						<button
							type="button"
							class="flex h-7 items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.08] disabled:opacity-30"
							on:click={() => (vehiclePage = Math.min(totalPages, vehiclePage + 1))}
							disabled={vehiclePage === totalPages}
						>
							Siguiente<Icon icon="mdi:chevron-right" width={13} aria-hidden="true" />
						</button>
					</div>
				{/if}
			</div>

			<!-- ═══ GEOCERCAS — solo listado + edición inline ═══ -->
		{:else if activeSection === 'geocercas'}
			<div class="px-4 py-4">
				<!-- Header -->
				<div class="mb-3 flex items-center gap-2">
					<Icon icon="mdi:map-marker-radius" width={14} class="text-white/35" aria-hidden="true" />
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-white">Geocercas</h3>
					<span
						class="ml-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/45"
						>{$geofenceCount}</span
					>
					<!-- botón limpiar todo a la derecha -->
					{#if $geofenceCount > 0}
						<button
							type="button"
							class="ml-auto flex items-center gap-1 rounded-md border border-red-500/18 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/18"
							on:click={() => {
								geofenceService.cancelPending();
								geofenceActions.closeDraft();
								geofenceService.clearAll();
								geofenceActions.clearGeofences();
								geofenceActions.stopDrawing();
							}}
						>
							<Icon icon="mdi:delete-sweep-outline" width={12} aria-hidden="true" />Limpiar todo
						</button>
					{/if}
				</div>

				<!-- Lista de geocercas -->
				{#if $geofences.length === 0}
					<div class="flex flex-col items-center gap-2 py-12 text-[12px] text-white/28">
						<Icon
							icon="mdi:map-marker-off-outline"
							width={32}
							class="opacity-20"
							aria-hidden="true"
						/>
						<span>Sin geocercas guardadas</span>
						<span class="text-[10px] text-white/20"
							>Las geocercas que dibujes en el mapa aparecerán aquí.</span
						>
					</div>
				{:else}
					<ul class="flex flex-col gap-2 list-none p-0 m-0">
						{#each $geofences as gf (gf.id)}
							<li
								class="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] transition-colors
							{editingGfId === gf.id ? 'border-blue-500/30 bg-blue-600/[0.05]' : 'hover:bg-white/[0.05]'}"
							>
								{#if editingGfId === gf.id}
									<!-- ── MODO EDICIÓN ── -->
									<div class="p-3 space-y-3">
										<!-- Nombre -->
										<div>
											<label
												for={'edit-gf-name-' + gf.id}
												class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/30"
												>Nombre</label
											>
											<input
												id={'edit-gf-name-' + gf.id}
												class="w-full rounded-lg border border-white/[0.12] bg-white/[0.07] px-2.5 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-blue-500/55 focus:ring-2 focus:ring-blue-500/12"
												bind:value={editGfName}
												placeholder="Nombre de la geocerca"
												maxlength="255"
												on:keydown={(e) => e.key === 'Enter' && saveGfEdit(gf)}
											/>
										</div>

										<!-- Color -->
										<div>
											<label
												for={'edit-gf-color-' + gf.id}
												class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/30"
												>Color del trazo</label
											>
											<div class="flex items-center gap-2.5">
												<input
													id={'edit-gf-color-' + gf.id}
													type="color"
													class="h-8 w-10 cursor-pointer rounded-lg border border-white/[0.12] bg-transparent p-0.5"
													bind:value={editGfColor}
												/>
												<code class="font-mono text-[11px] text-white/35">{editGfColor}</code>
											</div>
										</div>

										<!-- Tipo alerta (→ geofences.type en DB) -->
										<div>
											<p
												class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/30"
											>
												Tipo de alerta
											</p>
											<div class="grid grid-cols-2 gap-2">
												{#each [{ value: 'inside', label: 'Al entrar', icon: 'mdi:location-enter', desc: 'Alerta cuando el dispositivo entra en la zona' }, { value: 'outside', label: 'Al salir', icon: 'mdi:location-exit', desc: 'Alerta cuando el dispositivo sale de la zona' }] as opt}
													<button
														type="button"
														class="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors
														{editGfDbType === opt.value
															? 'border-blue-500/45 bg-blue-600/12 text-white'
															: 'border-white/[0.08] text-white/45 hover:border-white/[0.15]'}"
														on:click={() => (editGfDbType = opt.value)}
														title={opt.desc}
													>
														<Icon
															icon={opt.icon}
															width={14}
															class={editGfDbType === opt.value ? 'text-blue-300' : ''}
															aria-hidden="true"
														/>
														<span class="text-[11px] font-medium">{opt.label}</span>
													</button>
												{/each}
											</div>
										</div>

										<!-- Estado (→ geofences.status en DB) -->
										<div>
											<p
												class="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/30"
											>
												Estado
											</p>
											<div class="grid grid-cols-2 gap-2">
												{#each [{ value: 'active', label: 'Activa', icon: 'mdi:check-circle-outline', color: 'emerald' }, { value: 'inactive', label: 'Inactiva', icon: 'mdi:close-circle-outline', color: 'slate' }] as opt}
													<button
														type="button"
														class="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors
														{editGfStatus === opt.value
															? opt.color === 'emerald'
																? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
																: 'border-white/[0.18] bg-white/[0.07] text-white/55'
															: 'border-white/[0.08] text-white/40 hover:border-white/[0.15]'}"
														on:click={() => (editGfStatus = opt.value)}
													>
														<Icon icon={opt.icon} width={13} aria-hidden="true" />
														<span class="text-[11px] font-medium">{opt.label}</span>
													</button>
												{/each}
											</div>
										</div>

										<!-- dbRow preview compacto -->
										{#if gf.dbRow}
											<details class="group">
												<summary
													class="cursor-pointer list-none text-[10px] font-semibold text-white/25 hover:text-white/40 select-none"
												>
													<span class="flex items-center gap-1">
														<Icon icon="mdi:database-outline" width={11} aria-hidden="true" />
														Ver proyección
														<Icon
															icon="mdi:chevron-down"
															width={11}
															class="transition-transform group-open:rotate-180"
															aria-hidden="true"
														/>
													</span>
												</summary>
												<pre
													class="mt-1.5 overflow-x-auto rounded-lg bg-black/30 p-2 text-[9px] leading-relaxed text-white/35 font-mono">{JSON.stringify(
														gf.dbRow,
														null,
														2
													)}</pre>
											</details>
										{/if}

										<!-- Botones guardar / cancelar -->
										<div class="flex gap-2 pt-1">
											<button
												type="button"
												class="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] py-2 text-[11px] font-semibold text-white/45 hover:bg-white/[0.08]"
												on:click={cancelGfEdit}>Cancelar</button
											>
											<button
												type="button"
												class="flex flex-[2] items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/18 py-2 text-[11px] font-semibold text-blue-300 hover:bg-blue-600/26"
												on:click={() => saveGfEdit(gf)}
											>
												<Icon
													icon="mdi:content-save-outline"
													width={13}
													aria-hidden="true"
												/>Guardar cambios
											</button>
										</div>
									</div>
								{:else}
									<!-- ── MODO NORMAL ── -->
									<div class="flex items-center gap-2.5 px-3 py-2.5">
										<!-- dot color -->
										<span
											class="h-3 w-3 shrink-0 rounded-sm border border-white/10"
											style="background:{gf.color || '#10B981'}"
											aria-hidden="true"
										></span>
										<!-- info -->
										<div class="min-w-0 flex-1">
											<p class="m-0 truncate text-[12px] font-semibold text-white">
												{gf.name || typeLabel(gf.type)}
											</p>
											<div
												class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-white/32"
											>
												<span>{typeLabel(gf.type)}</span>
												<!-- badge tipo DB -->
												<span
													class="flex items-center gap-0.5 rounded-full px-1.5 py-px
												{gf.metadata?.alertType === 'outside'
														? 'bg-orange-500/12 text-orange-300'
														: 'bg-blue-600/12 text-blue-300'}"
												>
													<Icon
														icon={gf.metadata?.alertType === 'outside'
															? 'mdi:location-exit'
															: 'mdi:location-enter'}
														width={9}
														aria-hidden="true"
													/>
													{dbTypeLabel(gf.metadata?.alertType)}
												</span>
												<!-- badge estado DB -->
												<span
													class="flex items-center gap-0.5 rounded-full px-1.5 py-px
												{gf.metadata?.status === 'inactive'
														? 'bg-white/[0.06] text-white/25'
														: 'bg-emerald-500/10 text-emerald-300'}"
												>
													<span
														class="h-1 w-1 rounded-full {gf.metadata?.status === 'inactive'
															? 'bg-white/20'
															: 'bg-emerald-500'}"
													></span>
													{dbStatusLabel(gf.metadata?.status)}
												</span>
											</div>
										</div>
										<!-- acciones -->
										<div class="flex shrink-0 items-center gap-1">
											<button
												type="button"
												class="flex h-7 items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2 text-[11px] font-semibold text-white/55 hover:bg-white/[0.08] hover:text-white"
												on:click={() => openGfEdit(gf)}
												aria-label="Editar geocerca {gf.name || typeLabel(gf.type)}"
											>
												<Icon icon="mdi:pencil-outline" width={12} aria-hidden="true" />Editar
											</button>
											<button
												type="button"
												class="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/10 text-red-300 hover:bg-red-500/20"
												on:click={() => removeGeofence(gf.id)}
												aria-label="Eliminar geocerca {gf.name || typeLabel(gf.type)}"
											>
												<Icon icon="mdi:close" width={13} aria-hidden="true" />
											</button>
										</div>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Acciones de import/export -->
				<div class="mt-4 grid grid-cols-2 gap-1.5">
					<button
						type="button"
						class="flex items-center justify-center gap-1 rounded-lg border border-indigo-500/20 bg-indigo-500/10 py-2 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/18 disabled:opacity-40"
						on:click={downloadGeofences}
						disabled={$geofenceCount === 0}
					>
						<Icon icon="mdi:download-outline" width={13} aria-hidden="true" />Exportar JSON
					</button>
					<button
						type="button"
						class="flex items-center justify-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 py-2 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/18"
						on:click={triggerImport}
					>
						<Icon icon="mdi:upload-outline" width={13} aria-hidden="true" />Importar JSON
					</button>
					<button
						type="button"
						class="flex items-center justify-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/10 py-2 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/18"
						on:click={copyScene}
					>
						<Icon icon="mdi:content-copy" width={13} aria-hidden="true" />Copiar escena
					</button>
					<button
						type="button"
						class="flex items-center justify-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/10 py-2 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/18"
						on:click={pasteScene}
					>
						<Icon icon="mdi:content-paste" width={13} aria-hidden="true" />Pegar escena
					</button>
				</div>
				{#if toolHint}
					<p
						class="mt-2 flex items-center gap-1 text-[10px] font-medium {toolHintOk
							? 'text-emerald-300'
							: 'text-red-300'}"
						role="status"
						aria-live="polite"
					>
						<Icon
							icon={toolHintOk ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'}
							width={12}
							aria-hidden="true"
						/>
						{toolHint}
					</p>
				{/if}
			</div>

			<!-- ═══ ZONAS ═══ -->
		{:else if activeSection === 'zonas'}
			<div class="px-4 py-4">
				<div class="mb-1 flex items-center gap-2">
					<Icon
						icon="mdi:hexagon-multiple-outline"
						width={14}
						class="text-white/35"
						aria-hidden="true"
					/>
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-white">Rutas H3</h3>
				</div>
				<p class="mt-1 text-[11px] text-white/40">
					Listado de celdas seleccionadas en la rejilla. Puedes quitar cada celda de forma
					individual.
				</p>
				<div class="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
					<div class="mb-2 flex items-center justify-between gap-2">
						<p class="m-0 text-[10px] font-bold uppercase tracking-widest text-white/30">
							Celdas seleccionadas ({$selectedH3Count})
						</p>
					</div>
					{#if $selectedH3Cells.length === 0}
						<div class="flex flex-col items-center gap-1.5 py-6 text-[11px] text-white/25">
							<Icon icon="mdi:hexagon-outline" width={24} class="opacity-20" aria-hidden="true" />
							Sin celdas seleccionadas
						</div>
					{:else}
						<ul class="m-0 flex max-h-[300px] list-none flex-col gap-1 overflow-y-auto p-0">
							{#each $selectedH3Cells as cellId (cellId)}
								<li
									class="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
								>
									<span
										class="min-w-0 flex-1 truncate font-mono text-[11px] text-white"
										title={cellId}
									>
										{cellId}
									</span>
									<button
										type="button"
										class="flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
										on:click={() => h3Actions.toggleCell(cellId)}
										aria-label="Quitar celda {cellId} de la selección"
										title="Quitar de la selección"
									>
										<Icon icon="mdi:close" width={11} aria-hidden="true" />
										Quitar
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- ═══ ALERTAS ═══ -->
		{:else if activeSection === 'alertas'}
			<div class="px-4 py-4">
				<div class="mb-1 flex items-center gap-2">
					<Icon icon="mdi:bell-outline" width={14} class="text-white/35" aria-hidden="true" />
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-white">Historial de alarmas</h3>
					{#if $unreadAlarmCount > 0}
						<span
							class="rounded-full bg-blue-600/18 px-2 py-0.5 text-[10px] font-bold text-blue-300"
							>{$unreadAlarmCount} nuevas</span
						>
					{/if}
				</div>
				{#if $alarmEvents.length === 0}
					<div class="flex flex-col items-center gap-2 py-12 text-[12px] text-white/25">
						<Icon icon="mdi:bell-off-outline" width={32} class="opacity-20" aria-hidden="true" />Sin
						alarmas recientes
					</div>
				{:else}
					<ul class="flex flex-col gap-2 list-none p-0 m-0">
						{#each $alarmEvents as ev}
							<li
								class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5
							{!ev.read ? 'border-blue-500/18 bg-blue-600/[0.07]' : 'border-white/[0.06] bg-white/[0.03]'}"
							>
								<span
									class="h-1.5 w-1.5 shrink-0 rounded-full {!ev.read
										? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,.7)]'
										: 'bg-white/18'}"
									aria-hidden="true"
								></span>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[12px] font-semibold text-white">{ev.name || 'Alerta'}</p>
									<p class="m-0 mt-0.5 text-[10px] text-white/33">
										{ev.vehicle || 'Unidad'} · {formatAlarmDate(ev.at)}
									</p>
								</div>
								<span
									class="shrink-0 rounded-full bg-blue-600/15 px-2 py-0.5 text-[10px] font-bold text-blue-300"
									>{alarmTypeLabel(ev.type)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- ═══ GESTIONAR ALERTAS ═══ -->
		{:else if activeSection === 'gestionar_alertas'}
			<div class="px-4 py-4">
				<div class="mb-4 flex items-center gap-2">
					<Icon
						icon="mdi:format-list-bulleted"
						width={14}
						class="text-white/35"
						aria-hidden="true"
					/>
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-white">Gestionar alertas</h3>
					<button
						type="button"
						class="ml-auto flex items-center gap-1.5 rounded-lg border border-blue-500/28 bg-blue-600/15 px-3 py-1.5 text-[11px] font-semibold text-blue-300 hover:bg-blue-600/25"
						on:click={() => alertActions.openWizard()}
					>
						<Icon icon="mdi:plus-circle-outline" width={13} aria-hidden="true" />Nueva alerta
					</button>
				</div>
				{#if $alerts.length === 0}
					<div class="flex flex-col items-center gap-3 py-10">
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-600/10"
						>
							<Icon
								icon="mdi:bell-plus-outline"
								width={28}
								class="text-blue-300/70"
								aria-hidden="true"
							/>
						</div>
						<div class="text-center">
							<p class="m-0 text-[13px] font-semibold text-white/70">Sin alertas configuradas</p>
							<p class="m-0 mt-1 max-w-[220px] text-[11px] leading-relaxed text-white/35">
								Crea alertas de ignición o zona para recibir notificaciones en tiempo real.
							</p>
						</div>
						<button
							type="button"
							class="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/15 px-4 py-2 text-[12px] font-semibold text-blue-300 hover:bg-blue-600/25"
							on:click={() => alertActions.openWizard()}
						>
							<Icon icon="mdi:plus" width={14} aria-hidden="true" />Crear primera alerta
						</button>
					</div>
				{:else}
					<ul class="flex flex-col gap-2 list-none p-0 m-0">
						{#each $alerts as alert}
							<li
								class="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
								{alert.type === 'ignition' ? 'bg-blue-600/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}"
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
									<p class="m-0 text-[13px] font-semibold text-white leading-snug">{alert.name}</p>
									<p class="m-0 mt-0.5 text-[10px] text-white/38">
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
											: 'bg-white/[0.12]'}"
										on:click={() => alertActions.toggleAlert(alert.id)}
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
										class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20"
										on:click={() => alertActions.deleteAlert(alert.id)}
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

<!-- ZONE NAME MODAL -->
{#if showZoneNameModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default border-0 bg-black/55 backdrop-blur-sm"
			aria-label="Cerrar modal de zona H3"
			on:click={() => (showZoneNameModal = false)}
		>
			<span class="sr-only">Cerrar modal de zona H3</span>
		</button>
		<div
			class="relative z-10 w-full max-w-[400px] rounded-2xl border border-white/[0.09] bg-[#0d1629] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="zone-modal-title"
			tabindex="-1"
		>
			<div class="mb-1 flex items-center gap-2 text-white/40">
				<Icon icon="mdi:hexagon-outline" width={15} aria-hidden="true" />
				<h3 id="zone-modal-title" class="m-0 text-[14px] font-bold text-white">Nombrar zona H3</h3>
			</div>
			<p class="mb-4 text-[11px] text-white/35">{$selectedH3Count} celdas seleccionadas</p>
			<form on:submit|preventDefault={saveZone} class="space-y-3">
				<input
					class="w-full rounded-lg border border-white/[0.13] bg-white/[0.06] px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/22 focus:border-blue-500/55"
					bind:value={zoneName}
					placeholder="Ej: Centro histórico"
					autocomplete="off"
				/>
				<div class="flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/45 hover:bg-white/[0.08]"
						on:click={() => (showZoneNameModal = false)}>Cancelar</button
					>
					<button
						type="submit"
						class="flex items-center gap-1.5 rounded-lg border border-blue-500/28 bg-blue-600/18 px-3 py-2 text-[11px] font-semibold text-blue-300 hover:bg-blue-600/26"
					>
						<Icon icon="mdi:content-save-outline" width={12} aria-hidden="true" />Guardar zona
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
