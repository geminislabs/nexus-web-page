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
							<span class="text-sm text-app">{userData.name}</span>
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
</style>
