<script>
	import { apiService } from '$lib/services/api.js';
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
								<div
									class="flex items-center gap-3 py-2 px-3 rounded bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors border border-[var(--panel-border)]"
								>
									<!-- Status Dot with Tooltip -->
									<div class="relative group">
										<div
											class="w-2.5 h-2.5 rounded-full {statusConfig[device.status]?.color ||
												'bg-gray-500'}"
										></div>
										<!-- Tooltip -->
										<div
											class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-black/90 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
										>
											{statusConfig[device.status]?.label || device.status}
											<!-- Arrow -->
											<div
												class="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-black/90"
											></div>
										</div>
									</div>

									<span class="text-sm text-app opacity-80 font-mono">{device.device_id}</span>
								</div>
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
				{/if}
			</div>

			<div class="h-px bg-[var(--panel-border)] my-3"></div>

			<!-- Acordeón de Asignar Unidades a Usuarios -->
			<div class="mb-2">
				<button
					class="large-button justify-between"
					on:click={() => (showAssignUnits = !showAssignUnits)}
				>
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white/90"
							>Asignar Unidades a Usuarios</span
						>
					</div>
					<svg
						class="w-4 h-4 transition-transform text-white/70"
						class:rotate-180={showAssignUnits}
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

				{#if showAssignUnits}
					<AssignUnits />
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
