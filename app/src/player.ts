import { gsap } from 'gsap';
import { finish, stepThrough, withPopups, type Stepper } from './animations.ts';
import type { PresentationSlide, SlideAnimation } from 'virtual:presentation';
import { keyName, SHORTCUTS } from './shortcuts.ts';
import { clockText, talkTimer } from './timer.ts';

type Point = { x: number; y: number; t: number };

export const must = <T>(value: T | null, what: string): T => {
  if (value === null) throw new Error(`${what} is missing`);
  return value;
};

// A slide file holds one <section class="slide">; anything else is wrapped in one.
export const toSlide = (html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  const section = template.content.querySelector<HTMLElement>('.slide');
  if (section) return section;
  const wrapper = document.createElement('section');
  wrapper.className = 'slide';
  wrapper.innerHTML = html;
  return wrapper;
};

// Default entrance: the slide's blocks, then each card inside a grid, rise in one after another.
// Never tween the .slide's own transform: it holds the fit-to-stage scale.
const GROUPS = '.flow, .stats, .cols, .steps, .bottom';
const partsOf = (slide: HTMLElement) =>
  [...slide.children].flatMap((el) =>
    el.matches('style, script, .notes, .slide-number, .popup') ? [] : el.matches(GROUPS) ? [...el.children] : [el],
  );
const defaultAnimation: SlideAnimation = (slide, g) =>
  g.from(partsOf(slide), {
    opacity: 0,
    y: 24,
    duration: 0.5,
    ease: 'power2.out',
    stagger: 0.07,
    clearProps: 'opacity,transform',
  });

export type Player = ReturnType<typeof createPlayer>;

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const createPlayer = (
  slides: PresentationSlide[],
  viewport: HTMLElement,
  {
    onChange,
    onKey,
    autoplay = () => true,
    stepping = () => null,
  }: {
    onChange: () => void;
    onKey: (e: KeyboardEvent) => void;
    autoplay?: () => boolean;
    // While presenting: whether steps wait for a click, and whether every step of a slide's own animation does.
    stepping?: () => { everyStep: boolean } | null;
  },
) => {
  const elements = slides.map((s) => toSlide(s.html));
  const stack = must(viewport.querySelector<HTMLElement>('.slide-stack'), '.slide-stack');
  // Every slide carries its number; it shows only while numbering is on (body.numbered).
  elements.forEach((el, k) => {
    const number = document.createElement('span');
    number.className = 'slide-number';
    number.textContent = `${k + 1} / ${slides.length}`;
    el.append(number);
  });
  stack.replaceChildren(...elements);
  let i = -1;
  let entrance: gsap.core.Animation | null = null;
  let stepper: Stepper | null = null;
  let notesWin: Window | null = null;

  // Show the 1200x675 slide as large as its box allows, with a margin outside presentation mode. The box is
  // the slide area, minus room for presentation tools while they are on show.
  const fit = () => {
    const margin = document.body.classList.contains('presenting') ? 1 : 0.94;
    const s = Math.min(stack.clientWidth / 1200, stack.clientHeight / 675) * margin;
    document.documentElement.style.setProperty('--s', s.toFixed(4));
  };
  new ResizeObserver(fit).observe(stack);

  // The animation is reverted when the slide is left, so endless loops are fine. Unless it should play (presenting,
  // or the editor's choice), the slide shows finished.
  // `shown`: how many waiting steps start out already played, finished, as when coming back to a slide. Null plays
  // the slide from its start.
  const animateIn = (k: number, shown: number | null = null) => {
    entrance?.revert();
    stepper = null;
    if (reduceMotion) return;
    const custom = slides[k].animation;
    entrance = withPopups(elements[k], (custom ?? defaultAnimation)(elements[k], gsap));
    if (!autoplay()) {
      finish(entrance);
      return;
    }
    const mode = stepping();
    stepper = mode && stepThrough(entrance, Boolean(custom) && mode.everyStep, shown ?? 0, shown !== null);
    if (stepper) entrance = stepper.root;
  };

  // What the next click shows, for the presenter's notes: this slide after its next waiting step, else the next slide
  // as it arrives. Built off-screen from a fresh copy whose animation jumps to that moment, then copied, so the slide
  // on show is untouched.
  const upcoming = (): HTMLElement | null => {
    const waiting = stepper !== null && stepper.shown() < stepper.total;
    const k = waiting ? i : i + 1;
    if (k >= slides.length) return null;
    const stage = document.createElement('div');
    stage.className = 'pdf-stage';
    const el = toSlide(slides[k].html);
    stage.append(el);
    document.body.append(stage);
    let animation: gsap.core.Animation | null = null;
    if (!reduceMotion) {
      const custom = slides[k].animation;
      animation = withPopups(el, (custom ?? defaultAnimation)(el, gsap));
      const mode = stepping();
      const shown = waiting && stepper ? stepper.shown() + 1 : 0;
      const ahead = mode && stepThrough(animation, Boolean(custom) && mode.everyStep, shown, true);
      if (ahead) animation = ahead.root;
      else finish(animation);
    }
    const copy = el.cloneNode(true) as HTMLElement;
    animation?.revert();
    stage.remove();
    copy.classList.add('active');
    return copy;
  };

  // `built`: arrive with every waiting step already played.
  const show = (n: number, built = false) => {
    n = Math.max(0, Math.min(elements.length - 1, n));
    if (n === i) return;
    i = n;
    elements.forEach((s, k) => s.classList.toggle('active', k === i));
    animateIn(i, built ? Infinity : null);
    renderNotes();
    onChange();
  };

  // Plays the next waiting step, or takes the last one back by showing the slide one step earlier. False when there
  // is none, so the caller changes slide instead.
  const step = (direction: 1 | -1) => {
    if (!stepper) return false;
    const shown = stepper.shown();
    if (direction === 1) {
      if (shown === stepper.total) return false;
      stepper.next();
    } else {
      if (shown === 0) return false;
      animateIn(i, shown - 1);
    }
    renderNotes();
    return true;
  };

  // Plays the current slide's animation again from the start, or shows it finished, by the current settings.
  const replay = () => {
    animateIn(i);
    renderNotes();
  };

  // Presenter window: notes for the current slide plus what comes next.
  // It's a separate window, so sharing only the slides tab keeps the notes private.
  const titleOf = (s: HTMLElement) => s.querySelector('h1, h2')?.textContent ?? '';
  const renderNotes = () => {
    if (!notesWin || notesWin.closed) return;
    const d = notesWin.document;
    const set = (id: string, text: string) => {
      must(d.getElementById(id), `#${id}`).textContent = text;
    };
    const cur = elements[i];
    const next = elements.at(i + 1);
    const steps = stepper ? ` · step ${stepper.shown().toString()} of ${stepper.total.toString()}` : '';
    set('n-pos', `Slide ${i + 1} of ${elements.length}${steps}`);
    set('n-title', titleOf(cur));
    set('n-body', cur.querySelector('.notes')?.textContent.trim() || 'No notes for this slide.');
    const waiting = stepper !== null && stepper.shown() < stepper.total;
    set(
      'n-next',
      waiting && stepper
        ? `Next click: step ${(stepper.shown() + 1).toString()} of ${stepper.total.toString()}`
        : next
          ? `Next slide: ${titleOf(next)}`
          : 'Last slide',
    );
    const preview = must(d.getElementById('n-preview'), '#n-preview');
    const picture = upcoming();
    preview.replaceChildren(...(picture ? [picture] : []));
    preview.hidden = !picture;
    preview.style.setProperty('--ns', (preview.clientWidth / 1200).toFixed(4));
  };
  const renderTimer = () => {
    if (!notesWin || notesWin.closed) return;
    const d = notesWin.document;
    const time = d.getElementById('n-time');
    const run = d.getElementById('n-run');
    if (!time || !run) return;
    time.textContent = clockText(talkTimer.elapsed());
    run.textContent = talkTimer.running() ? 'Pause' : talkTimer.elapsed() > 0 ? 'Resume' : 'Start';
    d.getElementById('n-timer')?.classList.toggle('paused', !talkTimer.running());
  };
  const notesOpen = () => notesWin !== null && !notesWin.closed;
  const toggleNotes = () => {
    if (notesWin && !notesWin.closed) {
      notesWin.close();
      notesWin = null;
      onChange();
      return;
    }
    notesWin = window.open('', `${document.title}-notes`, 'width=1080,height=620');
    if (!notesWin) {
      alert('The browser blocked the notes window. Allow pop-ups for this page and press N again.');
      return;
    }
    // The notes window has no stylesheets of its own, so it gets the page's: the theme for its colours and the slide
    // styles for the preview of the next click. Its own rules come after and win.
    const styles = [
      ...document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'),
    ]
      .map((node) =>
        node instanceof HTMLLinkElement
          ? `<link rel="stylesheet" href="${node.href}">`
          : `<style>${node.textContent}</style>`,
      )
      .join('');
    const d = notesWin.document;
    d.title = 'Speaker notes';
    d.head.innerHTML = `<meta charset="utf-8">${styles}
      <style>
        html, body { height: auto; overflow: auto; }
        body { display: block; margin: 0; padding: 28px 32px; background: var(--bg); color: var(--text);
          font-family: var(--font); }
        #n-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        #n-timer { display: flex; align-items: center; gap: 8px; }
        #n-time { min-width: 5ch; margin-right: 6px; text-align: right; font-family: var(--mono); font-size: 28px;
          font-variant-numeric: tabular-nums; color: var(--text); }
        #n-timer.paused #n-time { color: var(--muted); }
        #n-timer button { padding: 4px 14px; font-size: 13px; }
        #n-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 44%); gap: 32px; align-items: start; }
        #n-preview { position: relative; aspect-ratio: 16 / 9; margin-top: 10px; overflow: hidden;
          border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
        #n-preview .slide { position: absolute; top: 0; left: 0; margin: 0; border: none; border-radius: 0;
          transform: scale(var(--ns, 0.3)); transform-origin: top left; }
        #n-pos { color: var(--accent); font-size: 14px; letter-spacing: .08em; text-transform: uppercase; }
        #n-title { font-size: 24px; margin: 8px 0 18px; }
        #n-body { font-size: 22px; line-height: 1.5; color: var(--soft); white-space: pre-wrap; }
        #n-next { font-size: 14px; letter-spacing: .04em; color: var(--muted); }
        #n-keys { margin-top: 32px; padding-top: 14px; border-top: 1px solid var(--line); }
        #n-keys h2 { margin: 0 0 10px; font-size: 12px; font-weight: 600; letter-spacing: .08em;
          text-transform: uppercase; color: var(--muted); }
        #n-keys dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 28px; margin: 0; }
        #n-keys dl > div { display: flex; justify-content: space-between; align-items: center; gap: 12px;
          font-size: 13px; color: var(--soft); }
        #n-keys dd { margin: 0; white-space: nowrap; }
        kbd { margin-left: 4px; padding: 1px 6px; border: 1px solid var(--line); border-bottom-width: 2px;
          border-radius: 4px; background: var(--card); font-family: var(--mono); font-size: 11px; color: var(--text); }
      </style>`;
    d.body.innerHTML = `<header id="n-head">
        <div id="n-pos"></div>
        <div id="n-timer" title="How long the talk has run. It starts when you first present.">
          <span id="n-time"></span><button id="n-run"></button><button id="n-reset">Reset</button>
        </div>
      </header>
      <div id="n-top">
        <div><div id="n-title"></div><div id="n-body"></div></div>
        <aside><div id="n-next"></div><div id="n-preview"></div></aside>
      </div>
      <section id="n-keys"><h2>Shortcuts</h2><dl></dl></section>`;
    // Every shortcut, read from the one list the key handler uses.
    must(d.querySelector('#n-keys dl'), '#n-keys dl').append(
      ...Object.values(SHORTCUTS).map(({ keys, label }) => {
        const row = d.createElement('div');
        const name = d.createElement('dt');
        name.textContent = label;
        const caps = d.createElement('dd');
        for (const key of keys) caps.append(Object.assign(d.createElement('kbd'), { textContent: keyName(key) }));
        row.append(name, caps);
        return row;
      }),
    );
    d.addEventListener('keydown', onKey);
    // The clock's buttons never take focus, so Space and the arrows keep moving the slides.
    for (const button of d.querySelectorAll('#n-timer button'))
      button.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
    d.getElementById('n-run')?.addEventListener('click', () => {
      if (talkTimer.running()) talkTimer.pause();
      else talkTimer.start();
      renderTimer();
    });
    d.getElementById('n-reset')?.addEventListener('click', () => {
      talkTimer.reset();
      renderTimer();
    });
    const tick = setInterval(renderTimer, 500);
    renderTimer();
    notesWin.addEventListener('resize', () => {
      const preview = d.getElementById('n-preview');
      preview?.style.setProperty('--ns', (preview.clientWidth / 1200).toFixed(4));
    });
    notesWin.addEventListener('pagehide', () => {
      clearInterval(tick);
      notesWin = null;
      onChange();
    });
    renderNotes();
    onChange();
  };
  addEventListener('beforeunload', () => {
    if (notesWin && !notesWin.closed) notesWin.close();
  });

  // Laser pointer: a dot with a fading trail, drawn on a canvas above the slides.
  const canvas = must(document.querySelector<HTMLCanvasElement>('#laser'), '#laser');
  const ctx = must(canvas.getContext('2d'), 'canvas 2d context');
  const TRAIL_MS = 450;
  let points: Point[] = [];
  let visible = false;
  const laserOn = () => document.body.classList.contains('laser-on');
  const toggleLaser = () => {
    document.body.classList.toggle('laser-on');
    points = [];
    onChange();
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('mousemove', (e) => {
    visible = true;
    if (laserOn()) points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  document.addEventListener('mouseleave', () => {
    visible = false;
    points = [];
  });

  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const draw = (now: number) => {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    points = points.filter((p) => now - p.t < TRAIL_MS);
    const last = points.at(-1);
    if (!last) return;

    const laser = token('--laser');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = laser;
    ctx.shadowColor = laser;
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1];
      const b = points[k];
      const life = 1 - (now - b.t) / TRAIL_MS;
      ctx.globalAlpha = 0.75 * life;
      ctx.lineWidth = 2 + 5 * life;
      ctx.shadowBlur = 12 * life;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (visible && laserOn()) {
      ctx.shadowBlur = 18;
      ctx.fillStyle = laser;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = token('--laser-core');
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };
  requestAnimationFrame(draw);

  return {
    elements,
    current: () => i,
    entrance: () => entrance,
    show,
    step,
    replay,
    fit,
    notesOpen,
    toggleNotes,
    laserOn,
    toggleLaser,
  };
};
