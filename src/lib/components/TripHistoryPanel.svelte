<script>
	import Icon from '@iconify/svelte';
	import {
		trips,
		selectedTrip,
		loadingTrips,
		tripError,
		tripActions
	} from '$lib/stores/tripStore.js';
	import { mapService } from '$lib/services/mapService.js';
	import TripDetailView from './TripDetailView.svelte';

	export let unit = null;
	export let onBack = () => {};

	let selectedDate = new Date().toISOString().split('T')[0];
	let showDetail = false;
	let loadingDetail = false;

	function formatDuration(minutes) {
		if (minutes == null) return '--';
		const h = Math.floor(minutes / 60);
		const m = Math.round(minutes % 60);
		if (h > 0) return `${h}h ${m}m`;
		return `${m} min`;
	}

	function formatDistance(km) {
		if (km == null) return '--';
		return `${km.toFixed(1)} km`;
	}

	function formatTime(dateStr) {
		if (!dateStr) return '--';
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return '--';
		return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
	}

	async function loadTrips() {
		if (!unit?.id) return;

		const [year, month, day] = selectedDate.split('-').map(Number);
		const dateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
		const dateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

		await tripActions.loadTripsForUnit(unit.id, {
			dateRange: { start: dateStart, end: dateEnd }
		});
	}

	async function selectTrip(trip) {
		loadingDetail = true;
		tripActions.selectTrip(trip.trip_id);

		const detail = await tripActions.loadTripDetail(trip.trip_id, {
			includePoints: true,
			includeAlerts: true
		});

		if (detail?.points?.length) {
			mapService.drawTripRoute(detail.points);
			mapService.fitBoundsToPoints(detail.points);
		}

		loadingDetail = false;
		showDetail = true;
	}

	function handleBackFromDetail() {
		showDetail = false;
		mapService.clearTripRoute();
		mapService.hideTripAlerts();
		mapService.stopTripPlayback();
	}

	function handleClose() {
		tripActions.clearTrips();
		mapService.clearTripRoute();
		mapService.hideTripAlerts();
		mapService.stopTripPlayback();
		onBack();
	}

	function handleBack() {
		tripActions.clearTrips();
		mapService.clearTripRoute();
		onBack();
	}

	function handleDateChange() {
		tripActions.clearTrips();
		mapService.clearTripRoute();
		showDetail = false;
		loadTrips();
	}

	$: if (unit?.id) {
		loadTrips();
	}
</script>

{#if showDetail && $selectedTrip}
	<TripDetailView trip={$selectedTrip} onBack={handleBackFromDetail} onClose={handleClose} />
{:else}
	<div class="flex h-full flex-col">
		<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10"
				on:click={handleBack}
				aria-label="Volver"
			>
				<Icon icon="mdi:arrow-left" width={20} />
			</button>
			<div class="flex-1">
				<p class="m-0 text-sm font-semibold text-white">Trayectos</p>
				<p class="m-0 text-[11px] text-white/50">{unit?.name || 'Unidad'}</p>
			</div>
		</div>

		<div class="border-b border-white/10 px-3 py-2">
			<input
				type="date"
				bind:value={selectedDate}
				on:change={handleDateChange}
				class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
			/>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if $loadingTrips || loadingDetail}
				<div class="flex h-32 items-center justify-center">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
					></div>
				</div>
			{:else if $tripError}
				<div class="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center">
					<Icon icon="mdi:alert-circle-outline" width={28} class="text-red-400" />
					<p class="m-0 text-xs text-white/50">{$tripError}</p>
				</div>
			{:else if $trips.length === 0}
				<div class="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center">
					<Icon icon="mdi:map-marker-path" width={28} class="text-white/25" />
					<p class="m-0 text-xs text-white/50">Sin trayectos para esta fecha</p>
				</div>
			{:else}
				<ul class="m-0 list-none space-y-2 p-3">
					{#each $trips as trip (trip.trip_id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:border-cyan-400/30 hover:bg-white/10"
								on:click={() => selectTrip(trip)}
							>
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15"
								>
									<Icon icon="mdi:clock-outline" width={20} class="text-cyan-400" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[15px] font-semibold text-white">
										{formatTime(trip.start_timestamp)} - {formatTime(trip.end_timestamp)}
									</p>
									<div class="mt-1 flex items-center gap-4 text-xs text-white/50">
										<span class="flex items-center gap-1">
											<Icon icon="mdi:swap-horizontal" width={14} />
											{formatDistance(trip.distance_km)}
										</span>
										<span class="flex items-center gap-1">
											<Icon icon="mdi:clock-outline" width={14} />
											{formatDuration(trip.duration_minutes)}
										</span>
									</div>
								</div>
								<Icon icon="mdi:chevron-right" width={20} class="text-white/30" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
