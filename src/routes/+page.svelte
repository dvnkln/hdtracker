<script lang="ts">
	import { CATEGORIES } from '$lib/categories';
	import { m } from '$lib/i18n/index.svelte';
	import { titles } from '$lib/titles.svelte';
	import type { DashboardEntry } from '$lib/server/dashboard';
	import { CalendarClock, History, ImageOff } from '@lucide/svelte';

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

	// What happens, e.g. "Kinostart", "S03E01 · Staffelstart", "S02E03–E05", "Folgen 3–5".
	function eventLabel(e: DashboardEntry) {
		if (e.kind !== 'episode') return m.home.kinds[e.kind];
		const first = e.episode ?? 1;
		const last = e.lastEpisode ?? first;
		let label: string;
		if (e.category === 'anime') {
			label = m.home.animeEpisodes(first, last);
		} else {
			label = m.home.episodeCode(e.season ?? 1, first);
			if (e.lastSeason !== e.season) label += `–${m.home.episodeCode(e.lastSeason ?? 1, last)}`;
			else if (last !== first) label += `–E${String(last).padStart(2, '0')}`;
		}
		if (first === 1 && last === 1) {
			const start =
				e.category === 'anime'
					? m.home.animeStart
					: e.season === 1
						? m.home.seriesStart
						: m.home.seasonStart;
			label += ` · ${start}`;
		}
		return label;
	}

	let sections = $derived([
		{
			key: 'recent',
			title: m.home.recent,
			hint: m.home.recentHint,
			icon: History,
			entries: data.recent,
			empty: m.home.noRecent
		},
		{
			key: 'upcoming',
			title: m.home.upcoming,
			hint: null,
			icon: CalendarClock,
			entries: data.upcoming,
			empty: m.home.noUpcoming
		}
	]);
</script>

<svelte:head><title>hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-sm p-4">
	{#if data.libraryEmpty}
		<p class="mt-2 text-zinc-400">{m.home.emptyLibrary}</p>
	{:else}
		{#each sections as section (section.key)}
			<section class="mt-8 first:mt-2">
				<h2 class="flex items-baseline gap-2 border-b border-zinc-800 pb-2">
					<section.icon size={20} class="self-center text-zinc-400" />
					<span class="text-lg font-semibold">{section.title}</span>
					{#if section.hint}<span class="text-xs text-zinc-500">{section.hint}</span>{/if}
				</h2>

				{#if section.entries.length === 0}
					<p class="mt-3 text-sm text-zinc-500">{section.empty}</p>
				{/if}

				{#each byDay(section.entries) as group (group.date)}
					<h3 class="mt-4 flex justify-between text-sm font-medium">
						{#if group.date}
							<span class="text-zinc-300">{dayLabel(group.date)}</span>
							<span class="text-zinc-500">{relativeDay(group.date)}</span>
						{:else}
							<span class="text-zinc-300">{m.home.dateOpen}</span>
						{/if}
					</h3>
					<ul class="mt-1">
						{#each group.entries as entry (`${entry.category}:${entry.externalId}:${entry.kind}`)}
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
										{#if entry.posterUrl}
											<img
												src={entry.posterUrl}
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
											<span class="truncate">{eventLabel(entry)}</span>
										</p>
									</div>
								</a>
							</li>
						{/each}
					</ul>
				{/each}
			</section>
		{/each}
	{/if}
</main>
