<script>
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import { PREVIEW_DELAY_MS, urlProblem } from '$lib/utils/brandForm.js';
	import BrandTextField from './BrandTextField.svelte';

	/** @type {import('$lib/utils/brandForm.js').BrandForm} */
	export let form;
	/** @type {Record<string, string>} */
	export let errors = {};
	export let disabled = false;
	/**
	 * Si cada imagen cargó: `'ok' | 'error' | 'loading'`, o ausente si el campo
	 * está vacío o la URL no es válida. La pantalla lo usa para avisar al
	 * guardar, sin bloquear (D1: el logo lo aloja el partner).
	 * @type {Record<string, 'ok' | 'error' | 'loading'>}
	 */
	export let imageStatus = {};

	const fields = [
		{
			key: 'logo_url',
			label: 'Logo (modo claro)',
			hint: 'PNG, WebP o SVG en tu propio servidor. Lo pide el navegador de cada usuario.',
			required: true,
			placeholder: 'https://tumarca.com/logo.png',
			surface: 'bg-white'
		},
		{
			key: 'logo_dark_url',
			label: 'Logo (modo oscuro)',
			hint: 'Opcional. Sin él, el modo oscuro usa el logo claro.',
			required: false,
			placeholder: 'https://tumarca.com/logo-blanco.png',
			surface: 'bg-[#020617]'
		},
		{
			key: 'favicon_url',
			label: 'Favicon',
			hint: 'Opcional. El ícono de la pestaña del navegador.',
			required: false,
			placeholder: 'https://tumarca.com/favicon.png',
			surface: 'bg-white'
		}
	];

	/**
	 * La URL que se pide para cada miniatura. Solo si pasa la regla (nunca
	 * http:// ni una IP) y después de una pausa al escribir: sin ella, cada
	 * tecla pediría al servidor del partner una URL a medias.
	 * @type {Record<string, string | null>}
	 */
	let previews = {};
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;
	$: wanted = Object.fromEntries(
		fields.map(({ key }) => {
			const value = form[key]?.trim() ?? '';
			return [key, value && !urlProblem(value) ? value : null];
		})
	);
	$: schedule(wanted);

	/** @param {Record<string, string | null>} next */
	function schedule(next) {
		clearTimeout(timer);
		// Al abrir la pantalla, sin esperar.
		const immediate = Object.keys(previews).length === 0;
		if (immediate) previews = next;
		else timer = setTimeout(() => (previews = next), PREVIEW_DELAY_MS);
	}

	onDestroy(() => clearTimeout(timer));

	/** Estado de carga por URL: si el partner vuelve a una URL ya probada, no se repite. */
	/** @type {Record<string, 'ok' | 'error'>} */
	let loadedBySrc = {};

	$: imageStatus = Object.fromEntries(
		fields
			.filter(({ key }) => previews[key])
			.map(({ key }) => [key, loadedBySrc[previews[key]] ?? 'loading'])
	);

	/**
	 * Se marca la URL que cargó la imagen, no la que hay ahora en el campo: un
	 * `error` que llega tarde de una URL anterior no puede pisar a la actual.
	 * @param {Event} event
	 * @param {'ok' | 'error'} status
	 */
	function mark(event, status) {
		const src = /** @type {HTMLImageElement} */ (event.currentTarget).getAttribute('src');
		if (src) loadedBySrc = { ...loadedBySrc, [src]: status };
	}
</script>

<section class="space-y-3" aria-labelledby="brand-logos-title">
	<div>
		<h2
			id="brand-logos-title"
			class="admin-display m-0 text-[15px] font-semibold text-slate-900 dark:text-white"
		>
			Logos
		</h2>
		<p class="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-white/45">
			Pega la dirección de cada imagen. Nexus no la descarga ni la copia.
		</p>
	</div>

	{#each fields as field (field.key)}
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<BrandTextField
					id="brand-{field.key}"
					label={field.label}
					type="url"
					bind:value={form[field.key]}
					error={errors[field.key]}
					hint={imageStatus[field.key] === 'error'
						? 'La imagen no cargó. Puedes guardar igual; revisa que la dirección sea pública.'
						: field.hint}
					required={field.required}
					{disabled}
					placeholder={field.placeholder}
				/>
			</div>
			<div
				class="mt-5 flex h-[38px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 {field.surface}"
				aria-hidden="true"
			>
				{#if previews[field.key]}
					{#key previews[field.key]}
						<img
							src={previews[field.key]}
							alt=""
							class="max-h-[30px] max-w-[56px] object-contain {imageStatus[field.key] === 'error'
								? 'hidden'
								: ''}"
							referrerpolicy="no-referrer"
							decoding="async"
							on:load={(e) => mark(e, 'ok')}
							on:error={(e) => mark(e, 'error')}
						/>
					{/key}
					{#if imageStatus[field.key] === 'error'}
						<Icon icon="mdi:image-broken-variant" width={18} class="text-amber-500" />
					{/if}
				{:else}
					<Icon icon="mdi:image-outline" width={18} class="text-slate-300 dark:text-white/25" />
				{/if}
			</div>
		</div>
	{/each}
</section>
