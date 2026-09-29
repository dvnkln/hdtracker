import pkg from '../../../../package.json';
import type { PageServerLoad } from './$types';

// Version of the running app (from package.json).
export const load: PageServerLoad = () => ({ version: pkg.version });
