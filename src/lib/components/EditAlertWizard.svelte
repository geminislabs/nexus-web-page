<!-- src/lib/components/EditAlertWizard.svelte -->
<script>
	import Icon from '@iconify/svelte';
	import { createEventDispatcher } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { vehicles } from '$lib/stores/vehicleStore.js';
	import { alertActions } from '$lib/stores/alertStore.js';
	import { user } from '$lib/stores/auth.js';
	import { get } from 'svelte/store';

	export let alert; // objeto alert del store

	const dispatch = createEventDispatcher();

	let step = 1; // 1 = nombre, 2 = unidades
	let editName = alert.name ?? '';
	let selectedUnitIds = new SvelteSet(alert.units ?? []);
	let saving = false;
	let deleting = false;
	let showDeleteConfirm = false;
	let error = null;

	$: hasChanges =
		editName.trim() !== alert.name || !setsEqual(selectedUnitIds, new SvelteSet(alert.units ?? []));
	$: canSave =
		editName.trim().length > 0 && selectedUnitIds.size > 0 && hasChanges && !saving && !deleting;
	$: allSelected = $vehicles.length > 0 && selectedUnitIds.size === $vehicles.length;

	function setsEqual(a, b) {
		if (a.size !== b.size) return false;
		for (const v of a) if (!b.has(v)) return false;
		return true;
	}

	function toggleUnit(id) {
		if (selectedUnitIds.has(id)) selectedUnitIds.delete(id);
		else selectedUnitIds.add(id);
	}

	function toggleAll() {
		selectedUnitIds = allSelected ? new SvelteSet() : new SvelteSet($vehicles.map((v) => v.id));
	}

	function close() {
		dispatch('close');
	}

	function onKeydown(e) {
		if (e.key === 'Escape') close();
	}

	async function save() {
		if (!get(user)?.is_master || !canSave) return;
		saving = true;
		error = null;
		try {
			await alertActions.updateAlert(alert.id, {
				name: editName.trim(),
				unit_ids: [...selectedUnitIds]
			});
			dispatch('close');
		} catch (err) {
			error = err?.message || 'No se pudo guardar la alerta';
		} finally {
			saving = false;
		}
	}

	async function deleteAlert() {
		if (!get(user)?.is_master) return;
		deleting = true;
		error = null;
		try {
			await alertActions.deleteAlert(alert.id);
			dispatch('close');
		} catch (err) {
			error = err?.message || 'No se pudo eliminar la alerta';
			showDeleteConfirm = false;
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:window on:keydown={onKeydown} />

<div
	class="fixed inset-0 z-[150] flex flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-[#060b18] dark:text-white max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))]"
	role="dialog"
	aria-modal="true"
	aria-labelledby="eaw-title"
>
	<!-- Header -->
	<div
		class="shrink-0 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#060b18]/95"
	>
		<div class="flex gap-[3px] px-4 pt-3">
			{#each [1, 2] as s (s)}
				<div
					class="h-[3px] flex-1 rounded-full transition-all duration-300 {step > s
						? 'bg-blue-600/50'
						: step === s
							? 'bg-blue-500'
							: 'bg-slate-300 dark:bg-white/[0.08]'}"
					aria-hidden="true"
				></div>
			{/each}
		</div>
		<header class="flex items-center gap-3 px-4 py-3">
			<button
				type="button"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-0 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1]"
				on:click={close}
				aria-label="Cancelar edición"
			>
				<Icon icon="mdi:close" width={17} aria-hidden="true" />
			</button>
			<div class="min-w-0 flex-1">
				<h2 id="eaw-title" class="m-0 text-[15px] font-bold text-slate-900 dark:text-white">
					Editar alerta
				</h2>
				<p class="m-0 text-[10px] text-slate-500 dark:text-white/35">Paso {step} de 2</p>
			</div>
			<span
				class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {alert.type ===
				'ignition'
					? 'bg-blue-600/20 text-blue-300'
					: 'bg-emerald-500/20 text-emerald-300'}"
			>
				<Icon
					icon={alert.type === 'ignition' ? 'mdi:lightning-bolt' : 'mdi:map-marker-radius'}
					width={11}
					aria-hidden="true"
				/>
				{alert.type === 'ignition' ? 'Ignición' : 'Zona'}
			</span>
		</header>
	</div>

	<!-- Content -->
	<main class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
		{#if step === 1}
			<h3 class="m-0 mb-1.5 text-[17px] font-bold">Nombre de la alerta</h3>
			<p class="mb-4 text-[12px] leading-relaxed text-slate-600 dark:text-white/40">
				El nombre aparece en el historial y notificaciones.
			</p>
			<label
				for="eaw-name"
				class="mb-1.5 block text-[12px] font-medium text-slate-600 dark:text-white/55"
				>Nombre visible</label
			>
			<input
				id="eaw-name"
				type="text"
				class="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/65 focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/[0.14] dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/25"
				placeholder="Ej: Motor encendido nocturno"
				autocomplete="off"
				maxlength="255"
				bind:value={editName}
				on:keydown={(e) => e.key === 'Enter' && editName.trim() && (step = 2)}
			/>

			<!-- Resumen -->
			<div
				class="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.07] dark:bg-white/[0.04]"
			>
				<p
					class="m-0 mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/30"
				>
					Estado actual
				</p>
				<dl class="m-0 space-y-2">
					{#each [['Condición', { on: 'Encendido', off: 'Apagado', enter: 'Entrada a zona', exit: 'Salida de zona' }[alert.condition] ?? alert.condition], ['Unidades', `${alert.units.length} asignada${alert.units.length !== 1 ? 's' : ''}`], ['Estado', alert.enabled ? 'Activa' : 'Inactiva']] as [dt, dd] (dt)}
						<div class="flex items-center justify-between gap-3">
							<dt class="m-0 text-[12px] text-slate-600 dark:text-white/45">{dt}</dt>
							<dd class="m-0 text-[12px] font-semibold text-slate-900 dark:text-white">{dd}</dd>
						</div>
					{/each}
				</dl>
			</div>

			<!-- Eliminar alerta (igual que iOS y Android) -->
			{#if !showDeleteConfirm}
				<button
					type="button"
					class="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3.5 text-[14px] font-semibold text-red-500 transition-colors hover:bg-red-500/15 dark:text-red-400"
					on:click={() => (showDeleteConfirm = true)}
					disabled={deleting}
				>
					<Icon icon="mdi:delete-outline" class="h-5 w-5" aria-hidden="true" />
					Eliminar alerta
				</button>
			{:else}
				<div class="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4">
					<p class="m-0 mb-3 text-[14px] text-slate-900 dark:text-white">
						¿Eliminar <strong>«{alert.name}»</strong>? Esta acción no se puede deshacer.
					</p>
					<div class="flex gap-2">
						<button
							type="button"
							class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70"
							on:click={() => (showDeleteConfirm = false)}
							disabled={deleting}>Cancelar</button
						>
						<button
							type="button"
							class="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
							on:click={deleteAlert}
							disabled={deleting}
						>
							{deleting ? 'Eliminando…' : 'Eliminar'}
						</button>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Paso 2: Unidades -->
			<h3 class="m-0 mb-1 text-[17px] font-bold">Unidades asignadas</h3>
			<p class="mb-4 text-[12px] leading-relaxed text-slate-600 dark:text-white/40">
				Selecciona las unidades que dispararán esta alerta.
			</p>
			<div class="mb-3 flex items-center justify-between">
				<span class="text-[11px] text-slate-600 dark:text-white/45"
					>{selectedUnitIds.size} seleccionada{selectedUnitIds.size !== 1 ? 's' : ''}</span
				>
				<button
					type="button"
					class="border-0 bg-transparent text-[12px] font-semibold text-blue-400 hover:text-blue-300"
					on:click={toggleAll}
				>
					{allSelected ? 'Desmarcar todas' : 'Seleccionar todas'}
				</button>
			</div>
			{#if $vehicles.length === 0}
				<p class="py-8 text-center text-[13px] text-slate-600 dark:text-white/38">
					No hay unidades disponibles.
				</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each $vehicles as vehicle (vehicle.id)}
						{@const selected = selectedUnitIds.has(vehicle.id)}
						<button
							type="button"
							class="flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left transition-all duration-150 {selected
								? 'border-blue-500 bg-blue-600/10'
								: 'border-slate-200 bg-white hover:border-slate-300 dark:border-transparent dark:bg-white/[0.05] dark:hover:border-white/[0.1]'}"
							on:click={() => toggleUnit(vehicle.id)}
							aria-pressed={selected}
						>
							<span
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors {selected
									? 'border-blue-500 bg-blue-500'
									: 'border-slate-300 dark:border-white/25'}"
								aria-hidden="true"
							>
								{#if selected}<Icon
										icon="mdi:check"
										width={13}
										class="text-white"
										aria-hidden="true"
									/>{/if}
							</span>
							<div class="min-w-0 flex-1">
								<p class="m-0 text-[13px] font-semibold leading-snug">{vehicle.name}</p>
								<p class="m-0 mt-0.5 text-[11px] text-slate-600 dark:text-white/40">
									{vehicle.driver || 'Sin conductor'}
								</p>
							</div>
							<span
								class="h-2 w-2 shrink-0 rounded-full {vehicle.status === 'active'
									? 'bg-emerald-500'
									: 'bg-slate-300 dark:bg-white/20'}"
								aria-hidden="true"
							></span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}

		{#if error}
			<p class="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-400">{error}</p>
		{/if}
	</main>

	<!-- Footer -->
	<footer
		class="flex shrink-0 gap-3 border-t border-slate-200 bg-slate-100 px-4 py-3 sm:py-4 dark:border-white/[0.07] dark:bg-[#060b18]"
	>
		{#if step === 1}
			<button
				type="button"
				class="h-12 flex-1 rounded-[14px] border border-slate-300 bg-white text-[14px] font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white/65"
				on:click={close}>Cancelar</button
			>
			<button
				type="button"
				class="h-12 flex-[2] rounded-[14px] bg-gradient-to-br from-blue-600 to-cyan-600 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!editName.trim()}
				on:click={() => (step = 2)}
			>
				Siguiente
			</button>
		{:else}
			<button
				type="button"
				class="h-12 flex-1 rounded-[14px] border border-slate-300 bg-white text-[14px] font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white/65"
				on:click={() => (step = 1)}>Atrás</button
			>
			<button
				type="button"
				class="h-12 flex-[2] rounded-[14px] bg-gradient-to-br from-emerald-600 to-teal-600 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!canSave}
				on:click={save}
			>
				{#if saving}
					<span class="flex items-center justify-center gap-2"
						><span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>Guardando…</span
					>
				{:else}
					<span class="flex items-center justify-center gap-2"
						><Icon icon="mdi:check-circle-outline" width={18} aria-hidden="true" />Guardar cambios</span
					>
				{/if}
			</button>
		{/if}
	</footer>
</div>
