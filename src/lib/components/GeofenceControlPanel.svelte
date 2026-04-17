<script>
	import Icon from '@iconify/svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import {
		geofences,
		activeGeofenceType,
		pendingGeofenceColor,
		isDrawingGeofence,
		geofenceCount,
		geofenceActions
	} from '$lib/stores/geofenceStore.js';
	import { geofenceService } from '$lib/services/geofenceService.js';
	import { mapService } from '$lib/services/mapService.js';
	import { buildMapScene, applyMapScene } from '$lib/services/sceneShareService.js';
	import { withGeofenceDbRow } from '$lib/utils/geofenceDbMapper.js';
	import { theme } from '$lib/stores/themeStore.js';

	export let open = false;
	export let onTogglePanel = () => {};
	export let onClose = () => {};

	let importInput;
	let toolHint = '';
	let toolHintOk = true;

	$: isLightTheme = $theme === 'light';

	const controlClass =
		'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:border-emerald-400 dark:focus-visible:ring-emerald-400/25';

	function showToolHint(msg, ok = true) {
		toolHint = msg;
		toolHintOk = ok;
		setTimeout(() => (toolHint = ''), 3500);
	}

	function startGeofenceDrawing() {
		if (!mapService.map || !mapService.google) {
			showToolHint('Espera a que el mapa termine de cargar.', false);
			return;
		}
		if (!geofenceService.startDrawing($activeGeofenceType)) {
			showToolHint('No se pudo iniciar el trazo para este tipo.', false);
			return;
		}
		geofenceActions.startDrawing();
		onClose();
	}

	function stopGeofenceDrawing() {
		geofenceService.stopDrawing();
		geofenceActions.stopDrawing();
	}

	function clearGeofences() {
		geofenceService.cancelPending();
		geofenceActions.closeDraft();
		geofenceService.clearAll();
		geofenceActions.clearGeofences();
		geofenceActions.stopDrawing();
	}

	function removeGeofence(geofenceId) {
		geofenceService.removeById(geofenceId);
		geofenceActions.removeGeofence(geofenceId);
	}

	function downloadGeofences() {
		const blob = new Blob([JSON.stringify($geofences, null, 2)], {
			type: 'application/json'
		});
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

	function onImportFile(event) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(String(reader.result));
				if (data && typeof data === 'object' && data.type === 'nexus-map-scene') {
					applyMapScene(data);
					showToolHint('Escena aplicada (vista, geocercas y H3)');
					return;
				}
				if (!Array.isArray(data)) throw new Error('Se esperaba un array de geocercas o una escena Nexus');

				const cleaned = data.filter(
					(item) =>
						item &&
						typeof item.id === 'string' &&
						typeof item.type === 'string' &&
						item.geometry &&
						typeof item.geometry === 'object'
				);

				const withDbRows = cleaned.map(withGeofenceDbRow);

				geofenceService.cancelPending();
				geofenceActions.closeDraft();
				geofenceService.clearAll();
				geofenceActions.setGeofences(withDbRows);
				geofenceService.restoreOverlays(withDbRows);
				showToolHint('Geocercas importadas (proyección DB lista en dbRow)');
			} catch (err) {
				console.error(err);
				showToolHint(
					'No se pudo importar: JSON inválido o formato incorrecto. Usa un array de geocercas o una escena Nexus.',
					false
				);
			}
		};
		reader.readAsText(file);
	}

	async function copyShareableScene() {
		try {
			const payload = buildMapScene();
			const text = JSON.stringify(payload, null, 2);
			await navigator.clipboard.writeText(text);
			const nGf = payload.geofences?.length ?? 0;
			const nH3 = payload.h3?.selectedCells?.length ?? 0;
			showToolHint(`Escena copiada (${nGf} geocercas, ${nH3} celdas H3)`);
		} catch (e) {
			console.error(e);
			showToolHint('No se pudo copiar', false);
		}
	}

	async function pasteShareableScene() {
		try {
			const text = await navigator.clipboard.readText();
			const data = JSON.parse(text);
			applyMapScene(data);
			showToolHint('Escena aplicada desde el portapapeles');
		} catch (e) {
			console.error(e);
			showToolHint('Pega un JSON de escena válido (copiado con «Copiar escena…»)', false);
		}
	}

	async function copyMapViewOnly() {
		const snap = mapService.getViewSnapshot();
		if (!snap) return;
		const text = JSON.stringify(snap, null, 2);
		try {
			await navigator.clipboard.writeText(text);
			showToolHint('Solo vista del mapa copiada');
		} catch {
			showToolHint('No se pudo copiar', false);
		}
	}

	function typeLabel(t) {
		switch (t) {
			case 'corridor':
				return 'Corredor';
			case 'polyline':
				return 'Ruta';
			case 'marker':
				return 'Sitio';
			case 'polygon':
				return 'Polígono';
			case 'circle':
				return 'Círculo';
			case 'rectangle':
				return 'Rectángulo';
			default:
				return t;
		}
	}

	function editGeofence(g) {
		geofenceActions.openEdit(g);
	}
</script>

<input
	bind:this={importInput}
	id="gf-import-json-input"
	type="file"
	accept="application/json,.json"
	class="sr-only"
	tabindex="-1"
	aria-hidden="true"
	on:change={onImportFile}
/>

<button
	type="button"
	on:click={onTogglePanel}
	aria-label="Abrir panel de geocercas y herramientas"
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls="geofence-control-sheet"
	class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 {isLightTheme
		? 'border border-slate-600/45 bg-gradient-to-br from-emerald-700 to-emerald-900 shadow-[0_2px_6px_rgb(6_78_59_/_0.25)] [box-shadow:inset_0_1px_0_rgb(255_255_255_/_0.08)] hover:brightness-[1.07]'
		: 'border border-white/10 bg-white/10 hover:bg-white/[0.16]'}"
	class:ring-2={open}
	class:ring-emerald-400={open}
	class:ring-offset-2={open}
	class:ring-offset-slate-900={open && isLightTheme}
	class:ring-offset-slate-950={open && !isLightTheme}
>
	<Icon icon="mdi:map-marker" class="h-7 w-7 shrink-0" aria-hidden="true" />
</button>

<CenterSheet
	open={open}
	title="Geocercas"
	ariaDescribedBy="gf-panel-summary gf-db-hint"
	onClose={() => onClose()}
>
	<div id="geofence-control-sheet" class="space-y-5">
		<p id="gf-panel-summary" class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
			Dibuja geocercas en el mapa, edita nombre y metadata en el modal de confirmación, y exporta o comparte la
			escena. Cada geocerca incluye una proyección <span class="font-mono text-xs">dbRow</span> alineada con la tabla
			<span class="font-mono text-xs">public.geofences</span> (sin escribir aún en base de datos desde el cliente).
		</p>

		<section
			class="rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/80"
			aria-labelledby="gf-draw-heading"
		>
			<h3
				id="gf-draw-heading"
				class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
			>
				Configuración del trazo
			</h3>

			<div class="mt-3 space-y-3">
				<div>
					<label for="geofence-type-sheet" class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-200"
						>Tipo de geocerca</label
					>
					<select
						id="geofence-type-sheet"
						class={controlClass}
						value={$activeGeofenceType}
						aria-describedby="gf-type-hint"
						on:change={(event) => geofenceActions.setActiveType(event.currentTarget.value)}
					>
						<option value="polygon">Polígono (área)</option>
						<option value="polyline">Ruta (línea)</option>
						<option value="corridor">Corredor (ruta + ancho)</option>
						<option value="circle">Círculo</option>
						<option value="rectangle">Rectángulo</option>
						<option value="marker">Sitio / punto de control</option>
					</select>
					<p id="gf-type-hint" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
						El tipo define la herramienta de dibujo en el mapa al pulsar «Dibujar».
					</p>
				</div>

				<fieldset class="rounded-lg border border-slate-200/90 p-3 dark:border-slate-600">
					<legend class="px-1 text-xs font-medium text-slate-800 dark:text-slate-200">Color del trazo</legend>
					<div class="mt-1 flex flex-wrap items-center gap-3">
						<label for="geofence-color-sheet" class="sr-only">Selector de color antes de dibujar</label>
						<input
							id="geofence-color-sheet"
							type="color"
							class="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-600 dark:bg-slate-800"
							value={$pendingGeofenceColor}
							on:input={(e) => geofenceActions.setPendingGeofenceColor(e.currentTarget.value)}
							disabled={$isDrawingGeofence}
							aria-describedby="gf-color-hint gf-color-hex"
						/>
						<span id="gf-color-hex" class="font-mono text-xs text-slate-600 dark:text-slate-400" aria-live="polite"
							>{$pendingGeofenceColor}</span
						>
					</div>
					<p id="gf-color-hint" class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
						Elige el color antes de pulsar «Dibujar». Con el trazo activo, detén el dibujo para cambiar el color.
					</p>
				</fieldset>

				{#if $activeGeofenceType === 'polyline' || $activeGeofenceType === 'corridor'}
					<div
						class="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-snug text-emerald-950 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-700/50"
						role="note"
					>
						<span class="font-semibold">Ruta o corredor:</span> dos clics en el mapa: primero
						<span class="font-semibold text-green-800 dark:text-green-400">A inicio</span>, luego
						<span class="font-semibold text-red-800 dark:text-red-400">B fin</span>. Se dibuja la línea entre
						ambos.
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						class="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
						on:click={startGeofenceDrawing}
						disabled={$isDrawingGeofence}
					>
						{$isDrawingGeofence ? 'Dibujando…' : 'Dibujar'}
					</button>
					<button
						type="button"
						class="rounded-lg bg-slate-600 px-2 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
						on:click={stopGeofenceDrawing}
					>
						Detener
					</button>
				</div>
				<p class="text-[11px] text-slate-500 dark:text-slate-400">
					Al terminar el trazo, completa nombre y metadata en el formulario modal (el color ya lo elegiste arriba).
				</p>
				<button
					type="button"
					class="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
					on:click={clearGeofences}
					disabled={$geofenceCount === 0}
				>
					Limpiar todas ({$geofenceCount})
				</button>
			</div>
		</section>

		{#if $geofences.length > 0}
			<section aria-labelledby="gf-saved-heading">
				<h3
					id="gf-saved-heading"
					class="mb-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
				>
					Geocercas guardadas
				</h3>
				<ul
					class="max-h-40 space-y-1.5 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-900/80"
					aria-label="Lista de geocercas en el mapa"
				>
					{#each $geofences as geofence (geofence.id)}
						<li
							class="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-2 text-xs hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
						>
							<div class="flex min-w-0 items-center gap-2">
								<span
									class="inline-block h-3 w-3 shrink-0 rounded-full border border-slate-300 dark:border-slate-500"
									style={`background-color:${geofence.color || '#10B981'}`}
									aria-hidden="true"
								></span>
								<span class="truncate text-slate-800 dark:text-slate-100">
									<span class="font-medium">{geofence.name || typeLabel(geofence.type)}</span>
									<span class="text-slate-500 dark:text-slate-400"> · {typeLabel(geofence.type)}</span>
								</span>
							</div>
							<div class="flex shrink-0 flex-col items-end gap-0.5">
								<button
									type="button"
									class="text-[11px] font-medium text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-blue-400 dark:hover:text-blue-300"
									on:click={() => editGeofence(geofence)}
									aria-label="Editar geocerca {geofence.name || typeLabel(geofence.type)}"
								>
									Editar
								</button>
								<button
									type="button"
									class="text-[11px] font-medium text-red-600 underline-offset-2 hover:text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:text-red-300"
									on:click={() => removeGeofence(geofence.id)}
									aria-label="Eliminar geocerca {geofence.name || typeLabel(geofence.type)}"
								>
									Eliminar
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section
			class="rounded-xl border border-slate-200 p-4 shadow-sm dark:border-slate-600"
			aria-labelledby="gf-tools-heading"
		>
			<h3 id="gf-tools-heading" class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
				Importar, exportar y compartir
			</h3>
			<p id="gf-db-hint" class="mt-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
				Al importar un array de geocercas, se recalcula <span class="font-mono">dbRow</span> para cada ítem si
				faltaba, respetando solo los campos de <span class="font-mono">public.geofences</span>. El estado
				<span class="font-mono">geofence_states</span> lo gestiona el servidor cuando exista telemetría.
			</p>
			<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<button
					type="button"
					class="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
					on:click={downloadGeofences}
					disabled={$geofenceCount === 0}
					aria-describedby="gf-export-hint"
				>
					Exportar JSON
				</button>
				<button
					type="button"
					class="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
					on:click={triggerImport}
					aria-describedby="gf-import-hint"
				>
					Importar JSON
				</button>
			</div>
			<p id="gf-export-hint" class="sr-only">Descarga un archivo JSON con todas las geocercas actuales.</p>
			<p id="gf-import-hint" class="sr-only">Abre el selector de archivos para cargar geocercas o una escena Nexus.</p>

			<p class="mt-3 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
				<span class="font-semibold text-slate-800 dark:text-slate-200">Compartir escena:</span> incluye vista del
				mapa, geocercas y celdas H3 seleccionadas (y si la red H3 está visible). Otra persona puede pegar el JSON o
				importar el archivo guardado.
			</p>
			<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<button
					type="button"
					class="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
					on:click={copyShareableScene}
				>
					Copiar escena para compartir
				</button>
				<button
					type="button"
					class="flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
					on:click={pasteShareableScene}
				>
					Pegar escena
				</button>
			</div>
			<button
				type="button"
				class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
				on:click={copyMapViewOnly}
			>
				Copiar solo vista del mapa
			</button>

			{#if toolHint}
				<p
					class="mt-2 text-[11px] {toolHintOk
						? 'text-emerald-700 dark:text-emerald-300'
						: 'text-red-600 dark:text-red-400'}"
					role="status"
					aria-live="polite"
				>
					{toolHint}
				</p>
			{/if}
		</section>
	</div>
</CenterSheet>
