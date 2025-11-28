<script>
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { apiService } from '$lib/services/api.js';
	import { onMount } from 'svelte';

	// URL de la página principal de la compañía para registro y recuperación de contraseña
	const COMPANY_URL = import.meta.env.VITE_COMPANY_URL || 'http://localhost:5174';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	// Redirigir si ya está autenticado
	onMount(() => {
		authToken.init();
		user.init();
		const unsubscribe = user.subscribe((userData) => {
			if (userData) {
				goto('/dashboard');
			}
		});
		return unsubscribe;
	});

	async function handleLogin() {
		if (!email || !password) {
			error = 'Por favor, completa todos los campos';
			return;
		}

		loading = true;
		error = '';

		try {
			// Llamar a la API de login (POST /api/v1/auth/login)
			const response = await apiService.login({ email, password });

			// La respuesta incluye: user (objeto completo), access_token, id_token, refresh_token, expires_in
			// Verificar que el email esté verificado
			if (response.user && !response.user.email_verified) {
				error = 'Tu email no ha sido verificado. Por favor, verifica tu correo electrónico.';
				loading = false;
				return;
			}

			// Guardar todos los tokens
			authToken.setTokens({
				access_token: response.access_token,
				refresh_token: response.refresh_token,
				id_token: response.id_token,
				expires_in: response.expires_in
			});

			// Guardar los datos del usuario (la API ya nos envía todo el objeto user)
			if (response.user) {
				user.login(response.user);
			}

			// Redirigir al dashboard
			goto('/dashboard');
		} catch (err) {
			console.error('Error en login:', err);

			// Manejar diferentes tipos de errores según el código de estado HTTP
			if (err.status === 401) {
				// Usar el mensaje del API si está disponible, o uno genérico
				error = err.detail || 'Credenciales inválidas. Por favor, verifica tu email y contraseña.';
			} else if (err.status === 403) {
				error =
					err.detail ||
					'Tu email no ha sido verificado. Por favor, verifica tu correo electrónico.';
			} else if (err.status === 400) {
				error = err.detail || 'Formato de email o contraseña inválido.';
			} else if (err.detail) {
				// Si el API nos da un mensaje específico, mostrarlo
				error = err.detail;
			} else {
				error = 'Error al iniciar sesión. Por favor, intenta de nuevo más tarde.';
			}
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
	<title>Login - Nexus</title>
</svelte:head>

<!-- Background video -->
<video
	class="fixed inset-0 w-full h-full object-cover pointer-events-none background-video"
	src="/vid/map-back-1.mp4"
	autoplay
	muted
	loop
	playsinline
	aria-hidden="true"
></video>

<!-- Gradient overlay for readability (theme-aware) -->
<div class="fixed inset-0 overlay-layer pointer-events-none"></div>

<!-- Page content -->
<div class="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
	<div class="max-w-md w-full space-y-8 card">
		<!-- Logo principal -->
		<div class="text-center mb-6">
			<img src="/img/logo-nexus.png" alt="Nexus Logo" class="h-20 mx-auto mb-4" />
			<h2 class="nexus-title">Nexus</h2>
			<h2 class="section-title">Iniciar Sesión</h2>
			<p class="mt-2 text-sm text-app">Accede a tu cuenta de Nexus</p>
		</div>

		<form on:submit|preventDefault={handleLogin} class="space-y-6">
			{#if error}
				<div class="alert-error">{error}</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-app">Correo electrónico</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					on:keypress={handleKeyPress}
					required
					class="input-field"
					placeholder="tu@email.com"
				/>
			</div>

			<div>
				<div class="flex items-center justify-between mb-2">
					<label for="password" class="block text-sm font-medium text-app">Contraseña</label>
					<a
						href="https://geminislabs.com/auth?mode=recover"
						class="text-xs text-accent hover:underline"
						target="_blank"
						tabindex="-1"
					>
						¿Olvidaste tu contraseña?
					</a>
				</div>
				<input
					id="password"
					type="password"
					bind:value={password}
					on:keypress={handleKeyPress}
					required
					class="input-field"
					placeholder="••••••••"
				/>
			</div>

			<div>
				<button type="submit" disabled={loading} class="btn-primary">
					{#if loading}
						<svg
							class="animate-spin -ml-1 mr-3 h-5 w-5 text-accent"
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
								d="M4 12a8 8 0 018-8V0C5.373 0 0 
									  5.373 0 12h4zm2 5.291A7.962 7.962 
									  0 014 12H0c0 3.042 1.135 5.824 
									  3 7.938l3-2.647z"
							></path>
						</svg>
						Iniciando sesión...
					{:else}
						Iniciar Sesión
					{/if}
				</button>
			</div>
		</form>

		<div class="mt-6 text-center">
			<p class="text-sm text-app">
				¿No tienes una cuenta?
				<a
					href="{COMPANY_URL}/auth?mode=register"
					class="font-medium text-accent hover:underline"
					target="_blank"
				>
					Regístrate aquí
				</a>
			</p>
		</div>
	</div>

	<!-- Footer con logo de Geminis Labs -->
	<div class="mt-8 text-center">
		<a
			href={COMPANY_URL}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
		>
			<span class="text-xs text-app">Powered by</span>
			<img src="/img/geminis-labs-logo-short.png" alt="Geminis Labs" class="h-5" />
		</a>
	</div>
</div>
