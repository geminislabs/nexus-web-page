<script>
	import { initObservability } from '$lib/observability/index.js';
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { user, authToken } from '$lib/stores/auth.js';
	import { themeActions } from '$lib/stores/themeStore.js';
	import { onMount } from 'svelte';

	import { apiService } from '$lib/services/api.js';
	import { marcaOPorDefecto } from '$lib/brand.js';

	let { children, data } = $props();

	const marca = $derived(marcaOPorDefecto(data?.brand));

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

	function checkAndRefreshToken() {
		// Pasa por el mismo candado que el interceptor de 401: dos caminos que
		// renuevan por separado mandan dos refresh con el mismo token.
		apiService.refreshIfExpiringSoon();
	}
</script>

<svelte:head>
	<link rel="icon" href={marca.faviconUrl || favicon} />
	<meta name="application-name" content={marca.isDefault ? 'NEXUS' : marca.name} />
</svelte:head>

{@render children?.()}
