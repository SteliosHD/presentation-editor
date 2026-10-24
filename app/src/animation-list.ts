import { createElement, RotateCcw } from 'lucide';
import { gsap } from 'gsap';
import type { Presentation } from 'virtual:presentation';
import { describeAnimation, playStep, type Step } from './animations.ts';
import { must, reduceMotion, type Player } from './player.ts';

// At the bottom of the slide area: every step of the current slide's animation, one per row, read from GSAP. The
// step that is running lights up; Replay plays the whole animation again, and clicking a step plays just that one.
export const createAnimationList = (presentation: Presentation, player: Player, { empty = false } = {}) => {
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
    steps.forEach((step, k) => rows[k]?.classList.toggle('now', solo ? solo.step === step : step.tween.isActive()));
  });

  return {
    render: (current: number) => {
      solo = null;
      if (empty) {
        const head = el('div', 'strip-head', '');
        head.append(el('span', 'strip-title', 'Animations'));
        strip.replaceChildren(head, el('p', 'strip-empty', "Open a presentation to see each slide's animation steps."));
        return;
      }
      const slide = presentation.slides[current];
      const source = slide.animationFile ? `custom · ${slide.animationFile}` : 'default entrance';
      const animation = player.entrance();
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
        row.append(
          el('span', 'anim-step-n', `${n + 1}`),
          icons,
          el('span', 'anim-step-when', step.when),
          el('b', 'anim-step-targets', step.targets),
          el('span', 'anim-step-change', step.label || step.change),
          el('span', 'anim-step-ease', step.ease),
        );
        row.addEventListener('click', () => {
          if (animation) solo = { step, driver: playStep(animation, step) };
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
          animation.restart();
        });
        head.append(replay);
      }
      strip.replaceChildren(head, ol);
    },
  };
};
