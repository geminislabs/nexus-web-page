<script>
	import Icon from '@iconify/svelte';
	import { fly } from 'svelte/transition';

	export let open = false;
	export let units = [];
	export let selectedIds = new Set();
	export let onToggle = () => {};
	export let onClose = () => {};

	let searchQuery = '';

	$: filtered = searchQuery.trim()
		? units.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
		: units;

	$: if (!open) searchQuery = '';
</script>

{#if open}
	<div
		class="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 dark:bg-black/50"
		role="presentation"
		on:click|self={onClose}
		on:keydown={(e) => e.key === 'Escape' && onClose()}
	>
		<div
			class="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c1829] sm:rounded-2xl"
			style="max-height: min(70vh, 480px); margin-bottom: calc(56px + env(safe-area-inset-bottom, 0px));"
			role="dialog"
			aria-modal="true"
			aria-labelledby="unit-picker-title"
			transition:fly={{ y: 24, duration: 200 }}
		>
			<!-- Header -->
			<div class="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-white/10">
				<div class="mb-2.5 flex items-center justify-between">
					<div>
						<h2
							id="unit-picker-title"
							class="m-0 text-[15px] font-bold text-slate-900 dark:text-white"
						>
							Unidades
						</h2>
						<p class="m-0 text-[11px] text-slate-500 dark:text-white/40">
							{selectedIds.size}/3 seleccionada{selectedIds.size !== 1 ? 's' : ''}
						</p>
					</div>
					<button
						type="button"
						class="text-[14px] font-semibold text-cyan-700 dark:text-cyan-400"
						on:click={onClose}
					>
						Listo
					</button>
				</div>
				<div class="relative">
					<Icon
						icon="mdi:magnify"
						width={16}
						class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35"
						aria-hidden="true"
					/>
					<input
						type="search"
						bind:value={searchQuery}
						placeholder="Buscar unidad…"
						class="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-cyan-500/50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30"
					/>
				</div>
			</div>

			<!-- Lista -->
			<ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto overscroll-contain p-2">
				{#if filtered.length === 0}
					<li class="py-6 text-center text-sm text-slate-400 dark:text-white/40">
						{searchQuery ? 'Sin resultados' : 'No hay unidades disponibles'}
					</li>
				{:else}
					{#each filtered as u (u.id)}
						{@const selected = selectedIds.has(u.id)}
						{@const atLimit = !selected && selectedIds.size >= 3}
						<li>
							<button
								type="button"
								class="mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors last:mb-0
									{selected ? 'bg-cyan-500/15 dark:bg-cyan-500/15' : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'}
									{atLimit ? 'cursor-not-allowed opacity-35' : ''}"
								disabled={atLimit}
								on:click={() => onToggle(u.id)}
								aria-pressed={selected}
							>
								<div
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors {selected
										? 'border-cyan-500 bg-cyan-500 dark:border-cyan-400'
										: 'border-slate-300 bg-white dark:border-white/20 dark:bg-white/[0.04]'}"
									aria-hidden="true"
								>
									{#if selected}<Icon icon="mdi:check" width={13} class="text-white" />{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
										{u.name}
									</p>
									{#if !u.deviceId}
										<p class="m-0 text-[10px] text-amber-600 dark:text-amber-400/70">
											Sin dispositivo
										</p>
									{/if}
								</div>
								{#if selected}
									<span class="shrink-0 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400"
										>✓</span
									>
								{/if}
							</button>
						</li>
					{/each}
				{/if}
			</ul>

			<!-- Footer -->
			<div class="shrink-0 border-t border-slate-200 px-4 py-2.5 dark:border-white/[0.07]">
				<p class="m-0 text-center text-[11px] text-slate-500 dark:text-white/30">
					{#if selectedIds.size >= 3}
						Límite alcanzado · deselecciona una para cambiar
					{:else}
						Selecciona hasta {3 - selectedIds.size} unidad{3 - selectedIds.size !== 1 ? 'es' : ''} más
					{/if}
				</p>
			</div>
		</div>
	</div>
{/if}
