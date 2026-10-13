// Long lists of the inbox show their first entries, the rest unfolds – so that what waits for
// a decision is not pushed off the screen.
export const FOLD = 3;

// How many news are shown while the list is folded: the first few, and in any case everything
// up to the last unread one. Opening the inbox marks everything as read, so nothing unread
// may be folded away.
export function newsShown(unread: boolean[]) {
	return Math.max(FOLD, unread.lastIndexOf(true) + 1);
}
