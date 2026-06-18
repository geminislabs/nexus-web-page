<script>
	import Icon from '@iconify/svelte';

	/** @type {Array<{ id: string, type: string, value: string, date: string, unitName: string }>} */
	export let offenders = [];
</script>

{#if offenders?.length}
	<div
		role="region"
		class="mb-5 flex flex-col items-stretch justify-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1a2332]/80 dark:shadow-none lg:mb-6"
		aria-labelledby="report-offenders-heading"
	>
		<h2
			id="report-offenders-heading"
			class="m-0 mb-3 text-base font-semibold text-slate-900 dark:text-white"
		>
			Excepciones Detectadas
		</h2>

		<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
			{#each offenders as o (o.id)}
				<li
					class="flex items-center gap-3 rounded-[10px] border border-red-500/25 bg-red-50 px-3 py-3 dark:border-red-500/30 dark:bg-red-500/10"
				>
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 dark:bg-red-500/20"
						aria-hidden="true"
					>
						<Icon icon="mdi:alert" width={16} class="text-red-500 dark:text-red-400" />
					</div>

					<div class="min-w-0 flex-1">
						<p class="m-0 text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">
							{o.type}
						</p>
						<p class="m-0 mt-1 text-[11px] leading-snug text-slate-500 dark:text-white/55">
							{o.date} • {o.unitName}
						</p>
					</div>

					<span class="shrink-0 text-[13px] font-bold tabular-nums text-red-600 dark:text-red-400">
						{o.value}
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
