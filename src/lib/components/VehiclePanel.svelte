<script>
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import InviteUser from '$lib/components/InviteUser.svelte';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme, themeActions } from '$lib/stores/themeStore.js';
	import { apiService } from '$lib/services/api.js';
	import { slide } from 'svelte/transition';

	export let showUserPanel = false;
	export let userData = null;
	export let onTogglePanel = () => {};
	export let onClose = () => {};

	$: isLightTheme = $theme === 'light';

	// ── Cambiar contraseña ────────────────────────────────────
	let showPasswordChange = false;
	let oldPassword = '';
	let newPassword = '';
	let pwdLoading = false;
	let pwdError = '';
	let pwdSuccess = '';

	function togglePasswordChange() {
		showPasswordChange = !showPasswordChange;
		if (!showPasswordChange) {
			oldPassword = '';
			newPassword = '';
			pwdError = '';
			pwdSuccess = '';
		}
	}

	function validatePassword(password) {
		if (password.length < 8) return 'Debe tener al menos 8 caracteres.';
		if (password.length > 72) return 'No puede exceder los 72 caracteres.';
		if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una mayúscula.';
		if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número.';
		if (!/[^A-Za-z0-9]/.test(password)) return 'Debe incluir al menos un carácter especial.';
		return null;
	}

	async function handleChangePassword() {
		if (!oldPassword || !newPassword) {
			pwdError = 'Por favor ingresa ambas contraseñas.';
			return;
		}
		const validationError = validatePassword(newPassword);
		if (validationError) {
			pwdError = validationError;
			return;
		}

		pwdLoading = true;
		pwdError = '';
		pwdSuccess = '';
		try {
			const response = await apiService.changePassword({
				old_password: oldPassword,
				new_password: newPassword
			});
			pwdSuccess = response.message || 'Contraseña actualizada correctamente.';
			oldPassword = '';
			newPassword = '';
			setTimeout(() => togglePasswordChange(), 2000);
		} catch (error) {
			if (Array.isArray(error.detail)) {
				pwdError = error.detail.map((e) => e.msg).join(', ');
			} else {
				pwdError = error.detail || error.message || 'Error al cambiar la contraseña.';
			}
		} finally {
			pwdLoading = false;
		}
	}

	// ── Invitar usuario ───────────────────────────────────────
	let showInviteUser = false;

	// ── Logout ────────────────────────────────────────────────
	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}
</script>

<!-- Botón disparador -->
<button
	type="button"
	on:click={onTogglePanel}
	aria-label="Abrir panel de cuenta y preferencias"
	aria-haspopup="dialog"
	aria-expanded={showUserPanel}
	class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 {isLightTheme
		? 'border border-slate-600/45 bg-gradient-to-br from-slate-700 to-slate-900 shadow-[0_2px_6px_rgb(15_23_42_/_0.2)] hover:brightness-[1.07]'
		: 'border border-white/10 bg-white/10 hover:bg-white/[0.16]'}"
	class:ring-2={showUserPanel}
	class:ring-blue-400={showUserPanel}
	class:ring-offset-2={showUserPanel}
	class:ring-offset-slate-900={showUserPanel && isLightTheme}
	class:ring-offset-slate-950={showUserPanel && !isLightTheme}
>
	<Icon icon="mdi:account-circle" class="h-8 w-8 shrink-0" aria-hidden="true" />
</button>

<CenterSheet open={showUserPanel} title="Cuenta" onClose={() => onClose()}>
	<div class="space-y-4">
		<!-- ── Perfil ── -->
		<section
			class="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
			aria-labelledby="up-profile-heading"
		>
			<h3 id="up-profile-heading" class="m-0 text-sm font-semibold text-slate-900 dark:text-white">
				Perfil de usuario
			</h3>
			{#if userData}
				<dl class="mt-3 space-y-2.5 text-sm">
					<div class="flex items-start gap-3">
						<Icon
							icon="mdi:account"
							class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-white/40"
							aria-hidden="true"
						/>
						<div class="min-w-0 flex-1">
							<dt class="sr-only">Nombre</dt>
							<dd class="break-words font-medium text-slate-900 dark:text-white">
								{userData.name || userData.full_name || '—'}
							</dd>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Icon
							icon="mdi:email-outline"
							class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-white/40"
							aria-hidden="true"
						/>
						<div class="min-w-0 flex-1">
							<dt class="sr-only">Correo</dt>
							<dd class="break-all font-medium text-slate-900 dark:text-white">{userData.email}</dd>
						</div>
					</div>
					{#if userData.id}
						<div class="flex items-start gap-3">
							<Icon
								icon="mdi:identifier"
								class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-white/40"
								aria-hidden="true"
							/>
							<div class="min-w-0 flex-1">
								<dt class="sr-only">ID</dt>
								<dd class="font-mono text-[0.75rem] text-slate-600 dark:text-white/55 break-all">
									{userData.id}
								</dd>
							</div>
						</div>
					{/if}
				</dl>
			{:else}
				<p class="mt-3 text-sm text-slate-500 dark:text-white/40">No hay información disponible.</p>
			{/if}
		</section>

		<!-- ── Apariencia ── -->
		<section
			class="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
			aria-labelledby="up-theme-heading"
		>
			<div class="flex items-center justify-between gap-3">
				<div>
					<h3
						id="up-theme-heading"
						class="m-0 text-sm font-semibold text-slate-900 dark:text-white"
					>
						Apariencia
					</h3>
					<p class="m-0 mt-0.5 text-xs text-slate-500 dark:text-white/40">
						Tema: <strong class="text-slate-700 dark:text-white/70"
							>{$theme === 'dark' ? 'Oscuro' : 'Claro'}</strong
						>
					</p>
				</div>
				<button
					type="button"
					class="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
					on:click={() => themeActions.toggle()}
					aria-label={$theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
				>
					{#if $theme === 'dark'}
						<Icon
							icon="mdi:white-balance-sunny"
							class="h-4 w-4 shrink-0 text-amber-400"
							aria-hidden="true"
						/>
						<span>Claro</span>
					{:else}
						<Icon
							icon="mdi:weather-night"
							class="h-4 w-4 shrink-0 text-indigo-400"
							aria-hidden="true"
						/>
						<span>Oscuro</span>
					{/if}
				</button>
			</div>
		</section>

		<!-- ── Cambiar contraseña ── -->
		<section
			class="rounded-xl border border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
			aria-labelledby="up-pwd-heading"
		>
			<button
				type="button"
				class="flex w-full items-center justify-between px-4 py-3.5 text-left"
				on:click={togglePasswordChange}
				aria-expanded={showPasswordChange}
			>
				<span class="flex items-center gap-2.5">
					<Icon
						icon="mdi:lock-outline"
						class="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40"
						aria-hidden="true"
					/>
					<h3 id="up-pwd-heading" class="m-0 text-sm font-semibold text-slate-900 dark:text-white">
						Cambiar contraseña
					</h3>
				</span>
				<Icon
					icon="mdi:chevron-down"
					class="h-4 w-4 shrink-0 text-slate-400 dark:text-white/35 transition-transform duration-200 {showPasswordChange
						? 'rotate-180'
						: ''}"
					aria-hidden="true"
				/>
			</button>

			{#if showPasswordChange}
				<div
					transition:slide={{ duration: 200 }}
					class="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-white/[0.06]"
				>
					{#if pwdError}
						<p
							class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
						>
							{pwdError}
						</p>
					{/if}
					{#if pwdSuccess}
						<p
							class="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
						>
							{pwdSuccess}
						</p>
					{/if}

					<div class="space-y-3">
						<div>
							<label
								for="up-old-pwd"
								class="mb-1 block text-xs font-medium text-slate-600 dark:text-white/50"
							>
								Contraseña actual
							</label>
							<input
								id="up-old-pwd"
								type="password"
								bind:value={oldPassword}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30"
								placeholder="••••••••"
								disabled={pwdLoading}
							/>
						</div>
						<div>
							<label
								for="up-new-pwd"
								class="mb-1 block text-xs font-medium text-slate-600 dark:text-white/50"
							>
								Nueva contraseña
							</label>
							<input
								id="up-new-pwd"
								type="password"
								bind:value={newPassword}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30"
								placeholder="••••••••"
								disabled={pwdLoading}
							/>
							<p class="mt-1 text-[10px] text-slate-400 dark:text-white/30">
								Mín. 8 caracteres, una mayúscula, un número y un carácter especial.
							</p>
						</div>
						<button
							type="button"
							class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							on:click={handleChangePassword}
							disabled={pwdLoading}
						>
							{#if pwdLoading}
								<Icon icon="mdi:loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
								Actualizando…
							{:else}
								Actualizar contraseña
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</section>

		<!-- ── Invitar usuario (solo masters) ── -->
		{#if userData?.is_master}
			<section
				class="rounded-xl border border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
				aria-labelledby="up-invite-heading"
			>
				<button
					type="button"
					class="flex w-full items-center justify-between px-4 py-3.5 text-left"
					on:click={() => (showInviteUser = !showInviteUser)}
					aria-expanded={showInviteUser}
				>
					<span class="flex items-center gap-2.5">
						<Icon
							icon="mdi:account-plus-outline"
							class="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40"
							aria-hidden="true"
						/>
						<h3
							id="up-invite-heading"
							class="m-0 text-sm font-semibold text-slate-900 dark:text-white"
						>
							Invitar usuario
						</h3>
					</span>
					<Icon
						icon="mdi:chevron-down"
						class="h-4 w-4 shrink-0 text-slate-400 dark:text-white/35 transition-transform duration-200 {showInviteUser
							? 'rotate-180'
							: ''}"
						aria-hidden="true"
					/>
				</button>

				{#if showInviteUser}
					<div
						transition:slide={{ duration: 200 }}
						class="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-white/[0.06]"
					>
						<InviteUser />
					</div>
				{/if}
			</section>
		{/if}

		<!-- ── Cerrar sesión ── -->
		<button
			type="button"
			class="flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
			on:click={handleLogout}
			aria-label="Cerrar sesión"
		>
			<Icon icon="mdi:logout" class="h-4 w-4 shrink-0" aria-hidden="true" />
			Cerrar sesión
		</button>
	</div>
</CenterSheet>
