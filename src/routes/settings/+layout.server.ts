import { isAdmin } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

// Whether the "Administration" group is shown in the settings navigation.
export const load: LayoutServerLoad = ({ locals }) => ({ isAdmin: isAdmin(locals.user) });
