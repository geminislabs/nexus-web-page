<script>
	import Icon from '@iconify/svelte';
	import { browser } from '$app/environment';
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let open = false;
	export let title = '';
	export let headingId = 'center-sheet-title';
	/** Optional id(s) of in-slot elements that describe the dialog (space-separated). */
	export let ariaDescribedBy = '';
	/** Optional label for the scrollable content region (defaults from title). */
	export let contentRegionLabel = '';
	export let onClose = () => {};

	let portalHost;
	let panelEl;

	$: describedByIds = ['center-sheet-chrome-hint', ariaDescribedBy.trim() || null]
		.filter(Boolean)
		.join(' ');

	$: regionLabel =
		(contentRegionLabel || '').trim() || (title ? `Contenido: ${title}` : 'Contenido del panel');

	$: if (browser && open) {
		tick().then(() => panelEl?.focus?.());
	}

	function backdropClick() {
		onClose();
	}

	function onKeydown(event) {
		if (event.key === 'Escape') onClose();
	}

	onMount(async () => {
		await tick();
		if (portalHost && portalHost.parentNode !== document.body) {
			document.body.appendChild(portalHost);
		}
	});

	onDestroy(() => {
		portalHost?.remove();
	});
</script>

<svelte:window on:keydown={onKeydown} />

<div bind:this={portalHost} class="pointer-events-none">
	{#if open}
		<div
			class="pointer-events-auto fixed inset-0 z-[55] flex flex-col items-center px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-6"
			transition:fade={{ duration: 240 }}
		>
			<button
				type="button"
				class="absolute inset-0 cursor-default border-0 bg-slate-950/50 p-0 backdrop-blur-[2px] transition-opacity hover:bg-slate-950/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
				aria-label="Cerrar panel"
				on:click={backdropClick}
			></button>

			<div
				bind:this={panelEl}
				class="center-sheet-panel relative z-[1] flex max-h-[min(82vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
				role="dialog"
				aria-modal="true"
				aria-labelledby={headingId}
				aria-describedby={describedByIds}
				tabindex="-1"
				transition:fly={{ y: -72, duration: 680, easing: cubicOut, opacity: 0.92 }}
			>
				<p id="center-sheet-chrome-hint" class="sr-only">
					Ventana modal centrada. Este contenedor no ejecuta consultas ni escrituras a base de
					datos; la persistencia corresponde a las acciones del contenido incrustado (por ejemplo
					unidades, zonas o cuenta según la pantalla).
				</p>

				<header
					class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-700"
				>
					<h2
						id={headingId}
						class="m-0 pr-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
					>
						{title}
					</h2>
					<button
						type="button"
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
						on:click={onClose}
						aria-label="Cerrar panel"
					>
						<Icon icon="mdi:close" class="h-5 w-5 shrink-0" aria-hidden="true" />
					</button>
				</header>

				<div
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
					role="region"
					aria-label={regionLabel}
				>
					<slot />
				</div>
			</div>
		</div>
	{/if}
</div>
