<script>
	import TrackingContextPanel from './TrackingContextPanel.svelte';
	import TripHistoryPanel from './TripHistoryPanel.svelte';
	import UnitEventsPanel from './UnitEventsPanel.svelte';
	import UnitDetailsPanel from './UnitDetailsPanel.svelte';
	import UnitSharePanel from './UnitSharePanel.svelte';
	import SecurityConsolePanel from './SecurityConsolePanel.svelte';

	export let unit = null;
	export let units = [];
	export let panelView = 'unit-info';
	export let onPanelViewChange = () => {};
	export let onSelectUnit = () => {};
	export let onCenterUnit = () => {};
	export let onBackToUnitInfo = () => {};
	export let onClose = () => {};
</script>

{#if panelView === 'trips'}
	<TripHistoryPanel {unit} onBack={onBackToUnitInfo} />
{:else if panelView === 'events'}
	<UnitEventsPanel {unit} panelActive={true} onBack={onBackToUnitInfo} />
{:else if panelView === 'details'}
	<UnitDetailsPanel {unit} panelActive={true} onClose={onBackToUnitInfo} />
{:else if panelView === 'share'}
	<UnitSharePanel {unit} onBack={onBackToUnitInfo} />
{:else if panelView === 'security'}
	<SecurityConsolePanel {unit} onBack={onBackToUnitInfo} />
{:else}
	<TrackingContextPanel
		{unit}
		{units}
		{panelView}
		{onPanelViewChange}
		{onSelectUnit}
		{onCenterUnit}
		{onClose}
		onOpenSecurity={() => onPanelViewChange('security')}
	/>
{/if}
