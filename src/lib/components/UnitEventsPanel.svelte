<script>
	import Icon from '@iconify/svelte';
	import { eventActions, unitEvents, loadingEvents, eventsError } from '$lib/stores/eventStore.js';
	import {
		formatEventType,
		eventIcon,
		eventColorClass,
		formatEventDate
	} from '$lib/utils/eventUtils.js';

	export let unit = null;
	/** Recarga al entrar al panel (misma unidad incluida). */
	export let panelActive = false;
	export let onBack = () => {};

	let lastLoadKey = '';

	async function refresh() {
		if (!unit?.id) return;
		await eventActions.loadForUnit(unit.id);
	}

	$: {
		const key = panelActive ? `${unit?.id || ''}:events` : '';
		if (key && key !== lastLoadKey) {
			lastLoadKey = key;
			refresh();
		}
		if (!panelActive) lastLoadKey = '';
	}
</script>

<div class="flex max-h-[70vh] flex-col bg-white dark:bg-[#0c1829]">
	<div class="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10"
			on:click={onBack}
			aria-label="Volver"
		>
			<Icon icon="mdi:arrow-left" width={20} />
		</button>
		<div class="flex-1">
			<p class="m-0 text-sm font-semibold text-slate-900 dark:text-white">Eventos (48h)</p>
			<p class="m-0 text-[11px] text-slate-500 dark:text-white/50">{unit?.name || 'Unidad'}</p>
		</div>
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-white/50 dark:hover:bg-white/10"
			on:click={refresh}
			aria-label="Actualizar eventos"
			disabled={$loadingEvents}
		>
			<Icon icon="mdi:refresh" width={18} class={$loadingEvents ? 'animate-spin' : ''} />
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
		{#if $loadingEvents}
			<div class="flex h-40 items-center justify-center">
				<div
					class="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
				></div>
			</div>
		{:else if $eventsError}
			<div class="flex h-40 flex-col items-center justify-center gap-3 px-4 text-center">
				<Icon icon="mdi:alert-circle-outline" width={32} class="text-amber-400" />
				<p class="m-0 text-xs text-slate-500 dark:text-white/60">{$eventsError}</p>
				<button
					type="button"
					class="rounded-lg bg-cyan-600/20 px-4 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-300"
					on:click={refresh}
				>
					Reintentar
				</button>
			</div>
		{:else if $unitEvents.length === 0}
			<div class="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
				<Icon icon="mdi:bell-off-outline" width={36} class="text-slate-300 dark:text-white/20" />
				<p class="m-0 text-sm font-medium text-slate-700 dark:text-white/80">
					Sin eventos recientes
				</p>
				<p class="m-0 text-xs text-slate-500 dark:text-white/45">
					Las últimas 48 h están despejadas
				</p>
			</div>
		{:else}
			<ul class="m-0 list-none p-3">
				{#each $unitEvents as event (event.id)}
					<li class="border-b border-slate-100 last:border-0 dark:border-white/[0.06]">
						<div class="flex gap-3 py-3">
							<div class="flex flex-col items-center">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full border {eventColorClass(
										event.eventType
									)}"
								>
									<Icon icon={eventIcon(event.eventType)} width={16} />
								</div>
								<div class="mt-1 w-px flex-1 min-h-[16px] bg-slate-200 dark:bg-white/10"></div>
							</div>
							<div class="min-w-0 flex-1">
								<p class="m-0 text-[13px] font-semibold text-slate-900 dark:text-white">
									{formatEventType(event.eventType)}
								</p>
								<p
									class="m-0 mt-0.5 flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400/80"
								>
									<Icon icon="mdi:clock-outline" width={12} />
									{formatEventDate(event.occurredAt)}
								</p>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
