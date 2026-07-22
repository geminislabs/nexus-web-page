<script>
	/** @type {string} */
	export let title = '';
	/** @type {string} */
	export let subtitle = '';
</script>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		<h1
			class="admin-display m-0 text-[1.75rem] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]"
		>
			{title}
		</h1>
		{#if subtitle}
			<p class="m-0 mt-1 max-w-2xl text-sm text-slate-500 dark:text-white/45">{subtitle}</p>
		{/if}
	</div>
	{#if $$slots.actions}
		<div class="flex flex-wrap items-center gap-2">
			<slot name="actions" />
		</div>
	{/if}
</header>
