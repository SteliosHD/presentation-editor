import type { Presentation } from 'virtual:presentation';
import { imagePaths, withImages } from './images.ts';
import { toSlide } from './player.ts';
import { DATA_ID, toStored } from './source.ts';

// The hosted app's file handling, all in the browser: reading a presentation folder the viewer picks or drops,
// and exports as downloads.

export type FolderFile = { path: string; file: File };

// From <input webkitdirectory>: each file's path starts with the picked folder's name.
export const filesFromInput = (list: FileList): FolderFile[] =>
  [...list].map((file) => ({ path: file.webkitRelativePath, file }));

const readEntries = (dir: FileSystemDirectoryEntry) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => {
    const reader = dir.createReader();
    const all: FileSystemEntry[] = [];
    const next = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next();
      }, reject);
    };
    next();
  });
const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });

// Everything inside a folder, at any depth.
const allIn = async (dir: FileSystemDirectoryEntry, path: string): Promise<FolderFile[]> =>
  (
    await Promise.all(
      (await readEntries(dir)).map(async (entry) =>
        entry.isFile
          ? [{ path: `${path}/${entry.name}`, file: await fileOf(entry as FileSystemFileEntry) }]
          : allIn(entry as FileSystemDirectoryEntry, `${path}/${entry.name}`),
      ),
    )
  ).flat();

// From a drop: only the folder's top level, its slides/ folder and its images/ folder are read.
export const filesFromDrop = async (root: FileSystemDirectoryEntry): Promise<FolderFile[]> => {
  const files: FolderFile[] = [];
  for (const entry of await readEntries(root)) {
    if (entry.isFile)
      files.push({ path: `${root.name}/${entry.name}`, file: await fileOf(entry as FileSystemFileEntry) });
    if (entry.isDirectory && entry.name === 'slides') {
      for (const slide of await readEntries(entry as FileSystemDirectoryEntry)) {
        if (slide.isFile) {
          files.push({ path: `${root.name}/slides/${slide.name}`, file: await fileOf(slide as FileSystemFileEntry) });
        }
      }
    }
    if (entry.isDirectory && entry.name === 'images')
      files.push(...(await allIn(entry as FileSystemDirectoryEntry, `${root.name}/images`)));
  }
  return files;
};

const dataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Couldn't read ${file.name}`));
    };
    reader.readAsDataURL(file);
  });

// Turns a folder's files into a presentation, with each .ts animation converted to JavaScript by Sucrase
// (loaded only when needed). A folder of slides picked on its own (the slides/ folder itself, say) opens too, in
// the default theme and titled after the folder, since its theme and title live one folder up.
export const readPresentation = async (files: FolderFile[]) => {
  const root = files.at(0)?.path.split('/')[0] ?? 'folder';
  const at = (rel: string) => files.find((f) => f.path === `${root}/${rel}`)?.file;
  const htmlIn = (dir: string) =>
    files
      .filter(
        (f) => f.path.startsWith(`${root}/${dir}`) && /^[^/]+\.html$/.test(f.path.slice(root.length + 1 + dir.length)),
      )
      .sort((a, b) => a.path.localeCompare(b.path));
  const nested = htmlIn('slides/');
  const dir = nested.length ? 'slides/' : '';
  const slideFiles = nested.length ? nested : htmlIn('');
  if (!slideFiles.length)
    throw new Error(
      `“${root}” has no HTML slides, in a slides/ folder or on their own. Choose the presentation folder.`,
    );

  const theme = (await at('theme.css')?.text()) ?? '';
  const needsSucrase = slideFiles.some(({ path }) => at(path.slice(root.length + 1).replace(/\.html$/, '.ts')));
  const sucrase = needsSucrase ? await import('sucrase') : null;

  const slides = await Promise.all(
    slideFiles.map(async ({ path, file }) => {
      const name = path.split('/').at(-1) ?? path;
      const script = at(`${dir}${name.replace(/\.html$/, '.ts')}`);
      const text = await file.text();
      const pictures = await Promise.all(
        imagePaths(text).map(async (rel) => {
          const picture = at(rel);
          return [rel, picture ? await dataUrl(picture) : ''] as const;
        }),
      );
      const html = withImages(text, new Map(pictures.filter(([, url]) => url)));
      if (!script || !sucrase) return { file: name, html };
      const { code } = sucrase.transform(await script.text(), { transforms: ['typescript'], filePath: script.name });
      return { file: name, html, animationFile: script.name, animationCode: code };
    }),
  );
  return { title: root, folder: root, theme, slides };
};

// A download is named after the folder itself, never the path to it.
const nameOf = (presentation: Presentation) => presentation.folder.split('/').at(-1) ?? presentation.folder;

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
};

// The single-file player (built as export-template.html) with this presentation embedded as JSON.
export const downloadHtml = async (presentation: Presentation) => {
  const res = await fetch('./export-template.html');
  if (!res.ok) throw new Error(`The export template is missing (${res.status})`);
  const template = await res.text();
  const json = JSON.stringify(toStored(presentation)).replaceAll('<', '\\u003c');
  const at = template.lastIndexOf('</body>');
  const html = `${template.slice(0, at)}<script type="application/json" id="${DATA_ID}">${json}</script>${template.slice(at)}`;
  download(new Blob([html], { type: 'text/html' }), `${nameOf(presentation)}.html`);
};

// Captures each slide in its finished state as an image and assembles a PDF, one slide per page.
export const downloadPdf = async (presentation: Presentation, progress: (done: number) => void) => {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1200, 675],
    hotfixes: ['px_scaling'],
    compress: true,
  });
  const background = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
  const stage = document.createElement('div');
  stage.className = 'pdf-stage';
  document.body.append(stage);
  try {
    for (const [k, slide] of presentation.slides.entries()) {
      progress(k);
      const el = toSlide(slide.html);
      stage.replaceChildren(el);
      // JPEG keeps a page to a few hundred KB; PNG made a five-slide PDF of ~50 MB.
      const image = await toJpeg(el, {
        pixelRatio: 2,
        width: 1200,
        height: 675,
        quality: 0.92,
        backgroundColor: background,
      });
      if (k > 0) pdf.addPage([1200, 675], 'landscape');
      pdf.addImage(image, 'JPEG', 0, 0, 1200, 675);
    }
    download(pdf.output('blob'), `${nameOf(presentation)}.pdf`);
  } finally {
    stage.remove();
  }
};
