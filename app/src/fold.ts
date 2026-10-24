import { gsap } from 'gsap';
import { reduceMotion } from './player.ts';

// Folding a pane away or back. The box shrinks into the corner where its switch waits once it is folded (top left
// for the slide list, bottom left for the animation list) while the space it took closes up, so the slide grows
// smoothly. The hide-* class flips at once; folding-* keeps the pane drawn until it has folded away.

type Pane = { part: string; el: HTMLElement; axis: 'width' | 'height' };
type Box = { w: number; h: number; margin: number; pad: number };
const SWITCH = 34;
const DURATION = 0.45;
const running = new Map<string, { tween: gsap.core.Tween; t: { open: number }; box: Box }>();

const draw = ({ el, axis }: Pane, box: Box, open: number) => {
  const size = (axis === 'width' ? box.w : box.h) * open;
  const w = axis === 'width' ? size : box.w;
  const h = axis === 'height' ? size : box.h;
  // What still shows: a corner square, the size of the switch, that grows into the whole box.
  const cutW = Math.max(0, w - (SWITCH + (box.w - SWITCH) * open));
  const cutH = Math.max(0, h - (SWITCH + (box.h - SWITCH) * open));
  const edge = `${box.margin * open}px`;
  const pad = `${box.pad * open}px`;
  Object.assign(
    el.style,
    { overflow: 'hidden', opacity: String(Math.min(1, open * 3)), [axis]: `${size}px` },
    axis === 'width'
      ? { clipPath: `inset(0 ${cutW}px ${cutH}px 0 round 12px)`, marginLeft: edge, paddingLeft: pad, paddingRight: pad }
      : {
          clipPath: `inset(${cutH}px ${cutW}px 0 0 round 12px)`,
          marginBottom: edge,
          paddingTop: pad,
          paddingBottom: pad,
        },
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
    ease: 'power3.inOut',
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
