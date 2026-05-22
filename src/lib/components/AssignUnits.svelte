<script>
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { apiService } from '$lib/services/api.js';

	const inputClass =
		'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-[13px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white';

	let users = [];
	let selectedUserId = '';
	let units = [];
	let assignments = [];
	let mergedUnits = [];

	let loadingUsers = false;
	let loadingData = false;
	let loadingAssignment = {};

	let error = null;
	let toast = null;
	let toastTimeout;

	onMount(async () => {
		loadingUsers = true;
		try {
			const allUsers = await apiService.getUsers();
			users = allUsers.filter((u) => !u.is_master);
		} catch (e) {
			console.error('Error loading users:', e);
			showToast('Error al cargar usuarios', 'error');
		} finally {
			loadingUsers = false;
		}
	});

	async function handleUserChange() {
		if (!selectedUserId) {
			units = [];
			assignments = [];
			mergedUnits = [];
			return;
		}

		loadingData = true;
		error = null;
		try {
			const [unitsData, assignmentsData] = await Promise.all([
				apiService.getUnits(),
				apiService.getUserUnits(selectedUserId)
			]);

			units = unitsData;
			assignments = assignmentsData;
			mergeData();
		} catch (e) {
			console.error('Error loading data:', e);
			error = 'No se pudieron cargar los datos. Intente nuevamente.';
			showToast('Error al cargar datos', 'error');
		} finally {
			loadingData = false;
		}
	}

	function mergeData() {
		const assignmentMap = new Map();
		assignments.forEach((a) => {
			assignmentMap.set(a.unit_id, a);
		});

		mergedUnits = units.map((u) => {
			const assignment = assignmentMap.get(u.id);
			return {
				...u,
				assigned: !!assignment,
				assignment_id: assignment ? assignment.id : null
			};
		});
	}

	async function toggleAssignment(unit) {
		if (loadingAssignment[unit.id]) return;

		const isAssigned = unit.assigned;
		const newAssignedState = !isAssigned;

		loadingAssignment[unit.id] = true;
		unit.assigned = newAssignedState;
		mergedUnits = [...mergedUnits];

		try {
			if (newAssignedState) {
				const response = await apiService.request('/api/v1/user-units', {
					method: 'POST',
					body: JSON.stringify({
						user_id: selectedUserId,
						unit_id: unit.id,
						role: 'viewer'
					})
				});
				unit.assignment_id = response.id;
				showToast('Unidad asignada correctamente', 'success');
			} else if (unit.assignment_id) {
				await apiService.deleteUserUnit(unit.assignment_id);
				unit.assignment_id = null;
				showToast('Acceso removido correctamente', 'success');
			}
		} catch (e) {
			console.error('Error updating assignment:', e);
			unit.assigned = isAssigned;
			mergedUnits = [...mergedUnits];
			showToast('Error al actualizar asignación', 'error');
		} finally {
			loadingAssignment[unit.id] = false;
		}
	}

	function showToast(message, type = 'success') {
		if (toastTimeout) clearTimeout(toastTimeout);
		toast = { message, type };
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 3000);
	}
</script>

<div class="relative space-y-3">
	<label class="block">
		<span
			class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/35"
		>
			Seleccionar usuario
		</span>
		<div class="relative">
			<select
				id="user-select"
				bind:value={selectedUserId}
				on:change={handleUserChange}
				disabled={loadingUsers}
				class={inputClass}
			>
				<option value="">— Seleccionar —</option>
				{#each users as user}
					<option value={user.id}>{user.full_name || user.email}</option>
				{/each}
			</select>
			{#if loadingUsers}
				<Icon
					icon="mdi:loading"
					class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600 dark:text-blue-400"
					aria-hidden="true"
				/>
			{:else}
				<Icon
					icon="mdi:chevron-down"
					width={16}
					class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
					aria-hidden="true"
				/>
			{/if}
		</div>
	</label>

	{#if selectedUserId}
		{#if loadingData}
			<div class="flex items-center gap-2 py-4 text-blue-600 dark:text-blue-400">
				<Icon icon="mdi:loading" class="h-5 w-5 animate-spin" aria-hidden="true" />
				<span class="text-[12px]">Cargando permisos…</span>
			</div>
		{:else if error}
			<div
				class="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-[12px] text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
			>
				{error}
				<button
					type="button"
					on:click={handleUserChange}
					class="mt-2 text-[11px] font-semibold text-red-600 underline hover:no-underline dark:text-red-300"
				>
					Reintentar
				</button>
			</div>
		{:else if mergedUnits.length === 0}
			<p class="m-0 py-2 text-[12px] italic text-slate-500 dark:text-white/35">
				No hay unidades disponibles en el cliente.
			</p>
		{:else}
			<ul class="m-0 list-none space-y-2 p-0">
				{#each mergedUnits as unit (unit.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
					>
						<div class="min-w-0">
							<p class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
								{unit.name}
							</p>
							{#if unit.device_id}
								<p
									class="m-0 mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-white/40"
								>
									{unit.device_id}
								</p>
							{/if}
						</div>

						<div class="flex shrink-0 items-center gap-2">
							{#if loadingAssignment[unit.id]}
								<Icon
									icon="mdi:loading"
									class="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
									aria-hidden="true"
								/>
							{/if}

							<label class="relative inline-flex cursor-pointer items-center">
								<input
									type="checkbox"
									class="peer sr-only"
									checked={unit.assigned}
									on:change={() => toggleAssignment(unit)}
									disabled={loadingAssignment[unit.id]}
								/>
								<div
									class="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-blue-500/30 peer-disabled:opacity-50 dark:bg-white/20"
									aria-hidden="true"
								></div>
							</label>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
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
