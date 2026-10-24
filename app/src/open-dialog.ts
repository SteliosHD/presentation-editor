import { createElement, FolderOpen, X } from 'lucide';
import { post } from './api.ts';
import { must } from './player.ts';
import { forgetOpened, isWeb, storeOpened } from './source.ts';
import { filesFromDrop, filesFromInput, readPresentation } from './web.ts';

// The "Open Presentation folder" modal. Locally it offers the Mac folder picker, a path box and recent folders;
// hosted, a drop zone and the browser's folder picker, since the browser reads the folder itself.
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

// The folder format, shown on request: most visits only need the button.
const HELP = `
  <details class="od-help">
    <summary>What goes in the folder?</summary>
    <p>Each slide is an HTML file; the number at the start of its name sets the order. A <code>.ts</code> file with
    the same name animates that slide.</p>
    <pre>my-talk/
  presentation.json   <i>title, optional</i>
  theme.css           <i>colours, optional</i>
  slides/
    01-title.html
    02-agenda.html
    02-agenda.ts      <i>animation, optional</i></pre>
  </details>`;

const LOCAL_BODY = `
  <button class="primary od-choose" autofocus>Choose folder…</button>
  <h3 class="od-recent-title">Recent</h3>
  <ul class="od-recent"></ul>
  <form class="od-path">
    <input name="folder" aria-label="Folder path" placeholder="Or type a path" autocomplete="off" />
    <button>Open</button>
  </form>
  ${HELP}`;

const WEB_BODY = `
  <div class="od-drop">
    <span class="od-drop-icon"></span>
    <span class="od-drop-title">Drop a folder here</span>
    <button class="primary od-choose" autofocus>Choose folder…</button>
    <input type="file" webkitdirectory hidden />
  </div>
  ${HELP}
  <footer class="od-foot">
    <span>Read in your browser, never uploaded.</span>
    <button class="od-link od-sample">Try the sample</button>
  </footer>`;

export const createOpenDialog = (currentFolder: string) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'open-dialog';
  dialog.innerHTML = `
    <div class="od-body">
      <header><h2>Open Presentation folder</h2><button class="od-close" aria-label="Close"></button></header>
      <p class="od-lead">A folder with your slides in <code>slides/</code>.</p>
      ${isWeb ? WEB_BODY : LOCAL_BODY}
      <p class="od-error" role="alert"></p>
    </div>
    <div class="od-busy" aria-live="polite"><span class="spinner"></span><span class="od-busy-text"></span></div>`;
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  const inputAt = (sel: string) => must(dialog.querySelector<HTMLInputElement>(sel), sel);
  $('.od-close').append(createElement(X, { width: 18, height: 18 }));
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
  $('.od-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  if (isWeb) {
    const input = inputAt('input[type=file]');
    const drop = $('.od-drop');
    $('.od-drop-icon').append(createElement(FolderOpen, { width: 32, height: 32 }));
    const open = async (read: () => Promise<Parameters<typeof readPresentation>[0]>) => {
      error.textContent = '';
      setBusy('Reading the folder…');
      try {
        const files = await read();
        setBusy(`Reading ${files.length} files…`);
        storeOpened(await readPresentation(files));
        setBusy('Opening…');
        location.reload();
      } catch (err) {
        fail(err);
      }
    };
    $('.od-choose').addEventListener('click', () => {
      input.click();
    });
    input.addEventListener('change', () => {
      const { files } = input;
      if (files?.length) void open(() => Promise.resolve(filesFromInput(files)));
      input.value = '';
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => {
      drop.classList.remove('over');
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
      void open(() => filesFromDrop(entry as FileSystemDirectoryEntry));
    });
    $('.od-sample').addEventListener('click', () => {
      setBusy('Opening the sample…');
      forgetOpened();
      location.reload();
    });
  } else {
    const openLocal = async (choose: () => Promise<{ folder?: string; cancelled?: boolean }>) => {
      error.textContent = '';
      try {
        const { folder, cancelled } = await choose();
        if (cancelled) {
          setBusy(null);
          return;
        }
        if (folder) rememberFolder(folder);
        setBusy('Opening…');
        location.reload();
      } catch (err) {
        fail(err);
      }
    };
    $('.od-choose').addEventListener('click', () => {
      setBusy('Waiting for the folder picker…');
      void openLocal(() => post('choose-folder'));
    });
    const input = inputAt('.od-path input');
    $('.od-path').addEventListener('submit', (e) => {
      e.preventDefault();
      const folder = input.value.trim();
      if (!folder) return;
      setBusy('Opening…');
      void openLocal(() => post('open', { folder }));
    });
    const recent = readRecent().filter((f) => f !== currentFolder);
    $('.od-recent-title').hidden = recent.length === 0;
    $('.od-recent').replaceChildren(
      ...recent.map((folder) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = folder.split('/').at(-1) ?? folder;
        button.title = folder;
        button.addEventListener('click', () => {
          setBusy('Opening…');
          void openLocal(() => post('open', { folder }));
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
      dialog.showModal();
    },
  };
};
