import type { LayoutServerLoad } from './$types';

// Makes the logged-in user available to all pages (as `data.user`).
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
