<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { scale, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { user } from '$lib/stores/auth.js';
	import { activeTab } from '$lib/stores/navigationStore.js';
	import {
		h3Actions,
		mobileCrearZonaMapPassesPointer,
		desktopZonePanelSubView,
		zoneUiToast
	} from '$lib/stores/h3Store.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { vehicles, vehicleActions, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { getStatusText, getStatusPillClass } from '$lib/utils/vehicleUtils.js';
	import { mapService } from '$lib/services/mapService.js';
	import { alertActions } from '$lib/stores/alertStore.js';
	import logoUrl from '$lib/assets/logo.png';
	import Icon from '@iconify/svelte';

	import MapContainer from '$lib/components/MapContainer.svelte';
	import TopDrawer from '$lib/components/TopDrawer.svelte';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';

	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import TabInformes from '$lib/components/TabInformes.svelte';
	import TabAlertas from '$lib/components/TabAlertas.svelte';
	import TabAjustes from '$lib/components/TabAjustes.svelte';
	import ZonasPanel from '$lib/components/ZonasPanel.svelte';

	let isLoading = true;
	let userData = null;
	let isAppFullscreen = false;
	let showUserMenu = false;
	let showMobileUnitsSheet = false;
	let prevMobileTab = 'seguimiento';

	let openDrawer = ''; // '' | 'informes' | 'configuracion'

	const SW = 72;

	const sidebarBtnBase =
		'relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border transition-[background-color,border-color,color,box-shadow] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b16]';
	const sidebarBtnIdle =
		'border-transparent bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-800 dark:bg-white/[0.04] dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/[0.09] dark:hover:text-white/85';
	const sidebarBtnDrawerActive =
		'border-blue-500/40 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/45 dark:bg-blue-600/[0.22] dark:text-blue-400 dark:shadow-[0_0_16px_rgba(37,99,235,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]';
	const sidebarBtnUserOpen =
		'border-blue-400/40 bg-blue-50 text-blue-700 hover:border-blue-500/50 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-600/15 dark:text-blue-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-600/20';
	const configSidebarItems = [
		{ id: 'unidades', label: 'Unidades', icon: 'mdi:car-side' },
		{ id: 'zonas', label: 'Zonas', icon: 'mdi:hexagon-multiple-outline' },
		{ id: 'gestionar_alertas', label: 'Gestionar', icon: 'mdi:format-list-bulleted' },
		{
			id: 'alertas',
			label: 'Historial',
			icon: 'mdi:bell-badge-outline',
			title: 'Historial de alarmas'
		}
	];

	$: canonicalUrl =
		$page?.url?.origin && $page?.url?.pathname ? `${$page.url.origin}${$page.url.pathname}` : '';

	function toggleDrawer(name) {
		showUserMenu = false;
		openDrawer = openDrawer === name ? '' : name;
	}
	function closeDrawer() {
		openDrawer = '';
	}

	function getConfigDrawerId(section) {
		return `configuracion:${section}`;
	}

	function openConfigDrawer(section) {
		const drawerId = getConfigDrawerId(section);
		showUserMenu = false;
		openDrawer = openDrawer === drawerId ? '' : drawerId;
	}

	function isConfigDrawerActive(section) {
		return openDrawer === getConfigDrawerId(section);
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

	function handleBodyClick(e) {
		if (!e.target.closest('[data-dashboard-user-menu]')) showUserMenu = false;
	}

	function handleGlobalKeydown(e) {
		if (e.key === 'Escape') {
			showUserMenu = false;
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
		} catch {}
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

	async function openMobileUnitsSheet() {
		if ($vehicles.length === 0) await vehicleActions.loadVehicles();
		showMobileUnitsSheet = true;
	}

	function closeMobileUnitsSheet() {
		showMobileUnitsSheet = false;
	}

	function mobileVehicleHasCoords(v) {
		const lat = v?.latitude ?? v?.lat;
		const lng = v?.longitude ?? v?.lng;
		return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
	}

	function onMobileVehicleRowClick(v) {
		if (!mobileVehicleHasCoords(v)) return;
		mapService.centerOnVehicle(v);
		closeMobileUnitsSheet();
	}

	$: if ($activeTab !== prevMobileTab) {
		if ($activeTab !== 'seguimiento') showMobileUnitsSheet = false;
		prevMobileTab = $activeTab;
	}

	onMount(() => {
		user.init();
		const unsubscribe = user.subscribe((data) => {
			userData = data;
			if (!data) {
				goto('/login');
				return;
			}
			alertActions.syncZonesFromApi().catch((err) => {
				console.error('No se pudieron sincronizar las geocercas:', err);
			});
			alertActions.syncAlertRulesFromApi().catch((err) => {
				console.error('No se pudieron sincronizar las reglas de alerta:', err);
			});
			alertActions.syncAlarmEventsFromApi().catch((err) => {
				console.error('No se pudo sincronizar el historial de alertas:', err);
			});
		});
		if (browser) {
			document.addEventListener('fullscreenchange', syncFullscreen);
			document.addEventListener('webkitfullscreenchange', syncFullscreen);
			document.addEventListener('click', handleBodyClick);
			document.addEventListener('keydown', handleGlobalKeydown);
		}
		return () => {
			unsubscribe();
			if (browser) {
				document.removeEventListener('fullscreenchange', syncFullscreen);
				document.removeEventListener('webkitfullscreenchange', syncFullscreen);
				document.removeEventListener('click', handleBodyClick);
				document.removeEventListener('keydown', handleGlobalKeydown);
			}
		};
	});
</script>

<svelte:head>
	<title>Dashboard — NEXUS | GeminisLabs</title>
	<meta
		name="description"
		content="Panel de control NEXUS: mapa en vivo, informes, alertas y configuración de flota. Acceso restringido a usuarios autenticados."
	/>
	<meta name="robots" content="noindex, nofollow" />
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Dashboard — NEXUS" />
	<meta
		property="og:description"
		content="Monitorización y gestión de flotas en tiempo real con NEXUS."
	/>
	{#if canonicalUrl}
		<meta property="og:url" content={canonicalUrl} />
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Dashboard — NEXUS" />
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

	<h1 class="sr-only">Dashboard NEXUS — seguimiento de flota</h1>

	<aside
		class="fixed bottom-0 left-0 top-0 z-50 hidden w-[72px] flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#080b16]/[0.97] sm:flex"
		aria-label="Barra lateral de aplicación"
	>
		<header class="mb-1 flex w-10 shrink-0 flex-col items-center justify-center">
			<a
				href="/dashboard"
				class="flex h-[34px] w-10 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b16]"
			>
				<img
					src={logoUrl}
					alt="NEXUS — inicio"
					class="h-full w-full object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]"
					width="40"
					height="34"
					decoding="async"
				/>
			</a>
		</header>

		<div class="my-2 h-px w-9 shrink-0 bg-white/[0.08]" role="presentation"></div>

		<nav class="flex w-full flex-1 flex-col items-center gap-1 px-0" aria-label="Accesos rápidos">
			<div class="relative w-full shrink-0 px-3" data-dashboard-user-menu>
				<button
					type="button"
					class={`${sidebarBtnBase} mx-auto w-12 ${showUserMenu ? sidebarBtnUserOpen : sidebarBtnIdle}`}
					aria-expanded={showUserMenu}
					aria-haspopup="true"
					aria-controls="dashboard-user-menu"
					id="dashboard-user-menu-button"
					aria-label="Cuenta y menú de usuario"
					title="Cuenta"
					on:click|stopPropagation={() => {
						showUserMenu = !showUserMenu;
						openDrawer = '';
					}}
				>
					{#if userData}
						<span
							class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-[0.9375rem] font-bold text-white"
							aria-hidden="true"
						>
							{getInitial(userData.name)}
						</span>
					{:else}
						<Icon icon="mdi:account-circle" class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
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
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-[1.1rem] font-bold text-white"
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
												{isConfigDrawerOpen && activeConfigSection === 'apariencia'
												? 'border-blue-500/45 bg-blue-600/22 text-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.25)]'
												: 'border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:border-white/[0.12] dark:bg-white/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.1] dark:hover:text-white'}"
											aria-label="Configuración"
											title="Configuración"
											on:click|stopPropagation={() => openConfigDrawer('apariencia')}
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
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 justify-center"
							on:click={() => {
								user.logout?.();
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
				<button
					type="button"
					class={`${sidebarBtnBase} mx-auto ${openDrawer === 'informes' ? sidebarBtnDrawerActive : sidebarBtnIdle}`}
					aria-label="Abrir informes"
					aria-pressed={openDrawer === 'informes'}
					title="Informes"
					on:click={() => toggleDrawer('informes')}
				>
					<Icon
						icon="mdi:file-chart-outline"
						class="h-[22px] w-[22px] shrink-0"
						aria-hidden="true"
					/>
				</button>

				{#each configSidebarItems as item}
					<button
						type="button"
						class={`${sidebarBtnBase} mx-auto ${isConfigDrawerActive(item.id) ? sidebarBtnDrawerActive : sidebarBtnIdle}`}
						aria-label={item.title ?? `Abrir ${item.label}`}
						aria-pressed={isConfigDrawerActive(item.id)}
						title={item.title ?? item.label}
						on:click={() => openConfigDrawer(item.id)}
					>
						<Icon icon={item.icon} class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
					</button>
				{/each}
			</div>

			<div class="min-h-0 flex-1" aria-hidden="true"></div>

			{#if browser}
				<button
					type="button"
					class={`${sidebarBtnBase} mx-auto h-[42px] w-[42px] rounded-[10px] ${sidebarBtnIdle}`}
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
	>
		<MapContainer bind:isLoading onMapTap={onMobileMapTap} />

		<TopDrawer
			open={openDrawer === 'informes'}
			title="Informes"
			icon="mdi:file-chart-outline"
			accentColor="#8b5cf6"
			sidebarWidth={SW}
			headerPaddingClass="px-3 sm:px-4"
			bodyPaddingClass="py-4 px-0"
			on:close={closeDrawer}
		>
			<TabInformes />
		</TopDrawer>

		<TopDrawer
			open={isConfigDrawerOpen}
			title={configDrawerTitle}
			icon="mdi:cog-outline"
			accentColor="#10b981"
			sidebarWidth={SW}
			passiveBackdrop={$mobileCrearZonaMapPassesPointer || $desktopZonePanelSubView !== 'zonas'}
			on:close={closeDrawer}
		>
			{#key activeConfigSection}
				<DrawerConfiguracion
					initialSection={activeConfigSection}
					showSectionSidebar={false}
					on:close={closeDrawer}
					on:navigate={(e) => openConfigDrawer(e.detail.section)}
				/>
			{/key}
		</TopDrawer>

		{#if $desktopZonePanelSubView !== 'zonas'}
			<ZonasPanel variant="desktop" useDesktopOverlayStore={true} />
		{/if}

		{#if $zoneUiToast}
			<div
				class="pointer-events-none fixed left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top,0px)+4.5rem))] z-[200] flex w-full max-w-[min(92vw,22rem)] -translate-x-1/2 justify-center px-4 sm:left-[calc(50%+36px)]"
				role="status"
			>
				<p
					class="w-full rounded-2xl border border-emerald-500/35 bg-slate-900/92 px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-md dark:border-emerald-400/30 dark:bg-black/88"
				>
					{$zoneUiToast}
				</p>
			</div>
		{/if}

		{#if $activeTab === 'seguimiento'}
			<div
				class="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px)+2px)] z-[220] flex sm:hidden"
				aria-label="Panel de unidades"
			>
				<div class="pointer-events-auto relative w-full">
					{#if !showMobileUnitsSheet}
						<button
							type="button"
							class="mx-auto mb-1 flex w-20 items-center justify-center rounded-full border border-cyan-500/35 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-sm dark:border-cyan-300/30 dark:bg-slate-900/92 dark:shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
							on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
							aria-label="Mostrar panel de unidades"
						>
							<div
								class="h-1 w-10 rounded-full bg-cyan-500/70 dark:bg-cyan-200/80"
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
					<div
						class="absolute inset-x-0 bottom-full mb-1 rounded-t-[24px] border border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 ease-out dark:border-white/10 dark:border-b-white/[0.04] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.97)_0%,rgba(2,6,23,0.97)_100%)] dark:shadow-[0_-18px_46px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.08)]"
						style:transform={showMobileUnitsSheet
							? 'translateY(0)'
							: 'translateY(calc(100% + 10px))'}
					>
						<button
							type="button"
							class="block w-full cursor-pointer border-0 border-b border-slate-200 bg-transparent px-4 pb-2 pt-3 text-center dark:border-white/[0.07]"
							on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
							aria-label={showMobileUnitsSheet
								? 'Ocultar panel de unidades'
								: 'Mostrar panel de unidades'}
						>
							<p
								class="m-0 text-center text-[12px] font-semibold text-slate-700 dark:text-white/78"
							>
								Selecciona una unidad para ver más posiciones
							</p>
						</button>
						<div class="flex items-center justify-between px-4 pt-2">
							<div>
								<p class="m-0 text-sm font-semibold text-slate-900 dark:text-white">
									Seguimiento de unidades
								</p>
								<p class="m-0 text-[11px] text-slate-500 dark:text-white/40">
									{$vehicles.length} registradas
								</p>
							</div>
							<button
								type="button"
								class="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/12 dark:bg-white/5 dark:text-white/70"
								on:click={closeMobileUnitsSheet}
							>
								Ocultar
							</button>
						</div>
						<div class="max-h-[50vh] overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
							{#if $loadingVehicles}
								<div class="flex h-40 items-center justify-center" role="status" aria-live="polite">
									<div
										class="h-8 w-8 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-500"
										aria-hidden="true"
									></div>
								</div>
							{:else if $vehicles.length === 0}
								<div
									class="flex h-40 flex-col items-center justify-center gap-2 text-slate-500 dark:text-white/35"
								>
									<Icon icon="mdi:car-off" width={28} aria-hidden="true" />
									<p class="m-0 text-xs">No hay unidades disponibles</p>
								</div>
							{:else}
								<ul class="m-0 list-none space-y-2 p-0" aria-label="Lista de unidades">
									{#each $vehicles as v (v.id)}
										<li>
											<button
												type="button"
												class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left transition-colors hover:border-cyan-400/50 hover:bg-cyan-50/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400/45 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-cyan-400/30 dark:hover:bg-white/[0.07]"
												disabled={!mobileVehicleHasCoords(v)}
												on:click={() => onMobileVehicleRowClick(v)}
												aria-label="Ver {v.name} en el mapa"
											>
												<div
													class="h-2.5 w-2.5 shrink-0 rounded-full {v.status === 'active'
														? 'bg-emerald-400'
														: v.status === 'maintenance'
															? 'bg-amber-400'
															: 'bg-red-400'}"
													aria-hidden="true"
												></div>
												<div class="min-w-0 flex-1">
													<p
														class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white"
													>
														{v.name}
													</p>
													<p
														class="m-0 mt-0.5 truncate text-[11px] text-slate-600 dark:text-white/45"
													>
														{v.driver || 'Sin conductor'}
														{#if v.speed !== undefined}
															· {v.speed} km/h
														{/if}
													</p>
													{#if v.lastUpdateFormatted}
														<p class="m-0 mt-0.5 text-[10px] text-slate-500 dark:text-white/30">
															{v.lastUpdateFormatted}
														</p>
													{/if}
												</div>
												<span
													class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold {getStatusPillClass(
														v.status
													)}"
												>
													{getStatusText(v.status)}
												</span>
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<div
							class="h-2 shrink-0 opacity-90"
							aria-hidden="true"
							style="background: linear-gradient(90deg, transparent, rgb(16, 185, 129), rgb(14, 165, 233), transparent);"
						></div>
					</div>
				</div>
			</div>
		{/if}

		{#if $activeTab === 'informes'}
			<div
				class="fixed inset-0 z-[52] max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50 touch-pan-y dark:bg-[#080d1a] sm:hidden"
				role="region"
				aria-label="Informes"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabInformes />
			</div>
		{/if}
		{#if $activeTab === 'alertas'}
			<div
				class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-transparent sm:hidden"
				class:pointer-events-none={$mobileCrearZonaMapPassesPointer}
				role="region"
				aria-label="Alertas"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabAlertas />
			</div>
		{/if}
		{#if $activeTab === 'ajustes'}
			<div
				class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-slate-50 dark:bg-black sm:hidden"
				role="region"
				aria-label="Ajustes"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabAjustes />
			</div>
		{/if}
	</main>

	<div class="sm:hidden" aria-hidden="true">
		<BottomTabBar />
	</div>
</div>
