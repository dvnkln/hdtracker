<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CATEGORIES, type Category } from '#lib/categories.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import { img } from '#lib/images.js';
	import { sharingFor } from '#lib/sharing.js';
	import { STREAMING_AREAS } from '#lib/status.js';
	import { sortServices, type StreamingOrder } from '#lib/streamingOrder.js';
	import { STICKY_SUMMARY, backToFolded, markStuck } from '#lib/stickySections.js';
	import { titles } from '#lib/titles.svelte.js';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import PosterCard from '#lib/components/PosterCard.svelte';
	import ItemSheet, { type SheetItem } from '#lib/components/ItemSheet.svelte';
	import {
		ArrowDownAZ,
		ArrowDownWideNarrow,
		ArrowLeft,
		Check,
		ChevronRight,
		Eye,
		EyeOff,
		Pencil,
		Clapperboard,
		Play,
		ShoppingBag
	} from '@lucide/svelte';

	let { data } = $props();
	type Service = (typeof data.services)[number];
	type Item = (typeof data.items)[number];

	// Order of the tiles: A–Z or most titles first. A tap switches at once; the server remembers
	// it for the account (the answer brings the same order back).
	let tapped = $state<StreamingOrder | null>(null);
	let order: StreamingOrder = $derived(tapped ?? data.order);
	let sorted = $derived(sortServices(data.services, order));
	let next: StreamingOrder = $derived(order === 'name' ? 'count' : 'name');

	// Hiding services: "edit" makes every tile a switch (an eye); hidden ones stand small at the
	// end. A tap counts at once, the server remembers it for the account.
	let editing = $state(false);
	let hiddenNow = $state<Record<string, boolean>>({});
	const isHidden = (key: string) => hiddenNow[key] ?? data.hidden.includes(key);
	let tiles = $derived(sorted.filter((service) => !isHidden(service.key)));
	let hiddenTiles = $derived(sorted.filter((service) => isHidden(service.key)));
	// If storing it fails (server gone for a moment …), the tile goes back to how it was and a
	// hint says so – otherwise it would look hidden and be back after the next reload
	let hideFailed = $state(false);
	async function toggleHidden(service: Service) {
		const hidden = !isHidden(service.key);
		hiddenNow[service.key] = hidden;
		hideFailed = false;
		const body = new FormData();
		body.set('key', service.key);
		body.set('hidden', hidden ? '1' : '0');
		try {
			const res = await fetch('?/hide', {
				method: 'POST',
				body,
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
			});
			const result = res.ok ? await res.json() : null;
			if (result?.type !== 'success') throw new Error(`hide: ${res.status}`);
		} catch (err) {
			console.error(err);
			hiddenNow[service.key] = !hidden;
			hideFailed = true;
		}
	}

	// The chosen service stands in the address (?s=Netflix), so the way back leads to the tiles
	let wanted = $derived(page.url.searchParams.get('s'));
	let chosen = $derived(
		wanted === null ? undefined : data.services.find((service) => service.name === wanted)
	);
	// A service that is not (or no longer) there – its last title was just watched, say: back to
	// the tiles, without leaving the old address in the history
	$effect(() => {
		if (wanted !== null && !chosen) goto('/streaming', { replace: true });
	});
	const href = (service: Service) => `?s=${encodeURIComponent(service.name)}`;

	// The titles of the chosen service by area, in the order of the bottom navigation. Each area
	// has its tabs right next to its name: in the subscription / to rent or buy (only those it
	// has – "In the subscription" also stands there alone). Which areas show what is to rent or
	// buy stands in the address (&buy=movies,series), so coming back from a title opens it again.
	type Part = 'flatrate' | 'purchase';
	let byId = $derived(new Map(data.items.map((item) => [item.id, item])));
	const inArea = (ids: number[], area: string) =>
		ids.map((id) => byId.get(id)!).filter((item) => item.category === area);
	let buying = $derived(new Set(page.url.searchParams.get('buy')?.split(',') ?? []));
	let sections = $derived(
		chosen
			? STREAMING_AREAS.map((area) => {
					const flatrate = inArea(chosen.ids, area);
					const purchase = inArea(chosen.purchase, area);
					const part: Part =
						flatrate.length === 0 || (purchase.length > 0 && buying.has(area))
							? 'purchase'
							: 'flatrate';
					return {
						area,
						flatrate,
						purchase,
						part,
						items: part === 'flatrate' ? flatrate : purchase
					};
				}).filter((section) => section.items.length > 0)
			: []
	);
	// Areas folded away (for this visit only, like the sections of the library)
	let folded = $state(new Set<string>());
	let single = $derived(sections.length === 1);
	// Another service starts with everything open
	$effect(() => {
		void wanted;
		folded = new Set();
	});
	function folding(area: string, section: HTMLDetailsElement) {
		if (single) return;
		const next = new Set(folded);
		if (section.open) next.delete(area);
		else next.add(area);
		folded = next;
		backToFolded(section);
	}
	$effect(() => {
		void sections;
		markStuck();
	});
	function show(area: string, next: Part) {
		const areas = new Set(buying);
		if (next === 'purchase') areas.add(area);
		else areas.delete(area);
		const url = new URL(page.url.href);
		if (areas.size) url.searchParams.set('buy', [...areas].join(','));
		else url.searchParams.delete('buy');
		goto(url, { replace: true, reset: false });
	}

	// Item shown in the bottom sheet (null = closed), always with the current data
	let selected = $state<SheetItem | null>(null);
	let sheetCategory = $state<Category>('movies');
	function open(item: Item) {
		sheetCategory = item.category;
		selected = item;
	}
	let current = $derived(
		selected
			? data.items.find(
					(item) => item.category === sheetCategory && item.externalId === selected?.externalId
				)
			: undefined
	);

	// Phones: 3 posters per row; larger screens: as many as fit – like the library
	// The tiles: small, two in a row on phones, as many as fit on larger screens
	const tileGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]';
	const gridClass = 'grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]';
</script>

<svelte:head><title>{chosen?.name ?? m.streaming.title} · hdtracker</title></svelte:head>
<svelte:window onscroll={() => markStuck()} onresize={() => markStuck()} />

{#snippet logo(service: Service, size: string)}
	<img
		src={img(service.logoUrl)}
		alt=""
		referrerpolicy="no-referrer"
		class="{size} shrink-0 rounded-lg ring-1 ring-zinc-800"
	/>
{/snippet}

{#snippet card(service: Service)}
	{@const classes =
		'ui-card ui-btn relative flex h-full min-h-[4.5rem] w-full items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-left transition-colors duration-100 hover:border-zinc-600 hover:bg-zinc-800'}
	{#snippet inside()}
		<!-- While editing, the eye sits as a small badge on the corner of the logo – the name
		     keeps all its room -->
		<span class="relative shrink-0">
			{@render logo(service, 'size-8')}
			{#if editing}
				<span
					class="absolute -right-1.5 -bottom-1.5 flex size-[18px] items-center justify-center rounded-full bg-zinc-900 text-zinc-300 ring-1 ring-zinc-700"
				>
					{#if isHidden(service.key)}<EyeOff size={11} />{:else}<Eye size={11} />{/if}
				</span>
			{/if}
		</span>
		<span class="min-w-0">
			<span class="line-clamp-2 text-sm leading-tight font-medium break-words">{service.name}</span>
			{@render tally(service)}
		</span>
	{/snippet}
	{#if editing}
		{@const hidden = isHidden(service.key)}
		<button
			class="{classes} {hidden ? 'opacity-50' : ''}"
			aria-pressed={!hidden}
			title={hidden ? m.streaming.show(service.name) : m.streaming.hide(service.name)}
			aria-label={hidden ? m.streaming.show(service.name) : m.streaming.hide(service.name)}
			onclick={() => toggleHidden(service)}
		>
			{@render inside()}
		</button>
	{:else}
		<a href={href(service)} class={classes}>{@render inside()}</a>
	{/if}
{/snippet}

<!-- How many titles, as a symbol with a number each (short enough for a phone tile): in the
     flat rate a play sign, only to rent or buy a bag – the same signs as on the tabs -->
{#snippet tally(service: Service)}
	<span class="flex items-center gap-2 text-sm whitespace-nowrap text-zinc-500">
		{#if service.ids.length}
			<span class="flex items-center gap-0.5" title={m.streaming.titles(service.ids.length)}>
				<Play size={12} aria-hidden="true" />
				<span aria-hidden="true">{service.ids.length}</span>
				<span class="sr-only">{m.streaming.titles(service.ids.length)}</span>
			</span>
		{/if}
		{#if service.purchase.length}
			<span class="flex items-center gap-0.5" title={m.streaming.purchase(service.purchase.length)}>
				<ShoppingBag size={13} aria-hidden="true" />
				<span aria-hidden="true">{service.purchase.length}</span>
				<span class="sr-only">{m.streaming.purchase(service.purchase.length)}</span>
			</span>
		{/if}
	</span>
{/snippet}

<main class="app-width px-4 pt-6 pb-4">
	{#if !chosen}
		<!-- The heading with its buttons (order, show or hide services) like on the dashboard -->
		<div class="flex items-center gap-2">
			<h1 class="text-xl font-semibold">{m.streaming.title}</h1>
			{#if data.services.length > 1}
				{@const label = `${m.streaming.order[order]} – ${m.streaming.order.change}`}
				<div class="-my-1 ml-auto flex items-center self-center lg:ml-1">
					<form
						method="POST"
						action="?/order"
						use:enhance={() => {
							tapped = next;
							return async ({ update }) => {
								await update({ navigate: false, reset: false });
								tapped = null;
							};
						}}
					>
						<input type="hidden" name="order" value={next} />
						<button
							class="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
							title={label}
							aria-label={label}
						>
							{#if order === 'name'}<ArrowDownAZ size={18} />{:else}<ArrowDownWideNarrow
									size={18}
								/>{/if}
						</button>
					</form>
					<button
						class="rounded-lg p-1.5 transition-colors hover:bg-zinc-800 hover:text-zinc-100 {editing
							? 'text-zinc-100'
							: 'text-zinc-400'}"
						title={editing ? m.streaming.done : m.streaming.edit}
						aria-label={editing ? m.streaming.done : m.streaming.edit}
						aria-pressed={editing}
						onclick={() => (editing = !editing)}
					>
						{#if editing}<Check size={18} />{:else}<Pencil size={18} />{/if}
					</button>
				</div>
			{/if}
		</div>
		{#if data.services.length === 0}
			<EmptyState icon={Clapperboard} title={m.streaming.emptyTitle} text={m.streaming.emptyHint} />
		{:else if editing}
			{#if hideFailed}
				<Notice kind="warning" class="mt-4">{m.streaming.hideFailed}</Notice>
			{/if}
			<!-- Editing: every tile, in the same order, as a switch – hidden ones dimmed -->
			<ul class="mt-4 {tileGrid}">
				{#each sorted as service (service.key)}
					<li>{@render card(service)}</li>
				{/each}
			</ul>
		{:else}
			<!-- All tiles equally high (room for a name over two lines), the content in the middle:
			     a long name does not make its row jump out of line -->
			<ul class="mt-4 {tileGrid}">
				{#each tiles as service (service.key)}
					<li>{@render card(service)}</li>
				{/each}
			</ul>
			{#if hiddenTiles.length}
				<details class="group mt-6">
					<summary
						class="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-zinc-500 select-none hover:text-zinc-300 [&::-webkit-details-marker]:hidden"
					>
						<ChevronRight size={16} class="transition group-open:rotate-90" />
						{m.streaming.hidden(hiddenTiles.length)}
					</summary>
					<ul class="mt-3 opacity-60 {tileGrid}">
						{#each hiddenTiles as service (service.key)}
							<li>{@render card(service)}</li>
						{/each}
					</ul>
				</details>
			{/if}
		{/if}
	{:else}
		<a
			href="/streaming"
			class="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
		>
			<ArrowLeft size={16} />
			{m.streaming.allServices}
		</a>
		<div class="mt-3 flex items-center gap-3">
			{@render logo(chosen, 'size-12')}
			<div class="min-w-0">
				<h1 class="truncate text-xl font-semibold">{chosen.name}</h1>
				{@render tally(chosen)}
			</div>
		</div>
		{#each sections as section (section.area)}
			{@const cat = CATEGORIES[section.area]}
			<!-- One collapsible section per area, its heading sticks like in the library
			     (stickySections.ts) – with only one area there is nothing to fold: no arrow -->
			<details
				class="group"
				style:--accent={cat.accent}
				open={single || !folded.has(section.area)}
				data-sticky
				ontoggle={(e) => folding(section.area, e.currentTarget)}
			>
				<!-- The area and, right next to it, its tabs: plain text, the open one underlined in the
				     colour of the area. A tap on a tab switches it and does not fold the section. -->
				<summary
					class="{STICKY_SUMMARY} flex-wrap gap-x-4 gap-y-1 {single
						? 'cursor-default'
						: 'cursor-pointer'}"
					onclick={(e) => single && e.preventDefault()}
				>
					<h2 class="flex items-center gap-2 text-lg font-semibold">
						{#if !single}
							<ChevronRight
								size={18}
								class="text-zinc-500 transition group-open:rotate-90 group-hover/summary:text-zinc-200"
							/>
						{/if}
						<cat.icon size={18} class="text-(--accent)" />
						{m.categories[section.area]}
					</h2>
					<!-- Right-aligned. The same tabs in every area of a service: a service that has both
					     shows both everywhere (an empty one greyed out with its 0), one with only a
					     subscription (Netflix) only that -->
					<div role="tablist" class="ml-auto flex items-center gap-3 text-sm">
						{#each [{ key: 'flatrate', label: m.streaming.inSubscription, count: section.flatrate.length, Icon: Play, offered: chosen.ids.length > 0 }, { key: 'purchase', label: m.streaming.toRentOrBuy, count: section.purchase.length, Icon: ShoppingBag, offered: chosen.purchase.length > 0 }].filter((tab) => tab.offered) as tab (tab.key)}
							{@const on = section.part === tab.key}
							{@const empty = tab.count === 0}
							<button
								role="tab"
								aria-selected={on}
								aria-disabled={empty}
								class="flex items-center gap-1 border-b-2 pt-0.5 pb-0.5 transition-colors duration-100 {on
									? 'cursor-default border-(--accent) text-zinc-100'
									: empty
										? 'cursor-default border-transparent text-zinc-600'
										: 'border-transparent text-zinc-500 hover:text-zinc-200'}"
								onclick={(e) => {
									e.preventDefault();
									if (!on && !empty) show(section.area, tab.key as Part);
								}}
							>
								<tab.Icon size={13} aria-hidden="true" />
								{tab.label}
								<span class={on ? 'text-zinc-400' : 'text-zinc-600'}>{tab.count}</span>
							</button>
						{/each}
					</div>
				</summary>
				<ul class="mt-3 {gridClass}">
					{#each section.items as item (item.id)}
						<li>
							<PosterCard
								title={titles(item.category, item).main}
								year={item.year}
								earlyAccess={item.earlyAccess}
								posterUrl={item.posterUrl}
								people={data.together[item.id]}
								onclick={() => open(item)}
							/>
						</li>
					{/each}
				</ul>
			</details>
		{/each}
	{/if}

	<!-- The status window of the library; it saves with the actions of the title's area page -->
	<ItemSheet
		category={sheetCategory}
		item={selected}
		onclose={() => (selected = null)}
		actionPath="/{sheetCategory}"
		notify={current ? current.notify : null}
		sharing={current
			? sharingFor(data.people, data.together[current.id], data.pending[current.id])
			: null}
	/>
</main>
