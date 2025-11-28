<script>
	import { apiService } from '$lib/services/api';
	import { vehicleColors } from '$lib/data/vehicleColors';
	import { user } from '$lib/stores/auth';
	import IconPicker from '$lib/components/Unit/IconPicker.svelte';
	import { onMount, onDestroy } from 'svelte';
	import AssignUnits from './AssignUnits.svelte';

	export let showAdminPanel = false;
	export let toggleAdminPanel = null;
	export let embedded = false;

	// Estados para dispositivos
	let showDevices = false;
	let devices = [];
	let loadingDevices = false;
	let devicesError = null;

	// Estados para unidades
	let showUnits = false;
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
	let selectedListDeviceId = null; // State for selected device in the list

	// Estados para perfil de unidad
	let unitProfile = null;
	let loadingProfile = false;
	let updatingProfileField = null; // Track which field is being updated
	let showColorPicker = false; // Toggle for color picker dropdown

	// Estados para asignación de unidades
	let showAssignUnits = false;

	// Colores según especificación del usuario
	const statusConfig = {
		nuevo: { label: 'Nuevo', color: 'bg-gray-500' },
		enviado: { label: 'Enviado', color: 'bg-gray-500' },
		entregado: { label: 'Entregado', color: 'bg-yellow-500' },
		asignado: { label: 'Asignado', color: 'bg-green-500' },
		devuelto: { label: 'Devuelto', color: 'status-black' },
		inactivo: { label: 'Inactivo', color: 'bg-red-500' }
	};

	async function toggleDevices() {
		showDevices = !showDevices;
		if (showDevices) {
			showUnits = false;
			showAssignUnits = false;
			if (devices.length === 0) {
				await loadDevices();
			}
		}
	}

	async function loadDevices() {
		loadingDevices = true;
		devicesError = null;
		try {
			devices = await apiService.getMyDevices();
		} catch (err) {
			console.error('Error al cargar dispositivos:', err);
			devicesError = err.message || 'Error al cargar dispositivos';
		} finally {
			loadingDevices = false;
		}
	}

	async function toggleUnits() {
		showUnits = !showUnits;
		if (showUnits) {
			showDevices = false;
			showAssignUnits = false;
			if (units.length === 0) {
				await loadUnits();
			}
		}
	}

	async function loadUnits() {
		loadingUnits = true;
		unitsError = null;
		try {
			units = await apiService.getUnits();
		} catch (err) {
			console.error('Error al cargar unidades:', err);
			unitsError = err.message || 'Error al cargar unidades';
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
			unitsError = err.message || 'Error al crear la unidad';
		} finally {
			creatingUnit = false;
		}
	}

	async function selectUnit(unitId) {
		if (selectedUnitId === unitId) {
			// selectedUnitId = null; // Don't toggle off if clicking the same one, or maybe we do? User said "when selected". Let's keep toggle for now but maybe just re-select.
			// Actually, usually a detail panel stays open. Let's allow deselecting by clicking again for now.
			selectedUnitId = null;
			return;
		}

		selectedUnitId = unitId;
		const unit = units.find((u) => u.id === unitId);

		// Si no tiene dispositivo asignado, cargar dispositivos disponibles
		if (!unit.device_id) {
			loadUnassignedDevices();
		}

		// Cargar perfil de la unidad
		loadUnitProfile(unitId);
	}

	async function loadUnitProfile(unitId) {
		loadingProfile = true;
		unitProfile = null;
		try {
			unitProfile = await apiService.getUnitProfile(unitId);
		} catch (err) {
			console.error('Error al cargar perfil de unidad:', err);
			// No mostramos error en UI para no saturar, simplemente no se muestran los detalles extra
		} finally {
			loadingProfile = false;
		}
	}

	function toggleAssignUnits() {
		showAssignUnits = !showAssignUnits;
		if (showAssignUnits) {
			showDevices = false;
			showUnits = false;
		}
	}

	async function handleProfileUpdate(field, value, event = null) {
		// If event is provided (e.g. keydown), check for Enter
		if (event && event.key !== 'Enter') return;

		// Don't update if value hasn't changed (optional optimization, but good UX)
		// For simplicity, we'll just send it.

		updatingProfileField = field;
		try {
			const data = { [field]: value };
			const updatedProfile = await apiService.updateUnitProfile(selectedUnitId, data);
			unitProfile = updatedProfile;

			if (field === 'color') {
				showColorPicker = false;
			}

			// Remove focus to indicate completion or just keep it?
			// Usually keeping focus is better for rapid editing, but we might want to show success.
			// Let's blur to show "saved" state visually if we had one, or just keep it.
			if (event && event.target) event.target.blur();
		} catch (err) {
			console.error(`Error al actualizar ${field}:`, err);
			// Revert value or show error? For now just log.
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
			unitsError = err.message || 'Error al cargar dispositivos';
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
			selectedUnitId = null;
			selectedDeviceId = '';
			await loadUnits();
		} catch (err) {
			console.error('Error al asignar dispositivo:', err);
			unitsError = err.message || 'Error al asignar el dispositivo';
		} finally {
			assigningDevice = false;
		}
	}

	function selectListDevice(deviceId) {
		if (selectedListDeviceId === deviceId) {
			selectedListDeviceId = null;
		} else {
			selectedListDeviceId = deviceId;
		}
	}

	async function unassignDevice(assignmentId) {
		if (!confirm('¿Estás seguro de desasignar este dispositivo?')) {
			return;
		}

		unitsError = null;
		try {
			await apiService.unassignDeviceFromUnit(assignmentId);
			selectedUnitId = null;
			await loadUnits();
		} catch (err) {
			console.error('Error al desasignar dispositivo:', err);
			unitsError = err.message || 'Error al desasignar el dispositivo';
		}
	}
</script>

<!-- Botón de administración (solo si no está embebido) -->
{#if !embedded}
	<button
		on:click={toggleAdminPanel || (() => (showAdminPanel = !showAdminPanel))}
		aria-label="Abrir panel de administración"
		class="nav-button"
	>
		<!-- Icono de engranaje/escudo para admin -->
		<svg class="menu-icon" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>
{/if}

<!-- Panel de controles expandible -->
{#if showAdminPanel || embedded}
	<div class={embedded ? '' : 'menu-card'}>
		<div class="controls">
			<p
				class="text-center text-lg font-bold uppercase tracking-widest mb-12 text-app opacity-100 border-b border-[var(--panel-border)] pb-3"
			>
				Administraci&oacute;n
			</p>

			<!-- Acordeón de dispositivos -->
			<div class="mb-3">
				<button class="large-button justify-between" on:click={toggleDevices}>
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z"
								clip-rule="evenodd"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white/90">Gestionar Dispositivos</span>
					</div>
					<svg
						class="w-4 h-4 transition-transform text-white/70"
						class:rotate-180={showDevices}
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				{#if showDevices}
					{#if loadingDevices}
						<div class="flex items-center justify-center py-4">
							<svg
								class="animate-spin h-5 w-5"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								style="color: var(--accent-cyan)"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</div>
					{:else if devicesError}
						<p class="text-xs text-red-400 py-2">{devicesError}</p>
					{:else if devices.length === 0}
						<p class="text-xs text-app opacity-60 py-2 text-center">
							No hay dispositivos disponibles
						</p>
					{:else}
						<div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
							{#each devices as device}
								<button
									class="w-full flex items-center justify-between py-2 px-3 rounded hover:bg-[var(--btn-secondary-hover-bg)] transition-colors {selectedListDeviceId ===
									device.device_id
										? 'bg-[var(--btn-secondary-hover-bg)]'
										: ''}"
									on:click={() => selectListDevice(device.device_id)}
								>
									<div class="flex items-center gap-3 min-w-0 flex-1 mr-2">
										<!-- Status Dot -->
										<div
											class="w-2.5 h-2.5 rounded-full shrink-0 {statusConfig[device.status]
												?.color || 'bg-gray-500'}"
										></div>
										<span
											class="text-sm text-app opacity-80 font-mono truncate"
											title={device.device_id}>{device.device_id}</span
										>
									</div>

									<!-- Status Badge (Only visible if selected) -->
									{#if selectedListDeviceId === device.device_id}
										<span
											class="px-2 py-[2px] rounded-md text-[10px] sm:text-xs font-medium text-white whitespace-nowrap shrink-0 {statusConfig[
												device.status
											]?.color || 'bg-gray-500'}"
										>
											{statusConfig[device.status]?.label || device.status}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<div class="h-px bg-[var(--panel-border)] my-3"></div>

			<!-- Acordeón de unidades -->
			<div class="mb-2">
				<button class="large-button justify-between" on:click={toggleUnits}>
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
							/>
							<path
								d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white/90">Gestionar Unidades</span>
					</div>
					<svg
						class="w-4 h-4 transition-transform text-white/70"
						class:rotate-180={showUnits}
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				{#if showUnits}
					{#if loadingUnits}
						<div class="flex items-center justify-center py-4">
							<svg
								class="animate-spin h-5 w-5"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								style="color: var(--accent-cyan)"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</div>
					{:else if unitsError}
						<p class="text-xs text-red-400 py-2">{unitsError}</p>
					{:else if units.length === 0}
						<p class="text-xs text-app opacity-60 py-2 text-center">No hay unidades disponibles</p>
					{:else}
						<div class="space-y-2 max-h-60 overflow-y-auto mb-3 custom-scrollbar">
							{#each units as unit}
								<div
									class="unit-card shadow-sm bg-[var(--btn-secondary-bg)] border-[var(--panel-border)] transition-all duration-200"
									class:border-accent-cyan={selectedUnitId === unit.id}
									class:ring-1={selectedUnitId === unit.id}
									class:ring-accent-cyan={selectedUnitId === unit.id}
									class:ring-offset-0={selectedUnitId === unit.id}
								>
									<button
										class="w-full text-left py-2 px-3 rounded text-sm text-app opacity-90 hover:bg-[var(--btn-secondary-hover-bg)] transition-colors flex items-center justify-between"
										on:click={() => selectUnit(unit.id)}
									>
										<div class="flex-1">
											<div class="font-medium tracking-wide">{unit.name}</div>
											{#if unit.device_id}
												<div class="text-[11px] opacity-70 font-mono mt-0.5 text-accent-cyan">
													📡 {unit.device_id}
												</div>
											{:else}
												<div class="text-[11px] opacity-40 mt-0.5 italic">Sin dispositivo</div>
											{/if}
										</div>
										{#if selectedUnitId === unit.id}
											<div
												class="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(var(--accent-cyan-rgb),0.8)]"
											></div>
										{/if}
									</button>
								</div>
							{/each}
						</div>

						<!-- Panel de detalle fijo en la parte inferior -->
						{#if selectedUnitId}
							{@const selectedUnit = units.find((u) => u.id === selectedUnitId)}
							{#if selectedUnit}
								<div
									class="mt-4 p-4 rounded-lg border border-[var(--panel-border)] bg-[var(--glass-bg)] relative overflow-hidden group"
								>
									<!-- Efecto de brillo sutil -->
									<div
										class="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
									></div>

									<h3
										class="text-sm font-bold text-app mb-3 uppercase tracking-wider border-b border-[var(--panel-border)] pb-2 flex items-center gap-2"
									>
										<svg
											class="w-4 h-4 text-accent-cyan"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										Detalle de Unidad
									</h3>

									<div class="space-y-4 relative z-10">
										{#if loadingProfile}
											<div class="flex items-center justify-center py-4">
												<svg
													class="animate-spin h-5 w-5 text-accent-cyan"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
												>
													<circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle>
													<path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
											</div>
										{:else if unitProfile}
											<div class="flex gap-4 mb-4">
												<!-- Icon Picker -->
												<div class="flex-shrink-0">
													<IconPicker
														currentIcon={unitProfile.icon_type}
														editable={$user?.is_master}
														onSelect={(slug) => handleProfileUpdate('icon_type', slug)}
													/>
												</div>

												<!-- Unit Name (Title) -->
												<div class="flex-1 min-w-0 flex flex-col justify-center">
													<span class="text-xs text-app opacity-50 uppercase tracking-wide"
														>Nombre</span
													>
													<div
														class="text-base font-medium text-white truncate"
														title={selectedUnit.name}
													>
														{selectedUnit.name}
													</div>
												</div>
											</div>

											<div
												class="space-y-3 bg-[var(--btn-secondary-bg)] rounded p-3 border border-[var(--panel-border)]"
											>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>Descripción</span
													>
													<input
														type="text"
														value={unitProfile.description || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) =>
															handleProfileUpdate('description', e.currentTarget.value, e)}
													/>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>Marca</span
													>
													<input
														type="text"
														value={unitProfile.brand || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) =>
															handleProfileUpdate('brand', e.currentTarget.value, e)}
													/>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>Modelo</span
													>
													<input
														type="text"
														value={unitProfile.model || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) =>
															handleProfileUpdate('model', e.currentTarget.value, e)}
													/>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-2"
														>Color</span
													>
													<div class="relative">
														<!-- Selected Color Display -->
														<button
															class="w-8 h-8 rounded-md border border-white/20 transition-all duration-200 relative"
															style="background-color: {unitProfile.color
																? vehicleColors.find((c) => c.slug === unitProfile.color)?.hex ||
																	'transparent'
																: 'transparent'};"
															class:cursor-pointer={$user?.is_master}
															class:cursor-default={!$user?.is_master}
															class:hover:border-accent-cyan={$user?.is_master}
															on:click={() => {
																if ($user?.is_master) showColorPicker = !showColorPicker;
															}}
														>
															{#if !unitProfile.color}
																<!-- Transparent/Empty State Indicator -->
																<div class="absolute inset-0 flex items-center justify-center">
																	<div
																		class="w-full h-[1px] bg-red-500/50 rotate-45 transform"
																	></div>
																</div>
															{/if}
														</button>

														<!-- Dropdown Color Picker -->
														{#if showColorPicker && $user?.is_master}
															<div
																class="absolute top-full left-0 mt-2 p-2 bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] rounded-lg shadow-xl z-50 grid grid-cols-5 gap-2 w-max"
															>
																{#each vehicleColors as color}
																	<button
																		class="w-7 h-7 rounded-md transition-all duration-200 relative group border border-transparent hover:border-white/50"
																		style="background-color: {color.hex};"
																		class:ring-2={unitProfile.color === color.slug}
																		class:ring-accent-cyan={unitProfile.color === color.slug}
																		class:ring-offset-2={unitProfile.color === color.slug}
																		class:ring-offset-[#1e293b]={unitProfile.color === color.slug}
																		on:click={() => handleProfileUpdate('color', color.slug)}
																		title={color.slug}
																	>
																		{#if unitProfile.color === color.slug}
																			<div
																				class="absolute inset-0 flex items-center justify-center"
																			>
																				<svg
																					class="w-4 h-4 text-black/50"
																					fill="none"
																					viewBox="0 0 24 24"
																					stroke="currentColor"
																				>
																					<path
																						stroke-linecap="round"
																						stroke-linejoin="round"
																						stroke-width="3"
																						d="M5 13l4 4L19 7"
																					/>
																				</svg>
																			</div>
																		{/if}
																	</button>
																{/each}
															</div>

															<!-- Backdrop to close -->
															<div
																class="fixed inset-0 z-40"
																on:click={() => (showColorPicker = false)}
															></div>
														{/if}
													</div>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>Año</span
													>
													<input
														type="number"
														value={unitProfile.year || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) =>
															handleProfileUpdate(
																'year',
																parseInt(e.currentTarget.value) || null,
																e
															)}
													/>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>Placa</span
													>
													<input
														type="text"
														value={unitProfile.vehicle?.plate || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 font-mono placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) =>
															handleProfileUpdate('plate', e.currentTarget.value, e)}
													/>
												</div>
												<div>
													<span
														class="text-[10px] text-app opacity-50 uppercase tracking-wide block mb-1"
														>VIN</span
													>
													<input
														type="text"
														value={unitProfile.vehicle?.vin || ''}
														placeholder="--"
														class="w-full bg-transparent border-b border-white/10 focus:border-accent-cyan outline-none text-sm text-white/90 font-mono placeholder-white/20 transition-colors py-0.5"
														on:keydown={(e) => handleProfileUpdate('vin', e.currentTarget.value, e)}
													/>
												</div>
												{#if selectedUnit.device_id}
													<div>
														<span
															class="text-[10px] text-app opacity-50 uppercase tracking-wide block"
															>Dispositivo</span
														>
														<div class="text-sm text-accent-cyan font-mono font-bold">
															{selectedUnit.device_id}
														</div>
													</div>
												{/if}
											</div>
										{/if}

										{#if selectedUnit.device_id}
											<!-- Botón de desasignar (fuera de la lista de detalles) -->
											<button
												on:click={() =>
													unassignDevice(selectedUnit.assignment_id || selectedUnit.id)}
												class="w-full px-3 py-2 text-xs font-medium rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 mt-2"
											>
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
												Desasignar Dispositivo
											</button>
										{:else}
											<!-- Unidad sin dispositivo asignado -->
											<div
												class="bg-[var(--btn-secondary-bg)] rounded p-3 border border-[var(--panel-border)] border-dashed"
											>
												<span class="text-xs text-app opacity-50 uppercase tracking-wide block mb-2"
													>Asignar Dispositivo</span
												>

												{#if loadingUnassignedDevices}
													<div class="flex items-center justify-center py-4">
														<svg
															class="animate-spin h-5 w-5 text-accent-cyan"
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
														>
															<circle
																class="opacity-25"
																cx="12"
																cy="12"
																r="10"
																stroke="currentColor"
																stroke-width="4"
															></circle>
															<path
																class="opacity-75"
																fill="currentColor"
																d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
															></path>
														</svg>
													</div>
												{:else if unassignedDevices.length === 0}
													<p class="text-xs text-app opacity-50 py-2 text-center italic">
														No hay dispositivos libres
													</p>
												{:else}
													<div class="space-y-2">
														<select
															bind:value={selectedDeviceId}
															class="w-full px-2 py-2 text-xs rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:border-accent-cyan outline-none transition-colors"
														>
															<option value="">Seleccionar dispositivo...</option>
															{#each unassignedDevices as device}
																<option value={device.device_id}>
																	{device.device_id} - {device.brand}
																	{device.model}
																</option>
															{/each}
														</select>

														<button
															on:click={() => assignDevice(selectedUnit.id)}
															disabled={!selectedDeviceId || assigningDevice}
															class="w-full px-3 py-2 text-xs font-medium rounded transition-all shadow-sm flex items-center justify-center gap-2"
															style="background: var(--accent-cyan); color: white;"
															style:opacity={!selectedDeviceId || assigningDevice ? '0.5' : '1'}
														>
															{#if assigningDevice}
																<svg
																	class="animate-spin h-3 w-3"
																	xmlns="http://www.w3.org/2000/svg"
																	fill="none"
																	viewBox="0 0 24 24"
																>
																	<circle
																		class="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		stroke-width="4"
																	></circle>
																	<path
																		class="opacity-75"
																		fill="currentColor"
																		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																	></path>
																</svg>
																Asignando...
															{:else}
																<svg
																	class="w-3 h-3"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
																Confirmar Asignación
															{/if}
														</button>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						{/if}
					{/if}

					<!-- Formulario para agregar nueva unidad -->
					<div class="border-t border-[var(--panel-border)] pt-3 mt-1">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newUnitName}
								placeholder="Nombre de la unidad"
								class="flex-1 px-3 py-2 text-sm rounded-lg input-field bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
								on:keydown={(e) => e.key === 'Enter' && createUnit()}
								disabled={creatingUnit}
							/>
							<button
								on:click={createUnit}
								disabled={creatingUnit || !newUnitName.trim()}
								class="add-button shadow-md"
								aria-label="Agregar unidad"
							>
								{#if creatingUnit}
									<svg
										class="animate-spin h-4 w-4"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-4 border-t border-[var(--panel-border)] pt-4">
				<button
					class="w-full py-2.5 px-4 rounded-lg bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-app font-medium transition-all duration-200 flex items-center justify-between group shadow-sm border border-[var(--panel-border)]"
					on:click={toggleAssignUnits}
				>
					<span class="flex items-center gap-2">
						<svg
							class="w-4 h-4 text-accent-cyan opacity-70 group-hover:opacity-100 transition-opacity"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
						Asignar Unidades a Usuarios
					</span>
					<svg
						class="w-4 h-4 transform transition-transform duration-300 {showAssignUnits
							? 'rotate-180 text-accent-cyan'
							: 'text-gray-400'}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>

				{#if showAssignUnits}
					<div class="mt-3 pl-2" transition:slide={{ duration: 200 }}>
						<AssignUnits />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.status-black {
		background-color: #000000;
	}

	.rotate-180 {
		transform: rotate(180deg);
	}

	.input-field {
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		outline: none;
		transition: border-color 0.2s;
	}

	.input-field:focus {
		border-color: var(--accent-cyan);
	}

	.input-field:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-button {
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		background: var(--accent-cyan);
		color: white;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-button:hover:not(:disabled) {
		opacity: 0.8;
	}

	.add-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.unit-card {
		border: 1px solid var(--border-color);
		border-radius: 0.375rem;
		background: transparent;
		overflow: hidden;
	}

	select.input-field {
		cursor: pointer;
	}

	select.input-field option {
		background-color: var(--field-bg) !important;
		color: var(--text-primary);
	}
</style>
