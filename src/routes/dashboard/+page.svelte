<script>
	import { logger } from '$lib/utils/logger.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { scale, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { user } from '$lib/stores/auth.js';
	import { validateSessionWithApi, logoutSession } from '$lib/services/sessionService.js';
	import { activeTab } from '$lib/stores/navigationStore.js';
	import {
		h3Actions,
		mobileCrearZonaMapPassesPointer,
		desktopZonePanelSubView,
		zoneUiToast,
		showH3Grid
	} from '$lib/stores/h3Store.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { setThemeWithReveal } from '$lib/motion/themeReveal.js';
	import { viewEnter, softFade } from '$lib/motion/index.js';
	import { vehicles, activeUnit, vehicleActions } from '$lib/stores/vehicleStore.js';
	import { mapService, streetViewVisible } from '$lib/services/mapService.js';
	import { alertActions, alarmEvents } from '$lib/stores/alertStore.js';
	import '@fontsource/sora/latin-300.css';
	import '@fontsource/sora/latin-ext-300.css';
	import { trackingView } from '$lib/stores/trackingViewStore.js';
	import { createFleetDayController } from '$lib/stores/fleetDayStore.js';
	import { uiLook } from '$lib/stores/lookStore.js';
	import {
		loadFleetDay,
		fetchFleetDaySummary,
		isFleetDaySummaryEndpointEnabled,
		todayRange
	} from '$lib/services/fleetDayService.js';
	import { recordPositions } from '$lib/stores/liveTrailStore.js';
	import FleetColumn from '$lib/components/tracking/FleetColumn.svelte';
	import AlertsColumn from '$lib/components/tracking/AlertsColumn.svelte';
	import FleetDayStrip from '$lib/components/tracking/FleetDayStrip.svelte';
	import UnitDayStrip from '$lib/components/tracking/UnitDayStrip.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import { loadUnitDay } from '$lib/services/unitDayService.js';
	import { tripActions } from '$lib/stores/tripStore.js';
	import PanelToggles from '$lib/components/tracking/PanelToggles.svelte';
	import FleetManage from '$lib/components/tracking/FleetManage.svelte';
	import { logoDe, marcaOPorDefecto } from '$lib/brand.js';
	import Icon from '$lib/components/Icon.svelte';

	import MapContainer from '$lib/components/MapContainer.svelte';
	import TopDrawer from '$lib/components/TopDrawer.svelte';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';
	import AdminWorkspace from '$lib/components/admin/AdminWorkspace.svelte';
	import WorkspaceSwitcher from '$lib/components/admin/WorkspaceSwitcher.svelte';
	import WorkspaceRail from '$lib/components/WorkspaceRail.svelte';
	import AlertasZonasSidePanel from '$lib/components/AlertasZonasSidePanel.svelte';

	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import TabAlertas from '$lib/components/TabAlertas.svelte';
	import TabInformes from '$lib/components/TabInformes.svelte';
	import OrganizationSwitcher from '$lib/components/OrganizationSwitcher.svelte';
	import TabAjustes from '$lib/components/TabAjustes.svelte';
	import ZonasPanel from '$lib/components/ZonasPanel.svelte';
	import TrackingSubPanel from '$lib/components/TrackingSubPanel.svelte';
	import UnitsPickerSheet from '$lib/components/UnitsPickerSheet.svelte';
	import { eventActions } from '$lib/stores/eventStore.js';
	import { requestedPanelView, pendingTrackingDrawer } from '$lib/stores/navigationStore.js';
	import { workspace, workspaceActions, adminSection } from '$lib/stores/workspaceStore.js';

	let isLoading = true;
	let userData = null;
	let isAppFullscreen = false;
	let showUserMenu = false;
	let showThemeOptions = false;
	let showMobileUnitsSheet = false;
	let prevMobileTab = 'seguimiento';
	let trackingPanelView = 'unit-info';

	let openDrawer = ''; // '' | 'configuracion:…'

	// ── Vista Panel (escritorio, opcional; la Clásica es la de siempre) ─────
	// El usuario elige la vista y qué paneles ve (`trackingView`). El ancho de
	// pantalla no decide qué aparece: solo pliega la franja del día si no cabe.
	const FLEET_COL_W = 320;
	/** Ancho de la columna en modo gestión (sustituye al cajón «Unidades»). */
	const FLEET_MANAGE_W = 560;
	let fleetManaging = false;
	const ALERTS_COL_W = 288;
	const GAP = 12;
	/** Ancho mínimo de mapa entre columnas para mostrar la franja desplegada. */
	const STRIP_MIN_W = 560;
	/** Ancho de la columna de controles del mapa (capas, zoom, Street View). */
	const MAP_CONTROLS_W = 44;
	let isMdUp = false;
	let mainWidth = 0;
	let showPanelToggles = false;

	/** El día de la flota (km, utilización, actividad). Ver fleetDayService. */
	/**
	 * «Modo unidad» (vista Panel): con una unidad abierta, o con una flota de una
	 * sola unidad, la franja de abajo muestra el día de esa unidad.
	 */
	/** @type {any} */
	let unitDayTarget = null;
	const unitDayCtrl = createFleetDayController({
		load: () => loadUnitDay({ unit: unitDayTarget }),
		store: unitDay
	});
	let unitDayStartedFor = '';
	/** Trayecto de la línea de tiempo dibujado en el mapa. */
	let unitTripId = null;

	const fleetDayCtrl = createFleetDayController({
		load: () =>
			isFleetDaySummaryEndpointEnabled()
				? fetchFleetDaySummary(todayRange())
				: loadFleetDay({ units: get(vehicles), alarms: get(alarmEvents) })
	});
	let fleetDayStarted = false;
	let fleetDayUnitCount = 0;

	const SW = 72;

	const sidebarBtnBase =
		'relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border transition-[background-color,border-color,color,box-shadow] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b16]';
	/**
	 * Vista Panel: color de categoría de cada ícono del riel cuando no está
	 * seleccionado; los mismos colores que esas cosas tienen en los paneles.
	 */
	const RAIL_ICON_COLOR = {
		unidades: 'text-indigo-500 dark:text-indigo-400',
		alertas_zonas: 'text-amber-500 dark:text-amber-400',
		informes: 'text-violet-500 dark:text-violet-400'
	};
	/** Seguimiento: unidades + alertas/zonas + informes. */
	const configSidebarItems = [
		{ id: 'unidades', label: 'Unidades', title: 'Seguimiento', icon: 'mdi:car-side' },
		{
			id: 'alertas_zonas',
			label: 'Alertas',
			title: 'Alertas y zonas',
			icon: 'mdi:bell-ring-outline',
			requiresVehicles: true
		},
		{
			id: 'informes',
			label: 'Informes',
			title: 'Informes',
			icon: 'mdi:file-chart-outline',
			requiresVehicles: true
		}
	];

	$: hasVehicles = $vehicles.length > 0;
	$: visibleConfigSidebarItems = configSidebarItems.filter(
		(item) => !item.requiresVehicles || hasVehicles
	);
	$: if (
		!hasVehicles &&
		(openDrawer === 'configuracion:alertas_zonas' || openDrawer === 'configuracion:informes')
	) {
		openDrawer = '';
	}

	$: isAdminWorkspace = !!userData?.is_master && $workspace === 'admin';

	/** En móvil siempre la clásica: la vista Panel es de escritorio. */
	$: isPanelView = isMdUp && $trackingView.view === 'panel';
	$: if (browser) mapService.setMapStyleVariant(isPanelView ? 'panel' : 'clasica');
	$: uiLook.set(isPanelView ? 'panel' : 'clasica');
	$: panels = $trackingView.panels;
	/** Paneles flotantes fuera cuando el mapa necesita todo el espacio. */
	$: trackingOverlaysHidden =
		isConfigDrawerOpen || $showH3Grid || $desktopZonePanelSubView !== 'zonas' || $streetViewVisible;
	$: panelLayoutActive = isPanelView && !trackingOverlaysHidden;
	$: if (!isPanelView) fleetManaging = false;
	$: showLeftColumn = panelLayoutActive && (panels.flota || !!$activeUnit || fleetManaging);
	$: showFleetReopen = panelLayoutActive && !panels.flota && !$activeUnit && !fleetManaging;
	$: leftColumnWidth = fleetManaging ? FLEET_MANAGE_W : FLEET_COL_W;
	$: showAlertsColumn = panelLayoutActive && panels.alertas;
	$: showFleetDayStrip = panelLayoutActive && panels.hoy && hasVehicles;
	$: unitModeUnit =
		isPanelView && !isAdminWorkspace
			? ($activeUnit ?? ($vehicles.length === 1 ? $vehicles[0] : null))
			: null;
	$: wantsUnitDay = browser && !!userData && !!unitModeUnit && panels.hoy;
	$: unitDayTarget = unitModeUnit;
	// Cambió la unidad enfocada: se vacía la franja (no mostrar el día de otra) y se pide.
	$: if (wantsUnitDay && unitModeUnit && unitDayStartedFor !== String(unitModeUnit.id)) {
		const first = !unitDayStartedFor;
		unitDayStartedFor = String(unitModeUnit.id);
		clearUnitTrip();
		unitDay.set({ status: 'loading', data: null, error: null, refreshing: true });
		if (first) unitDayCtrl.start();
		else unitDayCtrl.refresh();
	}
	$: if (!wantsUnitDay && unitDayStartedFor) {
		unitDayStartedFor = '';
		unitDayCtrl.stop();
		clearUnitTrip();
	}
	$: leftEdge = showLeftColumn
		? GAP + leftColumnWidth + GAP
		: showFleetReopen
			? GAP + 44 + GAP
			: GAP;
	$: mapControlsRight = showAlertsColumn ? GAP + ALERTS_COL_W + GAP : 10;
	/**
	 * En Panel, capas y zoom van abajo a la derecha (a 10 px del borde, sobre Street
	 * View). La franja del día termina antes para no taparlos, aunque la columna
	 * de alertas esté cerrada.
	 */
	$: stripRight = Math.max(mapControlsRight, 10 + MAP_CONTROLS_W + GAP);
	$: stripCompact = mainWidth - leftEdge - stripRight < STRIP_MIN_W;
	$: visibleUnitIds = new Set($vehicles.map((v) => String(v.id)));

	// Los datos del día solo se piden si algún panel los pinta.
	$: wantsFleetDay =
		browser &&
		!!userData &&
		isPanelView &&
		hasVehicles &&
		(isAdminWorkspace ? $adminSection === 'dashboard' : panels.flota || panels.hoy);
	$: if (wantsFleetDay && !fleetDayStarted) {
		fleetDayStarted = true;
		fleetDayUnitCount = $vehicles.length;
		fleetDayCtrl.start();
	}
	$: if (!wantsFleetDay && fleetDayStarted) {
		fleetDayStarted = false;
		fleetDayCtrl.stop();
	}
	// Llegó o se fue una unidad: el día cambia de forma, se vuelve a pedir.
	$: if (fleetDayStarted && $vehicles.length !== fleetDayUnitCount) {
		fleetDayUnitCount = $vehicles.length;
		fleetDayCtrl.refresh();
	}
	$: if (userData && !userData.is_master) {
		if ($workspace === 'admin') workspaceActions.ensureTrackingForUser();
	}

	/** Al volver de admin con un drawer pendiente (p. ej. Informes). */
	$: if (!isAdminWorkspace && $pendingTrackingDrawer) {
		const section = $pendingTrackingDrawer;
		pendingTrackingDrawer.set(null);
		openDrawer = '';
		openConfigDrawer(section);
	}

	const canonicalUrl =
		page?.url?.origin && page?.url?.pathname ? `${page.url.origin}${page.url.pathname}` : '';

	$: if ($requestedPanelView) {
		trackingPanelView = $requestedPanelView;
		requestedPanelView.set(null);
	}

	function closeDrawer() {
		openDrawer = '';
	}

	function getConfigDrawerId(section) {
		return `configuracion:${section}`;
	}

	function openConfigDrawer(section) {
		const normalized =
			section === 'zonas' || section === 'gestionar_alertas' ? 'alertas_zonas' : section;
		showUserMenu = false;
		// Vista Panel: «Unidades» es el modo Gestionar de la columna, no un cajón aparte.
		if (isPanelView && normalized === 'unidades') {
			openDrawer = '';
			fleetManaging = !fleetManaging;
			return;
		}
		const drawerId = getConfigDrawerId(normalized);
		openDrawer = openDrawer === drawerId ? '' : drawerId;
		if (openDrawer) fleetManaging = false;
	}

	/** Clases de botón lateral: el caller debe pasar un booleano derivado de openDrawer en el template. */
	function sidebarNavBtnClass(active, panel = false) {
		if (panel) {
			const neutral =
				'border-slate-900 bg-slate-900 text-white dark:border-white/15 dark:bg-white/[0.1] dark:text-white';
			const idlePanel =
				'border-transparent bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/[0.09] dark:hover:text-white/85';
			return `${sidebarBtnBase} ${active ? neutral : idlePanel}`;
		}
		const idle =
			'border-transparent bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/[0.09] dark:hover:text-white/85';
		const activeCls =
			'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/35 dark:border-blue-400/50 dark:bg-blue-500/25 dark:text-blue-300 dark:shadow-[0_0_18px_rgba(59,130,246,0.35)]';
		return `${sidebarBtnBase} ${active ? activeCls : idle}`;
	}

	$: isConfigDrawerOpen = openDrawer.startsWith('configuracion:');
	// Lectura directa de `openDrawer` para que la reactividad (Svelte 5) no se pierda en una función auxiliar.
	$: activeConfigSection =
		openDrawer.startsWith('configuracion:') && openDrawer.length > 'configuracion:'.length
			? openDrawer.slice('configuracion:'.length)
			: 'apariencia';
	$: configDrawerTitle =
		configSidebarItems.find((item) => item.id === activeConfigSection)?.title ??
		configSidebarItems.find((item) => item.id === activeConfigSection)?.label ??
		'Configuración';

	$: isSideConfigPanel =
		activeConfigSection === 'unidades' ||
		activeConfigSection === 'alertas_zonas' ||
		activeConfigSection === 'informes';
	/** Mismo ancho para Seguimiento, Alertas e Informes (panel lateral homogéneo). */
	const configSideWidthClass = 'w-[min(980px,78%)] max-w-[1080px]';
	$: configDrawerSubtitle =
		activeConfigSection === 'unidades'
			? 'Visualiza y administra tus unidades en tiempo real'
			: activeConfigSection === 'alertas_zonas'
				? 'Reglas de alerta y geocercas sobre el mapa'
				: activeConfigSection === 'informes'
					? 'Telemetría y reportes de unidades'
					: '';
	$: configDrawerIcon =
		activeConfigSection === 'unidades'
			? 'mdi:car-side'
			: activeConfigSection === 'alertas_zonas'
				? 'mdi:bell-ring-outline'
				: activeConfigSection === 'informes'
					? 'mdi:file-chart-outline'
					: 'mdi:cog-outline';

	/** Master: switcher en seguimiento. */
	$: showTrackingWorkspaceSwitcher = !!userData?.is_master && !isAdminWorkspace;

	function onTrackingPanelViewChange(nextView) {
		if (nextView === 'trips') {
			mapService.clearFollowVehicle();
		}
		if (trackingPanelView === 'trips' && nextView !== 'trips') {
			mapService.clearTripRoute();
			mapService.hideTripAlerts();
			mapService.stopTripPlayback();
		}
		if (trackingPanelView === 'events' && nextView !== 'events') {
			eventActions.clear();
		}
		trackingPanelView = nextView;
	}

	function backToUnitInfoPanel() {
		onTrackingPanelViewChange('unit-info');
	}

	function centerOnActiveUnit() {
		if (!$activeUnit) return;
		vehicleActions.setMapVisibility($activeUnit.id, true);
		mapService.centerOnVehicle($activeUnit);
	}

	/** Activa una unidad en seguimiento y la hace visible en el mapa (misma fuente de verdad). */
	function selectUnitForTracking(unitOrId) {
		const unit =
			unitOrId && typeof unitOrId === 'object'
				? unitOrId
				: $vehicles.find((u) => String(u.id) === String(unitOrId));
		if (!unit?.id) return;
		vehicleActions.setMapVisibility(unit.id, true);
		vehicleActions.setActiveUnit(unit.id);
		trackingPanelView = 'unit-info';
		if (mobileVehicleHasCoords(unit)) {
			mapService.centerOnVehicle(unit);
		}
		showMobileUnitsSheet = false;
	}

	/** Dibuja en el mapa el trayecto elegido en «El día de la unidad». */
	async function showUnitTrip(/** @type {string} */ tripId) {
		unitTripId = tripId;
		const detail = await tripActions.loadTripDetail(tripId, { includePoints: true });
		if (unitTripId !== tripId) return;
		if (detail?.points?.length) {
			mapService.drawTripRoute(detail.points);
			mapService.fitBoundsToPoints(detail.points);
		} else {
			unitTripId = null;
		}
	}

	function clearUnitTrip() {
		if (!unitTripId) return;
		unitTripId = null;
		mapService.clearTripRoute();
	}

	function closeActiveUnitPanel() {
		mapService.clearFollowVehicle();
		mapService.setHighlightedVehicle(null);
		vehicleActions.setActiveUnit(null);
		trackingPanelView = 'unit-info';
		showMobileUnitsSheet = false;
	}

	function handleBodyClick(e) {
		if (!e.target.closest('[data-dashboard-user-menu]')) {
			showUserMenu = false;
			showThemeOptions = false;
		}
		if (!e.target.closest('[data-dashboard-panels-menu]')) {
			showPanelToggles = false;
		}
	}

	function handleGlobalKeydown(e) {
		if (e.key === 'Escape') {
			showUserMenu = false;
			showThemeOptions = false;
			showPanelToggles = false;
			if (get(desktopZonePanelSubView) !== 'zonas') {
				mapService.disableMobileZoneEditorZoomLock();
				h3Actions.exitMobileZoneMap();
				mapService.setMapTheme(get(theme) === 'light' ? 'light' : 'dark');
				requestAnimationFrame(() => mapService.resizeMap());
				desktopZonePanelSubView.set('zonas');
			}
			closeDrawer();
		}
	}

	async function toggleFullscreen() {
		if (!browser) return;
		try {
			const d = document,
				r = document.documentElement;
			const active = d.fullscreenElement || d.webkitFullscreenElement;
			active
				? (d.exitFullscreen || d.webkitExitFullscreen)?.call(d)
				: (r.requestFullscreen || r.webkitRequestFullscreen)?.call(r);
		} catch {
			// Fullscreen API unavailable or denied
		}
	}
	function syncFullscreen() {
		if (!browser) return;
		isAppFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
	}

	function getInitial(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}

	function onMobileMapTap() {
		showMobileUnitsSheet = false;
	}

	function mobileVehicleHasCoords(v) {
		const lat = v?.latitude ?? v?.lat;
		const lng = v?.longitude ?? v?.lng;
		return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
	}

	function onMobileVehicleRowClick(v) {
		selectUnitForTracking(v);
	}

	$: if ($activeTab !== prevMobileTab) {
		if ($activeTab !== 'seguimiento') showMobileUnitsSheet = false;
		prevMobileTab = $activeTab;
	}

	onMount(() => {
		let unsubscribe = () => {};

		(async () => {
			const sessionOk = await validateSessionWithApi();
			if (!sessionOk) {
				goto('/login');
				return;
			}

			isLoading = false;

			unsubscribe = user.subscribe((data) => {
				userData = data;
				if (!data) {
					goto('/login');
					return;
				}
				alertActions.syncZonesFromApi().catch((err) => {
					logger.error('No se pudieron sincronizar las geocercas:', err);
				});
				alertActions.syncAlertRulesFromApi().catch((err) => {
					logger.error('No se pudieron sincronizar las reglas de alerta:', err);
				});
				alertActions.syncAlarmEventsFromApi().catch((err) => {
					logger.error('No se pudo sincronizar el historial de alertas:', err);
				});
			});
		})();

		const unsubscribeTrails = vehicles.subscribe((list) => recordPositions(list));
		let offMedia = () => {};
		if (browser) {
			const mq = window.matchMedia('(min-width: 768px)');
			isMdUp = mq.matches;
			const onMedia = (/** @type {MediaQueryListEvent} */ e) => (isMdUp = e.matches);
			mq.addEventListener('change', onMedia);
			offMedia = () => mq.removeEventListener('change', onMedia);
			document.addEventListener('fullscreenchange', syncFullscreen);
			document.addEventListener('webkitfullscreenchange', syncFullscreen);
			document.addEventListener('click', handleBodyClick);
			document.addEventListener('keydown', handleGlobalKeydown);
		}
		return () => {
			unsubscribe();
			unsubscribeTrails();
			offMedia();
			fleetDayCtrl.stop();
			unitDayCtrl.stop();
			if (browser) {
				document.removeEventListener('fullscreenchange', syncFullscreen);
				document.removeEventListener('webkitfullscreenchange', syncFullscreen);
				document.removeEventListener('click', handleBodyClick);
				document.removeEventListener('keydown', handleGlobalKeydown);
			}
		};
	});

	// La marca del dominio (§7), resuelta en el servidor: sale bien desde el primer HTML.
	const marca = marcaOPorDefecto(page.data.brand);
	const logoUrl = logoDe(marca);
</script>

<svelte:head>
	<title>{marca.isDefault ? 'Dashboard — NEXUS | GeminisLabs' : `Dashboard — ${marca.name}`}</title>
	<meta
		name="description"
		content={`Panel de control ${marca.isDefault ? 'NEXUS' : marca.name}: mapa en vivo, informes, alertas y configuración de flota. Acceso restringido a usuarios autenticados.`}
	/>
	<meta name="robots" content="noindex, nofollow" />
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`Dashboard — ${marca.isDefault ? 'NEXUS' : marca.name}`} />
	<meta
		property="og:description"
		content={`Monitorización y gestión de flotas en tiempo real con ${marca.isDefault ? 'NEXUS' : marca.name}.`}
	/>
	{#if canonicalUrl}
		<meta property="og:url" content={canonicalUrl} />
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={`Dashboard — ${marca.isDefault ? 'NEXUS' : marca.name}`} />
	<meta name="twitter:description" content="Panel de control para flotas y unidades." />
</svelte:head>

<div
	class="relative h-screen w-screen overflow-hidden bg-slate-100 font-sans antialiased dark:bg-gray-900 [-webkit-font-smoothing:antialiased]"
>
	<a
		href="#main-dashboard"
		class="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
	>
		Saltar al contenido principal
	</a>

	<h1 class="sr-only">Dashboard {marca.isDefault ? 'NEXUS' : marca.name} — seguimiento de flota</h1>

	{#if isAdminWorkspace}
		<AdminWorkspace
			panel={isPanelView}
			onRetryFleetDay={() => fleetDayCtrl.refresh()}
			onSelectUnit={(id) => {
				workspaceActions.goTracking();
				selectUnitForTracking(id);
			}}
			onOpenReports={() => {
				pendingTrackingDrawer.set('informes');
				workspaceActions.goTracking();
			}}
		/>
	{:else}
		<aside
			class="fixed bottom-0 left-0 top-0 z-50 hidden w-[72px] flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#080b16]/[0.97] sm:flex"
			aria-label="Barra lateral de aplicación"
		>
			<header class="mb-1 flex w-10 shrink-0 flex-col items-center justify-center">
				<a
					href="/dashboard"
					class="flex h-[34px] w-10 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b16]"
				>
					<img
						src={logoUrl}
						alt={`${marca.name} — inicio`}
						class="h-full w-full object-contain {isPanelView
							? ''
							: 'drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]'}"
						width="40"
						height="34"
						decoding="async"
					/>
				</a>
			</header>

			<div
				class="my-2 h-px w-9 shrink-0 bg-slate-200 dark:bg-white/[0.08]"
				role="presentation"
			></div>

			{#if isPanelView && userData?.is_master}
				<WorkspaceRail />
				<div
					class="my-2 h-px w-9 shrink-0 bg-slate-200 dark:bg-white/[0.08]"
					role="presentation"
				></div>
			{/if}

			<nav class="flex w-full flex-1 flex-col items-center gap-1 px-0" aria-label="Accesos rápidos">
				<div class="relative w-full shrink-0 px-3" data-dashboard-user-menu>
					<button
						type="button"
						class={`${sidebarBtnBase} mx-auto w-12 ${
							showUserMenu
								? isPanelView
									? 'border-slate-900 bg-slate-900 text-white dark:border-white/15 dark:bg-white/[0.1] dark:text-white'
									: 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/35 dark:border-blue-400/50 dark:bg-blue-500/25 dark:text-blue-300'
								: 'border-transparent bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/[0.09] dark:hover:text-white/85'
						}`}
						aria-expanded={showUserMenu}
						aria-haspopup="true"
						aria-controls="dashboard-user-menu"
						id="dashboard-user-menu-button"
						aria-label="Cuenta y menú de usuario"
						title="Cuenta"
						on:click|stopPropagation={() => {
							showUserMenu = !showUserMenu;
							showThemeOptions = false;
							openDrawer = '';
						}}
					>
						{#if userData}
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue-600 to-brand-sky-500 text-[0.9375rem] font-bold text-white"
								aria-hidden="true"
							>
								{getInitial(userData.name)}
							</span>
						{:else}
							<Icon
								icon="mdi:account-circle"
								class="h-[22px] w-[22px] shrink-0"
								aria-hidden="true"
							/>
						{/if}
					</button>

					{#if showUserMenu}
						<div
							id="dashboard-user-menu"
							role="region"
							aria-labelledby="dashboard-user-menu-button"
							class="absolute left-[calc(100%+10px)] top-0 z-[60] w-[17.5rem] max-w-[calc(100vw-5rem)] origin-left rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-[0_20px_40px_rgb(15_23_42_/0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#080b16]/[0.98] dark:shadow-[0_20px_40px_rgb(0_0_0_/0.6)]"
							tabindex="-1"
							transition:scale={{ duration: 150, start: 0.95, opacity: 0.9, easing: cubicOut }}
						>
							{#if userData}
								<div class="flex items-start gap-3">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue-600 to-brand-sky-500 text-[1.1rem] font-bold text-white"
										aria-hidden="true"
									>
										{getInitial(userData.name)}
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5">
											<p
												id="dashboard-user-menu-name"
												class="m-0 min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-slate-900 dark:text-white"
											>
												{userData.name}
											</p>
											<button
												type="button"
												class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/55 dark:text-white/70
												{showThemeOptions
													? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:border-blue-500/45 dark:bg-blue-600/22 dark:text-blue-300 dark:shadow-[0_0_12px_rgba(37,99,235,0.25)]'
													: 'border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:border-white/[0.12] dark:bg-white/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.1] dark:hover:text-white'}"
												aria-label="Tema de apariencia"
												aria-expanded={showThemeOptions}
												title="Tema"
												on:click|stopPropagation={() => (showThemeOptions = !showThemeOptions)}
											>
												<Icon
													icon="mdi:cog-outline"
													class="h-[18px] w-[18px] shrink-0"
													aria-hidden="true"
												/>
											</button>
										</div>
										<p class="mt-0.5 truncate text-xs text-slate-500 dark:text-white/45">
											{userData.email}
										</p>
									</div>
								</div>
								<div class="my-3 h-px bg-slate-200 dark:bg-white/[0.08]" role="presentation"></div>
							{/if}
							{#if showThemeOptions}
								<div class="mb-3" role="group" aria-label="Selección de tema">
									<p
										class="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/40"
									>
										Apariencia
									</p>
									<div class="flex gap-2">
										<button
											type="button"
											class="flex flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all
											{$theme === 'dark'
												? 'border-blue-500/50 bg-blue-600/10'
												: 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]'}"
											on:click|stopPropagation={(e) => setThemeWithReveal('dark', e)}
											aria-pressed={$theme === 'dark'}
										>
											<span
												class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#07111f] text-indigo-300"
												aria-hidden="true"
											>
												<Icon icon="mdi:weather-night" class="h-4 w-4" />
											</span>
											<span class="min-w-0">
												<span
													class="block text-[12px] font-semibold {$theme === 'dark'
														? 'text-slate-900 dark:text-white'
														: 'text-slate-600 dark:text-white/55'}">Oscuro</span
												>
												<span class="block text-[10px] text-slate-500 dark:text-white/30"
													>Mapa nocturno</span
												>
											</span>
										</button>
										<button
											type="button"
											class="flex flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all
											{$theme === 'light'
												? 'border-sky-500/50 bg-sky-500/10'
												: 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]'}"
											on:click|stopPropagation={(e) => setThemeWithReveal('light', e)}
											aria-pressed={$theme === 'light'}
										>
											<span
												class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#dde4ef] text-amber-500"
												aria-hidden="true"
											>
												<Icon icon="mdi:white-balance-sunny" class="h-4 w-4" />
											</span>
											<span class="min-w-0">
												<span
													class="block text-[12px] font-semibold {$theme === 'light'
														? 'text-slate-900 dark:text-white'
														: 'text-slate-600 dark:text-white/55'}">Claro</span
												>
												<span class="block text-[10px] text-slate-500 dark:text-white/30"
													>Contraste diurno</span
												>
											</span>
										</button>
									</div>
								</div>
							{/if}
							{#if isMdUp}
								<div class="mb-3" role="group" aria-label="Vista">
									<p
										class="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/40"
									>
										Vista
									</p>
									<div class="flex gap-2">
										{#each [{ id: 'clasica', label: 'Clásica', hint: 'La de siempre' }, { id: 'panel', label: 'Panel', hint: 'Nueva, en prueba' }] as opt (opt.id)}
											{@const on = $trackingView.view === opt.id}
											<button
												type="button"
												class="flex flex-1 flex-col rounded-xl border px-2.5 py-2 text-left transition-colors {on
													? 'border-slate-900/40 bg-slate-900/[0.05] dark:border-white/30 dark:bg-white/[0.08]'
													: 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]'}"
												aria-pressed={on}
												on:click|stopPropagation={() => trackingView.setView(opt.id)}
											>
												<span class="text-[12px] font-semibold text-slate-900 dark:text-white"
													>{opt.label}</span
												>
												<span class="text-[10px] text-slate-500 dark:text-white/40">{opt.hint}</span
												>
											</button>
										{/each}
									</div>
								</div>
							{/if}
							<div class="mb-3">
								<OrganizationSwitcher compact />
							</div>
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 justify-center"
								on:click={async () => {
									await logoutSession();
									goto('/login');
								}}
							>
								<Icon icon="mdi:logout" class="h-4 w-4 shrink-0" aria-hidden="true" />
								Cerrar sesión
							</button>
						</div>
					{/if}
				</div>

				<div class="min-h-0 flex-1" aria-hidden="true"></div>

				<div class="flex flex-col items-center gap-1">
					{#each visibleConfigSidebarItems as item (item.id)}
						{@const itemActive =
							isPanelView && item.id === 'unidades'
								? fleetManaging
								: openDrawer === `configuracion:${item.id}`}
						<button
							type="button"
							class="{sidebarNavBtnClass(itemActive, isPanelView)} mx-auto"
							aria-label={item.title ?? `Abrir ${item.label}`}
							aria-pressed={itemActive}
							title={item.title ?? item.label}
							on:click={() => openConfigDrawer(item.id)}
						>
							{#if itemActive}
								<span
									class="absolute -left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full {isPanelView
										? 'bg-slate-900 dark:bg-white'
										: 'bg-blue-600 dark:bg-blue-400'}"
									aria-hidden="true"
								></span>
							{/if}
							<Icon
								icon={item.icon}
								class="h-[22px] w-[22px] shrink-0 {itemActive
									? isPanelView
										? 'text-white'
										: 'text-white dark:text-blue-300'
									: isPanelView
										? (RAIL_ICON_COLOR[item.id] ?? '')
										: ''}"
								aria-hidden="true"
							/>
						</button>
					{/each}
				</div>

				<div class="min-h-0 flex-1" aria-hidden="true"></div>

				{#if isPanelView}
					<div class="relative mb-1 w-full shrink-0 px-3" data-dashboard-panels-menu>
						<button
							type="button"
							class="{sidebarNavBtnClass(
								showPanelToggles,
								true
							)} mx-auto h-[42px] w-[42px] rounded-[10px]"
							aria-expanded={showPanelToggles}
							aria-haspopup="true"
							aria-controls="dashboard-panels-menu"
							aria-label="Paneles de la vista"
							title="Paneles"
							on:click|stopPropagation={() => {
								showPanelToggles = !showPanelToggles;
								showUserMenu = false;
							}}
						>
							<Icon
								icon="mdi:view-dashboard-outline"
								class="h-[22px] w-[22px] shrink-0"
								aria-hidden="true"
							/>
						</button>
						{#if showPanelToggles}
							<div
								id="dashboard-panels-menu"
								class="absolute bottom-0 left-[calc(100%+10px)] z-[60]"
								transition:scale={{ duration: 150, start: 0.95, opacity: 0.9, easing: cubicOut }}
							>
								<PanelToggles />
							</div>
						{/if}
					</div>
				{/if}

				{#if browser}
					<button
						type="button"
						class={`${sidebarBtnBase} mx-auto h-[42px] w-[42px] rounded-[10px] border-transparent bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/[0.09] dark:hover:text-white/85`}
						on:click={toggleFullscreen}
						aria-label={isAppFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
						title={isAppFullscreen ? 'Salir' : 'Pantalla completa'}
					>
						{#if isAppFullscreen}
							<Icon
								icon="mdi:fullscreen-exit"
								class="h-[22px] w-[22px] shrink-0"
								aria-hidden="true"
							/>
						{:else}
							<Icon icon="mdi:fullscreen" class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
						{/if}
					</button>
				{/if}
			</nav>
		</aside>

		<main
			id="main-dashboard"
			class="fixed bottom-0 left-0 right-0 top-0 sm:left-[72px]"
			aria-label="Mapa y paneles"
			bind:clientWidth={mainWidth}
		>
			<MapContainer
				bind:isLoading
				onMapTap={onMobileMapTap}
				controlsRightPx={mapControlsRight}
				look={isPanelView ? 'panel' : 'clasica'}
				hideAlertsBell={isPanelView && panels.alertas}
				onBellClick={isPanelView ? () => trackingView.setPanel('alertas', true) : null}
			/>

			{#if showTrackingWorkspaceSwitcher && !isPanelView}
				<div class="pointer-events-none absolute left-3 top-3 z-[40]">
					<div class="pointer-events-auto">
						<WorkspaceSwitcher compact />
					</div>
				</div>
			{/if}

			<TopDrawer
				open={isConfigDrawerOpen}
				title={configDrawerTitle}
				subtitle={configDrawerSubtitle}
				icon={configDrawerIcon}
				accentColor="#10b981"
				look={isPanelView ? 'panel' : 'clasica'}
				iconColorClass={RAIL_ICON_COLOR[activeConfigSection] ?? ''}
				sidebarWidth={SW}
				bodyPaddingClass="p-0"
				bodyScrollable={activeConfigSection === 'informes' || !isSideConfigPanel}
				placement={isSideConfigPanel ? 'side' : 'bottom'}
				sideWidthClass={isPanelView
					? activeConfigSection === 'informes'
						? 'w-[min(1080px,calc(100%-24px))]'
						: 'w-[min(560px,calc(100%-24px))]'
					: configSideWidthClass}
				passiveBackdrop={$mobileCrearZonaMapPassesPointer || $desktopZonePanelSubView !== 'zonas'}
				on:close={closeDrawer}
			>
				{#if activeConfigSection === 'alertas_zonas'}
					<AlertasZonasSidePanel
						on:close={closeDrawer}
						on:navigate={(e) => openConfigDrawer(e.detail.section)}
					/>
				{:else if activeConfigSection === 'informes'}
					<TabInformes />
				{:else}
					{#key activeConfigSection}
						<DrawerConfiguracion
							initialSection={activeConfigSection}
							showSectionSidebar={false}
							on:close={closeDrawer}
							on:navigate={(e) => openConfigDrawer(e.detail.section)}
						/>
					{/key}
				{/if}
			</TopDrawer>

			{#if $desktopZonePanelSubView !== 'zonas'}
				<div class="contents" data-look={isPanelView ? 'panel' : undefined}>
					<ZonasPanel variant="desktop" useDesktopOverlayStore={true} />
				</div>
			{/if}

			{#if showFleetReopen}
				<button
					type="button"
					class="nx-reopen absolute left-3 top-3 z-[60] flex h-10 items-center gap-1.5 rounded-full pl-3 pr-3.5 text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
					on:click={() => trackingView.setPanel('flota', true)}
					aria-label="Mostrar la columna de flota"
					title="Mostrar la columna de flota"
				>
					<Icon icon="mdi:chevron-double-right" class="h-4 w-4" aria-hidden="true" />
					Flota
				</button>
			{/if}

			{#if showLeftColumn}
				<div
					class="pointer-events-none absolute bottom-9 left-3 top-3 z-[60] flex flex-col"
					style="width: {leftColumnWidth}px"
				>
					<div
						class="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					>
						{#if fleetManaging}
							<FleetManage on:done={() => (fleetManaging = false)} />
						{:else if $activeUnit}
							<!-- El detalle de la unidad ocupa la columna; «cerrar» vuelve a la flota -->
							<div class="nx-glass flex min-h-0 flex-col overflow-hidden rounded-[18px]">
								<TrackingSubPanel
									unit={$activeUnit}
									units={$vehicles}
									panelView={trackingPanelView}
									onPanelViewChange={onTrackingPanelViewChange}
									onBackToUnitInfo={backToUnitInfoPanel}
									onClose={closeActiveUnitPanel}
									onSelectUnit={selectUnitForTracking}
									onCenterUnit={centerOnActiveUnit}
								/>
							</div>
						{:else}
							<FleetColumn
								onSelectUnit={selectUnitForTracking}
								onManageUnits={() => (fleetManaging = true)}
								onOpenReports={hasVehicles ? () => openConfigDrawer('informes') : null}
								onRetry={() => fleetDayCtrl.refresh()}
								onCollapse={() => trackingView.setPanel('flota', false)}
								showUtilization={$vehicles.length !== 1}
							/>
						{/if}
					</div>
				</div>
			{/if}

			{#if showAlertsColumn}
				<div
					class="pointer-events-none absolute bottom-24 right-3 top-3 z-[60] flex flex-col"
					style="width: {ALERTS_COL_W}px"
				>
					<div class="pointer-events-auto flex max-h-full min-h-0 flex-col">
						<AlertsColumn
							onSelectUnit={selectUnitForTracking}
							onOpenRules={() => openConfigDrawer('alertas_zonas')}
							onCollapse={() => trackingView.setPanel('alertas', false)}
							unitIds={visibleUnitIds}
						/>
					</div>
				</div>
			{/if}

			{#if showFleetDayStrip}
				<div
					class="pointer-events-none absolute bottom-9 z-[55] flex"
					style="left: {leftEdge}px; right: {stripRight}px"
				>
					<div class="pointer-events-auto w-full">
						{#if unitModeUnit}
							<UnitDayStrip
								unitName={unitModeUnit.name}
								compact={stripCompact}
								onRetry={() => unitDayCtrl.refresh()}
								onSelectTrip={showUnitTrip}
								onClearTrip={clearUnitTrip}
								activeTripId={unitTripId}
							/>
						{:else}
							<FleetDayStrip
								compact={stripCompact}
								onRetry={() => fleetDayCtrl.refresh()}
								onSelectUnit={selectUnitForTracking}
								onOpenReports={() => openConfigDrawer('informes')}
								activeUnitId={$activeUnit?.id ?? null}
							/>
						{/if}
					</div>
				</div>
			{/if}

			<!-- PR-04: TrackingContextPanel flotante — izquierda para no tapar zoom/Street View -->
			{#if $activeUnit && !isConfigDrawerOpen && !$showH3Grid && !isPanelView}
				<div
					class="pointer-events-none fixed bottom-24 left-3 z-[100] hidden w-[340px] md:left-[calc(72px+0.75rem)] md:block"
				>
					<div
						class="pointer-events-auto flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 shadow-xl dark:border-transparent dark:shadow-2xl"
					>
						<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#0c1829]">
							<TrackingSubPanel
								unit={$activeUnit}
								units={$vehicles}
								panelView={trackingPanelView}
								onPanelViewChange={onTrackingPanelViewChange}
								onBackToUnitInfo={backToUnitInfoPanel}
								onClose={closeActiveUnitPanel}
								onSelectUnit={selectUnitForTracking}
								onCenterUnit={centerOnActiveUnit}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if $zoneUiToast}
				<div
					class="pointer-events-none fixed left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top,0px)+4.5rem))] z-[200] flex w-full max-w-[min(92vw,22rem)] -translate-x-1/2 justify-center px-4 sm:left-[calc(50%+36px)]"
					role="status"
				>
					<p
						class="w-full rounded-2xl border border-brand-500/35 bg-slate-900/92 px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-md dark:border-brand-400/30 dark:bg-black/88"
					>
						{$zoneUiToast}
					</p>
				</div>
			{/if}

			{#if $activeTab === 'seguimiento' && (!$activeUnit || showMobileUnitsSheet)}
				<div
					class="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px)+2px)] z-[220] flex sm:hidden"
					aria-label="Panel de unidades"
				>
					<div class="pointer-events-auto relative w-full">
						{#if !showMobileUnitsSheet}
							<button
								type="button"
								class="mx-auto mb-1 flex w-20 items-center justify-center rounded-full border border-brand-cyan-500/35 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-sm dark:border-brand-cyan-300/30 dark:bg-slate-900/92 dark:shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
								on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
								aria-label="Mostrar panel de unidades"
							>
								<div
									class="h-1 w-10 rounded-full bg-brand-cyan-500/70 dark:bg-brand-cyan-200/80"
									aria-hidden="true"
								></div>
							</button>
							<button
								type="button"
								class="mx-auto mb-1 block rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-md backdrop-blur-sm dark:border-white/12 dark:bg-slate-900/90 dark:text-white/75 dark:shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
								on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
								aria-label="Mostrar panel de unidades"
							>
								Selecciona una unidad para ver más posiciones
							</button>
						{/if}
						<UnitsPickerSheet
							open={showMobileUnitsSheet}
							onSelect={onMobileVehicleRowClick}
							onClose={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
						/>
					</div>
				</div>
			{/if}

			{#if $activeTab === 'alertas'}
				<div
					class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-transparent sm:hidden"
					class:pointer-events-none={$mobileCrearZonaMapPassesPointer}
					role="region"
					aria-label="Alertas"
					in:viewEnter
					out:softFade
				>
					<TabAlertas />
				</div>
			{/if}
			{#if $activeTab === 'informes'}
				<div
					class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-black sm:hidden"
					role="region"
					aria-label="Informes"
					in:viewEnter
					out:softFade
				>
					<TabInformes />
				</div>
			{/if}
			{#if $activeTab === 'ajustes'}
				<div
					class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-slate-50 dark:bg-black sm:hidden"
					role="region"
					aria-label="Ajustes"
					in:viewEnter
					out:softFade
				>
					<TabAjustes />
				</div>
			{/if}
		</main>

		{#if $activeTab === 'seguimiento' && $activeUnit && !showMobileUnitsSheet && !$showH3Grid}
			<div
				class="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+8px)] left-2 right-2 z-[55] sm:hidden"
				transition:fly={{ y: 20, duration: 200, easing: cubicOut }}
			>
				<div
					class="flex max-h-[min(72vh,calc(100dvh-4.75rem-env(safe-area-inset-bottom,0px)))] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_-4px_20px_rgba(15,23,42,0.12)] dark:border-transparent dark:bg-[#0c1829] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
				>
					<TrackingSubPanel
						unit={$activeUnit}
						units={$vehicles}
						panelView={trackingPanelView}
						onPanelViewChange={onTrackingPanelViewChange}
						onBackToUnitInfo={backToUnitInfoPanel}
						onClose={closeActiveUnitPanel}
						onCenterUnit={centerOnActiveUnit}
						onSelectUnit={selectUnitForTracking}
					/>
				</div>
			</div>
		{/if}

		<div class="sm:hidden" aria-hidden="true">
			<BottomTabBar />
		</div>
	{/if}
</div>
