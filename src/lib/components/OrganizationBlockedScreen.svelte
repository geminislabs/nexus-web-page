<script>
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { theme } from '$lib/stores/themeStore.js';
	import { organizations } from '$lib/stores/organizationStore.js';
	import {
		activeOrganizationRow,
		getBillingUrl,
		organizationBlockCopy,
		switchableOrganizations
	} from '$lib/stores/organizationAccessStore.js';
	import {
		logoutSession,
		refreshOrganizationAccess,
		switchOrganization
	} from '$lib/services/sessionService.js';

	/** @type {{ block: import('$lib/stores/organizationAccessStore.js').OrganizationBlock }} */
	let { block } = $props();

	let retrying = $state(false);
	let stillBlocked = $state(false);

	const active = $derived.by(() => {
		void $organizations;
		return activeOrganizationRow();
	});
	const copy = $derived(organizationBlockCopy(block, active?.name));
	const others = $derived(
		switchableOrganizations(
			$organizations,
			active ? String(active.organization_id) : block.organizationId
		)
	);
	const isLight = $derived($theme === 'light');

	async function retry() {
		if (retrying) return;
		retrying = true;
		stillBlocked = false;
		try {
			// Si ya da acceso, el store se limpia y el layout vuelve a montar el
			// dashboard; aquí sólo queda avisar si sigue igual.
			stillBlocked = !(await refreshOrganizationAccess());
		} finally {
			retrying = false;
		}
	}

	async function logout() {
		await logoutSession();
		goto('/login');
	}
</script>

<main
	class="flex min-h-screen items-center justify-center px-4 py-10 {isLight
		? 'bg-slate-100 text-slate-900'
		: 'bg-[#1b2030] text-white'}"
>
	<section
		class="w-full max-w-md rounded-[1.25rem] border px-6 pb-6 pt-7 shadow-xl {isLight
			? 'border-slate-200/80 bg-white'
			: 'border-white/[0.1] bg-[#2a3040]'}"
		aria-labelledby="org-blocked-title"
		aria-describedby="org-blocked-message"
	>
		<div
			class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full [&_svg]:h-7 [&_svg]:w-7 {isLight
				? 'bg-amber-100 text-amber-600'
				: 'bg-amber-400/15 text-amber-300'}"
			aria-hidden="true"
		>
			<Icon icon="mdi:alert-circle-outline" />
		</div>

		<h1 id="org-blocked-title" class="m-0 text-center text-xl font-bold leading-snug">
			{copy.title}
		</h1>
		<p
			id="org-blocked-message"
			class="mb-0 mt-3 text-center text-[15px] leading-relaxed {isLight
				? 'text-slate-700'
				: 'text-white/85'}"
		>
			{copy.message}
		</p>
		{#if copy.hint}
			<p
				class="mb-0 mt-2 text-center text-sm leading-relaxed {isLight
					? 'text-slate-500'
					: 'text-white/60'}"
			>
				{copy.hint}
			</p>
		{/if}

		<div class="mt-6 flex flex-col gap-3">
			{#if copy.showBilling}
				<a
					href={getBillingUrl()}
					class="nexus-glow flex min-h-[3rem] w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--color-brand-cta-from)_0%,var(--color-brand-cta-to)_100%)] px-4 text-base font-semibold text-brand-on-cta no-underline shadow-lg transition-opacity hover:opacity-90"
				>
					Ir a facturación
				</a>
			{/if}

			<button
				type="button"
				class="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-full border-0 text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 [&_svg]:h-5 [&_svg]:w-5 {isLight
					? 'bg-slate-200 text-slate-900'
					: 'bg-white/15 text-white'}"
				onclick={retry}
				disabled={retrying}
			>
				<Icon icon="mdi:refresh" aria-hidden="true" />
				{retrying ? 'Comprobando…' : 'Reintentar'}
			</button>
			{#if stillBlocked}
				<p
					class="m-0 text-center text-sm {isLight ? 'text-slate-500' : 'text-white/60'}"
					role="status"
				>
					Sigue sin servicio. Si acabas de pagar, espera un momento y vuelve a intentarlo.
				</p>
			{/if}
		</div>

		{#if others.length > 0}
			<div class="mt-6 border-t pt-5 {isLight ? 'border-slate-200' : 'border-white/10'}">
				<h2
					class="m-0 mb-3 flex items-center gap-2 text-sm font-semibold [&_svg]:h-4 [&_svg]:w-4 {isLight
						? 'text-slate-600'
						: 'text-white/70'}"
				>
					<Icon icon="mdi:swap-horizontal" aria-hidden="true" />
					Cambiar de organización
				</h2>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each others as org (org.organization_id)}
						<li>
							<button
								type="button"
								class="w-full rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition-colors {isLight
									? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
									: 'border-white/10 bg-white/5 hover:bg-white/10'}"
								onclick={() => switchOrganization(String(org.organization_id))}
							>
								{org.name}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<button
			type="button"
			class="mt-6 flex w-full items-center justify-center gap-2 border-0 bg-transparent text-sm font-semibold [&_svg]:h-4 [&_svg]:w-4 {isLight
				? 'text-slate-600 hover:text-slate-900'
				: 'text-white/70 hover:text-white'}"
			onclick={logout}
		>
			<Icon icon="mdi:logout" aria-hidden="true" />
			Cerrar sesión
		</button>
	</section>
</main>
