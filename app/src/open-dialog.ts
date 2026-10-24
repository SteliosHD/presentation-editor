import { createElement, FolderOpen, X } from 'lucide';
import { presentation as served } from 'virtual:presentation';
import { post } from './api.ts';
import { must } from './player.ts';
import { forgetOpened, isWeb, requestSample, storeOpened } from './source.ts';
import { attachCopy, SLIDE_PROMPT } from './prompt-dialog.ts';
import { queueTour } from './tour.ts';
import { filesFromDrop, filesFromInput, readPresentation } from './web.ts';

// The "Open Presentation folder" modal: a drop zone with Choose folder in both versions. Choosing uses the Mac
// folder picker locally (the server opens the folder, with live reload) and the browser's picker when hosted.
// A dropped folder is always read in the browser, since browsers never reveal where it lives on disk.
// While a folder opens, a spinner covers the modal and says what is happening.

const RECENT_KEY = 'presentation-editor:recent';
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
export const rememberFolder = (folder: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([folder, ...readRecent().filter((f) => f !== folder)].slice(0, 8)));
  } catch {
    // Recents are a convenience; private windows may refuse storage.
  }
};

// The hosted app serves the sample, so its slides are listed from what is served: "02-flow-and-stats.html" shows as
// "Flow and stats".
const sampleSlides = () =>
  (served?.slides ?? [])
    .map(({ file, animation }, k) => {
      const name = file
        .replace(/^\d+[-_ ]*/, '')
        .replace(/\.html$/, '')
        .replaceAll(/[-_]/g, ' ');
      const badge = animation ? '<span class="od-sample-badge">custom</span>' : '';
      return `<li><span class="od-sample-n">${k + 1}</span>${name.charAt(0).toUpperCase()}${name.slice(1)}${badge}</li>`;
    })
    .join('');

// Sections opened from the tab row under the drop zone; one at a time, all the same height, so the drop zone
// stays put and usable while one is open. Each has its content on top and its one action at the bottom right.
const sections = (repo: string) => `
  <section class="od-section" data-section="sample" role="tabpanel" hidden>
    <div class="od-section-body">
      <p>Every built-in layout and a custom animation, followed by a short tour of the editor.</p>
      <ol class="od-sample-list">${isWeb ? sampleSlides() : ''}</ol>
    </div>
    <div class="modal-foot"><button class="primary od-sample">Open the sample</button></div>
  </section>
  <section class="od-section" data-section="create" role="tabpanel" hidden>
    <div class="od-section-body">
      <p>Give this prompt to an AI agent in an empty folder, then open that folder here.</p>
      <pre class="od-prompt" tabindex="0" aria-label="Slide creation prompt"></pre>
    </div>
    <div class="modal-foot"><button class="primary od-copy"></button></div>
  </section>
  <section class="od-section" data-section="format" role="tabpanel" hidden>
    <div class="od-section-body">
      <p>Each slide is an HTML file; the number at the start of its name sets the order. A <code>.ts</code> file
      with the same name animates that slide.</p>
      <pre>my-talk/
  presentation.json   <i>title, optional</i>
  theme.css           <i>colours, optional</i>
  slides/
    01-title.html
    02-agenda.html
    02-agenda.ts      <i>animation, optional</i></pre>
    </div>
    <div class="modal-foot">
      <a class="modal-link-button" href="${repo}#make-a-presentation" target="_blank" rel="noopener">Full guide ↗</a>
    </div>
  </section>`;

const BODY = `
  <div class="od-drop">
    <span class="od-drop-icon"></span>
    <span class="od-drop-title">Drop a folder here</span>
    <button class="primary od-choose" autofocus>Choose folder</button>
    ${isWeb ? '<span class="od-drop-note">Read in your browser, never uploaded.</span>' : ''}
    <input type="file" webkitdirectory hidden />
  </div>
  <p class="od-error" role="alert"></p>`;

// Everything besides opening a folder: one row of tabs, each opening its section below.
const tab = (section: string, label: string) =>
  `<button class="od-tab" role="tab" aria-selected="false" data-section="${section}">${label}</button>`;
const more = (repo: string) => `
  <div class="od-more" role="tablist" aria-label="More ways to start">
    ${isWeb ? tab('sample', 'Try the sample') : ''}
    ${tab('create', 'Create one with an AI agent')}
    ${tab('format', 'Folder format')}
  </div>
  ${sections(repo)}`;

const LOCAL_RECENT = `
  <h3 class="od-recent-title">Recent</h3>
  <ul class="od-recent"></ul>`;

export const createOpenDialog = (currentFolder: string, repo: string) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal open-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header><h2>Open Presentation folder</h2><button class="modal-close" aria-label="Close"></button></header>
      ${BODY}
      ${isWeb ? '' : LOCAL_RECENT}
      ${more(repo)}
    </div>
    <div class="od-busy" aria-live="polite"><span class="spinner"></span><span class="od-busy-text"></span></div>`;
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  const inputAt = (sel: string) => must(dialog.querySelector<HTMLInputElement>(sel), sel);
  $('.modal-close').append(createElement(X, { width: 18, height: 18 }));
  const error = $('.od-error');

  let busy = false;
  const setBusy = (message: string | null) => {
    busy = message !== null;
    dialog.classList.toggle('busy', busy);
    $('.od-busy-text').textContent = message ?? '';
  };
  const fail = (err: unknown) => {
    setBusy(null);
    error.textContent = err instanceof Error ? err.message : String(err);
  };
  const close = () => {
    if (!busy) dialog.close();
  };
  // Clicking a tab opens its section; clicking the open one again closes it.
  const tabs = [...dialog.querySelectorAll<HTMLElement>('.od-tab')];
  const sections = [...dialog.querySelectorAll<HTMLElement>('.od-section')];
  const openSection = (name: string | null) => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.section === name));
    for (const section of sections) section.hidden = section.dataset.section !== name;
  };
  for (const [k, t] of tabs.entries()) {
    t.addEventListener('click', () => {
      openSection(t.getAttribute('aria-selected') === 'true' ? null : (t.dataset.section ?? null));
    });
    // ← → move between tabs and open the one reached, as tab bars do.
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      openSection(next.dataset.section ?? null);
    });
  }
  $('.od-prompt').textContent = SLIDE_PROMPT;
  const copy = attachCopy($('.od-copy'), SLIDE_PROMPT, $('.od-prompt'));
  $('.modal-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  const input = inputAt('input[type=file]');
  const drop = $('.od-drop');
  $('.od-drop-icon').append(createElement(FolderOpen, { width: 32, height: 32 }));

  // Reads a folder in the browser and keeps it for this tab (hosted, or a folder dropped on the local app).
  const openInBrowser = async (read: () => Promise<Parameters<typeof readPresentation>[0]>) => {
    error.textContent = '';
    setBusy('Reading the folder');
    try {
      const files = await read();
      setBusy(`Reading ${files.length} files`);
      storeOpened(await readPresentation(files));
      setBusy('Opening');
      location.reload();
    } catch (err) {
      fail(err);
    }
  };
  // Locally the server opens the folder; a folder kept from an earlier drop gives way to it.
  const openOnServer = async (choose: () => Promise<{ folder?: string; cancelled?: boolean }>) => {
    error.textContent = '';
    try {
      const { folder, cancelled } = await choose();
      if (cancelled) {
        setBusy(null);
        return;
      }
      if (folder) rememberFolder(folder);
      forgetOpened();
      setBusy('Opening');
      location.reload();
    } catch (err) {
      fail(err);
    }
  };
  const choose = () => {
    if (isWeb) {
      input.click();
      return;
    }
    setBusy('Waiting for the folder picker');
    void openOnServer(() => post('choose-folder'));
  };

  $('.od-choose').addEventListener('click', choose);
  input.addEventListener('change', () => {
    const { files } = input;
    if (files?.length) void openInBrowser(() => Promise.resolve(filesFromInput(files)));
    input.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', (e) => {
    if (!(e.relatedTarget instanceof Node && drop.contains(e.relatedTarget))) drop.classList.remove('over');
  });
  drop.addEventListener('click', (e) => {
    if (!(e.target instanceof Element && e.target.closest('button'))) choose();
  });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    // Entries must be taken during the event; the browser drops access afterwards.
    const entry = [...(e.dataTransfer?.items ?? [])]
      .map((item) => item.webkitGetAsEntry())
      .find((en) => en?.isDirectory);
    if (!entry) {
      error.textContent = 'Drop a folder, not separate files.';
      return;
    }
    void openInBrowser(() => filesFromDrop(entry as FileSystemDirectoryEntry));
  });

  if (isWeb) {
    // The sample loads on a fresh page; the tour follows the first time.
    $('.od-sample').addEventListener('click', () => {
      requestSample();
      queueTour();
      setBusy('Opening the sample');
      location.reload();
    });
  } else {
    const recent = readRecent().filter((f) => f !== currentFolder);
    $('.od-recent-title').hidden = recent.length === 0;
    $('.od-recent').replaceChildren(
      ...recent.map((folder) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        const parts = folder.split('/');
        const name = document.createElement('span');
        name.className = 'od-recent-name';
        name.textContent = parts.at(-1) ?? folder;
        const where = document.createElement('span');
        where.className = 'od-recent-path';
        where.textContent = parts.slice(-3, -1).join('/');
        button.append(name, where);
        button.title = folder;
        button.addEventListener('click', () => {
          setBusy('Opening');
          void openOnServer(() => post('open', { folder }));
        });
        li.append(button);
        return li;
      }),
    );
  }

  return {
    show: () => {
      if (dialog.open) return;
      error.textContent = '';
      setBusy(null);
      openSection(null);
      copy.reset();
      dialog.showModal();
    },
  };
};
