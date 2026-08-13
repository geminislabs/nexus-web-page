<script>
	import { logger } from '$lib/utils/logger.js';
	import Icon from '@iconify/svelte';
	import { apiService } from '$lib/services/api.js';
	import { slide } from 'svelte/transition';

	const inputClass =
		'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30';

	let fullName = '';
	let email = '';
	let loading = false;
	let successMessage = '';
	let errorMessage = '';

	let bannerVisible = false;
	let buttonMode = 'invite';

	function handleEmailInput() {
		if (bannerVisible) {
			bannerVisible = false;
			buttonMode = 'invite';
			errorMessage = '';
		}
	}

	async function handleSubmit() {
		if (!email || (!fullName && buttonMode === 'invite')) {
			errorMessage = 'Por favor completa los campos requeridos';
			return;
		}

		loading = true;
		errorMessage = '';
		successMessage = '';

		try {
			if (buttonMode === 'invite') {
				await apiService.inviteUser({
					email,
					full_name: fullName
				});
				successMessage = 'Invitación enviada exitosamente';
				fullName = '';
				email = '';
				bannerVisible = false;
			} else {
				await apiService.resendInvitation({ email });
				successMessage = 'Invitación reenviada';
			}
		} catch (error) {
			logger.error('Error inviting user:', error);

			const errorText = error.displayMessage || 'No se pudo enviar la invitación.';

			if (
				error.status === 400 &&
				(errorText.toLowerCase().includes('invitación pendiente') ||
					errorText.toLowerCase().includes('pending invitation'))
			) {
				bannerVisible = true;
				buttonMode = 'resend';
			} else {
				errorMessage = errorText || 'Error al procesar la solicitud';
			}
		} finally {
			loading = false;

			if (successMessage) {
				setTimeout(() => {
					successMessage = '';
				}, 3000);
			}
		}
	}
</script>

<div class="space-y-4">
	{#if bannerVisible}
		<div
			transition:slide={{ duration: 300 }}
			class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-500/25 dark:bg-amber-500/10"
			role="status"
		>
			<Icon
				icon="mdi:alert-outline"
				width={18}
				class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
				aria-hidden="true"
			/>
			<div>
				<p class="m-0 text-[12px] font-semibold text-amber-900 dark:text-amber-200">
					Ya existe una invitación pendiente para este correo.
				</p>
				<p class="m-0 mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/70">
					Puedes reenviar la invitación si el usuario no la ha recibido.
				</p>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<div
			transition:slide
			class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
			role="alert"
		>
			<Icon icon="mdi:alert-circle-outline" width={16} class="shrink-0" aria-hidden="true" />
			{errorMessage}
		</div>
	{/if}

	{#if successMessage}
		<div
			transition:slide
			class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
			role="status"
		>
			<Icon icon="mdi:check-circle-outline" width={16} class="shrink-0" aria-hidden="true" />
			{successMessage}
		</div>
	{/if}

	<div class="space-y-3">
		<label class="block">
			<span
				class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
			>
				Nombre completo
			</span>
			<input
				id="full-name"
				type="text"
				bind:value={fullName}
				disabled={loading || buttonMode === 'resend'}
				class={inputClass}
				placeholder="Ej. Juan Pérez"
			/>
		</label>

		<label class="block">
			<span
				class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
			>
				Correo electrónico
			</span>
			<input
				id="email"
				type="email"
				bind:value={email}
				on:input={handleEmailInput}
				disabled={loading}
				class={inputClass}
				placeholder="usuario@ejemplo.com"
			/>
		</label>

		<button
			type="button"
			on:click={handleSubmit}
			disabled={loading}
			class="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50
				{buttonMode === 'resend' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}"
		>
			{#if loading}
				<Icon icon="mdi:loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
				Procesando…
			{:else if buttonMode === 'invite'}
				<Icon icon="mdi:email-send-outline" width={16} aria-hidden="true" />
				Enviar invitación
			{:else}
				<Icon icon="mdi:email-sync-outline" width={16} aria-hidden="true" />
				Reenviar invitación
			{/if}
		</button>
	</div>
</div>
