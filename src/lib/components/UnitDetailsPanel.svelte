<script>
	import Icon from '@iconify/svelte';
	import UnitProfileDetails from '$lib/components/Unit/UnitProfileDetails.svelte';

	export let unit = null;
	export let panelActive = false;
	export let onClose = () => {};
</script>

<div class="flex max-h-[70vh] flex-col bg-white dark:bg-[#0c1829]">
	<div class="shrink-0 pt-2 pb-3 px-4">
		<div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-white/30"></div>
		<div class="flex items-center">
			<div class="h-7 w-7 opacity-0" aria-hidden="true"></div>
			<p class="flex-1 text-center text-[17px] font-bold text-slate-900 dark:text-white">
				Detalles de la Unidad
			</p>
			<button
				type="button"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/80"
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
