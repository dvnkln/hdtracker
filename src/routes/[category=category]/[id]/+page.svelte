<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { CATEGORIES } from '$lib/categories';
	import { statusLabel } from '$lib/status';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import ItemSheet from '$lib/components/ItemSheet.svelte';
	import {
		ArrowLeft,
		Check,
		CheckCheck,
		ChevronRight,
		ExternalLink,
		ImageOff,
		Plus
	} from '@lucide/svelte';

	let { data } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	let show = $derived(data.details);
	let isAnime = $derived(data.category === 'anime');

	const key = (season: number, episode: number) => `${season}:${episode}`;

	// Episodes tapped but not yet confirmed by the server (shown as already toggled).
	let pending = $state<string[]>([]);
	let watchedSet = $derived(new Set(data.watched));
	function isWatched(season: number, episode: number) {
		const k = key(season, episode);
		return watchedSet.has(k) !== pending.includes(k);
	}

	type Season = (typeof data.details.seasons)[number];
	function progress(season: Season) {
		const aired = season.episodes.filter((e) => e.aired);
		const done = aired.filter((e) => isWatched(season.number, e.number)).length;
		return { done, aired: aired.length, total: season.episodes.length };
	}

	// Overall progress, without specials.
	let overall = $derived.by(() => {
		const parts = show.seasons.filter((s) => !s.special).map(progress);
		return {
			done: parts.reduce((n, p) => n + p.done, 0),
			aired: parts.reduce((n, p) => n + p.aired, 0),
			total: parts.reduce((n, p) => n + p.total, 0)
		};
	});

	// The first season with unwatched episodes starts open.
	let firstOpen = $derived(
		show.seasons.find((s) => !s.special && progress(s).done < progress(s).aired)?.number ?? null
	);

	const dateFormat = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	const formatDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00`));

	let nextEpisode = $derived(
		show.seasons.flatMap((s) => s.episodes).find((e) => !e.aired && e.airDate)
	);

	// Single episode: toggle immediately in the UI, then let the server confirm.
	const toggleEpisode: SubmitFunction = ({ formData }) => {
		const k = key(Number(formData.get('season')), Number(formData.get('episode')));
		pending = [...pending, k];
		return async ({ update }) => {
			await update({ reset: false });
			pending = pending.filter((p) => p !== k);
		};
	};

	// Resetting everything needs a confirmation.
	const confirmReset: SubmitFunction = ({ formData, cancel }) => {
		if (formData.get('watched') === '0' && !confirm('Alle Folgen als ungesehen markieren?')) {
			cancel();
		}
		return async ({ update }) => update({ reset: false });
	};

	let sheetOpen = $state(false);
</script>

<svelte:head><title>{show.item.title} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-lg p-4" style:--accent={cat.accent}>
	<a href="/{data.category}" class="inline-flex items-center gap-1 text-sm text-(--accent)">
		<ArrowLeft size={16} />
		{cat.label}
	</a>

	<!-- Header -->
	<div class="mt-3 flex gap-4">
		<div class="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-32">
			{#if show.item.posterUrl}
				<img
					src={show.item.posterUrl}
					alt=""
					referrerpolicy="no-referrer"
					class="h-full w-full object-cover"
				/>
			{:else}
				<div class="flex h-full items-center justify-center text-zinc-600"><ImageOff /></div>
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<h1 class="text-xl leading-tight font-bold sm:text-2xl">{show.item.title}</h1>
			{#if show.item.originalTitle}
				<p class="text-sm text-zinc-400">{show.item.originalTitle}</p>
			{/if}
			<p class="mt-1 text-sm text-zinc-500">
				{show.item.year ?? '–'} · {show.ended ? 'Abgeschlossen' : 'Laufend'}
				{#if show.episodeRuntime}· ca. {show.episodeRuntime} Min. pro Folge{/if}
			</p>
			<a
				href={show.externalUrl}
				target="_blank"
				rel="noreferrer"
				class="mt-1 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
			>
				{isAnime ? 'AniList' : 'TMDB'}
				<ExternalLink size={14} />
			</a>

			<button
				type="button"
				onclick={() => (sheetOpen = true)}
				class="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium {data.status
					? 'bg-(--accent) text-white'
					: 'border border-zinc-700 hover:bg-zinc-800'}"
			>
				{#if data.status}
					{@const Icon = STATUS_ICONS[data.status]}
					<Icon size={16} />
					{statusLabel(data.category, data.status)}
				{:else}
					<Plus size={16} /> Zur Bibliothek
				{/if}
			</button>
		</div>
	</div>

	{#if show.item.overview}
		<p class="mt-4 line-clamp-4 text-sm text-zinc-300">{show.item.overview}</p>
	{/if}

	<!-- Overall progress -->
	<section class="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
		<div class="flex items-center justify-between gap-3">
			<div class="text-sm">
				<span class="font-semibold">{overall.done} / {overall.aired}</span>
				<span class="text-zinc-400">Folgen gesehen</span>
				{#if overall.total > overall.aired}
					<span class="text-zinc-500">({overall.total - overall.aired} noch nicht erschienen)</span>
				{/if}
			</div>
			{#if overall.aired > 0}
				{@const allDone = overall.done === overall.aired}
				<form method="POST" action="?/all" use:enhance={confirmReset}>
					<input type="hidden" name="watched" value={allDone ? '0' : '1'} />
					<button
						class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium {allDone
							? 'text-zinc-400 hover:bg-zinc-800'
							: 'bg-(--accent) text-white'}"
					>
						{#if allDone}Zurücksetzen{:else}<CheckCheck size={16} /> Alles gesehen{/if}
					</button>
				</form>
			{/if}
		</div>
		<div class="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
			<div
				class="h-full rounded-full bg-(--accent) transition-all"
				style:width="{overall.aired ? (overall.done / overall.aired) * 100 : 0}%"
			></div>
		</div>
		{#if nextEpisode?.airDate}
			<p class="mt-2 text-xs text-zinc-400">
				Nächste Folge ({nextEpisode.number}) am {formatDate(nextEpisode.airDate)}
			</p>
		{/if}
	</section>

	{#if show.seasons.every((s) => s.episodes.length === 0)}
		<p class="mt-6 text-zinc-500">Noch keine Folgen bekannt.</p>
	{:else if isAnime}
		<!-- Anime: grid of episode numbers -->
		{@const season = show.seasons[0]}
		<form
			method="POST"
			action="?/toggle"
			use:enhance={toggleEpisode}
			class="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-10"
		>
			<input type="hidden" name="season" value={season.number} />
			{#each season.episodes as ep (ep.number)}
				{@const watched = isWatched(season.number, ep.number)}
				<button
					name="episode"
					value={ep.number}
					disabled={!ep.aired}
					aria-pressed={watched}
					class="aspect-square rounded-lg text-sm font-semibold transition-colors {watched
						? 'bg-(--accent) text-white'
						: ep.aired
							? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
							: 'border border-dashed border-zinc-700 text-zinc-600'}"
				>
					{ep.number}
				</button>
			{/each}
		</form>
	{:else}
		<!-- Series: one collapsible block per season -->
		{#each show.seasons as season (season.number)}
			{@const p = progress(season)}
			{@const complete = p.aired > 0 && p.done === p.aired}
			<details
				class="group mt-3 rounded-xl border border-zinc-800 bg-zinc-900"
				open={untrack(() => season.number === firstOpen)}
			>
				<summary
					class="flex cursor-pointer list-none items-center gap-3 p-4 select-none [&::-webkit-details-marker]:hidden"
				>
					<ChevronRight
						size={18}
						class="shrink-0 text-zinc-500 transition-transform group-open:rotate-90"
					/>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<h2 class="truncate font-semibold">{season.name}</h2>
							<span class="shrink-0 text-sm {complete ? 'text-(--accent)' : 'text-zinc-400'}">
								{#if complete}<Check size={14} class="inline" />{/if}
								{p.done} / {p.aired}
							</span>
						</div>
						<div class="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
							<div
								class="h-full bg-(--accent) transition-all"
								style:width="{p.aired ? (p.done / p.aired) * 100 : 0}%"
							></div>
						</div>
					</div>
				</summary>

				<div class="border-t border-zinc-800 px-2 pb-2">
					{#if season.special}
						<p class="px-2 pt-3 text-xs text-zinc-500">Specials zählen nicht zum Fortschritt.</p>
					{/if}
					{#if p.aired > 0}
						<form method="POST" action="?/season" use:enhance={confirmReset} class="px-2 pt-3">
							<input type="hidden" name="season" value={season.number} />
							<input type="hidden" name="watched" value={complete ? '0' : '1'} />
							<button class="text-sm font-medium text-(--accent)">
								{complete ? 'Staffel als ungesehen markieren' : 'Ganze Staffel gesehen'}
							</button>
						</form>
					{/if}

					<form method="POST" action="?/toggle" use:enhance={toggleEpisode} class="mt-1">
						<input type="hidden" name="season" value={season.number} />
						<ul>
							{#each season.episodes as ep (ep.number)}
								{@const watched = isWatched(season.number, ep.number)}
								<li>
									<button
										name="episode"
										value={ep.number}
										disabled={!ep.aired}
										aria-pressed={watched}
										class="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-transparent"
									>
										<!-- Episode still with the check mark on top -->
										<span
											class="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-zinc-800 sm:w-36"
										>
											{#if ep.stillUrl}
												<img
													src={ep.stillUrl}
													alt=""
													loading="lazy"
													referrerpolicy="no-referrer"
													class="h-full w-full object-cover transition-opacity {watched
														? 'opacity-40'
														: ''}"
												/>
											{/if}
											<span
												class="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full border-2 transition-colors {watched
													? 'border-(--accent) bg-(--accent) text-white'
													: 'border-white/80 bg-black/40'}"
											>
												{#if watched}<Check size={14} strokeWidth={3} />{/if}
											</span>
										</span>
										<span class="min-w-0 flex-1">
											<span class="line-clamp-2 text-sm leading-snug font-medium">
												<span class="text-zinc-500">{ep.number}.</span>
												{ep.title ?? `Folge ${ep.number}`}
											</span>
											<span class="mt-0.5 block text-xs text-zinc-500">
												{[
													ep.airDate && (ep.aired ? '' : 'erscheint am ') + formatDate(ep.airDate),
													ep.runtime && `${ep.runtime} Min.`
												]
													.filter(Boolean)
													.join(' · ')}
											</span>
											{#if ep.overview}
												<span class="mt-1 line-clamp-2 text-xs text-zinc-400">{ep.overview}</span>
											{/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</form>
				</div>
			</details>
		{/each}
	{/if}

	<ItemSheet
		category={data.category}
		item={sheetOpen ? { ...show.item, status: data.status } : null}
		onclose={() => (sheetOpen = false)}
		actionPath="/{data.category}"
		showEpisodesLink={false}
	/>
</main>
