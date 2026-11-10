<script>
	import Icon from '$lib/components/Icon.svelte';
	import { switchOrganization } from '$lib/services/sessionService.js';
	import {
		organizations,
		activeOrganizationId,
		isActiveOrganization
	} from '$lib/stores/organizationStore.js';
	import { organizationStatusLabel } from '$lib/stores/organizationAccessStore.js';

	/**
	 * Cambiar de organización, en Ajustes (móvil) y en el menú de la cuenta
	 * (escritorio). Sólo aparece con más de una organización. Cambiar recarga la
	 * página: casi todo lo que carga el dashboard está acotado a la organización
	 * activa en varios stores y servicios.
	 *
	 * @type {{ compact?: boolean }}
	 */
	let { compact = false } = $props();

	const ROLE_LABELS = {
		owner: 'Owner',
		admin: 'Admin',
		billing: 'Facturación',
		member: 'Miembro'
	};
</script>

{#if $organizations.length > 1}
	<div aria-labelledby="org-switcher-heading">
		<h3
			id="org-switcher-heading"
			class={compact
				? 'm-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/40'
				: 'mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40'}
		>
			Organización
		</h3>
		<ul
			class="m-0 list-none overflow-hidden border border-slate-200 bg-white p-0 dark:border-white/10 dark:bg-white/[0.03] {compact
				? 'rounded-xl'
				: 'rounded-[14px]'}"
		>
			{#each $organizations as org (org.organization_id)}
				{@const isActive = isActiveOrganization(org, $activeOrganizationId, $organizations)}
				{@const status = organizationStatusLabel(org)}
				<li class="border-b border-slate-200 last:border-b-0 dark:border-white/[0.06]">
					<button
						type="button"
						class="flex w-full items-center justify-between gap-3 border-0 bg-transparent text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {compact
							? 'px-2.5 py-2'
							: 'px-4 py-3.5'} {isActive
							? 'cursor-default'
							: 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.05]'}"
						aria-current={isActive ? 'true' : undefined}
						disabled={isActive}
						onclick={(e) => {
							e.stopPropagation();
							switchOrganization(String(org.organization_id));
						}}
					>
						<span class="min-w-0 flex-1">
							<span
								class="block truncate font-medium text-slate-900 dark:text-white {compact
									? 'text-[12px]'
									: 'text-base'}"
							>
								{org.name}
							</span>
							<span
								class="mt-0.5 block text-slate-600 dark:text-white/45 {compact
									? 'text-[10px]'
									: 'text-xs'}"
							>
								{ROLE_LABELS[org.role] ?? org.role}{#if status}&nbsp;·&nbsp;<span
										class="font-semibold text-amber-600 dark:text-amber-300">{status}</span
									>{/if}
							</span>
						</span>
						{#if isActive}
							<span
								class="flex shrink-0 items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 {compact
									? 'text-[10px] [&_svg]:h-3.5 [&_svg]:w-3.5'
									: 'text-xs [&_svg]:h-4 [&_svg]:w-4'}"
							>
								<Icon icon="mdi:check-circle" aria-hidden="true" />
								Activa
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}
