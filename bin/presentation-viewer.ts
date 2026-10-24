#!/usr/bin/env node
// presentation-viewer [folder] [--port 4747] [--no-open] [--site <file>]: opens a presentation folder in the viewer.
// --site adds a site add-on (see app/src/site.ts).
// With no folder it uses the current one, or the bundled sample if the current one isn't a presentation.
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { presentationPlugin, isPresentation } from '../server/presentation.ts';
import { APP } from '../server/export.ts';
import { SHARED, sitePlugin } from '../server/site.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    port: { type: 'string', default: '4747' },
    open: { type: 'boolean', default: true },
    site: { type: 'string' },
  },
});

const cwd = process.cwd();
const asked = positionals.at(0);
let folder = resolve(cwd, asked ?? '.');
if (!isPresentation(folder)) {
  if (asked !== undefined) {
    console.error(`${folder} is not a presentation: it needs a slides/ folder.`);
    process.exit(1);
  }
  folder = resolve(APP, '../sample');
  console.log('No slides/ folder here, opening the sample presentation.');
}

const site = values.site === undefined ? undefined : resolve(cwd, values.site);
const server = await createServer({
  configFile: false,
  root: APP,
  plugins: [presentationPlugin({ folder, cwd }), sitePlugin(site)],
  resolve: { dedupe: SHARED },
  server: {
    host: '127.0.0.1',
    port: Number(values.port),
    open: values.open,
    // An add-on outside this folder is served too.
    fs: site ? { allow: [resolve(APP, '..'), dirname(site)] } : undefined,
  },
});
await server.listen();
server.printUrls();
