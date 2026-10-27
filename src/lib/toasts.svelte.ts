// Short messages that lay themselves over the page for a few seconds and go away by themselves
// (see Toasts.svelte):
// - "done" (bottom): something went well and would otherwise go unseen.
// - "error" (top): a data source failed, so a page could not be opened or an action not be
//   done – the user stays where they were (see guardNavigation.svelte.ts). Problems of a form on
//   a page stay on the page as a Notice.
export type Toast = { id: number; text: string; kind: 'done' | 'error' };

const MAX = 3;
let next = 0;
export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function toast(text: string, { kind = 'done' }: { kind?: Toast['kind'] } = {}) {
	// The same error again (e.g. tapped twice): one message, started afresh
	const others = toasts.list.filter((entry) => !(entry.kind === kind && entry.text === text));
	const mine = others.filter((entry) => entry.kind === kind);
	const drop = mine.length >= MAX ? mine[0].id : null;
	toasts.list = [...others.filter((entry) => entry.id !== drop), { id: ++next, text, kind }];
}

export function dismiss(id: number) {
	toasts.list = toasts.list.filter((entry) => entry.id !== id);
}
