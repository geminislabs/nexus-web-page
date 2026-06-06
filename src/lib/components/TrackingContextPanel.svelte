<script>
	import Icon from '@iconify/svelte';
	import ShieldBoltIcon from '$lib/components/icons/ShieldBoltIcon.svelte';
	import UnitsStatusFilterPanels from './UnitsStatusFilterPanels.svelte';
	import {
		getUnitTrackingStatus,
		formatUnitStatusDate,
		unitMatchesTrackingFilter
	} from '$lib/utils/unitTrackingStatus.js';
	export let unit = null;
	export let units = [];
	export let panelView = 'unit-info';
	export let onPanelViewChange = () => {};
	export let onSelectUnit = () => {};
	export let onCenterUnit = () => {};
	export let onOpenSecurity = () => {};
	let showUnitPicker = false;
	let searchQuery = '';
	/** @type {'all' | 'moving' | 'stopped'} */
	let statusFilter = 'all';
	const panelActions = [
		{ id: 'trips', label: 'Trayectos', icon: 'mdi:source-branch' },
		{ id: 'events', label: 'Eventos', icon: 'mdi:bell-outline' },
		{ id: 'details', label: 'Detalles', icon: 'mdi:information-outline' },
		{ id: 'share', label: 'Compartir', icon: 'mdi:export-variant' }
	];
	$: filteredUnits = units.filter((u) => {
		const q = searchQuery.trim().toLowerCase();
		const matchesSearch =
			!q ||
			u.name?.toLowerCase().includes(q) ||
			u.brand?.toLowerCase().includes(q) ||
			u.model?.toLowerCase().includes(q);
		return matchesSearch && unitMatchesTrackingFilter(u, statusFilter);
	});
	// Lógica de estado igual que Android/iOS
	$: engineOn = unit?.engineStatus?.toUpperCase() === 'ON' || unit?.isOnline === true;
	$: hasSignal = unit?.lastUpdate != null || unit?.gpsDatetime != null;
	$: speed = Number(unit?.speed);
	$: isMoving = !Number.isNaN(speed) && speed > 3;
	$: statusLabel = (() => {
		if (isMoving) return `${Math.round(speed)} km/h`;
		if (engineOn) return 'Online';
		if (!hasSignal) return 'Sin señal';
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
	// Voltajes igual que Android/iOS
	$: mainBattery = (() => {
		const v = Number(unit?.mainBatteryVoltage ?? unit?.main_battery_voltage);
		return !Number.isNaN(v) && v > 0 ? `${v.toFixed(1)}V` : '--';
	})();
	$: backupBattery = (() => {
		const v = Number(unit?.backupBatteryVoltage ?? unit?.backup_battery_voltage);
		return !Number.isNaN(v) && v > 0 ? `${v.toFixed(1)}V` : '--';
	})();
	// Satélites
	$: satelliteCount = (() => {
		const s = Number(unit?.satellites);
		return !Number.isNaN(s) && s >= 0 ? `x${s}` : 'x0';
	})();
	// Señal (rxLvl) — 0-100 aprox, igual que iOS SignalStrengthView
	$: signalLevel = (() => {
		const rx = Number(unit?.rxLvl ?? unit?.rx_lvl);
		if (Number.isNaN(rx) || (unit?.rxLvl == null && unit?.rx_lvl == null)) return null;
		if (rx <= 10) return 0;
		if (rx <= 25) return 1;
		if (rx <= 45) return 2;
		if (rx <= 60) return 3;
		return 4;
	})();
	$: signalColor =
		signalLevel == null
			? ''
			: signalLevel === 0
				? 'text-red-400'
				: signalLevel === 1
					? 'text-orange-400'
					: signalLevel === 2
						? 'text-yellow-400'
						: 'text-emerald-400';
	$: isOnline = engineOn || isMoving;
	function handleSelectUnit(u) {
		onSelectUnit(u);
		showUnitPicker = false;
		searchQuery = '';
		statusFilter = 'all';
	}
</script>

{#if unit}
	<div
		class="pointer-events-auto w-full rounded-t-2xl bg-[#0c1829] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
	>
		<!-- Grabber -->
		<div class="flex justify-center py-2">
			<div class="h-1 w-9 rounded-full bg-white/30"></div>
		</div>
		<!-- Unit info -->
		<div class="px-4 pb-3">
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<h2 class="m-0 truncate text-xl font-bold text-white">{unit.name}</h2>
					<p class="m-0 text-sm text-white/60">
						{[unit.brand, unit.model].filter(Boolean).join(' ') || 'Sin modelo'}
					</p>
					<p class="m-0 mt-1 flex items-center gap-1.5 text-sm">
						<span
							class="h-2 w-2 rounded-full {isOnline
								? 'bg-emerald-400'
								: hasSignal
									? 'bg-amber-500'
									: 'bg-red-500'}"
						></span>
						<span
							class={isOnline ? 'text-emerald-400' : hasSignal ? 'text-amber-500' : 'text-red-500'}
							>{statusLabel}</span
						>
						{#if dateLabel}
							<span class="text-white/40">- {dateLabel}</span>
						{/if}
					</p>
					<div class="mt-1 flex items-center gap-1 text-xs text-white/50">
						<Icon icon="mdi:car-battery" class="h-3.5 w-3.5" />
						<span>{mainBattery}</span>
						<Icon icon="mdi:battery-outline" class="ml-1 h-3.5 w-3.5" />
						<span>{backupBattery}</span>
						<span class="mx-0.5">·</span>
						<Icon icon="mdi:signal-cellular-3" class="h-3.5 w-3.5" />
						<span>{satelliteCount}</span>
						{#if signalLevel != null}
							<span class="mx-0.5">·</span>
							<Icon icon="mdi:signal" class="h-3.5 w-3.5 {signalColor}" />
							<span class={signalColor}>{unit.rxLvl ?? unit.rx_lvl} rx</span>
						{/if}
					</div>
				</div>
				<div class="flex shrink-0 flex-col items-center gap-2">
					<button
						type="button"
						class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 shadow-lg transition-transform hover:scale-105"
						on:click={onCenterUnit}
						aria-label="Centrar en mapa"
					>
						<Icon icon="mdi:navigation-variant" class="h-5 w-5 text-white" />
					</button>
					<button
						type="button"
						class="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-600/90 shadow-lg shadow-red-900/30 transition-transform hover:scale-105"
						on:click={onOpenSecurity}
						aria-label="Consola de seguridad"
						title="Consola de seguridad"
					>
						<ShieldBoltIcon size={22} variant="white" />
					</button>
				</div>
			</div>
		</div>
		<!-- Unit picker toggle -->
		{#if units.length > 1}
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 border-t border-white/10 bg-white/5 px-4 py-2.5"
				on:click={() => (showUnitPicker = !showUnitPicker)}
				aria-expanded={showUnitPicker}
			>
				<div class="flex items-center gap-2">
					<span
						class="h-2.5 w-2.5 rounded-full {isOnline
							? 'bg-emerald-400'
							: hasSignal
								? 'bg-amber-500'
								: 'bg-red-500'}"
					></span>
					<span class="text-sm font-medium text-white">{unit.name}</span>
					<span
						class="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70"
						>{units.length}</span
					>
				</div>
				<Icon
					icon={showUnitPicker ? 'mdi:chevron-up' : 'mdi:chevron-down'}
					class="h-5 w-5 text-white/50"
				/>
			</button>
		{/if}
		<!-- Unit picker list -->
		{#if showUnitPicker}
			<div class="border-t border-white/10 px-3 pb-3 pt-2">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Buscar unidad…"
					class="mb-2.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-sky-500/50"
				/>
				<div class="mb-2.5">
					<UnitsStatusFilterPanels
						{units}
						bind:value={statusFilter}
						variant="embedded"
					/>
				</div>
				<ul class="m-0 max-h-[220px] list-none overflow-y-auto overscroll-contain p-0 space-y-0.5">
					{#each filteredUnits as u (u.id)}
						{@const st = getUnitTrackingStatus(u)}
						{@const dt = formatUnitStatusDate(u)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.07] {u.id ===
								unit.id
									? 'bg-white/[0.08]'
									: ''}"
								on:click={() => handleSelectUnit(u)}
							>
								<span class="h-2 w-2 shrink-0 rounded-full {st.dotClass}"></span>
								<div class="min-w-0 flex-1">
									<p class="m-0 truncate text-[13px] font-semibold text-white">{u.name}</p>
									{#if dt}
										<p class="m-0 text-[10px] text-white/35">{dt}</p>
									{/if}
								</div>
								<span class="shrink-0 text-[11px] font-semibold {st.colorClass}"
									>{st.shortLabel}</span
								>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		<!-- Action buttons -->
		<div class="border-t border-white/10 px-3 py-2">
			<div class="grid grid-cols-4 gap-1">
				{#each panelActions as action}
					<button
						type="button"
						class="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors hover:bg-white/[0.07] {panelView ===
						action.id
							? 'bg-white/[0.1] text-white'
							: 'text-white/50'}"
						on:click={() => onPanelViewChange(action.id)}
						aria-pressed={panelView === action.id}
					>
						<Icon icon={action.icon} class="h-[18px] w-[18px] shrink-0" />
						<span class="text-[10px] font-medium leading-none">{action.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}
