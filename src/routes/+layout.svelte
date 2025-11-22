<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { user, authToken } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme.js';

	import { apiService } from '$lib/services/api.js';

	let { children } = $props();

	onMount(() => {
		// Inicializar stores de autenticación
		user.init();
		authToken.init();

		// Verificar estado del token al cargar
		checkAndRefreshToken();

		// Configurar intervalo para verificar expiración cada minuto
		const interval = setInterval(checkAndRefreshToken, 60 * 1000);

		return () => {
			clearInterval(interval);
		};
	});

	async function checkAndRefreshToken() {
		// Si el token está por expirar en los próximos 5 minutos (300s)
		if (authToken.isTokenExpiringSoon(300)) {
			console.log('Token expiring soon, refreshing...');
			try {
				await apiService.refreshSession();
				console.log('Token refreshed successfully');
			} catch (error) {
				console.error('Failed to refresh token proactively:', error);
				// No hacemos logout aquí para no interrumpir al usuario si es un error transitorio,
				// el interceptor de api.js manejará el 401 si falla después.
			}
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
