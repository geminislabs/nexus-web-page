<script>
	import Icon from '@iconify/svelte';
	import {
		vehicles,
		mapVisibleUnitIds,
		mapVisibleUnitCount,
		vehicleActions
	} from '$lib/stores/vehicleStore.js';

	let collapsed = false;

	$: allOnMap =
		$vehicles.length > 0 && $vehicles.every((v) => $mapVisibleUnitIds.includes(String(v.id)));

	function toggleAll() {
		if (allOnMap) vehicleActions.hideAllOnMap();
		else vehicleActions.showAllOnMap();
	}
</script>

<div
	class="pointer-events-auto w-[220px] overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[rgb(8_11_22_/0.94)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
	role="region"
	aria-label="Unidades visibles en el mapa"
>
	<div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/[0.06]">
		<p class="m-0 flex-1 text-[12px] font-bold text-slate-900 dark:text-white">Unidades visibles</p>
		<span
			class="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
		>
			{$mapVisibleUnitCount}/{$vehicles.length}
		</span>
		<button
			type="button"
			class="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white/70"
			on:click={() => (collapsed = !collapsed)}
			aria-expanded={!collapsed}
			aria-label={collapsed ? 'Expandir unidades visibles' : 'Colapsar unidades visibles'}
		>
			<Icon icon={collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'} width={16} />
		</button>
	</div>

	{#if !collapsed}
		<div class="max-h-[220px] overflow-y-auto overscroll-contain px-2 py-2">
			<label
				class="mb-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:text-white/55 dark:hover:bg-white/[0.04]"
			>
				<input
					type="checkbox"
					class="size-3.5 rounded border-indigo-400/50 accent-indigo-500 focus:ring-indigo-500/40 dark:border-indigo-400/35 dark:accent-indigo-400"
					checked={allOnMap}
					disabled={$vehicles.length === 0}
					on:change={toggleAll}
				/>
				Seleccionar todas ({$vehicles.length})
			</label>
			<ul class="m-0 list-none space-y-0.5 p-0">
				{#each $vehicles as v (v.id)}
					<li>
						<label
							class="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:text-white/75 dark:hover:bg-white/[0.04]"
						>
							<input
								type="checkbox"
								class="size-3.5 shrink-0 rounded border-indigo-400/50 accent-indigo-500 focus:ring-indigo-500/40 dark:border-indigo-400/35 dark:accent-indigo-400"
								checked={$mapVisibleUnitIds.includes(String(v.id))}
								on:change={() => vehicleActions.toggleMapVisibility(v.id)}
							/>
							<span class="min-w-0 flex-1 truncate font-medium">{v.name}</span>
						</label>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
