<script>
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { apiService } from '$lib/services/api.js';

	// State
	let users = [];
	let selectedUserId = '';
	let units = [];
	let assignments = []; // Array of assignment objects
	let mergedUnits = []; // Units with 'assigned' and 'assignment_id' properties

	// Loading states
	let loadingUsers = false;
	let loadingData = false;
	let loadingAssignment = {}; // { unitId: boolean }

	// Error/Toast states
	let error = null;
	let toast = null; // { message, type: 'success'|'error' }
	let toastTimeout;

	// Load users on mount
	onMount(async () => {
		loadingUsers = true;
		try {
			const allUsers = await apiService.getUsers();
			// Filter out masters as per requirements
			users = allUsers.filter((u) => !u.is_master);
		} catch (e) {
			console.error('Error loading users:', e);
			showToast('Error al cargar usuarios', 'error');
		} finally {
			loadingUsers = false;
		}
	});

	// Handle user selection change
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
			// Fetch units and assignments in parallel
			const [unitsData, assignmentsData] = await Promise.all([
				apiService.getUnits(),
				apiService.request(`/api/v1/user-units/?user_id=${selectedUserId}`, { method: 'GET' })
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

	// Merge units and assignments to build the UI list
	function mergeData() {
		// Create a map of unit_id -> assignment object
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

	// Handle checkbox toggle
	async function toggleAssignment(unit) {
		if (loadingAssignment[unit.id]) return;

		const isAssigned = unit.assigned;
		const newAssignedState = !isAssigned;

		// Optimistic update
		loadingAssignment[unit.id] = true;
		// We update the local state immediately for responsiveness
		// but we keep the 'loadingAssignment' true to show the spinner
		// The checkbox UI will reflect 'assigned' state, but we can also use the spinner to indicate pending sync.

		// NOTE: Svelte reactivity needs assignment to trigger update if we were modifying the array directly
		// But here we are just toggling a checkbox. To be safe and clean, let's wait for the API.
		// Actually, requirement says "Optimistic update is allowed".
		// Let's update the UI state first.
		unit.assigned = newAssignedState;
		mergedUnits = [...mergedUnits]; // Trigger reactivity

		try {
			if (newAssignedState) {
				// Create assignment
				const response = await apiService.request('/api/v1/user-units/', {
					method: 'POST',
					body: JSON.stringify({
						user_id: selectedUserId,
						unit_id: unit.id,
						role: 'viewer'
					})
				});
				// Update with real assignment ID
				unit.assignment_id = response.id;
				showToast('Unidad asignada correctamente', 'success');
			} else {
				// Delete assignment
				if (unit.assignment_id) {
					await apiService.request(`/api/v1/user-units/${unit.assignment_id}`, {
						method: 'DELETE'
					});
					unit.assignment_id = null;
					showToast('Acceso removido correctamente', 'success');
				}
			}
		} catch (e) {
			console.error('Error updating assignment:', e);
			// Rollback
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

<div class="p-1">
	<!-- User Selection Dropdown -->
	<div class="mb-4">
		<label for="user-select" class="block text-xs font-medium text-app opacity-70 mb-1 ml-1"
			>Seleccionar Usuario</label
		>
		<div class="relative">
			{#if loadingUsers}
				<div class="absolute right-3 top-2.5">
					<svg
						class="animate-spin h-4 w-4 text-accent-cyan"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				</div>
			{/if}
			<select
				id="user-select"
				bind:value={selectedUserId}
				on:change={handleUserChange}
				disabled={loadingUsers}
				class="w-full px-3 py-2 text-sm rounded-lg input-field bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all appearance-none"
			>
				<option value="" class="bg-[var(--app-bg)]">-- Seleccionar --</option>
				{#each users as user}
					<option value={user.id} class="bg-[var(--app-bg)]">
						{user.full_name || user.email}
					</option>
				{/each}
			</select>
			<!-- Custom arrow -->
			<div
				class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-app opacity-50"
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
		</div>
	</div>

	<!-- Content Area -->
	{#if selectedUserId}
		{#if loadingData}
			<div class="flex justify-center py-8">
				<svg
					class="animate-spin h-6 w-6 text-accent-cyan"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		{:else if error}
			<div
				class="text-center py-4 text-red-400 text-sm bg-red-500/10 rounded-lg border border-red-500/20"
			>
				{error}
				<button
					on:click={handleUserChange}
					class="block mx-auto mt-2 text-xs underline hover:text-red-300"
				>
					Reintentar
				</button>
			</div>
		{:else if mergedUnits.length === 0}
			<div class="text-center py-6 text-app opacity-50 text-sm italic">
				No hay unidades disponibles en el cliente.
			</div>
		{:else}
			<div class="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
				{#each mergedUnits as unit (unit.id)}
					<div
						class="flex items-center justify-between p-3 rounded-lg bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors group"
					>
						<div class="flex flex-col overflow-hidden">
							<span class="font-medium text-sm text-app truncate">{unit.name}</span>
							{#if unit.device_id}
								<span class="text-[10px] text-app opacity-50 font-mono truncate"
									>ID: {unit.device_id}</span
								>
							{/if}
						</div>

						<div class="flex items-center gap-3 pl-2">
							{#if loadingAssignment[unit.id]}
								<svg
									class="animate-spin h-4 w-4 text-accent-cyan"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							{/if}

							<label class="relative inline-flex items-center cursor-pointer">
								<input
									type="checkbox"
									class="sr-only peer"
									checked={unit.assigned}
									on:change={() => toggleAssignment(unit)}
									disabled={loadingAssignment[unit.id]}
								/>
								<div
									class="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-cyan/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-cyan"
								></div>
							</label>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Toast Notification -->
	{#if toast}
		<div
			transition:fade={{ duration: 200 }}
			class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap"
			class:bg-green-500={toast.type === 'success'}
			class:text-white={toast.type === 'success'}
			class:bg-red-500={toast.type === 'error'}
		>
			{#if toast.type === 'success'}
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			{:else}
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			{/if}
			{toast.message}
		</div>
	{/if}
</div>

<style>
	/* Custom Scrollbar for the list */
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 2px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
