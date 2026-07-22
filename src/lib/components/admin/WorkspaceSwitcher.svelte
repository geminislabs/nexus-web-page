<script>
	import Icon from '@iconify/svelte';
	import { workspace, workspaceActions } from '$lib/stores/workspaceStore.js';

	/** Variante visual: navbar admin o compacta en seguimiento. */
	export let compact = false;

	let open = false;

	const options = [
		{
			id: 'tracking',
			label: 'Seguimiento',
			desc: 'Monitoreo en tiempo real',
			icon: 'mdi:earth'
		},
		{
			id: 'admin',
			label: 'Administración',
			desc: 'Usuarios, unidades y dispositivos',
			icon: 'mdi:folder-cog-outline'
		}
	];

	$: current = options.find((o) => o.id === $workspace) ?? options[1];

	function select(id) {
		if (id === 'admin') workspaceActions.goAdmin();
		else workspaceActions.goTracking();
		open = false;
	}

	function onDocClick(e) {
		if (!e.target.closest('[data-workspace-switcher]')) open = false;
	}
</script>

<svelte:window on:click={onDocClick} />

<div class="relative" data-workspace-switcher>
	<button
		type="button"
		class={compact
			? 'flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2.5 text-[12px] font-semibold text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/12 dark:bg-slate-900/90 dark:text-white/80 dark:hover:bg-slate-800'
			: 'flex h-10 min-w-[11.5rem] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[13px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200'}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label="Cambiar espacio de trabajo"
		on:click|stopPropagation={() => (open = !open)}
	>
		<Icon icon={current.icon} width={compact ? 16 : 18} aria-hidden="true" />
		<span class="truncate">{current.label}</span>
		<Icon icon="mdi:chevron-down" width={16} class="shrink-0 opacity-70" aria-hidden="true" />
	</button>

	{#if open}
		<ul
			class="absolute left-0 top-[calc(100%+6px)] z-[80] m-0 w-[17.5rem] list-none overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#0b1220] dark:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
			role="listbox"
			aria-label="Espacios de trabajo"
		>
			{#each options as opt (opt.id)}
				<li role="option" aria-selected={opt.id === $workspace}>
					<button
						type="button"
						class="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors
							{opt.id === $workspace
							? 'bg-emerald-500/12 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100'
							: 'text-slate-700 hover:bg-slate-50 dark:text-white/75 dark:hover:bg-white/[0.05]'}"
						on:click|stopPropagation={() => select(opt.id)}
					>
						<span
							class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
								{opt.id === $workspace
								? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
								: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/50'}"
							aria-hidden="true"
						>
							<Icon icon={opt.icon} width={18} />
						</span>
						<span class="min-w-0">
							<span class="block text-[13px] font-semibold">{opt.label}</span>
							<span class="mt-0.5 block text-[11px] font-medium opacity-65">{opt.desc}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
