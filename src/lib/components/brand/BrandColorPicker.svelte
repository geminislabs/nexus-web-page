<script>
	import Icon from '$lib/components/Icon.svelte';
	import { swatch } from '$lib/actions/cssVars.js';
	import { describeAdjustment, describePair, isHexColor } from '$lib/utils/brandForm.js';

	/** @type {import('$lib/utils/brandForm.js').BrandForm} */
	export let form;
	/** @type {Record<string, string>} */
	export let errors = {};
	export let disabled = false;
	/** La rampa que derivó el servidor del último borrador guardado. */
	/** @type {{ light: Array<{ step: number, color: string }>, dark: Array<{ step: number, color: string }> }} */
	export let ramps = { light: [], dark: [] };
	/** Los cambios que hizo el servidor a las semillas al guardar. */
	/** @type {Array<Record<string, any>>} */
	export let adjustments = [];
	/** Los pares que no llegan a AA (422 `contraste_insuficiente`). */
	/** @type {Array<Record<string, any>>} */
	export let contrastFailures = [];
	/** Si las semillas del formulario difieren de las del borrador guardado. */
	export let seedsDirty = false;

	const seeds = [
		{ key: 'primary', label: 'Color primario', hint: 'Botones, enlaces y elementos activos.' },
		{ key: 'accent', label: 'Color de acento', hint: 'Detalles secundarios. Sin él, el primario.' }
	];

	/** @param {'primary' | 'accent'} key @param {Event} event */
	function onPicker(key, event) {
		form[key] = /** @type {HTMLInputElement} */ (event.currentTarget).value.toLowerCase();
	}

	/** @param {'primary' | 'accent'} key @param {Event} event */
	function onText(key, event) {
		let value = /** @type {HTMLInputElement} */ (event.currentTarget).value.trim();
		if (value && !value.startsWith('#')) value = `#${value}`;
		form[key] = value.toLowerCase();
	}

	function toggleAccent() {
		form.useAccent = !form.useAccent;
		if (form.useAccent && !isHexColor(form.accent)) form.accent = form.primary;
	}
</script>

<section class="space-y-3" aria-labelledby="brand-colors-title">
	<div>
		<h2
			id="brand-colors-title"
			class="admin-display m-0 text-[15px] font-semibold text-slate-900 dark:text-white"
		>
			Colores
		</h2>
		<p class="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-white/45">
			A partir de uno o dos colores, Nexus arma la paleta completa y comprueba que se lea bien en
			modo claro y oscuro.
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each seeds as seed (seed.key)}
			{@const active = seed.key === 'primary' || form.useAccent}
			<div class="block">
				<div class="mb-1 flex items-center justify-between gap-2">
					<label
						for="brand-seed-{seed.key}"
						class="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
					>
						{seed.label}
					</label>
					{#if seed.key === 'accent'}
						<button
							type="button"
							class="text-[11px] font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-300"
							on:click={toggleAccent}
							{disabled}
						>
							{form.useAccent ? 'Quitar' : 'Añadir'}
						</button>
					{/if}
				</div>
				{#if active}
					<div class="flex items-center gap-2">
						<input
							type="color"
							class="h-[38px] w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/[0.04]"
							value={isHexColor(form[seed.key]) ? form[seed.key] : '#000000'}
							aria-label="{seed.label}: selector"
							{disabled}
							on:input={(e) => onPicker(seed.key, e)}
						/>
						<input
							id="brand-seed-{seed.key}"
							type="text"
							inputmode="text"
							maxlength="7"
							spellcheck="false"
							autocomplete="off"
							class="w-full rounded-xl border bg-white px-3 py-2 font-mono text-[13px] text-slate-900 focus:outline-none focus-visible:ring-2 disabled:opacity-60 dark:bg-white/[0.04] dark:text-white {errors[
								seed.key
							]
								? 'border-rose-400 focus-visible:ring-rose-500/40'
								: 'border-slate-200 focus-visible:ring-emerald-500/40 dark:border-white/10'}"
							value={form[seed.key]}
							aria-invalid={errors[seed.key] ? 'true' : undefined}
							aria-describedby="brand-seed-{seed.key}-help"
							{disabled}
							on:input={(e) => onText(seed.key, e)}
						/>
					</div>
				{:else}
					<p
						id="brand-seed-{seed.key}"
						class="m-0 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-[12px] text-slate-400 dark:border-white/10 dark:text-white/35"
					>
						Igual que el primario
					</p>
				{/if}
				<p
					id="brand-seed-{seed.key}-help"
					class="m-0 mt-1 text-[11px] {errors[seed.key]
						? 'font-medium text-rose-600 dark:text-rose-300'
						: 'text-slate-500 dark:text-white/40'}"
				>
					{errors[seed.key] || seed.hint}
				</p>
			</div>
		{/each}
	</div>

	{#if contrastFailures.length}
		<div
			class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
			role="alert"
		>
			<p class="m-0 font-semibold">Estos colores no alcanzan el contraste mínimo:</p>
			<ul class="m-0 mt-1 list-disc pl-4">
				{#each contrastFailures as pair, i (i)}
					<li>{describePair(pair)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div
		class="rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]"
		aria-labelledby="brand-ramp-title"
		role="group"
	>
		<div class="flex items-center justify-between gap-2">
			<p
				id="brand-ramp-title"
				class="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
			>
				Paleta derivada
			</p>
			{#if seedsDirty && ramps.light.length}
				<span class="text-[11px] font-medium text-amber-700 dark:text-amber-300">
					Guarda el borrador para recalcularla
				</span>
			{/if}
		</div>
		{#if ramps.light.length}
			{#each [['light', 'Claro'], ['dark', 'Oscuro']] as [mode, label] (mode)}
				<div class="mt-2 flex items-center gap-2">
					<span class="w-12 shrink-0 text-[11px] text-slate-500 dark:text-white/40">{label}</span>
					<ol class="m-0 flex min-w-0 flex-1 list-none overflow-hidden rounded-lg p-0">
						{#each ramps[mode] as entry (entry.step)}
							<li class="min-w-0 flex-1" title="{entry.step} · {entry.color}">
								<span class="brand-swatch block h-7" use:swatch={entry.color}></span>
								<span class="sr-only">{entry.step}: {entry.color}</span>
							</li>
						{/each}
					</ol>
				</div>
			{/each}
		{:else}
			<p class="m-0 mt-2 text-[12px] text-slate-500 dark:text-white/40">
				Guarda el borrador para ver la paleta que calcula el servidor.
			</p>
		{/if}
	</div>

	{#if adjustments.length}
		<div
			class="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200"
		>
			<Icon icon="mdi:information-outline" width={16} class="mt-0.5 shrink-0" aria-hidden="true" />
			<ul class="m-0 list-none space-y-0.5 p-0">
				{#each adjustments as adjustment, i (i)}
					<li>{describeAdjustment(adjustment)}</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
