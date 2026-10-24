import './theme.css';
import './slides.css';
import './app.css';
import { createAnimationList } from './animation-list.ts';
import { createInk } from './ink.ts';
import { createPlayer, must } from './player.ts';
import { createPresentationMode } from './presentation-mode.ts';
import { createSlideList } from './slide-list.ts';
import { loadPresentation } from './source.ts';
import { createToolbar, slideNumbers } from './toolbar.ts';

// Loads the presentation and wires the parts together: player, slide list, toolbar, presentation mode,
// drawing, keyboard, and (outside exports) the nav bar and animation list.

const { presentation, choose, inBrowser } = await loadPresentation();

// The presentation's own theme.css goes after the default theme, so its tokens win.
const presentationTheme = document.createElement('style');
presentationTheme.textContent = presentation.theme;
document.head.append(presentationTheme);

// Authoring aids (nav bar, animation list) need the running app, so exported files leave them out.
const authoring = import.meta.env.MODE !== 'export' && import.meta.env.MODE !== 'template';
document.title = authoring ? `${presentation.title} · Presentation Editor` : presentation.title;

const onKey = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Typing in a field, or working the Open modal or File menu, is not slide control.
  if (e.target instanceof Element && e.target.closest('input, dialog, .menu')) return;
  const handled = () => {
    e.preventDefault();
    return true;
  };
  if (['ArrowRight', 'PageDown', ' '].includes(e.key) && handled()) player.show(player.current() + 1);
  if (['ArrowLeft', 'PageUp'].includes(e.key) && handled()) player.show(player.current() - 1);
  if (e.key === 'Home' && handled()) player.show(0);
  if (e.key === 'End' && handled()) player.show(player.elements.length - 1);
  if (e.key === 'n' || e.key === 'N') {
    if (present.active() && !player.notesOpen()) void present.outsideFullscreen(player.toggleNotes);
    else player.toggleNotes();
  }
  if (e.key === 'p' || e.key === 'P') player.toggleLaser();
  if (e.key === 's' || e.key === 'S') toggleNumbers();
  if (e.key === 'f' || e.key === 'F') present.toggle();
  if (e.key === 'Escape' && present.active()) present.toggle();
  if ((e.key === 'd' || e.key === 'D') && present.active()) ink.togglePen();
};

const player = createPlayer(presentation.slides, must(document.querySelector('.viewport'), '.viewport'), {
  onChange: () => {
    render();
  },
  onKey,
});
const ink = createInk(must(document.querySelector('.slide-stack'), '.slide-stack'));
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
const animationList = authoring ? createAnimationList(presentation, player) : null;
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
  animationList?.render(k);
  toolbar.render(k, player.elements.length);
  player.fit();
};

document.addEventListener('keydown', onKey);
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

if (authoring) {
  void import('./nav.ts').then(({ mountNav }) => {
    mountNav(presentation, { choose, inBrowser });
  });
}

player.show(0);
