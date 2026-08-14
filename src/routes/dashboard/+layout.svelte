<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { validateSessionWithApi } from '$lib/services/sessionService.js';
	import '$lib/styles/dashboard.css';

	let { children } = $props();
	let isAuthenticated = $state(false);
	let isLoading = $state(true);

	onMount(() => {
		let cancelled = false;
		let unsubscribe = () => {};

		(async () => {
			user.init();
			authToken.init();

			if (!authToken.getToken()) {
				if (!cancelled) {
					isLoading = false;
					isAuthenticated = false;
					goto('/login');
				}
				return;
			}

			const ok = await validateSessionWithApi();
			if (cancelled) return;

			isAuthenticated = ok;
			isLoading = false;
			if (!ok) {
				goto('/login');
				return;
			}

			unsubscribe = user.subscribe((userData) => {
				if (!userData || !authToken.getToken()) {
					isAuthenticated = false;
					goto('/login');
				}
			});
		})();

		return () => {
			cancelled = true;
			unsubscribe();
		};
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
