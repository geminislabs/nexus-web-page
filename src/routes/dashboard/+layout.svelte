<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { activeOrganizationId } from '$lib/stores/organizationStore.js';
	import { validateSessionWithApi } from '$lib/services/sessionService.js';
	import { clearDataToken } from '$lib/services/dataToken.js';
	import { organizationAccess } from '$lib/stores/organizationAccessStore.js';
	import OrganizationBlockedScreen from '$lib/components/OrganizationBlockedScreen.svelte';
	import '$lib/styles/dashboard.css';

	let { children } = $props();
	let isAuthenticated = $state(false);
	let isLoading = $state(true);

	// La suspensión revoca los data tokens (admin-api), así que el que hubiera en
	// memoria ya no sirve: al levantarse se pide uno nuevo.
	$effect(() => {
		if ($organizationAccess) clearDataToken();
	});

	onMount(() => {
		let cancelled = false;
		let unsubscribe = () => {};

		(async () => {
			user.init();
			authToken.init();
			activeOrganizationId.init();

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
	<!-- Con la organización suspendida no se monta el dashboard: sin mapa, sin
	stream y sin pedir data token. Al levantarse, se vuelve a montar entero. -->
	{#if $organizationAccess}
		<OrganizationBlockedScreen block={$organizationAccess} />
	{:else}
		{@render children?.()}
	{/if}
{/if}
