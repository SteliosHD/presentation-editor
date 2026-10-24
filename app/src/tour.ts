import { must, reduceMotion } from './player.ts';

// Walkthroughs: each step lights up one part of the page with a card beside it. Skip, Esc or the last step ends one,
// and it is then remembered in this browser. Parts hidden at the current size are left out.
//
// The tour of the editor runs after "Try the sample" until seen, and from Help → Take the tour at any time. Its last
// steps open a menu and light up one of its items.

const STEPS = [
  {
    target: '.sidebar',
    title: 'Slides',
    text: 'Every slide in the presentation. Each one is an HTML file in slides/, numbered in the order it shows. Click a slide to open it.',
  },
  {
    target: '.viewport',
    title: 'Slide',
    text: 'The current slide. Press F to present it full screen with only the slide showing; Esc comes back. ← and → change slides.',
  },
  {
    target: '.anim-strip',
    title: 'Animations',
    text: "Each step of this slide's animation: when it runs, what moves, and how. Slides with their own animation file label their steps.",
  },
  {
    target: '.bar',
    title: 'Tools',
    text: 'Speaker notes, laser pointer, slide numbers and Present. Hover a tool to see its name and shortcut.',
  },
  {
    target: '.menu-edit',
    item: 'Slide Creation Prompt',
    title: 'Write slides with an AI agent',
    text: 'Edit → Slide Creation Prompt gives you a prompt that has an AI agent write a whole presentation in this format. Copy it, fill in the topic, then open the folder the agent writes.',
  },
  {
    target: '.menu-help',
    item: 'Personalize your editor',
    title: 'Make the editor yours',
    text: 'Help → Personalize your editor shows how to change its colours, fonts, slide layouts and shortcuts, yourself or with an AI agent.',
  },
];

// Survives the reload that switching back to the sample needs.
const TOUR_KEY = 'presentation-editor:tour';
// Set once the tour has been finished or skipped in this browser.
const SEEN_KEY = 'presentation-editor:tour-seen';
// Set once the welcome on the empty hosted editor has been finished or skipped.
const WELCOME_KEY = 'presentation-editor:welcome-seen';
const seen = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Storage blocked: it may show again next time.
  }
};
export const queueTour = () => {
  try {
    sessionStorage.setItem(TOUR_KEY, '1');
  } catch {
    // Storage blocked: the tour simply doesn't start after a reload.
  }
};
const takeQueued = () => {
  try {
    const queued = sessionStorage.getItem(TOUR_KEY) === '1';
    sessionStorage.removeItem(TOUR_KEY);
    return queued;
  } catch {
    return false;
  }
};

// `item` opens the target menu and lights up that entry. `before` sets the page up for the step, such as opening
// the Open modal; its target may only exist once it has run. `centre` puts the card in the middle of the target.
type Step = { target: string; item?: string; before?: () => void; centre?: boolean; title: string; text: string };
type Walkthrough = {
  label: string;
  steps: Step[];
  seenKey: string;
  skip: string;
  // The last step's button: Done, or an action that ends the walkthrough by doing something.
  finish?: { label: string; run: () => void };
  onEnd?: () => void;
};

const visible = (el: HTMLElement | null): el is HTMLElement =>
  el !== null && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

const setMenu = (menu: HTMLElement, open: boolean) => {
  const button = menu.querySelector<HTMLElement>('.menu-button');
  if (button && (button.getAttribute('aria-expanded') === 'true') !== open) button.click();
};

const run = ({ label, steps: all, seenKey, skip, finish, onEnd }: Walkthrough) => {
  const steps = all.filter(
    (step) => step.before !== undefined || visible(document.querySelector<HTMLElement>(step.target)),
  );
  if (!steps.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'tour';
  dialog.setAttribute('aria-label', label);
  dialog.innerHTML = `
    <div class="tour-spot"></div>
    <div class="tour-card" role="document">
      <p class="tour-count"></p>
      <h2 class="tour-title"></h2>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button class="od-link tour-skip"></button>
        <button class="primary tour-next"></button>
      </div>
    </div>`;
  if (reduceMotion) dialog.classList.add('still');
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  $('.tour-skip').textContent = skip;
  const spot = $('.tour-spot');
  const card = $('.tour-card');
  let at = 0;
  let target: HTMLElement = document.body;
  let centre = false;
  const closeMenus = () => {
    for (const step of steps) {
      const menu = step.item ? document.querySelector<HTMLElement>(step.target) : null;
      if (menu) setMenu(menu, false);
    }
  };
  const lit = (step: Step) => {
    if (step.before) {
      step.before();
      // Anything the step opened as a modal now sits above the walkthrough; bring the walkthrough back on top.
      dialog.close();
      dialog.showModal();
    }
    const el = document.querySelector<HTMLElement>(step.target) ?? document.body;
    if (!step.item) return el;
    setMenu(el, true);
    return [...el.querySelectorAll<HTMLElement>('.menu-list button')].find((b) => b.textContent === step.item) ?? el;
  };

  // The card goes beside the lit part: to its right if there is room, else below it, else above it, and always
  // inside the window. A large part, such as the slide, keeps the card inside its top-left corner instead.
  const place = () => {
    const r = target.getBoundingClientRect();
    const large = r.width > innerWidth * 0.4 && r.height > innerHeight * 0.4;
    // The ring sits just inside large parts, which reach the window's edges, and just outside small ones.
    const pad = large ? 6 : -6;
    Object.assign(spot.style, {
      left: `${r.left + pad}px`,
      top: `${r.top + pad}px`,
      width: `${r.width - pad * 2}px`,
      height: `${r.height - pad * 2}px`,
    });
    const gap = 14;
    const right = r.right + gap + card.offsetWidth < innerWidth - 8;
    const below = r.bottom + gap + card.offsetHeight < innerHeight - 8;
    let left = r.left + 16;
    let top = below ? r.bottom + gap : r.top - gap - card.offsetHeight;
    if (centre) {
      left = r.left + (r.width - card.offsetWidth) / 2;
      top = r.top + (r.height - card.offsetHeight) / 2;
    } else if (large) {
      left = r.left + 24;
      top = r.top + 24;
    } else if (right) {
      left = r.right + gap;
      top = r.top + 24;
    }
    card.style.left = `${Math.max(8, Math.min(left, innerWidth - card.offsetWidth - 8))}px`;
    card.style.top = `${Math.max(8, Math.min(top, innerHeight - card.offsetHeight - 8))}px`;
  };
  const last = () => at === steps.length - 1;
  const fill = () => {
    const step = steps[at];
    $('.tour-count').textContent = `${at + 1} of ${steps.length}`;
    $('.tour-title').textContent = step.title;
    $('.tour-text').textContent = step.text;
    $('.tour-next').textContent = last() ? (finish?.label ?? 'Done') : 'Next';
    closeMenus();
    target = lit(step);
    centre = step.centre === true;
    place();
    $('.tour-next').focus();
  };
  // Times match the card's fade and the ring's glide in app.css.
  let moving = false;
  const next = () => {
    if (reduceMotion) {
      fill();
      return;
    }
    moving = true;
    card.classList.add('moving');
    setTimeout(() => {
      fill();
      setTimeout(() => {
        card.classList.remove('moving');
        moving = false;
      }, 350);
    }, 150);
  };
  const end = () => {
    closeMenus();
    markSeen(seenKey);
    removeEventListener('resize', place);
    dialog.close();
    dialog.remove();
    onEnd?.();
  };

  $('.tour-next').addEventListener('click', () => {
    if (moving) return;
    if (!last()) {
      at += 1;
      next();
      return;
    }
    end();
    finish?.run();
  });
  $('.tour-skip').addEventListener('click', end);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    end();
  });
  addEventListener('resize', place);
  dialog.showModal();
  fill();
};

export const startTour = () => {
  run({ label: 'Tour of the editor', steps: STEPS, seenKey: SEEN_KEY, skip: 'Skip tour' });
};

// Starts the tour if "Try the sample" queued it (before a reload, if one was needed) and it hasn't been seen.
export const startQueuedTour = () => {
  if (takeQueued() && !seen(SEEN_KEY)) requestAnimationFrame(startTour);
};

// The first time the hosted editor opens empty: what the viewer is looking at, the ways to open a presentation, and
// an offer to try the sample. Separate from the tour and shown once per browser; nothing in the menus starts it.
type OpenDialog = {
  show: () => void;
  hide: () => void;
  showSection: (name: string | null) => void;
  trySample: () => void;
};
export const startWelcome = (open: OpenDialog) => {
  if (seen(WELCOME_KEY)) {
    open.show();
    return;
  }
  const inOpen = (section: string | null) => () => {
    open.show();
    open.showSection(section);
  };
  run({
    label: 'Welcome to Presentation Editor',
    seenKey: WELCOME_KEY,
    skip: 'Skip',
    finish: { label: 'Try the sample', run: open.trySample },
    onEnd: () => {
      open.show();
    },
    steps: [
      {
        target: '.app',
        before: open.hide,
        centre: true,
        title: 'Welcome to Presentation Editor',
        text: 'A slide editor for presentations kept as plain HTML files. Slides go on the left, the current slide in the middle and its animation steps below. Grey shapes hold their places until a presentation is open.',
      },
      {
        target: '.open-dialog .od-drop',
        before: inOpen(null),
        title: 'Open a presentation',
        text: "A presentation is a folder of numbered HTML slides. Drop it here or choose it; it's read in your browser and never uploaded.",
      },
      {
        target: '.open-dialog .od-tab[data-section="create"]',
        before: inOpen(null),
        title: 'No presentation yet?',
        text: 'An AI agent can write one for you. This tab has the prompt to give it.',
      },
      {
        target: '.open-dialog .od-section[data-section="sample"]',
        before: inOpen('sample'),
        title: 'Start with the sample',
        text: 'See the editor at work on five sample slides, followed by a short tour of the editor.',
      },
    ],
  });
};
