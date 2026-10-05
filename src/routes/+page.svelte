<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATEGORIES } from '$lib/categories';
	import { sortByDate, type DashboardSection, type Order } from '$lib/dashboardOrder';
	import { eventLabel } from '$lib/eventLabel';
	import { m } from '$lib/i18n/index.svelte';
	import { img } from '$lib/images';
	import { titles } from '$lib/titles.svelte';
	import type { DashboardEntry } from '$lib/server/dashboard';
	import {
		CalendarArrowDown,
		CalendarArrowUp,
		CalendarClock,
		ChevronRight,
		History,
		ImageOff
	} from '@lucide/svelte';

	let { data } = $props();

	// Entries grouped by day (in the given order); entries without a date form the last group.
	function byDay(entries: DashboardEntry[]) {
		const groups: { date: string | null; entries: DashboardEntry[] }[] = [];
		for (const entry of entries) {
			const last = groups.at(-1);
			if (last && last.date === entry.date) last.entries.push(entry);
			else groups.push({ date: entry.date, entries: [entry] });
		}
		return groups;
	}

	const localDate = (iso: string) => new Date(`${iso}T00:00:00`);

	// "Sa., 03.10." / "Sat, 10/03" – with the year only if it is not this year.
	function dayLabel(iso: string) {
		const date = localDate(iso);
		const sameYear = date.getFullYear() === new Date().getFullYear();
		return new Intl.DateTimeFormat(m.locale, {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: sameYear ? undefined : 'numeric'
		}).format(date);
	}

	// "heute", "morgen", "in 5 Tagen", "vor 3 Tagen"
	function relativeDay(iso: string) {
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const days = Math.round((localDate(iso).getTime() - startOfToday.getTime()) / 86_400_000);
		return new Intl.RelativeTimeFormat(m.locale, { numeric: 'auto' }).format(days, 'day');
	}

	// Order of each list: what the server remembers, or what was just tapped (so the list
	// turns around at once, before the server has answered).
	let tapped = $state<Partial<Record<DashboardSection, Order>>>({});
	const orderOf = (key: DashboardSection) => tapped[key] ?? data.order[key];

	let sections = $derived(
		[
			{
				key: 'recent' as const,
				title: m.home.recent,
				hint: m.home.recentHint,
				icon: History,
				entries: data.recent,
				empty: m.home.noRecent
			},
			{
				key: 'upcoming' as const,
				title: m.home.upcoming,
				hint: null,
				icon: CalendarClock,
				entries: data.upcoming,
				empty: m.home.noUpcoming
			}
		].map((section) => {
			const order = orderOf(section.key);
			return { ...section, order, entries: sortByDate(section.entries, order) };
		})
	);
</script>

<svelte:head><title>hdtracker</title></svelte:head>

<!-- One row per entry: poster, title, area icon and what happens -->
{#snippet entryList(entries: DashboardEntry[])}
	<ul class="mt-1">
		{#each entries as entry (`${entry.category}:${entry.externalId}:${entry.kind}`)}
			{@const cat = CATEGORIES[entry.category]}
			<li>
				<!-- Hover: row lights up, title and poster frame in the area's colour -->
				<a
					href="/{entry.category}/{entry.externalId}"
					style:--accent={cat.accent}
					class="group/row -mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors duration-100 hover:bg-zinc-900"
				>
					<div
						class="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded bg-zinc-900 ring-1 ring-zinc-800 transition-shadow duration-100 group-hover/row:ring-(--accent)"
					>
						{#if img(entry.posterUrl)}
							<img
								src={img(entry.posterUrl)}
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
							{titles(entry.category, entry).main}
						</p>
						<p class="flex items-center gap-1.5 text-sm text-zinc-400">
							<cat.icon size={14} class="shrink-0 text-(--accent)" />
							<span class="truncate">{eventLabel(entry, m)}</span>
						</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<main class="mx-auto max-w-screen-sm p-4">
	<!-- Main heading for screen readers (the two lists have visible headings of their own) -->
	<h1 class="sr-only">{m.common.home}</h1>
	{#if data.libraryEmpty}
		<p class="mt-2 text-zinc-400">{m.home.emptyLibrary}</p>
	{:else}
		{#each sections as section (section.key)}
			<section class="mt-8 first:mt-2">
				<h2 class="flex items-baseline gap-2">
					<section.icon size={20} class="self-center text-zinc-400" />
					<span class="text-lg font-semibold whitespace-nowrap">{section.title}</span>
					{#if section.hint}<span class="min-w-0 truncate text-xs text-zinc-500"
							>{section.hint}</span
						>{/if}
					<!-- Reverses the order of this list; the choice is remembered -->
					{#if section.entries.length > 1}
						{@const next = section.order === 'asc' ? 'desc' : 'asc'}
						{@const label = `${m.home.order[section.key][section.order]} – ${m.home.order.reverse}`}
						<form
							method="POST"
							action="?/order"
							use:enhance={() => {
								tapped[section.key] = next;
							}}
							class="ml-auto self-center"
						>
							<input type="hidden" name="section" value={section.key} />
							<input type="hidden" name="order" value={next} />
							<button
								class="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
								title={label}
								aria-label={label}
							>
								{#if section.order === 'asc'}<CalendarArrowUp size={18} />{:else}<CalendarArrowDown
										size={18}
									/>{/if}
							</button>
						</form>
					{/if}
				</h2>

				{#if section.entries.length === 0}
					<p class="mt-3 text-sm text-zinc-500">{section.empty}</p>
				{/if}

				{#each byDay(section.entries) as group (group.date)}
					{#if group.date}
						<h3 class="mt-4 flex justify-between text-sm font-medium">
							<span class="text-zinc-300">{dayLabel(group.date)}</span>
							<span class="text-zinc-500">{relativeDay(group.date)}</span>
						</h3>
						{@render entryList(group.entries)}
					{:else}
						<!-- Announced without a date: least urgent, so collapsed by default -->
						<details class="group mt-4">
							<summary
								class="group/summary flex cursor-pointer list-none items-center gap-1 text-sm font-medium select-none [&::-webkit-details-marker]:hidden"
							>
								<ChevronRight
									size={16}
									class="text-zinc-500 transition group-open:rotate-90 group-hover/summary:text-zinc-200"
								/>
								<span class="text-zinc-300">{m.home.dateOpen}</span>
							</summary>
							{@render entryList(group.entries)}
						</details>
					{/if}
				{/each}
			</section>
		{/each}
	{/if}
</main>
