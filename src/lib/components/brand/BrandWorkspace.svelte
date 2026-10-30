<script>
	import Icon from '$lib/components/Icon.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { apiService } from '$lib/services/api.js';
	import { user } from '$lib/stores/auth.js';
	import { logger } from '$lib/utils/logger.js';
	import {
		describeLastPublished,
		draftPayload,
		fieldErrorsFromApi,
		formFromBranding,
		previewTokens,
		rampFromTokens,
		sameBrandForm,
		validateBrandForm
	} from '$lib/utils/brandForm.js';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import BrandIdentityForm from './BrandIdentityForm.svelte';
	import BrandLogoFields from './BrandLogoFields.svelte';
	import BrandColorPicker from './BrandColorPicker.svelte';
	import BrandPreview from './BrandPreview.svelte';
	import BrandActionsBar from './BrandActionsBar.svelte';

	/** La cuenta cuya marca se edita (`account.id` de `/auth/me`). */
	export let accountId;

	/** @type {'loading' | 'ready' | 'forbidden' | 'error'} */
	let status = 'loading';
	let loadError = '';
	/** Lo último que devolvió el servidor: `GET`, `PUT draft` o `publish`. */
	/** @type {Record<string, any> | null} */
	let branding = null;
	/** @type {import('$lib/utils/brandForm.js').BrandForm} */
	let form = formFromBranding(null).form;
	/** El formulario tal como está guardado: contra esto se miden los cambios. */
	let saved = structuredClone(form);

	/** @type {Record<string, string>} */
	let errors = {};
	/** @type {Array<Record<string, any>>} */
	let adjustments = [];
	/** @type {Array<Record<string, any>>} */
	let contrastFailures = [];
	/** @type {Record<string, 'ok' | 'error' | 'loading'>} */
	let imageStatus = {};

	/** @type {'save' | 'publish' | 'discard' | null} */
	let busy = null;
	/** @type {'save' | 'publish' | null} */
	let done = null;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let doneTimer;

	/** @param {'save' | 'publish'} action */
	function flashDone(action) {
		done = action;
		clearTimeout(doneTimer);
		doneTimer = setTimeout(() => (done = null), 1800);
	}
	onDestroy(() => clearTimeout(doneTimer));
	/** @type {{ kind: 'success' | 'warning' | 'error', text: string } | null} */
	let notice = null;
	/** @type {'publish' | 'discard' | null} */
	let confirming = null;

	$: dirty = !sameBrandForm(form, saved);
	$: hasDraft = Boolean(branding?.draft);
	$: seedsDirty =
		form.primary !== saved.primary ||
		form.useAccent !== saved.useAccent ||
		(form.useAccent && form.accent !== saved.accent);
	$: tokens = { light: previewTokens(branding, 'light'), dark: previewTokens(branding, 'dark') };
	$: ramps = { light: rampFromTokens(tokens.light), dark: rampFromTokens(tokens.dark) };
	$: lastPublished = describeLastPublished(branding, $user?.id);

	/**
	 * `adjustments` viene en todas las respuestas (admin-api ≥ 1.58.0): son los
	 * del borrador si lo hay, si no los de lo publicado. Contra un backend
	 * anterior solo vienen al guardar.
	 * @param {Record<string, any> | null} next
	 */
	function adopt(next) {
		branding = next;
		form = formFromBranding(next).form;
		saved = structuredClone(form);
		errors = {};
		contrastFailures = [];
		adjustments = adjustmentsOf(next);
	}

	/** @param {Record<string, any> | null} response */
	function adjustmentsOf(response) {
		return Array.isArray(response?.adjustments) ? response.adjustments : [];
	}

	async function load() {
		status = 'loading';
		try {
			adopt(await apiService.getBranding(accountId));
			status = 'ready';
		} catch (err) {
			if (err?.status === 403) {
				status = 'forbidden';
				return;
			}
			logger.warn({ code: 'BRANDING_LOAD_FAILED', message: 'Failed to load branding', err });
			loadError = err?.displayMessage || 'No se pudo cargar la marca.';
			status = 'error';
		}
	}

	async function save() {
		notice = null;
		contrastFailures = [];
		errors = validateBrandForm(form);
		if (Object.keys(errors).length) {
			notice = { kind: 'error', text: 'Revisa los campos marcados antes de guardar.' };
			return;
		}

		busy = 'save';
		try {
			const result = await apiService.saveBrandingDraft(accountId, draftPayload(form));
			// No se re-deriva el formulario desde la respuesta: el usuario pudo
			// seguir escribiendo mientras se guardaba.
			branding = result;
			saved = formFromBranding(result).form;
			adjustments = adjustmentsOf(result);

			const broken = Object.entries(imageStatus)
				.filter(([, s]) => s === 'error')
				.map(([key]) => key);
			notice = broken.length
				? {
						kind: 'warning',
						text: 'Borrador guardado, pero alguna imagen no cargó. Revisa que sus direcciones sean públicas.'
					}
				: { kind: 'success', text: 'Borrador guardado. Tus usuarios todavía no lo ven.' };
			flashDone('save');
		} catch (err) {
			const fromApi = fieldErrorsFromApi(err);
			if (fromApi) {
				errors = fromApi.fields;
				contrastFailures = fromApi.contrast;
				notice = { kind: 'error', text: 'El servidor rechazó algunos datos. Revisa los campos.' };
			} else {
				notice = { kind: 'error', text: err?.displayMessage || 'No se pudo guardar.' };
			}
		} finally {
			busy = null;
		}
	}

	async function publish() {
		confirming = null;
		notice = null;
		busy = 'publish';
		try {
			adopt(await apiService.publishBranding(accountId));
			notice = {
				kind: 'success',
				text: 'Marca publicada. Los correos la usan desde ahora; la aplicación puede tardar hasta un minuto.'
			};
			flashDone('publish');
		} catch (err) {
			if (err?.status === 409) {
				// Otro administrador publicó o descartó el borrador mientras tanto.
				await load();
				notice = {
					kind: 'warning',
					text: 'Ya no había borrador que publicar. Se recargó la marca.'
				};
			} else {
				const fromApi = fieldErrorsFromApi(err);
				if (fromApi) {
					errors = fromApi.fields;
					contrastFailures = fromApi.contrast;
				}
				notice = { kind: 'error', text: err?.displayMessage || 'No se pudo publicar.' };
			}
		} finally {
			busy = null;
		}
	}

	async function discard() {
		confirming = null;
		notice = null;
		if (!hasDraft) {
			// Solo cambios locales: no hay nada que borrar en el servidor.
			form = structuredClone(saved);
			errors = {};
			return;
		}
		busy = 'discard';
		try {
			await apiService.discardBrandingDraft(accountId);
			// Se vuelve a leer para traer los ajustes de lo publicado, que el
			// DELETE (204) no devuelve. Si la lectura falla, basta con lo local.
			adopt(
				await apiService
					.getBranding(accountId)
					.catch(() => ({ ...branding, draft: null, adjustments: [] }))
			);
			notice = { kind: 'success', text: 'Borrador descartado. Lo publicado no cambió.' };
		} catch (err) {
			notice = { kind: 'error', text: err?.displayMessage || 'No se pudo descartar.' };
		} finally {
			busy = null;
		}
	}

	const noticeStyle = {
		success:
			'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
		warning:
			'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
		error:
			'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
	};
	const noticeIcon = {
		success: 'mdi:check-circle-outline',
		warning: 'mdi:alert-outline',
		error: 'mdi:alert-circle-outline'
	};

	onMount(load);
</script>

{#if status === 'loading'}
	<div
		class="flex flex-1 items-center justify-center gap-2 p-10 text-[13px] text-slate-500 dark:text-white/45"
	>
		<Icon icon="mdi:loading" width={18} class="animate-spin" aria-hidden="true" />
		Cargando la marca…
	</div>
{:else if status === 'forbidden'}
	<div class="p-6 text-[13px] text-slate-600 dark:text-white/60" role="alert">
		No tienes permiso para editar la marca de esta cuenta, o la cuenta no tiene habilitada la marca
		propia.
	</div>
{:else if status === 'error'}
	<div
		class="flex flex-col items-start gap-3 p-6 text-[13px] text-slate-600 dark:text-white/60"
		role="alert"
	>
		<p class="m-0">{loadError}</p>
		<button
			type="button"
			class="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.05]"
			on:click={load}
		>
			Reintentar
		</button>
	</div>
{:else}
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="grid flex-1 gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
			<div class="space-y-6">
				{#if notice}
					<div
						class="flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] {noticeStyle[
							notice.kind
						]}"
						role={notice.kind === 'error' ? 'alert' : 'status'}
					>
						<Icon
							icon={noticeIcon[notice.kind]}
							width={16}
							class="mt-0.5 shrink-0"
							aria-hidden="true"
						/>
						<span>{notice.text}</span>
					</div>
				{/if}
				<BrandIdentityForm bind:form {errors} disabled={busy !== null} />
				<BrandLogoFields bind:form bind:imageStatus {errors} disabled={busy !== null} />
				<BrandColorPicker
					bind:form
					{errors}
					{ramps}
					{adjustments}
					{contrastFailures}
					{seedsDirty}
					disabled={busy !== null}
				/>
			</div>
			<div class="min-w-0 lg:sticky lg:top-0 lg:self-start">
				<BrandPreview {form} {tokens} {hasDraft} />
			</div>
		</div>

		<BrandActionsBar
			{dirty}
			{hasDraft}
			{busy}
			{lastPublished}
			{done}
			on:save={save}
			on:publish={() => (confirming = 'publish')}
			on:discard={() => (hasDraft ? (confirming = 'discard') : discard())}
		/>
	</div>

	<ConfirmModal
		open={confirming === 'publish'}
		title="¿Publicar la marca?"
		confirmLabel="Publicar"
		on:confirm={publish}
		on:cancel={() => (confirming = null)}
	>
		Tus usuarios verán este nombre, estos logos y estos colores. Los correos la usan desde ahora.
	</ConfirmModal>
	<ConfirmModal
		open={confirming === 'discard'}
		title="¿Descartar el borrador?"
		confirmLabel="Descartar"
		destructive
		on:confirm={discard}
		on:cancel={() => (confirming = null)}
	>
		Se borra el borrador guardado. Lo publicado no cambia.
	</ConfirmModal>
{/if}
