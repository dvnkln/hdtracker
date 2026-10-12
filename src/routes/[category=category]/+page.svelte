<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Joystick, Origami, Popcorn, SearchX, Sofa } from '@lucide/svelte';
	import { CATEGORIES } from '$lib/categories';
	import { COLLAPSED_STATUSES, statusesFor, type Status } from '$lib/status';
	import { m, statusLabel } from '$lib/i18n/index.svelte';
	import { NOTHING, pickAll, pickOne, pickRange } from '$lib/selection';
	import { sharingFor } from '$lib/sharing';
	import { toast } from '$lib/toasts.svelte';
	import { titles } from '$lib/titles.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PeopleSheet from '$lib/components/PeopleSheet.svelte';
	import PosterCard from '$lib/components/PosterCard.svelte';
	import { BUTTON_PRIMARY } from '$lib/components/SubmitButton.svelte';
	import ItemSheet, { type SheetItem } from '$lib/components/ItemSheet.svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import { ChevronRight, UserPlus, X } from '@lucide/svelte';

	let { data, form } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	let label = $derived(m.categories[data.category]);

	// Library grouped by status, in section order; empty sections are skipped.
	let sections = $derived(
		statusesFor(data.category)
			.map((status) => ({ status, items: data.library.filter((i) => i.status === status) }))
			.filter((s) => s.items.length > 0)
	);

	// Item shown in the bottom sheet (null = closed)
	let selected = $state<SheetItem | null>(null);

	// Selecting several titles to invite somebody to all of them at once. Only offered while
	// there is somebody to invite.
	let selecting = $state(false);
	let choosingWho = $state(false);
	// Sections the user folded or unfolded (those not listed are as they come: watched and
	// dropped folded). What is folded away is not selected by Ctrl+A or a Shift+click.
	let folded = $state<Partial<Record<Status, boolean>>>({});
	const isOpen = (status: Status) => !(folded[status] ?? COLLAPSED_STATUSES.includes(status));
	// The posters one can see, in reading order
	let visibleIds = $derived(
		sections.filter((s) => isOpen(s.status)).flatMap((s) => s.items.map((item) => item.id))
	);

	// Holding a poster (phone), a right click or Ctrl+click (computer) starts selecting with that
	// title; from then on every tap adds or takes away. A Shift+click adds everything from the
	// poster chosen last up to this one. With nothing left selected it is over.
	// (The rules of picking – anchor, range, what stays – are in selection.ts.)
	let selection = $state.raw(NOTHING);
	let chosen = $derived(selection.chosen);
	function select(next: typeof selection) {
		selection = next;
		selecting = next.chosen.length > 0;
		if (!selecting) stopSelecting();
	}
	const pick = (id: number, range = false) =>
		select(range ? pickRange(selection, visibleIds, id) : pickOne(selection, id));
	let canSelect = $derived(data.people.length > 0);

	// The window of the tapped title also holds its bell and tracking together – for titles of
	// the library, always from the current data
	let current = $derived(
		selected ? data.library.find((item) => item.externalId === selected?.externalId) : undefined
	);
	function stopSelecting() {
		selecting = false;
		selection = NOTHING;
		choosingWho = false;
	}
	// The invitations went out: say so in passing, e.g. "3 invitations sent to Mia"
	function invited(answer: { invited: number; already: number; to: number }) {
		stopSelecting();
		const name = data.people.find((person) => person.id === answer.to)?.name ?? '';
		toast(
			m.share.sent(answer.invited, name) +
				(answer.already ? ` ${m.share.sentAlready(answer.already)}` : '')
		);
	}

	// Phones: 3 posters per row; larger screens: as many as fit (at least ~10rem wide each).
	const gridClass = 'grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]';

	const EMPTY_ICONS = { movies: Popcorn, series: Sofa, anime: Origami, games: Joystick };
</script>

<svelte:head><title>{label} · hdtracker</title></svelte:head>
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && selecting && !choosingWho) stopSelecting();
		// Ctrl+A selects the posters – unless something is typed (there it selects the text)
		// or a window is open
		const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
		if (
			e.key.toLowerCase() === 'a' &&
			(e.ctrlKey || e.metaKey) &&
			canSelect &&
			!data.q &&
			!typing &&
			!document.querySelector('dialog[open]')
		) {
			e.preventDefault();
			select(pickAll(visibleIds));
		}
	}}
/>

<main class="app-width p-4" style:--accent={cat.accent}>
	<!-- The area is shown in the bottom navigation and the search field; heading only for screen readers -->
	<h1 class="sr-only">{label}</h1>

	{#if data.q}
		<!-- Search results -->
		<div class="mt-1 flex items-center justify-between text-sm">
			<span class="text-zinc-400">
				{#if !data.error && data.results.length}{m.library.results(
						data.results.length,
						data.q
					)}{/if}
			</span>
			<a href="/{data.category}" class="text-(--accent) hover:underline">{m.library.toLibrary}</a>
		</div>

		{#if data.error}
			<p class="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{data.error}
			</p>
		{:else if data.results.length === 0}
			<EmptyState icon={SearchX} title={m.library.noResults} text={m.library.noResultsHint} />
		{:else}
			<ul class="mt-2 {gridClass}">
				{#each data.results as item (item.externalId)}
					<li>
						<PosterCard
							title={titles(data.category, item).main}
							year={item.year}
							earlyAccess={item.earlyAccess}
							posterUrl={item.posterUrl}
							badge={item.status ? statusLabel(data.category, item.status) : null}
							onclick={() => (selected = item)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if sections.length === 0}
		<!-- A pictogram of its own per area – not the icon of the navigation below again -->
		<EmptyState
			icon={EMPTY_ICONS[data.category]}
			title={m.library.emptyTitle[data.category]}
			text={m.library.emptyHint}
			tinted
		/>
	{:else}
		{#if form?.error}<Notice kind="warning" class="mb-3">{form.error}</Notice>{/if}
		<!-- Library, one collapsible section per status -->
		{#each sections as section (section.status)}
			{@const Icon = STATUS_ICONS[section.status]}
			<details
				class="group mt-6 first-of-type:mt-1"
				open={isOpen(section.status)}
				ontoggle={(e) => (folded[section.status] = !e.currentTarget.open)}
			>
				<summary
					class="group/summary flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden"
				>
					<ChevronRight
						size={18}
						class="text-zinc-500 transition group-open:rotate-90 group-hover/summary:text-zinc-200"
					/>
					<Icon size={18} class="text-(--accent)" />
					<h2 class="text-lg font-semibold">{statusLabel(data.category, section.status)}</h2>
				</summary>
				<ul class="mt-3 {gridClass}">
					{#each section.items as item (item.id)}
						<li>
							<PosterCard
								title={titles(data.category, item).main}
								year={item.year}
								earlyAccess={item.earlyAccess}
								posterUrl={item.posterUrl}
								loading={item.metadataUpdatedAt === null}
								people={data.together[item.id]}
								selected={selecting ? chosen.includes(item.id) : undefined}
								onclick={() => (selecting ? pick(item.id) : (selected = item))}
								onselect={canSelect ? (range) => pick(item.id, range) : undefined}
							/>
						</li>
					{/each}
				</ul>
			</details>
		{/each}
	{/if}

	<ItemSheet
		category={data.category}
		item={selected}
		onclose={() => (selected = null)}
		notify={current ? current.notify : null}
		sharing={current
			? sharingFor(data.people, data.together[current.id], data.pending[current.id])
			: null}
	/>

	{#if selecting}
		<!-- Above the navigation: how many are selected, and what to do with them -->
		<div class="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 px-4 pb-2">
			<div
				class="ui-card mx-auto flex max-w-md items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-2 pl-4 shadow-xl shadow-black/50"
			>
				<button
					type="button"
					onclick={stopSelecting}
					aria-label={m.share.endSelection}
					title={m.share.endSelection}
					class="-ml-2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
				>
					<X size={18} />
				</button>
				<span class="min-w-0 flex-1 truncate text-sm font-medium"
					>{m.share.selected(chosen.length)}</span
				>
				<button
					type="button"
					disabled={chosen.length === 0}
					onclick={() => (choosingWho = true)}
					class="{BUTTON_PRIMARY} px-3 py-1.5 text-sm"
				>
					<UserPlus size={16} />{m.share.inviteSelected}
				</button>
			</div>
		</div>
		<PeopleSheet
			open={choosingWho}
			people={data.people}
			ids={chosen}
			onclose={() => (choosingWho = false)}
			ondone={invited}
		/>
	{/if}
</main>
