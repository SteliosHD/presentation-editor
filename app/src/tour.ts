import { must, reduceMotion } from './player.ts';

// A short tour of the editor: four steps, each lighting up one part of the editor with a card beside it. Skip,
// Esc or Done ends it, and it is then remembered so "Try the sample" doesn't start it again; Help → Take the tour
// always does. Parts hidden at the current size are left out.

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
];

// Survives the reload that switching back to the sample needs.
const TOUR_KEY = 'presentation-editor:tour';
// Set once the tour has been finished or skipped in this browser.
const SEEN_KEY = 'presentation-editor:tour-seen';
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

type Step = (typeof STEPS)[number] & { el: HTMLElement };

const visible = (el: HTMLElement | null): el is HTMLElement =>
  el !== null && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

export const startTour = () => {
  const steps = STEPS.map((step) => ({ ...step, el: document.querySelector<HTMLElement>(step.target) })).filter(
    (step): step is Step => visible(step.el),
  );
  if (!steps.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'tour';
  dialog.setAttribute('aria-label', 'Tour of the editor');
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

  // The card goes beside the lit part: to its right if there is room, else below it, else above it, and always
  // inside the window. A large part, such as the slide, keeps the card inside its top-left corner instead.
  const place = () => {
    const r = steps[at].el.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, {
      left: `${r.left + pad}px`,
      top: `${r.top + pad}px`,
      width: `${r.width - pad * 2}px`,
      height: `${r.height - pad * 2}px`,
    });
    const gap = 14;
    const right = r.right + gap + card.offsetWidth < innerWidth - 8;
    const below = r.bottom + gap + card.offsetHeight < innerHeight - 8;
    const large = r.width > innerWidth * 0.4 && r.height > innerHeight * 0.4;
    const left = large ? r.left + 24 : right ? r.right + gap : r.left + 16;
    const top = large ? r.top + 24 : right ? r.top + 24 : below ? r.bottom + gap : r.top - gap - card.offsetHeight;
    card.style.left = `${Math.max(8, Math.min(left, innerWidth - card.offsetWidth - 8))}px`;
    card.style.top = `${Math.max(8, Math.min(top, innerHeight - card.offsetHeight - 8))}px`;
  };
  const show = () => {
    const step = steps[at];
    $('.tour-count').textContent = `${at + 1} of ${steps.length}`;
    $('.tour-title').textContent = step.title;
    $('.tour-text').textContent = step.text;
    $('.tour-next').textContent = at === steps.length - 1 ? 'Done' : 'Next';
    place();
    $('.tour-next').focus();
  };
  const end = () => {
    markSeen();
    removeEventListener('resize', place);
    dialog.close();
    dialog.remove();
  };

  $('.tour-next').addEventListener('click', () => {
    if (at === steps.length - 1) {
      end();
      return;
    }
    at += 1;
    show();
  });
  $('.tour-skip').addEventListener('click', end);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    end();
  });
  addEventListener('resize', place);
  dialog.showModal();
  show();
};

// Starts the tour if "Try the sample" queued it (before a reload, if one was needed) and it hasn't been seen.
export const startQueuedTour = () => {
  if (takeQueued() && !seen()) requestAnimationFrame(startTour);
};
