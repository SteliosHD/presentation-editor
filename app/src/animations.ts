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
//   { ..., data: { label: 'Connections draw in', icons: ['draw'] } }

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

type Annotation = { label?: string; icons?: string[] };

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
    vars.repeat === -1
      ? `${seconds(start)} → loops every ${seconds(tween.duration())}`
      : `${seconds(start)}–${seconds(start + tween.totalDuration())}`;
  const stagger = typeof vars.stagger === 'number' ? ` · stagger ${seconds(vars.stagger)}` : '';
  return {
    icons,
    when,
    targets: describeTargets(tween.targets()),
    change: change + stagger,
    label: note.label ?? '',
    ease: typeof vars.ease === 'string' ? vars.ease : '',
    tween,
  };
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
