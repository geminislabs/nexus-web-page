<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { user, authToken } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme.js';

	let { children } = $props();

	onMount(() => {
		// Inicializar stores de autenticación
		user.init();
		authToken.init();
		// Importar el store de tema asegura que el atributo data-theme se aplique
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
