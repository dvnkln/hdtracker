// Collapsible sections whose heading sticks below the header while their titles scroll by – the
// library (one per status) and the streaming page (one per area) use the same pieces.
//
// The heading sticks below the header while its titles scroll by; once the last of them is gone,
// the next heading pushes it away (sticky only works within its own section – that is the whole
// trick). The space above a heading belongs to it (pt-6), not to the page: so the heading sticks
// right where it stands, instead of first sliding up by the page's padding. Below it, while titles
// scroll by, a short fade into them instead of a hard edge (data-stuck, see markStuck). It starts
// one pixel inside the heading: touching edges let a thin line of the posters show through on
// phones. It stays below the header and the bottom bar (both z-10; e2e/07f-layers checks it).
export const STICKY_SUMMARY =
	'group/summary sticky top-(--header-h) z-[2] -mx-4 flex list-none items-center gap-2 bg-zinc-950 px-4 pt-6 pb-2 select-none after:pointer-events-none after:absolute after:inset-x-0 after:top-[calc(100%-1px)] after:h-[17px] after:bg-linear-to-b after:from-zinc-950 after:to-transparent after:opacity-0 after:transition-opacity after:duration-150 data-stuck:after:opacity-100 [&::-webkit-details-marker]:hidden';

// A heading that has titles scrolling by beneath it gets a soft edge (data-stuck): its section
// starts above it then. At rest – also the first heading at the top of the page – it stays hard,
// so the edge never shades the posters of a heading that is just standing there.
let frame = 0;
export function markStuck(selector = 'details[data-sticky]') {
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(() => {
		for (const section of document.querySelectorAll<HTMLDetailsElement>(selector)) {
			const heading = section.querySelector('summary');
			if (!heading) continue;
			const stuck = section.getBoundingClientRect().top < heading.getBoundingClientRect().top - 0.5;
			heading.toggleAttribute('data-stuck', stuck);
		}
	});
}

// Folding a section whose heading sticks at the top would leave one somewhere further down the
// page: then go back up to where the section starts.
export function backToFolded(section: HTMLDetailsElement) {
	const header = document.querySelector('[data-chrome="header"]')?.getBoundingClientRect();
	const top = section.getBoundingClientRect().top;
	if (!section.open && header && top < header.bottom) {
		window.scrollBy({ top: top - header.bottom, behavior: 'instant' });
	}
}
