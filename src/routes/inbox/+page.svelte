<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { Person } from '#lib/avatar.js';
	import { CATEGORIES, type Category } from '#lib/categories.js';
	import { eventLabel } from '#lib/eventLabel.js';
	import { formatDate, m, statusLabel } from '#lib/i18n/index.svelte.js';
	import { img } from '#lib/images.js';
	import { FOLD, newsShown } from '#lib/inboxFold.js';
	import { reportSeen } from '#lib/seen.js';
	import { titles } from '#lib/titles.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '#lib/components/SubmitButton.svelte';
	import type { NoticeLine } from '#lib/server/notices.js';
	import {
		ChevronDown,
		ChevronRight,
		ImageOff,
		Inbox,
		Mail,
		Newspaper,
		Play,
		Send,
		Trash2
	} from '@lucide/svelte';

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
		if (line.announced) {
			const what = m.inbox.announced(line.announced.season);
			return line.announced.date
				? `${what} · ${m.inbox.startsOn(formatDate(line.announced.date))}`
				: what;
		}
		const name = line.actor?.name ?? '';
		return line.kind === 'accepted'
			? m.inbox.accepted(name)
			: line.kind === 'declined'
				? m.inbox.declined(name)
				: m.inbox.left(name);
	}

	// Long lists show their first entries, the rest unfolds – so that what waits for a decision
	// is not pushed off the screen. News that are unread are never folded away: opening this
	// page marks everything as read, so everything unread has to be on it.
	let all = $state({ news: false, waiting: false });
	let shown = $derived(newsShown(data.notices.map((line) => line.unread)));

	let empty = $derived(data.incoming.length + data.notices.length + data.outgoing.length === 0);
	const heading = 'flex items-center gap-2 text-lg font-bold';
	const small = 'px-3 py-1.5 text-sm';
	// Round buttons of an invitation, as on the page of a title
	const pill =
		'ui-btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5';
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

<!-- "4 more" below a folded list, "Show less" below an unfolded one -->
{#snippet more(list: 'news' | 'waiting', hidden: number)}
	{#if hidden > 0}
		<button
			type="button"
			aria-expanded={all[list]}
			onclick={() => (all[list] = !all[list])}
			class="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
		>
			<ChevronDown size={16} class="transition-transform {all[list] ? 'rotate-180' : ''}" />
			{all[list] ? m.inbox.less : m.inbox.more(hidden)}
		</button>
	{/if}
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
				{#each data.incoming as invitation (invitation.ids[0])}
					{@const cat = CATEGORIES[invitation.item.category]}
					<li
						style:--accent={cat.accent}
						class="ui-card rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
					>
						<!-- Like the head of a title's page in small: poster, beside it title, who invites,
						     and below one row of round buttons that all start where the text starts -->
						<div class="flex gap-3">
							<a
								href="/{invitation.item.category}/{invitation.item.externalId}"
								tabindex="-1"
								aria-hidden="true"
								class="aspect-[2/3] w-14 shrink-0 self-start overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 transition-shadow duration-100 hover:ring-(--accent) sm:w-16"
							>
								{#if img(invitation.item.posterUrl)}
									<img
										src={img(invitation.item.posterUrl)}
										alt=""
										loading="lazy"
										referrerpolicy="no-referrer"
										class="h-full w-full object-cover"
									/>
								{:else}
									<div class="flex h-full items-center justify-center text-zinc-600">
										<ImageOff size={18} />
									</div>
								{/if}
							</a>
							<div class="min-w-0 flex-1">
								<div class="flex items-start gap-2">
									<a
										href="/{invitation.item.category}/{invitation.item.externalId}"
										class="group/row min-w-0 flex-1"
									>
										<p
											class="line-clamp-2 leading-snug font-medium transition-colors duration-100 group-hover/row:text-(--accent)"
										>
											{titles(invitation.item.category, invitation.item).main}
											{#if invitation.seasons}
												<!-- The seasons of a series, answered together -->
												<span class="font-normal text-zinc-500">
													· {m.animeSeries.seasons(invitation.seasons)}</span
												>
											{/if}
										</p>
										<p class="mt-0.5 flex items-start gap-1.5 text-sm text-zinc-400">
											<cat.icon size={14} class="mt-[3px] shrink-0 text-(--accent)" />
											<span
												>{m.share.fromWithStatus(
													invitation.from.name,
													statusLabel(invitation.item.category, invitation.status)
												)}</span
											>
										</p>
									</a>
									<Avatar person={invitation.from} class="size-7 shrink-0 text-xs" />
								</div>
								<div class="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
									<form method="POST" action="?/accept" use:enhance>
										{#each invitation.ids as id (id)}
											<input type="hidden" name="id" value={id} />
										{/each}
										<button class="{pill} ui-primary bg-zinc-100 text-zinc-900 hover:bg-zinc-300"
											>{m.share.accept}</button
										>
									</form>
									<form method="POST" action="?/decline" use:enhance>
										{#each invitation.ids as id (id)}
											<input type="hidden" name="id" value={id} />
										{/each}
										<button class="{pill} border border-zinc-600 hover:bg-zinc-800"
											>{m.share.decline}</button
										>
									</form>
									{#if invitation.trailerUrl}
										<!-- On a phone only the symbol: three words do not fit next to each other -->
										<a
											href={invitation.trailerUrl}
											target="_blank"
											rel="noreferrer"
											title={m.detail.trailer}
											class="{pill} self-stretch border border-zinc-600 hover:bg-zinc-800 max-sm:px-2"
											><Play size={15} /><span class="max-sm:sr-only">{m.detail.trailer}</span></a
										>
									{/if}
								</div>
							</div>
						</div>
						{#if invitation.own}
							<Notice kind="warning" class="mt-3">{m.share.replaces}</Notice>
						{/if}
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
				{#each all.waiting ? data.outgoing : data.outgoing.slice(0, FOLD) as invitation (invitation.id)}
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
			{@render more('waiting', data.outgoing.length - FOLD)}
		</section>
	{/if}

	{#if data.notices.length > 0}
		<section class="mb-8">
			<h2 class={heading}>
				<Newspaper size={20} class="text-zinc-400" />{m.inbox.news}
				<!-- Empties the list before the week is over (only what was read – and opening this
				     page reads everything) -->
				<form method="POST" action="?/clear" use:enhance class="ml-auto">
					<button
						class="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
						title={m.inbox.clearRead}
						aria-label={m.inbox.clearRead}
					>
						<Trash2 size={18} />
					</button>
				</form>
			</h2>
			<ul class="mt-1">
				{#each all.news ? data.notices : data.notices.slice(0, shown) as line (line.key)}
					<li class="flex items-center">
						{@render title(line.item, line.actor ? [line.actor] : [], said(line), line.unread)}
					</li>
				{/each}
			</ul>
			{@render more('news', data.notices.length - shown)}
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
