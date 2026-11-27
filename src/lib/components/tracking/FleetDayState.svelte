<script>
	/**
	 * Estados de los paneles del día cuando no hay datos que pintar: cargando,
	 * error, «en construcción» (endpoint planeado que el backend aún no tiene)
	 * y flota sin dispositivos.
	 */
	import Icon from '$lib/components/Icon.svelte';

	let { status = 'idle', error = null, empty = false, onRetry = () => {}, rows = 3 } = $props();
</script>

{#if empty && (status === 'idle' || status === 'ready')}
	<p class="m-0 py-2 text-[12px] nx-muted">Sin unidades: no hay datos del día que mostrar.</p>
{:else if status === 'loading' || status === 'idle'}
	<div class="flex flex-col gap-2 py-2" aria-busy="true" aria-live="polite">
		<span class="sr-only">Cargando datos del día…</span>
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div
				class="h-3 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-white/[0.06]"
				style="width: {92 - i * 14}%"
			></div>
		{/each}
	</div>
{:else if status === 'en_construccion'}
	<div class="flex items-start gap-2.5 rounded-xl bg-slate-100 p-3 dark:bg-white/[0.04]">
		<Icon icon="mdi:hammer-wrench" class="mt-0.5 h-4 w-4 shrink-0 nx-muted" aria-hidden="true" />
		<p class="m-0 text-[12px] leading-snug">
			<span class="font-medium">En construcción.</span>
			<span class="nx-muted"
				>Este panel usará el resumen del día de la flota, que todavía no está disponible en el
				servidor.</span
			>
		</p>
	</div>
{:else if status === 'error'}
	<div class="flex items-start gap-2.5 rounded-xl bg-rose-500/10 p-3">
		<Icon
			icon="mdi:alert-circle-outline"
			class="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
			aria-hidden="true"
		/>
		<div class="min-w-0 text-[12px] leading-snug">
			<p class="m-0 font-medium">No se pudieron cargar los datos de hoy.</p>
			{#if error}<p class="m-0 mt-0.5 truncate nx-muted">{error}</p>{/if}
			<button
				type="button"
				class="mt-1.5 rounded-md px-0 text-[12px] font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
				onclick={onRetry}>Reintentar</button
			>
		</div>
	</div>
{/if}
