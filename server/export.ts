import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { addPopupPages } from '../app/src/pages.ts';
import { emptyPresentationPlugin, presentationPlugin } from './presentation.ts';
import { sitePlugin } from './site.ts';

export const APP = fileURLToPath(new URL('../app', import.meta.url));

// Bakes the presentation (slides, theme, animations, GSAP, player) into one self-contained HTML file at `file`.
// Mode "export" leaves out the authoring tools, which need the running app.
export const exportHtml = async (folder: string, file: string, title?: string) => {
  const outDir = await mkdtemp(join(tmpdir(), 'presentation-export-'));
  try {
    await build({
      configFile: false,
      root: APP,
      mode: 'export',
      logLevel: 'warn',
      plugins: [presentationPlugin({ folder, cwd: folder, title }), sitePlugin(), viteSingleFile()],
      build: { outDir, emptyOutDir: true },
    });
    await copyFile(join(outDir, 'index.html'), file);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};

// The single-file player that browser-side Export HTML fills in (mode "template"); returns its HTML.
export const buildTemplate = async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'presentation-template-'));
  try {
    await build({
      configFile: false,
      root: APP,
      mode: 'template',
      logLevel: 'warn',
      plugins: [emptyPresentationPlugin(), sitePlugin(), viteSingleFile()],
      build: { outDir, emptyOutDir: true },
    });
    return await readFile(join(outDir, 'index.html'), 'utf8');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};

// Prints the presentation to a PDF at `file` with the installed Google Chrome, one slide per page, plus a page per
// pop-up (app/src/pages.ts).
export const exportPdf = async (folder: string, file: string, title?: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'presentation-pdf-'));
  const html = join(dir, 'presentation.html');
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    await exportHtml(folder, html, title);
    const page = await browser.newPage();
    // With reduced motion the presentation skips its entrance animations, so every slide prints in its finished state.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(`(${addPopupPages.toString()})(document.querySelectorAll('.slide-stack .slide'))`);
    await page.pdf({ path: file, printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
};
