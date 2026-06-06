<script>
	import Icon from '@iconify/svelte';
	import UnitProfileDetails from '$lib/components/Unit/UnitProfileDetails.svelte';

	export let unit = null;
	export let panelActive = false;
	export let onClose = () => {};
</script>

<div class="flex max-h-[70vh] flex-col bg-[#0c1829]">
	<div class="shrink-0 pt-2 pb-3 px-4">
		<div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/20"></div>
		<div class="flex items-center">
			<div class="h-7 w-7 opacity-0" aria-hidden="true"></div>
			<p class="flex-1 text-center text-[17px] font-bold text-white">Detalles de la Unidad</p>
			<button
				type="button"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:text-white/80"
				on:click={onClose}
				aria-label="Cerrar"
			>
				<Icon icon="mdi:close-circle" width={24} />
			</button>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
		<UnitProfileDetails {unit} variant="panel" active={panelActive} />
	</div>
</div>
