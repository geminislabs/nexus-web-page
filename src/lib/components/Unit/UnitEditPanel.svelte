<script>
	import { createEventDispatcher } from 'svelte';
	import { vehicleActions } from '$lib/stores/vehicleStore.js';
	import { vehicleColors } from '$lib/data/vehicleColors';
	import { user } from '$lib/stores/auth.js';
	import IconPicker from '$lib/components/Unit/IconPicker.svelte';
	import VehicleColorPicker from '$lib/components/Unit/VehicleColorPicker.svelte';

	const dispatch = createEventDispatcher();

	/** @type {Record<string, unknown> | null} */
	export let unit = null;
	/** Formulario compacto para drawer de escritorio */
	export let compact = false;

	$: isMaster = !!$user?.is_master;

	let isSaving = false;
	let lastPopulatedId = '';
	let editName = '';
	let editDescription = '';
	let editBrand = '';
	let editModel = '';
	let editYear = '';
	let editPlate = '';
	let editVin = '';
	let editColor = '';
	let editIconType = 'vehicle-car-sedan';
	let editExistingDeviceId = '';
	let editNewDeviceId = '';
	let saveError = null;
	let unassigning = false;
	let showUnassignConfirm = false;
	let showDeleteConfirm = false;
	let deleting = false;

	const uid = `uep-${Math.random().toString(36).slice(2, 9)}`;

	$: inputClass = compact
		? 'h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500/60 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30'
		: 'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30';

	$: sectionClass = compact
		? 'mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40'
		: 'mb-2 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40';

	$: selectedColorHex = vehicleColors.find((c) => c.slug === editColor)?.hex ?? null;

	/** @param {Record<string, unknown>} v */
	function populateFromUnit(v) {
		editName = String(v.name || '');
		editDescription = String(v.description || '');
		editBrand = String(v.brand || '');
		editModel = String(v.model || '');
		editYear = v.year ? String(v.year) : '';
		editPlate = String(v.plate || v.vehicle?.plate || '');
		editVin = String(v.vin || v.vehicle?.vin || '');
		editColor = String(v.color || '');
		editIconType = String(v.icon_type || v.iconType || 'vehicle-car-sedan');
		editExistingDeviceId = String(v.deviceId || '');
		editNewDeviceId = '';
		showDeleteConfirm = false;
		showUnassignConfirm = false;
		saveError = null;
	}

	$: if (unit?.id && String(unit.id) !== lastPopulatedId) {
		lastPopulatedId = String(unit.id);
		populateFromUnit(unit);
	}
	$: if (!unit?.id) lastPopulatedId = '';

	function unitFormPayload() {
		return {
			name: editName.trim(),
			description: editDescription.trim() || null,
			brand: editBrand.trim() || null,
			model: editModel.trim() || null,
			year: editYear ? parseInt(editYear) || null : null,
			plate: editPlate.trim() || null,
			vin: editVin.trim() || null,
			color: editColor || null,
			icon_type: editIconType || null
		};
	}

	function handleCancel() {
		dispatch('cancel');
	}

	async function handleSave() {
		if (!isMaster || !unit?.id || isSaving) return;
		const name = editName.trim();
		if (!name) {
			saveError = 'El nombre es obligatorio.';
			return;
		}
		saveError = null;
		isSaving = true;
		try {
			await vehicleActions.updateVehicle(String(unit.id), unitFormPayload());
			const newDeviceId = editNewDeviceId.trim();
			if (newDeviceId && newDeviceId !== editExistingDeviceId) {
				await vehicleActions.updateUnitDevice(String(unit.id), newDeviceId);
			}
			dispatch('saved');
		} catch (err) {
			saveError = err?.message || 'No se pudo guardar.';
		} finally {
			isSaving = false;
		}
	}

	async function confirmUnassignDevice() {
		if (!isMaster || !unit?.id || unassigning) return;
		unassigning = true;
		saveError = null;
		try {
			await vehicleActions.updateUnitDevice(String(unit.id), null);
			editExistingDeviceId = '';
			editNewDeviceId = '';
			showUnassignConfirm = false;
		} catch (err) {
			saveError = err?.message || 'No se pudo desasignar el dispositivo.';
			showUnassignConfirm = false;
		} finally {
			unassigning = false;
		}
	}

	async function confirmDelete() {
		if (!isMaster || !unit?.id || deleting) return;
		deleting = true;
		saveError = null;
		try {
			await vehicleActions.deleteVehicle(String(unit.id));
			dispatch('deleted');
		} catch (err) {
			saveError = err?.message || 'No se pudo eliminar la unidad.';
			showDeleteConfirm = false;
		} finally {
			deleting = false;
		}
	}
</script>

{#if unit}
	<div class="space-y-3">
		{#if saveError}
			<p
				class="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400"
				role="alert"
			>
				{saveError}
			</p>
		{/if}

		<div>
			<p class={sectionClass}>Identidad</p>
			<div class="mb-2 flex items-center gap-3">
				<IconPicker
					currentIcon={editIconType}
					colorHex={selectedColorHex}
					editable={true}
					onSelect={(slug) => (editIconType = slug)}
				/>
				<VehicleColorPicker selectedColor={editColor} onSelect={(slug) => (editColor = slug)} />
			</div>
			<div class="grid gap-2 {compact ? 'sm:grid-cols-2' : ''}">
				<div>
					<label
						for="{uid}-name"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55"
						>Nombre *</label
					>
					<input
						id="{uid}-name"
						type="text"
						class={inputClass}
						maxlength="100"
						bind:value={editName}
					/>
				</div>
				<div>
					<label
						for="{uid}-desc"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55"
						>Descripción</label
					>
					<input
						id="{uid}-desc"
						type="text"
						class={inputClass}
						maxlength="255"
						bind:value={editDescription}
					/>
				</div>
			</div>
		</div>

		<div>
			<p class={sectionClass}>Vehículo</p>
			<div class="grid gap-2 sm:grid-cols-2">
				<div>
					<label
						for="{uid}-brand"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55"
						>Marca</label
					>
					<input id="{uid}-brand" type="text" class={inputClass} bind:value={editBrand} />
				</div>
				<div>
					<label
						for="{uid}-model"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55"
						>Modelo</label
					>
					<input id="{uid}-model" type="text" class={inputClass} bind:value={editModel} />
				</div>
				<div class="sm:col-span-2">
					<label
						for="{uid}-year"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55">Año</label
					>
					<input
						id="{uid}-year"
						type="number"
						class={inputClass}
						min="1900"
						max="2100"
						bind:value={editYear}
					/>
				</div>
			</div>
		</div>

		<div>
			<p class={sectionClass}>Identificación</p>
			<div class="grid gap-2 sm:grid-cols-2">
				<div>
					<label
						for="{uid}-plate"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55"
						>Placa</label
					>
					<input id="{uid}-plate" type="text" class={inputClass} bind:value={editPlate} />
				</div>
				<div>
					<label
						for="{uid}-vin"
						class="mb-1 block text-[11px] font-medium text-slate-600 dark:text-white/55">VIN</label
					>
					<input
						id="{uid}-vin"
						type="text"
						class="{inputClass} font-mono uppercase tracking-widest"
						bind:value={editVin}
					/>
				</div>
			</div>
		</div>

		<div>
			<p class={sectionClass}>Dispositivo</p>
			{#if editExistingDeviceId}
				<div
					class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]"
				>
					<p class="m-0 font-mono text-[11px] font-semibold text-slate-800 dark:text-white">
						{editExistingDeviceId}
					</p>
					{#if !showUnassignConfirm}
						<button
							type="button"
							class="mt-2 text-[11px] font-semibold text-red-500 hover:text-red-400"
							on:click={() => (showUnassignConfirm = true)}
							disabled={unassigning}
						>
							Desasignar dispositivo
						</button>
					{:else}
						<p class="m-0 mt-2 text-[11px] text-slate-700 dark:text-white/80">
							¿Desasignar el dispositivo?
						</p>
						<div class="mt-2 flex gap-2">
							<button
								type="button"
								class="flex-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold dark:border-white/10"
								on:click={() => (showUnassignConfirm = false)}
								disabled={unassigning}>Cancelar</button
							>
							<button
								type="button"
								class="flex-1 rounded-lg bg-red-600 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
								on:click={confirmUnassignDevice}
								disabled={unassigning}>{unassigning ? '…' : 'Desasignar'}</button
							>
						</div>
					{/if}
				</div>
			{:else}
				<input
					id="{uid}-device"
					type="text"
					class="{inputClass} font-mono"
					placeholder="Device ID (opcional)"
					bind:value={editNewDeviceId}
				/>
			{/if}
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-white/[0.06]"
		>
			{#if !showDeleteConfirm}
				<button
					type="button"
					class="text-[11px] font-semibold text-red-500 hover:text-red-400"
					on:click={() => (showDeleteConfirm = true)}
					disabled={deleting || isSaving}
				>
					Eliminar unidad
				</button>
			{:else}
				<div class="flex flex-1 flex-wrap items-center gap-2">
					<span class="text-[11px] text-slate-700 dark:text-white/75">¿Eliminar unidad?</span>
					<button
						type="button"
						class="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold dark:border-white/10"
						on:click={() => (showDeleteConfirm = false)}
						disabled={deleting}>No</button
					>
					<button
						type="button"
						class="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
						on:click={confirmDelete}
						disabled={deleting}>{deleting ? '…' : 'Sí, eliminar'}</button
					>
				</div>
			{/if}
			<div class="ml-auto flex gap-2">
				<button
					type="button"
					class="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70"
					on:click={handleCancel}
					disabled={isSaving || deleting}>Cancelar</button
				>
				<button
					type="button"
					class="h-8 rounded-lg border border-emerald-500/25 bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
					on:click={handleSave}
					disabled={isSaving || deleting || !editName.trim()}
					>{isSaving ? 'Guardando…' : 'Guardar'}</button
				>
			</div>
		</div>
	</div>
{/if}
