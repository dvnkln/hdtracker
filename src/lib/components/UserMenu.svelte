<script lang="ts">
	import { page } from '$app/state';
	import type { Person } from '$lib/avatar';
	import { m } from '$lib/i18n/index.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { LogOut, Settings } from '@lucide/svelte';

	// The own profile picture at the right end of the header. A tap opens a small menu: who is
	// logged in, the settings, logging out. `username` is only shown where it differs from the
	// name others see.
	type Props = { person: Person; username: string };
	let { person, username }: Props = $props();

	let open = $state(false);
	let root: HTMLElement;

	let inSettings = $derived(page.url.pathname.split('/')[1] === 'settings');

	// Close the menu whenever the page changes.
	$effect(() => {
		void page.url;
		open = false;
	});

	// Arrow keys walk through the entries, like in the menu of the search field.
	function onMenuKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const entries = [...root.querySelectorAll<HTMLElement>('[role=menuitem]')];
		const at = entries.indexOf(document.activeElement as HTMLElement);
		const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
		entries[(next + entries.length) % entries.length]?.focus();
	}

	const entry =
		'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100';
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
	onclick={(e) => {
		if (open && !root.contains(e.target as Node)) open = false;
	}}
/>

<div bind:this={root} class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={m.common.accountMenu}
		class="flex rounded-full p-1 transition-colors hover:bg-zinc-800 {open || inSettings
			? 'bg-zinc-800'
			: ''}"
	>
		<Avatar {person} class="size-7 text-xs" />
	</button>

	{#if open}
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			role="menu"
			onkeydown={onMenuKey}
			class="ui-card absolute top-full right-0 z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/50"
		>
			<!-- Who is logged in; leads to the own account -->
			<a role="menuitem" href="/settings/account" class="{entry} gap-3">
				<Avatar {person} class="size-9 text-sm" />
				<span class="min-w-0">
					<span class="block truncate font-medium text-zinc-100">{person.name}</span>
					{#if person.name !== username}
						<span class="block truncate text-xs text-zinc-500">@{username}</span>
					{/if}
				</span>
			</a>
			<div class="my-1 border-t border-zinc-800"></div>
			<a
				role="menuitem"
				href="/settings"
				class={entry}
				aria-current={inSettings ? 'page' : undefined}
			>
				<Settings size={17} class="text-zinc-400" />{m.common.settings}
			</a>
			<form method="POST" action="/logout">
				<button role="menuitem" class={entry}>
					<LogOut size={17} class="text-zinc-400" />{m.common.logout}
				</button>
			</form>
		</div>
	{/if}
</div>
