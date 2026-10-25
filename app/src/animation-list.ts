import { createElement, RotateCcw } from 'lucide';
import { gsap } from 'gsap';
import type { Presentation } from 'virtual:presentation';
import { animationPrefs } from './animation-prefs.ts';
import { describeAnimation, playStep, type Step } from './animations.ts';
import { must, reduceMotion, type Player } from './player.ts';

// At the bottom of the slide area: every step of the current slide's animation, one per row, read from GSAP. The
// step that is running lights up; Replay plays the whole animation again, and clicking a step plays just that one.
// Rows read as plain sentences unless Show technical details is on in the menu's Animations settings.
export const createAnimationList = (
  presentation: Presentation,
  player: Player,
  { empty = false, onPlay = () => {} }: { empty?: boolean; onPlay?: () => void } = {},
) => {
  const strip = document.createElement('div');
  strip.className = 'anim-strip';
  must(document.querySelector('.stage'), '.stage').append(strip);

  const el = (tag: string, className: string, text: string) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };

  // Each frame, the rows whose step is running light up. A step played on its own lights while it plays.
  let steps: Step[] = [];
  let rows: HTMLElement[] = [];
  let solo: { step: Step; driver: gsap.core.Animation } | null = null;
  gsap.ticker.add(() => {
    if (solo && !solo.driver.isActive()) solo = null;
    let lit: HTMLElement | undefined;
    steps.forEach((step, k) => {
      const row = rows[k];
      const now = solo ? solo.step === step : step.tween.isActive();
      if (now && !row.classList.contains('now')) lit = row;
      row.classList.toggle('now', now);
    });
    if (lit) follow(lit);
  });
  // A step that lights up out of view scrolls into it, below the head that stays at the top.
  const follow = (row: HTMLElement) => {
    const box = strip.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const top = box.top + (strip.querySelector('.strip-head')?.getBoundingClientRect().height ?? 0);
    const by = r.top < top ? r.top - top - 4 : r.bottom > box.bottom - 10 ? r.bottom - box.bottom + 10 : 0;
    if (by) strip.scrollBy({ top: by, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  // Rebuilt only when the slide, its animation or the details setting changes, so other redraws (a tool switched
  // on, say) leave a lit row alone.
  let shown: { current: number; animation: gsap.core.Animation | null; details: boolean } | null = null;
  // Kept across rebuilds, for controls placed in the head from outside (the list's fold switch).
  const actions = el('span', 'strip-actions', '');
  const render = (current: number) => {
    const { details } = animationPrefs.get();
    const animation = player.entrance();
    if (shown && shown.current === current && shown.animation === animation && shown.details === details) return;
    shown = { current, animation, details };
    solo = null;
    if (empty) {
      const head = el('div', 'strip-head', '');
      head.append(el('span', 'strip-title', 'Animations'), actions);
      strip.replaceChildren(head, el('p', 'strip-empty', "Open a presentation to see each slide's animation steps."));
      return;
    }
    const slide = presentation.slides[current];
    const source = details
      ? slide.animationFile
        ? `custom · ${slide.animationFile}`
        : 'default entrance'
      : slide.animationFile
        ? 'Custom animation'
        : 'Standard entrance';
    steps = animation ? describeAnimation(animation) : [];
    rows = steps.map((step, n) => {
      const row = el('button', 'anim-step', '');
      row.title = step.label ? `${step.change}. Click to play this step.` : 'Click to play this step.';
      const icons = el('span', 'anim-step-icons', '');
      for (const { icon, label } of step.icons) {
        const wrap = el('span', '', '');
        wrap.title = label;
        wrap.append(createElement(icon, { width: 15, height: 15, 'aria-label': label }));
        icons.append(wrap);
      }
      if (details)
        row.append(
          el('span', 'anim-step-n', `${n + 1}`),
          icons,
          el('span', 'anim-step-when', step.when),
          el('b', 'anim-step-targets', step.targets),
          el('span', 'anim-step-change', step.label || step.change),
          el('span', 'anim-step-ease', step.ease),
        );
      else {
        row.classList.add('plain');
        row.append(
          el('span', 'anim-step-n', `${n + 1}`),
          icons,
          el('span', 'anim-step-plain', step.plain),
          el('span', 'anim-step-plain-when', step.plainWhen),
        );
      }
      row.addEventListener('click', () => {
        if (!animation) return;
        onPlay();
        solo = { step, driver: playStep(animation, step) };
      });
      return row;
    });
    const ol = document.createElement('ol');
    ol.append(
      ...rows.map((row) => {
        const li = document.createElement('li');
        li.append(row);
        return li;
      }),
    );
    if (reduceMotion) ol.append(el('li', 'strip-empty', 'Off: reduced motion is on'));
    const head = el('div', 'strip-head', '');
    head.append(el('span', 'strip-title', 'Animations'), el('span', 'strip-source', source));
    if (animation) {
      const replay = el('button', 'strip-replay', 'Replay');
      replay.title = "Play this slide's animation again";
      replay.prepend(createElement(RotateCcw, { width: 13, height: 13, 'aria-hidden': 'true' }));
      replay.addEventListener('click', () => {
        solo = null;
        onPlay();
        animation.restart();
      });
      head.append(replay);
    }
    head.append(actions);
    strip.replaceChildren(head, ol);
  };
  animationPrefs.onChange(() => {
    if (shown) render(shown.current);
  });
  return { strip, render };
};
