<script>
	import Icon from '@iconify/svelte';
	import { alertWizard, alertActions, zones } from '$lib/stores/alertStore.js';
	import { selectedH3Cells } from '$lib/stores/h3Store.js';
	import { vehicles } from '$lib/stores/vehicleStore.js';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
	const STEPS = 5;
	let h3CellQuery = '';

	$: step = $alertWizard?.step ?? 1;
	$: wizard = $alertWizard;

	$: canNext = (() => {
		if (!wizard) return false;
		if (step === 1) return !!wizard.type;
		if (step === 2) return !!wizard.condition;
		if (step === 3) return wizard.units.length > 0;
		if (step === 4) return wizard.type !== 'zone' || !!wizard.zone;
		if (step === 5) return !!wizard.name.trim();
		return false;
	})();

	$: effectiveSteps = wizard?.type === 'ignition' ? 4 : 5;
	$: legacyH3Zones = $zones.map((zone) => ({
		id: zone.id,
		name: zone.name || 'Zona sin nombre',
		color: zone.color || '#3B82F6',
		cells: Array.isArray(zone.cells) ? zone.cells : [],
		source: 'h3',
		shape: 'h3'
	}));
	$: liveH3SelectionZone =
		$selectedH3Cells.length > 0
			? [
					{
						id: 'h3_live_selection',
						name: 'Seleccion actual del mapa',
						color: '#0EA5E9',
						cells: $selectedH3Cells,
						source: 'h3-live',
						shape: 'h3'
					}
				]
			: [];
	$: allH3Zones = [...liveH3SelectionZone, ...legacyH3Zones];
	$: normalizedCellQuery = h3CellQuery.trim().toLowerCase();
	$: filteredH3Zones = normalizedCellQuery
		? allH3Zones.filter((zone) =>
				zone.cells.some((cellId) => cellId.toLowerCase().includes(normalizedCellQuery))
			)
		: allH3Zones;
	$: allZoneOptions = allH3Zones;
	$: selectedZoneLabel =
		allZoneOptions.find((z) => z.id === wizard?.zone)?.name ?? wizard?.zone ?? '—';
	$: displayStep = (() => {
		if (!wizard) return 1;
		if (wizard.type === 'ignition' && step >= 5) return 4;
		return step;
	})();

	function close() {
		alertActions.closeWizard();
		dispatch('close');
	}
	function onKeydown(e) {
		if (e.key === 'Escape') close();
	}

	function handleNext() {
		if (!wizard || !canNext) return;
		if (wizard.type === 'ignition' && step === 3) alertActions.setWizardStep(5);
		else alertActions.nextStep();
	}
	function handleBack() {
		if (!wizard) return;
		if (wizard.type === 'ignition' && step === 5) alertActions.setWizardStep(3);
		else alertActions.prevStep();
	}
	async function handleSave() {
		try {
			await alertActions.saveAlert();
			dispatch('close');
		} catch (error) {
			console.error('No se pudo guardar la alerta:', error);
		}
	}

	function conditionLabel(c) {
		return { on: 'Encendido', off: 'Apagado', enter: 'Entrada', exit: 'Salida' }[c] ?? '—';
	}
	function notificationEventSlug(w) {
		if (!w?.type || !w?.condition) return '—';
		if (w.type === 'ignition') return w.condition === 'on' ? 'ignition_on' : 'ignition_off';
		return w.condition === 'enter' ? 'geofence_entered' : 'geofence_exited';
	}
</script>

<svelte:window on:keydown={onKeydown} />

{#if wizard}
	<div
		class="fixed inset-0 z-[150] flex flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-[#060b18] dark:text-white max-sm:bottom-[calc(56px+env(safe-area-inset-bottom,0px))]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="caw-title"
	>
		<!-- Progress bar + header -->
		<div
			class="shrink-0 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#060b18]/95"
		>
			<!-- Progress bar -->
			<div class="flex gap-[3px] px-4 pt-3">
				{#each Array(effectiveSteps) as _, i}
					<div
						class="h-[3px] flex-1 rounded-full transition-all duration-300
					{displayStep > i + 1
							? 'bg-blue-600/50'
							: displayStep === i + 1
								? 'bg-blue-500'
								: 'bg-slate-300 dark:bg-white/[0.08]'}"
						aria-hidden="true"
					></div>
				{/each}
			</div>
			<!-- Header -->
			<header class="flex items-center gap-3 px-4 py-3">
				<button
					type="button"
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-400 dark:border-0 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1] dark:hover:text-white"
					on:click={close}
					aria-label="Cerrar asistente"
				>
					<Icon icon="mdi:close" width={17} aria-hidden="true" />
				</button>
				<div class="min-w-0 flex-1">
					<h2
						id="caw-title"
						class="m-0 text-[15px] font-bold tracking-tight text-slate-900 dark:text-white"
					>
						Crear alerta
					</h2>
					<p class="m-0 text-[10px] text-slate-500 dark:text-white/35">
						Paso {displayStep} de {effectiveSteps}
					</p>
				</div>
				<!-- tipo badge si ya está seleccionado -->
				{#if wizard.type}
					<span
						class="flex items-center gap-1 rounded-full {wizard.type === 'ignition'
							? 'bg-blue-600/20 text-blue-300'
							: 'bg-emerald-500/20 text-emerald-300'} px-2 py-0.5 text-[10px] font-bold"
					>
						<Icon
							icon={wizard.type === 'ignition' ? 'mdi:lightning-bolt' : 'mdi:map-marker-radius'}
							width={11}
							aria-hidden="true"
						/>
						{wizard.type === 'ignition' ? 'Ignición' : 'Zona'}
					</span>
				{/if}
			</header>
		</div>

		<!-- Content -->
		<main class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
			<!-- ── PASO 1: Tipo ── -->
			{#if step === 1}
				<h3 class="m-0 mb-1.5 text-[17px] font-bold">¿Qué tipo de alerta?</h3>
				<p class="mb-5 text-[12px] text-slate-600 dark:text-white/40 leading-relaxed">
					Elige el evento que disparará la notificación.
				</p>
				<div class="flex flex-col gap-3">
					<!-- Ignición -->
					<button
						type="button"
						class="flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
						{wizard.type === 'ignition'
							? 'border-blue-500 bg-blue-600/12'
							: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-transparent dark:bg-white/[0.05] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08]'}"
						on:click={() => alertActions.setType('ignition')}
					>
						<div
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400"
						>
							<Icon icon="mdi:lightning-bolt" width={24} aria-hidden="true" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="m-0 text-[15px] font-semibold">Alerta de ignición</p>
							<p class="m-0 mt-1 text-[12px] text-slate-600 dark:text-white/45 leading-snug">
								Notificar cuando el motor se enciende o se apaga.
							</p>
						</div>
						{#if wizard.type === 'ignition'}
							<span
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"
								aria-hidden="true"
							>
								<Icon icon="mdi:check" width={13} />
							</span>
						{/if}
					</button>

					<!-- Zona -->
					<button
						type="button"
						class="flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
						{wizard.type === 'zone'
							? 'border-emerald-500 bg-emerald-500/10'
							: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-transparent dark:bg-white/[0.05] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08]'}"
						on:click={() => alertActions.setType('zone')}
					>
						<div
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400"
						>
							<Icon icon="mdi:map-marker-radius" width={24} aria-hidden="true" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="m-0 text-[15px] font-semibold">Alerta de zona</p>
							<p class="m-0 mt-1 text-[12px] text-slate-600 dark:text-white/45 leading-snug">
								Notificar al entrar o salir de una zona H3 definida.
							</p>
						</div>
						{#if wizard.type === 'zone'}
							<span
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
								aria-hidden="true"
							>
								<Icon icon="mdi:check" width={13} />
							</span>
						{/if}
					</button>
				</div>

				<!-- ── PASO 2: Condición ── -->
			{:else if step === 2}
				<h3 class="m-0 mb-1.5 text-[17px] font-bold">
					{wizard.type === 'ignition' ? '¿Cuándo notificar?' : '¿Qué evento de zona?'}
				</h3>
				<p class="mb-5 text-[12px] text-slate-600 dark:text-white/40">
					Elige la condición que disparará la alerta.
				</p>
				<div class="grid grid-cols-2 gap-3">
					{#if wizard.type === 'ignition'}
						{#each [{ value: 'on', label: 'Encendido', icon: 'mdi:lightning-bolt', color: 'blue' }, { value: 'off', label: 'Apagado', icon: 'mdi:engine-off-outline', color: 'slate' }] as opt}
							<button
								type="button"
								class="flex flex-col items-center gap-3 rounded-2xl border-2 py-5 text-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
								{wizard.condition === opt.value
									? 'border-blue-500 bg-blue-600 shadow-[0_4px_20px_rgba(37,99,235,0.4)]'
									: 'border-slate-200 bg-white hover:border-slate-300 dark:border-transparent dark:bg-white/[0.06] dark:hover:border-white/[0.14]'}"
								on:click={() => alertActions.setCondition(opt.value)}
							>
								<Icon icon={opt.icon} width={28} aria-hidden="true" />
								<span class="text-[13px] font-semibold">{opt.label}</span>
							</button>
						{/each}
					{:else}
						{#each [{ value: 'enter', label: 'Entrada', icon: 'mdi:location-enter', color: 'emerald' }, { value: 'exit', label: 'Salida', icon: 'mdi:location-exit', color: 'orange' }] as opt}
							<button
								type="button"
								class="flex flex-col items-center gap-3 rounded-2xl border-2 py-5 text-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
								{wizard.condition === opt.value
									? 'border-blue-500 bg-blue-600 shadow-[0_4px_20px_rgba(37,99,235,0.4)]'
									: 'border-slate-200 bg-white hover:border-slate-300 dark:border-transparent dark:bg-white/[0.06] dark:hover:border-white/[0.14]'}"
								on:click={() => alertActions.setCondition(opt.value)}
							>
								<Icon icon={opt.icon} width={28} aria-hidden="true" />
								<span class="text-[13px] font-semibold">{opt.label}</span>
							</button>
						{/each}
					{/if}
				</div>

				<!-- ── PASO 3: Unidades ── -->
			{:else if step === 3}
				<h3 class="m-0 mb-1 text-[17px] font-bold">¿Qué unidades monitorear?</h3>
				<p class="mb-4 text-[12px] text-slate-600 dark:text-white/40 leading-relaxed">
					Selecciona las unidades que dispararán la alerta.
				</p>
				<div class="mb-3 flex items-center justify-between">
					<span class="text-[11px] text-slate-600 dark:text-white/45"
						>{wizard.units?.length ?? 0} seleccionada{(wizard.units?.length ?? 0) !== 1
							? 's'
							: ''}</span
					>
					<button
						type="button"
						class="border-0 bg-transparent text-[12px] font-semibold text-blue-400 hover:text-blue-300"
						on:click={() => alertActions.selectAllUnits($vehicles.map((v) => v.id))}
					>
						Seleccionar todas
					</button>
				</div>
				{#if $vehicles.length === 0}
					<p class="py-8 text-center text-[13px] text-slate-600 dark:text-white/38">
						No hay unidades disponibles.
					</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each $vehicles as vehicle}
							{@const selected = wizard.units?.includes(vehicle.id)}
							<button
								type="button"
								class="flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
								{selected
									? 'border-blue-500 bg-blue-600/10'
									: 'border-slate-200 bg-white hover:border-slate-300 dark:border-transparent dark:bg-white/[0.05] dark:hover:border-white/[0.1]'}"
								on:click={() => alertActions.toggleUnit(vehicle.id)}
							>
								<!-- checkbox visual -->
								<span
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors {selected
										? 'border-blue-500 bg-blue-500'
										: 'border-slate-300 dark:border-white/25'}"
									aria-hidden="true"
								>
									{#if selected}<Icon
											icon="mdi:check"
											width={13}
											class="text-white"
											aria-hidden="true"
										/>{/if}
								</span>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[13px] font-semibold leading-snug">{vehicle.name}</p>
									<p class="m-0 mt-0.5 text-[11px] text-slate-600 dark:text-white/40">
										{vehicle.driver || 'Sin conductor'}
									</p>
								</div>
								<span
									class="h-2 w-2 shrink-0 rounded-full {vehicle.status === 'active'
										? 'bg-emerald-500'
										: 'bg-slate-300 dark:bg-white/20'}"
									aria-hidden="true"
								></span>
							</button>
						{/each}
					</div>
				{/if}

				<!-- ── PASO 4: Zona (solo type=zone) ── -->
			{:else if step === 4 && wizard.type === 'zone'}
				<h3 class="m-0 mb-1 text-[17px] font-bold">¿En qué zona?</h3>
				<p class="mb-4 text-[12px] text-slate-600 dark:text-white/40">
					Elige la zona H3 que define el perímetro de la alerta.
				</p>
				{#if allH3Zones.length === 0}
					<div
						class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-white/[0.07] dark:bg-white/[0.03]"
					>
						<Icon
							icon="mdi:hexagon-outline"
							width={36}
							class="mx-auto mb-2 opacity-25"
							aria-hidden="true"
						/>
						<p class="m-0 text-[13px] font-semibold text-slate-600 dark:text-white/60">
							Sin zonas configuradas
						</p>
						<p class="m-0 mt-1 text-[11px] text-slate-500 dark:text-white/35">
							Crea una zona H3 en configuración o selecciona celdas en el mapa para usarlas aquí.
						</p>
					</div>
				{:else}
					<div class="flex flex-col gap-2">
						<p
							class="m-0 mb-1 mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35"
						>
							Zonas H3 (por celda ID)
						</p>
						<input
							type="text"
							class="w-full rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/60 focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/[0.14] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/28"
							placeholder="Filtrar zona por cell ID H3 (ej: 8a2a...)"
							value={h3CellQuery}
							on:input={(e) => (h3CellQuery = e.currentTarget.value)}
							autocomplete="off"
							aria-label="Buscar zona H3 por cell ID"
						/>
						{#if filteredH3Zones.length === 0}
							<p
								class="m-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/45"
							>
								No hay zonas H3 que coincidan con ese cell ID.
							</p>
						{:else}
							{#each filteredH3Zones as zone}
								<button
									type="button"
									class="flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-sky-400
										{wizard.zone === zone.id
										? 'border-blue-500 bg-blue-600/10'
										: 'border-slate-200 bg-white hover:border-slate-300 dark:border-transparent dark:bg-white/[0.05] dark:hover:border-white/[0.1]'}"
									on:click={() => alertActions.setZone(zone.id)}
								>
									<span
										class="h-3.5 w-3.5 shrink-0 rounded"
										style="background:{zone.color}"
										aria-hidden="true"
									></span>
									<div class="min-w-0 flex-1">
										<p class="m-0 text-[13px] font-semibold">{zone.name}</p>
										<p class="m-0 mt-0.5 text-[11px] text-slate-600 dark:text-white/40">
											{zone.source === 'h3-live'
												? `Seleccion temporal · ${zone.cells.length} celdas H3`
												: `${zone.cells.length} celdas H3`}
										</p>
										{#if zone.cells.length > 0}
											<p
												class="m-0 mt-1 truncate font-mono text-[10px] text-slate-500 dark:text-white/30"
											>
												{zone.cells.slice(0, 3).join(' · ')}{zone.cells.length > 3 ? '…' : ''}
											</p>
										{/if}
									</div>
									{#if wizard.zone === zone.id}
										<Icon
											icon="mdi:check-circle"
											width={18}
											class="text-blue-400 shrink-0"
											aria-hidden="true"
										/>
									{/if}
								</button>
							{/each}
						{/if}
					</div>
				{/if}

				<!-- ── PASO 5: Nombre + resumen ── -->
			{:else if step === 5}
				<h3 class="m-0 mb-1 text-[17px] font-bold">Nombra la alerta</h3>
				<p class="mb-4 text-[12px] text-slate-600 dark:text-white/40">
					Un nombre descriptivo para identificarla en el historial.
				</p>
				<label
					for="caw-name"
					class="mb-1.5 block text-[12px] font-medium text-slate-600 dark:text-white/55"
					>Nombre visible</label
				>
				<input
					id="caw-name"
					class="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500/65 focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/[0.14] dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/25"
					type="text"
					placeholder="Ej: Motor encendido nocturno"
					autocomplete="off"
					maxlength="255"
					value={wizard.name ?? ''}
					on:input={(e) => alertActions.setName(e.currentTarget.value)}
				/>

				<!-- Resumen compacto -->
				<div
					class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.07] dark:bg-white/[0.04]"
				>
					<p
						class="m-0 mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/30"
					>
						Resumen
					</p>
					<dl class="m-0 space-y-2">
						{#each [['Tipo', wizard.type === 'ignition' ? 'Ignición' : 'Zona'], ['Condición', conditionLabel(wizard.condition)], ['Unidades', `${wizard.units?.length ?? 0} seleccionada${(wizard.units?.length ?? 0) !== 1 ? 's' : ''}`], ...(wizard.type === 'zone' && wizard.zone ? [['Zona', selectedZoneLabel]] : [])] as [dt, dd]}
							<div class="flex items-center justify-between gap-3">
								<dt class="m-0 text-[12px] text-slate-600 dark:text-white/45">{dt}</dt>
								<dd class="m-0 text-[12px] font-semibold text-slate-900 dark:text-white">{dd}</dd>
							</div>
						{/each}
						<div
							class="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-white/[0.07]"
						>
							<dt class="m-0 text-[11px] text-slate-500 dark:text-white/35">Evento DB</dt>
							<dd class="m-0 font-mono text-[11px] font-semibold text-emerald-300/85">
								{notificationEventSlug(wizard)}
							</dd>
						</div>
					</dl>
				</div>
			{/if}
		</main>

		<!-- Footer: botones de navegación -->
		<footer
			class="shrink-0 flex gap-3 border-t border-slate-200 bg-slate-100 px-4 py-3 sm:py-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/[0.07] dark:bg-[#060b18]"
		>
			{#if step > 1}
				<button
					type="button"
					class="h-12 flex-1 rounded-[14px] border border-slate-300 bg-white text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-400 dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white/65 dark:hover:bg-white/[0.09]"
					on:click={handleBack}
				>
					Atrás
				</button>
			{/if}

			{#if step < STEPS && !(wizard.type === 'ignition' && step === 3)}
				<button
					type="button"
					class="h-12 flex-[2] rounded-[14px] bg-gradient-to-br from-blue-600 to-cyan-600 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-white/30 focus-visible:outline-2 focus-visible:outline-sky-400"
					disabled={!canNext}
					on:click={handleNext}
				>
					Siguiente
				</button>
			{:else if step === 5 || (wizard.type === 'ignition' && step === 3)}
				{#if wizard.type === 'ignition' && step === 3}
					<button
						type="button"
						class="h-12 flex-[2] rounded-[14px] bg-gradient-to-br from-blue-600 to-cyan-600 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-white/30"
						disabled={!canNext}
						on:click={handleNext}
					>
						Siguiente
					</button>
				{:else}
					<button
						type="button"
						class="h-12 flex-[2] rounded-[14px] bg-gradient-to-br from-emerald-600 to-teal-600 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-white/30 focus-visible:outline-2 focus-visible:outline-sky-400"
						disabled={!wizard.name?.trim()}
						on:click={handleSave}
					>
						<span class="flex items-center justify-center gap-2">
							<Icon icon="mdi:check-circle-outline" width={18} aria-hidden="true" />
							Guardar alerta
						</span>
					</button>
				{/if}
			{/if}
		</footer>
	</div>
{/if}
