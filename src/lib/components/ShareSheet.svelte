<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Check, LogOut, UserPlus, X } from '@lucide/svelte';
	import type { Person } from '#lib/avatar.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';

	// The window behind the "together" symbol of a title: who tracks along, who is invited, who
	// could be. The actions (invite, withdraw, leave) live on the page of the title.
	type Props = {
		open: boolean;
		title: string;
		companions: Person[];
		// Everybody who could be invited; `invitation` is set while one is open
		candidates: { person: Person; invitation: number | null }[];
		onclose: () => void;
		// Page the actions live on (the page of the title); empty = the current page
		actionPath?: string;
	};
	let { open, title, companions, candidates, onclose, actionPath = '' }: Props = $props();

	let dialog: HTMLDialogElement;
	let busy = $state(false);
	let confirmLeave = $state(false);

	$effect(() => {
		if (open) {
			confirmLeave = false;
			dialog.showModal();
		} else if (dialog.open) {
			dialog.close();
		}
	});

	// Runs in the background; the window stays open and shows the new state.
	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false, navigate: false });
			busy = false;
			confirmLeave = false;
		};
	};

	const small =
		'ui-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium transition-colors enabled:hover:bg-zinc-800 disabled:opacity-50';
</script>

<!-- Tapping the dark backdrop (the dialog element itself) closes the window -->
<dialog
	bind:this={dialog}
	onclose={() => onclose()}
	onclick={(e) => e.target === dialog && onclose()}
	class="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70 sm:mx-auto sm:mb-auto sm:max-w-lg sm:rounded-2xl sm:border"
>
	<div class="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<h2 class="text-lg leading-tight font-bold">{m.share.title}</h2>
				<p class="truncate text-sm text-zinc-400">{title}</p>
			</div>
			<button
				type="button"
				class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800"
				aria-label={m.common.close}
				onclick={onclose}
			>
				<X size={22} />
			</button>
		</div>

		{#if companions.length > 0}
			<h3 class="mt-5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
				{m.share.with}
			</h3>
			<ul class="mt-1 flex flex-col divide-y divide-zinc-800">
				{#each companions as person (person.id)}
					<li class="flex items-center gap-3 py-2.5">
						<Avatar {person} class="size-9 text-sm" />

						<span class="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>

						<Check size={18} class="shrink-0 text-emerald-400" aria-hidden="true" />
					</li>
				{/each}
			</ul>
		{/if}

		{#if candidates.length > 0}
			<h3 class="mt-5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
				{m.share.invite}
			</h3>
			<ul class="mt-1 flex flex-col divide-y divide-zinc-800">
				{#each candidates as { person, invitation } (person.id)}
					<li class="flex items-center gap-3 py-2.5">
						<Avatar {person} class="size-9 text-sm" />
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium">{person.name}</span>
							{#if invitation !== null}
								<span class="block text-xs text-amber-400">{m.share.pending}</span>
							{/if}
						</span>
						{#if invitation === null}
							<form method="POST" action="{actionPath}?/invite" use:enhance={submit}>
								<input type="hidden" name="to" value={person.id} />
								<button class={small} disabled={busy} aria-label={m.share.inviteName(person.name)}>
									<UserPlus size={16} />{m.share.inviteAction}
								</button>
							</form>
						{:else}
							<form method="POST" action="{actionPath}?/withdraw" use:enhance={submit}>
								<input type="hidden" name="id" value={invitation} />
								<button
									class={small}
									disabled={busy}
									aria-label={m.share.withdrawName(person.name)}
								>
									{m.share.withdraw}
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs text-zinc-500">{m.share.inviteHint}</p>
		{/if}

		{#if companions.length > 0}
			<div class="mt-5 border-t border-zinc-800 pt-4">
				{#if confirmLeave}
					<p class="text-sm text-zinc-300">{m.share.leaveHint}</p>
					<form
						method="POST"
						action="{actionPath}?/leave"
						use:enhance={submit}
						class="mt-3 flex gap-2"
					>
						<button class="{small} border-red-900 text-red-400" disabled={busy}
							><LogOut size={16} />{m.share.leaveNow}</button
						>

						<button type="button" class={small} onclick={() => (confirmLeave = false)}
							>{m.common.cancel}</button
						>
					</form>
				{:else}
					<button type="button" class={small} onclick={() => (confirmLeave = true)}
						><LogOut size={16} />{m.share.leave}</button
					>
				{/if}
			</div>
		{/if}
	</div>
</dialog>
