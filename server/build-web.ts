// Builds the hosted app into dist/: the full app with the sample presentation built in (mode "web"), plus
// export-template.html, the single-file player the hosted app's Export HTML fills in (mode "template").
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { APP, buildTemplate } from './export.ts';
import { presentationPlugin } from './presentation.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

await build({
  configFile: false,
  root: APP,
  base: './',
  mode: 'web',
  logLevel: 'warn',
  plugins: [presentationPlugin({ folder: join(root, 'sample'), cwd: root })],
  build: { outDir: dist, emptyOutDir: true },
});

await writeFile(join(dist, 'export-template.html'), await buildTemplate());
console.log('Built dist/ (hosted app and export template)');
