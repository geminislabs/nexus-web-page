<script>
	import Icon from '@iconify/svelte';
	import ColoredVehicleIcon from '$lib/components/Unit/ColoredVehicleIcon.svelte';
	import SignalMeters from '$lib/components/SignalMeters.svelte';
	import { unitIcons } from '$lib/data/unitIcons';
	import { resolveProfileColorHex } from '$lib/utils/vehicleMarkerIcon.js';

	/** @type {Record<string, any>} */
	export let vehicle = {};
	/** @type {'light' | 'dark'} */
	export let theme = 'dark';
	/** @type {() => void} */
	export let onClose = () => {};

	$: isDark = theme === 'dark';
	$: speed = Number(vehicle?.speed);
	$: speedNum = Number.isNaN(speed) ? 0 : speed;
	$: isMoving = speedNum > 3;

	$: latRaw = vehicle?.latitude ?? vehicle?.lat;
	$: lngRaw = vehicle?.longitude ?? vehicle?.lng;
	$: hasCoords =
		latRaw != null &&
		lngRaw != null &&
		!Number.isNaN(Number(latRaw)) &&
		!Number.isNaN(Number(lngRaw));
	$: latStr = hasCoords ? Number(latRaw).toFixed(6) : '';
	$: lngStr = hasCoords ? Number(lngRaw).toFixed(6) : '';
	$: coordsCopy = hasCoords ? `lat=${latStr}, lon=${lngStr}` : '';
	$: mapsUrl = hasCoords
		? `https://www.google.com/maps?q=${encodeURIComponent(`${latStr},${lngStr}`)}`
		: '';

	$: lastSrc = vehicle?.gpsDatetime || vehicle?.lastUpdate || null;
	$: dateParts = (() => {
		if (lastSrc) {
			const d = new Date(lastSrc);
			if (!Number.isNaN(d.getTime())) {
				const pad = (n) => String(n).padStart(2, '0');
				return {
					day: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
					time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
				};
			}
		}
		if (vehicle?.lastUpdateFormatted) {
			const parts = String(vehicle.lastUpdateFormatted).split(/\s+/);
			return { day: parts[0] || String(vehicle.lastUpdateFormatted), time: parts[1] || '' };
		}
		return { day: '', time: '' };
	})();

	$: name = vehicle?.name || 'Unidad';
	$: brandModel = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || 'Sin modelo';
	$: plate = vehicle?.plate || '';
	$: locationRaw = String(vehicle?.location || '').trim();
	$: location = locationRaw && locationRaw.toLowerCase() !== 'desconocida' ? locationRaw : '';

	$: iconSrc =
		unitIcons[vehicle?.icon_type || vehicle?.iconType || 'vehicle-car-sedan'] ||
		unitIcons['vehicle-car-sedan'];
	$: colorHex = resolveProfileColorHex(vehicle);

	$: motion = (() => {
		if (!hasCoords) {
			return {
				label: 'Sin posición',
				hex: '#ef4444',
				bg: isDark ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)',
				border: isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.28)'
			};
		}
		if (isMoving) {
			return {
				label: 'En movimiento',
				hex: '#34d399',
				bg: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
				border: isDark ? 'rgba(52,211,153,0.4)' : 'rgba(16,185,129,0.35)'
			};
		}
		return {
			label: 'Detenido',
			hex: '#fbbf24',
			bg: isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.12)',
			border: isDark ? 'rgba(251,191,36,0.4)' : 'rgba(245,158,11,0.3)'
		};
	})();

	$: speedLabel =
		vehicle?.speed == null || Number.isNaN(speed)
			? '—'
			: `${speedNum < 10 ? speedNum.toFixed(1) : Math.round(speedNum)} km/h`;

	let copyFeedback = '';

	async function copyCoords() {
		if (!coordsCopy) return;
		try {
			await navigator.clipboard.writeText(coordsCopy);
			copyFeedback = '¡Listo!';
		} catch {
			copyFeedback = 'Error';
		}
		setTimeout(() => {
			copyFeedback = '';
		}, 1200);
	}

	function openMaps() {
		if (!mapsUrl) return;
		window.open(mapsUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<div
	class="nexus-viw-card w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border font-sans shadow-xl {isDark
		? 'border-white/[0.12] bg-[#0c1829] text-slate-200'
		: 'border-slate-200/80 bg-white text-slate-900'}"
	data-nexus-vehicle-popup
	data-popup-theme={theme}
>
	<div
		class="h-[3px] w-full {isMoving
			? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400'
			: hasCoords
				? 'bg-gradient-to-r from-amber-400 to-amber-500'
				: 'bg-gradient-to-r from-rose-400 to-rose-500'}"
	></div>

	<div class="p-3">
		<div class="mb-2.5 flex items-center gap-2.5">
			<div
				class="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-inner {isDark
					? 'border-white/10'
					: 'border-slate-200/90'}"
				style="background: linear-gradient(145deg, {colorHex}33, {colorHex}14);"
				aria-hidden="true"
			>
				<ColoredVehicleIcon src={iconSrc} {colorHex} sizeClass="h-10 w-10" alt="" />
			</div>
			<div class="min-w-0 flex-1">
				<h3
					class="m-0 truncate text-[15px] font-extrabold leading-tight tracking-tight {isDark
						? 'text-slate-50'
						: 'text-slate-900'}"
				>
					{name}
				</h3>
				<p class="m-0 truncate text-xs font-medium {isDark ? 'text-white/55' : 'text-slate-500'}">
					{brandModel}{plate ? ` · ${plate}` : ''}
				</p>
				<span
					class="mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wide"
					style="background:{motion.bg};color:{motion.hex};border-color:{motion.border}"
				>
					<span
						class="h-1.5 w-1.5 rounded-full"
						style="background:{motion.hex};box-shadow:0 0 8px {motion.hex}"
					></span>
					{motion.label}
				</span>
			</div>
			<button
				type="button"
				class="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full border transition-colors {isDark
					? 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20'
					: 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				on:click|stopPropagation={onClose}
				aria-label="Cerrar"
				title="Cerrar"
			>
				<Icon icon="mdi:close" class="h-3.5 w-3.5" />
			</button>
		</div>

		<fieldset
			class="m-0 min-w-0 rounded-xl border px-2 pb-2 pt-0 {isDark
				? 'border-white/[0.12] bg-white/[0.02]'
				: 'border-slate-200/90 bg-slate-50/40'}"
		>
			<legend
				class="ml-0.5 px-1 text-[10px] font-bold uppercase tracking-wider {isDark
					? 'text-white/45'
					: 'text-slate-500'}"
			>
				Posición
			</legend>
			<div
				class="grid grid-cols-2 gap-1.5 [grid-auto-rows:minmax(2.75rem,auto)]"
				aria-label="Posición de la unidad"
			>
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
							class="block text-[9px] font-bold uppercase tracking-wide {isDark
								? 'text-white/40'
								: 'text-slate-500'}">Actualización</span
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
							<span class="block text-[11px] font-bold text-indigo-600 dark:text-indigo-300">—</span
							>
						{/if}
					</span>
				</div>

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
							class="block text-[9px] font-bold uppercase tracking-wide {isDark
								? 'text-white/40'
								: 'text-slate-500'}">Velocidad</span
						>
						<span class="block truncate text-[11px] font-bold text-sky-600 dark:text-sky-400"
							>{speedLabel}</span
						>
					</span>
				</div>

				<SignalMeters unit={vehicle} variant="grid" />
			</div>
		</fieldset>

		<div
			class="mt-2 rounded-xl border px-3 py-2.5 {isDark
				? 'border-sky-400/30 bg-gradient-to-br from-sky-500/15 to-indigo-500/10'
				: 'border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-indigo-500/5'}"
		>
			<div class="mb-1.5 flex items-center justify-between gap-2">
				<span
					class="text-[9px] font-extrabold uppercase tracking-wider {isDark
						? 'text-sky-300/90'
						: 'text-sky-700'}">Coordenadas</span
				>
				{#if hasCoords}
					<span class="inline-flex items-center gap-1">
						<button
							type="button"
							class="rounded-lg px-2 py-1 text-[10px] font-bold transition-opacity {isDark
								? 'bg-sky-400/20 text-sky-300'
								: 'bg-sky-500/15 text-sky-700'}"
							on:click|stopPropagation={copyCoords}
							title="Copiar coordenadas"
						>
							{copyFeedback || 'Copiar'}
						</button>
						<button
							type="button"
							class="rounded-lg px-2 py-1 text-[10px] font-bold transition-opacity {isDark
								? 'bg-emerald-400/20 text-emerald-300'
								: 'bg-emerald-600/15 text-emerald-700'}"
							on:click|stopPropagation={openMaps}
							title="Abrir en Google Maps"
						>
							Maps
						</button>
					</span>
				{/if}
			</div>
			{#if hasCoords}
				<p
					class="m-0 font-mono text-xs font-bold tracking-wide {isDark
						? 'text-sky-100'
						: 'text-sky-950'}"
				>
					{latStr}, {lngStr}
				</p>
			{:else}
				<p class="m-0 text-xs font-semibold {isDark ? 'text-white/50' : 'text-slate-500'}">
					Sin coordenadas
				</p>
			{/if}
			{#if location}
				<p
					class="mt-1.5 mb-0 text-[11px] font-semibold leading-snug {isDark
						? 'text-white/70'
						: 'text-slate-600'}"
				>
					{location}
				</p>
			{/if}
		</div>
	</div>
</div>
