// Short confirmations that lay themselves over the page for a few seconds and go away by
// themselves (see Toasts.svelte). Only for something that went well and would otherwise go
// unseen – errors and warnings stay on the page as a Notice.
export type Toast = { id: number; text: string };

const MAX = 3;
let next = 0;
export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function toast(text: string) {
	toasts.list = [...toasts.list.slice(-(MAX - 1)), { id: ++next, text }];
}

export function dismiss(id: number) {
	toasts.list = toasts.list.filter((entry) => entry.id !== id);
}
