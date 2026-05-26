<script>
	import Icon from '@iconify/svelte';

	export let unit = null;
	export let units = [];
	export let panelView = 'unit-info';
	export let onPanelViewChange = () => {};
	export let onSelectUnit = () => {};
	export let onCenterUnit = () => {};

	let showUnitPicker = false;
	let searchQuery = '';

	const panelActions = [
		{ id: 'trips', label: 'Trayectos', icon: 'mdi:source-branch' },
		{ id: 'events', label: 'Eventos', icon: 'mdi:bell-outline' },
		{ id: 'details', label: 'Detalles', icon: 'mdi:information-outline' },
		{ id: 'share', label: 'Compartir', icon: 'mdi:export-variant' }
	];

	$: filteredUnits = units.filter((u) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			u.name?.toLowerCase().includes(q) ||
			u.brand?.toLowerCase().includes(q) ||
			u.model?.toLowerCase().includes(q)
		);
	});

	// Lógica de estado igual que Android/iOS (basada en engineStatus + speed + lastUpdate)
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

	// Voltajes igual que Android/iOS (mainBatteryVoltage, backupBatteryVoltage)
	$: mainBattery = (() => {
		const v = Number(unit?.mainBatteryVoltage ?? unit?.main_battery_voltage);
		return !Number.isNaN(v) && v > 0 ? `${v.toFixed(1)}V` : '--';
	})();

	$: backupBattery = (() => {
		const v = Number(unit?.backupBatteryVoltage ?? unit?.backup_battery_voltage);
		return !Number.isNaN(v) && v > 0 ? `${v.toFixed(1)}V` : '--';
	})();

	// Satélites igual que Android/iOS
	$: satelliteCount = (() => {
		const s = Number(unit?.satellites);
		return !Number.isNaN(s) && s >= 0 ? `x${s}` : 'x0';
	})();

	$: isOnline = engineOn || isMoving;

	// Obtener estado de unidad (igual que Android/iOS)
	function getUnitStatus(u) {
		const spd = Number(u?.speed);
		const moving = !Number.isNaN(spd) && spd > 3;
		const engineOn = u?.engineStatus?.toUpperCase() === 'ON' || u?.isOnline === true;
		const hasSignalUnit = u?.lastUpdate != null || u?.gpsDatetime != null;

		if (moving)
			return { label: `${Math.round(spd)} km/h`, color: 'text-emerald-400', dot: 'bg-emerald-400' };
		if (engineOn) return { label: 'Online', color: 'text-emerald-400', dot: 'bg-emerald-400' };
		if (!hasSignalUnit) return { label: 'Sin señal', color: 'text-red-500', dot: 'bg-red-500' };
		return { label: 'Detenido', color: 'text-amber-500', dot: 'bg-amber-500' };
	}

	function formatUnitDate(u) {
		if (!u?.lastUpdate) return '';
		const d = new Date(u.lastUpdate);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function handleSelectUnit(u) {
		onSelectUnit(u);
		showUnitPicker = false;
		searchQuery = '';
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
					</div>
				</div>
				<button
					type="button"
					class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 shadow-lg"
					on:click={onCenterUnit}
					aria-label="Centrar en mapa"
				>
					<Icon icon="mdi:navigation-variant" class="h-5 w-5 text-white" />
				</button>
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

		<!-- Unit picker dropdown -->
		{#if showUnitPicker}
			<div class="border-t border-white/10 bg-[#0a1525]">
				<!-- Search -->
				<div class="p-3">
					<div class="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
						<Icon icon="mdi:magnify" class="h-5 w-5 text-white/40" />
						<input
							type="text"
							placeholder="Buscar unidad..."
							class="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
							bind:value={searchQuery}
						/>
					</div>
				</div>
				<!-- List -->
				<ul class="max-h-48 overflow-y-auto px-3 pb-3">
					{#each filteredUnits as u (u.id)}
						{@const status = getUnitStatus(u)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5 {u.id ===
								unit.id
									? 'bg-white/10'
									: ''}"
								on:click={() => handleSelectUnit(u)}
							>
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700/50">
									<Icon icon="mdi:car-side" class="h-6 w-6 text-white/60" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="m-0 truncate text-sm font-semibold text-white">{u.name}</p>
									<p class="m-0 text-xs text-white/50">
										{[u.brand, u.model].filter(Boolean).join(' ') || 'Sin modelo'}
									</p>
									<p class="m-0 mt-0.5 flex items-center gap-1 text-xs">
										<span class="h-1.5 w-1.5 rounded-full {status.dot}"></span>
										<span class={status.color}>{status.label}</span>
										{#if formatUnitDate(u)}
											<span class="text-white/30">· {formatUnitDate(u)}</span>
										{/if}
									</p>
								</div>
								{#if u.id === unit.id}
									<Icon icon="mdi:check-circle" class="h-5 w-5 text-sky-400" />
								{:else}
									<Icon icon="mdi:chevron-right" class="h-5 w-5 text-white/30" />
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Actions -->
		<div class="grid grid-cols-4 border-t border-white/10">
			{#each panelActions as action, i}
				<button
					type="button"
					class="flex flex-col items-center justify-center gap-1 py-3 {i > 0
						? 'border-l border-white/10'
						: ''} {panelView === action.id ? 'text-white' : 'text-white/50'}"
					on:click={() => onPanelViewChange(action.id)}
				>
					<Icon icon={action.icon} class="h-5 w-5" />
					<span class="text-[10px]">{action.label}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}
