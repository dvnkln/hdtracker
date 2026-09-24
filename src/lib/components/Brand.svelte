<script lang="ts">
	import Logo from './Logo.svelte';

	// Logo + "hdtracker" wordmark. "large" is used on the login/setup pages.
	let { large = false }: { large?: boolean } = $props();
</script>

<span class="inline-flex items-center {large ? 'gap-3' : 'gap-2'}">
	<Logo size={large ? 56 : 30} />
	<span
		class="font-brand leading-none font-semibold tracking-tight {large ? 'text-4xl' : 'text-xl'}"
	>
		<span class="bg-linear-to-r from-[#ec4899] to-[#3b82f6] bg-clip-text font-bold text-transparent"
			>hd</span
		>tracker
	</span>
</span>
