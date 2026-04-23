<script>
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme, themeActions } from '$lib/stores/themeStore.js';

	export let showUserPanel = false;
	export let userData = null;
	export let onTogglePanel = () => {};
	export let onClose = () => {};

	$: isLightTheme = $theme === 'light';

	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}
</script>

<button
	type="button"
	on:click={onTogglePanel}
	aria-label="Abrir panel de cuenta y preferencias"
	aria-haspopup="dialog"
	aria-expanded={showUserPanel}
	class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 {isLightTheme
		? 'border border-slate-600/45 bg-gradient-to-br from-slate-700 to-slate-900 shadow-[0_2px_6px_rgb(15_23_42_/_0.2)] [box-shadow:inset_0_1px_0_rgb(255_255_255_/_0.08)] hover:brightness-[1.07]'
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
	<div class="space-y-5">
		<section
			class="rounded-xl border border-slate-200 bg-white/95 p-4 text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100"
			aria-labelledby="user-panel-appearance-heading"
		>
			<h3
				id="user-panel-appearance-heading"
				class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
			>
				Apariencia
			</h3>
			<p
				id="user-panel-theme-hint"
				class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400"
			>
				Tema activo: <strong class="font-semibold text-slate-800 dark:text-slate-200"
					>{$theme === 'dark' ? 'Oscuro' : 'Claro'}</strong
				>. Puede cambiar el contraste de la aplicación.
			</p>
			<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<button
					type="button"
					class="inline-flex min-h-[2.75rem] w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-700 sm:w-auto sm:px-4"
					on:click={() => themeActions.toggle()}
					aria-label={$theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
					aria-describedby="user-panel-theme-hint"
				>
					{#if $theme === 'dark'}
						<Icon icon="mdi:white-balance-sunny" class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden min-[380px]:inline sm:inline">Usar tema claro</span>
					{:else}
						<Icon icon="mdi:weather-night" class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="hidden min-[380px]:inline sm:inline">Usar tema oscuro</span>
					{/if}
				</button>
			</div>
		</section>

		<section
			class="rounded-xl border border-slate-200 bg-white/95 p-4 text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100"
			aria-labelledby="user-panel-profile-heading"
		>
			<h3
				id="user-panel-profile-heading"
				class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
			>
				Perfil de usuario
			</h3>
			{#if userData}
				<dl class="mt-3 space-y-3 text-sm">
					<div class="flex items-start gap-3">
						<Icon
							icon="mdi:account"
							class="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
							aria-hidden="true"
						/>
						<div class="min-w-0 flex-1">
							<dt class="sr-only">Nombre</dt>
							<dd class="break-words font-medium leading-snug text-slate-900 dark:text-slate-100">
								{userData.name}
							</dd>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Icon
							icon="mdi:email-outline"
							class="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
							aria-hidden="true"
						/>
						<div class="min-w-0 flex-1">
							<dt class="sr-only">Correo electrónico</dt>
							<dd class="break-all font-medium leading-snug text-slate-900 dark:text-slate-100">
								{userData.email}
							</dd>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Icon
							icon="mdi:identifier"
							class="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
							aria-hidden="true"
						/>
						<div class="min-w-0 flex-1">
							<dt class="sr-only">Identificador de cuenta</dt>
							<dd
								class="font-mono text-[0.8125rem] font-medium leading-snug text-slate-800 dark:text-slate-200"
							>
								{userData.id}
							</dd>
						</div>
					</div>
				</dl>
			{:else}
				<p class="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400" role="status">
					No hay información de usuario disponible.
				</p>
			{/if}
		</section>

		<button
			type="button"
			class="flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-lg border border-blue-700/30 bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/25 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:px-4"
			on:click={handleLogout}
			aria-label="Cerrar sesión y volver a la pantalla de inicio de sesión"
		>
			<Icon icon="mdi:logout" class="h-4 w-4 shrink-0" aria-hidden="true" />
			<span class="hidden min-[380px]:inline sm:inline">Cerrar sesión</span>
		</button>
	</div>
</CenterSheet>
