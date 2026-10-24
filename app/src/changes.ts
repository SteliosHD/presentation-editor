import { createElement, RefreshCw } from 'lucide';

// After a file in the open presentation changes and the page reloads, a short notice at the top names what changed.
// The change is noted in this tab's session storage just before the reload and shown once after it.

export type Change = { kind: 'added' | 'updated' | 'removed'; file: string };

const KEY = 'presentation-viewer:changed';
const VERBS = { added: 'Added', updated: 'Updated', removed: 'Removed' };
const SHOW_MS = 3500;

export const noteChanges = (changes: Change[]) => {
  try {
    const before = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Change[];
    sessionStorage.setItem(KEY, JSON.stringify([...before, ...changes]));
  } catch {
    // Storage blocked: the page still reloads, just without the notice.
  }
};

const takeChanges = () => {
  try {
    const changes = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Change[];
    sessionStorage.removeItem(KEY);
    return changes;
  } catch {
    return [];
  }
};

const describe = (changes: Change[]) => {
  const files = [...new Set(changes.map((c) => c.file))];
  const kinds = new Set(changes.map((c) => c.kind));
  const verb = kinds.size === 1 ? VERBS[changes[0].kind] : 'Changed';
  if (files.length === 1) return `${verb} ${files[0]}`;
  if (files.length === 2) return `${verb} ${files[0]} and ${files[1]}`;
  return `${verb} ${files.length} files`;
};

export const showChanges = () => {
  const changes = takeChanges();
  if (!changes.length) return;
  const note = document.createElement('div');
  note.className = 'change-note';
  note.setAttribute('role', 'status');
  note.title = changes.map(({ kind, file }) => `${VERBS[kind]} ${file}`).join('\n');
  note.append(createElement(RefreshCw, { width: 14, height: 14, 'aria-hidden': 'true' }), describe(changes));
  document.body.append(note);
  setTimeout(() => {
    note.classList.add('leaving');
    setTimeout(() => {
      note.remove();
    }, 300);
  }, SHOW_MS);
};
