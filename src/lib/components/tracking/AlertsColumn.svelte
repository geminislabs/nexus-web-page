<script>
	/**
	 * Columna derecha: las alarmas que se dispararon hoy, agrupadas por tipo.
	 * Las reglas y las geocercas (configuración) siguen en el cajón
	 * «Alertas y zonas». Mientras esta columna está abierta, la campana del mapa
	 * se oculta y el contador de sin leer vive aquí.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { alarmEvents, unreadAlarmCount, alertActions } from '$lib/stores/alertStore.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';

	let { onSelectUnit = () => {}, onOpenRules = () => {}, unitIds = new Set() } = $props();

	const GROUPS = [
		{ id: 'zone', label: 'Zonas', icon: 'mdi:hexagon-outline' },
		{ id: 'ignition', label: 'Ignición', icon: 'mdi:engine-outline' }
	];

	const sorted = $derived(
		[...$alarmEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
	);
	const groups = $derived(
		GROUPS.map((g) => ({ ...g, items: sorted.filter((e) => e.type === g.id) })).filter(
			(g) => g.items.length > 0
		)
	);
</script>

<section
	class="nx-glass nx-float flex max-h-full min-h-0 flex-col rounded-[18px] p-3.5"
	aria-labelledby="alerts-col-title"
>
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 id="alerts-col-title" class="m-0 flex items-center gap-2 text-[13px] font-medium">
			Alertas
			{#if $unreadAlarmCount > 0}
				<span
					class="min-w-[18px] rounded-full bg-rose-600 px-1.5 py-[1px] text-center text-[10px] font-bold leading-[14px] text-white"
					aria-label="{$unreadAlarmCount} sin leer">{$unreadAlarmCount}</span
				>
			{/if}
		</h2>
		<span class="text-[11.5px] nx-muted"
			>{$alarmEvents.length === 1 ? '1 hoy' : `${$alarmEvents.length} hoy`}</span
		>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto pr-0.5">
		{#if groups.length === 0}
			<p class="m-0 rounded-xl bg-slate-100 p-3 text-[12px] nx-muted dark:bg-white/[0.04]">
				Sin alertas hoy. Cuando una regla se dispare, aparecerá aquí.
			</p>
		{:else}
			{#each groups as g (g.id)}
				<div class="mb-1.5 mt-1 flex items-center gap-1.5 text-[11.5px] nx-muted">
					<Icon icon={g.icon} class="h-3.5 w-3.5" aria-hidden="true" />
					{g.label} <span class="opacity-70">({g.items.length})</span>
				</div>
				<ul class="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
					{#each g.items as ev (ev.id)}
						{@const canFocus = ev.unitId && unitIds.has(String(ev.unitId))}
						<li>
							<button
								type="button"
								class="flex w-full items-start gap-2.5 rounded-[13px] border border-transparent p-2.5 text-left transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:hover:border-transparent dark:hover:border-white/15 {g.id ===
								'zone'
									? 'bg-amber-400/[0.12]'
									: 'bg-slate-100 dark:bg-white/[0.035]'}"
								disabled={!canFocus}
								onclick={() => canFocus && onSelectUnit(String(ev.unitId))}
								title={canFocus ? 'Ver la unidad en el mapa' : undefined}
							>
								<span
									class="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full {ev.read
										? 'bg-transparent ring-1 ring-slate-400 dark:ring-white/30'
										: g.id === 'zone'
											? 'bg-amber-400'
											: 'bg-slate-500 dark:bg-white/70'}"
									aria-hidden="true"
								></span>
								<span class="min-w-0">
									<span class="block text-[12.5px] leading-snug">
										<span class="font-medium">{ev.vehicle || 'Unidad'}</span>
										<span class="nx-muted">· {ev.name || 'Evento'}</span>
									</span>
									<time class="mt-0.5 block text-[10.5px] nx-muted" datetime={ev.at}
										>{formatAlarmWhen(ev.at)}{ev.read ? '' : ' · sin leer'}</time
									>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</div>

	<div
		class="mt-1 flex items-center gap-1.5 border-t border-slate-200/80 pt-2.5 dark:border-white/[0.07]"
	>
		<button
			type="button"
			class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.06]"
			onclick={onOpenRules}
		>
			<Icon icon="mdi:cog-outline" class="h-3.5 w-3.5" aria-hidden="true" />
			Reglas y zonas
		</button>
		{#if $unreadAlarmCount > 0}
			<button
				type="button"
				class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-medium hover:bg-slate-900/5 focus-visible:outline-2 dark:hover:bg-white/[0.06]"
				onclick={() => alertActions.markAllRead()}
			>
				<Icon icon="mdi:check-all" class="h-3.5 w-3.5" aria-hidden="true" />
				Marcar leídas
			</button>
		{/if}
	</div>
</section>
