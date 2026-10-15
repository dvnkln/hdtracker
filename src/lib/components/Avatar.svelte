<script lang="ts">
	import { avatarBackground, avatarLetter, avatarUrl, type Person } from '#lib/avatar.js';

	// The profile picture of a user: their own picture, or the first letter of their name on
	// their colour. `class` sets the size (and the size of the letter), e.g. "size-9 text-sm".
	type Props = { person: Person; class?: string };
	let { person, class: size = 'size-7 text-xs' }: Props = $props();
	let src = $derived(avatarUrl(person));
</script>

<span
	class="inline-flex {size} shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none"
	style:background-color={avatarBackground(person.color)}
	title={person.name}
>
	{#if src}
		<img {src} alt="" class="h-full w-full object-cover" />
	{:else}
		<span aria-hidden="true">{avatarLetter(person.name)}</span>
	{/if}
</span>
