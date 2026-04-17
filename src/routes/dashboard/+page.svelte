<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { scale, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { user } from '$lib/stores/auth.js';
	import { activeTab } from '$lib/stores/navigationStore.js';
	import { vehicles, vehicleActions, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { getStatusText, getStatusPillClass } from '$lib/utils/vehicleUtils.js';
	import logoUrl from '$lib/assets/logo.png';
	import Icon from '@iconify/svelte';

	import MapContainer from '$lib/components/MapContainer.svelte';
	import GeofenceDraftModal from '$lib/components/GeofenceDraftModal.svelte';
	import TopDrawer from '$lib/components/TopDrawer.svelte';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';

	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import TabInformes from '$lib/components/TabInformes.svelte';
	import TabAlertas from '$lib/components/TabAlertas.svelte';
	import TabAjustes from '$lib/components/TabAjustes.svelte';

	let isLoading = true;
	let userData = null;
	let isAppFullscreen = false;
	let showUserMenu = false;
	let showMobileUnitsSheet = true;
	let prevMobileTab = 'seguimiento';

	let openDrawer = ''; // '' | 'informes' | 'configuracion'

	const SW = 72;

	const sidebarBtnBase =
		'relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border transition-[background-color,border-color,color,box-shadow] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b16]';
	const sidebarBtnIdle =
		'border-transparent bg-white/[0.04] text-white/45 hover:border-white/10 hover:bg-white/[0.09] hover:text-white/85';
	const sidebarBtnDrawerActive =
		'border-blue-500/45 bg-blue-600/[0.22] text-blue-400 shadow-[0_0_16px_rgba(37,99,235,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]';
	const sidebarBtnUserOpen =
		'border-blue-500/30 bg-blue-600/15 text-blue-300 hover:border-blue-500/40 hover:bg-blue-600/20';

	$: canonicalUrl =
		$page?.url?.origin && $page?.url?.pathname ? `${$page.url.origin}${$page.url.pathname}` : '';

	function toggleDrawer(name) {
		showUserMenu = false;
		openDrawer = openDrawer === name ? '' : name;
	}
	function closeDrawer() {
		openDrawer = '';
	}

	function handleBodyClick(e) {
		if (!e.target.closest('[data-dashboard-user-menu]')) showUserMenu = false;
	}

	function handleGlobalKeydown(e) {
		if (e.key === 'Escape') {
			showUserMenu = false;
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

	$: if ($activeTab !== prevMobileTab) {
		showMobileUnitsSheet = $activeTab === 'seguimiento';
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
		class="fixed bottom-0 left-0 top-0 z-50 hidden w-[72px] flex-col items-center gap-1 border-r border-white/[0.07] bg-[#080b16]/[0.97] py-4 backdrop-blur-xl sm:flex"
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
						class="absolute left-[calc(100%+10px)] top-0 z-[60] w-60 origin-left rounded-[14px] border border-white/10 bg-[#080b16]/[0.98] p-3.5 shadow-[0_20px_40px_rgb(0_0_0_/0.6)] backdrop-blur-xl"
						tabindex="-1"
						transition:scale={{ duration: 150, start: 0.95, opacity: 0.9, easing: cubicOut }}
					>
						{#if userData}
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-[1.1rem] font-bold text-white"
									aria-hidden="true"
								>
									{getInitial(userData.name)}
								</div>
								<div class="min-w-0">
									<p class="m-0 truncate text-[0.9375rem] font-semibold text-white">
										{userData.name}
									</p>
									<p class="mt-0.5 truncate text-xs text-white/45">{userData.email}</p>
								</div>
							</div>
							<div class="my-3 h-px bg-white/[0.08]" role="presentation"></div>
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

				<button
					type="button"
					class={`${sidebarBtnBase} mx-auto ${openDrawer === 'configuracion' ? sidebarBtnDrawerActive : sidebarBtnIdle}`}
					aria-label="Abrir configuración"
					aria-pressed={openDrawer === 'configuracion'}
					title="Configuración"
					on:click={() => toggleDrawer('configuracion')}
				>
					<Icon icon="mdi:cog-outline" class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
				</button>
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
			on:close={closeDrawer}
		>
			<TabInformes />
		</TopDrawer>

		<TopDrawer
			open={openDrawer === 'configuracion'}
			title="Configuración"
			icon="mdi:cog-outline"
			accentColor="#10b981"
			sidebarWidth={SW}
			on:close={closeDrawer}
		>
			<DrawerConfiguracion onClose={closeDrawer} />
		</TopDrawer>

		{#if $activeTab === 'seguimiento'}
			<div
				class="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px)+2px)] z-[220] flex sm:hidden"
				aria-label="Panel de unidades"
			>
				<div class="pointer-events-auto relative w-full">
					{#if !showMobileUnitsSheet}
						<button
							type="button"
							class="mx-auto mb-1 flex w-20 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-900/92 px-2 py-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-sm"
							on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
							aria-label="Mostrar panel de unidades"
						>
							<div class="h-1 w-10 rounded-full bg-cyan-200/80" aria-hidden="true"></div>
						</button>
						<button
							type="button"
							class="mx-auto mb-1 block rounded-full border border-white/12 bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white/75 shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur-sm"
							on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
							aria-label="Mostrar panel de unidades"
						>
							Selecciona una unidad para ver más posiciones
						</button>
					{/if}
					<div
						class="absolute inset-x-0 bottom-full mb-1 rounded-t-[24px] border border-white/10 border-b-white/[0.04] bg-[linear-gradient(180deg,rgba(15,23,42,0.97)_0%,rgba(2,6,23,0.97)_100%)] shadow-[0_-18px_46px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-transform duration-300 ease-out"
						style:transform={showMobileUnitsSheet
							? 'translateY(0)'
							: 'translateY(calc(100% + 10px))'}
					>
						<button
							type="button"
							class="block w-full cursor-pointer border-0 border-b border-white/[0.07] bg-transparent px-4 pb-2 pt-3 text-center"
							on:click={() => (showMobileUnitsSheet = !showMobileUnitsSheet)}
							aria-label={showMobileUnitsSheet
								? 'Ocultar panel de unidades'
								: 'Mostrar panel de unidades'}
						>
							<p class="m-0 text-center text-[12px] font-semibold text-white/78">
								Selecciona una unidad para ver más posiciones
							</p>
						</button>
						<div class="flex items-center justify-between px-4 pt-2">
							<div>
								<p class="m-0 text-sm font-semibold text-white">Seguimiento de unidades</p>
								<p class="m-0 text-[11px] text-white/40">{$vehicles.length} registradas</p>
							</div>
							<button
								type="button"
								class="rounded-md border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70"
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
								<div class="flex h-40 flex-col items-center justify-center gap-2 text-white/35">
									<Icon icon="mdi:car-off" width={28} aria-hidden="true" />
									<p class="m-0 text-xs">No hay unidades disponibles</p>
								</div>
							{:else}
								<ul class="m-0 list-none space-y-2 p-0" aria-label="Lista de unidades">
									{#each $vehicles as v (v.id)}
										<li>
											<article
												class="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3"
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
													<p class="m-0 truncate text-[13px] font-semibold text-white">{v.name}</p>
													<p class="m-0 mt-0.5 truncate text-[11px] text-white/45">
														{v.driver || 'Sin conductor'}
														{#if v.speed !== undefined}
															· {v.speed} km/h
														{/if}
													</p>
													{#if v.lastUpdateFormatted}
														<p class="m-0 mt-0.5 text-[10px] text-white/30">
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
											</article>
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
				class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-[#080d1a] sm:hidden"
				role="region"
				aria-label="Informes"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabInformes />
			</div>
		{/if}
		{#if $activeTab === 'alertas'}
			<div
				class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-black sm:hidden"
				role="region"
				aria-label="Alertas"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabAlertas />
			</div>
		{/if}
		{#if $activeTab === 'ajustes'}
			<div
				class="fixed inset-0 z-[52] flex max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex-col overflow-hidden bg-black sm:hidden"
				role="region"
				aria-label="Ajustes"
				transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
			>
				<TabAjustes />
			</div>
		{/if}

		<GeofenceDraftModal />
	</main>

	<div class="sm:hidden" aria-hidden="true">
		<BottomTabBar />
	</div>
</div>
