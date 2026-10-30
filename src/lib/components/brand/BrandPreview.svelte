<script>
	import Icon from '$lib/components/Icon.svelte';
	import { brandVars } from '$lib/actions/cssVars.js';
	import { onDestroy } from 'svelte';
	import { PREVIEW_DELAY_MS, urlProblem } from '$lib/utils/brandForm.js';

	/** @type {import('$lib/utils/brandForm.js').BrandForm} */
	export let form;
	/** Los tokens del borrador guardado (o de lo publicado), por modo. */
	/** @type {{ light: Record<string, string> | null, dark: Record<string, string> | null }} */
	export let tokens = { light: null, dark: null };

	/** Si los tokens son de un borrador (si no, de lo publicado). */
	export let hasDraft = false;

	/** @type {'light' | 'dark'} */
	let mode = 'light';

	$: name = form.brand_name.trim() || 'Tu marca';
	/** @param {string} url */
	const usable = (url) => {
		const value = url?.trim() ?? '';
		return value && !urlProblem(value) ? value : null;
	};
	// Las imágenes se piden tras una pausa al escribir, igual que las miniaturas.
	/** @type {{ light: string | null, dark: string | null } | null} */
	let logos = null;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;
	$: wantedLogos = { light: usable(form.logo_url), dark: usable(form.logo_dark_url) };
	$: scheduleLogos(wantedLogos);
	/** @param {{ light: string | null, dark: string | null }} next */
	function scheduleLogos(next) {
		clearTimeout(timer);
		if (logos === null) logos = next;
		else timer = setTimeout(() => (logos = next), PREVIEW_DELAY_MS);
	}
	onDestroy(() => clearTimeout(timer));

	$: lightLogo = logos?.light ?? null;
	$: darkLogo = logos?.dark ?? lightLogo;
	$: logo = mode === 'dark' ? darkLogo : lightLogo;
	$: support = form.support_email.trim() || 'soporte@tumarca.com';

	/** Si la imagen no carga, la maqueta muestra el nombre: igual que la app real (D1). */
	/** @type {Record<string, boolean>} */
	let broken = {};
	// Reactivas, no una función: la plantilla tiene que volver a pintarse cuando
	// cambia `broken`, y Svelte solo lo sabe si lo lee aquí.
	$: showLogo = Boolean(logo) && broken[logo] !== true;
	$: showLightLogo = Boolean(lightLogo) && broken[lightLogo] !== true;
	/** @param {Event} event */
	function markBroken(event) {
		const src = /** @type {HTMLImageElement} */ (event.currentTarget).getAttribute('src');
		if (src) broken = { ...broken, [src]: true };
	}

	// Los mismos fondos contra los que el servidor mide el contraste
	// (`FONDOS` en `marca_tema.py`), para que la maqueta no mienta.
	const surfaces = {
		light: { page: 'bg-[#f1f5f9]', card: 'bg-[#ffffff]', side: 'bg-[#f8fafc]' },
		dark: { page: 'bg-[#020617]', card: 'bg-[#0f172a]', side: 'bg-[#080d1a]' }
	};
	$: s = surfaces[mode];
	$: text = mode === 'dark' ? 'text-slate-100' : 'text-slate-900';
	$: muted = mode === 'dark' ? 'text-slate-400' : 'text-slate-500';
	$: field = mode === 'dark' ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white';

	$: modeTokens = tokens[mode];
	$: noTokens = !tokens.light && !tokens.dark;
</script>

<section class="brand-preview-motion space-y-3" aria-labelledby="brand-preview-title">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<h2
				id="brand-preview-title"
				class="admin-display m-0 text-[15px] font-semibold text-slate-900 dark:text-white"
			>
				Vista previa
			</h2>
			<p class="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-white/45">
				{noTokens
					? 'Con los colores de Nexus hasta que guardes el primer borrador.'
					: hasDraft
						? 'Con los colores del borrador. Nadie más la ve hasta que publiques.'
						: 'Con los colores publicados, los que ven tus usuarios.'}
			</p>
		</div>
		<div
			class="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-white/10"
			role="radiogroup"
			aria-label="Modo de la vista previa"
		>
			{#each [['light', 'Claro', 'mdi:white-balance-sunny'], ['dark', 'Oscuro', 'mdi:weather-night']] as [value, label, icon] (value)}
				<button
					type="button"
					role="radio"
					aria-checked={mode === value}
					class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors {mode ===
					value
						? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
						: 'text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white'}"
					on:click={() => (mode = /** @type {'light' | 'dark'} */ (value))}
				>
					<Icon {icon} width={14} aria-hidden="true" />
					{label}
				</button>
			{/each}
		</div>
	</div>

	<div class="brand-preview grid gap-3 xl:grid-cols-[1.1fr_1fr]" use:brandVars={modeTokens}>
		<!-- Login -->
		<figure class="m-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
			<div class="flex min-h-[260px] items-center justify-center p-5 {s.page}">
				<div class="w-full max-w-[240px] rounded-2xl p-5 shadow-sm {s.card} {text}">
					<div class="mb-4 flex h-9 items-center justify-center">
						{#if showLogo}
							<img
								src={logo}
								alt={name}
								class="max-h-9 max-w-[160px] object-contain"
								referrerpolicy="no-referrer"
								on:error={markBroken}
							/>
						{:else}
							<span class="admin-display truncate text-[16px] font-bold">{name}</span>
						{/if}
					</div>
					<p class="m-0 text-center text-[13px] font-semibold">Inicia sesión</p>
					<div class="mt-3 space-y-2" aria-hidden="true">
						<div class="h-8 rounded-lg border {field}"></div>
						<div class="h-8 rounded-lg border {field}"></div>
					</div>
					<div
						class="mt-3 flex h-8 items-center justify-center rounded-lg bg-[var(--color-brand-primary,#059669)] text-[12px] font-semibold text-[var(--color-brand-on-primary,#ffffff)]"
					>
						Entrar
					</div>
					<p
						class="m-0 mt-3 text-center text-[11px] font-medium text-[var(--color-brand-link,#047857)] underline"
					>
						¿Olvidaste tu contraseña?
					</p>
				</div>
			</div>
			<figcaption
				class="border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/10 dark:text-white/40"
			>
				Pantalla de inicio de sesión
			</figcaption>
		</figure>

		<!-- Sidebar -->
		<figure class="m-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
			<div class="flex min-h-[260px] {s.page}">
				<div class="flex w-[150px] shrink-0 flex-col gap-1 p-3 {s.side} {text}">
					<div class="mb-2 flex h-7 items-center">
						{#if showLogo}
							<img
								src={logo}
								alt={name}
								class="max-h-7 max-w-[120px] object-contain"
								referrerpolicy="no-referrer"
								on:error={markBroken}
							/>
						{:else}
							<span class="admin-display truncate text-[13px] font-bold">{name}</span>
						{/if}
					</div>
					{#each [['mdi:view-dashboard-outline', 'Dashboard', true], ['mdi:car-side', 'Unidades', false], ['mdi:map-marker-radius-outline', 'Seguimiento', false]] as [icon, label, active] (label)}
						<div
							class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold {active
								? 'bg-[var(--color-brand-primary,#059669)] text-[var(--color-brand-on-primary,#ffffff)]'
								: muted}"
						>
							<Icon {icon} width={14} aria-hidden="true" />
							{label}
						</div>
					{/each}
				</div>
				<div class="flex flex-1 flex-col gap-2 p-3 {text}">
					<div class="flex items-center gap-2">
						<span
							class="h-2 w-2 rounded-full bg-[var(--color-brand-accent,#059669)]"
							aria-hidden="true"
						></span>
						<span class="text-[11px] font-semibold">12 unidades en línea</span>
					</div>
					<div class="flex-1 rounded-xl {s.card}"></div>
					<span
						class="self-start rounded-md bg-[var(--color-brand-accent,#059669)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand-on-accent,#ffffff)]"
					>
						Nuevo
					</span>
				</div>
			</div>
			<figcaption
				class="border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/10 dark:text-white/40"
			>
				Menú de la aplicación
			</figcaption>
		</figure>
	</div>

	<!-- Correo: los clientes de correo no tienen modo oscuro propio; siempre claro. -->
	<figure
		class="m-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10"
		use:brandVars={tokens.light}
	>
		<div class="bg-[#f1f5f9] p-4 text-slate-900">
			<div class="mx-auto max-w-[420px] overflow-hidden rounded-xl bg-white shadow-sm">
				<div class="flex h-12 items-center border-b border-slate-100 px-4">
					{#if showLightLogo}
						<img
							src={lightLogo}
							alt={name}
							class="max-h-7 max-w-[140px] object-contain"
							referrerpolicy="no-referrer"
							on:error={markBroken}
						/>
					{:else}
						<span class="admin-display text-[14px] font-bold">{name}</span>
					{/if}
				</div>
				<div class="space-y-2 px-4 py-4 text-[12px] leading-relaxed">
					<p class="m-0 font-semibold">Verifica tu correo</p>
					<p class="m-0 text-slate-600">Escribe este código en {name} para activar tu cuenta:</p>
					<p
						class="m-0 rounded-lg bg-[var(--color-brand-50,#ecfdf5)] py-2 text-center font-mono text-[18px] font-bold tracking-[0.3em] text-[var(--color-brand-900,#064e3b)]"
					>
						482913
					</p>
					<p class="m-0 text-slate-600">
						¿Dudas? Responde a este correo o escribe a
						<span class="font-medium text-[var(--color-brand-link,#047857)] underline"
							>{support}</span
						>.
					</p>
				</div>
				<div class="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">
					{name} ·
					<span class="text-[var(--color-brand-link,#047857)] underline">Términos y privacidad</span
					>
				</div>
			</div>
		</div>
		<figcaption
			class="border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/10 dark:text-white/40"
		>
			Correo de verificación
		</figcaption>
	</figure>
</section>

<style>
	/* Al cambiar un color o el modo, la maqueta se transforma hacia el nuevo
	   en lugar de saltar, así se ve qué parte cambió. */
	.brand-preview-motion :global(figure *) {
		transition:
			background-color 300ms ease-out,
			color 300ms ease-out,
			border-color 300ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.brand-preview-motion :global(figure *) {
			transition: none;
		}
	}
</style>
