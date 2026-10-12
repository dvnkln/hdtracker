<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { Person } from '$lib/avatar';
	import { CATEGORIES, type Category } from '$lib/categories';
	import { eventLabel } from '$lib/eventLabel';
	import { formatDate, m, statusLabel } from '$lib/i18n/index.svelte';
	import { img } from '$lib/images';
	import { reportSeen } from '$lib/seen';
	import { titles } from '$lib/titles.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '$lib/components/SubmitButton.svelte';
	import type { NoticeLine } from '$lib/server/notices';
	import { ChevronRight, ImageOff, Inbox, Mail, Newspaper, Send } from '@lucide/svelte';

	let { data, form } = $props();

	type Shown = {
		category: Category;
		externalId: string;
		title: string;
		originalTitle: string | null;
		posterUrl: string | null;
	};

	// Now that it is on screen, everything here counts as read. What was unread keeps its
	// mark until the page is left.
	onMount(() => {
		if (data.notices.some((line) => line.unread)) reportSeen('?/seen');
	});

	// What a notice says, below the title
	function said(line: NoticeLine) {
		if (line.release) {
			const what = eventLabel({ category: line.item.category, ...line.release }, m);
			return line.release.date ? `${what} · ${formatDate(line.release.date)}` : what;
		}
		const name = line.actor?.name ?? '';
		return line.kind === 'accepted'
			? m.inbox.accepted(name)
			: line.kind === 'declined'
				? m.inbox.declined(name)
				: m.inbox.left(name);
	}

	let empty = $derived(data.incoming.length + data.notices.length + data.outgoing.length === 0);
	const heading = 'flex items-center gap-2 text-lg font-bold';
	const small = 'px-3 py-1.5 text-sm';
</script>

<svelte:head><title>{m.inbox.title} · hdtracker</title></svelte:head>

<!-- Poster and title of a row; the whole thing leads to the page of the title -->
{#snippet title(item: Shown, people: Person[], line: string, unread = false)}
	{@const cat = CATEGORIES[item.category]}
	<a
		href="/{item.category}/{item.externalId}"
		style:--accent={cat.accent}
		class="group/row -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors duration-100 hover:bg-zinc-900"
	>
		<div
			class="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded bg-zinc-900 ring-1 ring-zinc-800 transition-shadow duration-100 group-hover/row:ring-(--accent)"
		>
			{#if img(item.posterUrl)}
				<img
					src={img(item.posterUrl)}
					alt=""
					loading="lazy"
					referrerpolicy="no-referrer"
					class="h-full w-full object-cover"
				/>
			{:else}
				<div class="flex h-full items-center justify-center text-zinc-600">
					<ImageOff size={16} />
				</div>
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<p
				class="truncate font-medium transition-colors duration-100 group-hover/row:text-(--accent)"
			>
				{titles(item.category, item).main}
			</p>
			<p class="flex items-center gap-1.5 text-sm text-zinc-400">
				<cat.icon size={14} class="shrink-0 text-(--accent)" />
				<span class="truncate">{line}</span>
			</p>
		</div>
		<span class="flex shrink-0 -space-x-1.5">
			{#each people.slice(0, 3) as person (person.id)}
				<Avatar {person} class="size-7 text-xs ring-2 ring-zinc-950" />
			{/each}
		</span>
		{#if unread}
			<span class="size-2.5 shrink-0 rounded-full bg-red-500" title={m.inbox.unread}>
				<span class="sr-only">{m.inbox.unread}</span>
			</span>
		{/if}
	</a>
{/snippet}

<main class="mx-auto max-w-screen-md px-4 py-6">
	<h1 class="sr-only">{m.inbox.title}</h1>

	{#if form?.error}
		<Notice kind="warning" class="mb-4">{form.error}</Notice>
	{/if}

	{#if empty}
		<EmptyState icon={Inbox} title={m.inbox.emptyTitle} text={m.inbox.emptyHint} />
	{/if}

	{#if data.incoming.length > 0}
		<section class="mb-8">
			<h2 class={heading}>
				<Mail size={20} class="text-zinc-400" />{m.share.incoming}
				<span class="text-sm font-normal text-zinc-500">{data.incoming.length}</span>
			</h2>
			<ul class="mt-2 flex flex-col gap-3">
				{#each data.incoming as invitation (invitation.id)}
					{@const cat = CATEGORIES[invitation.item.category]}
					<li
						style:--accent={cat.accent}
						class="ui-card rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
					>
						<div class="flex">
							{@render title(
								invitation.item,
								[invitation.from],
								m.share.fromWithStatus(
									invitation.from.name,
									statusLabel(invitation.item.category, invitation.status)
								)
							)}
						</div>
						{#if invitation.own}
							<p class="mt-1 text-sm text-amber-400">{m.share.replaces}</p>
						{/if}
						<div class="mt-2 flex gap-2">
							<form method="POST" action="?/accept" use:enhance>
								<input type="hidden" name="id" value={invitation.id} />
								<button class="{BUTTON_PRIMARY} {small}">{m.share.accept}</button>
							</form>
							<form method="POST" action="?/decline" use:enhance>
								<input type="hidden" name="id" value={invitation.id} />
								<button class="{BUTTON_SECONDARY} {small}">{m.share.decline}</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.notices.length > 0}
		<section class="mb-8">
			<h2 class={heading}>
				<Newspaper size={20} class="text-zinc-400" />{m.inbox.news}
			</h2>
			<ul class="mt-1">
				{#each data.notices as line (line.key)}
					<li class="flex items-center">
						{@render title(line.item, line.actor ? [line.actor] : [], said(line), line.unread)}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.outgoing.length > 0}
		<section class="mb-8">
			<h2 class={heading}>
				<Send size={20} class="text-zinc-400" />{m.share.outgoing}
				<span class="text-sm font-normal text-zinc-500">{data.outgoing.length}</span>
			</h2>
			<ul class="mt-1">
				{#each data.outgoing as invitation (invitation.id)}
					<li class="flex items-center gap-2">
						{@render title(
							invitation.item,
							[invitation.to],
							m.share.waitingFor(invitation.to.name)
						)}
						<form method="POST" action="?/withdraw" use:enhance>
							<input type="hidden" name="id" value={invitation.id} />
							<button
								class="{BUTTON_SECONDARY} {small}"
								aria-label={m.share.withdrawName(invitation.to.name)}>{m.share.withdraw}</button
							>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="text-center">
		<a
			href="/settings/notifications"
			class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
		>
			{m.inbox.pushSettings}<ChevronRight size={14} />
		</a>
	</p>
</main>
