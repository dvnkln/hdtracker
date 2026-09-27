import { getDashboard } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

// Dashboard: recent and upcoming releases of planned and current titles.
export const load: PageServerLoad = () => getDashboard();
