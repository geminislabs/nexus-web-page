<script>
	/**
	 * Filas de relleno que parpadean mientras carga una lista: ocupan el
	 * lugar de las filas reales para que la espera no sea un hueco con un
	 * spinner y la lista no salte al llegar. Para lectores de pantalla sólo
	 * existe `label`.
	 */

	/** @type {number} */
	export let count = 4;
	/** @type {string} */
	export let label = 'Cargando…';
	/** Con un círculo a la izquierda (icono o avatar de la fila real). */
	export let avatar = true;
	/** @type {string} */
	export let rowClass =
		'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]';

	// Anchos variados para que no parezca una rejilla.
	const widths = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-1/2', 'w-3/4'];
</script>

<div role="status" aria-live="polite">
	<span class="sr-only">{label}</span>
	<ul class="m-0 list-none space-y-2 p-0" aria-hidden="true">
		{#each Array.from({ length: count }, (_, n) => n) as i (i)}
			<li class="flex items-center gap-3 {rowClass}">
				{#if avatar}
					<span class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-white/10"
					></span>
				{/if}
				<span class="flex min-w-0 flex-1 flex-col gap-1.5">
					<span
						class="h-3 animate-pulse rounded bg-slate-200 dark:bg-white/10 {widths[
							i % widths.length
						]}"
					></span>
					<span class="h-2.5 w-1/3 animate-pulse rounded bg-slate-200/70 dark:bg-white/[0.06]"
					></span>
				</span>
			</li>
		{/each}
	</ul>
</div>
