<script lang="ts">
	import { enhance } from '$app/forms';
	import { autosave } from '#lib/autosave.js';
	import { FormFeedback } from '#lib/forms.svelte.js';
	import { formatDateTime, m } from '#lib/i18n/index.svelte.js';
	import { USERNAME_PATTERN } from '#lib/limits.js';
	import { ui } from '#lib/ui.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import FeedbackText from '#lib/components/FeedbackText.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import SubmitButton, {
		BUTTON_DANGER,
		BUTTON_SECONDARY
	} from '#lib/components/SubmitButton.svelte';
	import {
		Check,
		ChevronDown,
		Copy,
		KeyRound,
		Lock,
		Plus,
		ShieldCheck,
		Trash2,
		Users,
		Webhook
	} from '@lucide/svelte';

	let { data, form } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, pageTitle, actions } = ui;

	// The one account whose details are shown (others stay closed), and whether one is added
	let open = $state<number | null>(null);
	let adding = $state(false);
	// Deleting asks for the username, like emptying a library asks for a word
	let deleting = $state<number | null>(null);

	// The temporary password of the account just created or reset: shown until the page is left
	let created = $derived(form?.created ?? null);
	let copied = $state(false);
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard without https: the password is on the screen, it can be typed off.
		}
	}

	// The small line under a name. The name somebody logs in with is only shown where it
	// differs from the name they are seen under – and only here, to the admin.
	const detailOf = (user: (typeof data.users)[number]) =>
		[
			...(user.person.name !== user.username ? [`@${user.username}`] : []),
			m.users.titles(user.titles),
			stateOf(user)
		].join(' · ');
	const stateOf = (user: (typeof data.users)[number]) =>
		user.disabled
			? m.users.locked
			: user.mustChangePassword
				? m.users.temporary
				: user.lastLoginAt
					? m.users.lastLogin(formatDateTime(user.lastLoginAt))
					: m.users.neverLoggedIn;
</script>

<svelte:head><title>{m.users.title} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.users.title}</h2>

<!-- Shown once: the temporary password of a new account, or of one that was reset -->
{#if created}
	<section class="{card} ui-card border-emerald-700/60">
		<h3 class={heading}><KeyRound size={20} class="text-emerald-400" />{m.users.temporary}</h3>
		<p class="mt-1 text-sm text-zinc-400">{m.users.passwordFor(created.username)}</p>
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<code class="rounded-lg bg-zinc-950 px-3 py-2 text-lg tracking-wider select-all"
				>{created.password}</code
			>
			<button type="button" class={BUTTON_SECONDARY} onclick={() => copy(created.password)}>
				{#if copied}<Check size={16} />{m.settings.copied}{:else}<Copy size={16} />{m.settings
						.copy}{/if}
			</button>
		</div>
		<p class="mt-3 {hint}">{m.users.temporaryHint}</p>
	</section>
{/if}

<section class={card}>
	<h3 class={heading}>
		<Users size={20} class="text-zinc-400" />{m.users.accounts}
		<FeedbackText feedback={forms.messages.list} />
	</h3>

	<ul class="mt-3 flex flex-col divide-y divide-zinc-800">
		{#each data.users as user (user.id)}
			{@const isOpen = open === user.id}
			{@const mine = user.id === data.me}
			<li class="py-2.5">
				<!-- The row: opens and closes what can be done with this account -->
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-lg text-left {user.disabled
						? 'opacity-50'
						: ''}"
					aria-expanded={isOpen}
					onclick={() => {
						open = isOpen ? null : user.id;
						deleting = null;
					}}
				>
					<Avatar person={user.person} class="size-9 text-sm" />
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-1.5 text-sm font-medium">
							<span class="truncate">{user.person.name}</span>
							{#if user.role === 'admin'}
								<ShieldCheck size={15} class="shrink-0 text-zinc-400" aria-label={m.users.admin} />
							{/if}
							{#if mine}<span class="shrink-0 font-normal text-emerald-400">· {m.users.you}</span
								>{/if}
						</span>
						<span class="block truncate text-xs text-zinc-500">
							{detailOf(user)}
						</span>
					</span>
					{#if user.disabled}<Lock size={16} class="shrink-0 text-zinc-500" />{/if}
					<ChevronDown
						size={18}
						class="shrink-0 text-zinc-500 transition-transform {isOpen ? 'rotate-180' : ''}"
					/>
				</button>

				{#if isOpen}
					<div class="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-800 p-3">
						<!-- Role and lock are saved the moment they are switched -->
						<form
							method="POST"
							action="?/role"
							use:enhance={forms.submit(`user-${user.id}`)}
							use:autosave
							class="flex items-start justify-between gap-4"
						>
							<input type="hidden" name="id" value={user.id} />
							<label for="admin-{user.id}" class="flex cursor-pointer flex-col gap-1">
								<span class={labelText}>{m.users.admin}</span>
								<span class={hint}>{m.users.adminHint}</span>
							</label>
							<Switch id="admin-{user.id}" name="admin" checked={user.role === 'admin'} />
						</form>
						{#if !mine}
							<form
								method="POST"
								action="?/lock"
								use:enhance={forms.submit(`user-${user.id}`)}
								use:autosave
								class="flex items-start justify-between gap-4"
							>
								<input type="hidden" name="id" value={user.id} />
								<label for="locked-{user.id}" class="flex cursor-pointer flex-col gap-1">
									<span class={labelText}>{m.users.lock}</span>
									<span class={hint}>{m.users.lockHint}</span>
								</label>
								<Switch id="locked-{user.id}" name="locked" checked={user.disabled} />
							</form>
						{/if}

						<div class="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
							<form method="POST" action="?/reset" use:enhance={forms.submit(`user-${user.id}`)}>
								<input type="hidden" name="id" value={user.id} />
								<button class={BUTTON_SECONDARY}><KeyRound size={16} />{m.users.reset}</button>
							</form>
							{#if !mine}
								<button
									type="button"
									class={BUTTON_DANGER}
									onclick={() => (deleting = deleting === user.id ? null : user.id)}
									><Trash2 size={16} />{m.users.delete}</button
								>
							{/if}
						</div>
						<p class={hint}>{m.users.resetHint}</p>

						{#if deleting === user.id}
							<form
								method="POST"
								action="?/delete"
								use:enhance={forms.submit('list')}
								class="flex flex-col gap-3 rounded-lg border border-red-900 p-3"
							>
								<input type="hidden" name="id" value={user.id} />
								<p class="text-sm">{m.users.deleteWarning(user.username, user.titles)}</p>
								<label class={label}>
									<span class={labelText}>{m.users.confirmLabel(user.username)}</span>
									<input name="confirm" autocomplete="off" autocapitalize="off" required />
								</label>
								<div class={actions}>
									<SubmitButton
										text={m.users.deleteNow}
										busy={forms.busy === 'list'}
										when="filled"
										style={BUTTON_DANGER}
									/>
									<button type="button" class={BUTTON_SECONDARY} onclick={() => (deleting = null)}>
										{m.common.cancel}
									</button>
								</div>
							</form>
						{/if}
						<FeedbackText feedback={forms.error(`user-${user.id}`)} />
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<!-- Adding an account: a name is all it takes -->
	<div class="mt-3">
		{#if adding}
			<form
				method="POST"
				action="?/create"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ navigate: false });
						if (result.type === 'success') adding = false;
					}}
				class="flex flex-col gap-4 rounded-lg border border-zinc-800 p-3"
			>
				<label class={label}>
					<span class={labelText}>{m.auth.username}</span>
					<input
						name="username"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						pattern={USERNAME_PATTERN.source}
						required
					/>
					<span class={hint}>{m.auth.usernameRule}</span>
				</label>
				<div class="flex items-start justify-between gap-4">
					<label for="new-admin" class="flex cursor-pointer flex-col gap-1">
						<span class={labelText}>{m.users.admin}</span>
						<span class={hint}>{m.users.adminHint}</span>
					</label>
					<Switch id="new-admin" name="admin" checked={false} />
				</div>
				<div class={actions}>
					<SubmitButton text={m.users.create} when="filled" />
					<button type="button" class={BUTTON_SECONDARY} onclick={() => (adding = false)}>
						{m.common.cancel}
					</button>
				</div>
				{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
			</form>
		{:else}
			<button type="button" class={BUTTON_SECONDARY} onclick={() => (adding = true)}>
				<Plus size={16} />{m.users.add}
			</button>
		{/if}
	</div>
	<p class="mt-3 {hint}">{m.users.createHint}</p>
</section>

<!-- What everybody may do -->
<section class={card}>
	<h3 class={heading}>
		<Webhook size={20} class="text-zinc-400" />{m.users.rights}
		<FeedbackText feedback={forms.error('rights')} />
	</h3>
	<form
		method="POST"
		action="?/customTargets"
		use:enhance={forms.submit('rights')}
		use:autosave
		class="mt-3 flex items-start justify-between gap-4"
	>
		<label for="customTargets" class="flex cursor-pointer flex-col gap-1">
			<span class={labelText}>{m.users.customTargets}</span>
			<span class={hint}>{m.users.customTargetsHint}</span>
		</label>
		<Switch id="customTargets" name="customTargets" checked={data.customTargets} />
	</form>
</section>
