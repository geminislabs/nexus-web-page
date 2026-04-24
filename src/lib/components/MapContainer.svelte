<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	import { mapService } from '$lib/services/mapService.js';
	import { h3GridOverlayService } from '$lib/services/h3GridOverlayService.js';
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
	import { alerts, alarmEvents, unreadAlarmCount, alertActions } from '$lib/stores/alertStore.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';

	export let isLoading = true;
	export let onMapTap = () => {};

	let mapElement;
	let showAlertsPanel = false;

	function toggleAlertsPanel() {
		if (isLoading) return;
		showAlertsPanel = !showAlertsPanel;
		if (showAlertsPanel && get(unreadAlarmCount) > 0) {
			alertActions.markAllRead();
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && showAlertsPanel) showAlertsPanel = false;
	}

	function removeAlertRule(id) {
		alertActions.deleteAlert(id);
	}
	function removeAlarmEvent(id) {
		alertActions.deleteAlarmEvent(id);
	}

	$: notificationsBadge = $alerts.length + $alarmEvents.length;

	const MOBILE_MQ = '(max-width: 639px)';

	function syncNavControls() {
		if (!browser || !mapService.map) return;
		mapService.setNavigationControlsCompact(window.matchMedia(MOBILE_MQ).matches);
	}

	onMount(async () => {
		try {
			await mapService.initialize(mapElement);
			isLoading = false;

			if (!mapService.map) {
				console.error('mapService.map no disponible tras initialize()');
				return;
			}

			syncNavControls();
			const mql = window.matchMedia(MOBILE_MQ);
			mql.addEventListener('change', syncNavControls);

			const mapTapListener = mapService.map.addListener('click', () => {
				onMapTap?.();
			});

			// ── H3 Grid overlay ──────────────────────────────────
			h3GridOverlayService.attachMap(mapService.map, mapService.google);

			h3GridOverlayService.setOnCellSelect((h3Index) => {
				if (get(mobileZoneMapActive)) {
					get(h3EraserMode)
						? h3Actions.removeCellInZoneEditor(h3Index)
						: h3Actions.tryAddContiguousCell(h3Index);
				} else {
					h3Actions.toggleCell(h3Index);
				}
			});

			const unsubZoneMap = mobileZoneMapActive.subscribe((active) => {
				h3GridOverlayService.setSelectionStyle(active ? 'zoneCreate' : 'default');
			});

			h3GridOverlayService.setOnCellsRendered((count) => h3Actions.setRenderedCells(count));

			// ── Tema ─────────────────────────────────────────────
			const applyTheme = (t) => {
				const mode = t === 'light' ? 'light' : 'dark';
				mapService.setMapTheme(mode);
				h3GridOverlayService.setMapTheme(mode);
				mapService.refreshOpenVehicleInfoWindowTheme?.(mode);
			};
			applyTheme(get(theme));
			const unsubTheme = theme.subscribe(applyTheme);

			// ── Vehículos ─────────────────────────────────────────
			if (get(vehicles).length === 0) await vehicleActions.loadVehicles();

			// ── Position stream ───────────────────────────────────
			let stopPositionStream = () => {};
			let lastStreamKey = '';

			function syncPositionStream() {
				if (!isPositionStreamEnabled()) {
					stopPositionStream();
					lastStreamKey = '';
					return;
				}
				const ids = [
					...new Set([
						...get(vehicles)
							.map((v) => v.deviceId)
							.filter(Boolean)
							.map(String),
						...extraStreamDeviceIds()
					])
				];
				const key = ids.slice().sort().join('\0');
				if (key === lastStreamKey) return;
				lastStreamKey = key;
				stopPositionStream();
				if (!ids.length) return;
				stopPositionStream = startVehiclePositionStream(ids, (pos) => {
					vehicleActions.applyLivePosition?.(pos);
				});
			}

			syncPositionStream();

			const unsubVehicles = vehicles.subscribe((list) => {
				if (list.length > 0) {
					mapService.addVehicleMarkers(list);
					const withCoords = list.filter((v) => (v.latitude || v.lat) && (v.longitude || v.lng));
					if (withCoords.length > 0) mapService.centerOnVehicles(withCoords);
				} else {
					mapService.clearVehicleMarkers?.();
				}
				syncPositionStream();
			});

			// ── Grid H3 reactivo ──────────────────────────────────
			const unsubGrid = showH3Grid.subscribe((v) => h3GridOverlayService.setVisible(v));
			const unsubRes = h3Resolution.subscribe((r) => h3GridOverlayService.setResolution(r));
			const unsubCells = selectedH3Cells.subscribe((c) => h3GridOverlayService.setSelectedCells(c));

			// ── Fullscreen ────────────────────────────────────────
			function onFsChange() {
				mapService.resizeMap();
			}
			document.addEventListener('fullscreenchange', onFsChange);
			document.addEventListener('webkitfullscreenchange', onFsChange);

			return () => {
				mql.removeEventListener('change', syncNavControls);
				mapTapListener?.remove?.();
				document.removeEventListener('fullscreenchange', onFsChange);
				document.removeEventListener('webkitfullscreenchange', onFsChange);
				stopPositionStream();
				unsubVehicles();
				unsubGrid();
				unsubRes();
				unsubCells();
				unsubZoneMap();
				unsubTheme();
				h3GridOverlayService.setSelectionStyle('default');
				h3GridOverlayService.destroy();
			};
		} catch (error) {
			console.error('Error inicializando mapa:', error);
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

	<!--
		Controles del mapa: SOLO visibles cuando NO se está creando una zona.
		Durante la creación de zona, ZonasPanel provee sus propios controles.
	-->
	{#if !isLoading && mapService.map && !$mobileZoneMapActive}
		<div
			class="pointer-events-none absolute right-[10px] top-[10px] z-20 flex flex-col items-end gap-1.5"
		>
			{#if showAlertsPanel}
				<div
					class="pointer-events-auto fixed inset-0 z-[18]"
					role="presentation"
					on:click={() => (showAlertsPanel = false)}
				></div>
			{/if}

			<div class="pointer-events-auto relative z-[19] flex flex-col items-end gap-1.5">
				<!-- Campana de alertas (solo desktop) -->
				<div class="relative hidden sm:block">
					<button
						type="button"
						class="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] [&_svg]:h-6 [&_svg]:w-6
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
						{#if notificationsBadge > 0}
							<span
								class="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white/30 bg-rose-600 px-1.5 py-[1px] text-center text-[10px] font-bold leading-none text-white"
							>
								{notificationsBadge}
							</span>
						{/if}
					</button>

					{#if showAlertsPanel}
						<div
							class="absolute right-[calc(100%+8px)] top-0 z-[20] w-[320px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgb(8_11_22_/0.97)] dark:text-white/85 dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
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
									class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10"
									on:click={() => (showAlertsPanel = false)}
								>
									Cerrar
								</button>
							</div>

							<div class="max-h-[320px] overflow-y-auto p-3">
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
														class="flex items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/[0.08] dark:bg-[#121a28] {!ev.read
															? 'ring-1 ring-sky-400/40'
															: ''}"
													>
														<div
															class="relative flex h-10 w-10 shrink-0 items-center justify-center self-start"
															aria-hidden="true"
														>
															<div
																class="absolute inset-0 scale-110 rounded-full bg-sky-500/15 blur-sm"
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
																class="m-0 truncate text-[11px] font-bold text-slate-900 dark:text-white"
															>
																{ev.vehicle || 'Unidad'}
															</p>
															<p
																class="m-0 mt-0.5 truncate text-[10px] text-slate-600 dark:text-slate-400"
															>
																{ev.name || 'Evento'}
															</p>
															<p
																class="m-0 mt-1 flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400"
															>
																<Icon icon="mdi:clock-outline" width={11} aria-hidden="true" />
																<time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
															</p>
														</div>
														<button
															type="button"
															class="shrink-0 self-start rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
															on:click={() => removeAlarmEvent(ev.id)}
															aria-label="Eliminar evento"
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
															aria-label="Eliminar alerta"
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
	{/if}

	<!-- Vignette — oculta en tema claro -->
	<div class="vignette pointer-events-none" class:hidden={$theme === 'light'}></div>
</section>

<style>
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	@supports (mask-image: radial-gradient(circle, #000, transparent)) {
		.vignette {
			background-color: var(--vignette-color);
			mask-image: radial-gradient(circle at 50% 50%, var(--vignette-stops));
			-webkit-mask-image: radial-gradient(circle at 50% 50%, var(--vignette-stops));
		}
	}
	@supports not (mask-image: radial-gradient(circle, #000, transparent)) {
		.vignette {
			background: radial-gradient(
				circle at 50% 50%,
				rgba(11, 21, 36, 0) 58%,
				var(--vignette-color) 80%,
				var(--vignette-color) 100%
			);
		}
	}
</style>
