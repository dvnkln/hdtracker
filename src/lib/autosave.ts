import { tick } from 'svelte';

// For forms that only consist of choices (switches, lists, radio buttons): a choice is saved
// the moment it is made – no "Save" button. Use together with `use:enhance` and
// FormFeedback.submit(), which reports when the server has answered. There is no "saved"
// message – show `forms.error(id)` near the form, so only a failure is mentioned.
//
// Choices made while a save is still on its way are not sent in parallel (the answers could
// arrive in the wrong order): the form is sent once more afterwards, with its latest state.
// Fields that are typed into are left alone – forms with those keep their button.
type Choice = HTMLSelectElement | HTMLInputElement;
const isChoice = (field: unknown): field is Choice =>
	field instanceof HTMLSelectElement ||
	(field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio'));

export function autosave(form: HTMLFormElement) {
	let sending = false;
	// What the form showed when something was chosen while a save was on its way. The answer
	// of that save redraws the form with what the server stored – without this, it took back
	// the newer choice (seen as a switch that flipped back by itself).
	let latest: Map<Choice, string | boolean> | null = null;
	let restoring = false;

	const choices = () => [...form.elements].filter(isChoice);
	const stateOf = (field: Choice) =>
		field instanceof HTMLSelectElement ? field.value : field.checked;

	const send = () => {
		if (sending) return void (latest = new Map(choices().map((f) => [f, stateOf(f)])));
		sending = true;
		form.requestSubmit();
	};
	const onChange = (event: Event) => {
		if (!restoring && isChoice(event.target)) send();
	};
	// Sent by FormFeedback.submit() once the server has answered (saved or refused)
	const onSettled = async () => {
		if (!latest) return void (sending = false);
		// Let the answer be drawn first (still counts as "on its way": a choice made right now
		// lands in `latest` too), then put the newer choices back and tell the page – its own
		// state follows the "change" event – and send them
		await tick();
		const wanted = latest;
		latest = null;
		restoring = true;
		for (const [field, state] of wanted) {
			if (!field.isConnected || stateOf(field) === state) continue;
			if (field instanceof HTMLSelectElement) field.value = state as string;
			else field.checked = state as boolean;
			field.dispatchEvent(new Event('change', { bubbles: true }));
		}
		restoring = false;
		sending = false;
		send();
	};

	form.addEventListener('change', onChange);
	form.addEventListener('settled', onSettled);
	return {
		destroy() {
			form.removeEventListener('change', onChange);
			form.removeEventListener('settled', onSettled);
		}
	};
}
