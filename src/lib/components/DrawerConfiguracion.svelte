<script>
	import { logger } from '$lib/utils/logger.js';
	import Icon from '@iconify/svelte';
	import { theme, themeActions } from '$lib/stores/themeStore.js';
	import SignalMeters from './SignalMeters.svelte';
	import UnitTelemetryBadges from './UnitTelemetryBadges.svelte';
	import {
		vehicles,
		loadingVehicles,
		loadingPositions,
		activeVehicles,
		mapVisibleUnitIds,
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
	import EditAlertWizard from './EditAlertWizard.svelte';
	import ConfirmModal from './ConfirmModal.svelte';
	import ZonasPanel from './ZonasPanel.svelte';
	import AdminPanel from './AdminPanel.svelte';
	import UnitProfileDetails from './Unit/UnitProfileDetails.svelte';
	import UnitEditPanel from './Unit/UnitEditPanel.svelte';
	import ColoredVehicleIcon from './Unit/ColoredVehicleIcon.svelte';
	import { mapService } from '$lib/services/mapService.js';
	import { getStatusText, colorSlugToHex } from '$lib/utils/vehicleUtils.js';
	import { isUnitMoving } from '$lib/utils/unitTrackingStatus.js';
	import { unitIcons } from '$lib/data/unitIcons';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import { user } from '$lib/stores/auth.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';

	const dispatch = createEventDispatcher();

	export let initialSection = 'apariencia';
	export let showSectionSidebar = true;

	$: isMaster = !!$user?.is_master;
	$: hasVehicles = $vehicles.length > 0;

	let activeSection = initialSection;
	$: displaySection = showSectionSidebar ? activeSection : initialSection;
	let toolHint = '';
	let toolHintOk = true;
	let drawerZoneSubView = 'zonas';

	// ── Unidades ──────────────────────────────────────────────
	let vehicleView = 'grid';
	let vehiclePage = 1;
	let pageSize = 10;
	const PAGE_SIZE_OPTIONS = [10, 25, 50];
	let filterStatus = 'all';
	let filterSearch = '';
	let showAdvancedFilters = false;
	/** @type {'all' | 'on' | 'off'} */
	let filterIgnition = 'all';
	/** @type {'all' | 'moving' | 'stopped'} */
	let filterMotion = 'all';
	/** @type {'all' | 'with' | 'without'} */
	let filterGps = 'all';
	/** @type {'name' | 'speed' | 'updated'} */
	let sortBy = 'name';
	let actionLoading = false;
	let vehicleToDelete = null;
	/** @type {Record<string, unknown> | null} */
	let editingVehicle = null;
	/** @type {Record<string, unknown> | null} */
	let vehicleDetail = null;
	let vehicleDetailOpen = false;

	// ── Alertas: delete ───────────────────────────────────────
	/** @type {{ id: string, name: string } | null} */
	let alertToDelete = null;

	// ── Alertas: toggle ───────────────────────────────────────
	let alertTogglingId = null;

	async function handleAlertToggle(alert) {
		if (!isMaster || alertTogglingId) return;
		alertTogglingId = alert.id;
		try {
			await alertActions.toggleAlertEnabled(alert.id);
		} catch {
			// rollback handled in store
		} finally {
			alertTogglingId = null;
		}
	}

	// ── Alertas: edit (wizard completo) ───────────────────────
	let alertEditTarget = null;

	function openAlertEdit(alert) {
		if (!isMaster) return;
		alertEditTarget = alert;
	}
	function closeAlertEdit() {
		alertEditTarget = null;
		showHint('Alerta actualizada', true);
	}

	// ── Filtros unidades ──────────────────────────────────────
	$: inactiveCount = $vehicles.filter((v) => v.status === 'inactive').length;
	$: maintenanceCount = $vehicles.filter((v) => v.status === 'maintenance').length;
	$: advancedFilterCount =
		(filterIgnition !== 'all' ? 1 : 0) +
		(filterMotion !== 'all' ? 1 : 0) +
		(filterGps !== 'all' ? 1 : 0) +
		(sortBy !== 'name' ? 1 : 0) +
		(pageSize !== 10 ? 1 : 0);
	$: filteredVehicles = (() => {
		const q = filterSearch.toLowerCase();
		let list = $vehicles.filter((v) => {
			const matchStatus = filterStatus === 'all' || v.status === filterStatus;
			const matchSearch =
				!q ||
				v.name?.toLowerCase().includes(q) ||
				v.driver?.toLowerCase().includes(q) ||
				v.location?.toLowerCase().includes(q) ||
				v.description?.toLowerCase().includes(q) ||
				v.brand?.toLowerCase().includes(q) ||
				v.model?.toLowerCase().includes(q) ||
				v.plate?.toLowerCase().includes(q);
			if (!matchStatus || !matchSearch) return false;

			if (filterIgnition === 'on' && String(v.engineStatus ?? '').toUpperCase() !== 'ON') {
				return false;
			}
			if (filterIgnition === 'off' && String(v.engineStatus ?? '').toUpperCase() === 'ON') {
				return false;
			}
			if (filterMotion === 'moving' && !isUnitMoving(v)) return false;
			if (filterMotion === 'stopped' && isUnitMoving(v)) return false;

			const hasGps =
				(v.latitude ?? v.lat) != null &&
				(v.longitude ?? v.lng) != null &&
				!Number.isNaN(Number(v.latitude ?? v.lat));
			if (filterGps === 'with' && !hasGps) return false;
			if (filterGps === 'without' && hasGps) return false;

			return true;
		});

		list = [...list].sort((a, b) => {
			if (sortBy === 'speed') {
				return (Number(b.speed) || 0) - (Number(a.speed) || 0);
			}
			if (sortBy === 'updated') {
				const ta = new Date(a.lastUpdate || 0).getTime() || 0;
				const tb = new Date(b.lastUpdate || 0).getTime() || 0;
				return tb - ta;
			}
			return String(a.name || '').localeCompare(String(b.name || ''), 'es', {
				sensitivity: 'base'
			});
		});
		return list;
	})();
	$: totalPages = Math.max(1, Math.ceil(filteredVehicles.length / (Number(pageSize) || 10)));
	$: safePage = Math.min(vehiclePage, totalPages);
	$: pageSizeN = Number(pageSize) || 10;
	$: pagedVehicles = filteredVehicles.slice((safePage - 1) * pageSizeN, safePage * pageSizeN);
	$: pageFrom = filteredVehicles.length === 0 ? 0 : (safePage - 1) * pageSizeN + 1;
	$: pageTo = Math.min(safePage * pageSizeN, filteredVehicles.length);
	$: pageNumbers = buildPageNumbers(safePage, totalPages);
	$: allFilteredOnMap =
		filteredVehicles.length > 0 &&
		filteredVehicles.every((v) => $mapVisibleUnitIds.includes(String(v.id)));
	$: someFilteredOnMap =
		filteredVehicles.some((v) => $mapVisibleUnitIds.includes(String(v.id))) && !allFilteredOnMap;
	$: {
		filterStatus;
		filterSearch;
		filterIgnition;
		filterMotion;
		filterGps;
		sortBy;
		pageSize;
		vehiclePage = 1;
	}

	/** @param {number} current @param {number} total */
	function buildPageNumbers(current, total) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		/** @type {Array<number | '…'>} */
		const pages = [1];
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);
		if (start > 2) pages.push('…');
		for (let i = start; i <= end; i++) pages.push(i);
		if (end < total - 1) pages.push('…');
		pages.push(total);
		return pages;
	}

	function clearAdvancedFilters() {
		filterIgnition = 'all';
		filterMotion = 'all';
		filterGps = 'all';
		sortBy = 'name';
		pageSize = 10;
	}

	function toggleSelectAllOnMap() {
		vehicleActions.setMapVisibilityForIds(
			filteredVehicles.map((v) => v.id),
			!allFilteredOnMap
		);
	}

	/** Checkbox HTML: propiedad indeterminate no es atributo reactivo en Svelte. */
	function setIndeterminate(node, value) {
		node.indeterminate = Boolean(value);
		return {
			update(v) {
				node.indeterminate = Boolean(v);
			}
		};
	}

	// ── Sidebar sections ──────────────────────────────────────
	const sections = [
		{ id: 'apariencia', label: 'Apariencia', icon: 'mdi:theme-light-dark' },
		{ id: 'unidades', label: 'Unidades', icon: 'mdi:car-side' }
	];

	onMount(async () => {
		if ($vehicles.length === 0) await vehicleActions.loadVehicles();
	});

	// ── Helpers ───────────────────────────────────────────────
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
			vehicleActions.setMapVisibility(v.id, true);
			mapService.centerOnVehicle(v);
			dispatch('close');
		}
	}
	async function fetchVehicleDetail(vehicleId) {
		if (!vehicleId || actionLoading) return;
		editingVehicle = null;
		actionLoading = true;
		try {
			const data = await vehicleActions.fetchVehicle(vehicleId);
			vehicleDetail = data;
			vehicleDetailOpen = true;
		} catch (error) {
			logger.error('Error obteniendo detalle de unidad:', error);
			showHint('No se pudo obtener el detalle de la unidad', false);
		} finally {
			actionLoading = false;
		}
	}
	function openEditVehicle(v) {
		if (!isMaster) return;
		vehicleDetailOpen = false;
		vehicleDetail = null;
		editingVehicle = get(vehicles).find((x) => x.id === v.id) || v;
	}
	function backToVehicleList() {
		vehicleDetailOpen = false;
		vehicleDetail = null;
		editingVehicle = null;
	}
	$: vehicleSubView = editingVehicle
		? 'edit'
		: vehicleDetailOpen && vehicleDetail
			? 'detail'
			: 'list';
	$: if (displaySection !== 'unidades') backToVehicleList();
	function onVehicleEditSaved() {
		showHint('Unidad actualizada', true);
		backToVehicleList();
	}
	function onVehicleEditDeleted() {
		showHint('Unidad eliminada', true);
		backToVehicleList();
	}
	function requestDeleteVehicle(v) {
		if (!isMaster) return;
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
			logger.error('Error eliminando unidad:', error);
			showHint('No se pudo eliminar la unidad', false);
		} finally {
			actionLoading = false;
		}
	}
	function requestDeleteAlert(alert) {
		if (!isMaster) return;
		alertToDelete = { id: alert.id, name: alert.name || 'Alerta' };
	}
	function cancelDeleteAlert() {
		alertToDelete = null;
	}
	async function confirmDeleteAlert() {
		if (!alertToDelete?.id || actionLoading) return;
		actionLoading = true;
		try {
			await alertActions.deleteAlert(alertToDelete.id);
			showHint('Alerta eliminada', true);
			alertToDelete = null;
		} catch (error) {
			logger.error('Error eliminando alerta:', error);
			showHint('No se pudo eliminar la alerta', false);
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

	function unitIconSrc(v) {
		const iconType = v?.icon_type || v?.iconType || 'vehicle-car-sedan';
		return unitIcons[iconType] || unitIcons['vehicle-car-sedan'];
	}
	function unitColorHex(v) {
		return colorSlugToHex(v?.color) || v?.profile_color_hex || '#94a3b8';
	}
	function unitTypeLabel(v) {
		const fromProfile = [v?.brand, v?.model].filter(Boolean).join(' ');
		if (fromProfile) return fromProfile;
		const t = v?.icon_type || v?.iconType || '';
		const labels = {
			'vehicle-car-sedan': 'Auto sedan',
			'vehicle-car-truck': 'Camioneta',
			'vehicle-backhoe-loader': 'Retroexcavadora',
			'vehicle-motorbike-sport': 'Motocicleta',
			'vehicle-trailer-dryvan': 'Remolque'
		};
		return labels[t] || v?.location || 'Unidad';
	}
	function ignitionOn(v) {
		return String(v?.engineStatus ?? '').toUpperCase() === 'ON';
	}
	function formatSpeed(v) {
		const spd = Number(v?.speed);
		if (v?.speed == null || Number.isNaN(spd)) return '—';
		return `${spd.toFixed(2)} km/h`;
	}
	function formatVoltage(val) {
		const n = Number(val);
		if (val == null || Number.isNaN(n)) return '—';
		return `${n.toFixed(1)}V`;
	}
	function statusLabelEs(status) {
		if (status === 'active') return 'Activa';
		if (status === 'inactive') return 'Inactiva';
		if (status === 'maintenance') return 'Mantenimiento';
		return getStatusText(status);
	}
</script>

{#if isMaster && $alertWizard}
	<CrearAlertaWizard on:close={() => alertActions.closeWizard()} />
{/if}

{#if isMaster && alertEditTarget}
	<EditAlertWizard alert={alertEditTarget} on:close={closeAlertEdit} />
{/if}

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 text-slate-900 text-[13px] dark:bg-[#080d1a] dark:text-white/90"
	role="region"
	aria-label="Preferencias y herramientas del mapa"
>
	<!-- SIDEBAR -->
	{#if showSectionSidebar}
		<div
			class="flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-slate-200 bg-white py-3 dark:border-white/[0.07] dark:bg-[#060a15]"
			role="tablist"
		>
			{#each sections as sec (sec.id)}
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
		class="flex min-h-0 min-w-0 flex-1 flex-col overscroll-contain bg-white dark:bg-transparent
			{displaySection === 'zonas' || displaySection === 'unidades'
			? 'overflow-hidden'
			: 'overflow-y-auto'}"
	>
		<!-- ═══ APARIENCIA ═══ -->
		{#if displaySection === 'apariencia'}
			<div class="px-4 py-4">
				<div class="mb-3 flex items-center gap-2">
					<Icon
						icon="mdi:theme-light-dark"
						width={14}
						class="text-slate-500 dark:text-white/35"
						aria-hidden="true"
					/>
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">
						Apariencia
					</h3>
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
							<span class="block text-[10px] text-slate-500 dark:text-white/28"
								>Contraste diurno</span
							>
						</div>
					</button>
				</div>
			</div>

			<!-- ═══ UNIDADES ═══ -->
		{:else if displaySection === 'unidades'}
			<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
				{#if vehicleSubView !== 'list'}
					<div
						class="shrink-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-[#080d1a]"
					>
						<button
							type="button"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/80 dark:hover:bg-white/[0.08]"
							on:click={backToVehicleList}
							title="Volver a unidades"
							aria-label="Volver a unidades"
						>
							<Icon icon="mdi:chevron-left" width={20} aria-hidden="true" />
						</button>
						<div class="min-w-0 flex-1">
							<p class="m-0 truncate text-[13px] font-bold text-slate-900 dark:text-white">
								{vehicleSubView === 'detail' ? 'Detalles de la unidad' : 'Editar unidad'}
							</p>
							<p class="m-0 truncate text-[11px] text-slate-500 dark:text-white/45">
								{vehicleSubView === 'detail' ? vehicleDetail?.name : editingVehicle?.name}
							</p>
						</div>
						{#if isMaster && vehicleSubView === 'detail' && vehicleDetail}
							<button
								type="button"
								class="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
								on:click={() => openEditVehicle(vehicleDetail)}
							>
								<Icon icon="mdi:pencil-outline" width={13} aria-hidden="true" />Editar
							</button>
						{/if}
					</div>
					<div
						class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y scroll-pb-6 [-webkit-overflow-scrolling:touch]"
					>
						{#if vehicleSubView === 'detail' && vehicleDetail}
							<div class="px-1 py-3 pb-10">
								<UnitProfileDetails
									unit={vehicleDetail}
									variant="drawer"
									active={vehicleDetailOpen}
								/>
							</div>
						{:else if editingVehicle}
							<div class="px-4 py-4 pb-12">
								<UnitEditPanel
									unit={editingVehicle}
									compact={false}
									on:cancel={backToVehicleList}
									on:saved={onVehicleEditSaved}
									on:deleted={onVehicleEditDeleted}
								/>
							</div>
						{/if}
					</div>
				{:else}
					<div
						class="shrink-0 space-y-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.06] dark:bg-[#080d1a]"
					>
						<div class="flex items-center gap-2">
							<div class="relative min-w-0 flex-1">
								<Icon
									icon="mdi:magnify"
									width={13}
									class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/28"
									aria-hidden="true"
								/>
								<input
									type="search"
									placeholder="Buscar unidad, conductor…"
									class="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-10 text-[12px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500/50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white dark:placeholder:text-white/22"
									bind:value={filterSearch}
								/>
								<button
									type="button"
									class="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors {showAdvancedFilters ||
									advancedFilterCount > 0
										? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
										: 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white/70'}"
									on:click={() => (showAdvancedFilters = !showAdvancedFilters)}
									aria-expanded={showAdvancedFilters}
									aria-label="Filtros avanzados"
									title="Filtros avanzados"
								>
									<Icon icon="mdi:filter-variant" width={15} aria-hidden="true" />
									{#if advancedFilterCount > 0}
										<span
											class="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[8px] font-bold text-white"
											>{advancedFilterCount}</span
										>
									{/if}
								</button>
							</div>
							<div
								class="flex shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]"
							>
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center transition-colors {vehicleView ===
									'grid'
										? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-300'
										: 'text-slate-500 hover:text-slate-800 dark:text-white/35 dark:hover:text-white/60'}"
									on:click={() => (vehicleView = 'grid')}
									title="Vista tarjeta"
									aria-pressed={vehicleView === 'grid'}
								>
									<Icon icon="mdi:view-grid-outline" width={15} aria-hidden="true" />
								</button>
								<button
									type="button"
									class="flex h-8 w-8 items-center justify-center transition-colors {vehicleView ===
									'list'
										? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-300'
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
								class="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
								on:click={refreshPositions}
								disabled={$loadingPositions}
							>
								<Icon
									icon="mdi:refresh"
									width={13}
									class={$loadingPositions ? 'animate-spin' : ''}
									aria-hidden="true"
								/>
								{$loadingPositions ? '…' : 'Actualizar'}
							</button>
						</div>
						<div
							class="flex flex-wrap items-center gap-2"
							role="group"
							aria-label="Filtrar por estado"
						>
							<button
								type="button"
								class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors {filterStatus ===
								'active'
									? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
									: 'border-transparent bg-emerald-100 text-emerald-800 hover:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'}"
								on:click={() => (filterStatus = filterStatus === 'active' ? 'all' : 'active')}
								aria-pressed={filterStatus === 'active'}
							>
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"
								></span>{$activeVehicles.length} Activas
							</button>
							<button
								type="button"
								class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors {filterStatus ===
								'maintenance'
									? 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200'
									: 'border-transparent bg-amber-100 text-amber-800 hover:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}"
								on:click={() =>
									(filterStatus = filterStatus === 'maintenance' ? 'all' : 'maintenance')}
								aria-pressed={filterStatus === 'maintenance'}
							>
								<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>{maintenanceCount} Mantenimiento
							</button>
							<button
								type="button"
								class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors {filterStatus ===
								'inactive'
									? 'border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-200'
									: 'border-transparent bg-red-100 text-red-800 hover:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}"
								on:click={() => (filterStatus = filterStatus === 'inactive' ? 'all' : 'inactive')}
								aria-pressed={filterStatus === 'inactive'}
							>
								<span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>{inactiveCount} Inactivas
							</button>
						</div>
						{#if showAdvancedFilters}
							<div
								class="space-y-2.5 rounded-xl border border-emerald-500/20 bg-white p-3 dark:border-emerald-400/20 dark:bg-white/[0.04]"
							>
								<div class="flex items-center justify-between gap-2">
									<p
										class="m-0 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/45"
									>
										Filtros avanzados
									</p>
									<button
										type="button"
										class="text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
										on:click={clearAdvancedFilters}
										disabled={advancedFilterCount === 0}
									>
										Limpiar
									</button>
								</div>
								<div class="grid grid-cols-2 gap-2">
									<label
										class="flex flex-col gap-1 text-[10px] font-medium text-slate-500 dark:text-white/40"
									>
										Ignición
										<select
											bind:value={filterIgnition}
											class="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
										>
											<option value="all">Todas</option>
											<option value="on">Encendida</option>
											<option value="off">Apagada</option>
										</select>
									</label>
									<label
										class="flex flex-col gap-1 text-[10px] font-medium text-slate-500 dark:text-white/40"
									>
										Movimiento
										<select
											bind:value={filterMotion}
											class="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
										>
											<option value="all">Todas</option>
											<option value="moving">En movimiento</option>
											<option value="stopped">Detenidas</option>
										</select>
									</label>
									<label
										class="flex flex-col gap-1 text-[10px] font-medium text-slate-500 dark:text-white/40"
									>
										GPS
										<select
											bind:value={filterGps}
											class="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
										>
											<option value="all">Todas</option>
											<option value="with">Con posición</option>
											<option value="without">Sin posición</option>
										</select>
									</label>
									<label
										class="flex flex-col gap-1 text-[10px] font-medium text-slate-500 dark:text-white/40"
									>
										Ordenar
										<select
											bind:value={sortBy}
											class="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
										>
											<option value="name">Nombre</option>
											<option value="speed">Velocidad</option>
											<option value="updated">Última act.</option>
										</select>
									</label>
								</div>
								<label
									class="flex flex-col gap-1 text-[10px] font-medium text-slate-500 dark:text-white/40"
								>
									Por página
									<select
										bind:value={pageSize}
										class="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
									>
										{#each PAGE_SIZE_OPTIONS as n (n)}
											<option value={n}>{n} unidades</option>
										{/each}
									</select>
								</label>
							</div>
						{/if}
						<label
							class="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-white/55"
						>
							<input
								type="checkbox"
								class="size-3.5 rounded border-indigo-400/50 accent-indigo-500 focus:ring-indigo-500/40 dark:border-indigo-400/35 dark:accent-indigo-400"
								checked={allFilteredOnMap}
								use:setIndeterminate={someFilteredOnMap}
								disabled={filteredVehicles.length === 0}
								on:change={toggleSelectAllOnMap}
							/>
							Seleccionar todas ({filteredVehicles.length}) en mapa
							{#if someFilteredOnMap}
								<span class="text-[10px] text-slate-400 dark:text-white/35">· parcial</span>
							{/if}
						</label>
					</div>
					<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
						{#if $loadingVehicles}
							<div
								class="flex items-center justify-center gap-3 py-12 text-slate-500 dark:text-white/38"
							>
								<span
									class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600/20 border-t-emerald-500"
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
							<ul class="m-0 flex list-none flex-col gap-3.5 p-0">
								{#each pagedVehicles as v (v.id)}
									<li
										class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-white/[0.08] dark:bg-white/[0.03]"
									>
										<div class="flex items-start gap-3">
											<input
												type="checkbox"
												class="mt-1 size-3.5 shrink-0 rounded border-indigo-400/50 accent-indigo-500 focus:ring-indigo-500/40 dark:border-indigo-400/35 dark:accent-indigo-400"
												checked={$mapVisibleUnitIds.includes(String(v.id))}
												on:change={() => vehicleActions.toggleMapVisibility(v.id)}
												aria-label="Mostrar {v.name} en el mapa"
											/>
											<div class="flex h-9 w-9 shrink-0 items-center justify-center">
												<ColoredVehicleIcon
													src={unitIconSrc(v)}
													colorHex={unitColorHex(v)}
													sizeClass="h-8 w-8"
													alt=""
												/>
											</div>
											<div class="min-w-0 flex-1">
												<div class="flex items-start justify-between gap-2">
													<p
														class="m-0 truncate text-[13px] font-bold text-slate-900 dark:text-white"
													>
														{v.name}
													</p>
													<span
														class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold {statusPill(
															v.status
														)}">{statusLabelEs(v.status)}</span
													>
												</div>
												<div
													class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-white/45"
												>
													<span class="inline-flex items-center gap-1">
														<Icon icon="mdi:account-outline" width={12} aria-hidden="true" />
														{v.driver || 'Sin conductor'}
													</span>
													<span class="inline-flex items-center gap-1">
														<Icon icon="mdi:map-marker-outline" width={12} aria-hidden="true" />
														{unitTypeLabel(v)}
													</span>
												</div>
												<div
													class="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3 dark:border-white/[0.06]"
												>
													<UnitTelemetryBadges unit={v} />
													<SignalMeters unit={v} />
												</div>
											</div>
											<div
												class="flex shrink-0 flex-col items-end gap-1.5 self-stretch"
												role="group"
												aria-label="Acciones de {v.name}"
											>
												<button
													type="button"
													class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
													on:click={() => centerOnVehicle(v)}
													disabled={!(v.latitude || v.lat) || !(v.longitude || v.lng)}
													aria-label="Centrar el mapa en {v.name}"
													title="Centrar en mapa"
												>
													<Icon icon="mdi:crosshairs-gps" width={16} aria-hidden="true" />
												</button>
												<button
													type="button"
													class="group flex h-8 max-w-8 items-center overflow-hidden rounded-lg border border-slate-200 bg-white px-2 text-slate-700 transition-all duration-200 hover:max-w-[9rem] hover:bg-slate-100 focus-visible:max-w-[9rem] dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
													on:click={() => fetchVehicleDetail(v.id)}
													disabled={actionLoading}
													aria-label="Ver detalles"
													title="Ver detalles"
												>
													<Icon
														icon="mdi:database-search-outline"
														width={14}
														class="shrink-0"
														aria-hidden="true"
													/>
													<span
														class="max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold opacity-0 transition-all duration-200 group-hover:ml-1.5 group-hover:max-w-[6rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[6rem] group-focus-visible:opacity-100"
														>Ver detalles</span
													>
												</button>
												{#if isMaster}
													<button
														type="button"
														class="group flex h-8 max-w-8 items-center overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-emerald-700 transition-all duration-200 hover:max-w-[7rem] hover:bg-emerald-100 focus-visible:max-w-[7rem] dark:border-emerald-500/25 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
														on:click={() => openEditVehicle(v)}
														disabled={actionLoading}
														aria-label="Editar"
														title="Editar"
													>
														<Icon
															icon="mdi:pencil-outline"
															width={14}
															class="shrink-0"
															aria-hidden="true"
														/>
														<span
															class="max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold opacity-0 transition-all duration-200 group-hover:ml-1.5 group-hover:max-w-[4rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[4rem] group-focus-visible:opacity-100"
															>Editar</span
														>
													</button>
													<button
														type="button"
														class="group flex h-8 max-w-8 items-center overflow-hidden rounded-lg border border-red-300 bg-red-50 px-2 text-red-700 transition-all duration-200 hover:max-w-[7.5rem] hover:bg-red-100 focus-visible:max-w-[7.5rem] dark:border-red-500/25 dark:bg-red-600/12 dark:text-red-300 dark:hover:bg-red-600/20"
														on:click={() => requestDeleteVehicle(v)}
														disabled={actionLoading}
														aria-label="Eliminar"
														title="Eliminar"
													>
														<Icon
															icon="mdi:trash-can-outline"
															width={14}
															class="shrink-0"
															aria-hidden="true"
														/>
														<span
															class="max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold opacity-0 transition-all duration-200 group-hover:ml-1.5 group-hover:max-w-[4.5rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[4.5rem] group-focus-visible:opacity-100"
															>Eliminar</span
														>
													</button>
												{/if}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
								{#each pagedVehicles as v (v.id)}
									<li
										class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
									>
										<input
											type="checkbox"
											class="size-3.5 shrink-0 rounded border-indigo-400/50 accent-indigo-500 focus:ring-indigo-500/40 dark:border-indigo-400/35 dark:accent-indigo-400"
											checked={$mapVisibleUnitIds.includes(String(v.id))}
											on:change={() => vehicleActions.toggleMapVisibility(v.id)}
											aria-label="Mostrar {v.name} en el mapa"
										/>
										<ColoredVehicleIcon
											src={unitIconSrc(v)}
											colorHex={unitColorHex(v)}
											sizeClass="h-7 w-7"
											alt=""
										/>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span
													class="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-900 dark:text-white"
													>{v.name}</span
												>
												<span
													class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold {statusPill(
														v.status
													)}">{statusLabelEs(v.status)}</span
												>
											</div>
											<div
												class="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-white/38"
											>
												<span class="inline-flex items-center gap-1 font-semibold">
													<span
														class="flex h-5 w-5 items-center justify-center rounded-md {ignitionOn(
															v
														)
															? 'bg-emerald-500/15 text-emerald-500'
															: 'bg-slate-400/15 text-slate-400'}"
														aria-hidden="true"
													>
														<Icon
															icon={ignitionOn(v) ? 'mdi:engine' : 'mdi:engine-off'}
															width={12}
														/>
													</span>
													{ignitionOn(v) ? 'Encendida' : 'Apagada'}
												</span>
												<span
													class="inline-flex items-center gap-1 font-bold {speedColor(
														Number(v.speed) || 0
													)}"
												>
													<span
														class="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/15 text-sky-500"
														aria-hidden="true"
													>
														<Icon icon="mdi:speedometer" width={12} />
													</span>
													{formatSpeed(v)}
												</span>
												<span
													class="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400"
												>
													<span
														class="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15 text-amber-500"
														aria-hidden="true"
													>
														<Icon icon="mdi:car-battery" width={12} />
													</span>
													{formatVoltage(v.mainBatteryVoltage)}
												</span>
												{#if v.lastUpdateFormatted}
													<span
														class="inline-flex min-w-0 items-center gap-1 truncate font-medium text-indigo-600 dark:text-indigo-300"
													>
														<span
															class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-500"
															aria-hidden="true"
														>
															<Icon icon="mdi:clock-check-outline" width={12} />
														</span>
														<span class="truncate">{v.lastUpdateFormatted}</span>
													</span>
												{/if}
											</div>
										</div>
										<button
											type="button"
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
											on:click={() => centerOnVehicle(v)}
											disabled={!(v.latitude || v.lat) || !(v.longitude || v.lng)}
											aria-label="Centrar mapa en {v.name}"
										>
											<Icon icon="mdi:crosshairs-gps" width={13} aria-hidden="true" />
										</button>
										<button
											type="button"
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
											on:click={() => fetchVehicleDetail(v.id)}
											title="Ver detalles"
											disabled={actionLoading}
										>
											<Icon icon="mdi:database-search-outline" width={13} aria-hidden="true" />
										</button>
										{#if isMaster}
											<button
												type="button"
												class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-600/12 dark:text-emerald-300 dark:hover:bg-emerald-600/20"
												on:click={() => openEditVehicle(v)}
												title="Editar"
												disabled={actionLoading}
											>
												<Icon icon="mdi:pencil-outline" width={13} aria-hidden="true" />
											</button>
											<button
												type="button"
												class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-600/12 dark:text-red-300 dark:hover:bg-red-600/20"
												on:click={() => requestDeleteVehicle(v)}
												title="Eliminar"
												disabled={actionLoading}
											>
												<Icon icon="mdi:trash-can-outline" width={13} aria-hidden="true" />
											</button>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<div
						class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-white/[0.06]"
					>
						<span class="text-[11px] text-slate-500 dark:text-white/35">
							Mostrando {pageFrom} a {pageTo} de {filteredVehicles.length} unidades
						</span>
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.08]"
								on:click={() => (vehiclePage = Math.max(1, safePage - 1))}
								disabled={safePage <= 1}
								aria-label="Página anterior"
							>
								<Icon icon="mdi:chevron-left" width={14} aria-hidden="true" />
							</button>
							{#each pageNumbers as p, i (typeof p === 'number' ? p : `e-${i}`)}
								{#if p === '…'}
									<span class="px-0.5 text-[11px] text-slate-400">…</span>
								{:else}
									<button
										type="button"
										class="flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[11px] font-semibold transition-colors {safePage ===
										p
											? 'border-emerald-500/40 bg-emerald-600 text-white'
											: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.08]'}"
										on:click={() => (vehiclePage = p)}
										aria-current={safePage === p ? 'page' : undefined}
										aria-label="Ir a página {p}"
									>
										{p}
									</button>
								{/if}
							{/each}
							<button
								type="button"
								class="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.08]"
								on:click={() => (vehiclePage = Math.min(totalPages, safePage + 1))}
								disabled={safePage >= totalPages}
								aria-label="Página siguiente"
							>
								<Icon icon="mdi:chevron-right" width={14} aria-hidden="true" />
							</button>
						</div>
					</div>

					{#if vehicleToDelete}
						<div
							class="shrink-0 border-t border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/25 dark:bg-red-600/10"
						>
							<p class="m-0 text-[11px] text-red-800 dark:text-red-300">
								¿Eliminar unidad <strong>{vehicleToDelete.name}</strong>? (soft delete en API)
							</p>
							<div class="mt-2 flex justify-end gap-2">
								<button
									type="button"
									class="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.1]"
									on:click={cancelDeleteVehicle}
									disabled={actionLoading}>Cancelar</button
								>
								<button
									type="button"
									class="h-8 rounded-lg border border-red-500/25 bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
									on:click={confirmDeleteVehicle}
									disabled={actionLoading}>Eliminar</button
								>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- ═══ ADMINISTRACIÓN / ZONAS / HISTORIAL / GESTIONAR ═══ -->
		{:else if displaySection === 'administracion'}
			<AdminPanel embedded={true} />
		{:else if displaySection === 'zonas'}
			<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
						alarmas de hoy
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2 p-0">
						{#each $alarmEvents as ev (ev.id)}
							<li
								class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 {!ev.read
									? 'border-blue-300/70 bg-blue-50 dark:border-blue-500/18 dark:bg-blue-600/[0.07]'
									: 'border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.03]'}"
							>
								<span
									class="h-1.5 w-1.5 shrink-0 rounded-full {!ev.read
										? 'bg-blue-500 shadow-[0_0_6px_rgba(96,165,250,.7)] dark:bg-blue-400'
										: 'bg-slate-300 dark:bg-white/18'}"
									aria-hidden="true"
								></span>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[12px] font-semibold text-slate-900 dark:text-white">
										{ev.name || 'Alerta'}
									</p>
									<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/33">
										{ev.vehicle || 'Unidad'} ·
										<time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
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
					<h3 class="m-0 text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">
						Gestionar alertas
					</h3>
					{#if isMaster && hasVehicles}
						<button
							type="button"
							class="ml-auto flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-500/28 dark:bg-blue-600/15 dark:text-blue-300 dark:hover:bg-blue-600/25"
							on:click={() => alertActions.openWizard()}
						>
							<Icon icon="mdi:plus-circle-outline" width={13} aria-hidden="true" />Nueva alerta
						</button>
					{/if}
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
							<p class="m-0 text-[13px] font-semibold text-slate-800 dark:text-white/70">
								Sin alertas configuradas
							</p>
							<p
								class="m-0 mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-600 dark:text-white/35"
							>
								{isMaster
									? hasVehicles
										? 'Crea alertas de ignición o zona para recibir notificaciones en tiempo real.'
										: 'Agrega al menos una unidad antes de configurar alertas.'
									: 'Cuando un administrador configure alertas, aparecerán aquí.'}
							</p>
						</div>
						{#if isMaster && hasVehicles}
							<button
								type="button"
								class="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[12px] font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-600/15 dark:text-blue-300 dark:hover:bg-blue-600/25"
								on:click={() => alertActions.openWizard()}
							>
								<Icon icon="mdi:plus" width={14} aria-hidden="true" />Crear primera alerta
							</button>
						{/if}
					</div>
				{:else}
					<ul class="flex flex-col gap-2 list-none p-0 m-0">
						{#each $alerts as alert (alert.id)}
							<li>
								<div
									class="flex items-center gap-2.5 rounded-xl border p-3 transition-colors {alert.enabled
										? 'border-slate-200 bg-slate-50 dark:border-white/[0.07] dark:bg-white/[0.03]'
										: 'border-slate-200/60 bg-slate-50/60 opacity-60 dark:border-white/[0.04] dark:bg-white/[0.02]'}"
								>
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {alert.type ===
										'ignition'
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
										<p
											class="m-0 text-[13px] font-semibold leading-snug text-slate-900 dark:text-white"
										>
											{alert.name}
										</p>
										<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/38">
											{alertCondLabel(alert.condition)} · {alert.units.length} unidad{alert.units
												.length !== 1
												? 'es'
												: ''}
										</p>
									</div>
									{#if isMaster}
										<div class="flex shrink-0 items-center gap-1.5">
											<!-- Toggle enable/disable -->
											<button
												type="button"
												role="switch"
												aria-checked={alert.enabled}
												aria-label="{alert.enabled ? 'Desactivar' : 'Activar'} «{alert.name}»"
												class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed {alert.enabled
													? 'bg-blue-600'
													: 'bg-slate-300 dark:bg-white/20'}"
												disabled={alertTogglingId === alert.id}
												on:click={() => handleAlertToggle(alert)}
											>
												<span
													class="pointer-events-none absolute left-[2px] top-[2px] block h-[17px] w-[17px] rounded-full bg-white shadow transition-transform {alert.enabled
														? 'translate-x-4'
														: 'translate-x-0'}"
												></span>
											</button>
											<!-- Editar -->
											<button
												type="button"
												class="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.1]"
												on:click={() => openAlertEdit(alert)}
												aria-label="Editar «{alert.name}»"
												title="Editar"
											>
												<Icon icon="mdi:pencil-outline" width={13} aria-hidden="true" />
											</button>
											<!-- Eliminar -->
											<button
												type="button"
												class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
												on:click={() => requestDeleteAlert(alert)}
												aria-label="Eliminar «{alert.name}»"
												title="Eliminar"
											>
												<Icon icon="mdi:trash-can-outline" width={13} aria-hidden="true" />
											</button>
										</div>
									{:else}
										<span
											class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold {alert.enabled
												? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
												: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/45'}"
										>
											{alert.enabled ? 'Activa' : 'Inactiva'}
										</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
</div>

<ConfirmModal
	open={!!alertToDelete}
	title="Eliminar alerta"
	confirmLabel="Eliminar"
	cancelLabel="Cancelar"
	destructive
	loading={actionLoading}
	on:cancel={cancelDeleteAlert}
	on:confirm={confirmDeleteAlert}
>
	{#if alertToDelete}
		<p class="m-0">
			¿Eliminar la alerta <strong>{alertToDelete.name}</strong>? Esta acción no se puede deshacer.
		</p>
	{/if}
</ConfirmModal>

{#if toolHint}
	<div
		class="pointer-events-none fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg {toolHintOk
			? 'bg-emerald-600'
			: 'bg-red-600'}"
		role="status"
		aria-live="polite"
	>
		{toolHint}
	</div>
{/if}
