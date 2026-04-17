<script>
	import {
		geofenceDraft,
		pendingGeofenceColor,
		pendingGeofenceName,
		geofenceActions,
		isGeofenceNameTaken
	} from '$lib/stores/geofenceStore.js';
	import { geofenceService } from '$lib/services/geofenceService.js';

	const MAX_METADATA_ROWS = 10;

	let _metaRowUid = 0;
	function nextMetaRowUid() {
		return ++_metaRowUid;
	}

	let name = '';
	let color = '#10B981';
	/** @type {{ _uid: number; key: string; value: string }[]} */
	let metadataRows = [];
	let corridorWidth = 40;
	let error = '';

	let draftKey = '';

	/**
	 * @param {Record<string, unknown> | null | undefined} obj
	 * @returns {{ _uid: number; key: string; value: string }[]}
	 */
	function objectToMetadataRows(obj) {
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
		return Object.entries(obj)
			.slice(0, MAX_METADATA_ROWS)
			.map(([key, value]) => ({
				_uid: nextMetaRowUid(),
				key: String(key),
				value:
					value === null || value === undefined
						? ''
						: typeof value === 'object'
							? JSON.stringify(value)
							: String(value)
			}));
	}

	/**
	 * @param {{ key: string; value: string }[]} rows
	 * @returns {{ metadata: Record<string, string>; error?: string }}
	 */
	function metadataRowsToObject(rows) {
		/** @type {Record<string, string>} */
		const metadata = {};
		const seen = new Set();
		for (const row of rows) {
			const k = row.key.trim();
			if (!k) continue;
			if (seen.has(k)) {
				return { metadata: {}, error: `Clave repetida: "${k}". Unifica o renombra la entrada.` };
			}
			seen.add(k);
			metadata[k] = row.value;
		}
		return { metadata };
	}

	function addMetadataRow() {
		if (metadataRows.length >= MAX_METADATA_ROWS) return;
		metadataRows = [...metadataRows, { _uid: nextMetaRowUid(), key: '', value: '' }];
	}

	/** @param {number} index */
	function removeMetadataRow(index) {
		metadataRows = metadataRows.filter((_, i) => i !== index);
	}

	$: {
		const d = $geofenceDraft;
		if (!d) {
			draftKey = '';
		} else {
			const k =
				d.mode === 'edit' ? `e:${d.geofence.id}` : `c:${d.id}:${d.drawKind ?? ''}:${d.type}`;
			if (k !== draftKey) {
				draftKey = k;
				error = '';
				if (d.mode === 'edit') {
					const g = d.geofence;
					name = g.name || '';
					color = g.color || '#10B981';
					metadataRows = objectToMetadataRows(g.metadata);
				} else {
					name = $pendingGeofenceName || defaultName(d.type, d.drawKind);
					color = $pendingGeofenceColor || '#10B981';
					metadataRows = [];
					corridorWidth = 40;
				}
			}
		}
	}

	/**
	 * @param {string} type
	 * @param {string} [drawKind]
	 */
	function defaultName(type, drawKind) {
		if (drawKind === 'corridor') return 'Corredor';
		switch (type) {
			case 'polyline':
				return 'Ruta';
			case 'marker':
				return 'Sitio / punto de control';
			case 'circle':
				return 'Zona circular';
			case 'rectangle':
				return 'Área rectangular';
			case 'polygon':
			default:
				return 'Geocerca';
		}
	}

	function close() {
		const d = $geofenceDraft;
		if (d?.mode === 'create') {
			geofenceService.cancelPending();
			geofenceActions.stopDrawing();
		}
		geofenceActions.closeDraft();
		error = '';
	}

	function save() {
		const d = $geofenceDraft;
		if (!d) return;

		const { metadata, error: metaErr } = metadataRowsToObject(metadataRows);
		if (metaErr) {
			error = metaErr;
			return;
		}

		const finalName =
			d.mode === 'edit'
				? name.trim() || d.geofence.name || ''
				: name.trim() || defaultName(d.type, d.drawKind);

		if (isGeofenceNameTaken(finalName, d.mode === 'edit' ? d.geofence.id : null)) {
			error =
				'Ya existe una geocerca con ese nombre. Usa un nombre único (no se distinguen mayúsculas y minúsculas).';
			return;
		}

		if (d.mode === 'edit') {
			const id = d.geofence.id;
			const prevType = d.geofence.type;
			geofenceActions.updateGeofence(id, {
				name: finalName,
				color,
				metadata
			});
			geofenceService.applyGeofenceColor(id, color, prevType);
			geofenceActions.closeDraft();
			error = '';
			return;
		}

		geofenceService.confirmPending({
			name: finalName,
			color,
			metadata,
			corridorWidthMeters: d.drawKind === 'corridor' ? Number(corridorWidth) : undefined
		});
		geofenceActions.setPendingGeofenceName('');
		geofenceActions.closeDraft();
		geofenceActions.stopDrawing();
		error = '';
	}

	/** @param {KeyboardEvent} event */
	function onKeydown(event) {
		if (event.key === 'Escape') close();
	}

	const inputBase =
		'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-emerald-400 dark:focus-visible:ring-emerald-400/25';
</script>

<svelte:window on:keydown={onKeydown} />

{#if $geofenceDraft}
	<div
		class="gf-modal-root fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6"
		aria-hidden="false"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default border-0 bg-slate-950/50 p-0 backdrop-blur-sm"
			aria-label="Cerrar modal de geocerca"
			on:click={close}
		></button>

		<div
			class="relative z-[1] max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
			role="dialog"
			aria-modal="true"
			aria-labelledby="gf-modal-title"
			aria-describedby="gf-modal-desc gf-meta-hint"
		>
			<header class="border-b border-slate-200 p-4 sm:p-5 dark:border-slate-700">
				<h2
					id="gf-modal-title"
					class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
				>
					{$geofenceDraft.mode === 'edit' ? 'Editar geocerca' : 'Nueva geocerca'}
				</h2>
			</header>

			<form class="flex flex-col" on:submit|preventDefault={save} autocomplete="off">
				<div class="space-y-4 p-4 sm:p-5">
					<div class="space-y-1">
						<label for="gf-name" class="text-sm font-medium text-slate-800 dark:text-slate-200"
							>Nombre</label
						>
						<input
							id="gf-name"
							name="geofence-name"
							type="text"
							class={inputBase}
							bind:value={name}
							autocomplete="off"
							maxlength="255"
							aria-required="true"
						/>
					</div>

					<fieldset
						class="space-y-2 rounded-xl border border-slate-200/90 p-3 dark:border-slate-700"
					>
						<legend class="px-1 text-sm font-medium text-slate-800 dark:text-slate-200"
							>Apariencia</legend
						>
						<div class="flex flex-wrap items-center gap-3">
							<label for="gf-color" class="sr-only">Color de la geocerca</label>
							<input
								id="gf-color"
								name="geofence-color"
								type="color"
								class="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-600 dark:bg-slate-800"
								bind:value={color}
								aria-describedby="gf-color-hex"
							/>
							<span
								id="gf-color-hex"
								class="font-mono text-xs text-slate-600 dark:text-slate-400"
								aria-live="polite">{color}</span
							>
						</div>
					</fieldset>

					{#if $geofenceDraft.mode === 'create' && $geofenceDraft.drawKind === 'corridor'}
						<div class="space-y-1">
							<label
								for="gf-corridor"
								class="text-sm font-medium text-slate-800 dark:text-slate-200"
								>Ancho del corredor (metros)</label
							>
							<input
								id="gf-corridor"
								name="corridor-width"
								type="number"
								min="5"
								max="5000"
								step="1"
								class={inputBase}
								bind:value={corridorWidth}
								inputmode="numeric"
							/>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								Se genera un polígono alrededor de la línea (buffer). Requiere al menos dos puntos
								en la ruta.
							</p>
						</div>
					{/if}

					<fieldset
						class="space-y-3 rounded-xl border border-slate-200/90 p-3 dark:border-slate-700"
					>
						<legend class="px-1 text-sm font-medium text-slate-800 dark:text-slate-200">
							Metadata <span class="font-normal text-slate-500 dark:text-slate-400">(opcional)</span
							>
						</legend>
						<div class="space-y-2" role="group" aria-label="Metadatos clave valor">
							{#each metadataRows as row, i (row._uid)}
								<div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
									<div class="min-w-0 flex-1 space-y-0.5">
										<label class="sr-only" for="gf-meta-k-{row._uid}">Clave {i + 1}</label>
										<input
											id="gf-meta-k-{row._uid}"
											name="geofence-meta-key-{row._uid}"
											type="text"
											class="{inputBase} font-mono text-xs"
											bind:value={row.key}
											placeholder="clave"
											autocomplete="off"
											spellcheck="false"
										/>
									</div>
									<div class="min-w-0 flex-1 space-y-0.5">
										<label class="sr-only" for="gf-meta-v-{row._uid}">Valor {i + 1}</label>
										<input
											id="gf-meta-v-{row._uid}"
											name="geofence-meta-value-{row._uid}"
											type="text"
											class="{inputBase} text-sm"
											bind:value={row.value}
											placeholder="valor"
											autocomplete="off"
										/>
									</div>
									<button
										type="button"
										class="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:self-auto"
										on:click={() => removeMetadataRow(i)}
										aria-label="Quitar par {i + 1}"
									>
										Quitar
									</button>
								</div>
							{/each}
						</div>
						<button
							type="button"
							class="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-400/60 hover:bg-emerald-50/80 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:text-slate-400 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
							on:click={addMetadataRow}
							disabled={metadataRows.length >= MAX_METADATA_ROWS}
						>
							{#if metadataRows.length >= MAX_METADATA_ROWS}
								Límite de {MAX_METADATA_ROWS} metadatos
							{:else}
								+ Añadir metadato ({metadataRows.length}/{MAX_METADATA_ROWS})
							{/if}
						</button>
					</fieldset>

					{#if error}
						<div
							class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
							role="alert"
							aria-live="polite"
						>
							{error}
						</div>
					{/if}
				</div>

				<footer
					class="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end sm:p-5 dark:border-slate-700"
				>
					<button
						type="button"
						class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 sm:w-auto dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
						on:click={close}
					>
						Cancelar
					</button>
					<button
						type="submit"
						class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto dark:focus-visible:ring-offset-slate-900"
					>
						{$geofenceDraft.mode === 'edit' ? 'Guardar cambios' : 'Guardar geocerca'}
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
