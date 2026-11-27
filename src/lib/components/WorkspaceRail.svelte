<script>
	/**
	 * Vista Panel: los dos espacios de trabajo como íconos fijos arriba del riel
	 * (solo master). Reemplaza al selector «Seguimiento ⌄» del título.
	 */
	import Icon from '$lib/components/Icon.svelte';
	import { workspace, workspaceActions } from '$lib/stores/workspaceStore.js';

	const spaces = [
		{ id: 'tracking', label: 'Seguimiento', icon: 'mdi:map-outline' },
		{ id: 'admin', label: 'Administración', icon: 'mdi:folder-cog-outline' }
	];

	function go(id) {
		if (id === $workspace) return;
		if (id === 'admin') workspaceActions.goAdmin();
		else workspaceActions.goTracking();
	}
</script>

<div class="flex flex-col items-center gap-1" role="group" aria-label="Espacio de trabajo">
	{#each spaces as s (s.id)}
		{@const on = $workspace === s.id}
		<button
			type="button"
			class="relative flex h-12 w-12 items-center justify-center rounded-[14px] border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60
				{on
				? 'border-slate-900 bg-slate-900 text-white dark:border-white/15 dark:bg-white/[0.1] dark:text-white'
				: 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/85'}"
			aria-current={on ? 'page' : undefined}
			aria-label={s.label}
			title={s.label}
			on:click={() => go(s.id)}
		>
			{#if on}
				<span
					class="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-slate-900 dark:bg-white"
					aria-hidden="true"
				></span>
			{/if}
			<Icon icon={s.icon} class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
		</button>
	{/each}
</div>
