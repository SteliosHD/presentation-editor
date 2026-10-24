import { gsap } from 'gsap';
import { ArrowRight, createElement, X } from 'lucide';
import { must, reduceMotion } from './player.ts';

// The first time the hosted viewer opens empty: one card saying what the app is, with a short animation of a folder's
// files becoming a slide. Closing it, however it closes, moves on to the Open modal; it is then remembered in this
// browser and never shows again. Nothing in the menus opens it.

const SEEN_KEY = 'presentation-viewer:welcome-seen';
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
    // Storage blocked: the welcome may show again next time.
  }
};

export const showWelcome = (then: () => void) => {
  if (seen()) {
    then();
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'modal welcome-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header><h2>Welcome to Presentation Viewer</h2><button class="modal-close" aria-label="Close"></button></header>
      <div class="welcome-art" aria-hidden="true">
        <ul class="welcome-files">
          <li>01-title.html</li>
          <li>02-agenda.html</li>
          <li class="welcome-anim">02-agenda.ts</li>
        </ul>
        <span class="welcome-arrow"></span>
        <div class="welcome-slide">
          <i class="welcome-kicker"></i><i class="welcome-title"></i><i class="welcome-title short"></i>
          <div class="welcome-row"><i></i><i></i><i></i></div>
        </div>
      </div>
      <p class="modal-lead">Slides as plain files. A presentation is a folder of numbered HTML slides, each with an
      optional GSAP animation, so any text editor or AI agent can write it. Open the folder here to see every slide and
      animation step, present it, and export it as one HTML file or a PDF.</p>
      <div class="modal-foot"><button class="primary welcome-start" autofocus>Get started</button></div>
    </div>`;
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  $('.modal-close').append(createElement(X, { width: 18, height: 18 }));
  $('.welcome-arrow').append(createElement(ArrowRight, { width: 20, height: 20 }));

  dialog.addEventListener('close', () => {
    markSeen();
    dialog.remove();
    then();
  });
  for (const sel of ['.modal-close', '.welcome-start']) {
    $(sel).addEventListener('click', () => {
      dialog.close();
    });
  }
  dialog.showModal();

  if (reduceMotion) return;
  const slide = $('.welcome-slide');
  gsap
    .timeline({ delay: 0.2, defaults: { ease: 'power2.out', duration: 0.4 } })
    .from(dialog.querySelectorAll('.welcome-files li'), { x: -12, autoAlpha: 0, stagger: 0.18 })
    .from($('.welcome-arrow'), { x: -8, autoAlpha: 0, duration: 0.3 }, '-=0.1')
    .from(slide, { scale: 0.92, autoAlpha: 0, duration: 0.45 })
    .from(slide.querySelectorAll(':scope > i'), { y: 8, autoAlpha: 0, stagger: 0.1, duration: 0.35 }, '-=0.15')
    .from(
      slide.querySelectorAll('.welcome-row i'),
      { y: 10, autoAlpha: 0, stagger: 0.08, ease: 'back.out(1.6)' },
      '-=0.1',
    );
};
