<script>
	import Icon from '@iconify/svelte';
	import { activeTab, navActions } from '$lib/stores/navigationStore.js';
	import { unreadAlarmCount } from '$lib/stores/alertStore.js';

	const tabs = [
		{ id: 'seguimiento', label: 'Seguimiento', icon: 'mdi:map-marker-radius' },
		{ id: 'alertas', label: 'Alertas', icon: 'mdi:bell-outline' },
		{ id: 'informes', label: 'Informes', icon: 'mdi:file-chart-outline' },
		{ id: 'ajustes', label: 'Ajustes', icon: 'mdi:cog-outline' }
	];

	function tabAriaLabel(tab) {
		if (tab.id === 'alertas' && $unreadAlarmCount > 0) {
			return `${tab.label}, ${$unreadAlarmCount > 9 ? 'más de nueve' : $unreadAlarmCount} sin leer`;
		}
		return tab.label;
	}
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-[100] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_24px_rgba(15,23,42,0.08)] dark:border-white/[0.08] dark:bg-slate-900 dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:hidden"
	aria-label="Navegación principal móvil"
>
	<p id="bottom-tab-db-hint" class="sr-only">
		Esta barra solo cambia la vista de la aplicación; no ejecuta consultas SQL. El contador de
		alertas refleja datos en cliente o de API y puede correlacionarse con filas de
		public.notifications (device_id, event, message, status, read) cuando exista backend.
	</p>
	<div
		role="tablist"
		aria-orientation="horizontal"
		aria-describedby="bottom-tab-db-hint"
		class="flex w-full flex-row"
	>
		{#each tabs as tab}
			<button
				type="button"
				id={`bottom-tab-${tab.id}`}
				role="tab"
				class="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 {$activeTab ===
				tab.id
					? 'text-blue-600 dark:text-blue-400'
					: 'text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/70'}"
				aria-selected={$activeTab === tab.id}
				tabindex={$activeTab === tab.id ? 0 : -1}
				aria-label={tabAriaLabel(tab)}
				on:click={() => navActions.setTab(tab.id)}
			>
				<span
					class="relative flex h-[26px] w-[26px] items-center justify-center [&_.iconify]:h-[26px] [&_.iconify]:w-[26px]"
				>
					<Icon icon={tab.icon} width={26} height={26} aria-hidden="true" />
					{#if tab.id === 'alertas' && $unreadAlarmCount > 0}
						<span
							class="absolute -right-2 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white dark:border-slate-900"
							aria-hidden="true"
						>
							{$unreadAlarmCount > 9 ? '9+' : $unreadAlarmCount}
						</span>
					{/if}
				</span>
				<span class="text-[10px] font-medium tracking-wide text-current">{tab.label}</span>
			</button>
		{/each}
	</div>
</nav>
