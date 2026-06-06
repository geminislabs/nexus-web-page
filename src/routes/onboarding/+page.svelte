<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import logoUrl from '$lib/assets/logo.png';
	import { setOnboardingComplete } from '$lib/utils/onboardingStorage.js';

	const slides = [
		{
			title: 'Tu información, bajo tu control.',
			description: 'Datos seguros, privados y siempre disponibles desde cualquier lugar.'
		},
		{
			title: 'Las dos caras de la evolución.',
			description: 'Tecnología avanzada, pensada para las personas y sus necesidades.'
		},
		{
			title: 'Conduce con más tranquilidad.',
			description: 'Velocidad, recorridos y eventos clave, todo en un solo lugar.'
		}
	];

	let currentPage = 0;
	let videoEl;
	let videoFailed = false;
	/** @type {ReturnType<typeof setInterval> | null} */
	let autoTimer = null;

	function finish() {
		setOnboardingComplete();
		goto('/login');
	}

	function nextSlide() {
		currentPage = (currentPage + 1) % slides.length;
	}

	onMount(() => {
		autoTimer = setInterval(nextSlide, 5000);
	});

	onDestroy(() => {
		if (autoTimer) clearInterval(autoTimer);
	});
</script>

<svelte:head>
	<title>NEXUS — Bienvenida</title>
</svelte:head>

<div class="fixed inset-0 overflow-hidden bg-[#020617] font-sans text-white">
	{#if !videoFailed}
		<!-- eslint-disable-next-line svelte-a11y-media-has-caption -->
		<video
			bind:this={videoEl}
			class="absolute inset-0 h-full w-full object-cover"
			autoplay
			muted
			loop
			playsinline
			poster=""
			on:error={() => (videoFailed = true)}
		>
			<source src="/vid/onboarding-nexus.mp4" type="video/mp4" />
		</video>
	{/if}

	<div
		class="absolute inset-0 bg-[radial-gradient(circle_at_top,#0f1a33_0%,#020617_55%,#000_100%)] {videoFailed
			? 'opacity-100'
			: 'opacity-65'}"
		aria-hidden="true"
	></div>

	<div class="relative z-10 flex h-full flex-col items-center px-6 pb-10 pt-12">
		<img src={logoUrl} alt="NEXUS" class="mb-8 h-20 w-20 object-contain drop-shadow-lg" />

		<div class="flex flex-1 flex-col items-center justify-center text-center">
			<h1 class="m-0 max-w-md text-[1.65rem] font-bold leading-tight tracking-tight">
				{slides[currentPage].title}
			</h1>
			<p class="m-0 mt-4 max-w-sm text-[15px] leading-relaxed text-white/55">
				{slides[currentPage].description}
			</p>
		</div>

		<div class="mb-8 flex items-center gap-2" aria-label="Progreso del onboarding">
			{#each slides as _, i}
				<span
					class="h-2 rounded-full transition-all duration-300 {i === currentPage
						? 'w-6 bg-cyan-400'
						: 'w-2 bg-white/25'}"
				></span>
			{/each}
		</div>

		<div class="flex w-full max-w-sm flex-col gap-3">
			<button
				type="button"
				class="w-full rounded-2xl border-0 bg-[linear-gradient(135deg,#2563eb_0%,#1d9cc4_100%)] py-3.5 text-base font-semibold text-white shadow-lg"
				on:click={finish}
			>
				Comenzar
			</button>
			<button
				type="button"
				class="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-[15px] font-medium text-white/70"
				on:click={nextSlide}
			>
				Siguiente
				<Icon icon="mdi:chevron-right" class="inline h-4 w-4 align-[-2px]" />
			</button>
		</div>
	</div>
</div>
