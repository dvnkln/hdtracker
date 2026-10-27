<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { Check, TriangleAlert } from '@lucide/svelte';
	import { m } from '#lib/i18n/index.svelte.js';
	import { dismiss, toasts, type Toast } from '#lib/toasts.svelte.js';

	// Where the messages of toasts.svelte.ts show up, never wider than a phone: confirmations at
	// the bottom, just above the navigation; errors at the top, just below the header. A bar
	// fills from left to right while one is there; when it is full, it goes. A tap closes it at
	// once, the mouse over it holds the bar.
	const still =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	let done = $derived(toasts.list.filter((entry) => entry.kind === 'done'));
	let errors = $derived(toasts.list.filter((entry) => entry.kind === 'error'));

	// An error often comes while a window is open (the status window, the parts of a series):
	// an open window lies in the browser's top layer, above everything else on the page, and
	// makes the rest untouchable. So the errors are a popover – shown again with each new one,
	// they lie in the top layer too, above the window.
	let top: HTMLElement;
	$effect(() => {
		if (errors.length === 0) {
			if (top.matches(':popover-open')) top.hidePopover();
			return;
		}
		void errors[errors.length - 1].id;
		if (top.matches(':popover-open')) top.hidePopover();
		top.showPopover();
	});
</script>

{#snippet message(entry: Toast, from: number)}
	{@const error = entry.kind === 'error'}
	<button
		type="button"
		title={m.common.close}
		onclick={() => dismiss(entry.id)}
		in:fly={{ y: still ? 0 : from, duration: still ? 0 : 180 }}
		out:fade={{ duration: still ? 0 : 200 }}
		class="toast ui-card pointer-events-auto relative flex max-w-md items-start gap-2.5 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 px-4 pt-3 pb-3.5 text-left text-sm text-zinc-100 shadow-xl shadow-black/50"
	>
		{#if error}
			<TriangleAlert size={18} class="mt-px shrink-0 text-amber-400" />
		{:else}
			<Check size={18} class="mt-px shrink-0 text-emerald-400" />
		{/if}
		<span class="min-w-0">{entry.text}</span>
		<span
			class="bar absolute bottom-0 left-0 h-1 {error ? 'error bg-amber-400' : 'bg-emerald-400'}"
			onanimationend={() => dismiss(entry.id)}
		></span>
	</button>
{/snippet}

<div
	role="status"
	class="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-2 px-4 pb-2"
>
	{#each done as entry (entry.id)}{@render message(entry, 16)}{/each}
</div>

<div
	bind:this={top}
	popover="manual"
	role="alert"
	class="pointer-events-none fixed inset-x-0 top-[calc(var(--header-h,3.5rem)+0.5rem)] m-0 w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 text-inherit [&:popover-open]:flex"
>
	{#each errors as entry (entry.id)}{@render message(entry, -16)}{/each}
</div>

<style>
	.bar {
		width: 0;
		animation: fill 4s linear forwards;
	}
	/* An error takes longer to read */
	.bar.error {
		animation-duration: 6s;
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
