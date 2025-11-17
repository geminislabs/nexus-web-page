<script>
	import { onMount } from 'svelte';

	// URL de la página principal de la compañía para registro centralizado
	const COMPANY_URL = import.meta.env.VITE_COMPANY_URL || 'http://localhost:5174';

	// Redirigir automáticamente a la página de registro centralizada de Geminis Labs
	onMount(() => {
		window.location.href = `${COMPANY_URL}/auth?mode=register`;
	});
</script>

<svelte:head>
	<title>Redirigiendo... - Tracker Monitor</title>
</svelte:head>

<div class="min-h-screen bg-app flex items-center justify-center px-4">
	<div class="text-center card max-w-md w-full p-8">
		<div class="mb-6">
			<div
				class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
				style="border-color: var(--accent-cyan)"
			></div>
		</div>
		<h2 class="text-2xl font-bold text-app mb-4">Redirigiendo al registro...</h2>
		<p class="text-sm text-app mb-6">
			Serás redirigido a la página de registro centralizada de Geminis Labs.
		</p>
		<p class="text-xs text-app opacity-70">
			Si no eres redirigido automáticamente,
			<a href="{COMPANY_URL}/auth?mode=register" class="text-accent hover:underline">
				haz clic aquí
			</a>
		</p>
	</div>
</div>
