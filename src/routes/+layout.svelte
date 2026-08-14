<script>
	import { logger } from '$lib/utils/logger.js';
	import { initObservability } from '$lib/observability/index.js';
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { user, authToken } from '$lib/stores/auth.js';
	import { themeActions } from '$lib/stores/themeStore.js';
	import { onMount } from 'svelte';

	import { apiService } from '$lib/services/api.js';

	let { children } = $props();

	onMount(() => {
		initObservability();
		themeActions.init();
		user.init();
		authToken.init();

		checkAndRefreshToken();

		const interval = setInterval(checkAndRefreshToken, 60 * 1000);

		return () => {
			clearInterval(interval);
		};
	});

	async function checkAndRefreshToken() {
		if (authToken.isTokenExpiringSoon(300)) {
			try {
				await apiService.refreshSession();
			} catch (error) {
				logger.error({
					code: 'AUTH_REFRESH_PROACTIVE_FAILED',
					message: 'Failed to refresh token proactively',
					err: error
				});
				// El interceptor de api.js limpia sesión si el refresh falla en un 401.
			}
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
