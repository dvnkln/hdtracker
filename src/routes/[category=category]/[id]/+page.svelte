<script lang="ts">
	import { CATEGORIES } from '$lib/categories';
	import { hasEpisodes } from '$lib/status';
	import { formatDate, formatRating, formatRuntime, m, statusLabel } from '$lib/i18n/index.svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import ItemSheet from '$lib/components/ItemSheet.svelte';
	import Episodes from '$lib/components/Episodes.svelte';
	import { ArrowLeft, ExternalLink, ImageOff, Plus, Star } from '@lucide/svelte';

	let { data } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	let info = $derived(data.info);

	// Header line, e.g. "2024 · 2 Std. 47 Min." or "2023 · TV-Serie · 28 Folgen".
	let metaLine = $derived(
		[
			info.item.year,
			info.format && (m.detail.formats[info.format] ?? info.format),
			info.runtime && formatRuntime(info.runtime),
			info.seasonCount && m.detail.seasons(info.seasonCount),
			info.episodeCount && m.detail.episodeCount(info.episodeCount),
			info.episodeRuntime && m.detail.perEpisode(info.episodeRuntime)
		]
			.filter(Boolean)
			.join(' · ')
	);

	let sheetOpen = $state(false);
	let showFullOverview = $state(false);

	// Only offer "Mehr anzeigen" if the overview is really cut off (depends on screen width).
	let overviewEl = $state<HTMLParagraphElement>();
	let overviewClamped = $state(false);
	$effect(() => {
		void info.item.overview;
		if (overviewEl && !showFullOverview) {
			overviewClamped = overviewEl.scrollHeight > overviewEl.clientHeight + 1;
		}
	});

	// Streaming rows in display order.
	const WATCH_ROWS = ['flatrate', 'rent', 'buy'] as const;
	let hasOffers = $derived(
		!!info.watch && info.watch.flatrate.length + info.watch.rent.length + info.watch.buy.length > 0
	);
</script>

<svelte:head><title>{info.item.title} · hdtracker</title></svelte:head>

<div style:--accent={cat.accent}>
	<!-- Backdrop image, fading into the page background -->
	{#if info.backdropUrl}
		<div class="relative h-56 overflow-hidden sm:h-80">
			<img
				src={info.backdropUrl}
				alt=""
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover"
			/>
			<div
				class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/10"
			></div>
		</div>
	{/if}

	<main class="relative mx-auto max-w-screen-lg p-4 {info.backdropUrl ? '-mt-44 sm:-mt-56' : ''}">
		<a
			href="/{data.category}"
			class="inline-flex items-center gap-1 rounded-full bg-zinc-950/70 px-2.5 py-1 text-sm text-(--accent) backdrop-blur transition-colors hover:bg-zinc-900"
		>
			<ArrowLeft size={16} />
			{m.categories[data.category]}
		</a>

		<!-- Header -->
		<div class="mt-3 flex gap-4">
			<div
				class="aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-xl ring-1 ring-zinc-800 sm:w-44"
			>
				{#if info.item.posterUrl}
					<img
						src={info.item.posterUrl}
						alt=""
						referrerpolicy="no-referrer"
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="flex h-full items-center justify-center text-zinc-600"><ImageOff /></div>
				{/if}
			</div>

			<div class="flex min-w-0 flex-1 flex-col justify-end">
				<h1 class="text-xl leading-tight font-bold drop-shadow sm:text-3xl">{info.item.title}</h1>
				{#if info.item.originalTitle}
					<p class="text-sm text-zinc-400">{info.item.originalTitle}</p>
				{/if}
				<p class="mt-1 text-sm text-zinc-400">
					{metaLine}
					{#if info.rating}
						<span class="ml-1 inline-flex items-center gap-0.5 text-amber-400">
							<Star size={13} fill="currentColor" />
							{formatRating(info.rating)}
						</span>
					{/if}
				</p>
				{#if info.genres.length}
					<div class="mt-2 hidden flex-wrap gap-1.5 sm:flex">
						{#each info.genres as genre (genre)}
							<span class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300"
								>{genre}</span
							>
						{/each}
					</div>
				{/if}
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={() => (sheetOpen = true)}
						class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium {data.status
							? 'bg-(--accent) text-white hover:brightness-125'
							: 'border border-zinc-600 bg-zinc-900/80 hover:bg-zinc-800'} transition"
					>
						{#if data.status}
							{@const Icon = STATUS_ICONS[data.status]}
							<Icon size={16} />
							{statusLabel(data.category, data.status)}
						{:else}
							<Plus size={16} />
							{m.detail.addToLibrary}
						{/if}
					</button>
					<a
						href={info.externalUrl}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
					>
						{info.sourceLabel}
						<ExternalLink size={14} />
					</a>
				</div>
			</div>
		</div>

		<!-- Genres below the header on phones (not enough room next to the poster) -->
		{#if info.genres.length}
			<div class="mt-4 flex flex-wrap gap-1.5 sm:hidden">
				{#each info.genres as genre (genre)}
					<span class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">{genre}</span>
				{/each}
			</div>
		{/if}

		{#if info.item.overview}
			<p
				class="mt-4 text-sm leading-relaxed text-zinc-300"
				bind:this={overviewEl}
				class:line-clamp-5={!showFullOverview}
			>
				{info.item.overview}
			</p>
			{#if overviewClamped || showFullOverview}
				<button
					type="button"
					class="mt-1 text-sm text-(--accent) hover:underline"
					onclick={() => (showFullOverview = !showFullOverview)}
				>
					{showFullOverview ? m.common.less : m.common.more}
				</button>
			{/if}
		{/if}

		{#if info.facts.length}
			<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				{#each info.facts as fact (fact.key)}
					<dt class="text-zinc-500">{m.detail.facts[fact.key]}</dt>
					<dd class="text-zinc-200">{fact.isDate ? formatDate(fact.value) : fact.value}</dd>
				{/each}
			</dl>
		{/if}

		<!-- Streaming offers (movies/series, via TMDB + JustWatch) -->
		{#if info.watch}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{m.detail.whereToWatch}</h2>
				{#if hasOffers}
					<div class="mt-2 flex flex-col gap-3">
						{#each WATCH_ROWS as kind (kind)}
							{#if info.watch[kind].length}
								<div>
									<p class="mb-1.5 text-xs text-zinc-500 uppercase">{m.detail[kind]}</p>
									<div class="flex flex-wrap gap-2">
										{#each info.watch[kind] as provider (provider.name)}
											<a href={provider.url} target="_blank" rel="noreferrer" title={provider.name}>
												<img
													src={provider.logoUrl}
													alt={provider.name}
													loading="lazy"
													referrerpolicy="no-referrer"
													class="size-11 rounded-lg ring-1 ring-zinc-800 transition hover:scale-110 hover:ring-zinc-400"
												/>
											</a>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<p class="mt-1 text-sm text-zinc-500">{m.detail.noOffers}</p>
				{/if}
				<p class="mt-2 text-xs text-zinc-500">
					{m.detail.streamingDataBy}
					<a
						href="https://www.justwatch.com"
						target="_blank"
						rel="noreferrer"
						class="underline hover:text-zinc-300">JustWatch</a
					>.
				</p>
			</section>
		{/if}

		<!-- Anime: official streaming links from AniList -->
		{#if info.links.length}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{m.detail.streaming}</h2>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each info.links as link (link.url)}
						<a
							href={link.url}
							target="_blank"
							rel="noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
						>
							{link.name}
							<ExternalLink size={13} class="text-zinc-500" />
						</a>
					{/each}
				</div>
				<p class="mt-2 text-xs text-zinc-500">
					{m.detail.animeLinksNote}
				</p>
			</section>
		{/if}

		<!-- Series/anime: progress, seasons, episodes -->
		{#if data.show && hasEpisodes(data.category)}
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{m.detail.episodes}</h2>
				{#key info.item.externalId}
					<Episodes category={data.category} show={data.show} watched={data.watched} />
				{/key}
			</section>
		{/if}

		<!-- Similar titles, as a horizontally scrollable row -->
		{#if info.similar.length}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">{m.detail.similar}</h2>
				<ul class="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-3 pb-4">
					{#each info.similar as item (item.externalId)}
						{@const status = data.similarStatus[item.externalId]}
						<li class="w-28 shrink-0 snap-start sm:w-32">
							<a href="/{data.category}/{item.externalId}" class="group/poster block outline-none">
								<div
									class="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 transition duration-200 group-hover/poster:-translate-y-0.5 group-hover/poster:shadow-lg group-hover/poster:ring-2 group-hover/poster:shadow-black/50 group-hover/poster:ring-(--accent) group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-(--accent)"
								>
									{#if item.posterUrl}
										<img
											src={item.posterUrl}
											alt={item.title}
											loading="lazy"
											referrerpolicy="no-referrer"
											class="h-full w-full object-cover transition duration-300 group-hover/poster:scale-105"
										/>
									{:else}
										<div class="flex h-full items-center justify-center text-zinc-600">
											<ImageOff size={24} />
										</div>
									{/if}
									{#if status}
										<span
											class="absolute inset-x-1 bottom-1 truncate rounded bg-(--accent) px-1.5 py-0.5 text-center text-[11px] font-semibold text-white"
										>
											{statusLabel(data.category, status)}
										</span>
									{/if}
								</div>
								<p
									class="mt-1.5 line-clamp-2 text-sm leading-tight font-medium transition-colors group-hover/poster:text-(--accent)"
								>
									{item.title}
								</p>
								<p class="text-xs text-zinc-500">{item.year ?? '–'}</p>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<ItemSheet
			category={data.category}
			item={sheetOpen ? { ...info.item, status: data.status } : null}
			onclose={() => (sheetOpen = false)}
			actionPath="/{data.category}"
			showDetailsLink={false}
		/>
	</main>
</div>
