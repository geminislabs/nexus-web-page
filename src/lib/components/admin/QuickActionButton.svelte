<script>
	import Icon from '@iconify/svelte';

	/** @type {string} */
	export let label = '';
	/** @type {string} */
	export let icon = 'mdi:plus';
	/** @type {(() => void) | null} */
	export let onClick = null;
</script>

<button
	type="button"
	class="flex min-h-[4.5rem] flex-col items-start justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-sm transition-[transform,border-color,background] duration-150 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-emerald-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/[0.08] dark:bg-[#0d1424] dark:hover:border-emerald-400/35 dark:hover:bg-emerald-500/5"
	on:click={() => onClick?.()}
>
	<span
		class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
		aria-hidden="true"
	>
		<Icon {icon} width={18} />
	</span>
	<span class="text-[12px] font-semibold text-slate-800 dark:text-white/85">{label}</span>
</button>
