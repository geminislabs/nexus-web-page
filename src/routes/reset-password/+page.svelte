<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { apiService } from '$lib/services/api.js';
	import { validatePassword } from '$lib/utils/passwordValidation.js';
	import Icon from '@iconify/svelte';
	import logoUrl from '$lib/assets/logo.png';
	import { onMount } from 'svelte';

	let email = '';
	let code = '';
	let newPassword = '';
	let confirmPassword = '';
	let loading = false;
	let error = '';
	let success = '';
	let showPassword = false;

	const inputClass =
		'w-full appearance-none rounded-[14px] border border-slate-200 bg-white py-3.5 px-4 text-[0.9375rem] text-slate-900 outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/30 dark:focus:border-blue-500/70 dark:focus:bg-white/11';

	onMount(() => {
		const q = $page.url.searchParams.get('email');
		if (q) email = q;
	});

	async function handleSubmit() {
		if (loading) return;
		error = '';
		success = '';

		if (!email.trim() || !code.trim() || !newPassword || !confirmPassword) {
			error = 'Completa todos los campos';
			return;
		}
		if (code.trim().length !== 6) {
			error = 'El código debe tener 6 dígitos';
			return;
		}
		if (newPassword !== confirmPassword) {
			error = 'Las contraseñas no coinciden';
			return;
		}
		const pwdErrors = validatePassword(newPassword);
		if (pwdErrors.length > 0) {
			error = `La contraseña debe tener ${pwdErrors.join(', ')}`;
			return;
		}

		loading = true;
		try {
			const res = await apiService.resetPassword({
				email: email.trim(),
				code: code.trim(),
				new_password: newPassword
			});
			success = res?.message || 'Contraseña restablecida. Ya puedes iniciar sesión.';
			setTimeout(() => goto('/login'), 1200);
		} catch (err) {
			error = err?.message || 'No se pudo restablecer la contraseña';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>NEXUS — Restablecer contraseña</title>
</svelte:head>

<div
	class="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-100 font-sans dark:bg-[#0a0f0a]"
>
	<main
		class="relative z-10 flex w-[min(420px,92vw)] flex-col items-center rounded-[20px] border border-slate-200 bg-white px-8 pb-6 pt-8 shadow-xl dark:border-white/20 dark:bg-white/[0.08]"
	>
		<img src={logoUrl} alt="" class="mb-5 h-[72px] w-[72px] object-contain" />
		<h1 class="m-0 mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white">
			Restablecer contraseña
		</h1>
		<p class="m-0 mb-6 text-center text-sm text-slate-600 dark:text-white/45">
			Ingresa el código de 6 dígitos y tu nueva contraseña.
		</p>

		<form class="flex w-full flex-col gap-3.5" on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div
					class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[0.8125rem] text-red-800 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300"
					role="alert"
				>
					{error}
				</div>
			{/if}
			{#if success}
				<div
					class="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-center text-[0.8125rem] text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300"
					role="status"
				>
					{success}
				</div>
			{/if}

			<input
				type="email"
				class={inputClass}
				placeholder="Correo electrónico"
				bind:value={email}
				autocomplete="username"
				required
			/>
			<input
				type="text"
				class="{inputClass} text-center font-mono tracking-[0.35em]"
				placeholder="Código (6 dígitos)"
				bind:value={code}
				maxlength="6"
				inputmode="numeric"
				required
			/>
			<div class="relative">
				<input
					type={showPassword ? 'text' : 'password'}
					class="{inputClass} pr-12"
					placeholder="Nueva contraseña"
					bind:value={newPassword}
					autocomplete="new-password"
					required
				/>
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent p-1 text-slate-500 dark:text-white/35"
					on:click={() => (showPassword = !showPassword)}
					aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
				>
					<Icon icon={showPassword ? 'mdi:eye' : 'mdi:eye-off'} class="h-[18px] w-[18px]" />
				</button>
			</div>
			<input
				type={showPassword ? 'text' : 'password'}
				class={inputClass}
				placeholder="Confirmar contraseña"
				bind:value={confirmPassword}
				autocomplete="new-password"
				required
			/>
			<p class="m-0 text-[11px] text-slate-500 dark:text-white/35">
				Mayúscula, número y carácter especial (!@#$%…)
			</p>

			<button
				type="submit"
				class="mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] border-0 bg-[linear-gradient(135deg,#2563eb_0%,#1d9cc4_100%)] py-[0.9375rem] text-base font-semibold text-white disabled:opacity-50"
				disabled={loading}
			>
				{#if loading}
					<Icon icon="mdi:loading" class="h-[18px] w-[18px] animate-spin" />
					Restableciendo…
				{:else}
					Restablecer contraseña
				{/if}
			</button>
		</form>

		<p class="mt-5 text-center text-[0.8125rem] text-slate-600 dark:text-white/40">
			<a
				href="/forgot-password"
				class="font-medium text-blue-600 no-underline hover:underline dark:text-blue-400"
				>Reenviar código</a
			>
			·
			<a href="/login" class="font-medium text-blue-600 no-underline hover:underline dark:text-blue-400"
				>Iniciar sesión</a
			>
		</p>
	</main>
</div>
