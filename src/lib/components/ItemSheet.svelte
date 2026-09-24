<script lang="ts" module>
	import type { Status } from '$lib/status';

	export type SheetItem = {
		source: string;
		externalId: string;
		title: string;
		originalTitle: string | null;
		year: number | null;
		posterUrl: string | null;
		overview: string | null;
		status: Status | null;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Info, Trash2, X } from '@lucide/svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import { statusesFor, statusLabel, type Category } from '$lib/status';

	type Props = {
		category: Category;
		item: SheetItem | null;
		onclose: () => void;
		// Page whose form actions save/remove live on (the category page by default)
		actionPath?: string;
		showDetailsLink?: boolean;
	};
	let { category, item, onclose, actionPath = '', showDetailsLink = true }: Props = $props();

	let dialog: HTMLDialogElement;
	let confirmRemove = $state(false);
	let busy = $state(false);

	// Open the native dialog whenever an item is selected.
	$effect(() => {
		if (item) {
			confirmRemove = false;
			dialog.showModal();
		} else if (dialog.open) {
			dialog.close();
		}
	});

	// Data sent to the server when saving (everything except the current status).
	let itemJson = $derived(item ? JSON.stringify({ ...item, status: undefined }) : '');

	// Submit in the background, refresh the page data, then close.
	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			await update();
			busy = false;
			if (result.type === 'success') onclose();
		};
	};
</script>

<!-- Tapping the dark backdrop (the dialog element itself) closes the sheet -->
<dialog
	bind:this={dialog}
	onclose={() => onclose()}
	onclick={(e) => e.target === dialog && onclose()}
	class="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70 sm:mx-auto sm:mb-auto sm:max-w-lg sm:rounded-2xl sm:border"
>
	{#if item}
		<div class="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
			<div class="flex gap-4">
				{#if item.posterUrl}
					<img
						src={item.posterUrl}
						alt=""
						referrerpolicy="no-referrer"
						class="aspect-[2/3] w-20 shrink-0 rounded-lg object-cover"
					/>
				{/if}
				<div class="min-w-0 flex-1">
					<h2 class="text-lg leading-tight font-bold">{item.title}</h2>
					{#if item.originalTitle}
						<p class="text-sm text-zinc-400">{item.originalTitle}</p>
					{/if}
					<p class="text-sm text-zinc-500">{item.year ?? '–'}</p>
				</div>
				<button
					type="button"
					class="self-start rounded-lg p-1 text-zinc-400 hover:bg-zinc-800"
					aria-label="Schließen"
					onclick={onclose}
				>
					<X size={22} />
				</button>
			</div>

			{#if item.overview}
				<p class="mt-3 line-clamp-6 text-sm text-zinc-300">{item.overview}</p>
			{/if}

			{#if showDetailsLink}
				<a
					href="/{category}/{item.externalId}"
					class="mt-4 flex items-center justify-center gap-2 rounded-xl border border-zinc-700 p-3 text-sm font-medium hover:bg-zinc-800"
				>
					<Info size={18} class="text-(--accent)" />
					{category === 'serien' || category === 'anime' ? 'Details & Folgen' : 'Details'}
				</a>
			{/if}

			<!-- One row of equally wide status tiles: icon on top, label below -->
			<form
				method="POST"
				action="{actionPath}?/save"
				use:enhance={submit}
				class="mt-5 flex gap-1.5"
			>
				<input type="hidden" name="item" value={itemJson} />
				{#each statusesFor(category) as status (status)}
					{@const current = item.status === status}
					{@const Icon = STATUS_ICONS[status]}
					<button
						name="status"
						value={status}
						disabled={busy}
						aria-pressed={current}
						class="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-colors disabled:opacity-50 {current
							? 'bg-(--accent) text-white shadow-(--accent)/25 shadow-lg'
							: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-700'}"
					>
						<Icon size={22} strokeWidth={current ? 2.5 : 2} />
						<span class="w-full text-center text-[11px] leading-tight font-medium hyphens-manual">
							{statusLabel(category, status)}
						</span>
					</button>
				{/each}
			</form>

			{#if item.status}
				<form method="POST" action="{actionPath}?/remove" use:enhance={submit} class="mt-4">
					<input type="hidden" name="externalId" value={item.externalId} />
					{#if confirmRemove}
						<button
							disabled={busy}
							class="w-full rounded-lg bg-red-600 p-3 text-sm font-medium text-white disabled:opacity-50"
						>
							Wirklich aus der Bibliothek entfernen?
						</button>
					{:else}
						<button
							type="button"
							class="flex w-full items-center justify-center gap-1.5 rounded-lg p-3 text-sm text-red-400 hover:bg-zinc-800"
							onclick={() => (confirmRemove = true)}
						>
							<Trash2 size={16} /> Aus Bibliothek entfernen
						</button>
					{/if}
				</form>
			{/if}
		</div>
	{/if}
</dialog>
