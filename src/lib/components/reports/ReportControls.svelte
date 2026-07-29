<script>
	import Icon from '@iconify/svelte';
	import {
		selectedReportUnitIds,
		reportGranularity,
		loadingTelemetry
	} from '$lib/stores/telemetryStore.js';

	export let fromInput = '';
	export let toInput = '';
	export let onFromChange = () => {};
	export let onToChange = () => {};
	export let onOpenUnitPicker = () => {};
	export let onGenerate = () => {};
	export let errorMessage = null;
	/** @type {'stack' | 'sidebar'} */
	export let variant = 'stack';
</script>

<div
	class={variant === 'sidebar'
		? 'space-y-3'
		: 'space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:space-y-3 lg:block'}
>
	<button
		type="button"
		class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm dark:border-white/10 dark:bg-white/[0.04] {variant ===
		'stack'
			? 'md:col-span-2 lg:col-span-1'
			: ''}"
		on:click={onOpenUnitPicker}
	>
		<Icon icon="mdi:car-multiple" width={22} class="shrink-0 text-cyan-500" />
		<span class="flex-1 text-sm font-medium">
			{$selectedReportUnitIds.size === 0
				? 'Seleccionar unidades'
				: `${$selectedReportUnitIds.size} unidad${$selectedReportUnitIds.size !== 1 ? 'es' : ''} seleccionada${$selectedReportUnitIds.size !== 1 ? 's' : ''}`}
		</span>
		<Icon icon="mdi:chevron-right" width={20} class="text-slate-400" />
	</button>

	<div
		class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04] {variant ===
		'stack'
			? 'md:col-span-2 lg:col-span-1'
			: ''}"
	>
		<label
			class="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 dark:border-white/[0.06] {variant ===
			'sidebar'
				? ''
				: 'md:border-b md:border-slate-100 lg:border-b'}"
		>
			<span class="text-xs font-medium text-slate-500 dark:text-white/45">Desde</span>
			<input
				type="datetime-local"
				value={fromInput}
				on:change={(e) => onFromChange(e.currentTarget.value)}
				class="w-full border-0 bg-transparent p-0 text-sm text-slate-900 dark:text-white"
			/>
		</label>
		<label class="flex flex-col gap-1 px-4 py-3">
			<span class="text-xs font-medium text-slate-500 dark:text-white/45">Hasta</span>
			<input
				type="datetime-local"
				value={toInput}
				on:change={(e) => onToChange(e.currentTarget.value)}
				class="w-full border-0 bg-transparent p-0 text-sm text-slate-900 dark:text-white"
			/>
		</label>
	</div>

	<div
		class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
	>
		<span class="text-sm font-medium">Granularidad</span>
		<div class="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/15">
			<button
				type="button"
				class="rounded-md px-3 py-1 text-xs font-semibold {$reportGranularity === 'hour'
					? 'bg-cyan-600 text-white'
					: 'text-slate-600 dark:text-white/60'}"
				on:click={() => reportGranularity.set('hour')}
			>
				Horas
			</button>
			<button
				type="button"
				class="rounded-md px-3 py-1 text-xs font-semibold {$reportGranularity === 'day'
					? 'bg-cyan-600 text-white'
					: 'text-slate-600 dark:text-white/60'}"
				on:click={() => reportGranularity.set('day')}
			>
				Días
			</button>
		</div>
	</div>

	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-base font-bold text-white shadow-lg disabled:opacity-50 {variant ===
		'stack'
			? 'md:col-span-2 lg:col-span-1'
			: ''}"
		disabled={$loadingTelemetry || $selectedReportUnitIds.size === 0}
		on:click={onGenerate}
	>
		{#if $loadingTelemetry}
			<div class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
		{:else}
			Generar informe
		{/if}
	</button>

	{#if errorMessage}
		<p
			class="m-0 text-center text-xs text-red-500 dark:text-red-400 {variant === 'stack'
				? 'md:col-span-2 lg:col-span-1'
				: ''}"
		>
			{errorMessage}
		</p>
	{/if}
</div>
