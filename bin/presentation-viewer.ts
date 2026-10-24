#!/usr/bin/env node
// presentation-viewer [folder] [--port 4747] [--no-open]: opens a presentation folder in the viewer.
// With no folder it uses the current one, or the bundled sample if the current one isn't a presentation.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { presentationPlugin, isPresentation } from '../server/presentation.ts';
import { APP } from '../server/export.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    port: { type: 'string', default: '4747' },
    open: { type: 'boolean', default: true },
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

const server = await createServer({
  configFile: false,
  root: APP,
  plugins: [presentationPlugin({ folder, cwd })],
  server: { host: '127.0.0.1', port: Number(values.port), open: values.open },
});
await server.listen();
server.printUrls();
