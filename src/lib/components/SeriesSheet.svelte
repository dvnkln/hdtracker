<script lang="ts" module>
	import { partCounts, type AnimeEntry, type AnimeFacts } from '#lib/animeSeries.js';
	import type { SheetItem } from '#lib/components/ItemSheet.svelte';
	import { m } from '#lib/i18n/index.svelte.js';

	export type AnimeHit = SheetItem & { anime?: AnimeFacts };
	export type Series = Extract<AnimeEntry<AnimeHit>, { kind: 'series' }>;

	const join = (parts: (string | number | null | undefined)[]) =>
		parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ');

	// "2017 · TV · 12 episodes" – with `season`: "Spring 2017 · TV · 12 episodes"
	export function animeInfo(hit: AnimeHit, season = false) {
		const t = m.animeSeries;
		const facts = hit.anime;
		const format = facts?.format ? (t.formats[facts.format] ?? facts.format) : null;
		const episodes =
			facts?.episodes && facts.format !== 'MOVIE' ? t.episodes(facts.episodes) : null;
		const when =
			season && facts?.season && hit.year ? `${t.airSeasons[facts.season]} ${hit.year}` : hit.year;
		return join([when, format, episodes]);
	}

	// Which part of the series a title is: "S2", or what kind it is ("Movie", "OVA")
	export function partLabel(series: Series, hit: AnimeHit) {
		const t = m.animeSeries;
		const n = series.seasons.indexOf(hit);
		const format = hit.anime?.format;
		// A season is "S2" only when no season before it is missing (else its kind, like any part)
		if (n >= 0 && series.numbered) return t.seasonShort(n + 1);
		return format ? (t.formats[format] ?? format) : null;
	}

	// The one line under the poster of a series: where the user is ("2017 · S2") while they watch
	// it or paused it – otherwise what is in it ("3 seasons · 2 movies · 1 OVA")
	export function seriesLine(series: Series, face: AnimeHit | null) {
		if (face?.status === 'active' || face?.status === 'paused') {
			return join([face.year, partLabel(series, face)]);
		}
		const kinds = m.animeSeries.kinds;
		return partCounts(series)
			.map(({ kind, n }) => {
				const [one, many] = kinds[kind] ?? kinds.OTHER;
				return `${n} ${n === 1 ? one : many}`;
			})
			.join(' · ');
	}
</script>

<script lang="ts">
	import { img } from '#lib/images.js';
	import { statusLabel } from '#lib/i18n/index.svelte.js';
	import { STATUS_ICONS } from '#lib/statusIcons.js';
	import { titles } from '#lib/titles.svelte.js';
	import { Plus, X } from '@lucide/svelte';

	// The parts of an anime series (one poster in the search): seasons in order, films, extras,
	// each with its status. Tapping a part opens the status window on top of this one.
	type Props = {
		series: Series | null;
		// Name of the series, if not that of its first part (a stack of only its films)
		name?: string;
		// The part whose poster the stack shows (so the window shows the same one)
		face?: AnimeHit | null;
		onpick: (hit: AnimeHit) => void;
		onclose: () => void;
	};
	let { series, name, face, onpick, onclose }: Props = $props();
	let poster = $derived((face ?? series?.cover)?.posterUrl);

	let dialog: HTMLDialogElement;
	$effect(() => {
		if (series && !dialog.open) dialog.showModal();
		else if (!series && dialog.open) dialog.close();
	});

	let parts = $derived(series ? [...series.seasons, ...series.movies, ...series.extras] : []);
	let tracked = $derived(parts.filter((hit) => hit.status).length);
	let years = $derived(
		series?.from
			? series.from === series.to
				? `${series.from}`
				: `${series.from}–${series.to}`
			: ''
	);
</script>

{#snippet part(hit: AnimeHit, n: number | null)}
	<li>
		<button
			type="button"
			onclick={() => onpick(hit)}
			class="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-zinc-800"
		>
			<div
				class="aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-zinc-800 ring-1 ring-zinc-700"
			>
				{#if img(hit.posterUrl)}
					<img
						src={img(hit.posterUrl)}
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
						class="h-full w-full object-cover"
					/>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">
					{#if n}<span class="text-zinc-500">{n}.</span>{/if}
					{titles('anime', hit).main}
				</p>
				<p class="truncate text-xs text-zinc-500">{animeInfo(hit, true)}</p>
			</div>
			{#if hit.status}
				{@const Icon = STATUS_ICONS[hit.status]}
				<span
					class="flex shrink-0 items-center gap-1 rounded-full bg-(--accent)/15 px-2 py-0.5 text-[11px] font-medium text-(--accent)"
				>
					<Icon size={12} strokeWidth={2.5} />{statusLabel('anime', hit.status)}
				</span>
			{:else}
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400"
					title={m.animeSeries.add}><Plus size={15} /></span
				>
			{/if}
		</button>
	</li>
{/snippet}

{#snippet block(label: string, list: AnimeHit[], numbered = false)}
	{#if list.length}
		<h3 class="mt-4 mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</h3>
		<ul>
			{#each list as hit, i (hit.externalId)}{@render part(hit, numbered ? i + 1 : null)}{/each}
		</ul>
	{/if}
{/snippet}

<!-- Tapping the dark backdrop (the dialog element itself) closes the window -->
<dialog
	bind:this={dialog}
	onclose={() => onclose()}
	onclick={(e) => e.target === dialog && onclose()}
	class="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70 sm:mx-auto sm:mb-auto sm:max-w-lg sm:rounded-2xl sm:border"
>
	{#if series}
		<div class="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
			<div class="flex gap-4">
				{#if img(poster)}
					<img
						src={img(poster)}
						alt=""
						referrerpolicy="no-referrer"
						class="aspect-[2/3] w-20 shrink-0 rounded-lg object-cover"
					/>
				{/if}
				<div class="min-w-0 flex-1">
					<h2 class="text-lg leading-tight font-bold">
						{name ?? titles('anime', series.cover).main}
					</h2>
					{#if years}<p class="mt-1 text-sm text-zinc-400">{years}</p>{/if}
					<p class="mt-1 text-xs text-zinc-500">
						{join([
							series.seasons.length ? m.animeSeries.seasons(series.seasons.length) : null,
							series.movies.length ? m.animeSeries.movies(series.movies.length) : null,
							series.extras.length ? m.animeSeries.extras(series.extras.length) : null
						])}
					</p>
					{#if tracked}
						<p class="mt-1 text-xs text-(--accent)">{m.animeSeries.inLibrary(tracked)}</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => onclose()}
					aria-label={m.common.close}
					class="self-start rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
				>
					<X size={20} />
				</button>
			</div>
			{@render block(m.animeSeries.seasonsTitle, series.seasons, series.numbered)}
			{@render block(m.animeSeries.moviesTitle, series.movies)}
			{@render block(m.animeSeries.extrasTitle, series.extras)}
		</div>
	{/if}
</dialog>
