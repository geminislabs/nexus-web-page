<script>
	import Icon from '@iconify/svelte';
	import { fly } from 'svelte/transition';
	import { get } from 'svelte/store';
	import { alerts, alarmEvents, unreadAlarmCount, alertActions } from '$lib/stores/alertStore.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	/** compact = botón más pequeño para navbar admin */
	export let compact = false;

	let open = false;
	/** @type {{ id: string, name: string } | null} */
	let alertToDelete = null;
	let deleteAlertLoading = false;

	$: badge = $alerts.length + $alarmEvents.length;

	function toggle() {
		open = !open;
		if (open && get(unreadAlarmCount) > 0) {
			alertActions.markAllRead();
		}
	}

	function close() {
		open = false;
	}

	function requestDeleteAlert(alert) {
		alertToDelete = { id: alert.id, name: alert?.name || 'Alerta' };
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
		} catch (err) {
			console.error('No se pudo eliminar alerta:', err);
		} finally {
			deleteAlertLoading = false;
		}
	}

	function removeAlarmEvent(id) {
		alertActions.deleteAlarmEvent(id);
	}

	function onDocClick(e) {
		if (!e.target.closest('[data-alarm-bell]')) close();
	}

	function onKey(e) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window on:click={onDocClick} on:keydown={onKey} />

<div class="relative" data-alarm-bell>
	<button
		type="button"
		class={compact
			? `relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08] ${open ? 'border-emerald-400/50 text-emerald-700 dark:text-emerald-300' : ''}`
			: `relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 text-white shadow-lg transition-[background,transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/80 [&_svg]:h-6 [&_svg]:w-6 ${open ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_4px_16px_rgba(168,85,247,0.5)]' : 'bg-gradient-to-br from-sky-600 to-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.4)] dark:from-slate-700 dark:to-slate-800'}`}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-label="Historial de alarmas y notificaciones"
		title="Alarmas y notificaciones"
		on:click|stopPropagation={toggle}
	>
		<Icon icon="mdi:bell-outline" aria-hidden="true" />
		{#if badge > 0}
			<span
				class="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white/30 bg-rose-600 px-1.5 py-[1px] text-center text-[10px] font-bold leading-none text-white"
				aria-label="{badge} notificaciones"
			>
				{badge}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute right-0 top-[calc(100%+8px)] z-[90] w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgb(8_11_22_/0.97)] dark:text-white/85 dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
			role="dialog"
			aria-label="Alertas y notificaciones"
			tabindex="-1"
			transition:fly={{ y: -6, duration: 180 }}
		>
			<div
				class="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-white/[0.08]"
			>
				<h4
					class="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-white/75"
				>
					Alarmas y notificaciones
				</h4>
				<button
					type="button"
					class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10"
					on:click={close}
				>
					Cerrar
				</button>
			</div>
			<div class="max-h-[320px] overflow-y-auto p-3 text-slate-800 dark:text-white/85">
				<p class="m-0 mb-2 text-[11px] text-slate-500 dark:text-white/40">
					Reglas: {$alerts.length} · Eventos: {$alarmEvents.length}
				</p>
				{#if $alerts.length === 0 && $alarmEvents.length === 0}
					<p
						class="m-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/50"
					>
						No hay alertas ni eventos.
					</p>
				{:else}
					{#if $alarmEvents.length > 0}
						<div
							class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35"
						>
							Eventos recibidos
						</div>
						<ul class="m-0 mb-3 list-none space-y-2 p-0">
							{#each $alarmEvents as ev (ev.id)}
								<li>
									<div
										class="flex items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/[0.08] dark:bg-[#121a28] {!ev.read
											? 'ring-1 ring-sky-400/40 dark:ring-sky-500/25'
											: ''}"
									>
										<div class="min-w-0 flex-1 py-px">
											<p
												class="m-0 truncate text-[11px] font-bold leading-tight text-slate-900 dark:text-white"
											>
												{ev.vehicle || 'Unidad'}
											</p>
											<p
												class="m-0 mt-0.5 truncate text-[10px] font-medium text-slate-600 dark:text-slate-400"
											>
												{ev.name || 'Evento'}
											</p>
											<p
												class="m-0 mt-1 flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400"
											>
												<Icon icon="mdi:clock-outline" width={11} aria-hidden="true" />
												<time datetime={ev.at}>{formatAlarmWhen(ev.at)}</time>
											</p>
										</div>
										<button
											type="button"
											class="shrink-0 self-start rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
											on:click={() => removeAlarmEvent(ev.id)}
											aria-label="Eliminar evento"
										>
											<Icon icon="mdi:close" width={11} aria-hidden="true" />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
					{#if $alerts.length > 0}
						<div
							class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/35"
						>
							Alertas configuradas
						</div>
						<ul class="m-0 list-none space-y-1.5 p-0">
							{#each $alerts as al (al.id)}
								<li
									class="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/[0.08] dark:bg-white/[0.03]"
								>
									<div class="flex items-start gap-2">
										<div class="min-w-0 flex-1">
											<p
												class="m-0 truncate text-[12px] font-semibold text-slate-900 dark:text-white"
											>
												{al.name || 'Alerta'}
											</p>
											<p class="m-0 mt-0.5 text-[10px] text-slate-600 dark:text-white/38">
												{al.type === 'zone' ? 'Zona' : 'Ignición'} · {al.units?.length ?? 0} unidad{(al
													.units?.length ?? 0) !== 1
													? 'es'
													: ''}
											</p>
										</div>
										<button
											type="button"
											class="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
											on:click={() => requestDeleteAlert(al)}
											aria-label="Eliminar alerta"
										>
											<Icon icon="mdi:delete-outline" width={11} aria-hidden="true" />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>

<ConfirmModal
	open={!!alertToDelete}
	title="Eliminar alerta"
	confirmLabel="Eliminar"
	cancelLabel="Cancelar"
	destructive
	loading={deleteAlertLoading}
	zIndexClass="z-[200]"
	on:cancel={cancelDeleteAlert}
	on:confirm={confirmDeleteAlert}
>
	{#if alertToDelete}
		<p class="m-0">
			¿Eliminar la alerta <strong>{alertToDelete.name}</strong>? Esta acción no se puede deshacer.
		</p>
	{/if}
</ConfirmModal>
