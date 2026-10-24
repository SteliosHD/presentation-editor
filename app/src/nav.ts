import {
  Check,
  ChevronRight,
  createElement,
  FileCode,
  FileDown,
  FolderOpen,
  Info,
  LifeBuoy,
  Map as MapIcon,
  Scale,
  Sparkles,
  type IconNode,
} from 'lucide';
import type { Presentation } from 'virtual:presentation';
import { createAboutDialog } from './about-dialog.ts';
import { animationPrefs } from './animation-prefs.ts';
import { post } from './api.ts';
import iconUrl from '../favicon.svg';
import { createOpenDialog, rememberFolder } from './open-dialog.ts';
import { must } from './player.ts';
import { createPromptDialog } from './prompt-dialog.ts';
import { queueTour, startQueuedTour, startTour } from './tour.ts';
import site from './site.ts';
import { isWeb, linkedToSample } from './source.ts';
import { watchOpened } from './watch.ts';
import { downloadHtml, downloadPdf } from './web.ts';

// The nav bar: app icon with the File, Edit, View and Help menus on the left, the folder's name in the centre,
// export status and a link to the source on the right. Locally, exports go through the server (Mac save dialog, Chrome-made PDF); hosted,
// they are built in the browser and downloaded.

const REPO = 'https://github.com/SteliosHD/presentation-viewer';
// GitHub's mark (Octicons mark-github, MIT); Lucide no longer ships brand icons.
const GITHUB_MARK = `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>`;

type Item =
  | { label: string; icon: IconNode; run: () => void }
  | { label: string; checked: () => boolean; run: () => void };
type Entry = Item | { label: string; icon: IconNode; sub: Item[] } | 'separator';

const icon = (node: IconNode) => createElement(node, { width: 16, height: 16, 'aria-hidden': 'true' });

// A dropdown menu: click or arrow keys to move, Esc or a click elsewhere to close. An entry with a submenu opens it
// on hover, click or the right arrow.
const createMenu = (title: string, entries: Entry[]) => {
  const root = document.createElement('div');
  root.className = `menu menu-${title.toLowerCase()}`;
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

  const makeItem = (entry: Item | { label: string; icon: IconNode }) => {
    const item = document.createElement('button');
    const checkable = 'checked' in entry;
    item.setAttribute('role', checkable ? 'menuitemcheckbox' : 'menuitem');
    const mark = document.createElement('span');
    mark.className = 'menu-mark';
    mark.append(icon(checkable ? Check : entry.icon));
    item.append(mark, entry.label);
    return item;
  };
  // Every clickable entry, submenus' included; `items` are only the top level, which the arrow keys walk.
  const leaves: { item: HTMLButtonElement; entry: Item }[] = [];
  const subs: { item: HTMLButtonElement; wrap: HTMLElement; sub: HTMLElement }[] = [];
  const items = entries.flatMap((entry) => {
    if (entry === 'separator') {
      list.append(document.createElement('hr'));
      return [];
    }
    const item = makeItem(entry);
    if (!('sub' in entry)) {
      list.append(item);
      leaves.push({ item, entry });
      return [item];
    }
    item.setAttribute('aria-haspopup', 'menu');
    item.setAttribute('aria-expanded', 'false');
    item.classList.add('menu-has-sub');
    const arrow = icon(ChevronRight);
    arrow.classList.add('menu-arrow');
    item.append(arrow);
    const sub = document.createElement('div');
    sub.className = 'menu-list menu-sub';
    sub.setAttribute('role', 'menu');
    sub.hidden = true;
    for (const child of entry.sub) {
      const childItem = makeItem(child);
      sub.append(childItem);
      leaves.push({ item: childItem, entry: child });
    }
    const wrap = document.createElement('div');
    wrap.className = 'menu-sub-wrap';
    wrap.append(item, sub);
    list.append(wrap);
    subs.push({ item, wrap, sub });
    return [item];
  });

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  const refresh = () => {
    for (const { item, entry } of leaves) {
      if ('checked' in entry) item.setAttribute('aria-checked', String(entry.checked()));
    }
  };
  const showSub = (s: (typeof subs)[number], open: boolean) => {
    s.sub.hidden = !open;
    s.item.setAttribute('aria-expanded', String(open));
    s.item.classList.toggle('on', open);
  };
  for (const s of subs) {
    s.wrap.addEventListener('pointerenter', () => {
      showSub(s, true);
    });
    s.wrap.addEventListener('pointerleave', () => {
      showSub(s, false);
    });
    const focusFirst = () => {
      showSub(s, true);
      s.sub.querySelector('button')?.focus();
    };
    s.item.addEventListener('click', focusFirst);
    s.item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusFirst();
      }
    });
    s.sub.addEventListener('keydown', (e) => {
      const buttons = [...s.sub.querySelectorAll('button')];
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        buttons.at((at + (e.key === 'ArrowDown' ? 1 : -1)) % buttons.length)?.focus();
      }
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        showSub(s, false);
        s.item.focus();
      }
    });
  }
  const setOpen = (open: boolean) => {
    refresh();
    for (const s of subs) showSub(s, false);
    list.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('on', open);
    // A menu near the right edge of a narrow window shifts left so all of it stays on screen.
    list.style.translate = '';
    if (open) {
      const over = list.getBoundingClientRect().right - (innerWidth - 8);
      if (over > 0) list.style.translate = `${-over}px 0`;
    }
    if (open) items.find((item) => !item.disabled)?.focus();
  };
  button.addEventListener('click', () => {
    setOpen(!isOpen());
  });
  // The tour opens menus itself, so its own clicks leave them open.
  document.addEventListener('click', (e) => {
    if (!isOpen() || !(e.target instanceof Element) || root.contains(e.target) || e.target.closest('.tour')) return;
    setOpen(false);
  });
  list.addEventListener('keydown', (e) => {
    const enabled = items.filter((item) => !item.disabled);
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
  for (const { item, entry } of leaves) {
    item.addEventListener('click', () => {
      setOpen(false);
      entry.run();
    });
  }
  return { root, items };
};

// View: parts of the viewer that can be hidden, remembered between visits.
const VIEW_KEY = 'presentation-viewer:hidden';
const PARTS = ['sidebar', 'toolbar', 'animations'] as const;
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
    localStorage.setItem(VIEW_KEY, JSON.stringify(PARTS.filter(isHidden)));
  } catch {
    // Storage blocked: the view still changes for this visit.
  }
};

export const mountNav = (
  presentation: Presentation,
  { choose, inBrowser, empty }: { choose: boolean; inBrowser: boolean; empty: boolean },
) => {
  if (!inBrowser) rememberFolder(presentation.folder);
  for (const part of readHidden()) document.body.classList.add(`hide-${part}`);

  const nav = document.createElement('header');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-left">
      ${
        site?.home
          ? `<button class="nav-home" title="What Presentation Viewer does" aria-label="What Presentation Viewer does">
              <img class="nav-icon" src="${iconUrl}" alt="" />
            </button>`
          : `<img class="nav-icon" src="${iconUrl}" alt="Presentation Viewer" />`
      }
    </div>
    <span class="nav-folder"></span>
    <div class="nav-right">
      <span class="nav-live" title="Updates when files in the folder change" hidden>Live</span>
      <button class="nav-reconnect" title="The browser needs your permission again to watch the folder" hidden>
        Reconnect folder
      </button>
      <span class="nav-status"><span class="spinner"></span><span class="nav-status-text"></span></span>
      <a class="nav-github" href="${REPO}" target="_blank" rel="noopener" title="Presentation Viewer on GitHub"
        aria-label="Presentation Viewer on GitHub">${GITHUB_MARK}</a>
    </div>`;
  document.body.prepend(nav);
  const $ = (sel: string) => must(nav.querySelector<HTMLElement>(sel), sel);
  // Just the folder's own name; the full path shows on hover.
  $('.nav-folder').textContent = presentation.folder.split('/').at(-1) ?? presentation.folder;
  $('.nav-folder').title = empty
    ? ''
    : inBrowser
      ? `Opened in this browser tab${isWeb ? '' : ': edits on disk need opening it again'}`
      : presentation.folder;

  const prompt = createPromptDialog();
  const dialog = createOpenDialog(presentation.folder, REPO);
  const ctx = { openFolder: dialog.show, trySample: isWeb ? dialog.trySample : undefined };
  if (choose) {
    if (site?.start) site.start(ctx);
    else ctx.openFolder();
  }
  nav.querySelector('.nav-home')?.addEventListener('click', () => {
    site?.home?.({ ...ctx, back: () => undefined });
  });

  // A folder opened in Chrome or Edge is watched for changes; the badge says so, or offers to reconnect.
  if (inBrowser && !empty) {
    void watchOpened((state) => {
      $('.nav-live').hidden = state !== 'live';
      $('.nav-reconnect').hidden = state !== 'paused';
    }).then((watcher) => {
      $('.nav-reconnect').addEventListener('click', () => {
        void watcher?.reconnect();
      });
    });
  }

  const status = $('.nav-status');
  const say = (text: string, { error = false, busy = false } = {}) => {
    $('.nav-status-text').textContent = text;
    status.classList.toggle('error', error);
    status.classList.toggle('busy', busy);
  };
  const run = async (format: 'html' | 'pdf') => {
    if (!inBrowser) {
      say(`Choose where to save the ${format.toUpperCase()}`, { busy: true });
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
    { label: 'Open Presentation folder', icon: FolderOpen, run: dialog.show },
    'separator',
    { label: 'Export HTML', icon: FileCode, run: exporting('html') },
    { label: 'Export PDF', icon: FileDown, run: exporting('pdf') },
  ]);
  if (empty) file.items.slice(1).forEach((b) => (b.disabled = true));
  const editMenu = createMenu('Edit', [{ label: 'Slide Creation Prompt', icon: Sparkles, run: prompt.show }]);
  const showPart = (part: (typeof PARTS)[number], label: string) => ({
    label,
    checked: () => !isHidden(part),
    run: () => {
      toggleHidden(part);
    },
  });
  const view = createMenu('View', [
    showPart('sidebar', 'Slide list'),
    showPart('toolbar', 'Toolbar'),
    {
      label: 'Animations',
      icon: Sparkles,
      sub: [
        {
          label: 'Play animations on slide change',
          checked: () => animationPrefs.get().autoplay,
          run: () => {
            animationPrefs.set({ autoplay: !animationPrefs.get().autoplay });
          },
        },
        showPart('animations', 'Show animations list'),
        {
          label: 'Show technical details',
          checked: () => animationPrefs.get().details,
          run: () => {
            animationPrefs.set({ details: !animationPrefs.get().details });
          },
        },
      ],
    },
  ]);
  const about = createAboutDialog({ repo: REPO, extra: site?.about });
  const help = createMenu('Help', [
    {
      label: 'Personalize your viewer',
      icon: LifeBuoy,
      run: () => {
        window.open(`${REPO}#personalize-your-viewer`, '_blank', 'noopener');
      },
    },
    { label: 'Take the tour', icon: MapIcon, run: startTour },
    'separator',
    { label: 'Why use the Presentation Viewer', icon: Info, run: about.show },
  ]);
  $('.nav-left').append(file.root, editMenu.root, view.root, help.root);
  // Arriving by a ?sample link counts as trying the sample: the tour follows, and the address loses the request.
  if (linkedToSample()) {
    queueTour();
    const params = new URLSearchParams(location.search);
    params.delete('sample');
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
  }
  startQueuedTour();

  // Footer: the site's own, or the license and the source.
  const footer = document.createElement('footer');
  footer.className = 'app-foot';
  footer.innerHTML =
    site?.footer ??
    `<a class="app-foot-license" href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener"
      title="MIT license: free to use, change and share, provided as is, without warranty">MIT</a>
    <a href="${REPO}" target="_blank" rel="noopener">Source on GitHub ↗</a>`;
  footer
    .querySelector('.app-foot-license')
    ?.prepend(createElement(Scale, { width: 13, height: 13, 'aria-hidden': 'true' }));
  document.body.append(footer);
};
