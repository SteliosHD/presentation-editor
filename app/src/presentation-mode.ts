import { gsap } from 'gsap';
import { createElement, X } from 'lucide';
import { must, reduceMotion } from './player.ts';
import { mainKey } from './shortcuts.ts';

// Presentation mode (F): only the slide, filling the browser window (not the Mac's own fullscreen, which would
// pull the notes window into its space). F again, Esc, or the X that appears at the bottom centre brings back
// the rest. On entry, a hint drops in at the top centre for a few seconds.
export const createPresentationMode = ({ onChange }: { onChange: (presenting: boolean) => void }) => {
  const active = () => document.body.classList.contains('presenting');

  const hintEl = must(document.querySelector('.present-hint'), '.present-hint');
  must(hintEl.querySelector('kbd'), '.present-hint kbd').textContent = mainKey('present');
  let hint: gsap.core.Timeline | null = null;
  const showHint = (on: boolean) => {
    hint?.kill();
    if (!on) {
      gsap.set(hintEl, { autoAlpha: 0 });
      return;
    }
    const d = reduceMotion ? 0 : 0.4;
    hint = gsap
      .timeline()
      .fromTo(hintEl, { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: d, ease: 'power2.out' })
      .to(hintEl, { autoAlpha: 0, y: -16, duration: d, ease: 'power2.in' }, '+=3');
  };

  const set = (on: boolean) => {
    document.body.classList.toggle('presenting', on);
    showHint(on);
    onChange(on);
  };
  const toggle = () => {
    set(!active());
  };

  const exitButton = must(document.querySelector('.exit-present'), '.exit-present');
  exitButton.append(createElement(X, { width: 20, height: 20 }));
  exitButton.addEventListener('click', toggle);

  return { active, toggle };
};
