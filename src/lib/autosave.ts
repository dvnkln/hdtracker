// For forms that only consist of choices (switches, lists, radio buttons): a choice is saved
// the moment it is made – no "Save" button. Use together with `use:enhance` and
// FormFeedback.submit(), which reports when the server has answered. There is no "saved"
// message – show `forms.error(id)` near the form, so only a failure is mentioned.
//
// Choices made while a save is still on its way are not sent in parallel (the answers could
// arrive in the wrong order): the form is sent once more afterwards, with its latest state.
// Fields that are typed into are left alone – forms with those keep their button.
export function autosave(form: HTMLFormElement) {
	let sending = false;
	let changedMeanwhile = false;

	const send = () => {
		if (sending) return void (changedMeanwhile = true);
		sending = true;
		form.requestSubmit();
	};
	const onChange = (event: Event) => {
		const field = event.target;
		const isChoice =
			field instanceof HTMLSelectElement ||
			(field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio'));
		if (isChoice) send();
	};
	// Sent by FormFeedback.submit() once the server has answered (saved or refused)
	const onSettled = () => {
		sending = false;
		if (changedMeanwhile) {
			changedMeanwhile = false;
			send();
		}
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
