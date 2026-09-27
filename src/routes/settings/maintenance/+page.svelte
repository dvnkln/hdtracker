<script lang="ts">
	import { enhance } from '$app/forms';
	import { FormFeedback } from '$lib/forms.svelte';
	import { formatDateTime, formatFileSize, m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';
	import { Download, Info, Trash2 } from '@lucide/svelte';
	import TaskCard from './TaskCard.svelte';

	let { data } = $props();

	const forms = new FormFeedback();
	const { label, labelText, hint } = ui;

	// "Alle löschen" needs a second tap to confirm.
	let confirmDeleteAll = $state(false);

	const iconButton =
		'rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100';
</script>

<svelte:head><title>{m.maintenance.title} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-sm px-4 pb-4">
	<p class="mt-4 {hint}">{m.maintenance.intro(data.timeZone)}</p>

	{#each data.tasks as task (task.key)}
		{#if task.key === 'backup'}
			<TaskCard {task} frequencies={data.frequencies} {forms}>
				{#snippet fields()}
					<label class={label}>
						<span class={labelText}>{m.maintenance.keep}</span>
						<input
							type="number"
							name="keep"
							min="1"
							max={data.maxKeep}
							value={data.backupKeep}
							required
							class="w-28"
						/>
					</label>
					<p class="flex gap-2 rounded-lg bg-zinc-800/60 p-3 text-xs text-zinc-400">
						<Info size={16} class="shrink-0" />
						{m.maintenance.volumeHint}
					</p>
				{/snippet}

				<!-- Existing backup files -->
				<div class="mt-6 border-t border-zinc-800 pt-4">
					<div class="flex items-center justify-between gap-3">
						<h3 class="font-medium text-zinc-300">{m.maintenance.backups}</h3>
						{#if data.backups.length}
							<form
								method="POST"
								action="?/deleteAllBackups"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										confirmDeleteAll = false;
									};
								}}
							>
								{#if confirmDeleteAll}
									<span class="flex items-center gap-2 text-sm">
										<button
											class="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-red-500"
										>
											{m.maintenance.deleteAllConfirm}
										</button>
										<button
											type="button"
											class="rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
											onclick={() => (confirmDeleteAll = false)}
										>
											{m.common.close}
										</button>
									</span>
								{:else}
									<button
										type="button"
										class="rounded-lg px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-950"
										onclick={() => (confirmDeleteAll = true)}
									>
										{m.maintenance.deleteAll}
									</button>
								{/if}
							</form>
						{/if}
					</div>

					{#if data.backups.length}
						<ul class="mt-2 divide-y divide-zinc-800">
							{#each data.backups as file (file.name)}
								<li class="flex items-center gap-2 py-1.5">
									<span class="flex-1 text-sm">
										{formatDateTime(file.createdAt)}
										<span class="text-zinc-500">· {formatFileSize(file.size)}</span>
									</span>
									<a
										href="/settings/maintenance/backups/{file.name}"
										download
										class={iconButton}
										aria-label={m.maintenance.download}
										title={m.maintenance.download}
									>
										<Download size={18} />
									</a>
									<form method="POST" action="?/deleteBackup" use:enhance>
										<input type="hidden" name="name" value={file.name} />
										<button
											class="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-950 hover:text-red-400"
											aria-label={m.maintenance.delete}
											title={m.maintenance.delete}
										>
											<Trash2 size={18} />
										</button>
									</form>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-2 text-sm text-zinc-500">{m.maintenance.noBackups}</p>
					{/if}
					<p class="mt-3 {hint}">{m.maintenance.restoreHint}</p>
				</div>
			</TaskCard>
		{:else}
			<TaskCard {task} frequencies={data.frequencies} {forms} />
		{/if}
	{/each}
</main>
