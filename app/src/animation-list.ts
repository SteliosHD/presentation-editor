import { createElement } from 'lucide';
import type { Presentation } from 'virtual:presentation';
import { describeAnimation } from './animations.ts';
import { must, reduceMotion, type Player } from './player.ts';

// At the bottom of the slide area: every step of the current slide's animation, one per row, read from GSAP.
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

  return {
    render: (current: number) => {
      if (empty) {
        const head = el('div', 'strip-head', '');
        head.append(el('span', 'strip-title', 'Animations'));
        strip.replaceChildren(head, el('p', 'strip-empty', "Open a presentation to see each slide's animation steps."));
        return;
      }
      const slide = presentation.slides[current];
      const source = slide.animationFile ? `custom · ${slide.animationFile}` : 'default entrance';
      const animation = player.entrance();
      const rows = (animation ? describeAnimation(animation) : []).map((step, n) => {
        const li = el('li', 'anim-step', '');
        const icons = el('span', 'anim-step-icons', '');
        for (const { icon, label } of step.icons) {
          const wrap = el('span', '', '');
          wrap.title = label;
          wrap.append(createElement(icon, { width: 15, height: 15, 'aria-label': label }));
          icons.append(wrap);
        }
        if (step.label) li.title = step.change;
        li.append(
          el('span', 'anim-step-n', `${n + 1}`),
          icons,
          el('span', 'anim-step-when', step.when),
          el('b', 'anim-step-targets', step.targets),
          el('span', 'anim-step-change', step.label || step.change),
          el('span', 'anim-step-ease', step.ease),
        );
        return li;
      });
      if (reduceMotion) rows.push(el('li', 'anim-step', 'Off: reduced motion is on'));
      const ol = document.createElement('ol');
      ol.append(...rows);
      const head = el('div', 'strip-head', '');
      head.append(el('span', 'strip-title', 'Animations'), el('span', 'strip-source', source));
      strip.replaceChildren(head, ol);
    },
  };
};
