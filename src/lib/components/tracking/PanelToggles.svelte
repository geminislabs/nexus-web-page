<script>
	/**
	 * Control rápido de la vista Panel: qué paneles ve el usuario y la salida a
	 * la vista Clásica. Lo que se elige aquí manda sobre el tamaño de pantalla.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { trackingView } from '$lib/stores/trackingViewStore.js';

	const OPTIONS = [
		{
			id: 'flota',
			label: 'Flota',
			hint: 'Estados, utilización y unidades',
			icon: 'mdi:car-multiple',
			color: 'text-indigo-500 dark:text-indigo-400'
		},
		{
			id: 'alertas',
			label: 'Alertas',
			hint: 'Lo que se disparó hoy',
			icon: 'mdi:bell-outline',
			color: 'text-amber-500 dark:text-amber-400'
		},
		{
			id: 'hoy',
			label: 'Hoy',
			hint: 'Kilómetros y actividad del día',
			icon: 'mdi:chart-timeline-variant',
			color: 'text-sky-600 dark:text-sky-400'
		},
		{
			id: 'reticula',
			label: 'Retícula',
			hint: 'Cuadrícula y coordenadas del centro',
			icon: 'mdi:grid',
			color: 'text-slate-500 dark:text-white/60'
		}
	];
</script>

<div
	class="nx-glass w-[16.5rem] rounded-[16px] bg-white p-3 dark:bg-[#15171b] shadow-[0_20px_40px_rgb(15_23_42/0.12)] dark:shadow-[0_20px_40px_rgb(0_0_0/0.5)]"
	role="group"
	aria-label="Paneles de la vista"
>
	<p class="nx-label m-0 mb-2 px-1">Paneles</p>
	<ul class="m-0 flex list-none flex-col gap-1 p-0">
		{#each OPTIONS as opt (opt.id)}
			{@const on = $trackingView.panels[opt.id]}
			<li>
				<button
					type="button"
					role="switch"
					aria-checked={on}
					class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-900/[0.04] focus-visible:outline-2 dark:hover:bg-white/[0.05]"
					on:click|stopPropagation={() => trackingView.togglePanel(opt.id)}
				>
					<Icon icon={opt.icon} class="h-4 w-4 shrink-0 {opt.color}" aria-hidden="true" />
					<span class="min-w-0 flex-1">
						<span class="block text-[12.5px] font-medium">{opt.label}</span>
						<span class="block truncate text-[10.5px] nx-muted">{opt.hint}</span>
					</span>
					<span
						class="relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors {on
							? 'bg-emerald-500'
							: 'bg-slate-300 dark:bg-white/15'}"
						aria-hidden="true"
					>
						<span
							class="absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform {on
								? 'translate-x-[15px]'
								: 'translate-x-[2px] dark:bg-white/70'}"
						></span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
	<div class="mt-2 border-t border-slate-200/80 pt-2 dark:border-white/[0.07]">
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] hover:bg-slate-900/[0.04] focus-visible:outline-2 dark:hover:bg-white/[0.05]"
			on:click|stopPropagation={() => trackingView.setView('clasica')}
		>
			<Icon icon="mdi:backup-restore" class="h-4 w-4 nx-muted" aria-hidden="true" />
			Volver a la vista clásica
		</button>
	</div>
</div>
