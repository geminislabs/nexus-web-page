<script>
	import Icon from '@iconify/svelte';
	import {
		alerts,
		alarmEvents,
		alertActions,
		unreadAlarmCount,
		alertWizard
	} from '$lib/stores/alertStore.js';
	import CrearAlertaWizard from './CrearAlertaWizard.svelte';

	let subView = 'alarmas'; // 'alarmas' | 'config' | 'gestionar'

	function openWizard() {
		alertActions.openWizard();
	}

	function formatDate(iso) {
		try {
			return new Date(iso).toLocaleString('es-MX', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}

	const conditionLabels = {
		on: 'Encendido',
		off: 'Apagado',
		enter: 'Entrada a zona',
		exit: 'Salida de zona'
	};
	const typeLabels = { ignition: 'Ignición', zone: 'Zona' };
</script>

<section
	class="relative flex h-full min-h-0 flex-col bg-black text-white"
	aria-label="Alertas y configuración de alarmas"
	style="min-height:0;align-items:stretch;justify-content:flex-start;padding:0"
>
	{#if $alertWizard}
		<CrearAlertaWizard on:close={() => alertActions.closeWizard()} />
	{/if}

	{#if subView === 'alarmas' || subView === 'config'}
		<nav class="shrink-0 px-4 pt-4" aria-label="Subsecciones de alertas">
			<div
				class="flex gap-[3px] rounded-xl bg-zinc-900 p-[3px]"
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
						: 'bg-transparent text-white/50 hover:text-white/70'}"
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
						: 'bg-transparent text-white/50 hover:text-white/70'}"
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
							<div class="text-white" aria-hidden="true">
								<Icon icon="mdi:bell-off-outline" class="h-16 w-16 opacity-25" />
							</div>
							<h3 class="m-0 text-lg font-semibold text-white">Sin alarmas recientes</h3>
							<p class="m-0 max-w-xs text-sm leading-relaxed text-white/40">
								Cuando ocurra una alerta aparecerá aquí.
							</p>
						</div>
					{:else}
						<ul class="m-0 flex list-none flex-col gap-3 p-0" aria-label="Lista de alarmas recientes">
							{#each $alarmEvents as ev, idx (`${ev.at}-${idx}`)}
								<li>
									<article
										class="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3.5 {!ev.read
											? 'ring-1 ring-blue-500/35'
											: ''}"
										aria-label="{ev.name || 'Alerta'}{!ev.read ? ', no leída' : ''}"
									>
										<div
											class="h-2 w-2 shrink-0 rounded-full {!ev.read ? 'bg-blue-500' : 'bg-white/20'}"
											aria-hidden="true"
										></div>
										<div class="min-w-0 flex-1">
											<p class="m-0 text-[0.9375rem] font-medium leading-snug text-white">
												{ev.name || 'Alerta'}
											</p>
											<p class="m-0 mt-1 text-xs leading-snug text-white/45">
												{ev.vehicle || 'Unidad'} · <time datetime={ev.at}>{formatDate(ev.at)}</time>
											</p>
										</div>
										<span
											class="inline-flex shrink-0 rounded-full bg-blue-600/20 px-2 py-0.5 text-[0.6875rem] font-semibold text-blue-400"
										>
											{typeLabels[ev.type] || ev.type}
										</span>
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
						<div class="mb-3">
							<h3 id="config-alertas-heading" class="m-0 text-[1.125rem] font-bold text-white">
								Configuración de alertas
							</h3>
							<p class="m-0 mt-1 text-xs text-white/45">
								Administra reglas, activación y notificaciones de tu flota.
							</p>
						</div>
						<div class="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2">
							<button
								type="button"
								class="flex w-full cursor-pointer items-center justify-between rounded-xl border-0 bg-zinc-900/90 px-3.5 py-3.5 text-left text-[15px] font-medium text-white shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
								on:click={() => (subView = 'gestionar')}
							>
								<span class="flex min-w-0 items-center gap-3">
									<span
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400"
										aria-hidden="true"
									>
										<Icon icon="mdi:bell-cog-outline" class="h-5 w-5" />
									</span>
									<span class="min-w-0">
										<span class="block truncate">Gestionar alertas</span>
										<span class="mt-0.5 block text-[11px] font-normal text-white/45">
											Crear, editar, activar y eliminar reglas
										</span>
									</span>
								</span>
								<span class="flex shrink-0 text-white/30" aria-hidden="true">
									<Icon icon="mdi:chevron-right" class="h-[18px] w-[18px]" />
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if subView === 'gestionar'}
		<div class="flex h-full min-h-0 flex-col">
			<header
				class="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-4"
			>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
					on:click={() => (subView = 'config')}
					aria-label="Volver a configuración de alertas"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 text-lg font-bold text-white">Gestionar alertas</h2>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
				{#if $alerts.length === 0}
					<div class="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
						<div class="text-white" aria-hidden="true">
							<Icon icon="mdi:bell-off-outline" class="h-16 w-16 opacity-25" />
						</div>
						<h3 class="m-0 text-lg font-semibold text-white">No hay alertas configuradas</h3>
						<p class="m-0 max-w-xs text-sm text-white/40">
							Cree una alerta con el botón inferior para empezar.
						</p>
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Alertas configuradas">
						{#each $alerts as alert (alert.id)}
							<li>
								<article
									class="flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5"
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
												class="m-0 text-[0.9375rem] font-medium leading-snug text-white"
											>
												{alert.name}
											</p>
											<p class="m-0 mt-0.5 text-xs text-white/45">
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
											on:click={() => alertActions.toggleAlert(alert.id)}
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
											on:click={() => alertActions.deleteAlert(alert.id)}
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
			<div class="shrink-0 border-t border-white/[0.06] p-4">
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
