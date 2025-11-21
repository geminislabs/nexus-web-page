<script>
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/theme.js';

	export let showUserPanel = false;
	export let userData = null;
	export let toggleUserPanel = null;

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
