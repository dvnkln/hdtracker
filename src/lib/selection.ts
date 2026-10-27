// Selecting several posters, the way a file manager does it.
//
// `anchor` is the poster picked last by itself; a range (Shift+click) hangs on it: clicking
// further on or further back lets the range grow or shrink. `base` is what was selected
// before the range began – it stays, whatever the range does.
export type Selection = { chosen: number[]; anchor: number | null; base: number[] };

export const NOTHING: Selection = { chosen: [], anchor: null, base: [] };

// One poster more or less (tap, Ctrl+click, holding it). It becomes the anchor.
export function pickOne(selection: Selection, id: number): Selection {
	const chosen = selection.chosen.includes(id)
		? selection.chosen.filter((other) => other !== id)
		: [...selection.chosen, id];
	return { chosen, anchor: id, base: chosen };
}

// A stack of posters (an anime series in the library) counts as one: all of it more, or – if all
// of it was chosen – all of it less. Its first title becomes the anchor.
export function pickGroup(selection: Selection, ids: number[]): Selection {
	const all = ids.every((id) => selection.chosen.includes(id));
	const chosen = all
		? selection.chosen.filter((id) => !ids.includes(id))
		: [...new Set([...selection.chosen, ...ids])];
	return { chosen, anchor: ids[0], base: chosen };
}

// Everything from the anchor up to `id`, in the order of the page (`order`: the posters one
// can see). Without an anchor in sight it is a single pick.
export function pickRange(selection: Selection, order: number[], id: number): Selection {
	const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
	const to = order.indexOf(id);
	if (from === -1 || to === -1) return pickOne(selection, id);
	const between = order.slice(Math.min(from, to), Math.max(from, to) + 1);
	return { ...selection, chosen: [...new Set([...selection.base, ...between])] };
}

// Everything one can see (Ctrl+A).
export const pickAll = (order: number[]): Selection => ({
	chosen: [...order],
	anchor: null,
	base: [...order]
});
