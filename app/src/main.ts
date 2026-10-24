import './theme.css';
import './slides.css';
import './app.css';
import { createAnimationList } from './animation-list.ts';
import { createInk } from './ink.ts';
import { createPlayer, must } from './player.ts';
import { createPresentationMode } from './presentation-mode.ts';
import { createSlideList } from './slide-list.ts';
import { isWeb, loadPresentation } from './source.ts';
import { shortcutFor, type ShortcutId } from './shortcuts.ts';
import { createToolbar, slideNumbers } from './toolbar.ts';

// Loads the presentation and wires the parts together: player, slide list, toolbar, presentation mode,
// drawing, keyboard, and (outside exports) the nav bar and animation list.

// Settings saved before the app was renamed from Presentation Editor carry over once.
for (const store of [localStorage, sessionStorage]) {
  try {
    for (const key of Object.keys(store).filter((k) => k.startsWith('presentation-editor:'))) {
      const renamed = key.replace('presentation-editor:', 'presentation-viewer:');
      if (store.getItem(renamed) === null) store.setItem(renamed, store.getItem(key) ?? '');
      store.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing to carry over.
  }
}

// The page address holds the current slide (#3), so a reload after a file changes stays on it. Read before
// anything renders, since rendering writes the address.
const fromAddress = Number.parseInt(location.hash.slice(1), 10);
const { presentation, choose, inBrowser, empty } = await loadPresentation();
// Nothing open yet (hosted app): placeholders show and the tools stay off until a presentation is opened.
document.body.classList.toggle('empty', empty);

// The presentation's own theme.css goes after the default theme, so its tokens win.
const presentationTheme = document.createElement('style');
presentationTheme.textContent = presentation.theme;
document.head.append(presentationTheme);

// Authoring aids (nav bar, animation list) need the running app, so exported files leave them out.
const authoring = import.meta.env.MODE !== 'export' && import.meta.env.MODE !== 'template';
document.title = authoring ? `${presentation.title} · Presentation Viewer` : presentation.title;

// Above the slide, while editing: the presentation's title and the current slide's file.
const stageHead = must(document.querySelector('.stage-head'), '.stage-head');
const stageFile = must(document.querySelector('.stage-file'), '.stage-file');
if (authoring) must(document.querySelector('.stage-title'), '.stage-title').textContent = presentation.title;
else stageHead.remove();

const onKey = (e: KeyboardEvent) => {
  if (empty || e.metaKey || e.ctrlKey || e.altKey) return;
  // Typing in a field, or working the Open modal or File menu, is not slide control.
  if (e.target instanceof Element && e.target.closest('input, dialog, .menu')) return;
  const id = shortcutFor(e.key);
  // Esc and D only mean something while presenting; elsewhere Esc stays with the browser.
  if (!id || ((id === 'exit' || id === 'draw') && !present.active())) return;
  e.preventDefault();
  actions[id]();
};

const actions: Record<ShortcutId, () => void> = {
  next: () => {
    player.show(player.current() + 1);
  },
  prev: () => {
    player.show(player.current() - 1);
  },
  first: () => {
    player.show(0);
  },
  last: () => {
    player.show(player.elements.length - 1);
  },
  notes: () => {
    player.toggleNotes();
  },
  pointer: () => {
    player.toggleLaser();
  },
  numbers: () => {
    toggleNumbers();
  },
  present: () => {
    present.toggle();
  },
  draw: () => {
    ink.togglePen();
  },
  exit: () => {
    present.toggle();
  },
};

const player = createPlayer(presentation.slides, must(document.querySelector('.viewport'), '.viewport'), {
  onChange: () => {
    render();
  },
  onKey,
});
// Picking or putting away a drawing tool can change the room around the slide, so refit it.
const ink = createInk(must(document.querySelector<HTMLElement>('.slide-stack'), '.slide-stack'), {
  onChange: () => {
    player.fit();
  },
});
const present = createPresentationMode({
  onChange: (on) => {
    if (!on) ink.stop();
    render();
  },
});
const toggleNumbers = () => {
  slideNumbers.toggle();
  render();
};
slideNumbers.restore();

const slideList = createSlideList(presentation, player);
const animationList = authoring ? createAnimationList(presentation, player, { empty }) : null;
const toolbar = createToolbar(
  {
    notes: { run: player.toggleNotes, isOn: player.notesOpen },
    pointer: { run: player.toggleLaser, isOn: player.laserOn },
    numbers: { run: toggleNumbers, isOn: slideNumbers.isOn },
    present: { run: present.toggle, isOn: present.active },
  },
  (delta) => {
    player.show(player.current() + delta);
  },
);

let shownSlide = -1;
const render = () => {
  const k = player.current();
  if (k !== shownSlide) ink.clear();
  shownSlide = k;
  slideList.render(k);
  stageFile.textContent = empty ? '' : presentation.slides[k].file;
  animationList?.render(k);
  toolbar.render(k, player.elements.length);
  if (!empty) history.replaceState(null, '', `#${k + 1}`);
  if (empty)
    for (const b of document.querySelectorAll<HTMLButtonElement>('.bar button, .slide-nav button')) b.disabled = true;
  player.fit();
};

document.addEventListener('keydown', onKey);

// Swipe left or right on a touch screen to change slide (not while drawing).
const viewport = must(document.querySelector<HTMLElement>('.viewport'), '.viewport');
let swipeFrom: { x: number; y: number } | null = null;
viewport.addEventListener('pointerdown', (e) => {
  swipeFrom =
    e.pointerType === 'touch' && !document.body.classList.contains('inking') ? { x: e.clientX, y: e.clientY } : null;
});
viewport.addEventListener('pointercancel', () => {
  swipeFrom = null;
});
viewport.addEventListener('pointerup', (e) => {
  if (!swipeFrom) return;
  const dx = e.clientX - swipeFrom.x;
  const dy = e.clientY - swipeFrom.y;
  swipeFrom = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) actions[dx < 0 ? 'next' : 'prev']();
});
// Clicking these buttons must not focus them: a focused button would also react to Space or Enter,
// toggling a tool or presentation mode when the presenter only meant to change slide.
document.addEventListener('mousedown', (e) => {
  if (
    e.target instanceof Element &&
    e.target.closest('.bar button, .slide-list button, .slide-nav button, .exit-present')
  ) {
    e.preventDefault();
  }
});

// Vercel Web Analytics, in the hosted app only: page views, no cookies.
if (isWeb) {
  void import('@vercel/analytics').then(({ inject }) => {
    inject({ mode: 'production' });
  });
}

if (authoring) {
  void import('./nav.ts').then(({ mountNav }) => {
    mountNav(presentation, { choose, inBrowser, empty });
  });
}

player.show(Number.isInteger(fromAddress) ? Math.min(Math.max(fromAddress, 1), player.elements.length) - 1 : 0);
