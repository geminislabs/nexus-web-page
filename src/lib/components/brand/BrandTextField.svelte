<script>
	/** Campo de texto de la pantalla de marca: etiqueta, ayuda y error accesibles. */
	export let id;
	export let label;
	export let value = '';
	export let type = 'text';
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let maxlength = undefined;
	export let autocomplete = 'off';

	$: describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
		.filter(Boolean)
		.join(' ');

	const base =
		'w-full rounded-xl border bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 disabled:opacity-60 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30';
	$: inputClass = `${base} ${
		error
			? 'border-rose-400 focus-visible:ring-rose-500/40 dark:border-rose-400/60'
			: 'border-slate-200 focus-visible:ring-emerald-500/40 dark:border-white/10'
	}`;

	function onInput(event) {
		value = event.currentTarget.value;
	}
</script>

<div class="block">
	<label
		for={id}
		class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
	>
		{label}{#if required}<span class="text-rose-500" aria-hidden="true"> *</span>{/if}
	</label>
	<input
		{id}
		{type}
		{value}
		{placeholder}
		{disabled}
		{maxlength}
		{autocomplete}
		{required}
		class={inputClass}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy || undefined}
		on:input={onInput}
		on:blur
	/>
	{#if error}
		<p id="{id}-error" class="m-0 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
			{error}
		</p>
	{:else if hint}
		<p id="{id}-hint" class="m-0 mt-1 text-[11px] text-slate-500 dark:text-white/40">{hint}</p>
	{/if}
</div>
