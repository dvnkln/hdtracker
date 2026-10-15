<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { UserPlus, X } from '@lucide/svelte';
	import type { Person } from '#lib/avatar.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';

	// Whom to invite to the titles selected in the library. Each person is a form of its own:
	// one tap invites them to all of the titles (action "invite" of the library page).
	type Props = {
		open: boolean;
		people: Person[];
		// The selected titles
		ids: number[];
		onclose: () => void;
		// Called when the invitations went out, with what the server answered
		ondone: (answer: { invited: number; already: number; to: number }) => void;
	};
	let { open, people, ids, onclose, ondone }: Props = $props();

	let dialog: HTMLDialogElement;
	let busy = $state(false);

	$effect(() => {
		if (open) dialog.showModal();
		else if (dialog.open) dialog.close();
	});

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			await update({ reset: false, navigate: false });
			busy = false;
			if (result.type === 'success') {
				ondone(result.data as { invited: number; already: number; to: number });
			} else onclose();
		};
	};
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
				<h2 class="text-lg leading-tight font-bold">{m.share.chooseWho}</h2>
				<p class="text-sm text-zinc-400">{m.share.selected(ids.length)}</p>
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
		<ul class="mt-3 flex flex-col divide-y divide-zinc-800">
			{#each people as person (person.id)}
				<li>
					<form
						method="POST"
						action="?/invite"
						use:enhance={submit}
						class="flex items-center gap-3 py-2.5"
					>
						{#each ids as id (id)}<input type="hidden" name="id" value={id} />{/each}
						<input type="hidden" name="to" value={person.id} />
						<Avatar {person} class="size-9 text-sm" />

						<span class="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>

						<button
							class="ui-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium transition-colors enabled:hover:bg-zinc-800 disabled:opacity-50"
							disabled={busy}
							aria-label={m.share.inviteName(person.name)}
						>
							<UserPlus size={16} />{m.share.inviteAction}
						</button>
					</form>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-xs text-zinc-500">{m.share.inviteHint}</p>
	</div>
</dialog>
