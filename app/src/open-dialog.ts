import { createElement, FolderOpen, X } from 'lucide';
import { post } from './api.ts';
import { must } from './player.ts';
import { forgetOpened, isWeb, openedInBrowser, storeOpened, useSample } from './source.ts';
import { attachCopy, SLIDE_PROMPT } from './prompt-dialog.ts';
import { queueTour, startQueuedTour } from './tour.ts';
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

// Sections opened from the link row under the drop zone; one at a time, all the same height, so the drop zone
// stays put and usable while one is open.
const SECTIONS = `
  <section class="od-section" data-section="sample" role="tabpanel" hidden>
    <p>Five slides that show every built-in layout and a custom animation, followed by a short tour of the
    editor.</p>
    <button class="primary od-sample">Open the sample</button>
  </section>
  <section class="od-section od-section-prompt" data-section="create" role="tabpanel" hidden>
    <p>Give this prompt to an AI agent in an empty folder, then open that folder here.</p>
    <pre class="od-prompt" tabindex="0" aria-label="Slide creation prompt"></pre>
    <button class="primary od-copy"></button>
  </section>
  <section class="od-section" data-section="format" role="tabpanel" hidden>
    <p>Each slide is an HTML file; the number at the start of its name sets the order. A <code>.ts</code> file with
    the same name animates that slide.</p>
    <pre>my-talk/
  presentation.json   <i>title, optional</i>
  theme.css           <i>colours, optional</i>
  slides/
    01-title.html
    02-agenda.html
    02-agenda.ts      <i>animation, optional</i></pre>
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

// Everything besides opening a folder: one quiet row of links, each opening its section below.
const tab = (section: string, label: string) =>
  `<button class="od-link od-tab" role="tab" aria-selected="false" data-section="${section}">${label}</button>`;
const MORE = `
  <div class="od-more" role="tablist" aria-label="More ways to start">
    ${isWeb ? tab('sample', 'Try the sample') : ''}
    ${tab('create', 'Create one with an AI agent')}
    ${tab('format', 'Folder format')}
  </div>
  ${SECTIONS}`;

const LOCAL_EXTRA = `
  <h3 class="od-recent-title">Recent</h3>
  <ul class="od-recent"></ul>
  ${MORE}`;

const WEB_EXTRA = MORE;

export const createOpenDialog = (currentFolder: string) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal open-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header><h2>Open Presentation folder</h2><button class="modal-close" aria-label="Close"></button></header>
      ${BODY}
      ${isWeb ? WEB_EXTRA : LOCAL_EXTRA}
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
  // Clicking a link opens its section; clicking the open one again closes it.
  const tabs = [...dialog.querySelectorAll<HTMLElement>('.od-tab')];
  const sections = [...dialog.querySelectorAll<HTMLElement>('.od-section')];
  const openSection = (name: string | null) => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.section === name));
    for (const section of sections) section.hidden = section.dataset.section !== name;
  };
  for (const t of tabs) {
    t.addEventListener('click', () => {
      openSection(t.getAttribute('aria-selected') === 'true' ? null : (t.dataset.section ?? null));
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
    // The sample is what shows until a folder is opened: close if it is already showing, else switch to it.
    // Trying the sample also starts the short tour of the editor, after the reload if one is needed.
    $('.od-sample').addEventListener('click', () => {
      const switching = openedInBrowser();
      useSample();
      queueTour();
      if (!switching) {
        dialog.close();
        startQueuedTour();
        return;
      }
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
      error.textContent = '';
      setBusy(null);
      openSection(null);
      copy.reset();
      dialog.showModal();
    },
  };
};
