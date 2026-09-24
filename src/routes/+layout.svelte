<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<header class="border-b border-gray-200">
		<div class="mx-auto flex max-w-screen-sm items-center justify-between p-4">
			<a href="/" class="font-bold">hdtracker</a>
			<form method="POST" action="/logout" class="flex items-center gap-3">
				<span class="text-sm text-gray-600">{data.user.username}</span>
				<button class="rounded-lg border border-gray-300 px-3 py-1 text-sm active:bg-gray-100">
					Abmelden
				</button>
			</form>
		</div>
	</header>
{/if}

{@render children()}
