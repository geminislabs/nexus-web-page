<script>
	/**
	 * Franja inferior del seguimiento: kilómetros y actividad del día. Se puede
	 * plegar a una línea; la preferencia se recuerda en este navegador.
	 */
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { fleetDay } from '$lib/stores/fleetDayStore.js';
	import KmTodayCard from './KmTodayCard.svelte';
	import ActivityTodayCard from './ActivityTodayCard.svelte';

	let {
		onRetry = () => {},
		onSelectUnit = () => {},
		onOpenReports = null,
		activeUnitId = null,
		compact = false
	} = $props();

	const KEY = 'nexus.seguimiento.franjaPlegada';
	let collapsed = $state(false);
	/** Con poco espacio la franja arranca plegada, pero el usuario puede abrirla. */
	let openedWhileCompact = $state(false);
	const showCollapsed = $derived(compact ? !openedWhileCompact : collapsed);

	$effect(() => {
		if (!compact) openedWhileCompact = false;
	});

	onMount(() => {
		try {
			collapsed = localStorage.getItem(KEY) === '1';
		} catch {
			// Almacenamiento bloqueado: se queda desplegada.
		}
	});

	function toggle() {
		if (compact) {
			openedWhileCompact = !openedWhileCompact;
			return;
		}
		collapsed = !collapsed;
		try {
			localStorage.setItem(KEY, collapsed ? '1' : '0');
		} catch {
			// Sin almacenamiento: la preferencia dura lo que la pestaña.
		}
	}

	const t = $derived($fleetDay.data?.telemetry ?? null);
	const summary = $derived(
		t
			? [
					t.kmTotal != null
						? `${t.kmTotal.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
						: null,
					t.utilization != null ? `utilización ${Math.round(t.utilization)} %` : null
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);
</script>

{#if showCollapsed}
	<button
		type="button"
		class="nx-glass ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-2"
		onclick={toggle}
		aria-expanded="false"
		aria-controls="fleet-day-strip"
	>
		<span class="font-medium">Hoy</span>
		{#if summary}<span class="nx-muted">{summary}</span>{/if}
		{#if compact}<span class="nx-muted hidden lg:inline"
				>· poco espacio con las columnas abiertas</span
			>{/if}
		<Icon icon="mdi:chevron-up" class="h-4 w-4" aria-hidden="true" />
	</button>
{:else}
	<div
		id="fleet-day-strip"
		class="relative grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-3"
	>
		<KmTodayCard {onRetry} {onOpenReports} />
		<ActivityTodayCard {onRetry} {onSelectUnit} {activeUnitId} />
		<button
			type="button"
			class="nx-glass absolute -top-3 right-4 flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-2"
			onclick={toggle}
			aria-expanded="true"
			aria-controls="fleet-day-strip"
			aria-label="Plegar los paneles del día"
			title="Plegar"
		>
			<Icon icon="mdi:chevron-down" class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
{/if}
