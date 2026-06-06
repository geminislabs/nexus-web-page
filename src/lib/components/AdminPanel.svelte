<script>
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { apiService } from '$lib/services/api.js';
	import { vehicleColors } from '$lib/data/vehicleColors';
	import { user } from '$lib/stores/auth.js';
	import { vehicleActions } from '$lib/stores/vehicleStore.js';
	import { mapService } from '$lib/services/mapService.js';
	import IconPicker from '$lib/components/Unit/IconPicker.svelte';
	import ConfirmModal from './ConfirmModal.svelte';
	import AssignUnits from './AssignUnits.svelte';
	import InviteUser from './InviteUser.svelte';

	export let showAdminPanel = false;
	export let toggleAdminPanel = null;
	export let embedded = false;

	const adminTabs = [
		{
			id: 'dispositivos',
			label: 'Dispositivos',
			icon: 'mdi:memory',
			hint: 'GPS registrados en tu organización'
		},
		{
			id: 'unidades',
			label: 'Unidades',
			icon: 'mdi:car-side',
			hint: 'Crea unidades y vincula un dispositivo a cada una'
		},
		{
			id: 'usuarios',
			label: 'Usuarios',
			icon: 'mdi:account-group-outline',
			hint: 'Invita por correo y define qué unidades puede ver cada persona'
		}
	];

	const statusConfig = {
		nuevo: {
			label: 'Nuevo',
			dot: 'bg-slate-400',
			pill: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70'
		},
		enviado: {
			label: 'Enviado',
			dot: 'bg-slate-400',
			pill: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70'
		},
		entregado: {
			label: 'Entregado',
			dot: 'bg-amber-500',
			pill: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
		},
		asignado: {
			label: 'Asignado',
			dot: 'bg-emerald-500',
			pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
		},
		devuelto: {
			label: 'Devuelto',
			dot: 'bg-slate-900',
			pill: 'bg-slate-200 text-slate-800 dark:bg-white/15 dark:text-white/80'
		},
		inactivo: {
			label: 'Inactivo',
			dot: 'bg-red-500',
			pill: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
		}
	};

	const inputClass =
		'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30';
	const selectClass = `${inputClass} appearance-none pr-9`;
	const cardClass =
		'rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.03]';
	const btnPrimary =
		'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
	const btnDanger =
		'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20';

	let activeSection = 'dispositivos';

	let devices = [];
	let loadingDevices = false;
	let devicesError = null;
	let selectedListDeviceId = null;

	let units = [];
	let loadingUnits = false;
	let unitsError = null;
	let newUnitName = '';
	let creatingUnit = false;
	let selectedUnitId = null;
	let unassignedDevices = [];
	let loadingUnassignedDevices = false;
	let selectedDeviceId = '';
	let assigningDevice = false;

	let unitProfile = null;
	let loadingProfile = false;
	let updatingProfileField = null;
	let showColorPicker = false;

	let unassignTarget = null;
	let unassignLoading = false;

	async function setActiveSection(id) {
		activeSection = id;
		if (id === 'dispositivos') await loadDevices();
		if (id === 'unidades' && units.length === 0) await loadUnits();
	}

	async function loadDevices() {
		loadingDevices = true;
		devicesError = null;
		try {
			devices = await apiService.getMyDevices();
		} catch (err) {
			console.error('Error al cargar dispositivos:', err);
			devicesError = err.displayMessage || err.message || 'Error al cargar dispositivos';
		} finally {
			loadingDevices = false;
		}
	}

	async function loadUnits() {
		loadingUnits = true;
		unitsError = null;
		try {
			units = await apiService.getUnits();
		} catch (err) {
			console.error('Error al cargar unidades:', err);
			unitsError = err.displayMessage || err.message || 'Error al cargar unidades';
		} finally {
			loadingUnits = false;
		}
	}

	async function createUnit() {
		if (!newUnitName.trim()) {
			unitsError = 'El nombre de la unidad es requerido';
			return;
		}
		creatingUnit = true;
		unitsError = null;
		try {
			await apiService.createUnit({ name: newUnitName.trim() });
			newUnitName = '';
			await loadUnits();
		} catch (err) {
			console.error('Error al crear unidad:', err);
			unitsError = err.displayMessage || err.message || 'Error al crear la unidad';
		} finally {
			creatingUnit = false;
		}
	}

	async function selectUnit(unitId) {
		selectedUnitId = selectedUnitId === unitId ? null : unitId;
		if (!selectedUnitId) return;
		const unit = units.find((u) => u.id === unitId);
		if (unit && !unit.device_id) loadUnassignedDevices();
		loadUnitProfile(unitId);
	}

	async function loadUnitProfile(unitId) {
		loadingProfile = true;
		unitProfile = null;
		try {
			unitProfile = await apiService.getUnitProfile(unitId);
		} catch (err) {
			console.error('Error al cargar perfil de unidad:', err);
		} finally {
			loadingProfile = false;
		}
	}

	async function handleProfileUpdate(field, value, event = null) {
		if (event && event.key !== 'Enter') return;
		updatingProfileField = field;
		try {
			const updatedProfile = await apiService.updateUnitProfile(selectedUnitId, { [field]: value });
			unitProfile = updatedProfile;
			if (field === 'color') showColorPicker = false;
			const unit = units.find((u) => u.id === selectedUnitId);
			if (unit?.device_id) {
				const updates = {};
				if (field === 'color') updates.color = value;
				if (field === 'icon_type') updates.icon_type = value;
				if (Object.keys(updates).length > 0) {
					vehicleActions.updateVehicle(unit.device_id, updates);
					try {
						mapService.updateVehicleMarker({ ...unit, ...updates });
					} catch (e) {
						console.error('Error updating map marker from admin panel:', e);
					}
				}
			}
			if (event?.target) event.target.blur();
		} catch (err) {
			console.error(`Error al actualizar ${field}:`, err);
		} finally {
			updatingProfileField = null;
		}
	}

	async function loadUnassignedDevices() {
		loadingUnassignedDevices = true;
		try {
			unassignedDevices = await apiService.getUnassignedDevices();
			selectedDeviceId = '';
		} catch (err) {
			console.error('Error al cargar dispositivos no asignados:', err);
			unitsError = err.displayMessage || err.message || 'Error al cargar dispositivos';
		} finally {
			loadingUnassignedDevices = false;
		}
	}

	async function assignDevice(unitId) {
		if (!selectedDeviceId) {
			unitsError = 'Selecciona un dispositivo';
			return;
		}
		assigningDevice = true;
		unitsError = null;
		try {
			await apiService.assignDeviceToUnit(unitId, selectedDeviceId);
			selectedDeviceId = '';
			await Promise.all([loadUnits(), loadDevices()]);
		} catch (err) {
			console.error('Error al asignar dispositivo:', err);
			unitsError = err.displayMessage || err.message || 'Error al asignar el dispositivo';
		} finally {
			assigningDevice = false;
		}
	}

	function requestUnassign(unit) {
		unassignTarget = unit;
	}

	async function confirmUnassign() {
		if (!unassignTarget || unassignLoading) return;
		unassignLoading = true;
		unitsError = null;
		try {
			await apiService.unassignDeviceFromUnit(unassignTarget.assignment_id || unassignTarget.id);
			selectedUnitId = null;
			unassignTarget = null;
			await Promise.all([loadUnits(), loadDevices()]);
		} catch (err) {
			console.error('Error al desasignar dispositivo:', err);
			unitsError = err.displayMessage || err.message || 'Error al desasignar el dispositivo';
		} finally {
			unassignLoading = false;
		}
	}

	function selectListDevice(deviceId) {
		selectedListDeviceId = selectedListDeviceId === deviceId ? null : deviceId;
	}

	$: selectedUnit = selectedUnitId ? units.find((u) => u.id === selectedUnitId) : null;
	$: activeTabHint = adminTabs.find((t) => t.id === activeSection)?.hint ?? '';

	onMount(() => {
		if (embedded || showAdminPanel) setActiveSection(activeSection);
	});
</script>

{#if !embedded}
	<button
		on:click={toggleAdminPanel || (() => (showAdminPanel = !showAdminPanel))}
		aria-label="Abrir panel de administración"
		class="nav-button"
	>
		<Icon icon="mdi:shield-account-outline" class="menu-icon h-5 w-5" aria-hidden="true" />
	</button>
{/if}

{#if showAdminPanel || embedded}
	<div class="admin-panel" class:embedded>
		{#if !embedded}
			<p class="admin-title">Administración</p>
		{/if}

		<div class="tabs-wrapper">
			<div class="tabs-bar" role="tablist" aria-label="Secciones de administración">
				{#each adminTabs as tab}
					<button
						type="button"
						role="tab"
						aria-selected={activeSection === tab.id}
						class="tab-btn"
						class:tab-btn--active={activeSection === tab.id}
						on:click={() => setActiveSection(tab.id)}
					>
						<Icon icon={tab.icon} class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="truncate">{tab.label}</span>
					</button>
				{/each}
			</div>
			{#if activeTabHint}
				<p class="tab-hint">{activeTabHint}</p>
			{/if}
		</div>

		{#if activeSection === 'dispositivos'}
			<div class="tab-content">
				{#if !loadingDevices && !devicesError && devices.length > 0}
					<p class="count-label">{devices.length} dispositivo{devices.length === 1 ? '' : 's'}</p>
				{/if}
				{#if loadingDevices}
					<div class="loading-row">
						<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
						<span>Cargando dispositivos…</span>
					</div>
				{:else if devicesError}
					<p class="error-msg">{devicesError}</p>
				{:else if devices.length === 0}
					<div class="empty-state">
						<Icon icon="mdi:memory-off" width={24} class="opacity-30" aria-hidden="true" />
						Sin dispositivos registrados
					</div>
				{:else}
					<ul class="item-list">
						{#each devices as device}
							<li>
								<button
									type="button"
									class="item-row"
									class:item-row--selected={selectedListDeviceId === device.device_id}
									on:click={() => selectListDevice(device.device_id)}
								>
									<div class="item-row__left">
										<span
											class="status-dot {statusConfig[device.status]?.dot || 'bg-slate-400'}"
											aria-hidden="true"
										></span>
										<div class="min-w-0">
											<p class="item-row__id" title={device.device_id}>{device.device_id}</p>
											{#if device.unit_name}
												<p class="item-row__sub">{device.unit_name}</p>
											{/if}
										</div>
									</div>
									<span
										class="status-pill {statusConfig[device.status]?.pill ||
											'bg-slate-100 text-slate-700'}"
									>
										{statusConfig[device.status]?.label || device.status}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else if activeSection === 'unidades'}
			<div class="tab-content">
				{#if loadingUnits}
					<div class="loading-row">
						<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
						<span>Cargando unidades…</span>
					</div>
				{:else if unitsError}
					<p class="error-msg">{unitsError}</p>
				{:else}
					{#if units.length > 0}
						<p class="count-label">{units.length} unidad{units.length === 1 ? '' : 'es'}</p>
					{/if}
					<ul class="item-list">
						{#each units as unit}
							<li>
								<button
									type="button"
									class="item-row"
									class:item-row--selected={selectedUnitId === unit.id}
									on:click={() => selectUnit(unit.id)}
								>
									<span class="unit-icon" class:unit-icon--active={selectedUnitId === unit.id}>
										<Icon icon="mdi:car-side" width={16} aria-hidden="true" />
									</span>
									<div class="min-w-0 flex-1 text-left">
										<p class="item-row__name">{unit.name}</p>
										{#if unit.device_id}
											<p class="item-row__device">{unit.device_id}</p>
										{:else}
											<p class="item-row__no-device">Sin dispositivo</p>
										{/if}
									</div>
									{#if unit.device_id}
										<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true"
										></span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>

					{#if selectedUnit}
						<div class="detail-card">
							<div class="detail-card__header">
								<Icon
									icon="mdi:information-outline"
									width={14}
									class="text-blue-400"
									aria-hidden="true"
								/>
								<h4 class="detail-card__title">Detalle de unidad</h4>
							</div>

							{#if loadingProfile}
								<div class="loading-row">
									<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
									<span>Cargando perfil…</span>
								</div>
							{:else if unitProfile}
								<div class="detail-card__icon-row">
									<IconPicker
										currentIcon={unitProfile.icon_type}
										colorHex={unitProfile.color
											? vehicleColors.find((c) => c.slug === unitProfile.color)?.hex
											: null}
										editable={$user?.is_master}
										onSelect={(slug) => handleProfileUpdate('icon_type', slug)}
									/>
									<div class="min-w-0">
										<p class="field-label">Nombre</p>
										<p class="field-value truncate">{selectedUnit.name}</p>
									</div>
								</div>

								<div class="fields-grid">
									<label class="field-block">
										<span class="field-label">Descripción</span>
										<input
											type="text"
											value={unitProfile.description || ''}
											placeholder="—"
											class="field-input"
											on:keydown={(e) =>
												handleProfileUpdate('description', e.currentTarget.value, e)}
										/>
									</label>
									<label class="field-block">
										<span class="field-label">Marca</span>
										<input
											type="text"
											value={unitProfile.brand || ''}
											placeholder="—"
											class="field-input"
											on:keydown={(e) => handleProfileUpdate('brand', e.currentTarget.value, e)}
										/>
									</label>
									<label class="field-block">
										<span class="field-label">Modelo</span>
										<input
											type="text"
											value={unitProfile.model || ''}
											placeholder="—"
											class="field-input"
											on:keydown={(e) => handleProfileUpdate('model', e.currentTarget.value, e)}
										/>
									</label>
									<label class="field-block">
										<span class="field-label">Año</span>
										<input
											type="number"
											value={unitProfile.year || ''}
											placeholder="—"
											class="field-input"
											on:keydown={(e) =>
												handleProfileUpdate('year', parseInt(e.currentTarget.value) || null, e)}
										/>
									</label>
									<label class="field-block">
										<span class="field-label">Placa</span>
										<input
											type="text"
											value={unitProfile.vehicle?.plate || ''}
											placeholder="—"
											class="field-input font-mono uppercase"
											on:keydown={(e) => handleProfileUpdate('plate', e.currentTarget.value, e)}
										/>
									</label>
									<label class="field-block">
										<span class="field-label">VIN</span>
										<input
											type="text"
											value={unitProfile.vehicle?.vin || ''}
											placeholder="—"
											class="field-input font-mono uppercase"
											on:keydown={(e) => handleProfileUpdate('vin', e.currentTarget.value, e)}
										/>
									</label>
								</div>

								<div>
									<span class="field-label">Color</span>
									<div class="relative inline-block mt-1">
										<button
											type="button"
											class="color-swatch"
											class:ring-2={showColorPicker}
											style="background-color: {unitProfile.color
												? vehicleColors.find((c) => c.slug === unitProfile.color)?.hex ||
													'transparent'
												: 'transparent'};"
											on:click={() => {
												if ($user?.is_master) showColorPicker = !showColorPicker;
											}}
											aria-label="Seleccionar color"
										>
										</button>
										{#if showColorPicker && $user?.is_master}
											<div class="color-picker">
												{#each vehicleColors as color}
													<button
														type="button"
														class="color-chip"
														class:ring-2={unitProfile.color === color.slug}
														style="background-color: {color.hex};"
														on:click={() => handleProfileUpdate('color', color.slug)}
														title={color.slug}
													>
													</button>
												{/each}
											</div>
											<button
												type="button"
												class="fixed inset-0 z-10 cursor-default"
												aria-label="Cerrar"
												on:click={() => (showColorPicker = false)}
											></button>
										{/if}
									</div>
								</div>
							{/if}

							{#if selectedUnit.device_id}
								<button
									type="button"
									class="btn-danger"
									on:click={() => requestUnassign(selectedUnit)}
								>
									<Icon icon="mdi:link-off" width={14} aria-hidden="true" />
									Desasignar dispositivo
								</button>
							{:else}
								<div class="assign-box">
									<p class="assign-box__label">Asignar dispositivo</p>
									{#if loadingUnassignedDevices}
										<div class="loading-row">
											<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
											<span>Cargando…</span>
										</div>
									{:else if unassignedDevices.length === 0}
										<p class="assign-box__empty">No hay dispositivos libres</p>
									{:else}
										<div class="relative">
											<select bind:value={selectedDeviceId} class="field-select">
												<option value="">Seleccionar dispositivo…</option>
												{#each unassignedDevices as device}
													<option value={device.device_id}
														>{device.device_id} · {device.brand} {device.model}</option
													>
												{/each}
											</select>
											<Icon
												icon="mdi:chevron-down"
												width={16}
												class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-50"
												aria-hidden="true"
											/>
										</div>
										<button
											type="button"
											class="btn-primary w-full"
											disabled={!selectedDeviceId || assigningDevice}
											on:click={() => assignDevice(selectedUnit.id)}
										>
											{#if assigningDevice}
												<Icon icon="mdi:loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
												Asignando…
											{:else}
												<Icon icon="mdi:check" width={16} aria-hidden="true" />
												Confirmar asignación
											{/if}
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<div class="new-unit-row">
						<p class="new-unit-row__label">Nueva unidad</p>
						<input
							type="text"
							bind:value={newUnitName}
							placeholder="Nombre de la unidad"
							class="field-input w-full min-w-0"
							on:keydown={(e) => e.key === 'Enter' && createUnit()}
							disabled={creatingUnit}
						/>
						<button
							type="button"
							class="btn-primary w-full"
							on:click={createUnit}
							disabled={creatingUnit || !newUnitName.trim()}
							aria-label="Agregar unidad"
						>
							{#if creatingUnit}
								<Icon icon="mdi:loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
								Creando…
							{:else}
								<Icon icon="mdi:plus" width={16} aria-hidden="true" />
								Agregar unidad
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{:else if activeSection === 'usuarios'}
			<div class="tab-content">
				<div class="info-card">
					<div class="info-card__header">
						<Icon
							icon="mdi:email-send-outline"
							width={14}
							class="text-blue-400"
							aria-hidden="true"
						/>
						<div>
							<h4 class="info-card__title">Invitar usuario</h4>
							<p class="info-card__desc">
								Para alguien que aún no tiene cuenta. Recibe un correo para registrarse.
							</p>
						</div>
					</div>
					<InviteUser />
				</div>
				<div class="info-card">
					<div class="info-card__header">
						<Icon
							icon="mdi:account-key-outline"
							width={14}
							class="text-blue-400"
							aria-hidden="true"
						/>
						<div>
							<h4 class="info-card__title">Permisos por unidad</h4>
							<p class="info-card__desc">
								Para usuarios que ya existen. Activa qué unidades pueden ver en el mapa.
							</p>
						</div>
					</div>
					<AssignUnits />
				</div>
			</div>
		{/if}
	</div>
{/if}

<ConfirmModal
	open={!!unassignTarget}
	title="Desasignar dispositivo"
	confirmLabel="Desasignar"
	cancelLabel="Cancelar"
	destructive
	loading={unassignLoading}
	zIndexClass="z-[160]"
	on:cancel={() => (unassignTarget = null)}
	on:confirm={confirmUnassign}
>
	{#if unassignTarget}
		<p class="m-0">
			¿Desasignar el dispositivo de <strong>{unassignTarget.name}</strong>? La unidad quedará sin
			GPS vinculado.
		</p>
	{/if}
</ConfirmModal>

<style>
	.admin-panel {
		--c-bg: #0d1117;
		--c-surface: rgba(255, 255, 255, 0.04);
		--c-surface-h: rgba(255, 255, 255, 0.07);
		--c-border: rgba(255, 255, 255, 0.08);
		--c-border-h: rgba(255, 255, 255, 0.15);
		--c-text: #e2e8f0;
		--c-text-muted: rgba(255, 255, 255, 0.45);
		--c-text-faint: rgba(255, 255, 255, 0.28);
		--c-blue: #3b82f6;
		--c-blue-dim: rgba(59, 130, 246, 0.12);
		--c-red: #f87171;
		--c-red-dim: rgba(239, 68, 68, 0.1);
		--c-red-border: rgba(239, 68, 68, 0.22);
		--c-tab-bar: rgba(255, 255, 255, 0.06);
		--c-tab-active: #2563eb;

		width: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		text-align: left;
		color: var(--c-text);
	}

	:global(html:not(.dark)) .admin-panel {
		--c-surface: #f8fafc;
		--c-surface-h: #f1f5f9;
		--c-border: rgba(0, 0, 0, 0.09);
		--c-border-h: rgba(0, 0, 0, 0.16);
		--c-text: #0f172a;
		--c-text-muted: #64748b;
		--c-text-faint: #94a3b8;
		--c-tab-bar: rgba(0, 0, 0, 0.07);
		--c-blue-dim: rgba(37, 99, 235, 0.08);
		--c-red-dim: rgba(239, 68, 68, 0.07);
	}

	.admin-panel.embedded {
		padding: 0;
	}

	.admin-title {
		margin: 0 0 0.25rem;
		padding-bottom: 0.625rem;
		border-bottom: 1px solid var(--c-border);
		text-align: center;
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--c-text);
	}

	.tabs-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.tabs-bar {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
		padding: 4px;
		border-radius: 12px;
		background: var(--c-tab-bar);
		border: 1px solid var(--c-border);
	}

	.tab-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 0.5rem 0.25rem;
		border-radius: 8px;
		border: none;
		background: transparent;
		font-size: 11px;
		font-weight: 600;
		color: var(--c-text-muted);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
		white-space: nowrap;
	}
	.tab-btn:hover {
		color: var(--c-text);
		background: rgba(255, 255, 255, 0.05);
	}
	.tab-btn--active {
		background: var(--c-tab-active) !important;
		color: #fff !important;
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
	}

	.tab-hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--c-text-faint);
	}

	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		width: 100%;
	}

	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		width: 100%;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		border-radius: 10px;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
		text-align: left;
	}
	.item-row:hover {
		background: var(--c-surface-h);
		border-color: var(--c-border-h);
	}
	.item-row--selected {
		border-color: var(--c-blue) !important;
		background: var(--c-blue-dim) !important;
	}

	.item-row__left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}
	.item-row__id {
		margin: 0;
		font-family: monospace;
		font-size: 12px;
		font-weight: 600;
		color: var(--c-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-row__sub {
		margin: 0;
		margin-top: 2px;
		font-size: 10px;
		color: var(--c-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-row__name {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--c-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-row__device {
		margin: 0;
		margin-top: 2px;
		font-family: monospace;
		font-size: 10px;
		color: var(--c-blue);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-row__no-device {
		margin: 0;
		margin-top: 2px;
		font-size: 10px;
		font-style: italic;
		color: var(--c-text-faint);
	}

	.status-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.status-pill {
		flex-shrink: 0;
		padding: 1px 7px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
	}

	.unit-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		flex-shrink: 0;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
		color: var(--c-text-muted);
	}
	.unit-icon--active {
		border-color: rgba(59, 130, 246, 0.4);
		background: rgba(59, 130, 246, 0.1);
		color: var(--c-blue);
	}

	.detail-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 0.875rem;
		border-radius: 12px;
		border: 1px solid var(--c-border);
		background: rgba(0, 0, 0, 0.2);
	}
	.detail-card__header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--c-border);
	}
	.detail-card__title {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--c-text);
	}
	.detail-card__icon-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.fields-grid {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(2, 1fr);
	}
	.field-block {
		display: flex;
		flex-direction: column;
	}
	.field-label {
		display: block;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--c-text-faint);
		margin-bottom: 3px;
	}
	.field-value {
		font-size: 14px;
		font-weight: 700;
		color: var(--c-text);
		margin: 0;
	}

	.field-input {
		width: 100%;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: 8px;
		padding: 0.375rem 0.5rem;
		font-size: 13px;
		color: var(--c-text);
		outline: none;
		transition: border-color 0.15s;
	}
	.field-input::placeholder {
		color: var(--c-text-faint);
	}
	.field-input:focus {
		border-color: var(--c-blue);
	}
	.field-input:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.field-select {
		width: 100%;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: 8px;
		padding: 0.375rem 2rem 0.375rem 0.5rem;
		font-size: 13px;
		color: var(--c-text);
		outline: none;
		appearance: none;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.field-select:focus {
		border-color: var(--c-blue);
	}
	.field-select option {
		background: #0d1117;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border-radius: 10px;
		border: none;
		background: var(--c-blue);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.btn-primary:hover:not(:disabled) {
		opacity: 0.88;
	}
	.btn-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn-danger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.45rem 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--c-red-border);
		background: var(--c-red-dim);
		color: var(--c-red);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-danger:hover {
		background: rgba(239, 68, 68, 0.16);
	}

	.color-swatch {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 8px;
		border: 1px solid var(--c-border);
		cursor: pointer;
		transition:
			border-color 0.15s,
			transform 0.1s;
	}
	.color-swatch:hover {
		border-color: var(--c-blue);
		transform: scale(1.05);
	}
	.color-picker {
		position: absolute;
		left: 0;
		top: calc(100% + 6px);
		z-index: 20;
		display: grid;
		grid-template-columns: repeat(5, 1.75rem);
		gap: 5px;
		padding: 8px;
		border-radius: 10px;
		border: 1px solid var(--c-border);
		background: #0d1117;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
	}
	.color-chip {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 6px;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			transform 0.1s,
			border-color 0.1s;
	}
	.color-chip:hover {
		transform: scale(1.15);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.new-unit-row {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
		padding-top: 0.75rem;
		margin-top: 0.25rem;
		border-top: 1px solid var(--c-border);
	}
	.new-unit-row__label {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		color: var(--c-text-muted);
	}

	.assign-box {
		padding: 0.625rem;
		border-radius: 10px;
		border: 1px dashed var(--c-border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.assign-box__label {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		color: var(--c-text-muted);
	}
	.assign-box__empty {
		margin: 0;
		font-size: 11px;
		text-align: center;
		color: var(--c-text-faint);
	}

	.info-card {
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.info-card__header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.info-card__title {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--c-text);
	}
	.info-card__desc {
		margin: 0;
		margin-top: 2px;
		font-size: 11px;
		color: var(--c-text-muted);
	}

	.loading-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0;
		font-size: 12px;
		color: var(--c-blue);
	}
	.count-label {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		color: var(--c-text-faint);
	}
	.error-msg {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		font-size: 12px;
		color: var(--c-red);
		border: 1px solid var(--c-red-border);
		background: var(--c-red-dim);
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.375rem;
		padding: 0.75rem 0;
		font-size: 12px;
		color: var(--c-text-faint);
	}
</style>
