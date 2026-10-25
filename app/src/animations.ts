import { gsap } from 'gsap';
import {
  Activity,
  Blend,
  Eye,
  Hash,
  Highlighter,
  ListOrdered,
  MoveHorizontal,
  MoveVertical,
  Palette,
  PenLine,
  Repeat,
  RotateCw,
  Scaling,
  Sparkles,
  type IconNode,
} from 'lucide';

// Turns a slide's GSAP tween or timeline into a readable list of steps. Steps describe themselves from the
// properties they animate; a tween can also annotate itself with GSAP's data field:
//   { ..., data: { label: 'Connections draw in', icons: ['draw'], click: true } }
// `click` makes the step wait for a click (or →) while presenting, like PowerPoint's On Click.

export type Icon = { icon: IconNode; label: string };
// `tween` is the step itself, so the animation list can tell when it runs and play it on its own.
export type Step = {
  icons: Icon[];
  when: string;
  targets: string;
  change: string;
  label: string;
  ease: string;
  tween: gsap.core.Tween;
  // The same step for someone who doesn't know GSAP: "The title fades in and rises", "After 0.4 seconds".
  plain: string;
  plainWhen: string;
};

// The icon names a tween's data.icons may use; AGENTS.md points authors here.
export const ICONS: Record<string, Icon> = {
  fade: { icon: Blend, label: 'fade' },
  move: { icon: MoveVertical, label: 'move up or down' },
  'move-sideways': { icon: MoveHorizontal, label: 'move sideways' },
  scale: { icon: Scaling, label: 'scale' },
  rotate: { icon: RotateCw, label: 'rotate' },
  draw: { icon: PenLine, label: 'draw a line' },
  colour: { icon: Palette, label: 'colour' },
  glow: { icon: Activity, label: 'glow or effect' },
  stagger: { icon: ListOrdered, label: 'one after another' },
  loop: { icon: Repeat, label: 'loops' },
  highlight: { icon: Highlighter, label: 'highlight' },
  reveal: { icon: Eye, label: 'reveal' },
  count: { icon: Hash, label: 'count up' },
};

// Which icon an animated property gets; the first matching pattern wins.
const PROPERTY_ICONS: [RegExp, string][] = [
  [/^(opacity|autoAlpha)$/, 'fade'],
  [/^(y|yPercent|top|bottom)$/, 'move'],
  [/^(x|xPercent|left|right)$/, 'move-sideways'],
  [/^(scale|scaleX|scaleY|width|height)$/, 'scale'],
  [/^(rotation|rotate|rotationX|rotationY|rotateX|rotateY)$/, 'rotate'],
  [/^stroke(Dashoffset|Dasharray)$/, 'draw'],
  [/(color|Color|background|fill|stroke)/, 'colour'],
  [/^(--|boxShadow|filter)/, 'glow'],
];
const iconFor = (prop: string): Icon => {
  const match = PROPERTY_ICONS.find(([pattern]) => pattern.test(prop));
  return match ? ICONS[match[1]] : { icon: Sparkles, label: prop };
};

type Annotation = { label?: string; icons?: string[]; click?: boolean };

// Tween settings that are not animated properties.
const SETTINGS = new Set([
  'duration',
  'delay',
  'ease',
  'stagger',
  'repeat',
  'repeatDelay',
  'yoyo',
  'yoyoEase',
  'clearProps',
  'immediateRender',
  'runBackwards',
  'startAt',
  'overwrite',
  'lazy',
  'id',
  'data',
  'paused',
  'reversed',
  'inherit',
  'callbackScope',
  'defaults',
  'keyframes',
  'parent',
]);

const props = (vars: object) => Object.keys(vars).filter((key) => !SETTINGS.has(key) && !key.startsWith('on'));

// "kicker, h2" or "line ×3": each element named by its first class, else its tag.
const describeTargets = (targets: unknown[]) => {
  const counts = new Map<string, number>();
  for (const target of targets) {
    const name = target instanceof Element ? (target.classList.item(0) ?? target.tagName.toLowerCase()) : 'object';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
};

const seconds = (s: number) => `${(Math.round(s * 100) / 100).toString()}s`;

// Plain words for the elements a step moves, by their first class or tag; anything else is its class with spaces.
const WORDS: Record<string, [string, string]> = {
  h1: ['the title', 'titles'],
  h2: ['the title', 'titles'],
  h3: ['the heading', 'headings'],
  kicker: ['the label', 'labels'],
  lead: ['the intro text', 'intro texts'],
  p: ['the text', 'paragraphs'],
  li: ['the item', 'items'],
  img: ['the image', 'images'],
  box: ['the box', 'boxes'],
  stat: ['the figure', 'figures'],
  col: ['the column', 'columns'],
  item: ['the item', 'items'],
  step: ['the step', 'steps'],
  line: ['the line', 'lines'],
  arrow: ['the arrow', 'arrows'],
  node: ['the shape', 'shapes'],
};
const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const plainTargets = (targets: unknown[]) => {
  const counts = new Map<string, number>();
  for (const target of targets) {
    const name = target instanceof Element ? (target.classList.item(0) ?? target.tagName.toLowerCase()) : 'part';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const parts = [...counts].map(([name, n]) => {
    const words = WORDS[name] ?? [`the ${name.replaceAll(/[-_]/g, ' ')}`, `${name.replaceAll(/[-_]/g, ' ')}s`];
    return n > 1 ? `${NUMBERS[n] ?? String(n)} ${words[1]}` : words[0];
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}` : (parts[0] ?? 'this slide');
};

// What a step does, from the properties it animates and which way it goes.
const plainVerbs = (vars: gsap.TweenVars, names: string[]) => {
  const into = Boolean(vars.runBackwards) || vars.startAt !== undefined;
  const value = (name: string) => Number(vars[name] ?? 0);
  const verbs = new Set<string>();
  for (const name of names) {
    if (name === 'opacity' || name === 'autoAlpha') verbs.add(into || value(name) > 0 ? 'fades in' : 'fades out');
    else if (name === 'y' || name === 'yPercent') verbs.add(into ? (value(name) > 0 ? 'rises' : 'drops in') : 'moves');
    else if (name === 'x' || name === 'xPercent') verbs.add(into ? 'slides in' : 'slides across');
    else if (/^scale/.test(name)) verbs.add(into ? 'grows in' : value(name) >= 1 ? 'grows' : 'shrinks');
    else if (/^rotat/.test(name)) verbs.add('turns');
    else if (/^stroke(Dashoffset|Dasharray)$/.test(name)) verbs.add('draws');
    else if (/(color|Color|background|fill|stroke)/.test(name)) verbs.add('changes colour');
    else if (/^(--|boxShadow|filter)/.test(name)) verbs.add(vars.repeat === -1 ? 'pulses' : 'glows');
    else verbs.add('changes');
  }
  return [...verbs];
};

const plainSentence = (vars: gsap.TweenVars, names: string[], targets: unknown[]) => {
  // Several things move together, so each verb loses its "s": "the title rises", "the title and the label rise".
  const verbs = (plainVerbs(vars, names).length ? plainVerbs(vars, names) : ['moves']).map((verb) =>
    targets.length > 1 ? verb.replace(/s(?= |$)/, '') : verb,
  );
  const subject = plainTargets(targets);
  const action = verbs.length > 1 ? `${verbs.slice(0, -1).join(', ')} and ${verbs.at(-1) ?? ''}` : (verbs[0] ?? '');
  const order = vars.stagger !== undefined && targets.length > 1 ? ', one after another' : '';
  const loop = vars.repeat === -1 ? ', again and again' : '';
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${action}${order}${loop}`;
};

const plainTime = (start: number, loops: boolean, click: boolean) => {
  const at = click
    ? 'On click'
    : start < 0.05
      ? 'At the start'
      : `After ${(Math.round(start * 10) / 10).toString()} seconds`;
  return loops ? `${at}, then keeps going` : at;
};

const describeTween = (tween: gsap.core.Tween): Step => {
  const vars = tween.vars;
  const startAt = vars.startAt as object | undefined;
  const names = [...new Set([...props(vars), ...(startAt ? props(startAt) : [])])];
  const animated = names.join(', ');
  const note = (vars.data ?? {}) as Annotation;
  const named = note.icons?.map((name) => ICONS[name] ?? { icon: Sparkles, label: `${name} (unknown icon name)` });
  const icons = named ?? [...new Map(names.map((name) => iconFor(name)).map((i) => [i.label, i])).values()];
  if (!named && vars.stagger !== undefined) icons.push(ICONS.stagger);
  if (!named && vars.repeat === -1) icons.push(ICONS.loop);
  const change = startAt ? `from → to ${animated}` : vars.runBackwards ? `in from ${animated}` : `to ${animated}`;
  // Inside a timeline, startTime is relative to it; a lone tween's is on GSAP's global clock, so use its delay.
  const start = tween.parent === gsap.globalTimeline ? tween.delay() : tween.startTime();
  const when =
    (note.click ? 'on click · ' : '') +
    (vars.repeat === -1
      ? `${seconds(start)} → loops every ${seconds(tween.duration())}`
      : `${seconds(start)}–${seconds(start + tween.totalDuration())}`);
  const stagger = typeof vars.stagger === 'number' ? ` · stagger ${seconds(vars.stagger)}` : '';
  const targets = tween.targets();
  return {
    icons,
    when,
    targets: describeTargets(targets),
    change: change + stagger,
    label: note.label ?? '',
    ease: typeof vars.ease === 'string' ? vars.ease : '',
    tween,
    // An author's label is already plain language; otherwise one is written from what the step does.
    plain: note.label ?? plainSentence(vars, names, targets),
    plainWhen: plainTime(start, vars.repeat === -1, Boolean(note.click)),
  };
};

// Shows a slide in its finished state without playing it: every step that ends is done, and repeating ones wait at
// their start. Replay or presenting plays it.
export const finish = (root: gsap.core.Animation) => {
  if (!(root instanceof gsap.core.Timeline)) {
    if ((root as gsap.core.Tween).vars.repeat === -1) root.pause(0);
    else root.progress(1).pause();
    return;
  }
  let end = 0;
  for (const child of root.getChildren(true, true, false)) {
    const start = startOn(root, child);
    end = Math.max(end, child.vars.repeat === -1 ? start : start + child.totalDuration());
  }
  root.pause(end);
};

// Where a step starts on the slide's whole animation, adding up the start times of any timelines it sits in.
const startOn = (root: gsap.core.Animation, tween: gsap.core.Animation) => {
  let start = 0;
  for (let at: gsap.core.Animation | null = tween; at && at !== root; at = at.parent) start += at.startTime();
  return start;
};

// Plays one step on its own: the slide jumps to the moment the step starts, with earlier steps finished and later
// ones not yet begun, then only that step plays. A looping step keeps looping; a slide with a single tween
// replays it.
// Returns what drives the step, which is running for as long as the step plays.
export const playStep = (root: gsap.core.Animation, step: Step): gsap.core.Animation => {
  if (!(root instanceof gsap.core.Timeline)) return root.restart();
  const start = startOn(root, step.tween);
  if (step.tween.vars.repeat === -1) return root.play(start);
  root.pause(start);
  return root.tweenFromTo(start, start + step.tween.totalDuration());
};

export const describeAnimation = (animation: gsap.core.Animation): Step[] => {
  if ('getChildren' in animation) {
    const timeline = animation as gsap.core.Timeline;
    return timeline.getChildren(true, true, false).map((child) => describeTween(child as gsap.core.Tween));
  }
  return [describeTween(animation as gsap.core.Tween)];
};

// Stepping through a slide while presenting. The steps that wait (marked `click`, or every step when the presenter
// asks for that) are held far ahead on the timeline and pulled back to the playhead when released, so whatever is
// already running, loops included, carries on while the slide waits. Steps that start together wait together.
const HELD = 1e5;
const EPSILON = 1e-6;

const waits = (child: gsap.core.Tween | gsap.core.Timeline): boolean =>
  Boolean((child.vars.data as Annotation | undefined)?.click) ||
  (child instanceof gsap.core.Timeline && child.getChildren(true, true, true).some(waits));

export type Stepper = { root: gsap.core.Timeline; shown: () => number; total: number; next: () => void };

// `shown` waiting steps start out released. Unless `settled` is false (arriving fresh), what is released shows
// finished, as when coming back to a slide or taking a step back.
export const stepThrough = (
  animation: gsap.core.Animation,
  everyStep: boolean,
  shown: number,
  settled: boolean,
): Stepper | null => {
  const root = animation instanceof gsap.core.Timeline ? animation : gsap.timeline().add(animation, 0);
  const children = root.getChildren(false, true, true);
  const stops = [
    ...new Set(children.filter((c) => everyStep || waits(c)).map((c) => Math.round(c.startTime() / EPSILON) * EPSILON)),
  ].sort((a, b) => a - b);
  if (!stops.length) return null;
  let released = Math.min(shown, stops.length);
  // Steps from `cut` on are held, `offset` past where the author placed them.
  let cut = stops.at(released) ?? Infinity;
  let offset = HELD;
  if (cut < Infinity) root.shiftChildren(HELD, false, cut - EPSILON);
  if (!settled) root.restart();
  else {
    // Loops keep going.
    const end = children
      .filter((c) => c.startTime() < cut)
      .reduce((end, c) => Math.max(end, c.startTime() + (c.vars.repeat === -1 ? 0 : c.totalDuration())), 0);
    root.play(end);
  }
  return {
    root,
    total: stops.length,
    shown: () => released,
    next: () => {
      if (released === stops.length) return;
      const now = root.time();
      const move = now - (cut + offset);
      root.shiftChildren(move, false, cut + offset - EPSILON);
      offset += move;
      released += 1;
      const following = stops.at(released);
      if (following !== undefined) {
        root.shiftChildren(HELD, false, following + offset - EPSILON);
        cut = following;
        offset += HELD;
      }
      root.play();
    },
  };
};
