<script>
	import Icon from '@iconify/svelte';
	import { apiService } from '$lib/services/api.js';
	import { browser } from '$app/environment';

	export let unit = null;
	export let onBack = () => {};

	let loadingLink = false;
	let linkError = null;
	let copied = false;
	let shareResult = null;

	function getCoords() {
		const lat = unit?.latitude ?? unit?.lat;
		const lng = unit?.longitude ?? unit?.lng;
		if (lat == null || lng == null) return null;
		return { lat: Number(lat), lng: Number(lng) };
	}

	async function shareCurrentLocation() {
		const coords = getCoords();
		if (!coords) {
			alert('No hay posición disponible para esta unidad.');
			return;
		}
		const name = unit?.name || 'Unidad';
		const text = `📍 Ubicación de ${name}:\nhttps://www.google.com/maps?q=${coords.lat},${coords.lng}`;
		await shareText(text);
	}

	async function shareEta() {
		const name = unit?.name || 'Unidad';
		const text = `⏱️ Seguimiento de ${name} — función ETA próximamente en Nexus`;
		await shareText(text);
	}

	function buildShareUrl(res) {
		const token = res?.token;
		if (!token || typeof token !== 'string') return null;
		const origin = browser && typeof window !== 'undefined' ? window.location.origin : '';
		const localPath = `/share/${encodeURIComponent(token)}`;
		const local = origin ? `${origin}${localPath}` : localPath;

		const remote = res?.share_url;
		if (typeof remote === 'string' && remote.trim() && origin) {
			try {
				const u = new URL(remote.trim());
				// Solo confiar en share_url del mismo origen (evita open-redirect / phishing).
				if (u.origin === origin && u.pathname.startsWith('/share/')) {
					return u.toString();
				}
			} catch {
				/* ignore invalid URL */
			}
		}
		return local;
	}

	async function shareTemporaryLink() {
		if (!unit?.id) return;
		loadingLink = true;
		linkError = null;
		shareResult = null;
		try {
			const res = await apiService.shareUnitLocation(unit.id);
			shareResult = res;
			const url = buildShareUrl(res);
			if (!url) {
				linkError = 'No se pudo generar el enlace';
				return;
			}
			const name = unit?.name || 'Unidad';
			const expires = res?.expires_at ? new Date(res.expires_at).toLocaleString('es-MX') : '';
			const text = `🔗 Seguimiento temporal de ${name}:\n${url}${expires ? `\n\nExpira: ${expires}` : ''}`;
			await shareText(text);
			await copyToClipboard(url);
		} catch {
			linkError = 'No se pudo generar el enlace';
		} finally {
			loadingLink = false;
		}
	}

	async function shareText(text) {
		if (browser && navigator.share) {
			try {
				await navigator.share({ text });
				return;
			} catch (e) {
				if (e?.name === 'AbortError') return;
			}
		}
		await copyToClipboard(text);
	}

	async function copyToClipboard(text) {
		if (!browser) return;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			// fallback silencioso
		}
	}
</script>

<div class="flex max-h-[70vh] flex-col bg-white dark:bg-[#0c1829]">
	<div class="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10"
			on:click={onBack}
			aria-label="Volver"
		>
			<Icon icon="mdi:arrow-left" width={20} />
		</button>
		<div class="flex-1">
			<p class="m-0 text-sm font-semibold text-slate-900 dark:text-white">Compartir</p>
			<p class="m-0 text-[11px] text-slate-500 dark:text-white/50">{unit?.name || 'Unidad'}</p>
		</div>
	</div>

	<div class="space-y-0 p-2">
		<button
			type="button"
			class="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
			on:click={shareCurrentLocation}
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15">
				<Icon icon="mdi:map-marker" width={22} class="text-cyan-600 dark:text-cyan-400" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="m-0 text-[13px] font-semibold text-slate-900 dark:text-white">
					Compartir ubicación actual
				</p>
				<p class="m-0 text-[11px] text-slate-500 dark:text-white/45">
					Envía la posición en tiempo real
				</p>
			</div>
			<Icon icon="mdi:chevron-right" width={20} class="text-slate-300 dark:text-white/25" />
		</button>
		<div class="mx-3 h-px bg-slate-100 dark:bg-white/[0.07]"></div>

		<button
			type="button"
			class="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
			on:click={shareEta}
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
				<Icon icon="mdi:timer-outline" width={22} class="text-amber-400" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="m-0 text-[13px] font-semibold text-slate-900 dark:text-white">Compartir ETA</p>
				<p class="m-0 text-[11px] text-slate-500 dark:text-white/45">Tiempo estimado de llegada</p>
			</div>
			<Icon icon="mdi:chevron-right" width={20} class="text-slate-300 dark:text-white/25" />
		</button>
		<div class="mx-3 h-px bg-slate-100 dark:bg-white/[0.07]"></div>

		<button
			type="button"
			class="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-white/5"
			on:click={shareTemporaryLink}
			disabled={loadingLink || !unit?.deviceId}
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
				{#if loadingLink}
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400"
					></div>
				{:else}
					<Icon icon="mdi:link-variant" width={22} class="text-blue-400" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="m-0 text-[13px] font-semibold text-slate-900 dark:text-white">
					Enlace de seguimiento
				</p>
				<p class="m-0 text-[11px] text-slate-500 dark:text-white/45">
					{#if !unit?.deviceId}
						Requiere dispositivo asignado
					{:else}
						Genera un enlace temporal (~30 min)
					{/if}
				</p>
			</div>
			<Icon icon="mdi:chevron-right" width={20} class="text-slate-300 dark:text-white/25" />
		</button>

		{#if linkError}
			<p class="mx-3 mt-2 text-center text-xs text-red-400">{linkError}</p>
		{/if}
		{#if copied}
			<p class="mx-3 mt-2 text-center text-xs text-emerald-400">Enlace copiado al portapapeles</p>
		{/if}
		{#if shareResult?.expires_at}
			<p class="mx-3 mt-1 text-center text-[10px] text-slate-400 dark:text-white/35">
				Expira: {new Date(shareResult.expires_at).toLocaleString('es-MX')}
			</p>
		{/if}
	</div>
</div>
