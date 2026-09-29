<script lang="ts">
	import { m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';
	import { Bug, Database, ExternalLink, History, Link, Scale } from '@lucide/svelte';

	let { data } = $props();

	const { card, heading, hint, pageTitle } = ui;
	const REPO = 'https://github.com/dvnkln/hdtracker';

	let links = $derived([
		{ href: REPO, label: m.about.source, icon: ExternalLink },
		{ href: `${REPO}/issues`, label: m.about.issues, icon: Bug },
		{ href: `${REPO}/blob/main/LICENSE`, label: m.about.license, icon: Scale }
	]);

	// TMDB asks for exactly this attribution; JustWatch provides the streaming offers.
	let sources = $derived([
		{ name: 'TMDB', href: 'https://www.themoviedb.org', text: m.about.tmdb },
		{ name: 'JustWatch', href: 'https://www.justwatch.com', text: m.about.justwatch },
		{ name: 'IGDB', href: 'https://www.igdb.com', text: m.about.igdb },
		{ name: 'AniList', href: 'https://anilist.co', text: m.about.anilist }
	]);

	const linkClass =
		'-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100';
</script>

<svelte:head><title>{m.about.title} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.about.title}</h2>

<!-- Name, version (links to the release notes of exactly this version) and description -->
<section class={card}>
	<div class="flex flex-wrap items-center gap-2">
		<h3 class="text-lg font-semibold">hdtracker</h3>
		<a
			href="{REPO}/releases/tag/v{data.version}"
			target="_blank"
			rel="noreferrer"
			title={m.about.versionHint}
			class="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
		>
			{m.about.version(data.version)}
			<History size={12} />
		</a>
	</div>
	<p class="mt-1 text-sm text-zinc-400">{m.about.tagline}</p>
</section>

<section class={card}>
	<h3 class={heading}><Link size={20} class="text-zinc-400" />{m.about.links}</h3>
	<ul class="mt-2">
		{#each links as link (link.href)}
			<li>
				<a href={link.href} target="_blank" rel="noreferrer" class={linkClass}>
					<link.icon size={18} class="shrink-0 text-zinc-400" />
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</section>

<section class={card}>
	<h3 class={heading}><Database size={20} class="text-zinc-400" />{m.about.dataSources}</h3>
	<ul class="mt-3 flex flex-col gap-3">
		{#each sources as source (source.name)}
			<li class="text-sm">
				<a
					href={source.href}
					target="_blank"
					rel="noreferrer"
					class="font-medium text-zinc-100 underline decoration-zinc-600 underline-offset-2 hover:decoration-zinc-300"
					>{source.name}</a
				>
				<span class="text-zinc-400"> – {source.text}</span>
			</li>
		{/each}
	</ul>
</section>

<p class="mt-6 text-center {hint}">{m.about.ai}</p>
