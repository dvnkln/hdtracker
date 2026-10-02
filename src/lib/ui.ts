// Shared class lists for form pages (settings, maintenance), so they look the same.
export const ui = {
	pageTitle: 'text-xl font-bold',
	// "ui-card" / "ui-btn" (SubmitButton.svelte) are hooks for theme extras in layout.css
	card: 'ui-card mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4',
	heading: 'flex items-center gap-2 text-lg font-semibold',
	label: 'flex flex-col gap-1',
	labelText: 'text-sm font-medium',
	hint: 'text-xs text-zinc-500',
	actions: 'flex flex-wrap items-center gap-3'
};
