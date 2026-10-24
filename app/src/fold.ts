import { gsap } from 'gsap';
import { reduceMotion } from './player.ts';

// Folding a pane away or back, like an editor's sidebar: the slide list slides out to the left and the animation
// list down, while the space each took closes up, so the slide grows smoothly. The hide-* class flips at once;
// folding-* keeps the pane drawn until it has gone.

// `rest`: the space the pane leaves once folded (the animation list leaves room for its switch under the counter).
type Pane = { part: string; el: HTMLElement; axis: 'width' | 'height'; rest?: number };
type Box = { w: number; h: number; margin: number; pad: number };
const DURATION = 0.4;
const running = new Map<string, { tween: gsap.core.Tween; t: { open: number }; box: Box }>();

const draw = ({ el, axis, rest = 0 }: Pane, box: Box, open: number) => {
  const full = axis === 'width' ? box.w : box.h;
  const size = full * open;
  const pad = `${Math.min(box.pad, size / 2)}px`;
  const edge = `${box.margin * open + rest * (1 - open)}px`;
  // The slide list's contents move left with its closing edge, so it slides out rather than being cut off. The
  // animation list's top edge is the one that moves, and it carries the contents down with it.
  if (axis === 'width') el.style.setProperty('--fold-shift', `${size - full}px`);
  Object.assign(
    el.style,
    { overflow: 'hidden', [axis]: `${size}px` },
    axis === 'width'
      ? { marginLeft: edge, paddingLeft: pad, paddingRight: pad }
      : { marginBottom: edge, paddingTop: pad, paddingBottom: pad },
  );
};

const measure = ({ el, axis }: Pane): Box => {
  const style = getComputedStyle(el);
  return {
    w: el.offsetWidth,
    h: el.offsetHeight,
    margin: parseFloat(axis === 'width' ? style.marginLeft : style.marginBottom),
    pad: parseFloat(axis === 'width' ? style.paddingLeft : style.paddingTop),
  };
};

export const fold = (pane: Pane, show: boolean) => {
  const { part, el } = pane;
  const before = running.get(part);
  before?.tween.kill();
  if (reduceMotion) {
    el.style.cssText = '';
    return;
  }
  document.body.classList.add(`folding-${part}`);
  // The open box's size, measured with nothing of the fold applied, unless a fold is already under way.
  if (!before) el.style.cssText = '';
  const box = before?.box ?? measure(pane);
  const t = before?.t ?? { open: show ? 0 : 1 };
  draw(pane, box, t.open);
  const tween = gsap.to(t, {
    open: show ? 1 : 0,
    duration: DURATION * Math.abs(Number(show) - t.open),
    ease: 'power2.inOut',
    onUpdate: () => {
      draw(pane, box, t.open);
    },
    onComplete: () => {
      running.delete(part);
      el.style.cssText = '';
      document.body.classList.remove(`folding-${part}`);
    },
  });
  running.set(part, { tween, t, box });
};
