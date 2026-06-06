<script>
	import Icon from '@iconify/svelte';
	import { apiService } from '$lib/services/api.js';
	import ColoredVehicleIcon from '$lib/components/Unit/ColoredVehicleIcon.svelte';
	import { unitIcons } from '$lib/data/unitIcons';
	import { colorSlugToHex } from '$lib/utils/vehicleUtils.js';

	/** @type {Record<string, unknown> | null} */
	export let unit = null;
	/** @type {'panel' | 'drawer'} */
	export let variant = 'panel';
	export let active = true;

	let profile = null;
	let loading = true;
	let error = null;
	let lastLoadKey = '';

	async function loadProfile() {
		if (!unit?.id) return;
		loading = true;
		error = null;
		try {
			profile = await apiService.getUnitProfile(String(unit.id));
		} catch (err) {
			error = err?.message || 'No se pudo cargar el perfil';
			profile = null;
		} finally {
			loading = false;
		}
	}

	$: {
		const key = active ? `${unit?.id || ''}:details` : '';
		if (key && key !== lastLoadKey) {
			lastLoadKey = key;
			loadProfile();
		}
		if (!active) lastLoadKey = '';
	}

	function val(v) {
		return v != null && v !== '' ? String(v) : null;
	}

	$: vehicle = profile?.vehicle;
	$: displayName = unit?.name || 'Unidad';
	$: description = profile?.description ?? unit?.description;
	$: iconType = profile?.icon_type || 'vehicle-car-sedan';
	$: iconSrc = unitIcons[iconType] || unitIcons['vehicle-car-sedan'];
	$: iconColorHex = colorSlugToHex(profile?.color ?? unit?.color) ?? '#334155';

	$: isDrawer = variant === 'drawer';
	$: sectionLabelClass = isDrawer
		? 'mb-2 text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400/80'
		: 'mb-2 text-[12px] font-bold uppercase tracking-wider text-cyan-400/80';
	$: fieldLabelClass = isDrawer
		? 'w-[100px] shrink-0 text-[12px] text-slate-500 dark:text-white/40'
		: 'w-[100px] shrink-0 text-[14px] text-white/40';
	$: fieldValueClass = isDrawer
		? 'text-[12px] font-medium text-slate-800 dark:text-white/90'
		: 'text-[14px] font-medium text-white/90';
	$: fieldEmptyClass = isDrawer
		? 'text-[12px] font-medium text-slate-400 dark:text-white/30'
		: 'text-[14px] font-medium text-white/30';
</script>

{#if loading}
	<div class="flex h-28 items-center justify-center {isDrawer ? 'px-4' : ''}">
		<div
			class="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
		></div>
	</div>
{:else if error}
	<div
		class="flex h-28 flex-col items-center justify-center gap-2 px-4 text-center {isDrawer
			? 'text-slate-500 dark:text-white/45'
			: ''}"
	>
		<Icon icon="mdi:alert-circle-outline" width={28} class={isDrawer ? 'opacity-40' : 'text-white/25'} />
		<p class="m-0 text-xs {isDrawer ? '' : 'text-white/45'}">{error}</p>
	</div>
{:else}
	<div
		class="mx-4 mb-4 flex items-center gap-4 rounded-2xl border p-4 {isDrawer
			? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]'
			: 'border-white/10 bg-white/[0.05]'}"
	>
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl {isDrawer
				? 'bg-slate-100 dark:bg-white/[0.06]'
				: 'bg-white/[0.06]'}"
		>
			<ColoredVehicleIcon src={iconSrc} colorHex={iconColorHex} sizeClass="h-12 w-12" />
		</div>
		<div class="min-w-0 flex-1">
			<p
				class="m-0 text-[17px] font-bold leading-tight {isDrawer
					? 'text-slate-900 dark:text-white'
					: 'text-white'}"
			>
				{displayName}
			</p>
			{#if description}
				<p
					class="m-0 mt-1 text-[13px] {isDrawer
						? 'text-slate-600 dark:text-white/50'
						: 'text-white/50'}"
				>
					{description}
				</p>
			{/if}
		</div>
	</div>

	<div class="mb-4 px-4">
		<p class={sectionLabelClass}>Información General</p>
		<div class="space-y-1.5">
			<div class="flex items-start gap-2">
				<span class={fieldLabelClass}>Nombre</span>
				<span class="{fieldValueClass}">{val(displayName) ?? '—'}</span>
			</div>
			<div class="flex items-start gap-2">
				<span class={fieldLabelClass}>Descripción</span>
				<span class="{val(description) ? fieldValueClass : fieldEmptyClass}"
					>{val(description) ?? '—'}</span
				>
			</div>
		</div>
	</div>

	{#if (profile?.unit_type || 'vehicle') === 'vehicle' || vehicle}
		<div class="mb-4 px-4">
			<p class={sectionLabelClass}>Vehículo</p>
			<div class="space-y-1.5">
				{#each [['Modelo', val(profile?.model ?? unit?.model)], ['Marca', val(profile?.brand)], ['Color', val(profile?.color ?? unit?.color)], ['Año', val(profile?.year)], ['Placa', val(vehicle?.plate)], ['VIN', val(vehicle?.vin)], ['Combustible', val(vehicle?.fuel_type)]] as [label, value]}
					<div class="flex items-start gap-2">
						<span class={fieldLabelClass}>{label}</span>
						<span class={value ? fieldValueClass : fieldEmptyClass}>{value ?? '—'}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="px-4 {isDrawer ? 'pb-3' : 'pb-4'}">
		<p class={sectionLabelClass}>Dispositivo</p>
		<div class="space-y-1.5">
			<div class="flex items-start gap-2">
				<span class={fieldLabelClass}>Device ID</span>
				<span
					class="break-all font-mono text-[12px] font-medium {unit?.deviceId
						? fieldValueClass
						: fieldEmptyClass}"
				>
					{unit?.deviceId ?? 'Sin dispositivo asignado'}
				</span>
			</div>
		</div>
	</div>
{/if}
