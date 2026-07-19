<script>
	import Icon from '@iconify/svelte';
	import { isUnitMoving } from '$lib/utils/unitTrackingStatus.js';

	/** @type {Array<Record<string, unknown>>} */
	export let units = [];
	/** @type {'all' | 'moving' | 'stopped'} */
	export let value = 'all';
	/** @type {'sheet' | 'embedded'} */
	export let variant = 'sheet';

	const statusPanels = [
		{
			id: 'all',
			label: 'Todas',
			icon: 'mdi:car-side',
			iconWrap: 'bg-slate-200 text-slate-600 dark:bg-white/15 dark:text-white',
			activeClass:
				'border-blue-500/50 bg-blue-600 text-white dark:border-blue-500/50 dark:bg-blue-600'
		},
		{
			id: 'moving',
			label: 'En movimiento',
			icon: 'mdi:play',
			iconWrap: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
			activeClass:
				'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-white'
		},
		{
			id: 'stopped',
			label: 'Paradas',
			icon: 'mdi:pause',
			iconWrap: 'bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
			activeClass:
				'border-orange-500/40 bg-orange-500/15 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-white'
		}
	];

	$: movingCount = units.filter((v) => isUnitMoving(v)).length;
	$: panelCounts = {
		all: units.length,
		moving: movingCount,
		stopped: units.length - movingCount
	};

	const inactiveClass = 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]';
	const inactiveLabelClass = 'text-slate-600 dark:text-white/55';
	const inactiveCountClass = 'text-slate-900 dark:text-white';
</script>

<div class="grid grid-cols-3 gap-2" data-variant={variant}>
	{#each statusPanels as panel (panel.id)}
		{@const isActive = value === panel.id}
		<button
			type="button"
			class="flex min-h-[72px] flex-col justify-between rounded-2xl border px-2.5 py-2.5 text-left transition-colors
				{isActive ? panel.activeClass : inactiveClass}"
			on:click={() => (value = panel.id)}
			aria-pressed={isActive}
		>
			<div class="flex w-full items-start justify-between gap-1">
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {isActive
						? 'bg-white/20 text-white'
						: panel.iconWrap}"
				>
					<Icon icon={panel.icon} width={14} aria-hidden="true" />
				</span>
				<span
					class="text-[22px] font-bold leading-none {isActive ? 'text-white' : inactiveCountClass}"
				>
					{panelCounts[panel.id]}
				</span>
			</div>
			<span
				class="truncate text-[11px] font-semibold {isActive ? 'text-white/95' : inactiveLabelClass}"
			>
				{panel.label}
			</span>
		</button>
	{/each}
</div>
