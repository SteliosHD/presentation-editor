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

// The toolbar under the nav bar: Notes (N), Pointer (P), Numbers (S), Present (F), as square icon tools.
// Each tool reports whether it is on so its button lights up; hovering or focusing one shows its tooltip.
// The slide area's own controls, the ← → arrows (bottom centre) and the counter (bottom right), update with it.

type ToolName = 'notes' | 'pointer' | 'numbers' | 'present';
type Tool = { run: () => void; isOn: () => boolean };

const INFO: Record<ToolName, { icon: IconNode; name: string; text: string; key: string }> = {
  notes: {
    icon: NotebookText,
    name: 'Speaker notes',
    text: 'Your notes and the next slide, in their own window.',
    key: 'N',
  },
  pointer: {
    icon: Crosshair,
    name: 'Laser pointer',
    text: 'A red dot with a fading trail, for pointing at the slide.',
    key: 'P',
  },
  numbers: {
    icon: Hash,
    name: 'Slide numbers',
    text: "Shows each slide's number in its bottom-right corner.",
    key: 'S',
  },
  present: {
    icon: Presentation,
    name: 'Present',
    text: 'Full screen, only the slide. Draw with D, leave with Esc.',
    key: 'F',
  },
};

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

  const place = (button: HTMLElement, info: (typeof INFO)[ToolName]) => {
    part('.tip-name').textContent = info.name;
    part('kbd').textContent = info.key;
    part('.tip-text').textContent = info.text;
    const r = button.getBoundingClientRect();
    tip.style.top = `${r.bottom + 8}px`;
    tip.style.left = `${Math.min(r.left, innerWidth - tip.offsetWidth - 8)}px`;
    tip.classList.add('show');
  };
  return {
    show: (button: HTMLElement, info: (typeof INFO)[ToolName]) => {
      clearTimeout(timer);
      const warm = tip.classList.contains('show') || performance.now() - lastHidden < 400;
      timer = window.setTimeout(
        () => {
          place(button, info);
        },
        warm ? 0 : 450,
      );
    },
    hide: () => {
      clearTimeout(timer);
      if (tip.classList.contains('show')) lastHidden = performance.now();
      tip.classList.remove('show');
    },
  };
};

export const createToolbar = (tools: Record<ToolName, Tool>, step: (delta: number) => void) => {
  const counter = must(document.querySelector('.counter'), '.counter');
  const prev = must(document.querySelector<HTMLButtonElement>('.slide-prev'), '.slide-prev');
  const next = must(document.querySelector<HTMLButtonElement>('.slide-next'), '.slide-next');
  prev.append(createElement(ChevronLeft, { width: 18, height: 18, 'aria-hidden': 'true' }));
  next.append(createElement(ChevronRight, { width: 18, height: 18, 'aria-hidden': 'true' }));
  prev.addEventListener('click', () => {
    step(-1);
  });
  next.addEventListener('click', () => {
    step(1);
  });
  const tooltip = createTooltip();
  const buttons = (Object.entries(tools) as [ToolName, Tool][]).map(([name, tool]) => {
    const info = INFO[name];
    const button = must(document.querySelector<HTMLElement>(`[data-tool="${name}"]`), `[data-tool="${name}"]`);
    button.prepend(createElement(info.icon, { width: 16, height: 16, 'aria-hidden': 'true' }));
    button.setAttribute('aria-describedby', 'tool-tip');
    button.setAttribute('aria-keyshortcuts', info.key);
    button.addEventListener('click', tool.run);
    button.addEventListener('pointerenter', () => {
      tooltip.show(button, info);
    });
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) tooltip.show(button, info);
    });
    for (const event of ['pointerleave', 'blur', 'pointerdown']) button.addEventListener(event, tooltip.hide);
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
const NUMBERS_KEY = 'presentation-editor:numbers';
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
