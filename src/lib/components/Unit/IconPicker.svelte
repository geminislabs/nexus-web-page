<script>
	import { unitIcons } from '$lib/data/unitIcons';
	import { fade } from 'svelte/transition';

	export let currentIcon = 'vehicle-car-sedan';
	export let onSelect = (slug) => {};
	export let editable = false;

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

	// Close dropdown when clicking outside
	function handleOutsideClick(event) {
		if (isOpen && !event.target.closest('.icon-picker-container')) {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleOutsideClick} />

<div class="relative icon-picker-container">
	<!-- Trigger / Current Icon -->
	<button
		class="w-12 h-12 rounded-lg bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] flex items-center justify-center transition-all duration-200 relative group overflow-hidden"
		class:cursor-pointer={editable}
		class:cursor-default={!editable}
		class:hover:border-accent-cyan={editable}
		class:ring-1={isOpen}
		class:ring-accent-cyan={isOpen}
		on:click|stopPropagation={toggleDropdown}
		title={editable ? 'Cambiar icono' : 'Icono de unidad'}
	>
		{#if currentIcon && unitIcons[currentIcon]}
			<img
				src={unitIcons[currentIcon]}
				alt={currentIcon}
				class="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-110"
			/>
		{:else}
			<!-- Default fallback -->
			<img
				src={unitIcons['vehicle-car-sedan']}
				alt="Default"
				class="w-8 h-8 object-contain opacity-50"
			/>
		{/if}

		{#if editable}
			<div
				class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
			>
				<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute top-full left-0 mt-2 p-3 bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] rounded-xl shadow-2xl z-50 w-max min-w-[200px]"
			transition:fade={{ duration: 100 }}
		>
			<div class="grid grid-cols-3 gap-2">
				{#each Object.entries(unitIcons) as [slug, src]}
					<button
						class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10 relative"
						class:bg-accent-cyan-10={currentIcon === slug}
						class:ring-1={currentIcon === slug}
						class:ring-accent-cyan={currentIcon === slug}
						on:click={() => selectIcon(slug)}
						title={slug}
					>
						<img {src} alt={slug} class="w-7 h-7 object-contain" />
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
