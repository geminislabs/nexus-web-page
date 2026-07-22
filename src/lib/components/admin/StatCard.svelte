<script>
	import Icon from '@iconify/svelte';

	/** @type {string} */
	export let label = '';
	/** @type {string | number} */
	export let value = '—';
	/** @type {string} */
	export let icon = 'mdi:chart-box-outline';
	/** @type {string} */
	export let hint = '';
	/** @type {string} */
	export let accent = 'emerald';
	/** @type {(() => void) | null} */
	export let onClick = null;

	const accents = {
		emerald: {
			icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
			bar: 'from-emerald-500/80 to-teal-400/40'
		},
		sky: {
			icon: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
			bar: 'from-sky-500/80 to-cyan-400/40'
		},
		amber: {
			icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
			bar: 'from-amber-500/80 to-orange-400/40'
		},
		rose: {
			icon: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
			bar: 'from-rose-500/80 to-pink-400/40'
		},
		slate: {
			icon: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
			bar: 'from-slate-400/70 to-slate-500/30'
		}
	};

	$: a = accents[accent] ?? accents.emerald;
	$: interactive = typeof onClick === 'function';
</script>

{#if interactive}
	<button
		type="button"
		class="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/[0.08] dark:bg-[#0d1424] dark:shadow-none dark:hover:border-emerald-400/30"
		on:click={onClick}
	>
		{@render body()}
	</button>
{:else}
	<div
		class="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0d1424] dark:shadow-none"
	>
		{@render body()}
	</div>
{/if}

{#snippet body()}
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r {a.bar}"
		aria-hidden="true"
	></div>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p
				class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/45"
			>
				{label}
			</p>
			<p
				class="admin-stat-value m-0 mt-2 text-[1.85rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-white"
			>
				{value}
			</p>
			{#if hint}
				<p class="m-0 mt-2 text-[11px] font-medium text-slate-500 dark:text-white/40">{hint}</p>
			{/if}
		</div>
		<span
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {a.icon}"
			aria-hidden="true"
		>
			<Icon {icon} width={20} />
		</span>
	</div>
{/snippet}
