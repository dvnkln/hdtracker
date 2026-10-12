<script lang="ts">
	import { onMount } from 'svelte';

	// The scrollbar of the page on computers: a slim handle that floats over the content at the
	// right edge instead of taking a strip of the layout (the browser's own bar is hidden there,
	// see layout.css). Scrolling itself stays the browser's – wheel, keys, touchpad; this only
	// shows where one is, and can be dragged. Phones and tablets keep their own floating bar.
	const MIN_HEIGHT = 36;
	const LINGER_MS = 1200;

	let enabled = $state(false);
	let scrollable = $state(false);
	let top = $state(0);
	let height = $state(0);
	let shown = $state(false);
	let dragging = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Where on the handle it was grabbed
	let grip = 0;

	// The handle runs between the fixed bars, not over them: what scrolls lies below the header
	// and above the navigation. Measured, because their height differs per theme; pages without
	// them (login) get the whole window.
	function track() {
		const view = window.innerHeight;
		const header = document.querySelector('[data-chrome="header"]')?.getBoundingClientRect();
		const nav = document.querySelector('[data-chrome="nav"]')?.getBoundingClientRect();
		const from = header ? Math.min(Math.max(0, header.bottom), view) : 0;
		const to = nav ? Math.min(Math.max(from, nav.top), view) : view;
		return { from, length: to - from };
	}
	function measure() {
		const view = window.innerHeight;
		const total = document.documentElement.scrollHeight;
		scrollable = total > view + 1;
		if (!scrollable) return;
		const { from, length } = track();
		height = Math.min(length, Math.max(MIN_HEIGHT, (length * view) / total));
		top = from + (window.scrollY / (total - view)) * (length - height);
	}
	function show() {
		shown = true;
		clearTimeout(timer);
		timer = setTimeout(() => (shown = false), LINGER_MS);
	}

	onMount(() => {
		if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
		enabled = true;
		measure();
		const onScroll = () => {
			measure();
			show();
		};
		// Near the right edge: show it, so it can be found without scrolling first
		const onMove = (e: PointerEvent) => {
			if (window.innerWidth - e.clientX < 20) show();
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', measure);
		window.addEventListener('pointermove', onMove, { passive: true });
		// The page grows and shrinks without scrolling: posters load, sections unfold
		const watcher = new ResizeObserver(measure);
		watcher.observe(document.body);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', measure);
			window.removeEventListener('pointermove', onMove);
			watcher.disconnect();
			clearTimeout(timer);
		};
	});

	function grab(e: PointerEvent) {
		dragging = true;
		grip = e.clientY - top;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault(); // no text selection while dragging
	}
	function drag(e: PointerEvent) {
		if (!dragging) return;
		const view = window.innerHeight;
		const total = document.documentElement.scrollHeight;
		const { from, length } = track();
		const room = length - height;
		if (room <= 0) return;
		const to = Math.min(Math.max(0, e.clientY - grip - from), room);
		window.scrollTo({ top: (to / room) * (total - view), behavior: 'instant' });
	}
	function release() {
		dragging = false;
		show();
	}
</script>

{#if enabled && scrollable}
	<!-- Not for screen readers: the page itself is what scrolls -->
	<div
		data-scroll-thumb
		aria-hidden="true"
		onpointerdown={grab}
		onpointermove={drag}
		onpointerup={release}
		onpointercancel={release}
		style:top="{top}px"
		style:height="{height}px"
		class="scroll-thumb fixed right-0.5 z-40 w-1.5 touch-none rounded-full bg-zinc-500 transition-[opacity,width] duration-150 hover:w-2.5 hover:opacity-90 {dragging
			? 'w-2.5 opacity-90'
			: shown
				? 'opacity-70'
				: 'opacity-0'}"
	></div>
{/if}
