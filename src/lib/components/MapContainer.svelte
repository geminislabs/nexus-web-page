<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { mapService } from '$lib/services/mapService.js';
	import {
		extraStreamDeviceIds,
		isPositionStreamEnabled,
		startVehiclePositionStream
	} from '$lib/services/vehiclePositionStream.js';
	import { vehicles, vehicleActions } from '$lib/stores/vehicleStore.js';
	import {
		showH3Grid,
		h3Resolution,
		selectedH3Cells,
		h3Actions,
		mobileZoneMapActive,
		h3EraserMode
	} from '$lib/stores/h3Store.js';
	import { h3GridOverlayService } from '$lib/services/h3GridOverlayService.js';
	import { geofenceService } from '$lib/services/geofenceService.js';
	import { alerts, alarmEvents, unreadAlarmCount, alertActions } from '$lib/stores/alertStore.js';
	import {
		alerts,
		alarmEvents,
		unreadAlarmCount,
		alertActions
	} from '$lib/stores/alertStore.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { get } from 'svelte/store';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';

	export let isLoading = true;
	export let onMapTap = () => {};
	export let onMapTap = () => {};

	let mapElement;
	let map;
	let showAlertsPanel = false;

	function toggleAlertsPanel() {
		if (isLoading) return;
		showAlertsPanel = !showAlertsPanel;
		if (showAlertsPanel && get(unreadAlarmCount) > 0) {
			alertActions.markAllRead();
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			if (showAlertsPanel) {
				showAlertsPanel = false;
			}
		}
	}

	function popLastH3Selection() {
		if ($selectedH3Cells.length > 0) h3Actions.popLastSelection();
	}

	function removeAlertRule(id) {
		alertActions.deleteAlert(id);
	}

	function removeAlarmEvent(id) {
		alertActions.deleteAlarmEvent(id);
	}

	$: notificationsBadge = $alerts.length + $alarmEvents.length;

	const MOBILE_MQ = '(max-width: 639px)';

	function syncMapNavigationControls() {
		if (!browser || !mapService.map) return;
		mapService.setNavigationControlsCompact(window.matchMedia(MOBILE_MQ).matches);
	}

	onMount(async () => {
		try {
			map = await mapService.initialize(mapElement);
			isLoading = false;
			syncMapNavigationControls();

			const mql = window.matchMedia(MOBILE_MQ);
			const onViewportNav = () => syncMapNavigationControls();
			mql.addEventListener('change', onViewportNav);

			const mapTapListener = map.addListener('click', () => {
				onMapTap?.();
			});
			h3GridOverlayService.attachMap(mapService.map, mapService.google);
			h3GridOverlayService.setOnCellSelect((h3Index) => {
				if (get(mobileZoneMapActive)) {
					if (get(h3EraserMode)) {
						h3Actions.removeCellInZoneEditor(h3Index);
					} else {
						h3Actions.tryAddContiguousCell(h3Index);
					}
				} else {
					h3Actions.toggleCell(h3Index);
				}
			});
			const unsubZoneMap = mobileZoneMapActive.subscribe((active) => {
				h3GridOverlayService.setSelectionStyle(active ? 'zoneCreate' : 'default');
			});
			h3GridOverlayService.setOnCellsRendered((count) => h3Actions.setRenderedCells(count));

			const applyTheme = (t) => {
				mapService.setMapTheme(t);
				h3GridOverlayService.setMapTheme(t);
				mapService.refreshOpenVehicleInfoWindowTheme(t);
			};
			applyTheme(get(theme));
			const unsubTheme = theme.subscribe(applyTheme);

			if (get(vehicles).length === 0) await vehicleActions.loadVehicles();

			/** @type {() => void} */
			let stopPositionStream = () => {};
			let lastPositionStreamKey = '';

			function syncPositionStream() {
				if (!isPositionStreamEnabled()) {
					stopPositionStream();
					lastPositionStreamKey = '';
					return;
				}
				const extra = extraStreamDeviceIds();
				const list = get(vehicles);
				const fromFleet = list.map((v) => v.deviceId).filter(Boolean);
				const ids = [...new Set([...fromFleet.map(String), ...extra])];
				const key = ids.slice().sort().join('\0');
				if (key === lastPositionStreamKey) return;
				lastPositionStreamKey = key;
				stopPositionStream();
				if (ids.length === 0) return;
				stopPositionStream = startVehiclePositionStream(ids, (pos) => {
					vehicleActions.applyLivePosition(pos);
				});
			}

			syncPositionStream();

			const unsubVehicles = vehicles.subscribe((list) => {
				if (list.length > 0) {
					mapService.addVehicleMarkers(list);
					const withCoords = list.filter((v) => (v.latitude || v.lat) && (v.longitude || v.lng));
					if (withCoords.length > 0) mapService.centerOnVehicles(withCoords);
				} else {
					mapService.clearVehicleMarkers();
				}
				syncPositionStream();
			});

			const unsubGrid = showH3Grid.subscribe((v) => h3GridOverlayService.setVisible(v));
			const unsubRes = h3Resolution.subscribe((r) => h3GridOverlayService.setResolution(r));
			const unsubCells = selectedH3Cells.subscribe((c) => h3GridOverlayService.setSelectedCells(c));

			function onFsChange() {
				mapService.resizeMap();
			}
			document.addEventListener('fullscreenchange', onFsChange);
			document.addEventListener('webkitfullscreenchange', onFsChange);

			return () => {
				mql.removeEventListener('change', onViewportNav);
				mapTapListener?.remove?.();
				document.removeEventListener('fullscreenchange', onFsChange);
				document.removeEventListener('webkitfullscreenchange', onFsChange);
				stopPositionStream();
				lastPositionStreamKey = '';
				unsubVehicles();
				unsubGrid();
				unsubRes();
				unsubCells();
				unsubZoneMap();
				unsubTheme();
				h3GridOverlayService.setSelectionStyle('default');
				h3GridOverlayService.destroy();
			};
		} catch (err) {
			console.error('Error inicializando mapa:', err);
			isLoading = false;
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<section
	class="relative h-full w-full font-sans"
	data-theme={$theme}
	aria-label="Mapa de seguimiento y zonas H3"
>
	{#if isLoading}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm dark:bg-slate-900/60"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<div class="text-center">
				<div
					class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-b-blue-600 dark:border-slate-600 dark:border-b-blue-400"
					aria-hidden="true"
				></div>
				<p class="font-medium text-slate-700 dark:text-slate-200">Cargando mapa…</p>
			</div>
		</div>
	{/if}

	<div
		bind:this={mapElement}
		class="absolute inset-0 [&_img]:!max-w-none"
		role="region"
		aria-label="Vista de mapa interactivo"
		tabindex="-1"
	></div>

	<!-- ── Controles mapa ── -->
	{#if !isLoading && mapService.map}
		<div
			class="pointer-events-none absolute right-[10px] top-[10px] z-20 flex flex-col items-end gap-1.5"
		>
			<!-- Backdrop para cerrar menú -->
			{#if showGeofenceMenu || showAlertsPanel}
				<div
					class="pointer-events-auto fixed inset-0 z-[18]"
					role="presentation"
					on:click={() => {
						showGeofenceMenu = false;
						editingName = false;
						showAlertsPanel = false;
					}}
				></div>
			{/if}
	<div
		class="pointer-events-none absolute right-[10px] top-[10px] z-20 flex flex-col items-end gap-1.5"
	>
		{#if showAlertsPanel}
			<div
				class="pointer-events-auto fixed inset-0 z-[18]"
				role="presentation"
				on:click={() => {
					showAlertsPanel = false;
				}}
			></div>
		{/if}

		<div class="pointer-events-auto relative z-[19] flex flex-col items-end gap-1.5">
			<!-- Centro de notificaciones escritorio -->
			<div class="relative hidden sm:block">
				<button
					type="button"
					class="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/80 dark:focus-visible:outline-white/80 [&_svg]:h-6 [&_svg]:w-6
			<div class="pointer-events-auto relative z-[19] flex flex-col items-end gap-1.5">
				<!-- Centro de notificaciones (solo escritorio/tablet) -->
				<div class="relative hidden sm:block">
					<button
						type="button"
						class="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 [&_svg]:h-6 [&_svg]:w-6
						{showAlertsPanel
							? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_4px_16px_rgba(168,85,247,0.5)]'
							: 'bg-gradient-to-br from-sky-600 to-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.4)] dark:from-slate-700 dark:to-slate-800 dark:shadow-[0_4px_16px_rgba(15,23,42,0.45)]'}"
					on:click={toggleAlertsPanel}
					aria-haspopup="dialog"
					aria-expanded={showAlertsPanel}
					aria-label="Ver alertas y notificaciones"
					title="Alertas y notificaciones"
				>
					<Icon icon="mdi:bell-outline" aria-hidden="true" />
					<span
						class="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white/30 bg-rose-600 px-1.5 py-[1px] text-center text-[10px] font-bold leading-none text-white"
						aria-label="{notificationsBadge} notificaciones"
					>
						{notificationsBadge}
					</span>
				</button>
							: 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.45)]'}"
						on:click={toggleAlertsPanel}
						aria-haspopup="dialog"
						aria-expanded={showAlertsPanel}
						aria-label="Ver alertas y notificaciones"
						title="Alertas y notificaciones"
					>
						<Icon icon="mdi:bell-outline" aria-hidden="true" />
						<span
							class="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white/30 bg-rose-600 px-1.5 py-[1px] text-center text-[10px] font-bold leading-none text-white"
							aria-label="{notificationsBadge} notificaciones"
						>
							{notificationsBadge}
						</span>
					</button>

				{#if showAlertsPanel}
					<div
						class="absolute right-[calc(100%+8px)] top-0 z-[20] w-[320px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgb(8_11_22_/0.97)] dark:text-white/85 dark:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]"
						role="dialog"
						aria-label="Alertas y notificaciones"
						transition:fly={{ y: -6, duration: 180 }}
					>
						<div
							class="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-white/[0.08]"
						>
							<h4
								class="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-white/75"
							>
								Alertas y notificaciones
							</h4>
							<button
								type="button"
								class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10"
								on:click={() => (showAlertsPanel = false)}
							>
								Cerrar
							</button>
						</div>
						<div class="max-h-[320px] overflow-y-auto p-3 text-slate-800 dark:text-white/85">
							<p class="m-0 mb-2 text-[11px] text-slate-500 dark:text-white/40">
								Reglas: {$alerts.length} · Eventos: {$alarmEvents.length}
							</p>
							{#if $alerts.length === 0 && $alarmEvents.length === 0}
								<p
									class="m-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/50"
								>
									No hay alertas ni eventos.
								</p>
							{:else}
								{#if $alarmEvents.length > 0}
									<div
										class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35"
									>
										Eventos recibidos
									</div>
									<ul class="m-0 mb-3 list-none space-y-2 p-0">
										{#each $alarmEvents as ev (ev.id)}
											<li>
												<div
													class="flex items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/[0.08] dark:bg-[#121a28] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] {!ev.read
														? 'ring-1 ring-sky-400/40 dark:ring-sky-500/25'
														: ''}"
												>
													<div
														class="relative flex h-10 w-10 shrink-0 items-center justify-center self-start"
														aria-hidden="true"
													>
														<div
															class="absolute inset-0 scale-110 rounded-full bg-sky-500/15 blur-sm dark:bg-sky-500/20"
														></div>
														<div
															class="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-sky-100 to-sky-200/80 ring-1 ring-sky-300/80 dark:from-sky-400/18 dark:to-blue-600/10 dark:ring-sky-400/30"
														>
															<Icon
																icon="mdi:bell"
																width={16}
																class="text-sky-600 dark:text-sky-400"
															/>
														</div>
													</div>
													<div class="min-w-0 flex-1 py-px">
														<p
															class="m-0 truncate text-[11px] font-bold leading-tight text-slate-900 dark:text-white"
														>
															{ev.vehicle || 'Unidad'}
														</p>
														<p
															class="m-0 mt-0.5 truncate text-[10px] font-medium text-slate-600 dark:text-slate-400"
														>
															{ev.name || 'Evento'}
														</p>
														<p
															class="m-0 mt-1 flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400"
														>
															<Icon icon="mdi:clock-outline" width={11} aria-hidden="true" />
															<time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
														</p>
													</div>
													<button
														type="button"
														class="shrink-0 self-start rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
														on:click={() => removeAlarmEvent(ev.id)}
														aria-label="Eliminar evento {ev.name || ev.id}"
													>
														<Icon icon="mdi:close" width={11} aria-hidden="true" />
													</button>
												</div>
											</li>
										{/each}
									</ul>
								{/if}
								{#if $alerts.length > 0}
									<div
										class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35"
									>
										Alertas configuradas
									</div>
									<ul class="m-0 list-none space-y-1.5 p-0">
										{#each $alerts as al (al.id)}
											<li
												class="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/[0.08] dark:bg-white/[0.03]"
											>
												<div class="flex items-start gap-2">
													<div class="min-w-0 flex-1">
														<p
															class="m-0 truncate text-[12px] font-semibold text-slate-900 dark:text-white"
														>
															{al.name || 'Alerta'}
														</p>
														<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/38">
															{al.type === 'zone' ? 'Zona' : 'Ignición'} · {al.enabled
																? 'Activa'
																: 'Inactiva'}
														</p>
													</div>
													<button
														type="button"
														class="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
														on:click={() => removeAlertRule(al.id)}
														aria-label="Eliminar alerta {al.name || al.id}"
													>
														<Icon icon="mdi:close" width={11} aria-hidden="true" />
													</button>
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
					{#if showAlertsPanel}
						<div
							class="absolute right-[calc(100%+8px)] top-0 z-[20] w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[rgb(8_11_22_/0.97)] shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl"
							role="dialog"
							aria-label="Alertas y notificaciones"
							transition:fly={{ y: -6, duration: 180 }}
						>
							<div class="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
								<h4 class="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-white/75">
									Alertas y notificaciones
								</h4>
								<button
									type="button"
									class="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
									on:click={() => (showAlertsPanel = false)}
								>
									Cerrar
								</button>
							</div>
							<div class="max-h-[320px] overflow-y-auto p-3 text-white/85">
								<p class="m-0 mb-2 text-[11px] text-white/40">
									Reglas: {$alerts.length} · Eventos: {$alarmEvents.length}
								</p>
								{#if $alerts.length === 0 && $alarmEvents.length === 0}
									<p
										class="m-0 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-xs text-white/50"
									>
										No hay alertas ni eventos.
									</p>
								{:else}
									{#if $alarmEvents.length > 0}
										<div class="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
											Eventos recibidos
										</div>
										<ul class="m-0 mb-3 list-none space-y-1.5 p-0">
											{#each $alarmEvents as ev (ev.id)}
												<li class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2">
													<div class="flex items-start gap-2">
														<div class="min-w-0 flex-1">
															<p class="m-0 truncate text-[12px] font-semibold text-white">
																{ev.name || 'Evento'}
															</p>
															<p class="m-0 mt-0.5 text-[10px] text-white/38">
																{ev.vehicle || 'Unidad'} · {formatEventTime(ev.at)}
															</p>
														</div>
														<button
															type="button"
															class="rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
															on:click={() => removeAlarmEvent(ev.id)}
															aria-label="Eliminar evento {ev.name || ev.id}"
														>
															<Icon icon="mdi:close" width={11} aria-hidden="true" />
														</button>
													</div>
												</li>
											{/each}
										</ul>
									{/if}
									{#if $alerts.length > 0}
										<div class="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
											Alertas configuradas
										</div>
										<ul class="m-0 list-none space-y-1.5 p-0">
											{#each $alerts as al (al.id)}
												<li class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2">
													<div class="flex items-start gap-2">
														<div class="min-w-0 flex-1">
															<p class="m-0 truncate text-[12px] font-semibold text-white">
																{al.name || 'Alerta'}
															</p>
															<p class="m-0 mt-0.5 text-[10px] text-white/38">
																{al.type === 'zone' ? 'Zona' : 'Ignición'} · {al.enabled
																	? 'Activa'
																	: 'Inactiva'}
															</p>
														</div>
														<button
															type="button"
															class="rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
															on:click={() => removeAlertRule(al.id)}
															aria-label="Eliminar alerta {al.name || al.id}"
														>
															<Icon icon="mdi:close" width={11} aria-hidden="true" />
														</button>
													</div>
												</li>
											{/each}
										</ul>
									{/if}
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- FAB principal -->
				<button
					type="button"
					class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 [&_svg]:h-6 [&_svg]:w-6
					{$isDrawingGeofence
						? 'bg-gradient-to-br from-red-600 to-red-700 shadow-[0_4px_16px_rgba(220,38,38,0.5)]'
						: showGeofenceMenu
							? 'bg-gradient-to-br from-teal-600 to-emerald-600 shadow-[0_4px_16px_rgba(5,150,105,0.5)]'
							: 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-[0_4px_16px_rgba(5,150,105,0.45)]'}"
					on:click={toggleMenu}
					aria-label={$isDrawingGeofence ? 'Cancelar dibujo' : 'Crear geocerca'}
					aria-expanded={showGeofenceMenu}
					aria-haspopup="true"
					title={$isDrawingGeofence ? 'Cancelar dibujo (Esc)' : 'Crear geocerca'}
				>
					{#if $isDrawingGeofence}
						<Icon icon="mdi:close" aria-hidden="true" />
					{:else if showGeofenceMenu}
						<Icon icon="mdi:chevron-up" aria-hidden="true" />
					{:else}
						<Icon icon="mdi:map-marker-plus-outline" aria-hidden="true" />
					{/if}
				</button>

				<!-- Grid H3 + pasos de resolución a la derecha -->
				<div class="relative shrink-0">
					<button
						type="button"
						class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 [&_svg]:h-6 [&_svg]:w-6
						{$showH3Grid
							? 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-[0_4px_16px_rgba(139,92,246,0.5)]'
							: 'bg-gradient-to-br from-violet-800 to-purple-900 shadow-[0_4px_16px_rgba(76,29,149,0.38)]'}"
						on:click={() => h3Actions.toggleGrid()}
						aria-pressed={$showH3Grid}
						aria-label={$showH3Grid ? 'Ocultar rejilla H3' : 'Mostrar rejilla H3'}
						title={$showH3Grid ? 'Ocultar rejilla H3' : 'Mostrar rejilla H3'}
					>
						<Icon icon="mdi:vector-polygon" aria-hidden="true" />
					</button>
					<div
						class="pointer-events-auto absolute right-full top-1/2 z-[2] mr-1.5 flex -translate-y-1/2 flex-col gap-1"
						role="group"
						aria-label="Tamaño de celda de la rejilla H3"
					>
						<button
							type="button"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-[rgb(8_11_22_/0.94)] text-white shadow-md backdrop-blur-sm transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/80 disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-4 [&_svg]:w-4"
							disabled={!$showH3Grid || $h3Resolution >= H3_RES_MAX}
							title="Celdas más pequeñas (resolución H3 más alta)"
							aria-label="Reducir tamaño de hexágono: más resolución"
							on:click|stopPropagation={() => stepH3Resolution(1)}
						>
							<Icon icon="mdi:plus" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-[rgb(8_11_22_/0.94)] text-white shadow-md backdrop-blur-sm transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/80 disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-4 [&_svg]:w-4"
							disabled={!$showH3Grid || $h3Resolution <= H3_RES_MIN}
							title="Celdas más grandes (resolución H3 más baja)"
							aria-label="Aumentar tamaño de hexágono: menos resolución"
							on:click|stopPropagation={() => stepH3Resolution(-1)}
						>
							<Icon icon="mdi:minus" aria-hidden="true" />
						</button>
					</div>
				</div>

				{#if $isDrawingGeofence}
					<div
						class="pointer-events-none whitespace-nowrap rounded-full bg-red-600/85 px-2.5 py-1 text-[0.6875rem] font-semibold text-white shadow-sm backdrop-blur-sm"
						role="status"
						aria-live="polite"
					>
						Dibujando · <kbd
							class="ml-0.5 inline-block rounded border border-white/25 bg-white/20 px-1 font-sans text-[0.625rem]"
							>Esc</kbd
						> cancela
					</div>
				{/if}

				<!-- ── Menú desplegable ── -->
				{#if showGeofenceMenu}
					<div
						id="geofence-type-menu"
						class="w-[210px] overflow-hidden rounded-2xl border border-white/10 bg-[rgb(8_11_22_/0.97)] shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl"
						role="menu"
						aria-label="Tipo de geocerca"
						transition:fly={{ y: -8, duration: 180 }}
					>
						<!-- ── Header: nombre editable + color picker ── -->
						<div class="flex items-center gap-2 border-b border-white/[0.06] px-3.5 pb-2 pt-2.5">
							<!-- Nombre editable -->
							<div class="min-w-0 flex-1">
								{#if editingName}
									<input
										bind:this={geofenceNameInputEl}
										class="w-full bg-transparent text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/90 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30"
										placeholder="Nombre de la geocerca…"
										value={$pendingGeofenceName}
										on:input={(e) => geofenceActions.setPendingGeofenceName(e.currentTarget.value)}
										on:keydown={handleNameKeydown}
										on:blur={() => (editingName = false)}
										maxlength="100"
										aria-label="Nombre para la geocerca"
									/>
								{:else}
									<button
										type="button"
										class="group flex w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] transition-colors
										{$pendingGeofenceName ? 'text-white/75 hover:text-white' : 'text-white/35 hover:text-white/60'}"
										on:click={() => (editingName = true)}
										title="Clic para asignar nombre"
										aria-label="Asignar nombre a la geocerca"
									>
										<span class="truncate">{$pendingGeofenceName || 'Tipo de geocerca'}</span>
										<!-- lápiz visible al hover -->
										<Icon
											icon="mdi:pencil-outline"
											width={11}
											class="shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
											aria-hidden="true"
										/>
									</button>
								{/if}
							</div>

							<!-- Punto de color — abre color picker -->
							<div class="relative shrink-0">
								<!-- Input de color oculto -->
								<input
									bind:this={colorInputEl}
									type="color"
									class="sr-only"
									value={$pendingGeofenceColor}
									on:input={(e) => geofenceActions.setPendingGeofenceColor(e.currentTarget.value)}
									aria-label="Seleccionar color del trazo"
									tabindex="-1"
								/>
								<!-- Dot clickable -->
								<button
									type="button"
									class="group relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
									on:click|stopPropagation={openColorPicker}
									title="Cambiar color del trazo"
									aria-label="Cambiar color del trazo ({$pendingGeofenceColor})"
								>
									<!-- dot coloreado -->
									<span
										class="h-3.5 w-3.5 rounded-full border-[1.5px] border-white/30 shadow-sm transition-all group-hover:border-white/60"
										style="background-color:{$pendingGeofenceColor}"
										aria-hidden="true"
									></span>
									<!-- ícono de pipeta tiny al hover -->
									<span
										class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-[rgb(8_11_22)] bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
										aria-hidden="true"
									>
										<Icon icon="mdi:eyedropper" width={7} class="text-slate-800" />
									</span>
								</button>
							</div>
						</div>

						<!-- Lista de tipos -->
						{#each GF_TYPES as t (t.id)}
							<button
								type="button"
								class="group flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2 text-left text-sm font-medium text-white/80 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 focus-visible:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400"
								role="menuitem"
								aria-label="Crear geocerca tipo {t.label}"
								on:click={() => startGeofenceType(t.id)}
							>
								<span
									class="flex h-5 w-5 shrink-0 items-center justify-center text-white/45 group-hover:text-emerald-300 [&_svg]:h-4 [&_svg]:w-4"
									aria-hidden="true"
								>
									<Icon icon={t.icon} aria-hidden="true" />
								</span>
								<span class="flex-1">{t.label}</span>
								<!-- mini dot con el color activo para recordar al usuario -->
								<span
									class="h-2 w-2 shrink-0 rounded-full opacity-50 ring-1 ring-white/10"
									style="background-color:{$pendingGeofenceColor}"
									aria-hidden="true"
								></span>
							</button>
						{/each}

						<!-- Footer -->
						<div class="border-t border-white/[0.06] px-3.5 py-1.5 text-[0.6875rem] text-white/25">
							<kbd
								class="mr-1 inline-block rounded border border-white/15 bg-white/10 px-1 font-sans text-[0.625rem]"
								>Esc</kbd
							>
							para cancelar al dibujar
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ── Control H3 selección  ── -->
	{#if $showH3Grid && !$mobileZoneMapActive}
		<div
			class="pointer-events-none absolute right-[max(0.625rem,env(safe-area-inset-right,0px))] top-1/2 z-[30] flex -translate-y-1/2 flex-col items-end gap-1"
		>
			<div class="pointer-events-auto relative">
				<button
					type="button"
					class="flex h-14 w-14 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background-color,opacity,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:h-[26px] [&_svg]:w-[26px]
						{$selectedH3Cells.length > 0
						? 'bg-orange-600 shadow-[0_4px_16px_rgba(234,88,12,0.45)]'
						: 'bg-blue-600 shadow-[0_4px_16px_rgba(37,99,235,0.45)]'}"
					disabled={$selectedH3Cells.length === 0}
					on:click={popLastH3Selection}
					aria-label={$selectedH3Cells.length > 0
						? 'Quitar la última celda H3 seleccionada'
						: 'Selecciona celdas en el mapa'}
					title={$selectedH3Cells.length > 0
						? 'Quitar última selección (LIFO)'
						: 'Selecciona hexágonos en el mapa'}
				>
					{#if $selectedH3Cells.length > 0}
						<Icon icon="mdi:undo-variant" aria-hidden="true" />
					{:else}
						<Icon icon="mdi:gesture-tap" aria-hidden="true" />
					{/if}
				</button>
				<div
					class="pointer-events-none absolute -top-9 right-0"
					aria-live="polite"
					aria-atomic="true"
				>
					{#if $selectedH3Cells.length > 0}
						<p
							class="m-0 whitespace-nowrap rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
						>
							{$selectedH3Cells.length} celda{$selectedH3Cells.length !== 1 ? 's' : ''}
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>
