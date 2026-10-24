import { Check, createElement, FileCode, FileDown, FolderOpen, Sparkles, type IconNode } from 'lucide';
import type { Presentation } from 'virtual:presentation';
import { post } from './api.ts';
import iconUrl from '../favicon.svg';
import { createOpenDialog, rememberFolder } from './open-dialog.ts';
import { must } from './player.ts';
import { createPromptDialog } from './prompt-dialog.ts';
import { isWeb } from './source.ts';
import { downloadHtml, downloadPdf } from './web.ts';

// The nav bar: app icon with the File, Edit and View menus on the left, the folder's name in the centre, export
// status on the right. Locally, exports go through the server (Mac save dialog, Chrome-made PDF); hosted,
// they are built in the browser and downloaded.

type Entry =
  | { label: string; icon: IconNode; run: () => void }
  | { label: string; checked: () => boolean; run: () => void }
  | 'separator';

// A dropdown menu: click or arrow keys to move, Esc or a click elsewhere to close.
const createMenu = (title: string, entries: Entry[]) => {
  const root = document.createElement('div');
  root.className = 'menu';
  const button = document.createElement('button');
  button.className = 'menu-button';
  button.textContent = title;
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const list = document.createElement('div');
  list.className = 'menu-list';
  list.setAttribute('role', 'menu');
  list.hidden = true;
  root.append(button, list);

  const items = entries.flatMap((entry) => {
    if (entry === 'separator') {
      list.append(document.createElement('hr'));
      return [];
    }
    const item = document.createElement('button');
    const checkable = 'checked' in entry;
    item.setAttribute('role', checkable ? 'menuitemcheckbox' : 'menuitem');
    const mark = document.createElement('span');
    mark.className = 'menu-mark';
    mark.append(createElement(checkable ? Check : entry.icon, { width: 16, height: 16, 'aria-hidden': 'true' }));
    item.append(mark, entry.label);
    list.append(item);
    return [{ item, entry }];
  });

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  const refresh = () => {
    for (const { item, entry } of items) {
      if ('checked' in entry) item.setAttribute('aria-checked', String(entry.checked()));
    }
  };
  const setOpen = (open: boolean) => {
    refresh();
    list.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('on', open);
    if (open) items.find(({ item }) => !item.disabled)?.item.focus();
  };
  button.addEventListener('click', () => {
    setOpen(!isOpen());
  });
  document.addEventListener('click', (e) => {
    if (isOpen() && e.target instanceof Node && !root.contains(e.target)) setOpen(false);
  });
  list.addEventListener('keydown', (e) => {
    const enabled = items.map(({ item }) => item).filter((item) => !item.disabled);
    const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      enabled.at((at + (e.key === 'ArrowDown' ? 1 : -1)) % enabled.length)?.focus();
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
  for (const { item, entry } of items) {
    item.addEventListener('click', () => {
      setOpen(false);
      entry.run();
    });
  }
  return { root, items: items.map(({ item }) => item) };
};

// View: parts of the editor that can be hidden, remembered between visits.
const VIEW_KEY = 'presentation-editor:hidden';
const PARTS = [
  ['sidebar', 'Slide list'],
  ['toolbar', 'Toolbar'],
  ['animations', 'Animations'],
] as const;
const readHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const isHidden = (part: string) => document.body.classList.contains(`hide-${part}`);
const toggleHidden = (part: string) => {
  document.body.classList.toggle(`hide-${part}`);
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(PARTS.map(([p]) => p).filter(isHidden)));
  } catch {
    // Storage blocked: the view still changes for this visit.
  }
};

export const mountNav = (presentation: Presentation, { choose }: { choose: boolean }) => {
  if (!isWeb) rememberFolder(presentation.folder);
  for (const part of readHidden()) document.body.classList.add(`hide-${part}`);

  const nav = document.createElement('header');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-left"><img class="nav-icon" src="${iconUrl}" alt="Presentation Editor" /></div>
    <span class="nav-folder"></span>
    <span class="nav-status"><span class="spinner"></span><span class="nav-status-text"></span></span>`;
  document.body.prepend(nav);
  const $ = (sel: string) => must(nav.querySelector<HTMLElement>(sel), sel);
  // Just the folder's own name; the full path shows on hover.
  $('.nav-folder').textContent = presentation.folder.split('/').at(-1) ?? presentation.folder;
  $('.nav-folder').title = isWeb ? 'Opened in this browser tab' : presentation.folder;

  const prompt = createPromptDialog();
  const dialog = createOpenDialog(presentation.folder, { onCreate: prompt.show });
  if (choose) dialog.show();

  const status = $('.nav-status');
  const say = (text: string, { error = false, busy = false } = {}) => {
    $('.nav-status-text').textContent = text;
    status.classList.toggle('error', error);
    status.classList.toggle('busy', busy);
  };
  const run = async (format: 'html' | 'pdf') => {
    if (!isWeb) {
      say(`Choose where to save the ${format.toUpperCase()}…`, { busy: true });
      const { file, cancelled } = await post('export', { format });
      say(cancelled ? 'Export cancelled' : `Saved ${file ?? ''}`);
      return;
    }
    if (format === 'pdf') {
      await downloadPdf(presentation, (done) => {
        say(`Making the PDF: slide ${done + 1} of ${presentation.slides.length}`, { busy: true });
      });
    } else {
      say('Making the HTML file', { busy: true });
      await downloadHtml(presentation);
    }
    say(`Downloaded ${presentation.folder}.${format}`);
  };
  const exporting = (format: 'html' | 'pdf') => () => {
    file.items.slice(1).forEach((b) => (b.disabled = true));
    run(format)
      .catch((err: unknown) => {
        say(`Export failed: ${err instanceof Error ? err.message : String(err)}`, { error: true });
      })
      .finally(() => {
        file.items.slice(1).forEach((b) => (b.disabled = false));
      });
  };

  const file = createMenu('File', [
    { label: 'Open Presentation folder…', icon: FolderOpen, run: dialog.show },
    'separator',
    { label: 'Export HTML', icon: FileCode, run: exporting('html') },
    { label: 'Export PDF', icon: FileDown, run: exporting('pdf') },
  ]);
  const editMenu = createMenu('Edit', [{ label: 'Slide Creation Prompt…', icon: Sparkles, run: prompt.show }]);
  const view = createMenu(
    'View',
    PARTS.map(([part, label]) => ({
      label,
      checked: () => !isHidden(part),
      run: () => {
        toggleHidden(part);
      },
    })),
  );
  $('.nav-left').append(file.root, editMenu.root, view.root);
};
