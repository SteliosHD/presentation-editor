import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { transformWithOxc, type Plugin, type ViteDevServer } from 'vite';
import { imagePaths, imageType, withImages } from '../app/src/images.ts';
import { chooseFolder, chooseSaveFile } from './dialogs.ts';
import { buildTemplate, exportHtml, exportPdf } from './export.ts';

// A presentation is any folder with a slides/ folder; theme.css and an images/ folder are optional. Its title is the folder's name (the
// viewer can rename it, kept in the browser and passed in as `title` for exports). A folder
// of HTML slides on its own (the slides/ folder itself, say) opens too, titled after the folder, in the default theme.
const hasSlides = (folder: string) => existsSync(join(folder, 'slides'));
const slidesDirOf = (folder: string) => (hasSlides(folder) ? join(folder, 'slides') : folder);
export const isPresentation = (folder: string) =>
  hasSlides(folder) || (existsSync(folder) && readdirSync(folder).some((f) => f.endsWith('.html')));

// `label`: the folder as the page sees it, when it shouldn't see the real path (the hosted build's sample).
export type PresentationState = { folder: string; cwd: string; title?: string; label?: string };

const VIRTUAL = 'virtual:presentation';
const RESOLVED = `\0${VIRTUAL}`;

// virtual:presentation holds the open presentation's content. Slide HTML and the theme are inlined as strings; a slide's
// animation file (same name, .ts) is imported, so Vite compiles it and allows serving it from outside the app.
// The animation is also inlined as plain JavaScript (animationCode), which the hosted app's HTML export embeds.
// The pictures a slide refers to in images/, inlined as data: URLs.
const inlineImages = (folder: string, html: string) =>
  withImages(
    html,
    new Map(
      imagePaths(html)
        .map((path) => [path, join(folder, path)])
        .filter(([, file]) => existsSync(file))
        .map(([path, file]) => [path, `data:${imageType(path)};base64,${readFileSync(file).toString('base64')}`]),
    ),
  );

const presentationModule = async (folder: string, title = basename(folder), label = folder) => {
  const slidesDir = slidesDirOf(folder);
  const themeFile = join(folder, 'theme.css');
  const files = readdirSync(slidesDir)
    .filter((f) => f.endsWith('.html'))
    .sort();
  const imports: string[] = [];
  const slides = await Promise.all(
    files.map(async (file, k) => {
      const script = join(slidesDir, file.replace(/\.html$/, '.ts'));
      const html = JSON.stringify(inlineImages(folder, readFileSync(join(slidesDir, file), 'utf8')));
      if (!existsSync(script)) return `{ file: ${JSON.stringify(file)}, html: ${html} }`;
      imports.push(`import animation${k} from ${JSON.stringify(script)};`);
      const { code } = await transformWithOxc(readFileSync(script, 'utf8'), script);
      return `{ file: ${JSON.stringify(file)}, html: ${html}, animation: animation${k}, animationFile: ${JSON.stringify(basename(script))}, animationCode: ${JSON.stringify(code)} }`;
    }),
  );
  const presentation = `{
    title: ${JSON.stringify(title)},
    folder: ${JSON.stringify(label)},
    theme: ${JSON.stringify(existsSync(themeFile) ? readFileSync(themeFile, 'utf8') : '')},
    slides: [${slides.join(',\n')}],
  }`;
  return `${imports.join('\n')}\nexport const presentation = ${presentation};\n`;
};

const resolveFolder = (input: string, cwd: string) =>
  resolve(cwd, input.startsWith('~') ? join(homedir(), input.slice(1)) : input);

const readJson = async (req: IncomingMessage) => {
  let body = '';
  for await (const chunk of req) body += String(chunk);
  return JSON.parse(body || '{}') as Record<string, unknown>;
};

const send = (res: ServerResponse, status: number, body: object) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

// Only the app's own page may call the API: a JSON body forces a CORS preflight from other sites,
// and a cross-site Origin is refused outright.
const isFromApp = (req: IncomingMessage) =>
  req.method === 'POST' &&
  req.headers['content-type'] === 'application/json' &&
  (req.headers.origin === undefined || req.headers.origin === `http://${req.headers.host ?? ''}`);

const api = (server: ViteDevServer, state: PresentationState, reload: () => void) => {
  server.middlewares.use('/api', (req, res, next) => {
    // Only POSTs are API calls. Anything else, such as the app's own /api.ts module, is Vite's to serve.
    if (req.method !== 'POST') {
      next();
      return;
    }
    void (async () => {
      if (!isFromApp(req)) {
        send(res, 403, { error: 'Not allowed' });
        return;
      }
      const body = await readJson(req);
      const open = (folder: string) => {
        if (!isPresentation(folder)) {
          const name = `“${basename(folder)}”`;
          const error = existsSync(folder)
            ? `${name} has no HTML slides, in a slides/ folder or on their own.`
            : `${name} isn't there any more. It may have been moved or deleted.`;
          send(res, 400, { error });
          return;
        }
        state.folder = folder;
        server.watcher.add(folder);
        reload();
        send(res, 200, { folder });
      };
      if (req.url === '/open') {
        open(resolveFolder(typeof body.folder === 'string' ? body.folder : '', state.cwd));
        return;
      }
      if (req.url === '/choose-folder') {
        const folder = await chooseFolder(dirname(state.folder));
        if (folder === null) send(res, 200, { cancelled: true });
        else open(folder);
        return;
      }
      // A new presentation for an agent: choose its folder, then write the starter files into it. Only the starter's
      // own files, and never over one that is already there.
      if (req.url === '/pick-folder') {
        const folder = await chooseFolder(dirname(state.folder), 'Choose the folder for your presentation');
        if (folder === null) send(res, 200, { cancelled: true });
        else send(res, 200, { folder, empty: readdirSync(folder).every((f) => f.startsWith('.')) });
        return;
      }
      if (req.url === '/create-starter') {
        const folder = typeof body.folder === 'string' ? body.folder : '';
        const files = Array.isArray(body.files) ? (body.files as { path?: unknown; content?: unknown }[]) : [];
        if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
          send(res, 400, { error: 'Choose the folder for your presentation first.' });
          return;
        }
        for (const { path, content } of files) {
          if (typeof path !== 'string' || typeof content !== 'string') continue;
          if (!/^(AGENTS\.md|theme\.css|slides\/[\w.-]+\.html)$/.test(path)) continue;
          const target = join(folder, path);
          if (existsSync(target)) continue;
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, content);
        }
        open(folder);
        return;
      }
      if (req.url === '/export') {
        const ext = body.format === 'pdf' ? 'pdf' : 'html';
        const exportDir = join(state.folder, 'export');
        mkdirSync(exportDir, { recursive: true });
        const chosen = await chooseSaveFile(
          `Export ${ext.toUpperCase()}`,
          `${basename(state.folder)}.${ext}`,
          exportDir,
        );
        if (chosen === null) {
          send(res, 200, { cancelled: true });
          return;
        }
        const file = extname(chosen) ? chosen : `${chosen}.${ext}`;
        const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
        await (ext === 'pdf' ? exportPdf : exportHtml)(state.folder, file, title);
        const shown = file.startsWith(state.folder + sep) ? relative(state.folder, file) : file.replace(homedir(), '~');
        send(res, 200, { file: shown });
        return;
      }
      next();
    })().catch((err: unknown) => {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });
};

// For the downloadable player (export template), which receives its presentation at runtime.
export const emptyPresentationPlugin = (): Plugin => ({
  name: 'presentation',
  resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
  load: (id) => (id === RESOLVED ? 'export const presentation = null;' : undefined),
});

export const presentationPlugin = (state: PresentationState): Plugin => ({
  name: 'presentation',
  resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
  load: (id) => (id === RESOLVED ? presentationModule(state.folder, state.title, state.label) : undefined),
  configureServer(server) {
    const reload = () => {
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
    };
    server.watcher.add(state.folder);
    // Editing the open presentation's slides, pictures or theme reloads the page; anything else in the folder,
    // such as exports, does not.
    // The page is told which file changed first, so it can say so after reloading.
    const kinds = { add: 'added', change: 'updated', unlink: 'removed' } as const;
    server.watcher.on('all', (event, file) => {
      const watched = [
        join(state.folder, 'slides') + sep,
        join(state.folder, 'images') + sep,
        join(state.folder, 'theme.css'),
      ];
      // A folder of slides on its own: its slides and their animations sit at the top.
      const flat = !hasSlides(state.folder) && dirname(file) === state.folder && /\.(html|ts)$/.test(file);
      if (!flat && !watched.some((path) => file.startsWith(path))) return;
      if (event in kinds) {
        const kind = kinds[event as keyof typeof kinds];
        server.ws.send({ type: 'custom', event: 'presentation:changed', data: { kind, file: basename(file) } });
      }
      reload();
    });
    api(server, state, reload);
    // The player template for Export HTML of a folder dropped on the local app, built on first request.
    let template: Promise<string> | null = null;
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/export-template.html') {
        next();
        return;
      }
      template ??= buildTemplate();
      template
        .then((html) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        })
        .catch((err: unknown) => {
          template = null;
          next(err);
        });
    });
  },
});
