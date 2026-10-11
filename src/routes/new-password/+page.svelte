<script lang="ts">
	import Brand from '$lib/components/Brand.svelte';
	import NewPassword from '$lib/components/NewPassword.svelte';
	import { m } from '$lib/i18n/index.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>{m.auth.newPasswordTitle} · hdtracker</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
	<div class="flex justify-center"><Brand large /></div>
	<h1 class="mt-8 text-xl font-bold">{m.auth.newPasswordTitle}</h1>
	<p class="mt-2 text-sm text-zinc-400">{m.auth.newPasswordIntro}</p>

	<form method="POST" class="mt-6 flex flex-col gap-4">
		<NewPassword />

		{#if form?.error}
			<p class="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{form.error}
			</p>
		{/if}

		<button
			class="ui-btn ui-primary rounded-lg bg-zinc-100 p-3 font-medium text-zinc-900 transition-colors hover:bg-zinc-300 active:bg-zinc-400"
		>
			{m.auth.saveNewPassword}
		</button>
	</form>
	<form method="POST" action="/logout" class="mt-4 text-center">
		<button class="text-sm text-zinc-400 underline hover:text-zinc-100">{m.common.logout}</button>
	</form>
</main>
