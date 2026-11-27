<script>
	/**
	 * Paleta de comandos (⌘K / Ctrl K) de la vista Panel: escribir «kia»,
	 * «alertas» o «trayectos» y saltar ahí sin buscar en menús.
	 *
	 * Los comandos los arma la página: { id, group, label, hint?, icon, color?, keywords?, run }.
	 */
	import { tick } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { open = $bindable(false), commands = [] } = $props();

	let query = $state('');
	let active = $state(0);
	/** @type {HTMLInputElement | null} */
	let input = $state(null);
	/** @type {HTMLElement | null} */
	let list = $state(null);

	/** Minúsculas y sin acentos, para que «ignicion» encuentre «Ignición». */
	const norm = (/** @type {string} */ s) =>
		String(s || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '');

	/** Puntaje simple: empieza con > palabra que empieza con > contiene; 0 = fuera. */
	function score(/** @type {any} */ c, /** @type {string} */ q) {
		if (!q) return 1;
		const label = norm(c.label);
		const hay = `${label} ${norm(c.hint)} ${norm(c.group)} ${norm((c.keywords || []).join(' '))}`;
		const terms = q.split(/\s+/).filter(Boolean);
		if (!terms.every((t) => hay.includes(t))) return 0;
		if (label.startsWith(q)) return 3;
		if (label.split(/\s+/).some((w) => w.startsWith(terms[0]))) return 2;
		return 1;
	}

	const results = $derived.by(() => {
		const q = norm(query.trim());
		return commands
			.map((c, i) => ({ c, s: score(c, q), i }))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s || a.i - b.i)
			.slice(0, 40)
			.map((x) => x.c);
	});

	$effect(() => {
		if (open) {
			query = '';
			active = 0;
			tick().then(() => input?.focus());
		}
	});
	$effect(() => {
		// Al cambiar la búsqueda, la selección vuelve arriba.
		void query;
		active = 0;
	});

	function close() {
		open = false;
	}

	function runAt(/** @type {number} */ i) {
		const c = results[i];
		if (!c) return;
		close();
		c.run();
	}

	function onKeydown(/** @type {KeyboardEvent} */ e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			// Que el Escape global de la página no cierre además los paneles abiertos.
			e.stopPropagation();
			close();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(results.length - 1, active + 1);
			scrollActive();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(0, active - 1);
			scrollActive();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			runAt(active);
		}
	}

	function scrollActive() {
		tick().then(() =>
			list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
		);
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 px-4 pt-[14vh] backdrop-blur-[2px]"
		onclick={(e) => e.target === e.currentTarget && close()}
	>
		<div
			class="nx-glass w-full max-w-[560px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_60px_rgb(0_0_0/0.35)] dark:bg-[#15171b]"
			role="dialog"
			aria-modal="true"
			aria-label="Buscar y comandos"
		>
			<div
				class="flex items-center gap-2.5 border-b border-slate-200/80 px-4 dark:border-white/[0.07]"
			>
				<Icon icon="mdi:magnify" class="nx-muted h-5 w-5 shrink-0" aria-hidden="true" />
				<input
					bind:this={input}
					bind:value={query}
					onkeydown={onKeydown}
					type="text"
					placeholder="Busca una unidad, un panel o una acción…"
					class="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-slate-400 dark:placeholder:text-white/35"
					role="combobox"
					aria-expanded="true"
					aria-controls="nx-command-list"
					aria-activedescendant={results[active] ? `nx-cmd-${active}` : undefined}
				/>
				<kbd
					class="nx-mono nx-muted rounded border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-white/10"
					>esc</kbd
				>
			</div>
			<ul
				bind:this={list}
				id="nx-command-list"
				class="m-0 max-h-[50vh] list-none overflow-y-auto p-1.5"
				role="listbox"
				aria-label="Resultados"
			>
				{#if results.length === 0}
					<li class="nx-muted px-3 py-6 text-center text-[13px]">Nada coincide con «{query}».</li>
				{/if}
				{#each results as c, i (c.id)}
					{@const prevGroup = i > 0 ? results[i - 1].group : null}
					{#if c.group !== prevGroup}
						<li class="nx-label px-3 pb-1 pt-2.5" role="presentation">{c.group}</li>
					{/if}
					<li
						id="nx-cmd-{i}"
						data-index={i}
						role="option"
						aria-selected={i === active}
						class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 {i === active
							? 'bg-slate-900/[0.06] dark:bg-white/[0.08]'
							: ''}"
						onmousemove={() => (active = i)}
						onclick={() => runAt(i)}
						onkeydown={() => {}}
					>
						<Icon
							icon={c.icon}
							class="h-[18px] w-[18px] shrink-0 {c.color || 'nx-muted'}"
							aria-hidden="true"
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[13px] font-medium">{c.label}</span>
							{#if c.hint}<span class="nx-muted block truncate text-[11px]">{c.hint}</span>{/if}
						</span>
						{#if i === active}
							<Icon
								icon="mdi:keyboard-return"
								class="nx-muted h-4 w-4 shrink-0"
								aria-hidden="true"
							/>
						{/if}
					</li>
				{/each}
			</ul>
			<div
				class="nx-muted flex items-center gap-3 border-t border-slate-200/80 px-4 py-2 text-[10.5px] dark:border-white/[0.07]"
			>
				<span><kbd class="nx-mono">↑↓</kbd> moverse</span>
				<span><kbd class="nx-mono">↵</kbd> abrir</span>
				<span class="ml-auto"
					><kbd class="nx-mono">⌘K</kbd> / <kbd class="nx-mono">Ctrl K</kbd></span
				>
			</div>
		</div>
	</div>
{/if}
