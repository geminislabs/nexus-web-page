<script>
	import Icon from '@iconify/svelte';
	import { createEventDispatcher } from 'svelte';

	/** Si hay cambios en el formulario que no se han guardado. */
	export let dirty = false;
	/** Si existe un borrador guardado en el servidor. */
	export let hasDraft = false;
	/** `'save' | 'publish' | 'discard' | null`: la acción en curso. */
	/** @type {'save' | 'publish' | 'discard' | null} */
	export let busy = null;
	/** Texto de la última publicación, o `null` si nunca se publicó. */
	/** @type {string | null} */
	export let lastPublished = null;

	const dispatch = createEventDispatcher();

	$: canSave = dirty && !busy;
	// Se publica el borrador guardado, no lo que hay en pantalla: con cambios
	// sin guardar, publicar dejaría fuera justo lo último que se escribió.
	$: canPublish = hasDraft && !dirty && !busy;
	$: canDiscard = (hasDraft || dirty) && !busy;
	$: publishHint = !hasDraft
		? 'Guarda un borrador para poder publicarlo.'
		: dirty
			? 'Guarda los cambios antes de publicar.'
			: '';

	const button =
		'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45';
</script>

<div
	class="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-[#0d1424]/95"
>
	<div class="min-w-0 flex-1 text-[12px] text-slate-500 dark:text-white/45" aria-live="polite">
		{#if dirty}
			<span class="font-medium text-amber-700 dark:text-amber-300">Cambios sin guardar</span>
		{:else if hasDraft}
			<span>Borrador guardado, sin publicar</span>
		{:else}
			<span>Sin cambios pendientes</span>
		{/if}
		{#if lastPublished}
			<span class="block truncate">{lastPublished}</span>
		{/if}
	</div>

	<button
		type="button"
		class="{button} text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400/40 dark:text-white/60 dark:hover:bg-white/[0.06]"
		disabled={!canDiscard}
		on:click={() => dispatch('discard')}
	>
		{#if busy === 'discard'}
			<Icon icon="mdi:loading" width={16} class="animate-spin" aria-hidden="true" />
		{/if}
		Descartar
	</button>
	<button
		type="button"
		class="{button} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-emerald-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
		disabled={!canSave}
		on:click={() => dispatch('save')}
	>
		{#if busy === 'save'}
			<Icon icon="mdi:loading" width={16} class="animate-spin" aria-hidden="true" />
		{/if}
		Guardar borrador
	</button>
	<button
		type="button"
		class="{button} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/50"
		disabled={!canPublish}
		title={publishHint || undefined}
		on:click={() => dispatch('publish')}
	>
		{#if busy === 'publish'}
			<Icon icon="mdi:loading" width={16} class="animate-spin" aria-hidden="true" />
		{/if}
		Publicar
	</button>
</div>
