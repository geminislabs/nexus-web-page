<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth.js';
	import '$lib/styles/dashboard.css';

	let { children } = $props();
	let isAuthenticated = $state(false);
	let isLoading = $state(true);

	onMount(() => {
		user.init();

		const unsubscribe = user.subscribe((userData) => {
			isAuthenticated = !!userData;
			isLoading = false;

			if (!userData) {
				goto('/login');
			}
		});

		return unsubscribe;
	});
</script>

{#if isLoading}
	<div class="min-h-screen flex items-center justify-center bg-gray-100">
		<div class="text-center">
			<div
				class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
			></div>
			<p class="text-gray-600">Verificando autenticación...</p>
		</div>
	</div>
{:else if isAuthenticated}
	{@render children?.()}
{/if}
