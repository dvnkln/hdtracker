<script lang="ts">
	import Brand from '$lib/components/Brand.svelte';
	import { m } from '$lib/i18n/index.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>{m.auth.loginTitle} · hdtracker</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
	<h1 class="flex justify-center"><Brand large /></h1>

	<form method="POST" class="mt-8 flex flex-col gap-4">
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">{m.auth.username}</span>
			<input
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				autocapitalize="off"
				required
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">{m.auth.password}</span>
			<input name="password" type="password" autocomplete="current-password" required />
		</label>

		{#if form?.error}
			<p class="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{form.error}
			</p>
		{/if}

		<button
			class="rounded-lg bg-zinc-100 p-3 font-medium text-zinc-900 transition-colors hover:bg-white active:bg-zinc-300"
		>
			{m.auth.login}
		</button>
	</form>
</main>
