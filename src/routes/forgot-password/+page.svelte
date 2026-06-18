<script>
	import { goto } from '$app/navigation';
	import { apiService } from '$lib/services/api.js';
	import Icon from '@iconify/svelte';
	import logoUrl from '$lib/assets/logo.png';

	let email = '';
	let loading = false;
	let error = '';
	const inputClass =
		'w-full appearance-none rounded-[14px] border border-slate-200 bg-white py-3.5 pl-[2.875rem] pr-4 text-[0.9375rem] text-slate-900 outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-[3px] focus:ring-blue-500/15 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/30 dark:focus:border-blue-500/70 dark:focus:bg-white/11';

	async function handleSubmit() {
		if (loading) return;
		const trimmed = email.trim();
		if (!trimmed) {
			error = 'Ingresa tu correo electrónico';
			return;
		}
		loading = true;
		error = '';
		try {
			await apiService.forgotPassword(trimmed);
			goto(`/reset-password?email=${encodeURIComponent(trimmed)}`);
		} catch (err) {
			error = err?.message || 'No se pudo enviar el código. Intenta de nuevo.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>NEXUS — Recuperar contraseña</title>
</svelte:head>

<div
	class="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-100 font-sans dark:bg-[#0a0f0a]"
>
	<main
		class="relative z-10 flex w-[min(420px,92vw)] flex-col items-center rounded-[20px] border border-slate-200 bg-white px-8 pb-6 pt-8 shadow-xl dark:border-white/20 dark:bg-white/[0.08]"
	>
		<img src={logoUrl} alt="" class="mb-5 h-[72px] w-[72px] object-contain" />
		<h1 class="m-0 mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white">
			Recuperar contraseña
		</h1>
		<p class="m-0 mb-6 text-center text-sm text-slate-600 dark:text-white/45">
			Te enviaremos un código de 6 dígitos a tu correo registrado.
		</p>

		<form class="flex w-full flex-col gap-4" on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div
					class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[0.8125rem] text-red-800 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300"
					role="alert"
				>
					{error}
				</div>
			{/if}

			<div class="relative">
				<Icon
					icon="mdi:email-outline"
					class="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 dark:text-white/35"
				/>
				<input
					type="email"
					class={inputClass}
					placeholder="Correo electrónico"
					bind:value={email}
					autocomplete="username"
					required
				/>
			</div>

			<button
				type="submit"
				class="flex w-full items-center justify-center gap-2 rounded-[14px] border-0 bg-[linear-gradient(135deg,#2563eb_0%,#1d9cc4_100%)] py-[0.9375rem] text-base font-semibold text-white disabled:opacity-50"
				disabled={loading}
			>
				{#if loading}
					<Icon icon="mdi:loading" class="h-[18px] w-[18px] animate-spin" />
					Enviando…
				{:else}
					Enviar código
				{/if}
			</button>
		</form>

		<p class="mt-5 text-center text-[0.8125rem] text-slate-600 dark:text-white/40">
			<a
				href="/login"
				class="font-medium text-blue-600 no-underline hover:underline dark:text-blue-400"
				>Volver al inicio de sesión</a
			>
		</p>
	</main>
</div>
