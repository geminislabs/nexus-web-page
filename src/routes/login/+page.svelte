<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user, authToken } from '$lib/stores/auth.js';
	import { apiService } from '$lib/services/api.js';
	import { bypassAuthInDev } from '$lib/config/env.js';
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import logoUrl from '$lib/assets/logo.png';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let showPassword = false;

	const DEV_USER = { id: 1, name: 'Alan Antonio', email: 'alan.antonio@geminislabs.com' };

	// Redirigir si ya está autenticado
	onMount(() => {
		user.init();
		authToken.init();
		const unsubscribe = user.subscribe((userData) => {
			if (userData) {
				goto('/dashboard');
			}
		});
		return unsubscribe;
	});

	async function handleLogin() {
		if (loading) return;

		if (!email || !password) {
			error = 'Por favor, completa todos los campos';
			return;
		}

		if (bypassAuthInDev) {
			authToken.setToken('mock-dev-token');
			user.login(DEV_USER);
			goto('/dashboard');
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await apiService.login({ email, password });
			const apiUser = response?.user || {};
			const normalizedUser = {
				...apiUser,
				name: apiUser.name || apiUser.full_name || ''
			};

			// Guardar token y datos del usuario
			authToken.setToken(response.access_token);
			user.login(normalizedUser);

			// Redirigir al dashboard
			goto('/dashboard');
		} catch (err) {
			error = 'Credenciales inválidas. Por favor, intenta de nuevo.';
		} finally {
			loading = false;
		}
	}

	function handleKeyPress(event) {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<svelte:head>
	<title>NEXUS — Iniciar sesión</title>
	<meta
		name="description"
		content="Accede a NEXUS, la plataforma de GeminisLabs para monitorización y gestión de flotas."
	/>
	<link rel="canonical" href={`${$page.url.origin}/login`} />
</svelte:head>

<div
	class="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-100 font-sans [-webkit-font-smoothing:antialiased] dark:bg-[#0a0f0a]"
>
	<div
		class="pointer-events-none absolute -left-20 -top-[100px] h-[420px] w-[420px] animate-pulse rounded-full bg-[radial-gradient(circle,#bbf7d0_0%,transparent_70%)] opacity-25 blur-[80px] duration-[14s] dark:bg-[radial-gradient(circle,#1a4d2a_0%,transparent_70%)] dark:opacity-[0.45]"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute bottom-[-80px] right-[60px] h-80 w-80 animate-pulse rounded-full bg-[radial-gradient(circle,#a7f3d0_0%,transparent_70%)] opacity-25 blur-[80px] duration-[18s] dark:bg-[radial-gradient(circle,#0d3322_0%,transparent_70%)] dark:opacity-[0.45]"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute left-[60%] top-[40%] h-[200px] w-[200px] animate-pulse rounded-full bg-[radial-gradient(circle,#86efac_0%,transparent_70%)] opacity-20 blur-[80px] duration-[22s] dark:bg-[radial-gradient(circle,#163d1e_0%,transparent_70%)] dark:opacity-[0.45]"
		aria-hidden="true"
	></div>

	<main
		class="relative z-10 flex w-[min(420px,92vw)] flex-col items-center rounded-[20px] border border-slate-200 bg-white px-8 pb-6 pt-8 shadow-xl backdrop-blur-xl transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-2xl dark:border-white/20 dark:bg-white/[0.08] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] dark:hover:border-[#00a6c0] dark:hover:shadow-[0_15px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
		aria-labelledby="login-heading"
	>
		<div
			class="mb-5 flex h-[88px] w-[88px] items-center justify-center drop-shadow-[0_0_24px_rgba(74,222,128,0.35)]"
		>
			<img src={logoUrl} alt="" class="h-full w-full object-contain" />
		</div>

		<h1
			id="login-heading"
			class="mb-1 mt-0 text-center text-4xl font-extrabold tracking-[0.15em] text-slate-900 dark:text-white dark:[text-shadow:0_2px_20px_rgba(255,255,255,0.15)]"
		>
			NEXUS
		</h1>
		<p class="mb-8 mt-0 text-center text-sm tracking-wide text-slate-600 dark:text-white/45">
			by GeminisLabs
		</p>

		<form
			class="flex w-full flex-col gap-4"
			on:submit|preventDefault={handleLogin}
			aria-describedby={error ? 'login-error' : undefined}
			noValidate
		>
			{#if error}
				<div
					id="login-error"
					class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[0.8125rem] text-red-800 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300"
					role="alert"
					aria-live="assertive"
				>
					{error}
				</div>
			{/if}

			<div>
				<label for="login-email" class="sr-only">Correo electrónico</label>
				<div class="relative flex items-center">
					<Icon
						icon="mdi:email-outline"
						class="pointer-events-none absolute left-4 h-[18px] w-[18px] shrink-0 text-slate-400 dark:text-white/35"
						aria-hidden="true"
					/>
					<input
						id="login-email"
						type="email"
						name="email"
						bind:value={email}
						placeholder="Correo electrónico"
						class="w-full appearance-none rounded-[14px] border border-slate-200 bg-white py-3.5 pl-[2.875rem] pr-4 text-[0.9375rem] text-slate-900 outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/30 dark:focus:border-blue-500/70 dark:focus:bg-white/11"
						autocomplete="username"
						inputmode="email"
						aria-required="true"
					/>
				</div>
			</div>

			<div>
				<label for="login-password" class="sr-only">Contraseña</label>
				<div class="relative flex items-center">
					<Icon
						icon="mdi:lock-outline"
						class="pointer-events-none absolute left-4 h-[18px] w-[18px] shrink-0 text-slate-400 dark:text-white/35"
						aria-hidden="true"
					/>
					<input
						id="login-password"
						type={showPassword ? 'text' : 'password'}
						name="password"
						bind:value={password}
						placeholder="Contraseña"
						class="w-full appearance-none rounded-[14px] border border-slate-200 bg-white py-3.5 pl-[2.875rem] pr-12 text-[0.9375rem] text-slate-900 outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/30 dark:focus:border-blue-500/70 dark:focus:bg-white/11"
						autocomplete="current-password"
						aria-required="true"
					/>
					<button
						type="button"
						class="absolute right-3.5 flex items-center border-0 bg-transparent p-1 text-slate-500 transition-colors hover:text-slate-800 dark:text-white/35 dark:hover:text-white/65"
						on:click={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
						aria-pressed={showPassword}
					>
						{#if showPassword}
							<Icon icon="mdi:eye" class="h-[18px] w-[18px]" aria-hidden="true" />
						{:else}
							<Icon icon="mdi:eye-off" class="h-[18px] w-[18px]" aria-hidden="true" />
						{/if}
					</button>
				</div>
			</div>

			<button
				type="submit"
				class="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[linear-gradient(135deg,#2563eb_0%,#1d9cc4_100%)] py-[0.9375rem] text-base font-semibold tracking-wide text-white shadow-[0_4px_24px_rgba(37,99,235,0.45)] transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:opacity-90 enabled:active:translate-y-0 enabled:active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={loading}
				aria-busy={loading}
			>
				{#if loading}
					<Icon icon="mdi:loading" class="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
					Iniciando sesión...
				{:else}
					Iniciar sesión
				{/if}
			</button>

			{#if bypassAuthInDev}
				<div
					class="-mt-1 flex items-center justify-center gap-2 text-center text-xs text-slate-500 dark:text-white/35"
				>
					<span
						class="shrink-0 rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-amber-400"
						>DEV</span
					>
					Cualquier credencial funciona en modo desarrollo
				</div>
			{/if}
		</form>

		<p class="mt-5 text-center text-[0.8125rem] text-slate-600 dark:text-white/[0.38]">
			¿No tienes cuenta?
			<a
				href="/register"
				class="font-medium text-blue-600 no-underline hover:underline dark:text-blue-400"
				>Regístrate</a
			>
		</p>
	</main>
</div>
