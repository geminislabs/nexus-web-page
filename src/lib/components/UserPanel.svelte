<script>
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/theme.js';
	import { apiService } from '$lib/services/api.js';

	export let showUserPanel = false;
	export let userData = null;
	export let toggleUserPanel = null;

	let showDevices = false;
	let devices = [];
	let loadingDevices = false;
	let devicesError = null;

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

	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}
</script>

<button
	on:click={toggleUserPanel || (() => (showUserPanel = !showUserPanel))}
	aria-label="Abrir panel de información de usuario"
	class="nav-button"
>
	<!-- Icono de usuario -->
	<svg class="menu-icon" fill="currentColor" viewBox="0 0 20 20">
		<path
			fill-rule="evenodd"
			d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
			clip-rule="evenodd"
		/>
	</svg>
</button>

<!-- Panel de información de usuario -->
{#if showUserPanel}
	<div class="menu-card">
		<!-- Información del usuario -->
		<div class="controls">
			<div class="p-3 rounded-lg panel">
				<p class="text-sm font-medium mb-2 text-app">Información del Usuario</p>
				{#if userData}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="text-sm text-app">{userData.full_name}</span>
						</div>

						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="text-sm text-app">{userData.email}</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h2zM8 5a1 1 0 011-1h2a1 1 0 011 1v1H8V5zM4 8a0 0 0 000 0v6a0 0 0 000 0h12a0 0 0 000 0V8a0 0 0 000 0H4z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="text-sm text-app">ID: {userData.id}</span>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-500">No hay información de usuario disponible</p>
				{/if}
			</div>

			<!-- Acordeón de dispositivos -->
			<div class="mb-2">
				<button class="large-button" on:click={toggleDevices}>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z"
							clip-rule="evenodd"
						/>
					</svg>
					Mis Dispositivos
					<svg
						class="w-4 h-4 ml-auto transition-transform"
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
					<div class="mt-2 p-3 rounded-lg panel">
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
							<p class="text-xs text-red-500 py-2">{devicesError}</p>
						{:else if devices.length === 0}
							<p class="text-xs text-app opacity-70 py-2 text-center">
								No hay dispositivos disponibles
							</p>
						{:else}
							<div class="space-y-2 max-h-60 overflow-y-auto">
								{#each devices as device}
									<div class="flex items-center justify-between py-2 px-2 rounded hover:bg-opacity-50 transition-colors" style="hover:background-color: var(--hover-bg)">
										<span class="text-sm text-app font-mono">{device.device_id}</span>
										<span
											class="px-2 py-1 text-xs font-semibold rounded-full text-white {statusConfig[
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

			<!-- Acordeón de unidades -->
			<div class="mb-2">
				<button class="large-button" on:click={toggleUnits}>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
						/>
						<path
							d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"
						/>
					</svg>
					Mis Unidades
					<svg
						class="w-4 h-4 ml-auto transition-transform"
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
					<div class="mt-2 p-3 rounded-lg panel">
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
							<p class="text-xs text-red-500 py-2">{unitsError}</p>
						{:else if units.length === 0}
							<p class="text-xs text-app opacity-70 py-2 text-center">
								No hay unidades disponibles
							</p>
						{:else}
							<div class="space-y-2 max-h-96 overflow-y-auto mb-3">
								{#each units as unit}
									<div class="unit-card">
										<button
											class="w-full text-left py-2 px-2 rounded text-sm text-app hover:bg-opacity-50 transition-colors flex items-center justify-between"
											style="hover:background-color: var(--hover-bg)"
											on:click={() => selectUnit(unit.id)}
										>
											<div class="flex-1">
												<div class="font-medium">{unit.name}</div>
												{#if unit.device_id}
													<div class="text-xs opacity-70 font-mono mt-1">
														📡 {unit.device_id}
													</div>
												{:else}
													<div class="text-xs opacity-50 mt-1">Sin dispositivo</div>
												{/if}
											</div>
											<svg
												class="w-4 h-4 transition-transform"
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
											<div class="px-2 pb-2 mt-2 border-t pt-2" style="border-color: var(--border-color)">
												{#if unit.device_id}
													<!-- Unidad con dispositivo asignado -->
													<div class="space-y-2">
														<div class="text-xs text-app">
															<div class="mb-1"><strong>Dispositivo:</strong> {unit.device_id}</div>
															{#if unit.device_brand}
																<div class="mb-1"><strong>Marca:</strong> {unit.device_brand}</div>
															{/if}
															{#if unit.device_model}
																<div class="mb-1"><strong>Modelo:</strong> {unit.device_model}</div>
															{/if}
														</div>
														<button
															on:click={() => unassignDevice(unit.assignment_id || unit.id)}
															class="w-full px-3 py-1.5 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
														>
															Desasignar Dispositivo
														</button>
													</div>
												{:else}
													<!-- Unidad sin dispositivo asignado -->
													<div class="space-y-2">
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
																class="w-full px-2 py-1.5 text-xs rounded input-field"
															>
																<option value="">Seleccionar dispositivo...</option>
																{#each unassignedDevices as device}
																	<option value={device.device_id}>
																		{device.device_id} - {device.brand} {device.model}
																	</option>
																{/each}
															</select>
															<button
																on:click={() => assignDevice(unit.id)}
																disabled={!selectedDeviceId || assigningDevice}
																class="w-full px-3 py-1.5 text-xs rounded transition-colors"
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
						<div class="border-t pt-3 mt-3" style="border-color: var(--border-color)">
							<div class="flex gap-2">
								<input
									type="text"
									bind:value={newUnitName}
									placeholder="Nombre de la unidad"
									class="flex-1 px-2 py-1.5 text-sm rounded input-field"
									on:keydown={(e) => e.key === 'Enter' && createUnit()}
									disabled={creatingUnit}
								/>
								<button
									on:click={createUnit}
									disabled={creatingUnit || !newUnitName.trim()}
									class="add-button"
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

			<button class="large-button" on:click={handleLogout}>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
						clip-rule="evenodd"
					/>
				</svg>
				Cerrar Sesión
			</button>
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
