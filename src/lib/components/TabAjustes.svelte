<script>
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth.js';
	import { logoutSession } from '$lib/services/sessionService.js';
	import { vehicles, vehicleActions, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { getStatusText, getStatusPillClass } from '$lib/utils/vehicleUtils.js';
	import { theme, themeActions } from '$lib/stores/themeStore.js';
	import { vehicleColors } from '$lib/data/vehicleColors';
	import IconPicker from '$lib/components/Unit/IconPicker.svelte';
	import VehicleColorPicker from '$lib/components/Unit/VehicleColorPicker.svelte';
	import { apiService } from '$lib/services/api.js';
	import { validatePassword } from '$lib/utils/passwordValidation.js';

	let subView = 'main'; // 'main' | 'unidades' | 'editUnit' | 'createUnit' | 'changePassword'
	let editingUnit = null;
	let editName = '';
	let editDescription = '';
	let editBrand = '';
	let editModel = '';
	let editYear = '';
	let editPlate = '';
	let editVin = '';
	let editColor = '';
	let editIconType = '';
	let editExistingDeviceId = '';
	let editNewDeviceId = '';
	let saving = false;
	let deleting = false;
	let unassigning = false;
	let showDeleteConfirm = false;
	let showUnassignConfirm = false;
	let saveError = null;
	let oldPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let changingPassword = false;
	let passwordError = null;
	let passwordSuccess = null;

	function getInitial(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}

	async function handleLogout() {
		await logoutSession();
		goto('/login');
	}

	async function loadUnidades() {
		if ($vehicles.length === 0) await vehicleActions.loadVehicles();
		subView = 'unidades';
	}

	function resetUnitForm() {
		editName = '';
		editDescription = '';
		editBrand = '';
		editModel = '';
		editYear = '';
		editPlate = '';
		editVin = '';
		editColor = '';
		editIconType = 'vehicle-car-sedan';
		editExistingDeviceId = '';
		editNewDeviceId = '';
		showDeleteConfirm = false;
		showUnassignConfirm = false;
		saveError = null;
	}

	$: if (!$user?.is_master && (subView === 'editUnit' || subView === 'createUnit')) {
		editingUnit = null;
		subView = 'unidades';
	}

	function openCreate() {
		if (!$user?.is_master) return;
		editingUnit = null;
		resetUnitForm();
		subView = 'createUnit';
	}

	function openEdit(v) {
		if (!$user?.is_master) return;
		editingUnit = v;
		editName = v.name || '';
		editDescription = v.description || '';
		editBrand = v.brand || '';
		editModel = v.model || '';
		editYear = v.year ? String(v.year) : '';
		editPlate = v.plate || v.vehicle?.plate || '';
		editVin = v.vin || v.vehicle?.vin || '';
		editColor = v.color || '';
		editIconType = v.icon_type || v.iconType || 'vehicle-car-sedan';
		editExistingDeviceId = v.deviceId || '';
		editNewDeviceId = '';
		showDeleteConfirm = false;
		showUnassignConfirm = false;
		saveError = null;
		subView = 'editUnit';
	}

	function cancelEdit() {
		editingUnit = null;
		saveError = null;
		showDeleteConfirm = false;
		showUnassignConfirm = false;
		subView = 'unidades';
	}

	function unitFormPayload() {
		return {
			name: editName.trim(),
			description: editDescription.trim() || null,
			brand: editBrand.trim() || null,
			model: editModel.trim() || null,
			year: editYear ? parseInt(editYear) || null : null,
			plate: editPlate.trim() || null,
			vin: editVin.trim() || null,
			color: editColor || null,
			icon_type: editIconType || null
		};
	}

	async function saveEdit() {
		if (!editingUnit || saving) return;
		const name = editName.trim();
		if (!name) {
			saveError = 'El nombre es obligatorio.';
			return;
		}
		saving = true;
		saveError = null;
		try {
			await vehicleActions.updateVehicle(editingUnit.id, unitFormPayload());
			const newDeviceId = editNewDeviceId.trim();
			if (newDeviceId && newDeviceId !== editExistingDeviceId) {
				await vehicleActions.updateUnitDevice(editingUnit.id, newDeviceId);
			}
			subView = 'unidades';
			editingUnit = null;
		} catch (err) {
			saveError = err?.message || 'No se pudo guardar.';
		} finally {
			saving = false;
		}
	}

	async function saveCreate() {
		if (saving) return;
		const name = editName.trim();
		if (!name) {
			saveError = 'El nombre es obligatorio.';
			return;
		}
		saving = true;
		saveError = null;
		try {
			await vehicleActions.createVehicle({
				...unitFormPayload(),
				deviceId: editNewDeviceId.trim() || null
			});
			subView = 'unidades';
			editingUnit = null;
		} catch (err) {
			saveError = err?.message || 'No se pudo crear la unidad.';
		} finally {
			saving = false;
		}
	}

	async function confirmUnassignDevice() {
		if (!editingUnit || unassigning) return;
		unassigning = true;
		saveError = null;
		try {
			await vehicleActions.updateUnitDevice(editingUnit.id, null);
			editExistingDeviceId = '';
			editNewDeviceId = '';
			editingUnit = { ...editingUnit, deviceId: null };
			showUnassignConfirm = false;
		} catch (err) {
			saveError = err?.message || 'No se pudo desasignar el dispositivo.';
			showUnassignConfirm = false;
		} finally {
			unassigning = false;
		}
	}

	async function handleChangePassword() {
		if (changingPassword) return;
		passwordError = null;
		passwordSuccess = null;

		if (!oldPassword || !newPassword || !confirmPassword) {
			passwordError = 'Completa todos los campos.';
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordError = 'Las contraseñas no coinciden.';
			return;
		}
		const pwdErrors = validatePassword(newPassword);
		if (pwdErrors.length > 0) {
			passwordError = `La contraseña debe tener ${pwdErrors.join(', ')}.`;
			return;
		}

		changingPassword = true;
		try {
			await apiService.changePassword({
				old_password: oldPassword,
				new_password: newPassword
			});
			passwordSuccess = 'Contraseña actualizada correctamente.';
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			passwordError = err?.message || 'No se pudo cambiar la contraseña.';
		} finally {
			changingPassword = false;
		}
	}

	async function confirmDelete() {
		if (!editingUnit || deleting) return;
		deleting = true;
		saveError = null;
		try {
			await vehicleActions.deleteVehicle(editingUnit.id);
			showDeleteConfirm = false;
			editingUnit = null;
			subView = 'unidades';
		} catch (err) {
			saveError = err?.message || 'No se pudo eliminar la unidad.';
			showDeleteConfirm = false;
		} finally {
			deleting = false;
		}
	}

	$: selectedColorHex = vehicleColors.find((c) => c.slug === editColor)?.hex ?? null;

	const inputClass =
		'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30';
</script>

<section
	class="flex h-full min-h-0 flex-col bg-slate-100 font-sans text-slate-900 dark:bg-[radial-gradient(circle_at_top,#0f1a33_0%,#020617_55%,#000_100%)] dark:text-white"
	aria-label="Ajustes de la aplicación"
	style="min-height:0;align-items:stretch;justify-content:flex-start;padding:0"
>
	<!-- ── Vista principal ── -->
	{#if subView === 'main'}
		<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-5">
			{#if $user}
				<article
					class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 pl-[1.125rem] shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
					aria-labelledby="ajustes-user-name"
				>
					<div
						class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-2xl font-bold text-white"
						aria-hidden="true"
					>
						{getInitial($user.name)}
					</div>
					<div class="min-w-0 flex-1">
						<h2
							id="ajustes-user-name"
							class="m-0 truncate text-base font-semibold text-slate-900 dark:text-white"
						>
							{$user.name}
						</h2>
						<p class="m-0 mt-1 truncate text-[0.8125rem] text-slate-600 dark:text-white/45">
							{$user.email}
						</p>
					</div>
				</article>
			{/if}

			<div aria-labelledby="ajustes-aspecto-heading">
				<h3
					id="ajustes-aspecto-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
				>
					Apariencia
				</h3>
				<div
					class="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
				>
					<div
						class="flex items-center justify-between gap-3 px-4 py-3.5"
						role="group"
						aria-label="Tema de la interfaz"
					>
						<span class="flex min-w-0 flex-1 items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"><Icon icon="mdi:theme-light-dark" aria-hidden="true" /></span
							>
							<span class="min-w-0">
								<span class="block text-base font-medium text-slate-900 dark:text-white">Tema</span>
								<span class="mt-0.5 block text-xs text-slate-600 dark:text-white/45"
									>{$theme === 'dark' ? 'Oscuro' : 'Claro'}</span
								>
							</span>
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={$theme === 'dark'}
							aria-label={$theme === 'dark'
								? 'Tema oscuro activo. Pulse para usar tema claro'
								: 'Tema claro activo. Pulse para usar tema oscuro'}
							class="relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 {$theme ===
							'dark'
								? 'bg-blue-600'
								: 'bg-amber-400'}"
							on:click={() => themeActions.toggle()}
						>
							<span
								class="pointer-events-none absolute left-[3px] top-[3px] block h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-transform {$theme ===
								'dark'
									? 'translate-x-[18px]'
									: ''}"
								aria-hidden="true"
							></span>
						</button>
					</div>
				</div>
			</div>

			<div aria-labelledby="ajustes-gestion-heading">
				<h3
					id="ajustes-gestion-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
				>
					Gestión
				</h3>
				<div
					class="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
				>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left text-base font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-white dark:hover:bg-white/[0.05]"
						on:click={loadUnidades}
						aria-label="Gestionar unidades del sistema"
					>
						<span class="flex items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"><Icon icon="mdi:car-side" aria-hidden="true" /></span
							>
							<span>Gestionar unidades</span>
						</span>
						<Icon
							icon="mdi:chevron-right"
							class="h-[18px] w-[18px] shrink-0 text-slate-400 dark:text-white/25"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>

			<div aria-labelledby="ajustes-cuenta-heading">
				<h3
					id="ajustes-cuenta-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
				>
					Cuenta
				</h3>
				<div
					class="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
				>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between border-b border-slate-200 px-4 py-3.5 text-left text-base font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:text-white dark:hover:bg-white/[0.05]"
						on:click={() => {
							passwordError = null;
							passwordSuccess = null;
							subView = 'changePassword';
						}}
						aria-label="Cambiar contraseña"
					>
						<span class="flex items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"><Icon icon="mdi:lock-reset" aria-hidden="true" /></span
							>
							<span>Cambiar contraseña</span>
						</span>
						<Icon
							icon="mdi:chevron-right"
							class="h-[18px] w-[18px] shrink-0 text-slate-400 dark:text-white/25"
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left text-base font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:text-red-400 dark:hover:bg-white/[0.05]"
						on:click={handleLogout}
						aria-label="Cerrar sesión"
					>
						<span class="flex items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"><Icon icon="mdi:logout" aria-hidden="true" /></span
							>
							<span>Cerrar sesión</span>
						</span>
					</button>
				</div>
			</div>

			<div aria-labelledby="ajustes-info-heading">
				<h3
					id="ajustes-info-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
				>
					Información
				</h3>
				<div
					class="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
				>
					<dl class="m-0 flex items-center justify-between px-4 py-3.5">
						<dt class="m-0 text-base font-medium text-slate-900 dark:text-white">Versión</dt>
						<dd class="m-0 text-base text-slate-500 dark:text-white/40">
							<span class="font-mono text-sm tracking-tight">1.0.0</span>
						</dd>
					</dl>
				</div>
			</div>
		</div>

		<!-- ── Lista de unidades ── -->
	{:else if subView === 'unidades'}
		<div class="flex h-full min-h-0 flex-col">
			<header
				class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/[0.08]"
			>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-0 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
					on:click={() => (subView = 'main')}
					aria-label="Volver a ajustes"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 text-lg font-bold text-slate-900 dark:text-white">Gestionar unidades</h2>
				<span class="ml-auto text-sm text-slate-500 dark:text-white/40">{$vehicles.length}</span>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
				{#if $loadingVehicles}
					<div class="flex h-[200px] items-center justify-center" role="status" aria-busy="true">
						<div
							class="h-9 w-9 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-600"
							aria-hidden="true"
						></div>
						<span class="sr-only">Cargando unidades…</span>
					</div>
				{:else if $vehicles.length === 0}
					<div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
						<Icon icon="mdi:car-off" class="h-20 w-20 shrink-0 opacity-20" aria-hidden="true" />
						<h3 class="m-0 text-lg font-semibold text-slate-900 dark:text-white">
							No hay unidades disponibles
						</h3>
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Unidades registradas">
						{#if $user?.is_master}
							<li>
								<button
									type="button"
									class="flex w-full items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] px-4 py-3.5 text-left transition-colors hover:bg-cyan-500/10"
									on:click={openCreate}
									aria-label="Agregar nueva unidad"
								>
									<div
										class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
										aria-hidden="true"
									>
										<Icon icon="mdi:plus" class="h-6 w-6" />
									</div>
									<div class="min-w-0 flex-1">
										<p class="m-0 text-[0.9375rem] font-semibold text-slate-900 dark:text-white">
											Agregar nueva unidad
										</p>
										<p class="m-0 mt-0.5 text-xs text-slate-600 dark:text-white/45">
											Registra un nuevo vehículo
										</p>
									</div>
									<Icon
										icon="mdi:chevron-right"
										class="h-4 w-4 shrink-0 text-cyan-400/70"
										aria-hidden="true"
									/>
								</button>
							</li>
						{/if}
						{#each $vehicles as v (v.id)}
							<li>
								{#if $user?.is_master}
									<button
										type="button"
										class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:border-transparent dark:bg-zinc-900 dark:hover:bg-zinc-800"
										on:click={() => openEdit(v)}
										aria-label="Editar {v.name}"
									>
										<div
											class="h-2.5 w-2.5 shrink-0 rounded-full {v.status === 'active'
												? 'bg-emerald-500'
												: v.status === 'maintenance'
													? 'bg-amber-500'
													: 'bg-slate-300 dark:bg-white/20'}"
											aria-hidden="true"
										></div>
										<div class="min-w-0 flex-1">
											<p class="m-0 text-[0.9375rem] font-semibold text-slate-900 dark:text-white">
												{v.name}
											</p>
											<p class="m-0 mt-0.5 text-xs text-slate-600 dark:text-white/45">
												{[v.brand, v.model].filter(Boolean).join(' ') || v.driver || 'Sin perfil'}
											</p>
										</div>
										<span
											class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold {getStatusPillClass(
												v.status
											)}">{getStatusText(v.status)}</span
										>
										<Icon
											icon="mdi:chevron-right"
											class="h-4 w-4 shrink-0 text-slate-400 dark:text-white/25"
											aria-hidden="true"
										/>
									</button>
								{:else}
									<div
										class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-transparent dark:bg-zinc-900"
									>
										<div
											class="h-2.5 w-2.5 shrink-0 rounded-full {v.status === 'active'
												? 'bg-emerald-500'
												: v.status === 'maintenance'
													? 'bg-amber-500'
													: 'bg-slate-300 dark:bg-white/20'}"
											aria-hidden="true"
										></div>
										<div class="min-w-0 flex-1">
											<p class="m-0 text-[0.9375rem] font-semibold text-slate-900 dark:text-white">
												{v.name}
											</p>
											<p class="m-0 mt-0.5 text-xs text-slate-600 dark:text-white/45">
												{[v.brand, v.model].filter(Boolean).join(' ') || v.driver || 'Sin perfil'}
											</p>
										</div>
										<span
											class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold {getStatusPillClass(
												v.status
											)}">{getStatusText(v.status)}</span
										>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<!-- ── Crear / editar unidad ── -->
	{:else if (subView === 'editUnit' && editingUnit) || subView === 'createUnit'}
		<div class="flex h-full min-h-0 flex-col">
			<header
				class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/[0.08]"
			>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-0 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
					on:click={cancelEdit}
					aria-label="Volver"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 min-w-0 flex-1 truncate text-lg font-bold text-slate-900 dark:text-white">
					{subView === 'createUnit' ? 'Nueva unidad' : editingUnit.name}
				</h2>
				<button
					type="button"
					class="shrink-0 rounded-xl bg-cyan-500 px-4 py-1.5 text-[13px] font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={saving || !editName.trim()}
					on:click={subView === 'createUnit' ? saveCreate : saveEdit}
				>
					{saving
						? subView === 'createUnit'
							? 'Creando…'
							: 'Guardando…'
						: subView === 'createUnit'
							? 'Crear'
							: 'Guardar'}
				</button>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
				{#if saveError}
					<p
						class="mb-4 rounded-xl bg-red-500/10 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400"
					>
						{saveError}
					</p>
				{/if}

				<!-- Identidad -->
				<div class="mb-5">
					<p
						class="mb-2 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
					>
						Identidad
					</p>
					<div class="mb-3 flex items-center gap-4">
						<div class="flex flex-col items-center gap-1">
							<span class="text-[11px] text-slate-500 dark:text-white/40">Icono</span>
							<IconPicker
								currentIcon={editIconType}
								colorHex={selectedColorHex}
								editable={true}
								onSelect={(slug) => (editIconType = slug)}
							/>
						</div>
						<div class="flex flex-col items-center gap-1">
							<span class="text-[11px] text-slate-500 dark:text-white/40">Color</span>
							<VehicleColorPicker
								selectedColor={editColor}
								onSelect={(slug) => (editColor = slug)}
							/>
						</div>
					</div>
					<div class="flex flex-col gap-2.5">
						<div>
							<label
								for="edit-unit-name"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>Nombre *</label
							>
							<input
								id="edit-unit-name"
								type="text"
								class={inputClass}
								placeholder="Nombre de la unidad"
								maxlength="100"
								bind:value={editName}
							/>
						</div>
						<div>
							<label
								for="edit-unit-desc"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>Descripción</label
							>
							<input
								id="edit-unit-desc"
								type="text"
								class={inputClass}
								placeholder="Descripción opcional"
								maxlength="255"
								bind:value={editDescription}
							/>
						</div>
					</div>
				</div>

				<!-- Vehículo -->
				<div class="mb-5">
					<p
						class="mb-2 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
					>
						Vehículo
					</p>
					<div class="flex flex-col gap-2.5">
						<div class="grid grid-cols-2 gap-2.5">
							<div>
								<label
									for="edit-unit-brand"
									class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
									>Marca</label
								>
								<input
									id="edit-unit-brand"
									type="text"
									class={inputClass}
									placeholder="Ej: Ford"
									maxlength="60"
									bind:value={editBrand}
								/>
							</div>
							<div>
								<label
									for="edit-unit-model"
									class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
									>Modelo</label
								>
								<input
									id="edit-unit-model"
									type="text"
									class={inputClass}
									placeholder="Ej: F-350"
									maxlength="60"
									bind:value={editModel}
								/>
							</div>
						</div>
						<div>
							<label
								for="edit-unit-year"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>Año</label
							>
							<input
								id="edit-unit-year"
								type="number"
								class={inputClass}
								placeholder="Ej: 2022"
								min="1900"
								max="2100"
								bind:value={editYear}
							/>
						</div>
					</div>
				</div>

				<!-- Identificación -->
				<div class="mb-5">
					<p
						class="mb-2 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
					>
						Identificación
					</p>
					<div class="flex flex-col gap-2.5">
						<div>
							<label
								for="edit-unit-plate"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>Placa</label
							>
							<input
								id="edit-unit-plate"
								type="text"
								class={inputClass}
								placeholder="Ej: ABC-123"
								maxlength="20"
								bind:value={editPlate}
							/>
						</div>
						<div>
							<label
								for="edit-unit-vin"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>VIN</label
							>
							<input
								id="edit-unit-vin"
								type="text"
								class="{inputClass} font-mono text-[13px] uppercase tracking-widest"
								placeholder="Número de identificación"
								maxlength="17"
								bind:value={editVin}
							/>
						</div>
					</div>
				</div>

				<!-- Dispositivo — igual que móvil -->
				<div class="mb-5">
					<p
						class="mb-2 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/40"
					>
						Dispositivo
					</p>
					{#if editExistingDeviceId}
						<div
							class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
						>
							<p class="m-0 text-[12px] text-slate-500 dark:text-white/40">Device ID</p>
							<p
								class="m-0 mt-0.5 font-mono text-[14px] font-semibold text-slate-800 dark:text-white"
							>
								{editExistingDeviceId}
							</p>
							{#if !showUnassignConfirm}
								<button
									type="button"
									class="mt-3 text-[13px] font-semibold text-red-500 hover:text-red-400 dark:text-red-400"
									on:click={() => (showUnassignConfirm = true)}
									disabled={unassigning}
								>
									Desasignar dispositivo
								</button>
							{:else}
								<p class="m-0 mt-3 text-[13px] text-slate-700 dark:text-white/80">
									¿Desasignar el dispositivo de esta unidad?
								</p>
								<div class="mt-2 flex gap-2">
									<button
										type="button"
										class="flex-1 rounded-lg border border-slate-200 py-2 text-[12px] font-semibold dark:border-white/10 dark:text-white/70"
										on:click={() => (showUnassignConfirm = false)}
										disabled={unassigning}
									>
										Cancelar
									</button>
									<button
										type="button"
										class="flex-1 rounded-lg bg-red-600 py-2 text-[12px] font-bold text-white disabled:opacity-50"
										on:click={confirmUnassignDevice}
										disabled={unassigning}
									>
										{unassigning ? 'Desasignando…' : 'Desasignar'}
									</button>
								</div>
							{/if}
						</div>
					{:else}
						<div>
							<label
								for="edit-unit-device"
								class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
								>Device ID</label
							>
							<input
								id="edit-unit-device"
								type="text"
								class="{inputClass} font-mono text-[13px]"
								placeholder="Opcional"
								bind:value={editNewDeviceId}
							/>
						</div>
					{/if}
				</div>

				<!-- Eliminar unidad (solo en edición) -->
				{#if subView === 'editUnit' && editingUnit && !showDeleteConfirm}
					<button
						type="button"
						class="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-[15px] font-semibold text-red-500 transition-colors hover:bg-red-500/15 dark:text-red-400"
						on:click={() => (showDeleteConfirm = true)}
						disabled={deleting}
					>
						<Icon icon="mdi:delete-outline" class="h-5 w-5" aria-hidden="true" />
						Eliminar unidad
					</button>
				{:else if subView === 'editUnit' && editingUnit}
					<div class="mt-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4">
						<p class="m-0 mb-3 text-[14px] text-slate-900 dark:text-white">
							¿Eliminar <strong>{editingUnit.name}</strong>? Esta acción no se puede deshacer.
						</p>
						<div class="flex gap-2">
							<button
								type="button"
								class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70"
								on:click={() => (showDeleteConfirm = false)}
								disabled={deleting}
							>
								Cancelar
							</button>
							<button
								type="button"
								class="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
								on:click={confirmDelete}
								disabled={deleting}
							>
								{deleting ? 'Eliminando…' : 'Eliminar'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ── Cambiar contraseña ── -->
	{:else if subView === 'changePassword'}
		<div class="flex h-full min-h-0 flex-col">
			<header
				class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/[0.08]"
			>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-0 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
					on:click={() => (subView = 'main')}
					aria-label="Volver a ajustes"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 text-lg font-bold text-slate-900 dark:text-white">Cambiar contraseña</h2>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
				{#if passwordError}
					<p
						class="mb-4 rounded-xl bg-red-500/10 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400"
					>
						{passwordError}
					</p>
				{/if}
				{#if passwordSuccess}
					<p
						class="mb-4 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400"
					>
						{passwordSuccess}
					</p>
				{/if}
				<div class="flex flex-col gap-2.5">
					<div>
						<label
							for="old-password"
							class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
							>Contraseña actual</label
						>
						<input
							id="old-password"
							type="password"
							class={inputClass}
							autocomplete="current-password"
							bind:value={oldPassword}
						/>
					</div>
					<div>
						<label
							for="new-password"
							class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
							>Nueva contraseña</label
						>
						<input
							id="new-password"
							type="password"
							class={inputClass}
							autocomplete="new-password"
							bind:value={newPassword}
						/>
						<p class="m-0 mt-1 text-[11px] text-slate-500 dark:text-white/35">
							Mayúscula, número y carácter especial (!@#$%…)
						</p>
					</div>
					<div>
						<label
							for="confirm-password"
							class="mb-1 block text-[12px] font-medium text-slate-600 dark:text-white/55"
							>Confirmar contraseña</label
						>
						<input
							id="confirm-password"
							type="password"
							class={inputClass}
							autocomplete="new-password"
							bind:value={confirmPassword}
						/>
					</div>
				</div>
				<button
					type="button"
					class="mt-5 w-full rounded-xl bg-cyan-500 py-3 text-[15px] font-bold text-white disabled:opacity-50"
					disabled={changingPassword}
					on:click={handleChangePassword}
				>
					{changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
				</button>
			</div>
		</div>
	{/if}
</section>
