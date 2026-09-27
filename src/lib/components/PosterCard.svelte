<script lang="ts">
	import { ImageOff } from '@lucide/svelte';

	type Props = {
		title: string;
		year: number | null;
		posterUrl: string | null;
		badge?: string | null;
		onclick: () => void;
	};
	let { title, year, posterUrl, badge = null, onclick }: Props = $props();
</script>

<!-- Hover (mouse only): poster zooms a little, frame lights up in the accent colour -->
<button type="button" class="group/poster flex w-full flex-col text-left outline-none" {onclick}>
	<div
		class="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 transition duration-200 group-hover/poster:-translate-y-0.5 group-hover/poster:shadow-lg group-hover/poster:ring-2 group-hover/poster:shadow-black/50 group-hover/poster:ring-(--accent) group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-(--accent)"
	>
		{#if posterUrl}
			<img
				src={posterUrl}
				alt={title}
				loading="lazy"
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover transition duration-300 group-hover/poster:scale-105"
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
		class="mt-1.5 line-clamp-2 text-sm leading-tight font-medium transition-colors group-hover/poster:text-(--accent)"
	>
		{title}
	</p>
	<p class="text-xs text-zinc-500">{year ?? '–'}</p>
</button>
