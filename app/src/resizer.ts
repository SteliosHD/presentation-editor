// Drag handles for the slide list's right edge and the animation list's top edge. Each size stays within limits,
// is remembered between visits, and goes back to the default on a double-click. Arrow keys resize a focused handle.

type Options = {
  // The element whose size changes, and where the handle goes.
  target: HTMLElement;
  edge: 'right' | 'top';
  // Tells apart handles on the same element (the animation list's and the notes'), as a resize-<name> class.
  name?: string;
  // A CSS custom property on <body> that the stylesheet reads, falling back to its own default.
  property: string;
  key: string;
  min: number;
  max: () => number;
  label: string;
};

export const makeResizable = ({ target, edge, name, property, key, min, max, label }: Options) => {
  const vertical = edge === 'right';
  const handle = document.createElement('div');
  handle.className = `resize-handle resize-${edge}${name ? ` resize-${name}` : ''}`;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
  handle.setAttribute('aria-label', label);
  handle.title = 'Drag to resize, double-click to reset';
  handle.tabIndex = 0;
  if (vertical) target.after(handle);
  else target.before(handle);

  const size = () => (vertical ? target.offsetWidth : target.offsetHeight);
  const clamp = (n: number) => Math.round(Math.max(min, Math.min(max(), n)));
  const apply = (n: number | null) => {
    if (n === null) document.body.style.removeProperty(property);
    else document.body.style.setProperty(property, `${clamp(n)}px`);
  };
  const set = (n: number | null) => {
    apply(n);
    try {
      if (n === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(clamp(n)));
    } catch {
      // Storage blocked: the size holds for this visit.
    }
  };
  try {
    const saved = Number(localStorage.getItem(key));
    if (saved) apply(saved);
  } catch {
    // Storage blocked: start at the default size.
  }

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add(vertical ? 'resizing-x' : 'resizing-y');
    const box = target.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      set(vertical ? ev.clientX - box.left : box.bottom - ev.clientY);
    };
    const up = () => {
      document.body.classList.remove('resizing-x', 'resizing-y');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  handle.addEventListener('dblclick', () => {
    set(null);
  });
  handle.addEventListener('keydown', (e) => {
    const grow = vertical ? 'ArrowRight' : 'ArrowUp';
    const shrink = vertical ? 'ArrowLeft' : 'ArrowDown';
    if (e.key !== grow && e.key !== shrink) return;
    e.preventDefault();
    e.stopPropagation();
    set(size() + (e.key === grow ? 20 : -20));
  });
};
