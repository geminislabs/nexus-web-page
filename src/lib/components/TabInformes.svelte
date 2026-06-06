<script>
	import { vehicles } from '$lib/stores/vehicleStore.js';
	import {
		selectedReportUnitIds,
		reportFrom,
		reportTo,
		loadingTelemetry,
		telemetryError,
		telemetryData,
		telemetryTotals,
		hasTelemetryResults,
		telemetryActions
	} from '$lib/stores/telemetryStore.js';
	import { formatMinutes } from '$lib/utils/telemetryUtils.js';
	import ReportsUnitPicker from './reports/ReportsUnitPicker.svelte';
	import ReportControls from './reports/ReportControls.svelte';
	import ReportResults from './reports/ReportResults.svelte';

	let showUnitPicker = false;

	function toLocalInputValue(date) {
		const d = date instanceof Date ? date : new Date(date);
		const pad = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function fromLocalInputValue(str) {
		return str ? new Date(str) : new Date();
	}

	let fromInput = toLocalInputValue($reportFrom);
	let toInput = toLocalInputValue($reportTo);

	$: fromInput = toLocalInputValue($reportFrom);
	$: toInput = toLocalInputValue($reportTo);

	$: unitOrder = [...$selectedReportUnitIds]
		.map((id) => {
			const v = $vehicles.find((u) => u.id === id);
			return v ? { id: v.id, name: v.name } : null;
		})
		.filter(Boolean);

	$: distanceKm = ($telemetryTotals.totalDistance / 1000).toFixed(1);

	$: summaryCards = [
		{ value: `${distanceKm} km`, title: 'Distancia', icon: 'mdi:ruler', color: 'text-violet-400' },
		{
			value: `${$telemetryTotals.totalFuel.toFixed(1)} L`,
			title: 'Combustible',
			icon: 'mdi:gas-station',
			color: 'text-orange-400'
		},
		{
			value: formatMinutes($telemetryTotals.totalMoving),
			title: 'En movimiento',
			icon: 'mdi:play',
			color: 'text-blue-400'
		},
		{
			value: formatMinutes($telemetryTotals.totalIdle),
			title: 'Detenido',
			icon: 'mdi:pause',
			color: 'text-slate-400'
		},
		{
			value: String($telemetryTotals.totalAlerts),
			title: 'Alertas',
			icon: 'mdi:bell',
			color: 'text-red-400'
		},
		{
			value: String($telemetryTotals.totalFixableComms),
			title: 'Comms fixable',
			icon: 'mdi:wrench',
			color: 'text-amber-400'
		},
		{
			value: String($telemetryTotals.totalWithFixComms),
			title: 'Comms fix',
			icon: 'mdi:shield-check',
			color: 'text-emerald-400'
		}
	];
</script>

<!-- Móvil: full-screen overlay (scroll propio porque no vive en TopDrawer) -->
<div class="w-full px-4 py-5 pb-24 sm:hidden">
	<h1
		aria-label="Informes"
		class="m-0 mb-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
	>
		Informes
	</h1>

	<ReportControls
		{fromInput}
		{toInput}
		variant="stack"
		errorMessage={$telemetryError}
		onFromChange={(v) => reportFrom.set(fromLocalInputValue(v))}
		onToChange={(v) => reportTo.set(fromLocalInputValue(v))}
		onOpenUnitPicker={() => (showUnitPicker = true)}
		onGenerate={() => telemetryActions.fetchReport()}
	/>

	<hr class="my-6 border-slate-200 dark:border-white/10" />

	<ReportResults
		hasResults={$hasTelemetryResults}
		loading={$loadingTelemetry}
		{summaryCards}
		offenders={$telemetryTotals.offenders}
		telemetryData={$telemetryData}
		{unitOrder}
		layout="mobile"
	/>
</div>

<!-- Escritorio / tablet: vive dentro del TopDrawer que ya scrollea -->
<div
	class="hidden w-full sm:flex sm:flex-row sm:items-start sm:gap-6 sm:px-5 sm:py-5 md:px-6 lg:gap-8 lg:px-8 lg:py-6"
>
	<aside
		class="w-full shrink-0 sm:sticky sm:top-0 sm:w-[240px] md:w-[260px] lg:w-[280px]"
		aria-label="Parámetros del informe"
	>
		<ReportControls
			{fromInput}
			{toInput}
			variant="sidebar"
			errorMessage={$telemetryError}
			onFromChange={(v) => reportFrom.set(fromLocalInputValue(v))}
			onToChange={(v) => reportTo.set(fromLocalInputValue(v))}
			onOpenUnitPicker={() => (showUnitPicker = true)}
			onGenerate={() => telemetryActions.fetchReport()}
		/>
	</aside>

	<div class="min-w-0 flex-1" role="region" aria-label="Resultados del informe">
		<ReportResults
			hasResults={$hasTelemetryResults}
			loading={$loadingTelemetry}
			{summaryCards}
			offenders={$telemetryTotals.offenders}
			telemetryData={$telemetryData}
			{unitOrder}
			layout="wide"
		/>
	</div>
</div>

<ReportsUnitPicker
	open={showUnitPicker}
	units={$vehicles}
	selectedIds={$selectedReportUnitIds}
	onToggle={(id) => telemetryActions.toggleUnit(id)}
	onClose={() => (showUnitPicker = false)}
/>
