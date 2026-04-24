<script>
	import Icon from '@iconify/svelte';
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { mapService } from '$lib/services/mapService.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { cellToBoundary, polygonToCells } from 'h3-js';

	const dispatch = createEventDispatcher();

	let mapEl;
	let localMap = null;
	let localGoogle = null;
	let selectedCells = new Set();
	let polygons = new Map();
	let idleListener = null;
	let resolution = 8;
	let zoneName = '';
	let nameInput;
	let nameDialog;
	let showNameModal = false;

	const PAL = {
		stroke: '#2563eb',
		fill: '#3b82f6',
		fillOpacity: 0.18,
		strokeOpacity: 0.9,
		selStroke: '#f59e0b',
		selFill: '#f59e0b',
		selFillOpacity: 0.32
	};

	onMount(() => {
		if (!browser) return;

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		void (async () => {
			try {
				if (mapService.google) {
					localGoogle = mapService.google;
					await initMap();
				} else {
					const { Loader } = await import('@googlemaps/js-api-loader');
					const loader = new Loader({
						apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
						version: 'weekly',
						libraries: ['places']
					});
					localGoogle = await loader.load();
					await initMap();
				}
			} catch (err) {
				console.error('[ZonaHexPicker] No se pudo inicializar el mapa', err);
			}
		})();

		return () => {
			document.body.style.overflow = prevOverflow;
			idleListener?.remove();
			polygons.forEach((p) => p.setMap(null));
		};
	});

	async function initMap() {
		const center = mapService.map?.getCenter() || { lat: 19.4326, lng: -99.1332 };
		const zoom = mapService.map?.getZoom() || 13;

		const { grayBlueMapStyle, COLORS } = await import('$lib/mapStyles.js');

		localMap = new localGoogle.maps.Map(mapEl, {
			center,
			zoom,
			mapTypeId: 'roadmap',
			styles: grayBlueMapStyle,
			backgroundColor: COLORS.grayLight,
			disableDefaultUI: false,
			zoomControl: true,
			fullscreenControl: false,
			mapTypeControl: false,
			streetViewControl: false,
			gestureHandling: 'greedy'
		});

		idleListener = localMap.addListener('idle', redraw);
		setTimeout(redraw, 300);
	}

	function getViewportCells() {
		const bounds = localMap?.getBounds();
		if (!bounds) return [];
		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();

		const ring = [
			[sw.lng(), sw.lat()],
			[ne.lng(), sw.lat()],
			[ne.lng(), ne.lat()],
			[sw.lng(), ne.lat()],
			[sw.lng(), sw.lat()]
		];

		let cells = [];
		let res = resolution;
		while (res >= 4) {
			try {
				cells = polygonToCells([ring], res, true);
				if (!cells.length) {
					const ring2 = ring.map(([a, b]) => [b, a]);
					cells = polygonToCells([ring2], res, false);
				}
			} catch {
				cells = [];
			}
			if (cells.length <= 3000 || res === 4) break;
			res--;
		}
		return cells;
	}

	function redraw() {
		if (!localMap || !localGoogle) return;
		const visible = new Set(getViewportCells());

		polygons.forEach((poly, idx) => {
			if (!visible.has(idx)) {
				poly.setMap(null);
				polygons.delete(idx);
			}
		});

		visible.forEach((h3Idx) => {
			if (!polygons.has(h3Idx)) {
				const verts = cellToBoundary(h3Idx).map(([lat, lng]) => ({ lat, lng }));
				const poly = new localGoogle.maps.Polygon({
					paths: verts,
					strokeColor: PAL.stroke,
					strokeOpacity: PAL.strokeOpacity,
					strokeWeight: 1.5,
					fillColor: PAL.fill,
					fillOpacity: PAL.fillOpacity,
					clickable: true,
					zIndex: 100,
					map: localMap
				});
				poly.addListener('click', () => toggleCell(h3Idx));
				polygons.set(h3Idx, poly);
			}
		});

		applySelectionStyles();
	}

	function toggleCell(h3Idx) {
		if (selectedCells.has(h3Idx)) {
			selectedCells.delete(h3Idx);
		} else {
			selectedCells.add(h3Idx);
		}
		selectedCells = selectedCells;
		applySelectionStyles();
	}

	function applySelectionStyles() {
		polygons.forEach((poly, idx) => {
			const sel = selectedCells.has(idx);
			poly.setOptions({
				strokeColor: sel ? PAL.selStroke : PAL.stroke,
				strokeWeight: sel ? 3 : 1.5,
				fillColor: sel ? PAL.selFill : PAL.fill,
				fillOpacity: sel ? PAL.selFillOpacity : PAL.fillOpacity
			});
		});
	}

	function removeLastCell() {
		if (selectedCells.size === 0) return;
		const cells = Array.from(selectedCells);
		selectedCells.delete(cells[cells.length - 1]);
		selectedCells = selectedCells;
		applySelectionStyles();
	}

	async function handleConfirm() {
		if (selectedCells.size === 0) return;
		showNameModal = true;
		await tick();
		nameDialog?.showModal();
		queueMicrotask(() => nameInput?.focus());
	}

	function handleSave() {
		const name = zoneName.trim() || 'Zona H3';
		dispatch('confirm', { cells: Array.from(selectedCells), name });
		nameDialog?.close();
	}

	function handleNameDialogClose() {
		showNameModal = false;
		zoneName = '';
	}

	function dismissNameDialog() {
		nameDialog?.close();
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleNameKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<section
	class="fixed inset-0 z-[200] isolate flex flex-col bg-[#0a0a0c] font-sans leading-normal text-zinc-100 antialiased"
	aria-labelledby="zhp-heading"
	aria-describedby="zhp-help"
>
	<p id="zhp-help" class="sr-only">
		Mapa interactivo: toca las celdas hexagonales para incluirlas en la zona. Usa el botón inferior
		para confirmar o el de retroceso para cancelar.
	</p>

	<header
		class="flex shrink-0 items-center gap-3 border-b border-slate-900/10 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-slate-900 shadow-[inset_0_1px_0_rgb(255_255_255_/.6)] dark:border-white/10 dark:bg-zinc-900/95 dark:text-slate-50 dark:shadow-none"
	>
		<button
			type="button"
			class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-slate-900/10 text-inherit transition-colors hover:bg-slate-900/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-white/10 dark:hover:bg-white/[0.16] [&_svg]:size-[1.375rem] [&_svg]:shrink-0"
			on:click={handleCancel}
			aria-label="Cancelar y volver"
		>
			<Icon icon="mdi:arrow-left" aria-hidden="true" />
		</button>
		<h2 id="zhp-heading" class="m-0 text-lg font-bold tracking-tight">Crear zona geográfica</h2>
	</header>

	<main class="relative min-h-0 flex-1">
		<div
			bind:this={mapEl}
			class="absolute inset-0 outline-none [&_img]:!max-w-none"
			role="region"
			aria-label="Mapa para seleccionar celdas H3 en el área visible"
			tabindex="0"
		></div>

		<button
			type="button"
			class={`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10 inline-flex size-14 cursor-pointer items-center justify-center rounded-full border-0 text-white transition-[background-color,opacity,box-shadow] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-[0.45] disabled:shadow-none [&_svg]:size-[1.625rem] [&_svg]:shrink-0 ${selectedCells.size > 0 ? 'bg-orange-600 shadow-[0_4px_16px_rgba(234,88,12,0.45)]' : 'bg-blue-600 shadow-[0_4px_16px_rgba(37,99,235,0.45)]'}`}
			disabled={selectedCells.size === 0}
			on:click={removeLastCell}
			aria-label={selectedCells.size > 0
				? 'Quitar la última celda seleccionada'
				: 'Sin celdas para quitar'}
			title={selectedCells.size > 0
				? 'Quitar última celda'
				: 'Selecciona celdas en el mapa primero'}
		>
			{#if selectedCells.size > 0}
				<Icon icon="mdi:eraser" aria-hidden="true" />
			{:else}
				<Icon icon="mdi:gesture-tap" aria-hidden="true" />
			{/if}
		</button>

		<div
			class="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-10"
			aria-live="polite"
			aria-atomic="true"
		>
			{#if selectedCells.size > 0}
				<p
					class="m-0 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-[8px]"
				>
					{selectedCells.size} celda{selectedCells.size !== 1 ? 's' : ''} seleccionada{selectedCells.size !==
					1
						? 's'
						: ''}
				</p>
			{/if}
		</div>
	</main>

	<footer
		class="shrink-0 border-t border-white/10 bg-[#111114] px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
	>
		<button
			type="button"
			class="w-full cursor-pointer rounded-xl border-0 bg-[linear-gradient(135deg,#2563eb,#1d9cc4)] px-4 py-[0.9375rem] text-base font-semibold text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-opacity duration-200 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:bg-[#2a2a2e] disabled:text-white/35 disabled:shadow-none"
			disabled={selectedCells.size === 0}
			on:click={handleConfirm}
		>
			{selectedCells.size === 0
				? 'Toca celdas en el mapa para seleccionar'
				: `Confirmar ${selectedCells.size} celda${selectedCells.size !== 1 ? 's' : ''}`}
		</button>
	</footer>

	{#if showNameModal}
		<dialog
			bind:this={nameDialog}
			class="m-0 h-full max-h-full w-full max-w-full border-0 bg-transparent p-0 [&::backdrop]:bg-slate-900/25 [&::backdrop]:backdrop-blur-[1px] dark:[&::backdrop]:bg-black/40"
			aria-labelledby="zhp-dialog-title"
			on:close={handleNameDialogClose}
		>
			<form
				method="dialog"
				class="absolute bottom-0 left-0 right-0 mx-auto box-border flex w-full max-w-lg flex-col gap-2.5 rounded-t-[1.125rem] border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgb(0_0_0_/.2)] {$theme ===
				'light'
					? 'border-slate-200 bg-white'
					: 'border-white/10 bg-[#1c1c1e] shadow-[0_-8px_32px_rgb(0_0_0_/.35)]'}"
				on:submit|preventDefault={handleSave}
			>
				<h3
					id="zhp-dialog-title"
					class="m-0 text-[1.0625rem] font-bold {$theme === 'light'
						? 'text-slate-900'
						: 'text-white'}"
				>
					Nombre de la zona
				</h3>
				<label
					class="text-[0.8125rem] font-semibold {$theme === 'light'
						? 'text-slate-600'
						: 'text-white/65'}"
					for="zhp-zone-name">Nombre visible</label
				>
				<input
					id="zhp-zone-name"
					bind:this={nameInput}
					bind:value={zoneName}
					type="text"
					name="zoneName"
					autocomplete="off"
					placeholder="Ej: Centro histórico"
					class="box-border w-full rounded-xl border px-4 py-3 text-base outline-none {$theme ===
					'light'
						? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
						: 'border-white/15 bg-white/[0.07] text-white placeholder:text-white/30 focus:border-blue-600/85 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.25)]'}"
					on:keydown={handleNameKeydown}
				/>
				<div class="mt-1 flex gap-2.5">
					<button
						type="button"
						class="flex-1 cursor-pointer rounded-xl border px-3 py-3 text-[0.9375rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 {$theme ===
						'light'
							? 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
							: 'border-white/15 bg-transparent text-white/85 hover:bg-white/10'}"
						on:click={dismissNameDialog}>Cancelar</button
					>
					<button
						type="submit"
						class="flex-[2] cursor-pointer rounded-xl border-0 bg-blue-600 px-3 py-3 text-[0.9375rem] font-semibold text-white transition-[filter] hover:brightness-[1.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
					>
						Guardar zona
					</button>
				</div>
			</form>
		</dialog>
	{/if}
</section>
