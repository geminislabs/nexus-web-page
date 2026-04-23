<script>
	import Icon from '@iconify/svelte';
	import { onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { createEventDispatcher } from 'svelte';
	import { zones, alertActions } from '$lib/stores/alertStore.js';
	import { theme } from '$lib/stores/themeStore.js';
	import {
		h3Actions,
		selectedH3Cells,
		h3EraserMode,
		zoneCreateBanner,
		mobileZoneMapActive,
		mobileCrearZonaMapPassesPointer,
		desktopZonePanelSubView,
		showZoneUiToast
	} from '$lib/stores/h3Store.js';
	import { activeTab } from '$lib/stores/navigationStore.js';
	import { mapService } from '$lib/services/mapService.js';

	/** @type {'mobile' | 'desktop'} */
	export let variant = 'mobile';
	/** @type {'zonas' | 'crear_zona_map' | 'guardar_zona' | 'zona_edit'} */
	export let subView = 'zonas';
	/** Escritorio: estado en `desktopZonePanelSubView` (drawer cerrado, solo controles del mapa). */
	export let useDesktopOverlayStore = false;
	/** Móvil: vuelve a la pestaña Configuración. Escritorio: cierra el drawer (padre escucha `close`). */
	export let onBackFromZonaList = () => {};

	const dispatch = createEventDispatcher();

	function setZoneSubView(/** @type {typeof subView} */ v) {
		if (useDesktopOverlayStore) {
			if (v === 'zona_edit') {
				desktopZonePanelSubView.set('zonas');
				return;
			}
			desktopZonePanelSubView.set(/** @type {'zonas' | 'crear_zona_map' | 'guardar_zona'} */ (v));
		} else {
			subView = v;
		}
	}

	$: zv = useDesktopOverlayStore ? $desktopZonePanelSubView : subView;

	let zoneMenuOpenId = /** @type {string | null} */ (null);
	let editingZoneId = /** @type {string | null} */ (null);
	let editZoneName = '';
	let editZoneDesc = '';
	let newZoneName = '';
	let newZoneDesc = '';
	let saveToast = '';
	let zoneDeactivateConfirm = /** @type {{ id: string; name: string } | null} */ (null);

	/** @type {HTMLDivElement | undefined} */
	let portalHost = undefined;

	function zoneSubtitle(z) {
		const d = z?.metadata?.description;
		if (typeof d === 'string' && d.trim()) return d.trim();
		const n = z?.cells?.length ?? 0;
		return `${n} hexágono${n !== 1 ? 's' : ''}`;
	}

	function handleBackFromZonaList() {
		zoneMenuOpenId = null;
		if (variant === 'desktop') {
			dispatch('navigate', { section: 'apariencia' });
		} else {
			onBackFromZonaList();
		}
	}

	function openCrearZonaMap() {
		h3Actions.enterMobileZoneMap();
		if (variant === 'desktop' && !useDesktopOverlayStore) {
			desktopZonePanelSubView.set('crear_zona_map');
			dispatch('requestCloseDrawer');
			requestAnimationFrame(() => {
				mapService.resizeMap();
				mapService.enableMobileZoneEditorZoomLock();
			});
			return;
		}
		setZoneSubView('crear_zona_map');
		requestAnimationFrame(() => {
			mapService.resizeMap();
			mapService.enableMobileZoneEditorZoomLock();
		});
	}

	function backFromCrearZonaMap() {
		mapService.disableMobileZoneEditorZoomLock();
		h3Actions.exitMobileZoneMap();
		mapService.setMapTheme(get(theme) === 'light' ? 'light' : 'dark');
		requestAnimationFrame(() => mapService.resizeMap());
		setZoneSubView('zonas');
	}

	function openGuardarSheet() {
		if (get(selectedH3Cells).length === 0) return;
		newZoneName = '';
		newZoneDesc = '';
		setZoneSubView('guardar_zona');
	}

	function cancelGuardarSheet() {
		setZoneSubView('crear_zona_map');
	}

	async function confirmGuardarZona() {
		const cells = get(selectedH3Cells);
		const name = newZoneName.trim();
		if (!name || cells.length === 0) return;
		try {
			await alertActions.createZone(name, cells, '#0095ff', { description: newZoneDesc.trim() });
		} catch (err) {
			console.error('No se pudo crear la geocerca:', err);
			saveToast = 'No se pudo crear la zona';
			setTimeout(() => (saveToast = ''), 2600);
			return;
		}
		mapService.disableMobileZoneEditorZoomLock();
		h3Actions.exitMobileZoneMap();
		mapService.setMapTheme(get(theme) === 'light' ? 'light' : 'dark');
		requestAnimationFrame(() => mapService.resizeMap());
		if (useDesktopOverlayStore) {
			showZoneUiToast('Zona guardada exitosamente');
		} else {
			saveToast = 'Zona guardada exitosamente';
			setTimeout(() => (saveToast = ''), 2600);
		}
		setZoneSubView('zonas');
	}

	function openEditZone(z) {
		zoneMenuOpenId = null;
		editingZoneId = z.id;
		editZoneName = z.name || '';
		editZoneDesc = (z.metadata?.description && String(z.metadata.description)) || '';
		setZoneSubView('zona_edit');
	}

	function cancelEditZone() {
		editingZoneId = null;
		setZoneSubView('zonas');
	}

	async function saveEditZone() {
		if (!editingZoneId) return;
		const name = editZoneName.trim();
		if (!name) return;
		const z = get(zones).find((x) => x.id === editingZoneId);
		try {
			await alertActions.updateZone(editingZoneId, {
				name,
				metadata: {
					...(z?.metadata && typeof z.metadata === 'object' ? z.metadata : {}),
					description: editZoneDesc.trim().slice(0, 2000)
				}
			});
			cancelEditZone();
		} catch (err) {
			console.error('No se pudo actualizar la geocerca:', err);
			saveToast = 'No se pudo actualizar la zona';
			setTimeout(() => (saveToast = ''), 2600);
		}
	}

	function requestDeactivateZone(z) {
		zoneMenuOpenId = null;
		zoneDeactivateConfirm = { id: z.id, name: (z.name && String(z.name).trim()) || 'Zona' };
	}

	function cancelDeactivateZone() {
		zoneDeactivateConfirm = null;
	}

	async function confirmDeactivateZone() {
		if (!zoneDeactivateConfirm) return;
		try {
			await alertActions.deleteZone(zoneDeactivateConfirm.id);
			zoneDeactivateConfirm = null;
			saveToast = 'Zona eliminada';
			setTimeout(() => (saveToast = ''), 2600);
		} catch (err) {
			console.error('No se pudo eliminar la geocerca:', err);
			saveToast = 'No se pudo eliminar la zona';
			setTimeout(() => (saveToast = ''), 2600);
		}
	}

	$: sheetGuardarDisabled = !newZoneName?.trim();
	$: fabSaveDisabled = $selectedH3Cells.length === 0;

	$: mobileCrearZonaMapPassesPointer.set(
		browser && zv === 'crear_zona_map' && (variant === 'desktop' || $activeTab === 'alertas')
	);

	$: if (browser && variant === 'desktop' && portalHost) {
		tick().then(() => {
			if (portalHost && portalHost.parentNode !== document.body) {
				document.body.appendChild(portalHost);
			}
		});
	}

	onDestroy(() => {
		if (!browser) return;
		/** El drawer de escritorio se desmonta al abrir «Crear zona»; el overlay en el dashboard sigue el mismo flujo H3. */
		const handingOffToDesktopOverlay =
			variant === 'desktop' && !useDesktopOverlayStore && get(desktopZonePanelSubView) !== 'zonas';
		if (!handingOffToDesktopOverlay) {
			mobileCrearZonaMapPassesPointer.set(false);
		}
		if (get(mobileZoneMapActive) && !handingOffToDesktopOverlay) {
			mapService.disableMobileZoneEditorZoomLock();
			h3Actions.exitMobileZoneMap();
			mapService.setMapTheme(get(theme) === 'light' ? 'light' : 'dark');
			requestAnimationFrame(() => mapService.resizeMap());
		}
		if (variant === 'desktop' && portalHost && portalHost.parentNode === document.body) {
			portalHost.remove();
		}
	});

	/** Margen inferior del dock de acciones (el overlay ya respeta la barra de pestañas en móvil). */
	$: crearZonaDockBottom =
		variant === 'mobile'
			? 'max(12px, env(safe-area-inset-bottom, 0px))'
			: 'max(16px, env(safe-area-inset-bottom, 0px))';

	/** FAB inferior en lista de zonas (móvil). */
	$: crearZonaFabBottom =
		variant === 'mobile' ? 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 10px)' : 'auto';

	/** Anclaje de controles flotantes al crear zona en móvil. */
	$: mapOverlayBottom =
		variant === 'mobile' ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px) + 12px)' : 'auto';
</script>

<svelte:window
	on:keydown={(e) => {
		if (e.key === 'Escape' && zoneDeactivateConfirm) cancelDeactivateZone();
	}}
/>

{#if saveToast && zv === 'zonas' && !useDesktopOverlayStore}
	<div
		class="pointer-events-none absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex -translate-x-1/2 justify-center px-4 {variant ===
		'desktop'
			? 'fixed'
			: ''}"
		role="status"
	>
		<p
			class="flex items-center gap-2 rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur-md"
		>
			<span
				class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"
				aria-hidden="true"
			>
				<Icon icon="mdi:check" class="h-4 w-4" />
			</span>
			{saveToast}
		</p>
	</div>
{/if}

{#if zv === 'crear_zona_map' || zv === 'guardar_zona'}
	<div bind:this={portalHost}>
		{#if zv === 'crear_zona_map'}
			<div
				class="pointer-events-none fixed inset-0 z-[120] flex flex-col {variant === 'mobile'
					? 'max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))]'
					: ''}"
				aria-hidden="false"
			>
				{#if variant === 'mobile'}
					<header
						class="pointer-events-auto relative flex min-h-[3.25rem] shrink-0 items-center justify-end border-b px-3 pb-3.5 pt-[max(0.65rem,env(safe-area-inset-top))] shadow-md backdrop-blur-xl sm:px-4 {$theme ===
						'light'
							? 'border-slate-200/80 bg-white/95 text-slate-900'
							: 'border-white/[0.08] bg-[#060b18]/95 text-white'}"
					>
						<div class="pointer-events-none absolute inset-x-0 flex justify-center px-16">
							<h1
								class="m-0 max-w-full truncate text-center text-[17px] font-bold tracking-tight {$theme ===
								'light'
									? 'text-slate-900'
									: 'text-white'}"
							>
								Crear zona
							</h1>
						</div>
						<div class="relative z-[1] ml-auto flex shrink-0 items-center gap-2">
							<span
								class="hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums sm:inline {$theme ===
								'light'
									? 'border-sky-200/90 bg-sky-50 text-sky-800'
									: 'border-sky-500/30 bg-sky-500/10 text-sky-200'}"
								aria-live="polite"
							>
								{$selectedH3Cells.length} sel.
							</span>
							<button
								type="button"
								class="rounded-full border px-3.5 py-2 text-[13px] font-semibold transition active:scale-[0.98] {$theme ===
								'light'
									? 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
									: 'border-white/10 bg-white/[0.06] text-white/90 hover:bg-white/[0.1]'}"
								on:click={backFromCrearZonaMap}
							>
								Cancelar
							</button>
						</div>
					</header>
					<div class="pointer-events-none flex flex-1 flex-col items-center px-3 pt-3">
						{#if $zoneCreateBanner === 'contiguous'}
							<p
								class="mb-2 rounded-full border px-3 py-2 text-center text-[12px] font-semibold shadow-md backdrop-blur-sm {$theme ===
								'light'
									? 'border-amber-400/90 bg-white/92 text-amber-950'
									: 'border-amber-400/50 bg-amber-950/90 text-amber-50'}"
								role="status"
							>
								Los hexágonos deben ser contiguos
							</p>
						{/if}
						<p
							class="rounded-full border px-4 py-2 text-[13px] font-semibold shadow-md backdrop-blur-sm {$theme ===
							'light'
								? 'border-sky-500/60 bg-white/90 text-sky-950'
								: 'border-sky-500/45 bg-slate-900/90 text-sky-100'}"
						>
							{$selectedH3Cells.length} hexágono{$selectedH3Cells.length !== 1 ? 's' : ''} seleccionado{$selectedH3Cells.length !==
							1
								? 's'
								: ''}
						</p>
					</div>
					<div
						class="pointer-events-auto fixed right-4 z-[130] flex flex-col gap-3 drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
						style={`bottom: ${mapOverlayBottom}; top: auto;`}
					>
						<button
							type="button"
							class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-0 text-white shadow-[0_6px_22px_rgba(16,185,129,0.55)] ring-2 ring-white/25 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none {fabSaveDisabled
								? 'bg-gradient-to-b from-slate-400 to-slate-500'
								: 'bg-gradient-to-b from-emerald-400 to-green-600'}"
							disabled={fabSaveDisabled}
							on:click={openGuardarSheet}
							aria-label="Continuar para guardar la zona"
							title={fabSaveDisabled ? 'Selecciona al menos un hexágono' : 'Guardar zona'}
						>
							<Icon icon="mdi:check" class="h-8 w-8" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition hover:brightness-110 active:scale-95 ring-2 ring-white/20 {$h3EraserMode
								? 'bg-gradient-to-b from-orange-500 to-amber-700 shadow-[0_8px_26px_rgba(234,88,12,0.55)]'
								: 'bg-gradient-to-b from-sky-400 to-blue-600 shadow-[0_8px_26px_rgba(0,149,255,0.55)]'}"
							on:click={() => h3Actions.toggleEraserMode()}
							aria-pressed={$h3EraserMode}
							aria-label={$h3EraserMode ? 'Desactivar modo borrador' : 'Activar modo borrador'}
							title={$h3EraserMode ? 'Toca hexágonos para quitarlos' : 'Modo borrador'}
						>
							<Icon
								icon={$h3EraserMode ? 'mdi:eraser' : 'mdi:hand-pointing-up'}
								class="h-8 w-8"
								aria-hidden="true"
							/>
						</button>
					</div>
				{:else}
					<header
						class="pointer-events-auto flex min-h-[3rem] shrink-0 items-center justify-center border-b px-4 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] shadow-sm backdrop-blur-xl {$theme ===
						'light'
							? 'border-slate-200/80 bg-white/95 text-slate-900'
							: 'border-white/[0.08] bg-[#060b18]/95 text-white'}"
					>
						<h1
							class="m-0 max-w-[min(100%,18rem)] truncate text-center text-[17px] font-bold tracking-tight {$theme ===
							'light'
								? 'text-slate-900'
								: 'text-white'}"
						>
							Crear zona
						</h1>
					</header>

					<div class="pointer-events-none flex min-h-0 flex-1 flex-col justify-end px-3 pb-2 pt-2">
						<div class="flex flex-col items-center gap-2">
							{#if $zoneCreateBanner === 'contiguous'}
								<p
									class="max-w-sm rounded-2xl border px-3 py-2 text-center text-[12px] font-semibold shadow-md backdrop-blur-md {$theme ===
									'light'
										? 'border-amber-400/90 bg-white/92 text-amber-950'
										: 'border-amber-400/50 bg-amber-950/90 text-amber-50'}"
									role="status"
								>
									Los hexágonos deben ser contiguos
								</p>
							{/if}
							<p
								class="rounded-full border px-4 py-2 text-[12px] font-semibold tabular-nums shadow-md backdrop-blur-md {$theme ===
								'light'
									? 'border-sky-500/50 bg-white/92 text-sky-950'
									: 'border-sky-500/40 bg-slate-900/92 text-sky-100'}"
								aria-live="polite"
							>
								{$selectedH3Cells.length} hexágono{$selectedH3Cells.length !== 1 ? 's' : ''} seleccionado{$selectedH3Cells.length !==
								1
									? 's'
									: ''}
							</p>
						</div>
					</div>

					<div
						class="pointer-events-auto shrink-0 px-3 pt-1"
						style="padding-bottom: {crearZonaDockBottom};"
					>
						<div
							class="mx-auto flex max-w-md items-center gap-2 rounded-2xl border p-2 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl {$theme ===
							'light'
								? 'border-slate-200/90 bg-white/95'
								: 'border-white/[0.1] bg-[#0c1220]/95'}"
						>
							<button
								type="button"
								class="shrink-0 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition active:scale-[0.98] {$theme ===
								'light'
									? 'text-slate-600 hover:bg-slate-100'
									: 'text-white/80 hover:bg-white/[0.08]'}"
								on:click={backFromCrearZonaMap}
							>
								Cancelar
							</button>
							<span
								class="mx-0.5 h-8 w-px shrink-0 {$theme === 'light'
									? 'bg-slate-200'
									: 'bg-white/10'}"
								aria-hidden="true"
							></span>
							<button
								type="button"
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition hover:brightness-110 active:scale-95 ring-2 ring-white/20 {$h3EraserMode
									? 'bg-gradient-to-b from-orange-500 to-amber-700 shadow-[0_6px_20px_rgba(234,88,12,0.45)]'
									: 'bg-gradient-to-b from-sky-400 to-blue-600 shadow-[0_6px_20px_rgba(0,149,255,0.45)]'}"
								on:click={() => h3Actions.toggleEraserMode()}
								aria-pressed={$h3EraserMode}
								aria-label={$h3EraserMode ? 'Desactivar modo borrador' : 'Activar modo borrador'}
								title={$h3EraserMode ? 'Toca hexágonos para quitarlos' : 'Modo borrador'}
							>
								<Icon
									icon={$h3EraserMode ? 'mdi:eraser' : 'mdi:hand-pointing-up'}
									class="h-6 w-6"
									aria-hidden="true"
								/>
							</button>
							<button
								type="button"
								class="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-0 text-white shadow-[0_6px_20px_rgba(16,185,129,0.5)] ring-2 ring-white/25 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none {fabSaveDisabled
									? 'bg-gradient-to-b from-slate-400 to-slate-500'
									: 'bg-gradient-to-b from-emerald-400 to-green-600'}"
								disabled={fabSaveDisabled}
								on:click={openGuardarSheet}
								aria-label="Continuar para guardar la zona"
								title={fabSaveDisabled ? 'Selecciona al menos un hexágono' : 'Guardar zona'}
							>
								<Icon icon="mdi:check" class="h-6 w-6" aria-hidden="true" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		{:else if zv === 'guardar_zona'}
			<div
				class="pointer-events-auto fixed inset-0 z-[140] flex {variant === 'mobile'
					? 'max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))]'
					: ''} flex-col justify-end bg-slate-900/20 backdrop-blur-[1px] dark:bg-black/30 dark:backdrop-blur-[1px]"
				role="presentation"
				on:click|self={cancelGuardarSheet}
			>
				<div
					class="pointer-events-auto max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain rounded-t-[1.35rem] border-t border-x px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] {$theme ===
					'light'
						? 'border-slate-200/90 bg-white text-slate-900'
						: 'border-white/[0.1] bg-[#0f1624] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)]'}"
					role="dialog"
					aria-labelledby="guardar-zona-titulo"
				>
					<div class="mb-4 flex items-center justify-between gap-3">
						<h2
							id="guardar-zona-titulo"
							class="m-0 text-lg font-bold {$theme === 'light' ? 'text-slate-900' : 'text-white'}"
						>
							Guardar zona
						</h2>
						<button
							type="button"
							class="rounded-xl border px-4 py-2 text-sm font-semibold transition {sheetGuardarDisabled
								? $theme === 'light'
									? 'border-slate-200 bg-slate-100 text-slate-400'
									: 'border-white/10 bg-white/[0.06] text-white/35'
								: 'border-sky-500/50 bg-sky-500 text-white shadow-sm hover:bg-sky-600'}"
							disabled={sheetGuardarDisabled}
							on:click={confirmGuardarZona}
						>
							Guardar
						</button>
					</div>
					<div
						class="overflow-hidden rounded-2xl border {$theme === 'light'
							? 'border-slate-200 bg-slate-50'
							: 'border-white/10 bg-white/[0.06]'}"
					>
						<label
							class="flex items-center gap-3 border-b px-3 py-3.5 {$theme === 'light'
								? 'border-slate-200'
								: 'border-white/[0.08]'}"
						>
							<Icon
								icon="mdi:tag-outline"
								class="h-5 w-5 shrink-0 text-sky-500"
								aria-hidden="true"
							/>
							<input
								class="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none {$theme ===
								'light'
									? 'text-slate-900 placeholder:text-slate-400'
									: 'text-white placeholder:text-white/40'}"
								placeholder="Nombre de la zona"
								bind:value={newZoneName}
								maxlength="255"
								autocomplete="off"
							/>
						</label>
						<label class="flex items-start gap-3 px-3 py-3.5">
							<Icon
								icon="mdi:format-align-left"
								class="mt-0.5 h-5 w-5 shrink-0 text-sky-500"
								aria-hidden="true"
							/>
							<textarea
								class="min-h-[4rem] w-full resize-none border-0 bg-transparent text-[15px] outline-none {$theme ===
								'light'
									? 'text-slate-900 placeholder:text-slate-400'
									: 'text-white placeholder:text-white/40'}"
								placeholder="Descripción (opcional)"
								bind:value={newZoneDesc}
								rows="3"
								maxlength="2000"
							></textarea>
						</label>
					</div>
					<button
						type="button"
						class="mt-4 w-full rounded-2xl border-0 py-3 text-sm font-semibold transition {$theme ===
						'light'
							? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
							: 'bg-white/[0.08] text-white/85 hover:bg-white/[0.12]'}"
						on:click={cancelGuardarSheet}
					>
						Cancelar
					</button>
				</div>
			</div>
		{/if}
	</div>
{:else if zv === 'zonas'}
	<div class="flex h-full min-h-0 flex-1 flex-col bg-slate-50 dark:bg-black">
		{#if variant === 'mobile'}
			<header
				class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-3 pt-[max(0.35rem,env(safe-area-inset-top))] dark:border-white/[0.08]"
			>
				<button
					type="button"
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
					on:click={handleBackFromZonaList}
					aria-label="Volver"
				>
					<Icon icon="mdi:chevron-left" class="h-6 w-6" aria-hidden="true" />
				</button>
				<h1 class="m-0 flex-1 text-center text-[17px] font-bold text-slate-900 dark:text-white">
					Zonas
				</h1>
				<span class="w-10 shrink-0" aria-hidden="true"></span>
			</header>
		{/if}

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div
				class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 {variant ===
				'mobile'
					? 'pb-28 pt-4'
					: 'pb-3 pt-5'}"
			>
				{#if $zones.length === 0}
					<div
						class="flex flex-col items-center justify-center gap-3 px-6 text-center {variant ===
						'desktop'
							? 'min-h-0 flex-1 py-10 sm:py-12'
							: 'py-20'}"
					>
						<Icon
							icon="mdi:map-marker-outline"
							class="h-20 w-20 text-slate-500 dark:text-white/25"
							aria-hidden="true"
						/>
						<h2 class="m-0 text-lg font-bold text-slate-800 dark:text-white/85">
							Sin zonas creadas
						</h2>
						<p class="m-0 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-white/40">
							{#if variant === 'desktop'}
								Dibuja hexágonos en el mapa para delimitar la zona. Pulsa «Crear zona» en la barra
								inferior.
							{:else}
								Crea tu primera zona geográfica pulsando el botón de abajo.
							{/if}
						</p>
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-3 p-0" aria-label="Zonas guardadas">
						{#each $zones as z (z.id)}
							<li class="relative">
								<div
									class="flex items-stretch gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#121a26]"
								>
									<div class="w-1 shrink-0 bg-sky-500" aria-hidden="true"></div>
									<div
										class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-2"
										role="group"
										aria-label={z.name}
									>
										<div
											class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400"
											aria-hidden="true"
										>
											<Icon icon="mdi:map-marker" class="h-6 w-6" />
										</div>
										<div class="min-w-0 flex-1">
											<p class="m-0 truncate text-[15px] font-bold text-slate-900 dark:text-white">
												{z.name}
											</p>
											<p class="m-0 mt-0.5 truncate text-[13px] text-slate-600 dark:text-white/45">
												{zoneSubtitle(z)}
											</p>
										</div>
										<button
											type="button"
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white"
											aria-expanded={zoneMenuOpenId === z.id}
											aria-label="Opciones de {z.name}"
											on:click={() => (zoneMenuOpenId = zoneMenuOpenId === z.id ? null : z.id)}
										>
											<Icon icon="mdi:dots-horizontal" class="h-6 w-6" aria-hidden="true" />
										</button>
									</div>
								</div>
								{#if zoneMenuOpenId === z.id}
									<div
										class="absolute right-2 top-[calc(100%-4px)] z-[60] min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-xl backdrop-blur-md dark:border-white/[0.12] dark:bg-[#151c2e] dark:text-white"
										role="menu"
									>
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-white/[0.08]"
											role="menuitem"
											on:click={() => openEditZone(z)}
										>
											<Icon icon="mdi:pencil-outline" class="h-4 w-4" aria-hidden="true" />
											Editar
										</button>
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15"
											role="menuitem"
											on:click={() => requestDeactivateZone(z)}
										>
											<Icon icon="mdi:delete-outline" class="h-4 w-4" aria-hidden="true" />
											Desactivar
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if variant === 'desktop'}
				<div
					class="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.08] dark:bg-[#050810]"
				>
					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(180deg,#0ea5e9,#0095ff)] py-3 text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(0,149,255,0.4)] transition hover:brightness-[1.03] active:scale-[0.99]"
						on:click={openCrearZonaMap}
					>
						<Icon icon="mdi:hexagon-multiple-outline" class="h-5 w-5 shrink-0" aria-hidden="true" />
						Crear zona
					</button>
				</div>
			{/if}
		</div>

		{#if variant === 'mobile'}
			<div
				class="pointer-events-auto fixed inset-x-0 z-[54] px-4"
				style="bottom: {crearZonaFabBottom};"
			>
				<button
					type="button"
					class="flex w-full items-center justify-center gap-2 rounded-full border-0 bg-[linear-gradient(180deg,#0ea5e9,#0095ff)] py-3.5 text-[16px] font-bold text-white shadow-[0_8px_28px_rgba(0,149,255,0.45)] transition active:scale-[0.99]"
					on:click={openCrearZonaMap}
				>
					<Icon icon="mdi:plus" class="h-5 w-5" aria-hidden="true" />
					Crear Zona
				</button>
			</div>
		{/if}
	</div>
{:else if zv === 'zona_edit' && editingZoneId}
	<div class="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-black">
		<header
			class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 pt-[max(0.35rem,env(safe-area-inset-top))] dark:border-white/[0.08]"
		>
			<button
				type="button"
				class="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/12 dark:bg-zinc-900 dark:text-white/90 dark:hover:bg-zinc-800"
				on:click={cancelEditZone}
			>
				Cancelar
			</button>
			<h1 class="m-0 flex-1 text-center text-[16px] font-bold text-slate-900 dark:text-white">
				Editar Zona
			</h1>
			<button
				type="button"
				class="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-sky-600 hover:bg-slate-100 dark:border-white/12 dark:bg-zinc-900 dark:text-sky-400 dark:hover:bg-zinc-800"
				on:click={saveEditZone}
			>
				Guardar
			</button>
		</header>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
			<div
				class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.1] dark:bg-[#1c1c1e]"
			>
				<label class="block border-b border-slate-100 px-4 py-3.5 dark:border-white/[0.08]">
					<span class="sr-only">Nombre</span>
					<input
						class="w-full border-0 bg-transparent text-[16px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35"
						bind:value={editZoneName}
						maxlength="255"
					/>
				</label>
				<label class="block px-4 py-3.5">
					<span class="sr-only">Descripción</span>
					<textarea
						class="min-h-[5rem] w-full resize-none border-0 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-white/90 dark:placeholder:text-white/35"
						bind:value={editZoneDesc}
						rows="4"
						placeholder="Descripción"
						maxlength="2000"
					></textarea>
				</label>
			</div>
		</div>
	</div>
{/if}

{#if zoneMenuOpenId}
	<button
		type="button"
		class="fixed inset-0 z-[49] cursor-default {variant === 'mobile' ? 'sm:hidden' : ''}"
		aria-label="Cerrar menú"
		on:click={() => (zoneMenuOpenId = null)}
	></button>
{/if}

{#if zoneDeactivateConfirm}
	<div
		class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px] dark:bg-black/50"
		role="presentation"
		on:click|self={cancelDeactivateZone}
	>
		<div
			class="w-full max-w-[min(100%,20rem)] rounded-[1.25rem] border px-5 pb-5 pt-5 shadow-xl {$theme ===
			'light'
				? 'border-slate-200/80 bg-slate-100 text-slate-900'
				: 'border-white/[0.1] bg-[#2a3040] text-white'}"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="zone-deactivate-title"
			aria-describedby="zone-deactivate-desc"
			tabindex="-1"
		>
			<h2 id="zone-deactivate-title" class="m-0 text-center text-lg font-bold leading-snug">
				Desactivar Zona
			</h2>
			<p
				id="zone-deactivate-desc"
				class="mb-6 mt-3 text-center text-[15px] leading-relaxed {$theme === 'light'
					? 'text-slate-800'
					: 'text-white/85'}"
			>
				¿Estás seguro que deseas desactivar la zona «{zoneDeactivateConfirm.name}»? La geocerca se
				eliminará del mapa.
			</p>
			<div class="flex gap-3">
				<button
					type="button"
					class="min-h-[3rem] flex-1 rounded-full border-0 text-[15px] font-semibold transition-opacity hover:opacity-90 {$theme ===
					'light'
						? 'bg-slate-300/90 text-slate-900'
						: 'bg-white/20 text-white'}"
					on:click={cancelDeactivateZone}
				>
					Cancelar
				</button>
				<button
					type="button"
					class="min-h-[3rem] flex-1 rounded-full border-0 text-[15px] font-semibold transition-opacity hover:opacity-90 {$theme ===
					'light'
						? 'bg-slate-300/90 text-orange-600'
						: 'bg-white/20 text-orange-400'}"
					on:click={confirmDeactivateZone}
				>
					Desactivar
				</button>
			</div>
		</div>
	</div>
{/if}
