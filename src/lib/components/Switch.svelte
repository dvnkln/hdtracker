<script lang="ts">
	type Props = { name: string; id: string; checked: boolean };
	let { name, id, checked = $bindable() }: Props = $props();
</script>

<!-- On/off switch: a real checkbox (sent with the form), drawn as a sliding toggle.
     Describe it with <label for={id}> next to it. -->
<label class="relative inline-flex shrink-0 cursor-pointer transition hover:brightness-125">
	<input type="checkbox" {id} {name} bind:checked class="peer sr-only" />
	<span
		aria-hidden="true"
		class="h-6 w-11 rounded-full bg-zinc-700 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-300 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
	></span>
</label>
