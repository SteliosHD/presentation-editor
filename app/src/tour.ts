import { must, reduceMotion } from './player.ts';

// A short tour of the viewer: each step lights up one part of the viewer with a card beside it. The last steps open
// a menu and light up one of its items. Skip, Esc or Done ends it, and it is then remembered so "Try the sample"
// doesn't start it again; Help → Take the tour always does. Parts hidden at the current size are left out.

const STEPS: Step[] = [
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
    item: 'Personalize your viewer',
    title: 'Make the viewer yours',
    text: 'Help → Personalize your viewer shows how to change its colours, fonts, slide layouts and shortcuts, yourself or with an AI agent.',
  },
];

// Survives the reload that switching back to the sample needs.
const TOUR_KEY = 'presentation-viewer:tour';
// Set once the tour has been finished or skipped in this browser.
const SEEN_KEY = 'presentation-viewer:tour-seen';
const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage blocked: the tour may show again next time.
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

// `item` opens the target menu and lights up that entry.
type Step = { target: string; item?: string; title: string; text: string };
const visible = (el: HTMLElement | null): el is HTMLElement =>
  el !== null && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

const setMenu = (menu: HTMLElement, open: boolean) => {
  const button = menu.querySelector<HTMLElement>('.menu-button');
  if (button && (button.getAttribute('aria-expanded') === 'true') !== open) button.click();
};

export const startTour = () => {
  const steps = STEPS.filter((step) => visible(document.querySelector<HTMLElement>(step.target)));
  if (!steps.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'tour';
  dialog.setAttribute('aria-label', 'Tour of the viewer');
  dialog.innerHTML = `
    <div class="tour-spot"></div>
    <div class="tour-card" role="document">
      <p class="tour-count"></p>
      <h2 class="tour-title"></h2>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button class="od-link tour-skip">Skip tour</button>
        <button class="primary tour-next"></button>
      </div>
    </div>`;
  if (reduceMotion) dialog.classList.add('still');
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  const spot = $('.tour-spot');
  const card = $('.tour-card');
  let at = 0;
  let target: HTMLElement = document.body;
  const closeMenus = () => {
    for (const step of steps) {
      const menu = step.item ? document.querySelector<HTMLElement>(step.target) : null;
      if (menu) setMenu(menu, false);
    }
  };
  const lit = (step: Step) => {
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
    // The ring sits just inside large parts and just outside small ones, but never past the window's edges.
    const pad = large ? 6 : -6;
    const edge = 3;
    const ring = {
      left: Math.max(edge, r.left + pad),
      top: Math.max(edge, r.top + pad),
      right: Math.min(innerWidth - edge, r.right - pad),
      bottom: Math.min(innerHeight - edge, r.bottom - pad),
    };
    Object.assign(spot.style, {
      left: `${ring.left}px`,
      top: `${ring.top}px`,
      width: `${ring.right - ring.left}px`,
      height: `${ring.bottom - ring.top}px`,
    });
    const gap = 14;
    const right = r.right + gap + card.offsetWidth < innerWidth - 8;
    const below = r.bottom + gap + card.offsetHeight < innerHeight - 8;
    let left = r.left + 16;
    let top = below ? r.bottom + gap : r.top - gap - card.offsetHeight;
    if (large) {
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
    $('.tour-next').textContent = last() ? 'Done' : 'Next';
    closeMenus();
    target = lit(step);
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
    markSeen();
    removeEventListener('resize', place);
    dialog.close();
    dialog.remove();
  };

  $('.tour-next').addEventListener('click', () => {
    if (moving) return;
    if (!last()) {
      at += 1;
      next();
      return;
    }
    end();
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

// Starts the tour if "Try the sample" queued it (before a reload, if one was needed) and it hasn't been seen.
export const startQueuedTour = () => {
  if (takeQueued() && !seen()) requestAnimationFrame(startTour);
};
