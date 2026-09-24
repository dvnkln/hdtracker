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

<button type="button" class="flex w-full flex-col text-left" {onclick}>
	<div
		class="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800"
	>
		{#if posterUrl}
			<img
				src={posterUrl}
				alt={title}
				loading="lazy"
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover"
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
	<p class="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{title}</p>
	<p class="text-xs text-zinc-500">{year ?? '–'}</p>
</button>
