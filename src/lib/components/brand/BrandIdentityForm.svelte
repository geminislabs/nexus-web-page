<script>
	import BrandTextField from './BrandTextField.svelte';

	/** @type {import('$lib/utils/brandForm.js').BrandForm} */
	export let form;
	/** @type {Record<string, string>} */
	export let errors = {};
	export let disabled = false;
</script>

<section class="space-y-3" aria-labelledby="brand-identity-title">
	<div>
		<h2
			id="brand-identity-title"
			class="admin-display m-0 text-[15px] font-semibold text-slate-900 dark:text-white"
		>
			Identidad
		</h2>
		<p class="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-white/45">
			Lo que ven tus usuarios en el login y en los correos.
		</p>
	</div>

	<BrandTextField
		id="brand-name"
		label="Nombre visible"
		bind:value={form.brand_name}
		error={errors.brand_name}
		maxlength={80}
		required
		{disabled}
		placeholder="Ej. Rastreo Norte"
	/>
	<BrandTextField
		id="brand-support-email"
		label="Correo de soporte"
		type="email"
		bind:value={form.support_email}
		error={errors.support_email}
		hint="Las respuestas a los correos de la plataforma llegan aquí."
		required
		{disabled}
		placeholder="soporte@tumarca.com"
	/>
	<BrandTextField
		id="brand-legal-url"
		label="Enlace a tus términos y aviso de privacidad"
		type="url"
		bind:value={form.legal_url}
		error={errors.legal_url}
		hint="Aparece en el pie de los correos. Debe empezar con https://"
		required
		{disabled}
		placeholder="https://tumarca.com/legal"
	/>
</section>
