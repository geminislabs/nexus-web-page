<script>
	import Icon from '@iconify/svelte';
	import TelemetryChartsSection from './TelemetryChartsSection.svelte';
	import OffendersSection from './OffendersSection.svelte';

	export let hasResults = false;
	export let loading = false;
	export let summaryCards = [];
	export let offenders = [];
	export let telemetryData = {};
	export let unitOrder = [];
	export let layout = 'mobile';

	// Mapea text-*-400 → border-*-400/30 para el borde de color por card (igual que iOS/Android)
	const borderMap = {
		'text-violet-400': 'border-violet-400/30',
		'text-orange-400': 'border-orange-400/30',
		'text-blue-400': 'border-blue-400/30',
		'text-slate-400': 'border-slate-400/20',
		'text-red-400': 'border-red-400/30',
		'text-amber-400': 'border-amber-400/30',
		'text-emerald-400': 'border-emerald-400/30',
		'text-cyan-400': 'border-cyan-400/30'
	};

	function cardBorder(color) {
		return borderMap[color] ?? 'border-slate-200/60 dark:border-white/10';
	}
</script>

{#if hasResults}
	<!-- Summary cards — border de color por card, igual que iOS/Android SummaryCard -->
	<div
		class={layout === 'wide'
			? 'mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7'
			: 'mb-5 grid grid-cols-2 gap-3'}
	>
		{#each summaryCards as card (card.title)}
			<article
				class="rounded-2xl border bg-white p-4 dark:bg-white/[0.04] {cardBorder(card.color)}"
			>
				<span class={card.color} aria-hidden="true">
					<Icon icon={card.icon} width={20} />
				</span>
				<p class="m-0 mt-3 text-[18px] font-bold text-slate-900 dark:text-white">{card.value}</p>
				<p class="m-0 text-[11px] text-slate-500 dark:text-white/45">{card.title}</p>
			</article>
		{/each}
	</div>

	<OffendersSection {offenders} />

	<TelemetryChartsSection {telemetryData} {unitOrder} wide={layout === 'wide'} />
{:else if !loading}
	<div
		class="flex flex-col items-center gap-3 py-12 text-center {layout === 'wide'
			? 'lg:min-h-[280px] lg:justify-center'
			: ''}"
	>
		<Icon icon="mdi:chart-bar" width={56} class="text-slate-300 dark:text-white/10" />
		<p class="m-0 max-w-md text-sm text-slate-500 dark:text-white/40">
			Seleccione parámetros y pulse «Generar informe» para visualizar telemetría y gráficas.
		</p>
	</div>
{/if}
