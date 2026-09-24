<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Einrichtung · hdtracker</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
	<h1 class="text-2xl font-bold">Willkommen bei hdtracker</h1>
	<p class="mt-1 text-sm text-zinc-400">Lege dein Admin-Konto an.</p>

	<form method="POST" class="mt-6 flex flex-col gap-4">
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Benutzername</span>
			<input
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				autocapitalize="off"
				required
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Passwort (min. 10 Zeichen)</span>
			<input name="password" type="password" autocomplete="new-password" minlength="10" required />
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Passwort wiederholen</span>
			<input name="confirm" type="password" autocomplete="new-password" required />
		</label>

		{#if form?.error}
			<p class="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{form.error}
			</p>
		{/if}

		<button class="rounded-lg bg-zinc-100 p-3 font-medium text-zinc-900 active:bg-zinc-300">
			Konto anlegen
		</button>
	</form>
</main>
