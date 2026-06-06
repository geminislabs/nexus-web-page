<script>
	import Icon from '@iconify/svelte';
	import { vehicleColors } from '$lib/data/vehicleColors';

	export let selectedColor = '';
	export let onSelect = (slug) => {};

	const FALLBACK_BG = '#334155';

	let showPicker = false;

	$: selectedHex = vehicleColors.find((c) => c.slug === selectedColor)?.hex ?? null;
	$: triggerBg = selectedHex ?? FALLBACK_BG;

	function togglePicker() {
		showPicker = !showPicker;
	}

	function pick(slug) {
		onSelect(slug);
		showPicker = false;
	}

	function handleOutsideClick(event) {
		if (showPicker && !event.target.closest('.vehicle-color-picker')) {
			showPicker = false;
		}
	}

	function swatchClass(isSelected) {
		return isSelected
			? 'border-cyan-400 ring-2 ring-cyan-400 scale-105'
			: 'border-black/20 dark:border-white/30 hover:scale-105';
	}
</script>

<svelte:window on:click={handleOutsideClick} />

<div class="vehicle-color-picker relative">
	<button
		type="button"
		class="flex h-12 w-12 items-center justify-center rounded-xl border-2 shadow-sm transition-all {showPicker
			? 'border-cyan-400 ring-2 ring-cyan-400'
			: 'border-black/15 dark:border-white/25'}"
		style="background-color: {triggerBg};"
		on:click|stopPropagation={togglePicker}
		aria-label="Seleccionar color"
		aria-expanded={showPicker}
	>
		{#if !selectedHex}
			<Icon icon="mdi:palette-outline" class="h-5 w-5 text-white/70" aria-hidden="true" />
		{/if}
	</button>

	{#if showPicker}
		<div
			class="absolute left-1/2 top-full z-20 mt-3 w-[13.5rem] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-900"
			role="listbox"
			aria-label="Colores de vehículo"
		>
			<div class="grid grid-cols-4 gap-3">
				{#each vehicleColors as c (c.slug)}
					<button
						type="button"
						role="option"
						class="h-10 w-10 rounded-xl border-2 shadow-sm transition-transform {swatchClass(
							selectedColor === c.slug
						)}"
						style="background-color: {c.hex};"
						on:click={() => pick(c.slug)}
						title={c.slug}
						aria-selected={selectedColor === c.slug}
					></button>
				{/each}

				<button
					type="button"
					role="option"
					class="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed bg-slate-100 transition-transform dark:bg-white/[0.06] {!selectedColor
						? 'border-cyan-400 ring-2 ring-cyan-400 scale-105'
						: 'border-slate-300 dark:border-white/25 hover:scale-105'}"
					on:click={() => pick('')}
					title="Sin color"
					aria-selected={!selectedColor}
				>
					<Icon icon="mdi:close" class="h-4 w-4 text-slate-400" aria-hidden="true" />
				</button>
			</div>
		</div>
	{/if}
</div>
