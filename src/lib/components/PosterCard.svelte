<script lang="ts">
	import { ImageOff } from '@lucide/svelte';

	type Props = {
		title: string;
		year: number | null;
		posterUrl: string | null;
		badge?: string | null;
		// Either a link (href) or a button (onclick)
		href?: string;
		onclick?: () => void;
	};
	let { title, year, posterUrl, badge = null, href, onclick }: Props = $props();
</script>

<!-- Hover (mouse only): frame and title light up in the accent colour, the image darkens a
     little. Short transitions, so it feels immediate. -->
<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	type={href ? undefined : 'button'}
	role={href ? 'link' : 'button'}
	{onclick}
	class="group/poster flex w-full flex-col text-left outline-none"
>
	<div
		class="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 transition-shadow duration-100 group-hover/poster:ring-2 group-hover/poster:ring-(--accent) group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-(--accent)"
	>
		{#if posterUrl}
			<img
				src={posterUrl}
				alt={title}
				loading="lazy"
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover transition-[filter] duration-100 group-hover/poster:brightness-75"
			/>
		{:else}
			<div class="flex h-full items-center justify-center text-zinc-600">
				<ImageOff size={28} />
			</div>
		{/if}
		{#if badge}
			<span
				class="absolute inset-x-1 bottom-1 truncate rounded bg-(--accent) px-1.5 py-0.5 text-center text-[11px] font-semibold text-white"
			>
				{badge}
			</span>
		{/if}
	</div>
	<p
		class="mt-1.5 line-clamp-2 text-sm leading-tight font-medium transition-colors duration-100 group-hover/poster:text-(--accent)"
	>
		{title}
	</p>
	<p class="text-xs text-zinc-500">{year ?? '–'}</p>
</svelte:element>
