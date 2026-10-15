<script lang="ts">
	import { Check, Funnel, UserX, Users, X } from '@lucide/svelte';
	import type { Person } from '$lib/avatar';
	import { m } from '$lib/i18n/index.svelte';
	import { img } from '$lib/images';
	import { countWith, type Filterable } from '$lib/libraryFilter';
	import Avatar from '$lib/components/Avatar.svelte';

	// The filter of the library: a funnel in the line of the first heading (it takes no line of
	// its own – put it into a `relative` box around the sections), what is switched on next to
	// it, and the window to choose in. The rules are in libraryFilter.ts.
	type Props = {
		// What this area offers (see offered())
		offer: { people: Person[]; services: { name: string; logoUrl: string }[]; genres: string[] };
		// All titles of the area, for the numbers behind the entries
		items: Filterable[];
		// The filters that are on, and how many titles they leave
		chosen: string[];
		left: number;
		onchange: (keys: string[]) => void;
	};
	let { offer, items, chosen, left, onchange }: Props = $props();

	let dialog: HTMLDialogElement;
	let on = $derived(new Set(chosen));
	const toggle = (key: string) =>
		onchange(on.has(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
	const count = (key: string) => countWith(items, chosen, key);
	const nameOf = (key: string) => {
		const value = key.slice(key.indexOf(':') + 1);
		return key === 'shared'
			? m.library.filter.shared
			: key === 'alone'
				? m.library.filter.alone
				: key.startsWith('person:')
					? m.library.filter.withName(
							offer.people.find((person) => String(person.id) === value)?.name ?? ''
						)
					: value;
	};

	const mark =
		'ui-btn inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-800 py-1 pr-1.5 pl-3 text-sm transition-colors hover:bg-zinc-700';
	const textLink =
		'text-sm text-zinc-400 underline-offset-2 transition-colors hover:text-zinc-100 hover:underline';
	const groupTitle = 'mt-4 mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase';
	const row =
		'ui-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800';
	const word =
		'ui-btn inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-zinc-800';
</script>

{#snippet personRow(key: string, text: string, person?: Person)}
	<button
		type="button"
		role="checkbox"
		aria-checked={on.has(key)}
		class="{row} {on.has(key) ? 'bg-zinc-800' : ''}"
		onclick={() => toggle(key)}
	>
		{#if person}
			<Avatar {person} class="size-[18px] text-[9px]" />
		{:else if key === 'alone'}
			<UserX size={18} class="text-zinc-400" />
		{:else}
			<Users size={18} class="text-zinc-400" />
		{/if}
		<span class="flex-1">{text}</span>
		<span class="text-zinc-500">{count(key)}</span>
		<Check size={16} class={on.has(key) ? 'text-(--accent)' : 'invisible'} />
	</button>
{/snippet}

<div class="absolute top-1.5 right-0 flex max-w-[75%] items-start justify-end gap-1.5">
	{#if chosen.length > 0}
		<!-- With room (computer): one mark per filter. On a phone that would run into the heading,
		     so there it is only how many titles are left, with the way back. -->
		<button
			type="button"
			class="{mark} mt-0.5 sm:hidden"
			title={m.library.filter.clearAll}
			onclick={() => onchange([])}
		>
			{m.library.filter.left(left)}
			<X size={14} class="shrink-0 text-zinc-400" />
		</button>
		<div class="mt-0.5 hidden min-w-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
			{#each chosen as key (key)}
				<button
					type="button"
					class={mark}
					title={m.library.filter.clearOne(nameOf(key))}
					aria-label={m.library.filter.clearOne(nameOf(key))}
					onclick={() => toggle(key)}
				>
					<span class="truncate">{nameOf(key)}</span>
					<X size={14} class="shrink-0 text-zinc-400" />
				</button>
			{/each}
			<span class="px-1 text-sm text-zinc-500">{m.library.filter.left(left)}</span>
			{#if chosen.length > 1}
				<button type="button" class={textLink} onclick={() => onchange([])}
					>{m.library.filter.clearAll}</button
				>
			{/if}
		</div>
	{/if}

	<!-- Lit while a filter is on, with their number -->
	<button
		type="button"
		class="relative inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-zinc-800 {chosen.length
			? 'text-(--accent)'
			: 'text-zinc-400 hover:text-zinc-100'}"
		title={m.library.filter.open}
		aria-label={m.library.filter.open}
		aria-haspopup="dialog"
		onclick={() => dialog.showModal()}
	>
		<Funnel size={20} />
		{#if chosen.length > 0}
			<span
				class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-(--accent) text-[10px] font-bold text-white"
				>{chosen.length}</span
			>
		{/if}
	</button>
</div>

<!-- The window stays open while one chooses; the library behind it follows at once. On a phone
     it comes up from below and leaves a quarter of the screen free. -->
<dialog
	bind:this={dialog}
	onclick={(e) => e.target === dialog && dialog.close()}
	class="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70 sm:mx-auto sm:mb-auto sm:max-w-lg sm:rounded-2xl sm:border"
>
	<div class="flex max-h-[75dvh] flex-col sm:max-h-[80dvh]">
		<div class="flex items-center gap-3 p-4 pb-0">
			<h2 class="flex-1 text-lg leading-tight font-bold">{m.library.filter.title}</h2>
			{#if chosen.length > 0}
				<button type="button" class={textLink} onclick={() => onchange([])}
					>{m.library.filter.reset}</button
				>
			{/if}
			<button
				type="button"
				class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800"
				aria-label={m.common.close}
				onclick={() => dialog.close()}
			>
				<X size={22} />
			</button>
		</div>
		<div class="overflow-y-auto px-4 pb-3">
			{#if offer.people.length > 0}
				<h3 class={groupTitle}>{m.library.filter.together}</h3>
				{@render personRow('shared', m.library.filter.shared)}
				{#if offer.people.length > 1}
					{#each offer.people as person (person.id)}
						{@render personRow(
							`person:${person.id}`,
							m.library.filter.withName(person.name),
							person
						)}
					{/each}
				{/if}
				{@render personRow('alone', m.library.filter.alone)}
			{/if}
			{#if offer.services.length > 0}
				<h3 class={groupTitle}>{m.library.filter.services}</h3>
				<div class="flex flex-wrap gap-2">
					{#each offer.services as service (service.name)}
						{@const key = `service:${service.name}`}
						<button
							type="button"
							role="checkbox"
							aria-checked={on.has(key)}
							aria-label={service.name}
							title="{service.name} · {count(key)}"
							class="overflow-hidden rounded-lg ring-2 transition {on.has(key)
								? 'ring-(--accent)'
								: 'ring-transparent hover:ring-zinc-600'} {count(key) === 0 ? 'opacity-30' : ''}"
							onclick={() => toggle(key)}
						>
							<img
								src={img(service.logoUrl)}
								alt=""
								referrerpolicy="no-referrer"
								class="size-9 sm:size-10"
							/>
						</button>
					{/each}
				</div>
			{/if}
			{#if offer.genres.length > 0}
				<h3 class={groupTitle}>{m.library.filter.genres}</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each offer.genres as genre (genre)}
						{@const key = `genre:${genre}`}
						<button
							type="button"
							role="checkbox"
							aria-checked={on.has(key)}
							class="{word} {on.has(key)
								? 'ui-keep border-(--accent) text-(--accent)'
								: 'border-zinc-700 text-zinc-300'} {count(key) === 0 ? 'opacity-30' : ''}"
							onclick={() => toggle(key)}
						>
							{genre} <span class="text-zinc-500">{count(key)}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<!-- What the choice leaves, and the way out -->
		<div class="border-t border-zinc-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
			<button
				type="button"
				class="ui-btn ui-primary w-full rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
				onclick={() => dialog.close()}
			>
				{m.library.filter.show(left)}
			</button>
		</div>
	</div>
</dialog>
