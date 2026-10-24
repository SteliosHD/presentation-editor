// View → Animations: whether slides play their animation when you switch to them while editing (presenting always
// plays it), and whether the animation list shows technical details or plain sentences. Remembered between visits;
// the list's own visibility is the View menu's usual hide-animations switch.

type Prefs = { autoplay: boolean; details: boolean };

const KEY = 'presentation-viewer:animation-prefs';
const DEFAULTS: Prefs = { autoplay: false, details: false };

const read = (): Prefs => {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
};

let prefs = read();
const listeners = new Set<() => void>();
const apply = () => {
  document.body.classList.toggle('anim-details', prefs.details);
};
apply();

export const animationPrefs = {
  get: () => prefs,
  set: (change: Partial<Prefs>) => {
    prefs = { ...prefs, ...change };
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Storage blocked: the choice holds for this visit.
    }
    apply();
    for (const listener of listeners) listener();
  },
  onChange: (listener: () => void) => {
    listeners.add(listener);
  },
};
