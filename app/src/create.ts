import { post } from './api.ts';
import { noteMessage } from './changes.ts';
import { must } from './player.ts';
import { isWeb } from './source.ts';
import { BRIEF_FILE, slidePrompt, starterFiles, type Details, type StarterFile, type Where } from './starter.ts';
import { canWatch, filesFromHandle } from './watch.ts';
import type { FolderFile } from './web.ts';
import { zip } from './zip.ts';

// The Open modal's "Create one with an AI agent": choose the presentation's folder, give the talk's three details,
// then one button copies the brief, writes the starter folder (the brief as AGENTS.md, a theme to fill in
// and a welcome slide) and opens it, so each slide shows up as the agent saves it. The local app writes through its
// server and knows the folder's full path; Chrome and Edge write through the browser and only learn its name; other
// browsers cannot write to a folder, so the starter folder downloads as a .zip.

const mode = !isWeb ? 'server' : canWatch ? 'browser' : 'download';

export const CREATE_SECTION = `
  <section class="od-section" data-section="create" role="tabpanel" hidden>
    <div class="od-section-body od-create">
      <p>Set up a folder for an AI agent to write your presentation in. It starts with a welcome slide, and every
      slide the agent saves appears here.</p>
      <div class="od-create-row">
        <span class="od-create-label">Folder</span>
        ${
          mode === 'download'
            ? `<input class="od-create-name" name="folder" value="my-presentation" aria-label="Folder name" />`
            : `<button class="od-create-pick">Choose folder</button><span class="od-create-chosen">No folder chosen yet</span>`
        }
      </div>
      <label class="od-create-row"><span class="od-create-label">Topic</span>
        <input name="topic" placeholder="What the talk is about" /></label>
      <label class="od-create-row"><span class="od-create-label">Audience</span>
        <input name="audience" placeholder="Who it is for" /></label>
      <label class="od-create-row"><span class="od-create-label">Length</span>
        <input name="length" placeholder="10 slides, or 15 minutes" /></label>
      <button class="od-link od-create-see" type="button">See the prompt</button>
      <p class="od-create-note" role="status"></p>
    </div>
    <div class="modal-foot">
      <button class="primary od-create-go" disabled>${mode === 'download' ? 'Download template' : 'Use template'} &amp; copy prompt</button>
    </div>
  </section>`;

type Hooks = {
  fail: (err: unknown) => void;
  setBusy: (message: string | null) => void;
  openInBrowser: (read: () => Promise<FolderFile[]>, dir?: FileSystemDirectoryHandle) => Promise<void>;
  openOnServer: (choose: () => Promise<{ folder?: string; cancelled?: boolean }>) => Promise<void>;
};

// Adds each starter file the folder doesn't already have; nothing in it is overwritten.
const writeInto = async (dir: FileSystemDirectoryHandle, files: StarterFile[]) => {
  for (const { path, content } of files) {
    const parts = path.split('/');
    let here = dir;
    for (const part of parts.slice(0, -1)) here = await here.getDirectoryHandle(part, { create: true });
    const name = parts.at(-1) ?? path;
    const exists = await here.getFileHandle(name).then(
      () => true,
      () => false,
    );
    if (exists) continue;
    const writer = await (await here.getFileHandle(name, { create: true })).createWritable();
    await writer.write(content);
    await writer.close();
  }
};
const hasFiles = async (dir: FileSystemDirectoryHandle) => {
  for await (const entry of dir.values()) if (!entry.name.startsWith('.')) return true;
  return false;
};

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

export const mountCreate = (section: HTMLElement, { fail, setBusy, openInBrowser, openOnServer }: Hooks) => {
  const $ = (sel: string) => must(section.querySelector<HTMLElement>(sel), sel);
  const field = (name: string) => must(section.querySelector<HTMLInputElement>(`input[name="${name}"]`), name);
  const go = must(section.querySelector<HTMLButtonElement>('.od-create-go'), '.od-create-go');
  // The prompt opens in its own modal over this one, rather than as a second scrolling box inside it.
  const preview = document.createElement('dialog');
  preview.className = 'modal prompt-dialog';
  preview.innerHTML = `
    <div class="modal-body">
      <header><h2>Your agent’s prompt</h2></header>
      <p class="modal-lead">Use template copies this and saves it in the folder as ${BRIEF_FILE}.</p>
      <pre class="pd-prompt" tabindex="0" aria-label="The prompt for your agent"></pre>
      <div class="modal-foot"><button class="primary od-create-back">Back</button></div>
    </div>`;
  document.body.append(preview);
  const prompt = must(preview.querySelector<HTMLElement>('pre'), 'pre');
  must(preview.querySelector('.od-create-back'), '.od-create-back').addEventListener('click', () => {
    preview.close();
  });
  preview.addEventListener('click', (e) => {
    if (e.target === preview) preview.close();
  });
  $('.od-create-see').addEventListener('click', () => {
    preview.showModal();
  });
  const note = $('.od-create-note');
  let where: Where | null = null;
  let dir: FileSystemDirectoryHandle | null = null;

  const details = (): Details => ({
    topic: field('topic').value,
    audience: field('audience').value,
    length: field('length').value,
  });
  const currentWhere = (): Where | null =>
    mode === 'download' ? { folder: field('folder').value.trim() || 'my-presentation' } : where;
  const refresh = () => {
    const at = currentWhere();
    prompt.textContent = slidePrompt(details(), at ?? { folder: 'your-folder' });
    go.disabled = !at || !details().topic.trim();
  };
  const chosen = (text: string) => {
    $('.od-create-chosen').textContent = text;
  };

  // Step one: the folder for the whole presentation.
  const pick = async () => {
    fail('');
    if (mode === 'server') {
      setBusy('Waiting for the folder picker');
      const picked = (await post('pick-folder')) as { folder?: string; cancelled?: boolean; empty?: boolean };
      setBusy(null);
      if (picked.cancelled || !picked.folder) return;
      if (
        !picked.empty &&
        !confirm(`“${picked.folder}” already has files in it. Use it anyway? Nothing in it is overwritten.`)
      )
        return;
      where = { folder: picked.folder.split('/').at(-1) ?? picked.folder, path: picked.folder };
      chosen(picked.folder.replace(/^\/Users\/[^/]+/, '~'));
    } else {
      const handle = await window.showDirectoryPicker?.({ mode: 'readwrite' });
      if (!handle) return;
      if (
        (await hasFiles(handle)) &&
        !confirm(`“${handle.name}” already has files in it. Use it anyway? Nothing in it is overwritten.`)
      )
        return;
      dir = handle;
      where = { folder: handle.name };
      chosen(handle.name);
    }
    refresh();
  };
  if (mode !== 'download') {
    $('.od-create-pick').addEventListener('click', () => {
      pick().catch((err: unknown) => {
        setBusy(null);
        if (!(err instanceof DOMException && err.name === 'AbortError')) fail(err);
      });
    });
  }
  for (const input of section.querySelectorAll('input')) input.addEventListener('input', refresh);

  // Step three: copy the brief, write the folder and open it.
  go.addEventListener('click', () => {
    const at = currentWhere();
    if (!at) return;
    const brief = slidePrompt(details(), at);
    const files = starterFiles(details(), at);
    // Copy first, while the click still counts as the user's: the writing that follows takes a moment.
    const copied = navigator.clipboard.writeText(brief).then(
      () => true,
      () => false,
    );
    const done = (ok: boolean) =>
      ok
        ? `Prompt copied. Paste it into your agent, opened in “${at.folder}”. It’s also saved there as ${BRIEF_FILE}.`
        : `The prompt is saved in “${at.folder}” as ${BRIEF_FILE}. Point your agent at it.`;
    void copied.then(async (ok) => {
      if (mode === 'download') {
        download(zip(files.map((f) => ({ path: `${at.folder}/${f.path}`, content: f.content }))), `${at.folder}.zip`);
        note.textContent = `${done(ok)} Unzip ${at.folder}.zip first, then open the folder here once your agent starts.`;
        return;
      }
      noteMessage(done(ok));
      setBusy('Setting up the folder');
      if (mode === 'server') await openOnServer(() => post('create-starter', { folder: at.path, files }));
      else if (dir) {
        const target = dir;
        await openInBrowser(async () => {
          await writeInto(target, files);
          return filesFromHandle(target);
        }, target);
      }
    });
  });
  refresh();
  return {
    reset: () => {
      note.textContent = '';
    },
  };
};
