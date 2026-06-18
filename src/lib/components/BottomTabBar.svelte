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

<!--
	Fondo siempre oscuro — igual que iOS (ultraThinMaterial sobre nexusPanelBg) y Android (NexusBackgroundDeep 0.95)
	Acento cyan para tab activo — igual que Android (NexusCyan) e iOS (blue, pero el sistema de diseño NEXUS usa cyan)
-->
<nav
	class="fixed bottom-0 left-0 right-0 z-[100] border-t border-white/[0.12] bg-[#0a0f1a]/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] sm:hidden"
	aria-label="Navegación principal móvil"
>
	<p id="bottom-tab-db-hint" class="sr-only">
		Esta barra solo cambia la vista de la aplicación; no ejecuta consultas SQL.
	</p>
	<div
		role="tablist"
		aria-orientation="horizontal"
		aria-describedby="bottom-tab-db-hint"
		class="flex w-full flex-row"
	>
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				id={`bottom-tab-${tab.id}`}
				role="tab"
				class="relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 {$activeTab ===
				tab.id
					? 'text-cyan-400'
					: 'text-white/45 hover:text-white/70'}"
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
							class="absolute -right-2 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-[#0a0f1a] bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white"
							aria-hidden="true"
						>
							{$unreadAlarmCount > 9 ? '9+' : $unreadAlarmCount}
						</span>
					{/if}
				</span>
				<span
					class="text-[10px] font-medium tracking-wide {$activeTab === tab.id
						? 'text-cyan-400'
						: 'text-white/45'}">{tab.label}</span
				>
			</button>
		{/each}
	</div>
</nav>
