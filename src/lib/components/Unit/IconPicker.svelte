<script>
	import { unitIcons } from '$lib/data/unitIcons';
	import { fade } from 'svelte/transition';
	import ColoredVehicleIcon from './ColoredVehicleIcon.svelte';

	export let currentIcon = 'vehicle-car-sedan';
	export let onSelect = () => {};
	export let editable = false;
	/** Color del vehículo (hex). Solo pinta la silueta, no el fondo del botón. */
	export let colorHex = null;

	const DEFAULT_COLOR = '#334155';

	$: iconColor = colorHex || DEFAULT_COLOR;

	let isOpen = false;

	function toggleDropdown() {
		if (editable) {
			isOpen = !isOpen;
		}
	}

	function selectIcon(slug) {
		onSelect(slug);
		isOpen = false;
	}

	function handleOutsideClick(event) {
		if (isOpen && !event.target.closest('.icon-picker-container')) {
			isOpen = false;
		}
	}

	function iconSrc(slug) {
		return unitIcons[slug] ?? unitIcons['vehicle-car-sedan'];
	}
</script>

<svelte:window on:click={handleOutsideClick} />

<div class="relative icon-picker-container">
	<button
		type="button"
		class="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100 shadow-sm transition-all duration-200 group dark:border-white/15 dark:bg-white/[0.08]"
		class:cursor-pointer={editable}
		class:cursor-default={!editable}
		class:hover:border-cyan-400={editable}
		class:ring-2={isOpen}
		class:ring-cyan-400={isOpen}
		on:click|stopPropagation={toggleDropdown}
		title={editable ? 'Cambiar icono' : 'Icono de unidad'}
	>
		<div class="relative z-10 transition-transform duration-200 group-hover:scale-105">
			<ColoredVehicleIcon
				src={iconSrc(currentIcon)}
				colorHex={iconColor}
				sizeClass="h-8 w-8"
				alt={currentIcon}
			/>
		</div>

		{#if editable}
			<div
				class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
			>
				<svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
			</div>
		{/if}
	</button>

	{#if isOpen}
		<div
			class="absolute left-0 top-full z-50 mt-2 w-max min-w-[200px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-zinc-900"
			transition:fade={{ duration: 100 }}
		>
			<div class="grid grid-cols-3 gap-2">
				{#each Object.entries(unitIcons) as [slug, src] (slug)}
					<button
						type="button"
						class="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100 transition-all duration-200 hover:scale-105 dark:border-white/15 dark:bg-white/[0.08] {currentIcon ===
						slug
							? 'border-cyan-400 ring-2 ring-cyan-400'
							: ''}"
						on:click={() => selectIcon(slug)}
						title={slug}
						aria-pressed={currentIcon === slug}
					>
						<ColoredVehicleIcon {src} colorHex={iconColor} sizeClass="h-7 w-7" alt={slug} />
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
