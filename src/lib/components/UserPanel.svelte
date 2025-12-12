<script>
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/theme.js';
	import { apiService } from '$lib/services/api.js';
	import InviteUser from './InviteUser.svelte';
	import { slide, fade } from 'svelte/transition';

	export let showUserPanel = false;
	export let userData = null;
	export let toggleUserPanel = null;
	export let embedded = false;

	let showPasswordChange = false;
	let oldPassword = '';
	let newPassword = '';
	let loading = false;
	let errorMessage = '';
	let successMessage = '';

	function togglePasswordChange() {
		showPasswordChange = !showPasswordChange;
		if (!showPasswordChange) {
			// Limpiar campos al cerrar
			oldPassword = '';
			newPassword = '';
			errorMessage = '';
			successMessage = '';
		}
	}

	// Invite User State
	let showInviteUser = false;

	function toggleInviteUser() {
		showInviteUser = !showInviteUser;
	}

	function validatePassword(password) {
		if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
		if (password.length > 72) return 'La contraseña no puede exceder los 72 caracteres.';
		if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
		if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
		if (!/[^A-Za-z0-9]/.test(password))
			return 'La contraseña debe incluir al menos un carácter especial.';
		return null;
	}

	async function handleChangePassword() {
		if (!oldPassword || !newPassword) {
			errorMessage = 'Por favor ingresa ambas contraseñas';
			return;
		}

		const validationError = validatePassword(newPassword);
		if (validationError) {
			errorMessage = validationError;
			return;
		}

		loading = true;
		errorMessage = '';
		successMessage = '';

		try {
			const response = await apiService.changePassword({
				old_password: oldPassword,
				new_password: newPassword
			});
			successMessage = response.message || 'Contraseña actualizada correctamente';
			oldPassword = '';
			newPassword = '';
			setTimeout(() => {
				togglePasswordChange();
			}, 2000);
		} catch (error) {
			console.error('Error al cambiar contraseña:', error);
			if (Array.isArray(error.detail)) {
				errorMessage = error.detail.map((e) => e.msg).join(', ');
			} else if (error.detail) {
				errorMessage = error.detail;
			} else {
				errorMessage = error.message || 'Error al cambiar la contraseña';
			}
		} finally {
			loading = false;
		}
	}

	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}
</script>

{#if !embedded}
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
{/if}

<!-- Panel de información de usuario -->
{#if showUserPanel || embedded}
	<div class={embedded ? '' : 'menu-card'}>
		<!-- Información del usuario -->
		<div class="controls">
			<p
				class="text-center text-lg font-bold uppercase tracking-widest mb-12 text-app opacity-100 border-b border-[var(--panel-border)] pb-3"
			>
				Información del Usuario
			</p>
			<div class="p-4 rounded-lg panel shadow-lg">
				{#if userData}
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-app opacity-50" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="text-sm text-app opacity-80">{userData.full_name}</span>
						</div>

						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-app opacity-50" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="text-sm text-app opacity-80">{userData.email}</span>
						</div>
					</div>
				{:else}
					<p class="text-sm text-app opacity-50">No hay información de usuario disponible</p>
				{/if}
			</div>

			<div class="h-px bg-[var(--panel-border)] my-4"></div>

			<button
				class="w-full flex justify-between items-center text-base font-semibold tracking-wide text-app opacity-90"
				on:click={togglePasswordChange}
			>
				<span>Cambiar Contraseña</span>
				<svg
					class="w-4 h-4 transition-transform duration-200 {showPasswordChange ? 'rotate-180' : ''}"
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

			{#if showPasswordChange}
				<div transition:slide class="mt-4 space-y-3">
					{#if errorMessage}
						<p class="text-xs text-red-400 bg-red-400/10 p-2 rounded">{errorMessage}</p>
					{/if}
					{#if successMessage}
						<p class="text-xs text-green-400 bg-green-400/10 p-2 rounded">{successMessage}</p>
					{/if}

					<div>
						<label for="old-pwd" class="block text-xs font-medium text-app opacity-70 mb-1"
							>Contraseña Actual</label
						>
						<input
							id="old-pwd"
							type="password"
							bind:value={oldPassword}
							class="w-full px-3 py-2 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-app text-sm focus:outline-none focus:border-accent-cyan transition-colors"
							placeholder="********"
						/>
					</div>

					<div>
						<label for="new-pwd" class="block text-xs font-medium text-app opacity-70 mb-1"
							>Nueva Contraseña</label
						>
						<input
							id="new-pwd"
							type="password"
							bind:value={newPassword}
							class="w-full px-3 py-2 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-app text-sm focus:outline-none focus:border-accent-cyan transition-colors"
							placeholder="********"
						/>
					</div>

					<button
						class="w-full py-3 rounded-md bg-[var(--accent-cyan)] text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:shadow-[0_0_15px_var(--accent-cyan)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
						on:click={handleChangePassword}
						disabled={loading}
					>
						{#if loading}
							<span class="flex items-center justify-center gap-2">
								<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
										fill="none"
									/>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
								Procesando...
							</span>
						{:else}
							Actualizar Contraseña
						{/if}
					</button>
				</div>
			{/if}

			{#if userData?.is_master}
				<div class="h-px bg-[var(--panel-border)] my-4"></div>

				<button
					class="w-full flex justify-between items-center text-base font-semibold tracking-wide text-app opacity-90"
					on:click={toggleInviteUser}
				>
					<span>Invitar Usuario</span>
					<svg
						class="w-4 h-4 transition-transform duration-200 {showInviteUser ? 'rotate-180' : ''}"
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

				{#if showInviteUser}
					<div transition:slide class="mt-4">
						<InviteUser />
					</div>
				{/if}
			{/if}

			<!-- Mobile Logout Button -->
			<div class="mobile-logout-section">
				<div class="h-px bg-[var(--panel-border)] my-4"></div>
				<button
					class="w-full flex justify-between items-center text-base font-semibold tracking-wide text-red-500 opacity-90 hover:opacity-100 transition-opacity"
					on:click={handleLogout}
				>
					<span>Cerrar Sesión</span>
					<svg
						class="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
	{#if !embedded && showUserPanel}
		<div
			class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
			on:click={toggleUserPanel}
			transition:fade
		></div>
	{/if}
{/if}

<style>
	.mobile-logout-section {
		display: none;
	}

	@media (max-width: 768px) {
		.mobile-logout-section {
			display: block;
		}
	}
</style>
