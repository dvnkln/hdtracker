<script lang="ts">
	import type { Feedback } from '$lib/forms.svelte';

	let { feedback }: { feedback: Feedback | undefined } = $props();
</script>

<!-- Result of a form: green on success, red on error -->
{#if feedback}
	<p role="status" class="text-sm {feedback.ok ? 'text-emerald-400' : 'text-red-400'}">
		{feedback.text}
	</p>
{/if}
