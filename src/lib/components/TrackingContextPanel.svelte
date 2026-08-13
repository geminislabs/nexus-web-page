<script>
	import Icon from '@iconify/svelte';
	import ShieldBoltIcon from '$lib/components/icons/ShieldBoltIcon.svelte';
	import UnitsStatusFilterPanels from './UnitsStatusFilterPanels.svelte';
	import { mapService, followedVehicleId } from '$lib/services/mapService.js';
	import { mapVisibleUnitIds, vehicleActions } from '$lib/stores/vehicleStore.js';
	import {
		getUnitTrackingStatus,
		formatUnitStatusDate,
		unitMatchesTrackingFilter
	} from '$lib/utils/unitTrackingStatus.js';
	import SignalMeters from '$lib/components/SignalMeters.svelte';
	import UnitTelemetryBadges from '$lib/components/UnitTelemetryBadges.svelte';
	import ColoredVehicleIcon from '$lib/components/Unit/ColoredVehicleIcon.svelte';
	import { unitIcons } from '$lib/data/unitIcons';
	import { resolveProfileColorHex } from '$lib/utils/vehicleMarkerIcon.js';
	export let unit = null;
	export let units = [];
	export let panelView = 'unit-info';
	export let onPanelViewChange = () => {};
	export let onSelectUnit = () => {};
	export let onCenterUnit = () => {};
	export let onOpenSecurity = () => {};
	export let onClose = () => {};
	let showUnitPicker = false;
	let searchQuery = '';
	/** @type {'all' | 'moving' | 'stopped'} */
	let statusFilter = 'all';
	const panelActions = [
		{
			id: 'trips',
			label: 'Trayectos',
			icon: 'mdi:source-branch',
			tone: 'text-violet-600 dark:text-violet-400',
			well: 'bg-violet-500/15 ring-violet-500/30',
			active: 'bg-violet-500/20 ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300'
		},
		{
			id: 'events',
			label: 'Eventos',
			icon: 'mdi:bell-ring-outline',
			tone: 'text-amber-600 dark:text-amber-400',
			well: 'bg-amber-500/15 ring-amber-500/30',
			active: 'bg-amber-500/20 ring-1 ring-amber-500/40 text-amber-700 dark:text-amber-300'
		},
		{
			id: 'details',
			label: 'Detalles',
			icon: 'mdi:information-outline',
			tone: 'text-sky-600 dark:text-sky-400',
			well: 'bg-sky-500/15 ring-sky-500/30',
			active: 'bg-sky-500/20 ring-1 ring-sky-500/40 text-sky-700 dark:text-sky-300'
		},
		{
			id: 'share',
			label: 'Compartir',
			icon: 'mdi:share-variant-outline',
			tone: 'text-emerald-600 dark:text-emerald-400',
			well: 'bg-emerald-500/15 ring-emerald-500/30',
			active: 'bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-700 dark:text-emerald-300'
		}
	];
	$: visibleCount = units.filter((u) => $mapVisibleUnitIds.includes(String(u.id))).length;
	$: visibleIdSet = new Set(($mapVisibleUnitIds || []).map(String));
	$: filteredUnits = units
		.filter((u) => {
			const q = searchQuery.trim().toLowerCase();
			const matchesSearch =
				!q ||
				u.name?.toLowerCase().includes(q) ||
				u.brand?.toLowerCase().includes(q) ||
				u.model?.toLowerCase().includes(q);
			return matchesSearch && unitMatchesTrackingFilter(u, statusFilter);
		})
		.map((u) => ({
			...u,
			onMap: visibleIdSet.has(String(u.id))
		}));

	function toggleUnitOnMap(u, e) {
		e?.stopPropagation?.();
		e?.preventDefault?.();
		const id = u?.id;
		if (!id) return;
		const currentlyVisible = visibleIdSet.has(String(id));
		vehicleActions.toggleMapVisibility(id);
		// Si se oculta la unidad activa, dejar de seguirla en el mapa
		if (currentlyVisible && String(id) === String(unit?.id)) {
			mapService.clearFollowVehicle();
			mapService.setHighlightedVehicle(null);
		}
	}
	// Lógica de estado igual que Android/iOS
	$: engineOn = unit?.engineStatus?.toUpperCase() === 'ON' || unit?.isOnline === true;
	$: hasSignal = unit?.lastUpdate != null || unit?.gpsDatetime != null;
	$: speed = Number(unit?.speed);
	$: isMoving = !Number.isNaN(speed) && speed > 3;
	$: statusLabel = (() => {
		if (!hasSignal) return 'Sin señal';
		if (engineOn || isMoving) return 'Encendido';
		return 'Apagado';
	})();
	$: dateLabel = (() => {
		const dateStr = unit?.gpsDatetime || unit?.lastUpdate;
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	})();
	$: dateParts = (() => {
		if (!dateLabel) return { day: '', time: '' };
		const [day, time] = dateLabel.split(' ');
		return { day: day || dateLabel, time: time || '' };
	})();
	// Voltajes ya se muestran vía UnitTelemetryBadges
	$: isOnline = engineOn || isMoving;
	$: isFollowing = Boolean(unit && $followedVehicleId === unit.id);
	function handleSelectUnit(u) {
		onSelectUnit(u);
		showUnitPicker = false;
		searchQuery = '';
		statusFilter = 'all';
	}
	function toggleFollow() {
		if (!unit) return;
		if (isFollowing) {
			mapService.clearFollowVehicle();
		} else {
			mapService.centerOnVehicle(unit, { showPopup: false });
		}
	}

	$: unitIconSrc =
		unitIcons[unit?.icon_type || unit?.iconType || 'vehicle-car-sedan'] ||
		unitIcons['vehicle-car-sedan'];
	$: unitColorHex = resolveProfileColorHex(unit);
</script>

{#if unit}
	<div
		class="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-[0_-4px_20px_rgba(15,23,42,0.12)] dark:border-transparent dark:bg-[#0c1829] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)] {showUnitPicker
			? 'h-[min(72vh,calc(100dvh-4.75rem-env(safe-area-inset-bottom,0px)))] md:h-[70vh]'
			: 'max-h-[min(72vh,calc(100dvh-4.75rem-env(safe-area-inset-bottom,0px)))] md:max-h-[70vh]'}"
	>
		<!-- Grabber -->
		<div class="flex shrink-0 justify-center py-2">
			<div class="h-1 w-9 rounded-full bg-slate-300 dark:bg-white/30"></div>
		</div>

		<!-- Cabecera: imagen unidad + título + acciones horizontales -->
		<div class="shrink-0 px-4 pb-2">
			<div class="flex items-center gap-2.5">
				<div
					class="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 shadow-inner dark:border-white/10"
					style="background: linear-gradient(145deg, {unitColorHex}33, {unitColorHex}14);"
					aria-hidden="true"
				>
					<ColoredVehicleIcon
						src={unitIconSrc}
						colorHex={unitColorHex}
						sizeClass="h-14 w-14"
						alt=""
					/>
				</div>
				<div class="min-w-0 flex-1">
					<h2 class="m-0 truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
						{unit.name}
					</h2>
					<p class="m-0 truncate text-sm text-slate-500 dark:text-white/60">
						{[unit.brand, unit.model].filter(Boolean).join(' ') || 'Sin modelo'}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-1.5 self-start pt-0.5">
					<button
						type="button"
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-slate-200/90 text-slate-700 shadow-sm transition-transform hover:scale-105 hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:border-white/20 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
						on:click={onClose}
						aria-label="Cerrar panel de unidad"
						title="Cerrar"
					>
						<Icon icon="mdi:close" class="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 shadow-sm transition-transform hover:scale-105"
						on:click={onCenterUnit}
						aria-label="Centrar en mapa"
					>
						<Icon icon="mdi:navigation-variant" class="h-3.5 w-3.5 text-white" />
					</button>
					<button
						type="button"
						class="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/30 bg-red-600/90 shadow-sm shadow-red-900/20 transition-transform hover:scale-105 dark:shadow-red-900/30"
						on:click={onOpenSecurity}
						aria-label="Consola de seguridad"
						title="Consola de seguridad"
					>
						<ShieldBoltIcon size={14} variant="white" />
					</button>
				</div>
			</div>
		</div>

		<!-- Cuerpo: detalle o lista (flex + scroll) -->
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			{#if !showUnitPicker}
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
					<div class="flex flex-col gap-2.5">
						<fieldset
							class="m-0 min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/40 px-2 pb-2 pt-0 dark:border-white/[0.12] dark:bg-white/[0.02]"
						>
							<legend
								class="ml-0.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/45"
							>
								Estado
							</legend>
							<div
								class="grid grid-cols-2 gap-1.5 [grid-auto-rows:minmax(2.75rem,auto)]"
								aria-label="Estado de la unidad"
							>
								<div
									class="flex min-h-[2.75rem] min-w-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 {isOnline
										? 'border-emerald-500/30 bg-emerald-500/10'
										: hasSignal
											? 'border-amber-500/30 bg-amber-500/10'
											: 'border-red-500/30 bg-red-500/10'}"
								>
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {isOnline
											? 'bg-emerald-500/20 text-emerald-500'
											: hasSignal
												? 'bg-amber-500/20 text-amber-500'
												: 'bg-red-500/20 text-red-500'}"
										aria-hidden="true"
									>
										<Icon
											icon={isOnline
												? 'mdi:engine'
												: hasSignal
													? 'mdi:key-variant'
													: 'mdi:signal-off'}
											width={15}
										/>
									</span>
									<span class="min-w-0 flex-1">
										<span
											class="block text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40"
											>Ignición</span
										>
										<span
											class="block truncate text-[11px] font-bold {isOnline
												? 'text-emerald-600 dark:text-emerald-400'
												: hasSignal
													? 'text-amber-600 dark:text-amber-400'
													: 'text-red-600 dark:text-red-400'}">{statusLabel}</span
										>
									</span>
								</div>

								<div
									class="flex min-h-[2.75rem] min-w-0 items-center gap-1.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-2 py-1.5"
								>
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-500"
										aria-hidden="true"
									>
										<Icon icon="mdi:clock-check-outline" width={15} />
									</span>
									<span class="min-w-0 flex-1">
										<span
											class="block text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40"
											>Actualización</span
										>
										{#if dateParts.day}
											<span
												class="block text-[11px] font-bold leading-tight text-indigo-600 dark:text-indigo-300"
											>
												<span class="block">{dateParts.day}</span>
												{#if dateParts.time}
													<span class="block">{dateParts.time}</span>
												{/if}
											</span>
										{:else}
											<span class="block text-[11px] font-bold text-indigo-600 dark:text-indigo-300"
												>—</span
											>
										{/if}
									</span>
								</div>

								<button
									type="button"
									class="follow-toggle-btn flex min-h-[2.75rem] min-w-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left transition-all duration-300"
									class:following={isFollowing}
									on:click={toggleFollow}
									aria-pressed={isFollowing}
									aria-label={isFollowing
										? 'Dejar de seguir la unidad en el mapa'
										: 'Seguir la unidad en el mapa'}
									title={isFollowing ? 'Siguiendo unidad en el mapa' : 'Seguir unidad en el mapa'}
								>
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {isFollowing
											? 'bg-cyan-500/20 text-cyan-400'
											: 'bg-slate-400/15 text-slate-500'}"
										aria-hidden="true"
									>
										<Icon icon={isFollowing ? 'mdi:crosshairs-gps' : 'mdi:crosshairs'} width={15} />
									</span>
									<span class="min-w-0 flex-1">
										<span
											class="block text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40"
											>Cámara</span
										>
										<span class="block truncate text-[11px] font-bold"
											>{isFollowing ? 'Siguiendo' : 'Seguir'}</span
										>
									</span>
								</button>

								<div
									class="flex min-h-[2.75rem] min-w-0 items-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-2 py-1.5"
								>
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-500"
										aria-hidden="true"
									>
										<Icon icon="mdi:speedometer" width={15} />
									</span>
									<span class="min-w-0 flex-1">
										<span
											class="block text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40"
											>Velocidad</span
										>
										<span
											class="block truncate text-[11px] font-bold text-sky-600 dark:text-sky-400"
											>{Number.isNaN(speed)
												? '—'
												: `${speed < 10 ? speed.toFixed(1) : Math.round(speed)} km/h`}</span
										>
									</span>
								</div>
							</div>
						</fieldset>

						<fieldset
							class="m-0 min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/40 px-2 pb-2 pt-0 dark:border-white/[0.12] dark:bg-white/[0.02]"
						>
							<legend
								class="ml-0.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/45"
							>
								Telemetría
							</legend>
							<div
								class="grid grid-cols-2 gap-1.5 [grid-auto-rows:minmax(2.75rem,auto)]"
								aria-label="Telemetría"
							>
								<UnitTelemetryBadges {unit} showMotion={false} variant="grid" />
								<SignalMeters {unit} variant="grid" />
							</div>
						</fieldset>
					</div>
				</div>
			{/if}

			{#if units.length > 1}
				<button
					type="button"
					class="flex w-full shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-white/10 dark:bg-white/5"
					on:click={() => (showUnitPicker = !showUnitPicker)}
					aria-expanded={showUnitPicker}
				>
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-full {isOnline
								? 'bg-emerald-500 dark:bg-emerald-400'
								: hasSignal
									? 'bg-amber-500'
									: 'bg-red-500'}"
						></span>
						<span class="truncate text-sm font-medium text-slate-900 dark:text-white"
							>{unit.name}</span
						>
						<span
							class="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-white/70"
							title="{visibleCount} visibles en mapa de {units.length}"
							>{visibleCount}/{units.length}</span
						>
					</div>
					<Icon
						icon={showUnitPicker ? 'mdi:chevron-up' : 'mdi:chevron-down'}
						class="h-5 w-5 shrink-0 text-slate-400 dark:text-white/50"
					/>
				</button>
			{/if}

			{#if showUnitPicker}
				<div class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2">
					<input
						type="search"
						bind:value={searchQuery}
						placeholder="Buscar unidad…"
						class="mb-2 w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
					/>
					<div class="mb-2 shrink-0">
						<UnitsStatusFilterPanels {units} bind:value={statusFilter} variant="embedded" />
					</div>
					<ul
						class="m-0 min-h-0 flex-1 list-none space-y-0.5 overflow-y-auto overscroll-contain p-0 [-webkit-overflow-scrolling:touch]"
						aria-label="Lista de unidades"
					>
						{#each filteredUnits as u (u.id)}
							{@const st = getUnitTrackingStatus(u)}
							{@const dt = formatUnitStatusDate(u)}
							<li>
								<div
									class="flex w-full items-center gap-1 rounded-lg px-1 py-1 transition-colors {u.id ===
									unit.id
										? 'bg-slate-100 dark:bg-white/[0.08]'
										: ''} {!u.onMap ? 'opacity-55' : ''}"
								>
									<button
										type="button"
										class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-white/[0.07]"
										on:click={() => handleSelectUnit(u)}
									>
										<span class="h-2 w-2 shrink-0 rounded-full {st.dotClass}"></span>
										<div class="min-w-0 flex-1">
											<p
												class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white"
											>
												{u.name}
											</p>
											{#if dt}
												<p class="m-0 text-[10px] text-slate-400 dark:text-white/35">{dt}</p>
											{/if}
										</div>
										<span class="shrink-0 text-[11px] font-semibold {st.colorClass}"
											>{st.shortLabel}</span
										>
									</button>
									<button
										type="button"
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors {u.onMap
											? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
											: 'text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/[0.07]'}"
										on:click={(e) => toggleUnitOnMap(u, e)}
										aria-pressed={u.onMap}
										aria-label={u.onMap
											? `Ocultar ${u.name} en el mapa`
											: `Mostrar ${u.name} en el mapa`}
										title={u.onMap ? 'Visible en mapa' : 'Oculta en mapa'}
									>
										<Icon
											icon={u.onMap ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}
											class="h-[18px] w-[18px]"
										/>
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<div class="shrink-0 border-t border-slate-200 px-2.5 py-2.5 dark:border-white/10">
			<div class="grid grid-cols-4 gap-1.5">
				{#each panelActions as action (action.id)}
					{@const isActive = panelView === action.id}
					<button
						type="button"
						class="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-all duration-200 {isActive
							? action.active
							: 'hover:bg-slate-100 dark:hover:bg-white/[0.06]'}"
						on:click={() => onPanelViewChange(action.id)}
						aria-pressed={isActive}
					>
						<span
							class="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ring-1 {action.well} {action.tone}"
							aria-hidden="true"
						>
							<Icon icon={action.icon} class="h-5 w-5 shrink-0" />
						</span>
						<span
							class="text-[10px] font-semibold leading-none {isActive
								? ''
								: 'text-slate-600 dark:text-white/65'}">{action.label}</span
						>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.follow-toggle-btn {
		border-color: rgba(148, 163, 184, 0.45);
		background: rgba(241, 245, 249, 0.95);
		color: rgba(71, 85, 105, 0.9);
	}
	.follow-toggle-btn.following {
		border-color: rgba(14, 165, 233, 0.45);
		background: rgba(14, 165, 233, 0.1);
		color: #0284c7;
		animation: follow-toggle-glow 1.8s ease-in-out infinite;
	}
	:global(html.dark) .follow-toggle-btn {
		border-color: rgba(148, 163, 184, 0.25);
		background: rgba(148, 163, 184, 0.08);
		color: rgba(226, 232, 240, 0.65);
	}
	:global(html.dark) .follow-toggle-btn.following {
		border-color: rgba(0, 166, 192, 0.55);
		background: rgba(0, 166, 192, 0.14);
		color: #00a6c0;
		animation-name: follow-toggle-glow-dark;
	}
	@keyframes follow-toggle-glow {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.3);
		}
		50% {
			box-shadow: 0 0 10px 2px rgba(14, 165, 233, 0.3);
		}
	}
	@keyframes follow-toggle-glow-dark {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(0, 166, 192, 0.35);
		}
		50% {
			box-shadow: 0 0 10px 2px rgba(0, 166, 192, 0.35);
		}
	}
</style>
