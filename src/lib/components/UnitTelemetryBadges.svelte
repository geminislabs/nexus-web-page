<script>
	import Icon from '@iconify/svelte';

	/** @type {Record<string, any> | null} */
	export let unit = null;
	/** Mostrar ignición / velocidad / actualización además de baterías */
	export let showMotion = true;
	/** compact | card | grid — grid usa display:contents para celdas en un padre 2×2 */
	export let variant = 'card';

	$: mainV = Number(unit?.mainBatteryVoltage ?? unit?.main_battery_voltage);
	$: backupV = Number(unit?.backupBatteryVoltage ?? unit?.backup_battery_voltage);
	$: speed = Number(unit?.speed);
	$: ignitionOn = String(unit?.engineStatus ?? '').toUpperCase() === 'ON';
	$: lastUpdate = unit?.lastUpdateFormatted || null;

	$: mainLabel =
		unit?.mainBatteryVoltage == null || Number.isNaN(mainV) ? '—' : `${mainV.toFixed(1)} V`;
	$: backupLabel =
		unit?.backupBatteryVoltage == null || Number.isNaN(backupV) ? '—' : `${backupV.toFixed(1)} V`;
	$: speedLabel =
		unit?.speed == null || Number.isNaN(speed)
			? '—'
			: `${speed < 10 ? speed.toFixed(1) : Math.round(speed)} km/h`;

	/** @param {number} v */
	function mainTone(v) {
		if (Number.isNaN(v) || v <= 0)
			return { bg: 'bg-slate-400/15', fg: 'text-slate-500', ring: 'ring-slate-400/25' };
		if (v < 11.5) return { bg: 'bg-red-500/15', fg: 'text-red-500', ring: 'ring-red-500/30' };
		if (v < 12.2) return { bg: 'bg-amber-500/15', fg: 'text-amber-500', ring: 'ring-amber-500/30' };
		return { bg: 'bg-emerald-500/15', fg: 'text-emerald-500', ring: 'ring-emerald-500/30' };
	}

	/** @param {number} v */
	function backupTone(v) {
		if (Number.isNaN(v) || v <= 0)
			return { bg: 'bg-slate-400/15', fg: 'text-slate-500', ring: 'ring-slate-400/25' };
		if (v < 3.3) return { bg: 'bg-red-500/15', fg: 'text-red-500', ring: 'ring-red-500/30' };
		if (v < 3.6) return { bg: 'bg-amber-500/15', fg: 'text-amber-500', ring: 'ring-amber-500/30' };
		return { bg: 'bg-cyan-500/15', fg: 'text-cyan-500', ring: 'ring-cyan-500/30' };
	}

	/** @param {number} s */
	function speedTone(s) {
		if (Number.isNaN(s) || s <= 0)
			return { bg: 'bg-slate-400/15', fg: 'text-slate-500', ring: 'ring-slate-400/25' };
		if (s > 100) return { bg: 'bg-red-500/15', fg: 'text-red-500', ring: 'ring-red-500/30' };
		if (s > 40) return { bg: 'bg-amber-500/15', fg: 'text-amber-500', ring: 'ring-amber-500/30' };
		return { bg: 'bg-sky-500/15', fg: 'text-sky-500', ring: 'ring-sky-500/30' };
	}

	$: main = mainTone(mainV);
	$: backup = backupTone(backupV);
	$: spd = speedTone(speed);
</script>

<div
	class={variant === 'grid'
		? 'contents'
		: `flex flex-wrap items-stretch gap-2 ${variant === 'compact' ? '' : 'w-full'}`}
	aria-label="Indicadores de telemetría"
>
	{#if showMotion}
		<div
			class="inline-flex min-w-[7rem] {variant === 'grid'
				? 'w-full'
				: 'flex-1'} items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
			title="Ignición"
		>
			<span
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 {ignitionOn
					? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30'
					: 'bg-slate-400/15 text-slate-500 ring-slate-400/25'}"
				aria-hidden="true"
			>
				<Icon icon={ignitionOn ? 'mdi:engine' : 'mdi:engine-off'} width={16} />
			</span>
			<span class="min-w-0">
				<span
					class="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/35"
					>Ignición</span
				>
				<span
					class="block truncate text-[11px] font-bold {ignitionOn
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-slate-600 dark:text-white/70'}">{ignitionOn ? 'Encendida' : 'Apagada'}</span
				>
			</span>
		</div>

		<div
			class="inline-flex min-w-[7rem] flex-1 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
			title="Velocidad"
		>
			<span
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 {spd.bg} {spd.fg} {spd.ring}"
				aria-hidden="true"
			>
				<Icon icon="mdi:speedometer" width={16} />
			</span>
			<span class="min-w-0">
				<span
					class="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/35"
					>Velocidad</span
				>
				<span class="block truncate text-[11px] font-bold {spd.fg}">{speedLabel}</span>
			</span>
		</div>

		{#if lastUpdate}
			<div
				class="inline-flex min-w-[7.5rem] flex-[1.2] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
				title="Última actualización"
			>
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-500/30"
					aria-hidden="true"
				>
					<Icon icon="mdi:clock-check-outline" width={16} />
				</span>
				<span class="min-w-0">
					<span
						class="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/35"
						>Actualización</span
					>
					<span class="block truncate text-[11px] font-bold text-indigo-600 dark:text-indigo-300"
						>{lastUpdate}</span
					>
				</span>
			</div>
		{/if}
	{/if}

	<div
		class="inline-flex min-h-[2.75rem] min-w-0 {variant === 'grid'
			? 'h-full w-full'
			: 'flex-1'} items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
		title="Batería principal"
	>
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 {main.bg} {main.fg} {main.ring}"
			aria-hidden="true"
		>
			<Icon icon="mdi:car-battery" width={16} />
		</span>
		<span class="min-w-0">
			<span
				class="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/35"
				>Principal</span
			>
			<span class="block truncate text-[11px] font-bold {main.fg}">{mainLabel}</span>
		</span>
	</div>

	<div
		class="inline-flex min-h-[2.75rem] min-w-0 {variant === 'grid'
			? 'h-full w-full'
			: 'flex-1'} items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
		title="Batería interna / respaldo"
	>
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 {backup.bg} {backup.fg} {backup.ring}"
			aria-hidden="true"
		>
			<Icon icon="mdi:battery-charging-high" width={16} />
		</span>
		<span class="min-w-0">
			<span
				class="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/35"
				>Interna</span
			>
			<span class="block truncate text-[11px] font-bold {backup.fg}">{backupLabel}</span>
		</span>
	</div>
</div>
