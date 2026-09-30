<script>
	import { logger } from '$lib/utils/logger.js';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { apiService } from '$lib/services/api.js';
	import { user } from '$lib/stores/auth.js';
	import ConfirmModal from './ConfirmModal.svelte';

	const ROLE_LABELS = {
		owner: 'Owner',
		admin: 'Admin',
		billing: 'Facturación',
		member: 'Miembro'
	};
	const ROLE_OPTIONS = ['owner', 'admin', 'billing', 'member'];

	let members = [];
	let loading = true;
	let loadError = '';

	let savingRole = {};
	let savingStatus = {};
	let removing = {};

	let toast = null;
	let toastTimeout;

	/** @type {{ member: object } | null} */
	let removeTarget = null;
	let removeLoading = false;

	// `myRole` sale de la propia lista: es la fuente de verdad de a qué
	// organización pertenece esta vista, y evita una llamada aparte solo para
	// saber "quién soy aquí".
	$: myMembership = members.find((m) => m.user_id === $user?.id);
	$: myRole = myMembership?.role ?? null;
	$: canManage = myRole === 'owner' || myRole === 'admin';

	function showToast(message, type = 'success') {
		if (toastTimeout) clearTimeout(toastTimeout);
		toast = { message, type };
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 3000);
	}

	async function loadMembers() {
		if (!$user?.organization_id) {
			loadError = 'No se pudo determinar tu organización.';
			loading = false;
			return;
		}
		loading = true;
		loadError = '';
		try {
			const data = await apiService.getOrganizationMembers($user.organization_id);
			members = Array.isArray(data) ? data : (data?.users ?? []);
		} catch (e) {
			logger.error('Error loading organization members:', e);
			loadError = e?.displayMessage || 'No se pudieron cargar los miembros.';
		} finally {
			loading = false;
		}
	}

	onMount(loadMembers);

	async function handleRoleChange(member, newRole) {
		if (newRole === member.role || savingRole[member.user_id]) return;
		const previousRole = member.role;

		savingRole = { ...savingRole, [member.user_id]: true };
		member.role = newRole;
		members = [...members];

		try {
			await apiService.updateMemberRole($user.organization_id, member.user_id, newRole);
			showToast('Rol actualizado', 'success');
		} catch (e) {
			logger.error('Error updating member role:', e);
			member.role = previousRole;
			members = [...members];
			showToast(e?.displayMessage || 'No se pudo actualizar el rol', 'error');
		} finally {
			savingRole = { ...savingRole, [member.user_id]: false };
		}
	}

	async function handleStatusToggle(member) {
		if (savingStatus[member.user_id]) return;
		const previousStatus = member.status;
		const newStatus = previousStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';

		savingStatus = { ...savingStatus, [member.user_id]: true };
		member.status = newStatus;
		members = [...members];

		try {
			await apiService.updateMemberStatus($user.organization_id, member.user_id, newStatus);
			showToast(newStatus === 'ACTIVE' ? 'Membresía reactivada' : 'Membresía pausada', 'success');
		} catch (e) {
			logger.error('Error updating member status:', e);
			member.status = previousStatus;
			members = [...members];
			showToast(e?.displayMessage || 'No se pudo actualizar el estado', 'error');
		} finally {
			savingStatus = { ...savingStatus, [member.user_id]: false };
		}
	}

	function askRemove(member) {
		removeTarget = { member };
	}

	function cancelRemove() {
		if (removeLoading) return;
		removeTarget = null;
	}

	async function confirmRemove() {
		if (!removeTarget) return;
		const { member } = removeTarget;
		removeLoading = true;
		removing = { ...removing, [member.user_id]: true };

		try {
			await apiService.removeMember($user.organization_id, member.user_id);
			members = members.filter((m) => m.user_id !== member.user_id);
			showToast('Usuario removido de la organización', 'success');
			removeTarget = null;
		} catch (e) {
			logger.error('Error removing member:', e);
			showToast(e?.displayMessage || 'No se pudo remover al usuario', 'error');
		} finally {
			removeLoading = false;
			removing = { ...removing, [member.user_id]: false };
		}
	}
</script>

<div class="relative space-y-3">
	{#if loading}
		<div class="flex items-center gap-2 py-4 text-blue-600 dark:text-blue-400">
			<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
			<span class="text-[12px]">Cargando miembros…</span>
		</div>
	{:else if loadError}
		<div
			class="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-[12px] text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
		>
			{loadError}
			<button
				type="button"
				on:click={loadMembers}
				class="mt-2 text-[11px] font-semibold text-red-600 underline hover:no-underline dark:text-red-300"
			>
				Reintentar
			</button>
		</div>
	{:else if members.length === 0}
		<p class="m-0 py-2 text-[12px] italic text-slate-500 dark:text-white/35">
			Sin miembros en esta organización.
		</p>
	{:else}
		<ul class="m-0 list-none space-y-2 p-0">
			{#each members as member (member.user_id)}
				{@const isSelf = member.user_id === $user?.id}
				{@const isInactive = member.status === 'INACTIVE'}
				<li
					class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03] {isInactive
						? 'opacity-60'
						: ''}"
				>
					<div class="min-w-0">
						<p class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
							{member.full_name || member.email}
							{#if isSelf}
								<span class="text-[10px] font-normal text-slate-400 dark:text-white/35">(tú)</span>
							{/if}
						</p>
						<p class="m-0 mt-0.5 truncate text-[11px] text-slate-500 dark:text-white/40">
							{member.email}
						</p>
					</div>

					<div class="flex shrink-0 flex-wrap items-center gap-2">
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold {isInactive
								? 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/50'
								: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}"
						>
							{isInactive ? 'Pausado' : 'Activo'}
						</span>

						{#if canManage}
							<div class="relative">
								<select
									value={member.role}
									on:change={(e) => handleRoleChange(member, e.target.value)}
									disabled={savingRole[member.user_id] || member.role === 'owner'}
									class="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-6 text-[11px] font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
								>
									{#each ROLE_OPTIONS as role (role)}
										<option value={role}>{ROLE_LABELS[role]}</option>
									{/each}
								</select>
							</div>

							{#if !isSelf}
								<button
									type="button"
									on:click={() => handleStatusToggle(member)}
									disabled={savingStatus[member.user_id]}
									class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:text-white/70 dark:hover:bg-white/[0.06]"
								>
									{#if savingStatus[member.user_id]}
										<Icon icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
									{:else}
										<Icon
											icon={isInactive ? 'mdi:play-circle-outline' : 'mdi:pause-circle-outline'}
											width={14}
											aria-hidden="true"
										/>
									{/if}
									{isInactive ? 'Reactivar' : 'Pausar'}
								</button>

								<button
									type="button"
									on:click={() => askRemove(member)}
									disabled={removing[member.user_id]}
									class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-500/25 dark:text-red-300 dark:hover:bg-red-500/10"
								>
									{#if removing[member.user_id]}
										<Icon icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
									{:else}
										<Icon icon="mdi:account-remove-outline" width={14} aria-hidden="true" />
									{/if}
									Quitar
								</button>
							{/if}
						{:else}
							<span class="text-[11px] font-medium text-slate-500 dark:text-white/40">
								{ROLE_LABELS[member.role] || member.role}
							</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if toast}
		<div
			transition:fade={{ duration: 200 }}
			class="fixed bottom-6 left-1/2 z-[170] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-semibold shadow-lg
				{toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}"
			role="status"
		>
			<Icon
				icon={toast.type === 'success' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'}
				width={14}
				aria-hidden="true"
			/>
			{toast.message}
		</div>
	{/if}
</div>

<ConfirmModal
	open={!!removeTarget}
	title="Quitar de la organización"
	confirmLabel="Quitar"
	cancelLabel="Cancelar"
	loading={removeLoading}
	destructive
	on:cancel={cancelRemove}
	on:confirm={confirmRemove}
>
	{#if removeTarget}
		¿Quitar a <strong>{removeTarget.member.full_name || removeTarget.member.email}</strong> de la organización?
		Podrá ser invitado de nuevo más adelante.
	{/if}
</ConfirmModal>
