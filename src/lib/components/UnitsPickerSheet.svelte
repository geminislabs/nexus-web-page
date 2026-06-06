<script>
	import Icon from '@iconify/svelte';
	import { vehicles, loadingVehicles, activeUnitId } from '$lib/stores/vehicleStore.js';
	import ColoredVehicleIcon from '$lib/components/Unit/ColoredVehicleIcon.svelte';
	import { unitIcons } from '$lib/data/unitIcons';
	import { colorSlugToHex } from '$lib/utils/vehicleUtils.js';
	import {
		getUnitTrackingStatus,
		unitMatchesTrackingFilter
	} from '$lib/utils/unitTrackingStatus.js';
	import UnitsStatusFilterPanels from './UnitsStatusFilterPanels.svelte';

	export let open = true;
	export let onSelect = () => {};
	export let onClose = () => {};

	let searchQuery = '';
	/** @type {'all' | 'moving' | 'stopped'} */
	let statusFilter = 'all';

	$: filteredUnits = $vehicles.filter((v) => {
		const q = searchQuery.trim().toLowerCase();
		const matchesSearch =
			!q ||
			v.name?.toLowerCase().includes(q) ||
			v.model?.toLowerCase().includes(q) ||
			v.brand?.toLowerCase().includes(q) ||
			v.plate?.toLowerCase().includes(q);
		return matchesSearch && unitMatchesTrackingFilter(v, statusFilter);
	});

	function unitIconSrc(v) {
		const iconType = v.icon_type || v.iconType || 'vehicle-car-sedan';
		return unitIcons[iconType] || unitIcons['vehicle-car-sedan'];
	}

	function unitColorHex(v) {
		return colorSlugToHex(v.color) || v.profile_color_hex || '#94a3b8';
	}

	function handleSelect(v) {
		onSelect(v);
	}
</script>

<div
	class="absolute inset-x-0 bottom-full mb-1 rounded-t-[24px] border border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 ease-out dark:border-white/10 dark:border-b-white/[0.04] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.97)_0%,rgba(2,6,23,0.97)_100%)] dark:shadow-[0_-18px_46px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.08)]"
	style:transform={open ? 'translateY(0)' : 'translateY(calc(100% + 10px))'}
>
	<button
		type="button"
		class="block w-full cursor-pointer border-0 bg-transparent px-4 pb-2 pt-3"
		on:click={onClose}
		aria-label={open ? 'Ocultar panel de unidades' : 'Mostrar panel de unidades'}
	>
		<div class="mx-auto mb-2 h-1 w-9 rounded-full bg-white/30"></div>
	</button>

	<div class="flex items-start justify-between gap-3 px-4 pb-3">
		<div>
			<h2 class="m-0 text-[20px] font-bold text-slate-900 dark:text-white">Unidades</h2>
			<p class="m-0 mt-0.5 text-[13px] text-slate-500 dark:text-white/50">
				{$vehicles.length} unidad{$vehicles.length === 1 ? '' : 'es'}
			</p>
		</div>
		<button
			type="button"
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/70"
			on:click={onClose}
			aria-label="Cerrar"
		>
			<Icon icon="mdi:close-circle" width={26} aria-hidden="true" />
		</button>
	</div>

	<div class="px-4 pb-3">
		<div
			class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.06]"
		>
			<Icon icon="mdi:magnify" width={16} class="shrink-0 text-slate-400 dark:text-white/40" />
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Buscar unidad..."
				class="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35"
			/>
			{#if searchQuery}
				<button
					type="button"
					class="text-slate-400 dark:text-white/40"
					on:click={() => (searchQuery = '')}
					aria-label="Limpiar búsqueda"
				>
					<Icon icon="mdi:close-circle" width={16} />
				</button>
			{/if}
		</div>
	</div>

	<div class="px-4 pb-3">
		<UnitsStatusFilterPanels units={$vehicles} bind:value={statusFilter} variant="sheet" />
	</div>

	<div class="max-h-[46vh] overflow-y-auto overscroll-contain border-t border-slate-200 dark:border-white/[0.06]">
		{#if $loadingVehicles}
			<div class="flex h-40 items-center justify-center" role="status" aria-live="polite">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-500"
				></div>
			</div>
		{:else if filteredUnits.length === 0}
			<div class="flex h-40 flex-col items-center justify-center gap-2 text-slate-500 dark:text-white/35">
				<Icon icon="mdi:magnify" width={32} class="opacity-30" />
				<p class="m-0 text-sm">Sin resultados</p>
			</div>
		{:else}
			<ul class="m-0 list-none p-0" aria-label="Lista de unidades">
				{#each filteredUnits as v, i (v.id)}
					{@const status = getUnitTrackingStatus(v)}
					{@const isSelected = $activeUnitId === v.id}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
							on:click={() => handleSelect(v)}
						>
							<div class="flex h-12 w-12 shrink-0 items-center justify-center">
								<ColoredVehicleIcon
									src={unitIconSrc(v)}
									colorHex={unitColorHex(v)}
									sizeClass="h-11 w-11"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<p
									class="m-0 truncate text-[16px] font-bold text-slate-900 dark:text-white {isSelected
										? ''
										: 'font-semibold'}"
								>
									{v.name}
								</p>
								{#if v.model || v.brand}
									<p class="m-0 truncate text-[13px] text-slate-500 dark:text-white/50">
										{v.model || v.brand}
									</p>
								{/if}
								<p class="m-0 mt-1 flex items-center gap-1.5 text-[12px] {status.colorClass}">
									<span class="h-2 w-2 shrink-0 rounded-full {status.dotClass}"></span>
									<span class="truncate">{status.label}</span>
								</p>
							</div>
							{#if isSelected}
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
								>
									<Icon icon="mdi:check" width={18} aria-hidden="true" />
								</span>
							{:else}
								<Icon
									icon="mdi:chevron-right"
									width={20}
									class="shrink-0 text-slate-400 dark:text-white/30"
									aria-hidden="true"
								/>
							{/if}
						</button>
						{#if i < filteredUnits.length - 1}
							<div class="ml-[76px] border-b border-slate-200 dark:border-white/[0.06]"></div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div
		class="h-2 shrink-0 opacity-90"
		aria-hidden="true"
		style="background: linear-gradient(90deg, transparent, rgb(16, 185, 129), rgb(14, 165, 233), transparent);"
	></div>
</div>
