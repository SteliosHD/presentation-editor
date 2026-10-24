// Builds the hosted app: the full app with the sample presentation built in (mode "web"), plus export-template.html,
// the single-file player the hosted app's Export HTML fills in (mode "template").
// node server/build-web.ts [--site <file>] [--out <dir>]: --site adds a site add-on (see app/src/site.ts); the
// output goes to dist/ unless --out names another folder.
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { APP, buildTemplate } from './export.ts';
import { presentationPlugin } from './presentation.ts';
import { SHARED, sitePlugin } from './site.ts';

const { values } = parseArgs({ options: { site: { type: 'string' }, out: { type: 'string' } } });
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = values.out === undefined ? join(root, 'dist') : resolve(values.out);
const site = values.site === undefined ? undefined : resolve(values.site);

await build({
  configFile: false,
  root: APP,
  base: './',
  mode: 'web',
  logLevel: 'warn',
  plugins: [presentationPlugin({ folder: join(root, 'sample'), cwd: root }), sitePlugin(site)],
  resolve: { dedupe: SHARED },
  build: { outDir: dist, emptyOutDir: true },
});

await writeFile(join(dist, 'export-template.html'), await buildTemplate());
console.log(`Built ${dist} (hosted app and export template)`);
