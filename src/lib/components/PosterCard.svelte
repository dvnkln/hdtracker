<script lang="ts">
	import { m } from '#lib/i18n/index.svelte.js';
	import { img } from '#lib/images.js';
	import type { Person } from '#lib/avatar.js';
	import TogetherMark from '#lib/components/TogetherMark.svelte';
	import { Check, ImageOff } from '@lucide/svelte';

	type Props = {
		title: string;
		year: number | null;
		posterUrl: string | null;
		badge?: string | null;
		// Game that is currently only available in early access
		earlyAccess?: boolean;
		// Details (year, ...) not loaded yet, e.g. right after an import
		loading?: boolean;
		// Who tracks this title along with the user (small profile pictures on the poster)
		people?: Person[];
		// While titles are being selected: whether this one is (undefined = no selection going on)
		selected?: boolean;
		// Selecting is possible here: called when the poster is held (phone), right-clicked or
		// Ctrl-clicked, or when its circle is clicked (computer). `range` is true for a
		// Shift+click: everything from the poster chosen last up to this one
		onselect?: (range: boolean) => void;
		// Either a link (href) or a button (onclick)
		href?: string;
		onclick?: () => void;
	};
	let {
		title,
		year,
		posterUrl,
		badge = null,
		earlyAccess = false,
		loading = false,
		people = [],
		selected,
		onselect,
		href,
		onclick
	}: Props = $props();

	// Holding a poster. Android reports it as a "context menu" event, like a right click; the
	// iPhone does not, so a timer watches the finger as well. Whichever comes first counts,
	// once per touch – and the click that may follow when the finger lifts is swallowed.
	const HOLD_MS = 500;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let held = false;
	let start = { x: 0, y: 0 };
	const cancelHold = () => clearTimeout(timer);
	function hold() {
		if (held) return;
		held = true;
		onselect?.(false);
	}
	function onpointerdown(e: PointerEvent) {
		held = false;
		cancelHold();
		if (!onselect || e.pointerType === 'mouse') return;
		start = { x: e.clientX, y: e.clientY };
		timer = setTimeout(hold, HOLD_MS);
	}
	function onpointermove(e: PointerEvent) {
		// The finger moves: that is scrolling, not holding
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancelHold();
	}
	function oncontextmenu(e: MouseEvent) {
		if (!onselect) return;
		e.preventDefault();
		cancelHold();
		hold();
	}
	function clicked(e: MouseEvent) {
		cancelHold();
		if (held) {
			held = false;
			e.preventDefault();
			return;
		}
		const circle = (e.target as HTMLElement).closest('[data-select]');
		if (onselect && (e.shiftKey || e.ctrlKey || e.metaKey || circle)) {
			e.preventDefault();
			onselect(e.shiftKey);
		} else onclick?.();
	}
</script>

<!-- Hover (mouse only): frame and title light up in the accent colour, the image darkens a
     little. Short transitions, so it feels immediate. -->
<svelte:element
	this={href ? 'a' : 'button'}
	{href}
	type={href ? undefined : 'button'}
	role={href ? 'link' : 'button'}
	onclick={href ? undefined : clicked}
	{onpointerdown}
	onmousedown={(e: MouseEvent) => {
		// A Shift+click selects posters, not the text between them
		if (onselect && e.shiftKey) e.preventDefault();
	}}
	{onpointermove}
	onpointerup={cancelHold}
	onpointercancel={cancelHold}
	{oncontextmenu}
	aria-pressed={selected}
	class="group/poster flex w-full flex-col text-left outline-none {onselect
		? 'select-none [-webkit-touch-callout:none]'
		: ''}"
>
	<div
		class="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-900 transition-shadow duration-100 group-hover/poster:ring-2 group-hover/poster:ring-(--accent) group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-(--accent) {selected
			? 'ring-2 ring-(--accent)'
			: 'ring-1 ring-zinc-800'}"
	>
		{#if img(posterUrl)}
			<img
				src={img(posterUrl)}
				alt={title}
				loading="lazy"
				draggable="false"
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover transition-[filter] duration-100 group-hover/poster:brightness-60"
			/>
		{:else}
			<div class="flex h-full items-center justify-center text-zinc-600">
				<ImageOff size={28} />
			</div>
		{/if}
		{#if onselect && selected === undefined}
			<!-- Computer: a circle appears while the mouse is over the poster – click it to select -->
			<span
				data-select
				title={m.share.select}
				class="absolute top-1 left-1 hidden size-6 rounded-full border-2 border-white/80 bg-black/50 hover:bg-(--accent) [@media(hover:hover)]:group-hover/poster:block"
			></span>
		{/if}
		{#if selected !== undefined}
			<!-- Selecting: a tick on the chosen ones, an empty circle on the others -->
			<span
				class="absolute top-1 left-1 flex size-6 items-center justify-center rounded-full ring-2 ring-zinc-950 {selected
					? 'bg-(--accent) text-white'
					: 'border-2 border-white/80 bg-black/50 text-transparent ring-0'}"
			>
				<Check size={15} strokeWidth={3} />
			</span>
		{/if}
		<!-- Who tracks along: small in the corner (above the status strip of a search hit) -->
		<TogetherMark {people} corner class="absolute right-1 {badge ? 'bottom-7' : 'bottom-1'}" />
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
	<!-- No year: still loading ("…") or not announced yet ("TBA"), explained on hover -->
	<p class="text-xs text-zinc-500">
		{#if year}{year}{earlyAccess ? ` · ${m.common.earlyAccess}` : ''}{:else if loading}<span
				title={m.common.loadingDetails}
				class="animate-pulse">…</span
			>{:else}<span title={m.common.tbaHint}>{m.common.tba}</span>{/if}
	</p>
</svelte:element>
