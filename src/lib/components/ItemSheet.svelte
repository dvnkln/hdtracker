<script lang="ts" module>
	import type { Status } from '$lib/status';

	export type SheetItem = {
		source: string;
		externalId: string;
		title: string;
		originalTitle: string | null;
		year: number | null;
		releaseDate: string | null;
		earlyAccess?: boolean; // games only
		posterUrl: string | null;
		overview: string | null;
		status: Status | null;
		// Library items: null while details are still loading (search results don't have it)
		metadataUpdatedAt?: Date | null;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Info, Trash2, X } from '@lucide/svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import {
		allowedStatuses,
		hasEpisodes,
		isReleased,
		statusesFor,
		type Category
	} from '$lib/status';
	import { m, statusLabel } from '$lib/i18n/index.svelte';
	import { titles } from '$lib/titles.svelte';

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
			lastTap = null;
			flash = 0;
			dialog.showModal();
		} else if (dialog.open) {
			dialog.close();
		}
	});

	// Not released yet: only "planned" can be chosen. The other tiles are greyed out; a tap on
	// one makes the year / "TBA" glow red. A double tap sets the status anyway (in case the
	// release date from the API is wrong).
	const DOUBLE_TAP_MS = 400;
	let allowed = $derived(
		item ? allowedStatuses(category, isReleased(item, new Date().toLocaleDateString('sv-SE'))) : []
	);
	let flash = $state(0);
	let forceInput = $state<HTMLInputElement>()!;
	let lastTap: { status: Status; at: number } | null = null;

	function tapLocked(e: MouseEvent, status: Status) {
		const double = lastTap?.status === status && e.timeStamp - lastTap.at <= DOUBLE_TAP_MS;
		lastTap = double ? null : { status, at: e.timeStamp };
		if (double) {
			forceInput.value = '1'; // the tap goes through and submits the form
		} else {
			e.preventDefault();
			flash++;
			// The tapped tile glows red as well and fades back (red-400 / red-500 of the theme).
			(e.currentTarget as HTMLElement).animate(
				[
					{
						color: 'rgb(248 113 113)',
						boxShadow: 'inset 0 0 0 2px rgb(239 68 68 / 0.7), 0 0 0.75rem rgb(239 68 68 / 0.35)'
					},
					{ boxShadow: 'inset 0 0 0 2px rgb(239 68 68 / 0), 0 0 0.75rem rgb(239 68 68 / 0)' }
				],
				{ duration: 700, easing: 'ease-out' }
			);
		}
	}

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
		{@const shown = titles(category, item)}
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
					<h2 class="text-lg leading-tight font-bold">{shown.main}</h2>
					{#if shown.sub}
						<p class="text-sm text-zinc-400">{shown.sub}</p>
					{/if}
					{#key flash}
						<p class="text-sm text-zinc-500 {flash ? 'flash-red' : ''}">
							{#if item.year}{item.year}{item.earlyAccess
									? ` · ${m.common.earlyAccess}`
									: ''}{:else if item.metadataUpdatedAt === null}<span
									title={m.common.loadingDetails}
									class="animate-pulse">…</span
								>{:else}<span title={m.common.tbaHint}>{m.common.tba}</span>{/if}
						</p>
					{/key}
				</div>
				<button
					type="button"
					class="self-start rounded-lg p-1 text-zinc-400 hover:bg-zinc-800"
					aria-label={m.common.close}
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
					{hasEpisodes(category) ? m.sheet.detailsAndEpisodes : m.sheet.details}
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
				<input type="hidden" name="force" bind:this={forceInput} />
				{#each statusesFor(category) as status (status)}
					{@const current = item.status === status}
					{@const locked = !allowed.includes(status)}
					{@const Icon = STATUS_ICONS[status]}
					<!-- Locked tiles stay clickable (not "disabled"): a tap explains, a double tap saves -->
					<button
						name="status"
						value={status}
						disabled={busy}
						aria-pressed={current}
						aria-disabled={locked}
						title={locked ? m.sheet.notReleased : undefined}
						onclick={(e) => {
							forceInput.value = '';
							if (locked) tapLocked(e, status);
						}}
						class="flex min-w-0 flex-1 touch-manipulation flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-colors disabled:opacity-50 {current
							? 'bg-(--accent) text-white shadow-(--accent)/25 shadow-lg hover:brightness-125'
							: locked
								? 'bg-zinc-800/50 text-zinc-600'
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
							class="w-full rounded-lg bg-red-600 p-3 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
						>
							{m.sheet.removeConfirm}
						</button>
					{:else}
						<button
							type="button"
							class="flex w-full items-center justify-center gap-1.5 rounded-lg p-3 text-sm text-red-400 hover:bg-zinc-800"
							onclick={() => (confirmRemove = true)}
						>
							<Trash2 size={16} />
							{m.sheet.remove}
						</button>
					{/if}
				</form>
			{/if}
		</div>
	{/if}
</dialog>
