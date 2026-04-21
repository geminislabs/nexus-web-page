<script>
	import Icon from '@iconify/svelte';
	import {
		alerts,
		alarmEvents,
		alertActions,
		unreadAlarmCount,
		alertWizard
	} from '$lib/stores/alertStore.js';
	import { theme } from '$lib/stores/themeStore.js';
	import CrearAlertaWizard from './CrearAlertaWizard.svelte';
	import ZonasPanel from './ZonasPanel.svelte';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import { onMount } from 'svelte';

	/** @type {'alarmas' | 'config' | 'gestionar' | 'zonas' | 'crear_zona_map' | 'guardar_zona' | 'zona_edit'} */
	let subView = 'alarmas';

	function openWizard() {
		alertActions.openWizard();
	}

	function goZonas() {
		subView = 'zonas';
	}

	function goConfigFromZonas() {
		subView = 'config';
	}

	const conditionLabels = {
		on: 'Encendido',
		off: 'Apagado',
		enter: 'Entrada a zona',
		exit: 'Salida de zona'
	};

	onMount(() => {
		alertActions.syncAlertRulesFromApi().catch((err) => {
			console.error('No se pudieron cargar reglas de alerta:', err);
		});
		alertActions.syncAlarmEventsFromApi().catch((err) => {
			console.error('No se pudo cargar historial de alertas:', err);
		});
	});
</script>

<section
	class="relative flex h-full min-h-0 flex-col text-slate-900 dark:text-white {subView === 'crear_zona_map' ||
	subView === 'guardar_zona'
		? 'bg-transparent'
		: 'bg-slate-50 dark:bg-black'}"
	class:pointer-events-none={subView === 'crear_zona_map' || subView === 'guardar_zona'}
	aria-label="Alertas y configuración de alarmas"
	style="min-height:0;align-items:stretch;justify-content:flex-start;padding:0"
>
	{#if $alertWizard}
		<CrearAlertaWizard on:close={() => alertActions.closeWizard()} />
	{/if}

	{#if subView === 'zonas' || subView === 'crear_zona_map' || subView === 'guardar_zona' || subView === 'zona_edit'}
		<ZonasPanel variant="mobile" bind:subView onBackFromZonaList={goConfigFromZonas} />
	{:else if subView === 'alarmas' || subView === 'config'}
		<nav class="shrink-0 px-4 pt-4" aria-label="Subsecciones de alertas">
			<div
				class="flex gap-[3px] rounded-xl bg-slate-200 p-[3px] dark:bg-zinc-900"
				role="tablist"
				aria-label="Vista de alarmas o configuración"
			>
				<button
					id="tab-alarmas"
					type="button"
					role="tab"
					aria-selected={subView === 'alarmas'}
					aria-controls="tabpanel-alarmas"
					class="relative flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 px-3 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {subView === 'alarmas'
						? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]'
						: 'bg-transparent text-slate-600 dark:text-white/50 hover:text-slate-700 dark:text-white/70'}"
					on:click={() => (subView = 'alarmas')}
				>
					<Icon icon="mdi:bell-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
					Alarmas
					{#if $unreadAlarmCount > 0}
						<span
							class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white"
							aria-hidden="true"
						>
							{$unreadAlarmCount}
						</span>
					{/if}
				</button>
				<button
					id="tab-config"
					type="button"
					role="tab"
					aria-selected={subView === 'config'}
					aria-controls="tabpanel-config"
					class="relative flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 px-3 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {subView === 'config'
						? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]'
						: 'bg-transparent text-slate-600 dark:text-white/50 hover:text-slate-700 dark:text-white/70'}"
					on:click={() => (subView = 'config')}
				>
					<Icon icon="mdi:cog-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
					Configuración
				</button>
			</div>
		</nav>

		<div class="flex min-h-0 flex-1 flex-col">
			<div
				id="tabpanel-alarmas"
				role="tabpanel"
				aria-labelledby="tab-alarmas"
				hidden={subView !== 'alarmas'}
				class="flex min-h-0 flex-1 flex-col"
			>
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
					{#if $alarmEvents.length === 0}
						<div class="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
							<div class="text-slate-400 dark:text-white" aria-hidden="true">
								<Icon icon="mdi:bell-off-outline" class="h-16 w-16 opacity-25" />
							</div>
							<h3 class="m-0 text-lg font-semibold text-slate-900 dark:text-white">Sin alarmas recientes</h3>
							<p class="m-0 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-white/40">
								Cuando ocurra una alerta aparecerá aquí.
							</p>
						</div>
					{:else}
						<ul class="m-0 flex list-none flex-col gap-3.5 p-0" aria-label="Lista de alarmas recientes">
							{#each $alarmEvents as ev, idx (`${ev.at}-${idx}`)}
								<li>
									<article
										class="flex items-stretch gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-white/[0.07] dark:bg-[#121a28] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] {!ev.read
											? 'ring-1 ring-sky-500/30 dark:shadow-[0_0_28px_-10px_rgba(56,189,248,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]'
											: ''}"
										aria-label="{ev.vehicle || 'Unidad'}: {ev.name || 'Evento'}{!ev.read ? ', no leída' : ''}"
									>
										<div
											class="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center self-center"
											aria-hidden="true"
										>
											<div
												class="absolute inset-0 scale-110 rounded-full bg-sky-500/25 blur-md"
											></div>
											<div
												class="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-sky-400/20 to-blue-600/10 ring-1 ring-sky-400/40"
											>
												<Icon icon="mdi:bell" class="h-[22px] w-[22px] text-sky-400" />
											</div>
										</div>
										<div class="min-w-0 flex-1 py-0.5">
											<p
												class="m-0 text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white"
											>
												{ev.vehicle || 'Unidad'}
											</p>
											<p
												class="m-0 mt-1.5 text-[13px] font-medium leading-snug text-slate-600 dark:text-slate-400"
											>
												{ev.name || 'Evento'}
											</p>
											<p
												class="m-0 mt-2 flex items-center gap-1.5 text-[12px] font-medium text-sky-400"
											>
												<Icon icon="mdi:clock-outline" class="h-3.5 w-3.5 shrink-0 opacity-90" />
												<time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
											</p>
										</div>
									</article>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div
				id="tabpanel-config"
				role="tabpanel"
				aria-labelledby="tab-config"
				hidden={subView !== 'config'}
				class="flex min-h-0 flex-1 flex-col"
			>
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
					<div class="mx-auto w-full max-w-md">
						<div class="mb-4">
							<h3
								id="config-alertas-heading"
								class="m-0 text-[1.125rem] font-bold text-slate-900 dark:text-white"
							>
								Configuración de alertas
							</h3>
							<p class="m-0 mt-1 text-xs text-slate-600 dark:text-white/45">
								Administra reglas, activación y notificaciones de tu flota.
							</p>
						</div>
						<div class="flex flex-col gap-2.5">
							<button
								type="button"
								class="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#121a26] dark:hover:bg-white/[0.04]"
								on:click={() => (subView = 'gestionar')}
							>
								<span class="flex min-w-0 items-center gap-3">
									<span
										class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"
										aria-hidden="true"
									>
										<Icon icon="mdi:bell-cog-outline" class="h-6 w-6" />
										<span
											class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-white dark:ring-[#121a26]"
											aria-hidden="true"
										></span>
									</span>
									<span class="min-w-0">
										<span
											class="block truncate text-[15px] font-semibold text-slate-900 dark:text-white"
											>Gestionar alertas</span
										>
										<span class="mt-0.5 block text-[11px] text-slate-600 dark:text-white/40">
											Crear, editar, activar y eliminar reglas
										</span>
									</span>
								</span>
								<Icon icon="mdi:chevron-right" class="h-5 w-5 shrink-0 text-slate-500 dark:text-white/30" aria-hidden="true" />
							</button>
							<button
								type="button"
								class="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#121a26] dark:hover:bg-white/[0.04]"
								on:click={goZonas}
							>
								<span class="flex min-w-0 items-center gap-3">
									<span
										class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"
										aria-hidden="true"
									>
										<Icon icon="mdi:map-marker" class="h-6 w-6" />
									</span>
									<span class="min-w-0">
										<span class="block truncate text-[15px] font-semibold text-slate-900 dark:text-white"
											>Zonas</span
										>
										<span class="mt-0.5 block text-[11px] text-slate-600 dark:text-white/40">
											Zonas geográficas con celdas H3
										</span>
									</span>
								</span>
								<Icon icon="mdi:chevron-right" class="h-5 w-5 shrink-0 text-slate-500 dark:text-white/30" aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if subView === 'gestionar'}
		<div class="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-black">
			<header
				class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/[0.08]"
			>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition-colors hover:bg-slate-100 dark:border-0 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
					on:click={() => (subView = 'config')}
					aria-label="Volver a configuración de alertas"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 text-lg font-bold text-slate-900 dark:text-white">Gestionar alertas</h2>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
				{#if $alerts.length === 0}
					<div class="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
						<div class="text-slate-400 dark:text-white" aria-hidden="true">
							<Icon icon="mdi:bell-off-outline" class="h-16 w-16 opacity-25" />
						</div>
						<h3 class="m-0 text-lg font-semibold text-slate-900 dark:text-white">
							No hay alertas configuradas
						</h3>
						<p class="m-0 max-w-xs text-sm text-slate-600 dark:text-white/40">
							Cree una alerta con el botón inferior para empezar.
						</p>
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Alertas configuradas">
						{#each $alerts as alert (alert.id)}
							<li>
								<article
									class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-transparent dark:bg-zinc-900"
									aria-labelledby="alert-title-{alert.id}"
								>
									<div class="flex min-w-0 flex-1 items-center gap-3">
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {alert.type ===
											'ignition'
												? 'bg-blue-600/20 text-blue-400'
												: 'bg-emerald-500/20 text-emerald-400'}"
											aria-hidden="true"
										>
											{#if alert.type === 'ignition'}
												<Icon icon="mdi:lightning-bolt" class="h-[18px] w-[18px]" />
											{:else}
												<Icon icon="mdi:map-marker-radius" class="h-[18px] w-[18px]" />
											{/if}
										</div>
										<div class="min-w-0">
											<p
												id="alert-title-{alert.id}"
												class="m-0 text-[0.9375rem] font-medium leading-snug text-slate-900 dark:text-white"
											>
												{alert.name}
											</p>
											<p class="m-0 mt-0.5 text-xs text-slate-600 dark:text-white/45">
												{conditionLabels[alert.condition] || alert.condition} · {alert.units.length}
												unidad{alert.units.length !== 1 ? 'es' : ''}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 items-center gap-2">
										<button
											type="button"
											role="switch"
											aria-checked={alert.enabled}
											aria-label={`Alerta «${alert.name}»: ${alert.enabled ? 'activa' : 'desactivada'}. Pulse para cambiar.`}
											class="relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {alert.enabled
												? 'bg-blue-600'
												: 'bg-zinc-600'}"
											on:click={() =>
												alertActions.toggleAlert(alert.id).catch((err) => {
													console.error('No se pudo cambiar estado de alerta:', err);
												})}
										>
											<span
												class="pointer-events-none absolute left-[3px] top-[3px] block h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-transform {alert.enabled
													? 'translate-x-[18px]'
													: ''}"
												aria-hidden="true"
											></span>
										</button>
										<button
											type="button"
											class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
											on:click={() =>
												alertActions.deleteAlert(alert.id).catch((err) => {
													console.error('No se pudo eliminar alerta:', err);
												})}
											aria-label={`Eliminar la alerta «${alert.name}»`}
										>
											<Icon icon="mdi:delete-outline" class="h-4 w-4" aria-hidden="true" />
										</button>
									</div>
								</article>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div class="shrink-0 border-t border-slate-200 p-4 dark:border-white/[0.06]">
				<button
					type="button"
					class="flex w-full min-h-[2.75rem] cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[linear-gradient(135deg,#2563eb,#1d9cc4)] px-4 py-3.5 text-base font-semibold text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 [&_svg]:h-5 [&_svg]:w-5"
					on:click={openWizard}
				>
					<Icon icon="mdi:plus" class="shrink-0" aria-hidden="true" />
					Crear alerta
				</button>
			</div>
		</div>
	{/if}
</section>
