// Builds the hosted app into dist/: the full app with the sample presentation built in (mode "web"), plus
// export-template.html, the single-file player the hosted app's Export HTML fills in (mode "template").
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { APP } from './export.ts';
import { emptyPresentationPlugin, presentationPlugin } from './presentation.ts';

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

const temp = await mkdtemp(join(tmpdir(), 'presentation-template-'));
try {
  await build({
    configFile: false,
    root: APP,
    mode: 'template',
    logLevel: 'warn',
    plugins: [emptyPresentationPlugin(), viteSingleFile()],
    build: { outDir: temp, emptyOutDir: true },
  });
  await copyFile(join(temp, 'index.html'), join(dist, 'export-template.html'));
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log('Built dist/ (hosted app and export template)');
