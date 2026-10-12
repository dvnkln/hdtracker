<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { Check } from '@lucide/svelte';
	import { m } from '$lib/i18n/index.svelte';
	import { dismiss, toasts } from '$lib/toasts.svelte';

	// Where the confirmations of toasts.svelte.ts show up: at the bottom, just above the
	// navigation, never wider than a phone. A bar fills from left to right while one is there;
	// when it is full, it goes. A tap closes it at once, the mouse over it holds the bar.
	const still =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div
	role="status"
	class="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-2 px-4 pb-2"
>
	{#each toasts.list as entry (entry.id)}
		<button
			type="button"
			title={m.common.close}
			onclick={() => dismiss(entry.id)}
			in:fly={{ y: still ? 0 : 16, duration: still ? 0 : 180 }}
			out:fade={{ duration: still ? 0 : 200 }}
			class="toast ui-card pointer-events-auto relative flex max-w-md items-start gap-2.5 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 px-4 pt-3 pb-3.5 text-left text-sm text-zinc-100 shadow-xl shadow-black/50"
		>
			<Check size={18} class="mt-px shrink-0 text-emerald-400" />
			<span class="min-w-0">{entry.text}</span>
			<span
				class="bar absolute bottom-0 left-0 h-1 bg-emerald-400"
				onanimationend={() => dismiss(entry.id)}
			></span>
		</button>
	{/each}
</div>

<style>
	.bar {
		width: 0;
		animation: fill 4s linear forwards;
	}
	.toast:hover .bar {
		animation-play-state: paused;
	}
	@keyframes fill {
		to {
			width: 100%;
		}
	}
</style>
