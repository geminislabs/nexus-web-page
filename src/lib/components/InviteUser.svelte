<script>
	import { apiService } from '$lib/services/api.js';
	import { slide, fade } from 'svelte/transition';

	let fullName = '';
	let email = '';
	let loading = false;
	let successMessage = '';
	let errorMessage = '';

	// Smart Flow State
	let invitationPending = false;
	let bannerVisible = false;
	let buttonMode = 'invite'; // 'invite' | 'resend'

	// Watch for email changes to reset state
	function handleEmailInput() {
		if (bannerVisible) {
			bannerVisible = false;
			buttonMode = 'invite';
			invitationPending = false;
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
				// Reset state just in case
				bannerVisible = false;
				invitationPending = false;
			} else {
				// Resend mode
				await apiService.resendInvitation({ email });
				successMessage = 'Invitación reenviada';
				// Keep banner visible as per requirements
			}
		} catch (error) {
			console.error('Error inviting user:', error);

			// Check for specific 400 error about pending invitation
			// The API might return it in error.detail or error.message
			const errorText = error.detail || error.message || '';

			if (
				error.status === 400 &&
				(errorText.toLowerCase().includes('invitación pendiente') ||
					errorText.toLowerCase().includes('pending invitation'))
			) {
				invitationPending = true;
				bannerVisible = true;
				buttonMode = 'resend';
				// Do NOT show red error, show banner instead
			} else {
				// Normal error
				errorMessage = errorText || 'Error al procesar la solicitud';
			}
		} finally {
			loading = false;

			// Clear success message after a delay
			if (successMessage) {
				setTimeout(() => {
					successMessage = '';
				}, 3000);
			}
		}
	}
</script>

<div class="invite-user-container">
	<!-- Warning Banner -->
	{#if bannerVisible}
		<div transition:slide={{ duration: 300 }} class="warning-banner mb-4">
			<div class="flex items-start gap-3">
				<svg
					class="w-5 h-5 text-orange-200 mt-0.5 flex-shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<div>
					<p class="font-medium text-orange-100 text-sm">
						Ya existe una invitación pendiente para este correo.
					</p>
					<p class="text-orange-200/70 text-xs mt-1">
						Puedes reenviar la invitación si el usuario no la ha recibido.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if errorMessage}
		<div
			transition:slide
			class="mb-4 p-3 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-center gap-2"
		>
			<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			{errorMessage}
		</div>
	{/if}

	<!-- Success Message -->
	{#if successMessage}
		<div
			transition:slide
			class="mb-4 p-3 rounded bg-green-500/20 border border-green-500/30 text-green-200 text-sm flex items-center gap-2"
		>
			<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			{successMessage}
		</div>
	{/if}

	<div class="space-y-4">
		<div>
			<label for="full-name" class="block text-xs font-medium text-app opacity-70 mb-1">
				Nombre Completo
			</label>
			<input
				id="full-name"
				type="text"
				bind:value={fullName}
				disabled={loading || buttonMode === 'resend'}
				class="w-full px-3 py-2 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-app text-sm focus:outline-none focus:border-accent-cyan transition-colors disabled:opacity-50"
				placeholder="Ej. Juan Pérez"
			/>
		</div>

		<div>
			<label for="email" class="block text-xs font-medium text-app opacity-70 mb-1">
				Correo Electrónico
			</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				on:input={handleEmailInput}
				disabled={loading}
				class="w-full px-3 py-2 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-app text-sm focus:outline-none focus:border-accent-cyan transition-colors disabled:opacity-50"
				placeholder="usuario@ejemplo.com"
			/>
		</div>

		<button
			on:click={handleSubmit}
			disabled={loading}
			class="w-full py-2.5 rounded-md text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
			class:btn-invite={buttonMode === 'invite'}
			class:btn-resend={buttonMode === 'resend'}
		>
			{#if loading}
				<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
						fill="none"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				<span>Procesando...</span>
			{:else if buttonMode === 'invite'}
				<span>Enviar Invitación</span>
			{:else}
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				<span>Reenviar Invitación</span>
			{/if}
		</button>
	</div>
</div>

<style>
	.warning-banner {
		background: rgba(255, 153, 0, 0.15);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 153, 0, 0.3);
		border-radius: 0.5rem;
		padding: 0.75rem;
		box-shadow: 0 4px 15px rgba(255, 153, 0, 0.1);
	}

	.btn-invite {
		background: var(--accent-cyan);
	}

	.btn-invite:hover:not(:disabled) {
		box-shadow: 0 0 15px var(--accent-cyan);
		transform: scale(1.02);
	}

	.btn-resend {
		background: #ff9900; /* Orange for resend action */
	}

	.btn-resend:hover:not(:disabled) {
		box-shadow: 0 0 15px rgba(255, 153, 0, 0.6);
		transform: scale(1.02);
	}
</style>
