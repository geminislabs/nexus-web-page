<script>
	import { getLegalLinks } from '$lib/constants/legal.js';

	/** @type {'compact' | 'list'} */
	export let variant = 'compact';

	const links = getLegalLinks();

	const linkClass =
		'rounded-sm font-medium text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-200 dark:hover:text-white';
</script>

{#if variant === 'list'}
	<nav aria-label="Documentos legales" class="space-y-1">
		<p
			class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
		>
			Legal
		</p>
		<ul class="m-0 list-none space-y-0.5 p-0">
			{#each links as link (link.id)}
				<li>
					<a
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-h-[2.5rem] items-center rounded-lg px-3 py-2 text-sm {linkClass} no-underline hover:bg-slate-100 dark:hover:bg-white/[0.06]"
					>
						{link.label}
						<span class="sr-only"> (se abre en una pestaña nueva)</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{:else}
	<nav
		aria-label="Documentos legales"
		class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[0.75rem] leading-snug"
	>
		{#each links as link, i (link.id)}
			{#if i > 0}
				<span class="select-none text-slate-400 dark:text-white/35" aria-hidden="true">·</span>
			{/if}
			<a
				href={link.href}
				target="_blank"
				rel="noopener noreferrer"
				class="{linkClass} no-underline"
			>
				{link.label}
				<span class="sr-only"> (se abre en una pestaña nueva)</span>
			</a>
		{/each}
	</nav>
{/if}
