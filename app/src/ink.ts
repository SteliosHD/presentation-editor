import { BrushCleaning, createElement, Eraser, Highlighter, Pencil, type IconNode } from 'lucide';
import { must } from './player.ts';

// Drawing over the slide in presentation mode. The ink sits on a 1200x675 layer scaled exactly like the slide,
// so strokes stay put when the window resizes. A stroke is drawn on a live layer first and merged when it ends,
// which keeps a highlighter stroke evenly see-through.

type Tool = 'pen' | 'highlighter' | 'eraser';
type Point = { x: number; y: number };

const TOOLS: [Tool, IconNode, string][] = [
  ['pen', Pencil, 'Pen (D)'],
  ['highlighter', Highlighter, 'Highlighter'],
  ['eraser', Eraser, 'Eraser'],
];
// Theme tokens, named by role since the theme decides the actual colours.
const COLOURS: [string, string][] = [
  ['--accent', 'Accent'],
  ['--bad', 'Alert'],
  ['--warn', 'Warning'],
  ['--good', 'Good'],
  ['--text', 'Text'],
];
const WIDTH: Record<Tool, number> = { pen: 4, highlighter: 24, eraser: 40 };
const HIGHLIGHT_ALPHA = 0.35;
const RES = 2; // canvas pixels per slide pixel, so ink stays sharp when the slide is scaled up

export const createInk = (stack: HTMLElement) => {
  const layer = document.createElement('div');
  layer.className = 'ink';
  const [ink, live] = [document.createElement('canvas'), document.createElement('canvas')];
  for (const canvas of [ink, live]) {
    canvas.width = 1200 * RES;
    canvas.height = 675 * RES;
  }
  layer.append(ink, live);
  stack.append(layer);
  const inkCtx = must(ink.getContext('2d'), 'ink context');
  const liveCtx = must(live.getContext('2d'), 'live ink context');
  for (const ctx of [inkCtx, liveCtx]) ctx.scale(RES, RES);

  let tool: Tool | null = null;
  let colour = COLOURS[0][0];
  let stroke: Point[] = [];
  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const tracePath = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const toSlide = (e: PointerEvent): Point => {
    const r = layer.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 1200) / r.width, y: ((e.clientY - r.top) * 675) / r.height };
  };

  layer.addEventListener('pointerdown', (e) => {
    if (!tool) return;
    layer.setPointerCapture(e.pointerId);
    stroke = [toSlide(e)];
    draw();
  });
  layer.addEventListener('pointermove', (e) => {
    if (!stroke.length) return;
    stroke.push(toSlide(e));
    draw();
  });
  const end = () => {
    if (!stroke.length) return;
    if (tool !== 'eraser') {
      inkCtx.globalAlpha = tool === 'highlighter' ? HIGHLIGHT_ALPHA : 1;
      inkCtx.drawImage(live, 0, 0, 1200, 675);
      inkCtx.globalAlpha = 1;
    }
    liveCtx.clearRect(0, 0, 1200, 675);
    stroke = [];
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  const draw = () => {
    if (!tool) return;
    if (tool === 'eraser') {
      inkCtx.globalCompositeOperation = 'destination-out';
      inkCtx.lineWidth = WIDTH.eraser;
      tracePath(inkCtx, stroke.slice(-2));
      inkCtx.globalCompositeOperation = 'source-over';
      return;
    }
    live.style.opacity = tool === 'highlighter' ? String(HIGHLIGHT_ALPHA) : '1';
    liveCtx.clearRect(0, 0, 1200, 675);
    liveCtx.strokeStyle = token(colour);
    liveCtx.lineWidth = WIDTH[tool];
    tracePath(liveCtx, stroke);
  };

  // The toolbar: a column on the left edge, shown when the mouse reaches it or while a tool is in use.
  const zone = document.createElement('div');
  zone.className = 'ink-zone';
  const bar = document.createElement('div');
  bar.className = 'ink-tools';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Drawing tools');
  zone.append(bar);
  document.body.append(zone);

  const button = (icon: IconNode, label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(createElement(icon, { width: 18, height: 18 }));
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    b.addEventListener('click', onClick);
    bar.append(b);
    return b;
  };
  const toolButtons = TOOLS.map(([name, icon, label]) => {
    const b = button(icon, label, () => {
      select(tool === name ? null : name);
    });
    return [name, b] as const;
  });
  const swatches = COLOURS.map(([name, label]) => {
    const b = document.createElement('button');
    b.className = 'ink-swatch';
    b.style.setProperty('--swatch', `var(${name})`);
    b.title = `${label} colour`;
    b.setAttribute('aria-label', b.title);
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    b.addEventListener('click', () => {
      colour = name;
      if (tool === null || tool === 'eraser') select('pen');
      render();
    });
    bar.append(b);
    return [name, b] as const;
  });
  button(BrushCleaning, 'Clear drawing', () => {
    clear();
  });

  const render = () => {
    for (const [name, b] of toolButtons) b.classList.toggle('on', tool === name);
    for (const [name, b] of swatches) b.classList.toggle('on', colour === name);
    document.body.classList.toggle('inking', tool !== null);
  };
  const select = (next: Tool | null) => {
    end();
    tool = next;
    render();
  };
  const clear = () => {
    end();
    inkCtx.clearRect(0, 0, 1200, 675);
  };
  render();

  return {
    clear,
    togglePen: () => {
      select(tool === 'pen' ? null : 'pen');
    },
    stop: () => {
      select(null);
    },
  };
};
