<script>
	import Icon from '@iconify/svelte';
	import { createEventDispatcher } from 'svelte';
	import { alerts, zones } from '$lib/stores/alertStore.js';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';
	import ZonasPanel from '$lib/components/ZonasPanel.svelte';

	/** @type {'alertas' | 'zonas'} */
	export let initialTab = 'alertas';

	const dispatch = createEventDispatcher();

	/** @type {'alertas' | 'zonas'} */
	let tab = initialTab;
	let drawerZoneSubView = 'zonas';

	const tabs = [
		{
			id: 'alertas',
			label: 'Alertas',
			icon: 'mdi:bell-ring-outline',
			count: () => $alerts.length
		},
		{
			id: 'zonas',
			label: 'Zonas',
			icon: 'mdi:hexagon-multiple-outline',
			count: () => $zones.length
		}
	];

	function selectTab(id) {
		tab = id;
		if (id === 'alertas') drawerZoneSubView = 'zonas';
	}
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-transparent">
	<div
		class="flex shrink-0 gap-1 border-b border-slate-200 px-3 pt-2 dark:border-white/[0.07]"
		role="tablist"
		aria-label="Alertas y zonas"
	>
		{#each tabs as t (t.id)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t.id}
				class="relative flex flex-1 items-center justify-center gap-1.5 rounded-t-xl px-2 py-2.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50
					{tab === t.id
					? 'bg-slate-50 text-emerald-800 dark:bg-white/[0.05] dark:text-emerald-300'
					: 'text-slate-500 hover:bg-slate-50/80 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/[0.04] dark:hover:text-white/75'}"
				on:click={() => selectTab(t.id)}
			>
				<Icon icon={t.icon} width={16} aria-hidden="true" />
				<span class="truncate">{t.label}</span>
				<span
					class="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums
						{tab === t.id
						? 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
						: 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-white/45'}"
				>
					{t.count()}
				</span>
				{#if tab === t.id}
					<span
						class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-500"
						aria-hidden="true"
					></span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="min-h-0 flex-1 overflow-hidden" role="tabpanel">
		{#if tab === 'alertas'}
			<div class="h-full min-h-0 overflow-y-auto">
				{#key 'alertas'}
					<DrawerConfiguracion
						initialSection="gestionar_alertas"
						showSectionSidebar={false}
						on:close={() => dispatch('close')}
						on:navigate={(e) => dispatch('navigate', e.detail)}
					/>
				{/key}
			</div>
		{:else}
			<div class="flex h-full min-h-0 flex-col overflow-hidden">
				{#key 'zonas'}
					<ZonasPanel
						variant="desktop"
						bind:subView={drawerZoneSubView}
						on:navigate={(e) => dispatch('navigate', e.detail)}
						on:requestCloseDrawer={() => dispatch('close')}
					/>
				{/key}
			</div>
		{/if}
	</div>
</div>
