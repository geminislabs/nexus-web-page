<script>
	/**
	 * Franja inferior en «modo unidad» (una unidad abierta, o una flota de una
	 * sola unidad): hoy en números, batería, combustible y el día de la unidad.
	 * Se pliega igual que la franja de la flota; la preferencia se guarda aparte.
	 */
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { unitDay } from '$lib/stores/unitDayStore.js';
	import UnitTodayCard from './UnitTodayCard.svelte';
	import UnitBatteryCard from './UnitBatteryCard.svelte';
	import UnitFuelCard from './UnitFuelCard.svelte';
	import UnitTimelineCard from './UnitTimelineCard.svelte';

	let {
		unitName = '',
		onRetry = () => {},
		/** @type {(tripId: string) => void} */
		onSelectTrip = () => {},
		onClearTrip = () => {},
		activeTripId = null,
		compact = false
	} = $props();

	const KEY = 'nexus.seguimiento.franjaUnidadPlegada';
	let collapsed = $state(false);
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

	const d = $derived($unitDay.data);
	const summary = $derived(
		d
			? [
					`${d.kmToday.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`,
					d.batteryNow != null ? `batería ${d.batteryNow.toFixed(1)} V` : null
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);
</script>

{#if showCollapsed}
	<button
		type="button"
		class="nx-reopen ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-2"
		onclick={toggle}
		aria-expanded="false"
		aria-controls="unit-day-strip"
	>
		<span class="font-medium">Hoy · {unitName}</span>
		{#if summary}<span class="nx-muted">{summary}</span>{/if}
		<Icon icon="mdi:chevron-up" class="h-4 w-4" aria-hidden="true" />
	</button>
{:else}
	<div id="unit-day-strip" class="relative flex flex-col gap-3">
		<div class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)] gap-3">
			<UnitTodayCard {onRetry} />
			<UnitBatteryCard {onRetry} />
			<UnitFuelCard {onRetry} />
		</div>
		<UnitTimelineCard {onRetry} {onSelectTrip} {onClearTrip} {activeTripId} />
		<button
			type="button"
			class="nx-glass absolute -top-3 right-4 flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-2"
			onclick={toggle}
			aria-expanded="true"
			aria-controls="unit-day-strip"
			aria-label="Plegar los paneles del día de la unidad"
			title="Plegar"
		>
			<Icon icon="mdi:chevron-down" class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
{/if}
