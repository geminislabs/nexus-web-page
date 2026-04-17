<script>
	import Icon from '@iconify/svelte';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';

	export let open = false;
	export let title = '';
	export let icon = '';
	export let accentColor = '#2563eb';
	export let sidebarWidth = 72;
	export let headingId = '';

	const dispatch = createEventDispatcher();

	function slugify(s) {
		return (
			String(s || '')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'panel'
		);
	}

	$: headingIdResolved = headingId || `top-drawer-${slugify(title)}`;

	function close() {
		dispatch('close');
	}

	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) close();
	}

	function handleBackdropKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleBackdropClick(e);
		}
	}

	function handleEscape(e) {
		if (e.key === 'Escape') close();
	}

	$: if (browser) {
		window.removeEventListener('keydown', handleEscape);
		if (open) window.addEventListener('keydown', handleEscape);
	}

	onDestroy(() => {
		if (browser) window.removeEventListener('keydown', handleEscape);
	});
</script>

{#if open}
	<div
		class="pointer-events-auto fixed top-0 right-0 bottom-0 z-[44] max-sm:hidden bg-transparent"
		style:left="{sidebarWidth}px"
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKeydown}
		role="presentation"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="pointer-events-auto absolute left-0 right-0 top-0 flex h-[clamp(480px,68vh,780px)] max-h-[780px] flex-col overflow-hidden border-b border-white/[0.07] bg-[rgb(8_11_22_/0.97)] shadow-[0_24px_80px_rgba(0,0,0,0.75),0_4px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[40px] [-webkit-backdrop-filter:blur(40px)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby={headingIdResolved}
			tabindex="-1"
			on:click|stopPropagation
			on:keydown|stopPropagation={(e) => e.stopPropagation()}
			transition:fly={{ y: -20, duration: 380, easing: cubicOut, opacity: 0.95 }}
		>
			<div
				class="h-0.5 shrink-0 opacity-80"
				style="background: linear-gradient(90deg, transparent, {accentColor}, #0ea5e9, transparent);"
				aria-hidden="true"
			></div>

			<header
				class="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-6 pb-4 pt-[1.125rem]"
			>
				<div class="flex min-w-0 flex-1 items-center gap-3.5">
					{#if icon}
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
							style="background: linear-gradient(135deg, {accentColor}33, {accentColor}18);"
							aria-hidden="true"
						>
							<Icon
								{icon}
								class="h-[22px] w-[22px] shrink-0"
								style="color:{accentColor}"
								aria-hidden="true"
							/>
						</div>
					{/if}
					<div class="min-w-0">
						<h2
							id={headingIdResolved}
							class="m-0 text-[1.1875rem] font-bold tracking-tight text-white"
						>
							{title}
						</h2>
					</div>
				</div>
				<button
					type="button"
					class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.07] text-white/55 transition-[background-color,color] duration-150 hover:bg-white/[0.13] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
					on:click={close}
					aria-label="Cerrar panel"
				>
					<Icon icon="mdi:close" class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
				</button>
			</header>

			<div
				class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4"
				role="region"
				aria-label="Contenido de {title}"
			>
				<slot />
			</div>

			<div
				class="h-px shrink-0 opacity-60"
				style="background: linear-gradient(90deg, transparent, {accentColor}30, transparent);"
				aria-hidden="true"
			></div>
		</div>
	</div>
{/if}
