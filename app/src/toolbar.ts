import {
  ChevronLeft,
  ChevronRight,
  createElement,
  Crosshair,
  Hash,
  NotebookText,
  Presentation,
  type IconNode,
} from 'lucide';
import { must } from './player.ts';
import { allKeys, mainKey, SHORTCUTS, type ShortcutId } from './shortcuts.ts';

// The toolbar at the top of the slide area: Notes (N), Pointer (P), Numbers (S), Present (F), as square icon tools
// in an island centred over the slides, each showing its key.
// Each tool reports whether it is on so its button lights up; hovering or focusing one shows its tooltip.
// The slide area's own controls, the ← → arrows with the present cue between them (bottom centre) and the counter
// (bottom right), update with it.

type ToolName = 'notes' | 'pointer' | 'numbers' | 'present';
type Tool = { run: () => void; isOn: () => boolean };

type Info = { name: string; text: string; key: string };

// What each tool does; its name and key come from the shortcuts list.
const TOOLS: Record<ToolName, { icon: IconNode; text: string }> = {
  notes: { icon: NotebookText, text: 'Your notes and the next slide, in their own window.' },
  pointer: { icon: Crosshair, text: 'A red dot with a fading trail, for pointing at the slide.' },
  numbers: { icon: Hash, text: "Shows each slide's number in its bottom-right corner." },
  present: {
    icon: Presentation,
    text: `Only the slide, filling the window. Draw with ${mainKey('draw')}, leave with ${mainKey('exit')}.`,
  },
};

const infoFor = (id: ShortcutId, text: string): Info => ({ name: SHORTCUTS[id].label, key: mainKey(id), text });
// aria-keyshortcuts names keys as KeyboardEvent.key does, with Space spelled out.
const ariaKeys = (id: ShortcutId) => SHORTCUTS[id].keys.map((k) => (k === ' ' ? 'Space' : k)).join(' ');

// One shared tooltip. It waits a moment before the first show, then follows the pointer from tool to tool
// without waiting again, as native tooltips do.
const createTooltip = () => {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.id = 'tool-tip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = '<div class="tip-head"><span class="tip-name"></span><kbd></kbd></div><p class="tip-text"></p>';
  document.body.append(tip);
  const part = (sel: string) => must(tip.querySelector(sel), sel);
  let timer = 0;
  let lastHidden = 0;

  // Below the button, or above it when there is no room below (the slide arrows sit at the bottom).
  const place = (button: HTMLElement, info: Info) => {
    part('.tip-name').textContent = info.name;
    part('kbd').textContent = info.key;
    part('.tip-text').textContent = info.text;
    const r = button.getBoundingClientRect();
    const below = r.bottom + 8 + tip.offsetHeight < innerHeight;
    tip.style.top = `${below ? r.bottom + 8 : r.top - 8 - tip.offsetHeight}px`;
    tip.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - 8))}px`;
    tip.classList.add('show');
  };
  const show = (button: HTMLElement, info: Info) => {
    clearTimeout(timer);
    const warm = tip.classList.contains('show') || performance.now() - lastHidden < 400;
    timer = window.setTimeout(
      () => {
        place(button, info);
      },
      warm ? 0 : 450,
    );
  };
  const hide = () => {
    clearTimeout(timer);
    if (tip.classList.contains('show')) lastHidden = performance.now();
    tip.classList.remove('show');
  };
  // Hover or keyboard focus shows it; leaving, blurring or pressing hides it.
  const attach = (button: HTMLElement, info: Info) => {
    button.setAttribute('aria-describedby', 'tool-tip');
    button.addEventListener('pointerenter', () => {
      show(button, info);
    });
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) show(button, info);
    });
    for (const event of ['pointerleave', 'blur', 'pointerdown']) button.addEventListener(event, hide);
  };
  return { attach };
};

export const createToolbar = (tools: Record<ToolName, Tool>, step: (delta: number) => void) => {
  const tooltip = createTooltip();
  const counter = must(document.querySelector('.counter'), '.counter');
  const prev = must(document.querySelector<HTMLButtonElement>('.slide-prev'), '.slide-prev');
  const next = must(document.querySelector<HTMLButtonElement>('.slide-next'), '.slide-next');
  prev.append(createElement(ChevronLeft, { width: 18, height: 18, 'aria-hidden': 'true' }));
  next.append(createElement(ChevronRight, { width: 18, height: 18, 'aria-hidden': 'true' }));
  tooltip.attach(prev, infoFor('prev', `Or press ${allKeys('prev')}. ${mainKey('first')} goes to the first slide.`));
  tooltip.attach(next, infoFor('next', `Or press ${allKeys('next')}. ${mainKey('last')} goes to the last slide.`));
  prev.setAttribute('aria-keyshortcuts', ariaKeys('prev'));
  next.setAttribute('aria-keyshortcuts', ariaKeys('next'));
  // Bottom left of the slide area: how to present, as a button that does it.
  const cue = must(document.querySelector<HTMLElement>('.present-cue'), '.present-cue');
  must(cue.querySelector('kbd'), '.present-cue kbd').textContent = mainKey('present');
  cue.setAttribute('aria-keyshortcuts', ariaKeys('present'));
  cue.addEventListener('click', tools.present.run);
  prev.addEventListener('click', () => {
    step(-1);
  });
  next.addEventListener('click', () => {
    step(1);
  });
  const buttons = (Object.entries(tools) as [ToolName, Tool][]).map(([name, tool]) => {
    const { icon, text } = TOOLS[name];
    const info = infoFor(name, text);
    const button = must(document.querySelector<HTMLElement>(`[data-tool="${name}"]`), `[data-tool="${name}"]`);
    button.prepend(createElement(icon, { width: 19, height: 19, 'aria-hidden': 'true' }));
    const key = document.createElement('span');
    key.className = 'tool-key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = mainKey(name);
    button.append(key);
    button.setAttribute('aria-keyshortcuts', ariaKeys(name));
    button.addEventListener('click', tool.run);
    tooltip.attach(button, info);
    return [button, tool] as const;
  });

  return {
    render: (current: number, total: number) => {
      counter.textContent = `${current + 1} / ${total}`;
      prev.disabled = current === 0;
      next.disabled = current === total - 1;
      for (const [button, tool] of buttons) button.classList.toggle('on', tool.isOn());
    },
  };
};

// Slide numbers (S): on or off, remembered between visits.
const NUMBERS_KEY = 'presentation-viewer:numbers';
export const slideNumbers = {
  isOn: () => document.body.classList.contains('numbered'),
  toggle: () => {
    document.body.classList.toggle('numbered');
    try {
      localStorage.setItem(NUMBERS_KEY, String(slideNumbers.isOn()));
    } catch {
      // Storage blocked: numbering still toggles for this visit.
    }
  },
  restore: () => {
    try {
      document.body.classList.toggle('numbered', localStorage.getItem(NUMBERS_KEY) === 'true');
    } catch {
      // Storage blocked: start without numbers.
    }
  },
};
