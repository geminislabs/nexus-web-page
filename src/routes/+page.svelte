<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isOnboardingComplete } from '$lib/utils/onboardingStorage.js';

	onMount(() => {
		goto(isOnboardingComplete() ? '/login' : '/onboarding');
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-app">
	<div class="text-center">
		<div
			class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
			style="border-color: var(--accent-cyan)"
		></div>
		<p class="text-app">Redirigiendo a Login...</p>
	</div>
</div>
