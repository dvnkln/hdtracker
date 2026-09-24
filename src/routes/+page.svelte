<script lang="ts">
	let { data } = $props();
</script>

<main class="mx-auto max-w-screen-sm p-4">
	<h1 class="text-2xl font-bold">Hallo {data.user?.username}</h1>
	<p class="mt-2 text-gray-600">Suche und Bibliothek folgen.</p>
</main>
