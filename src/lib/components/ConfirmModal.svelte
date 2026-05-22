<script>
	import { theme } from '$lib/stores/themeStore.js';
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let title = 'Confirmar';
	export let confirmLabel = 'Confirmar';
	export let cancelLabel = 'Cancelar';
	export let loading = false;
	export let destructive = false;
	export let zIndexClass = 'z-[140]';

	const dispatch = createEventDispatcher();

	const titleId = `confirm-modal-title-${Math.random().toString(36).slice(2, 9)}`;
	const descId = `confirm-modal-desc-${Math.random().toString(36).slice(2, 9)}`;

	function cancel() {
		if (loading) return;
		dispatch('cancel');
	}

	function confirm() {
		if (loading) return;
		dispatch('confirm');
	}

	function onKeydown(event) {
		if (open && event.key === 'Escape') cancel();
	}
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
	<div
		class="fixed inset-0 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px] dark:bg-black/50 {zIndexClass}"
		role="presentation"
		on:click|self={cancel}
	>
		<div
			class="w-full max-w-[min(100%,20rem)] rounded-[1.25rem] border px-5 pb-5 pt-5 shadow-xl {$theme ===
			'light'
				? 'border-slate-200/80 bg-slate-100 text-slate-900'
				: 'border-white/[0.1] bg-[#2a3040] text-white'}"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={descId}
			tabindex="-1"
		>
			<h2 id={titleId} class="m-0 text-center text-lg font-bold leading-snug">
				{title}
			</h2>
			<div
				id={descId}
				class="mb-6 mt-3 text-center text-[15px] leading-relaxed {$theme === 'light'
					? 'text-slate-800'
					: 'text-white/85'}"
			>
				<slot />
			</div>
			<div class="flex gap-3">
				<button
					type="button"
					class="min-h-[3rem] flex-1 rounded-full border-0 text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 {$theme ===
					'light'
						? 'bg-slate-300/90 text-slate-900'
						: 'bg-white/20 text-white'}"
					on:click={cancel}
					disabled={loading}
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					class="min-h-[3rem] flex-1 rounded-full border-0 text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 {destructive
						? $theme === 'light'
							? 'bg-red-600 text-white'
							: 'bg-red-600/90 text-white'
						: $theme === 'light'
							? 'bg-slate-300/90 text-orange-600'
							: 'bg-white/20 text-orange-400'}"
					on:click={confirm}
					disabled={loading}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
