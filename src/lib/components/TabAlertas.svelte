<script>
	import { browser } from '$app/environment';
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
	import EditAlertWizard from './EditAlertWizard.svelte';
	import ConfirmModal from './ConfirmModal.svelte';
	import ZonasPanel from './ZonasPanel.svelte';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import { onMount } from 'svelte';

	let subView = 'alarmas';

	let notifPermission = null; // null | 'granted' | 'denied' | 'default'

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

	// ── delete ────────────────────────────────────────────────────────────────
	let alertToDelete = null;
	let deleteAlertLoading = false;

	function requestDeleteAlert(alert) {
		alertToDelete = { id: alert.id, name: alert.name || 'Alerta' };
	}
	function cancelDeleteAlert() {
		alertToDelete = null;
	}
	async function confirmDeleteAlert() {
		if (!alertToDelete?.id || deleteAlertLoading) return;
		deleteAlertLoading = true;
		try {
			await alertActions.deleteAlert(alertToDelete.id);
			alertToDelete = null;
		} finally {
			deleteAlertLoading = false;
		}
	}

	// ── toggle enabled ────────────────────────────────────────────────────────
	let togglingId = null;
	async function handleToggle(alert) {
		if (togglingId) return;
		togglingId = alert.id;
		try {
			await alertActions.toggleAlertEnabled(alert.id);
		} catch {
			// rollback handled in store
		} finally {
			togglingId = null;
		}
	}

	// ── edit (abre EditAlertWizard) ───────────────────────────────────────────
	let editAlert = null;

	function openEdit(alert) {
		editAlert = alert;
	}
	function closeEdit() {
		editAlert = null;
	}

	onMount(() => {
		if (browser && 'Notification' in window) {
			notifPermission = Notification.permission;
		}

		alertActions.syncAlertRulesFromApi().catch((err) => {
			console.error('No se pudieron cargar reglas de alerta:', err);
		});
		alertActions.syncAlarmEventsFromApi().catch((err) => {
			console.error('No se pudo cargar historial de alertas:', err);
		});
	});

	async function requestNotifPermission() {
		if (!browser || !('Notification' in window)) return;
		const result = await Notification.requestPermission();
		notifPermission = result;
	}
</script>

<section
	class="relative flex h-full min-h-0 flex-col text-slate-900 dark:text-white {subView ===
		'crear_zona_map' || subView === 'guardar_zona'
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
	{:else if subView === 'alarmas' || subView === 'config' || subView === 'gestionar'}
		<!-- Tab bar -->
		<nav
			class="flex shrink-0 gap-1.5 border-b border-slate-200 px-3 pb-3 pt-3 dark:border-white/[0.07]"
			aria-label="Secciones de alertas"
		>
			<div class="flex w-full rounded-[12px] bg-slate-200/70 p-1 dark:bg-white/[0.06]">
				<button
					type="button"
					id="tab-alarmas"
					role="tab"
					aria-selected={subView === 'alarmas'}
					aria-controls="tabpanel-alarmas"
					class="relative flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 px-3 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {subView ===
					'alarmas'
						? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]'
						: 'bg-transparent text-slate-600 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'}"
					on:click={() => (subView = 'alarmas')}
				>
					<Icon icon="mdi:bell-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
					Historial
					{#if $unreadAlarmCount > 0}
						<span
							class="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
							aria-label="{$unreadAlarmCount} sin leer"
						>
							{$unreadAlarmCount > 99 ? '99+' : $unreadAlarmCount}
						</span>
					{/if}
				</button>
				<button
					type="button"
					id="tab-config"
					role="tab"
					aria-selected={subView === 'config'}
					aria-controls="tabpanel-config"
					class="relative flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 px-3 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {subView ===
					'config'
						? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]'
						: 'bg-transparent text-slate-600 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'}"
					on:click={() => (subView = 'config')}
				>
					<Icon icon="mdi:cog-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
					Configuración
				</button>
			</div>
		</nav>

		<div class="flex min-h-0 flex-1 flex-col">
			<!-- Historial de alarmas -->
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
							<h3 class="m-0 text-lg font-semibold text-slate-900 dark:text-white">
								Sin alarmas recientes
							</h3>
							<p class="m-0 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-white/40">
								Cuando ocurra una alerta aparecerá aquí.
							</p>
						</div>
					{:else}
						<ul
							class="m-0 flex list-none flex-col gap-3.5 p-0"
							aria-label="Lista de alarmas recientes"
						>
							{#each $alarmEvents as ev, idx (`${ev.at}-${idx}`)}
								<li>
									<article
										class="flex items-stretch gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-white/[0.07] dark:bg-[#121a28] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] {!ev.read
											? 'ring-1 ring-sky-500/30 dark:shadow-[0_0_28px_-10px_rgba(56,189,248,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]'
											: ''}"
										aria-label="{ev.vehicle || 'Unidad'}: {ev.name || 'Evento'}{!ev.read
											? ', no leída'
											: ''}"
									>
										<div
											class="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center self-center rounded-xl {ev.type ===
											'ignition'
												? 'bg-blue-600/15 text-blue-400'
												: 'bg-emerald-500/15 text-emerald-400'}"
											aria-hidden="true"
										>
											<Icon
												icon={ev.type === 'ignition'
													? 'mdi:lightning-bolt'
													: 'mdi:map-marker-radius'}
												class="h-6 w-6"
											/>
										</div>
										<div class="min-w-0 flex-1 self-center">
											<p class="m-0 text-[0.9375rem] font-semibold text-slate-900 dark:text-white">
												{ev.name}
											</p>
											<p class="m-0 mt-0.5 text-xs text-slate-600 dark:text-white/45">
												{ev.vehicle}
											</p>
											<p class="m-0 mt-1 text-[11px] text-slate-500 dark:text-white/30">
												{formatAlarmWhen(ev.at)}
											</p>
										</div>
									</article>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- Configuración de alertas -->
			<div
				id="tabpanel-config"
				role="tabpanel"
				aria-labelledby="tab-config"
				hidden={subView !== 'config'}
				class="flex min-h-0 flex-1 flex-col"
			>
				<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
					<div class="mb-4 space-y-2.5">
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#121a26] dark:hover:bg-white/[0.04]"
							on:click={() => (subView = 'gestionar')}
						>
							<span class="flex min-w-0 items-center gap-3">
								<span
									class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400"
									aria-hidden="true"
								>
									<Icon icon="mdi:bell-cog-outline" class="h-6 w-6" />
								</span>
								<span class="min-w-0">
									<span
										class="block truncate text-[15px] font-semibold text-slate-900 dark:text-white"
										>Reglas de alerta</span
									>
									<span class="mt-0.5 block text-[11px] text-slate-600 dark:text-white/40">
										Crear, editar, activar y eliminar reglas
									</span>
								</span>
							</span>
							<Icon
								icon="mdi:chevron-right"
								class="h-5 w-5 shrink-0 text-slate-500 dark:text-white/30"
								aria-hidden="true"
							/>
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
									<span
										class="block truncate text-[15px] font-semibold text-slate-900 dark:text-white"
										>Zonas</span
									>
									<span class="mt-0.5 block text-[11px] text-slate-600 dark:text-white/40">
										Zonas geográficas con celdas H3
									</span>
								</span>
							</span>
							<Icon
								icon="mdi:chevron-right"
								class="h-5 w-5 shrink-0 text-slate-500 dark:text-white/30"
								aria-hidden="true"
							/>
						</button>
					</div>
				</div>
			</div>

			<!-- Gestionar reglas -->
			{#if subView === 'gestionar'}
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
						<h2 class="m-0 text-lg font-bold text-slate-900 dark:text-white">Reglas de alerta</h2>
						<span class="ml-auto text-sm text-slate-500 dark:text-white/40"
							>{$alerts.length} regla{$alerts.length !== 1 ? 's' : ''}</span
						>
					</header>
					{#if notifPermission === 'denied' || notifPermission === 'default'}
						<div class="shrink-0 border-b border-orange-500/20 bg-orange-500/10 px-4 py-3">
							<div class="flex items-start gap-3">
								<Icon
									icon="mdi:alert"
									class="mt-0.5 h-5 w-5 shrink-0 text-orange-400"
									aria-hidden="true"
								/>
								<div class="min-w-0 flex-1">
									<p class="m-0 text-[13px] font-semibold text-white">
										{notifPermission === 'denied'
											? 'Notificaciones bloqueadas'
											: 'Notificaciones desactivadas'}
									</p>
									<p class="m-0 mt-0.5 text-[11px] text-white/60">
										{notifPermission === 'denied'
											? 'Actívalas en la configuración del navegador para recibir alertas.'
											: 'Actívalas para recibir alertas en tiempo real.'}
									</p>
								</div>
								{#if notifPermission === 'default'}
									<button
										type="button"
										class="shrink-0 rounded-lg bg-orange-500/20 px-3 py-1.5 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/30"
										on:click={requestNotifPermission}
									>
										Activar
									</button>
								{/if}
							</div>
						</div>
					{/if}
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
											class="flex items-center gap-3 rounded-xl border bg-white p-3.5 dark:bg-zinc-900 {alert.enabled
												? 'border-slate-200 dark:border-transparent'
												: 'border-slate-200/60 opacity-60 dark:border-transparent'}"
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
														{conditionLabels[alert.condition] || alert.condition} · {alert.units
															.length} unidad{alert.units.length !== 1 ? 'es' : ''}
													</p>
												</div>
											</div>
											<div class="flex shrink-0 items-center gap-1.5">
												<!-- Toggle activo/inactivo -->
												<button
													type="button"
													role="switch"
													aria-checked={alert.enabled}
													aria-label="{alert.enabled
														? 'Desactivar'
														: 'Activar'} la alerta «{alert.name}»"
													class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed {alert.enabled
														? 'bg-blue-600'
														: 'bg-slate-300 dark:bg-white/20'}"
													disabled={togglingId === alert.id}
													on:click={() => handleToggle(alert)}
												>
													<span
														class="pointer-events-none absolute left-[3px] top-[3px] block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform {alert.enabled
															? 'translate-x-5'
															: 'translate-x-0'}"
													></span>
												</button>
												<!-- Editar -->
												<button
													type="button"
													class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-white/[0.07] dark:text-white/45 dark:hover:bg-white/[0.12] dark:hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
													on:click={() => openEdit(alert)}
													aria-label="Editar la alerta «{alert.name}»"
												>
													<Icon icon="mdi:pencil-outline" class="h-4 w-4" aria-hidden="true" />
												</button>
												<!-- Eliminar -->
												<button
													type="button"
													class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
													on:click={() => requestDeleteAlert(alert)}
													aria-label="Eliminar la alerta «{alert.name}»"
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
							class="flex min-h-[2.75rem] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[linear-gradient(135deg,#2563eb,#1d9cc4)] px-4 py-3.5 text-base font-semibold text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 [&_svg]:h-5 [&_svg]:w-5"
							on:click={openWizard}
						>
							<Icon icon="mdi:plus" class="shrink-0" aria-hidden="true" />
							Crear alerta
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>

{#if editAlert}
	<EditAlertWizard alert={editAlert} on:close={closeEdit} />
{/if}

<ConfirmModal
	open={!!alertToDelete}
	title="Eliminar alerta"
	confirmLabel="Eliminar"
	cancelLabel="Cancelar"
	destructive
	loading={deleteAlertLoading}
	on:cancel={cancelDeleteAlert}
	on:confirm={confirmDeleteAlert}
>
	{#if alertToDelete}
		<p class="m-0">
			¿Eliminar la alerta <strong>{alertToDelete.name}</strong>? Esta acción no se puede deshacer.
		</p>
	{/if}
</ConfirmModal>
