<script>
	import { apiService } from '$lib/services/api.js';

	export let showVehiclePanel = false;
	export let toggleVehiclePanel = null;
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
		if (showDevices && devices.length === 0) {
			await loadDevices();
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
		if (showUnits && units.length === 0) {
			await loadUnits();
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
			selectedUnitId = null;
			return;
		}

		selectedUnitId = unitId;
		const unit = units.find((u) => u.id === unitId);

		// Si no tiene dispositivo asignado, cargar dispositivos disponibles
		if (!unit.device_id) {
			await loadUnassignedDevices();
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

<!-- Botón del vehículo -->
{#if !embedded}
	<button
		on:click={toggleVehiclePanel || (() => (showVehiclePanel = !showVehiclePanel))}
		aria-label="Abrir panel de control de vehículos"
		class="nav-button"
	>
		<svg
			class="menu-icon"
			fill="currentColor"
			viewBox="-12.29 -12.29 147.46 147.46"
			version="1.1"
			id="Layer_1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			style="enable-background:new 0 0 122.88 92.02"
			xml:space="preserve"
			transform="matrix(1, 0, 0, 1, 0, 0)rotate(0)"
		>
			<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
			<g
				id="SVGRepo_tracerCarrier"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke="#CCCCCC"
				stroke-width="4.9152000000000005"
			></g>
			<g id="SVGRepo_iconCarrier">
				<style type="text/css">
					.st0 {
						fill-rule: evenodd;
						clip-rule: evenodd;
					}
				</style>
				<g>
					<path
						class="st0"
						d="M10.17,34.23c-10.98-5.58-9.72-11.8,1.31-11.15l2.47,4.63l5.09-15.83C21.04,5.65,24.37,0,30.9,0H96 c6.53,0,10.29,5.54,11.87,11.87l3.82,15.35l2.2-4.14c11.34-0.66,12.35,5.93,0.35,11.62l1.95,2.99c7.89,8.11,7.15,22.45,5.92,42.48 v8.14c0,2.04-1.67,3.71-3.71,3.71h-15.83c-2.04,0-3.71-1.67-3.71-3.71v-4.54H24.04v4.54c0,2.04-1.67,3.71-3.71,3.71H4.5 c-2.04,0-3.71-1.67-3.71-3.71V78.2c0-0.2,0.02-0.39,0.04-0.58C-0.37,62.25-2.06,42.15,10.17,34.23L10.17,34.23z M30.38,58.7 l-14.06-1.77c-3.32-0.37-4.21,1.03-3.08,3.89l1.52,3.69c0.49,0.95,1.14,1.64,1.9,2.12c0.89,0.55,1.96,0.82,3.15,0.87l12.54,0.1 c3.03-0.01,4.34-1.22,3.39-4C34.96,60.99,33.18,59.35,30.38,58.7L30.38,58.7z M54.38,52.79h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0 c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0C52.82,53.49,53.52,52.79,54.38,52.79L54.38,52.79z M89.96,73.15 h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0 C88.41,73.85,89.1,73.15,89.96,73.15L89.96,73.15z M92.5,58.7l14.06-1.77c3.32-0.37,4.21,1.03,3.08,3.89l-1.52,3.69 c-0.49,0.95-1.14,1.64-1.9,2.12c-0.89,0.55-1.96,0.82-3.15,0.87l-12.54,0.1c-3.03-0.01-4.34-1.22-3.39-4 C87.92,60.99,89.7,59.35,92.5,58.7L92.5,58.7z M18.41,73.15h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4 c-0.85,0-1.55-0.7-1.55-1.55l0,0C16.86,73.85,17.56,73.15,18.41,73.15L18.41,73.15z M19.23,31.2h86.82l-3.83-15.92 c-1.05-4.85-4.07-9.05-9.05-9.05H33.06c-4.97,0-7.52,4.31-9.05,9.05L19.23,31.2v0.75V31.2L19.23,31.2z"
					></path>
				</g>
			</g>
		</svg>
	</button>
{/if}

<!-- Panel de controles expandible -->
{#if showVehiclePanel || embedded}
	<div class={embedded ? '' : 'menu-card'}>
		<div class="controls">
			<!-- Acordeón de dispositivos -->
			<div class="mb-3">
				<button class="large-button shadow-md justify-between" on:click={toggleDevices}>
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z"
								clip-rule="evenodd"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white/90">Mis Dispositivos</span>
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
					<div class="mt-2 p-3 rounded-lg panel shadow-inner bg-[var(--glass-bg)]">
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
									<div
										class="flex items-center justify-between py-2 px-3 rounded bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors border border-[var(--panel-border)]"
									>
										<span class="text-sm text-app opacity-80 font-mono">{device.device_id}</span>
										<span
											class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full text-white shadow-sm {statusConfig[
												device.status
											]?.color || 'bg-gray-500'}"
										>
											{statusConfig[device.status]?.label || device.status}
										</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="h-px bg-[var(--panel-border)] my-3"></div>

			<!-- Acordeón de unidades -->
			<div class="mb-2">
				<button class="large-button shadow-md justify-between" on:click={toggleUnits}>
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
							/>
							<path
								d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white/90">Mis Unidades</span>
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
					<div class="mt-2 p-3 rounded-lg panel shadow-inner bg-[var(--glass-bg)]">
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
							<p class="text-xs text-app opacity-60 py-2 text-center">
								No hay unidades disponibles
							</p>
						{:else}
							<div class="space-y-2 max-h-96 overflow-y-auto mb-3 custom-scrollbar">
								{#each units as unit}
									<div
										class="unit-card shadow-sm bg-[var(--btn-secondary-bg)] border-[var(--panel-border)]"
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
											<svg
												class="w-4 h-4 transition-transform text-app opacity-50"
												class:rotate-180={selectedUnitId === unit.id}
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

										{#if selectedUnitId === unit.id}
											<div
												class="px-3 pb-3 mt-1 border-t border-[var(--panel-border)] pt-3 bg-[var(--glass-bg)]"
											>
												{#if unit.device_id}
													<!-- Unidad con dispositivo asignado -->
													<div class="space-y-3">
														<div class="text-xs text-app opacity-80 space-y-1">
															<div>
																<strong class="text-app opacity-60">Dispositivo:</strong>
																{unit.device_id}
															</div>
															{#if unit.device_brand}
																<div>
																	<strong class="text-app opacity-60">Marca:</strong>
																	{unit.device_brand}
																</div>
															{/if}
															{#if unit.device_model}
																<div>
																	<strong class="text-app opacity-60">Modelo:</strong>
																	{unit.device_model}
																</div>
															{/if}
														</div>
														<button
															on:click={() => unassignDevice(unit.assignment_id || unit.id)}
															class="w-full px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
														>
															Desasignar Dispositivo
														</button>
													</div>
												{:else}
													<!-- Unidad sin dispositivo asignado -->
													<div class="space-y-3">
														{#if loadingUnassignedDevices}
															<div class="flex items-center justify-center py-2">
																<svg
																	class="animate-spin h-4 w-4"
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
														{:else if unassignedDevices.length === 0}
															<p class="text-xs text-app opacity-50 py-2 text-center">
																No hay dispositivos disponibles
															</p>
														{:else}
															<select
																bind:value={selectedDeviceId}
																class="w-full px-2 py-1.5 text-xs rounded input-field bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] focus:border-accent-cyan"
															>
																<option value="" class="bg-[var(--app-bg)]"
																	>Seleccionar dispositivo...</option
																>
																{#each unassignedDevices as device}
																	<option value={device.device_id} class="bg-[var(--app-bg)]">
																		{device.device_id} - {device.brand}
																		{device.model}
																	</option>
																{/each}
															</select>
															<button
																on:click={() => assignDevice(unit.id)}
																disabled={!selectedDeviceId || assigningDevice}
																class="w-full px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-sm"
																style="background: var(--accent-cyan); color: white;"
																style:opacity={!selectedDeviceId || assigningDevice ? '0.5' : '1'}
															>
																{assigningDevice ? 'Asignando...' : 'Asignar Dispositivo'}
															</button>
														{/if}
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
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
		background: var(--bg-primary);
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
		background: var(--bg-primary);
		overflow: hidden;
	}

	select.input-field {
		cursor: pointer;
	}

	select.input-field option {
		background: var(--bg-primary);
		color: var(--text-primary);
	}
</style>
