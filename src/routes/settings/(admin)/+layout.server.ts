import { requireAdmin } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

// Pages in this group change the whole installation: admins only.
export const load: LayoutServerLoad = ({ locals }) => requireAdmin(locals.user);
