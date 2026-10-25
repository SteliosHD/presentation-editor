import { Check, createElement, RefreshCw } from 'lucide';

// After a file in the open presentation changes and the page reloads, a short notice at the top names what changed.
// The change is noted in this tab's session storage just before the reload and shown once after it. Other steps
// that end in a reload can leave a message the same way (noteMessage), shown for longer.

export type Change = { kind: 'added' | 'updated' | 'removed'; file: string };

const KEY = 'presentation-viewer:changed';
const MESSAGE_KEY = 'presentation-viewer:message';
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

export const noteMessage = (text: string) => {
  try {
    sessionStorage.setItem(MESSAGE_KEY, text);
  } catch {
    // Storage blocked: no notice after the reload.
  }
};
const takeMessage = () => {
  try {
    const text = sessionStorage.getItem(MESSAGE_KEY);
    sessionStorage.removeItem(MESSAGE_KEY);
    return text;
  } catch {
    return null;
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
  const message = takeMessage();
  if (!changes.length && !message) return;
  const note = document.createElement('div');
  note.className = 'change-note';
  note.setAttribute('role', 'status');
  if (message) note.append(createElement(Check, { width: 14, height: 14, 'aria-hidden': 'true' }), message);
  else {
    note.title = changes.map(({ kind, file }) => `${VERBS[kind]} ${file}`).join('\n');
    note.append(createElement(RefreshCw, { width: 14, height: 14, 'aria-hidden': 'true' }), describe(changes));
  }
  document.body.append(note);
  setTimeout(
    () => {
      note.classList.add('leaving');
      setTimeout(() => {
        note.remove();
      }, 300);
    },
    message ? SHOW_MS * 3 : SHOW_MS,
  );
};
