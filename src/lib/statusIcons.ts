import { Ban, Bookmark, CircleCheck, Pause, Play } from '@lucide/svelte';
import type { Status } from './status';

// One icon per status, used in the item menu and the library section headers.
export const STATUS_ICONS = {
	active: Play,
	paused: Pause,
	planned: Bookmark,
	completed: CircleCheck,
	dropped: Ban
} satisfies Record<Status, unknown>;
