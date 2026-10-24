import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// Serves `virtual:site`: the site add-on module passed with --site (see app/src/site.ts), or none.
const VIRTUAL = 'virtual:site';
const RESOLVED = '\0virtual:site';

export const sitePlugin = (file?: string): Plugin => ({
  name: 'site',
  resolveId: (id) => (id === VIRTUAL ? (file ? resolve(file) : RESOLVED) : undefined),
  load: (id) => (id === RESOLVED ? 'export default null;' : undefined),
});

// An add-on lives outside the app, so it would get its own copies of the libraries it shares with the app; these
// always resolve from the app instead.
export const SHARED = ['gsap', 'lucide'];
