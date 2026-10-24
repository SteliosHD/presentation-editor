import { noteChanges, type Change } from './changes.ts';
import { storeOpened } from './source.ts';
import { readPresentation, type FolderFile } from './web.ts';

// Chrome and Edge give the page a handle to a folder the viewer picks or drops, which can be read again later. A
// folder opened that way is watched: when a slide, the theme or the title changes, it is read again and the page
// reloads on the same slide, so it updates while an agent writes the slides. Other browsers read the folder once.
//
// The handle is kept in IndexedDB under this tab's id, since each tab has its own opened presentation.

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
  }
  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }
  interface FileSystemHandle {
    queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
    requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
  }
}

export const canWatch = typeof window.showDirectoryPicker === 'function';

const TAB_KEY = 'presentation-viewer:tab';
const tabId = () => {
  try {
    let id = sessionStorage.getItem(TAB_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_KEY, id);
    }
    return id;
  } catch {
    return 'tab';
  }
};

const handles = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    const open = indexedDB.open('presentation-viewer', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('folders');
    open.onerror = () => {
      reject(open.error ?? new Error('IndexedDB unavailable'));
    };
    open.onsuccess = () => {
      const req = run(open.result.transaction('folders', mode).objectStore('folders'));
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        reject(req.error ?? new Error('IndexedDB request failed'));
      };
    };
  });

// What the folder looked like when it was last read, so changes made while the page was away (a refresh, say)
// still count once watching starts again.
const STAMPS_KEY = 'presentation-viewer:stamps';
const saveStamps = (now: Map<string, string> | null) => {
  try {
    if (now) sessionStorage.setItem(STAMPS_KEY, JSON.stringify([...now]));
    else sessionStorage.removeItem(STAMPS_KEY);
  } catch {
    // Storage blocked: watching starts from what the folder looks like then.
  }
};
const savedStamps = () => {
  try {
    const json = sessionStorage.getItem(STAMPS_KEY);
    return json ? new Map(JSON.parse(json) as [string, string][]) : null;
  } catch {
    return null;
  }
};

// Failing to keep or forget a handle only costs live updates, so these never throw.
export const rememberWatched = async (dir: FileSystemDirectoryHandle) => {
  saveStamps(await stamps(dir).catch(() => null));
  await handles('readwrite', (store) => store.put(dir, tabId())).catch(() => undefined);
};
export const forgetWatched = () => {
  saveStamps(null);
  return handles('readwrite', (store) => store.delete(tabId())).catch(() => undefined);
};
const savedFolder = () =>
  handles<FileSystemDirectoryHandle | undefined>(
    'readonly',
    (store) => store.get(tabId()) as IDBRequest<FileSystemDirectoryHandle | undefined>,
  ).catch(() => undefined);

// The same files a drop reads: the folder's top level and its slides/ folder.
export const filesFromHandle = async (dir: FileSystemDirectoryHandle): Promise<FolderFile[]> => {
  const files: FolderFile[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'file') {
      files.push({ path: `${dir.name}/${entry.name}`, file: await entry.getFile() });
    } else if (entry.name === 'slides') {
      for await (const slide of entry.values()) {
        if (slide.kind === 'file') {
          const file = await slide.getFile();
          files.push({ path: `${dir.name}/slides/${slide.name}`, file });
        }
      }
    }
  }
  return files;
};

// Each watched file's size and modified time, by name: the slides, the theme and the title, as the local server
// watches. Other files in the folder, such as exports, don't count.
const stamps = async (dir: FileSystemDirectoryHandle) =>
  new Map(
    (await filesFromHandle(dir))
      .map(({ path, file }) => ({ rel: path.slice(dir.name.length + 1), file }))
      // A folder of slides opened on its own has them at the top.
      .filter(
        ({ rel }) =>
          rel.startsWith('slides/') ||
          /^[^/]+\.(html|ts)$/.test(rel) ||
          rel === 'theme.css' ||
          rel === 'presentation.json',
      )
      .map(({ rel, file }) => [rel, `${file.size}:${file.lastModified}`]),
  );
const same = (a: Map<string, string>, b: Map<string, string>) =>
  a.size === b.size && [...a].every(([rel, stamp]) => b.get(rel) === stamp);
const name = (rel: string) => rel.split('/').at(-1) ?? rel;
const differences = (before: Map<string, string>, after: Map<string, string>): Change[] => [
  ...[...after.keys()].filter((rel) => !before.has(rel)).map((rel) => ({ kind: 'added' as const, file: name(rel) })),
  ...[...after]
    .filter(([rel, stamp]) => before.has(rel) && before.get(rel) !== stamp)
    .map(([rel]) => ({ kind: 'updated' as const, file: name(rel) })),
  ...[...before.keys()].filter((rel) => !after.has(rel)).map((rel) => ({ kind: 'removed' as const, file: name(rel) })),
];

const POLL_MS = 1000;
// An agent writes a file in pieces; a change counts once the folder looks the same twice in a row.
const SETTLE_MS = 300;
const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const watch = async (dir: FileSystemDirectoryHandle) => {
  let seen = savedStamps() ?? (await stamps(dir));
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    void (async () => {
      const now = await stamps(dir);
      if (same(now, seen)) return;
      await sleep(SETTLE_MS);
      if (!same(await stamps(dir), now)) return;
      storeOpened(await readPresentation(await filesFromHandle(dir)));
      noteChanges(differences(seen, now));
      saveStamps(now);
      seen = now;
      location.reload();
    })()
      // A file caught half-written or just deleted: try again on the next poll.
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  }, POLL_MS);
};

// Watches this tab's folder if it has one. Reading it again needs the browser's permission, which it may have
// forgotten (after a restart, say); asking again needs a click, so `reconnect` is for a button.
export const watchOpened = async (onState: (state: 'live' | 'paused') => void) => {
  const dir = await savedFolder();
  if (!dir) return null;
  let watching = false;
  const start = async () => {
    if (watching) return;
    watching = true;
    await watch(dir);
    onState('live');
  };
  if ((await dir.queryPermission?.({ mode: 'read' })) === 'granted') await start();
  else onState('paused');
  return {
    reconnect: async () => {
      if ((await dir.requestPermission?.({ mode: 'read' })) === 'granted') await start();
    },
  };
};
