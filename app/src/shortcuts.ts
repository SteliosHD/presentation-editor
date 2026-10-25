// Every keyboard shortcut, in one list. The key handler, the tooltips, the presentation hint and the notes window
// all read it, so a key changes everywhere at once. `keys` are KeyboardEvent.key values; letters match either case.

export type ShortcutId =
  | 'next'
  | 'prev'
  | 'nextSlide'
  | 'prevSlide'
  | 'first'
  | 'last'
  | 'notes'
  | 'pointer'
  | 'numbers'
  | 'present'
  | 'draw'
  | 'exit';

export const SHORTCUTS: Record<ShortcutId, { keys: string[]; label: string }> = {
  next: { keys: ['ArrowRight', ' ', 'PageDown'], label: 'Next step or slide' },
  prev: { keys: ['ArrowLeft', 'PageUp'], label: 'Undo a step, or previous slide' },
  nextSlide: { keys: ['ArrowDown'], label: 'Next slide, skipping steps' },
  prevSlide: { keys: ['ArrowUp'], label: 'Previous slide' },
  first: { keys: ['Home'], label: 'First slide' },
  last: { keys: ['End'], label: 'Last slide' },
  notes: { keys: ['n'], label: 'Speaker notes' },
  pointer: { keys: ['p'], label: 'Laser pointer' },
  numbers: { keys: ['s'], label: 'Slide numbers' },
  present: { keys: ['f'], label: 'Present' },
  draw: { keys: ['d'], label: 'Pen, while presenting' },
  exit: { keys: ['Escape'], label: 'Leave presentation mode' },
};

const NAMES: Record<string, string> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowDown: '↓',
  ArrowUp: '↑',
  ' ': 'Space',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Escape: 'Esc',
};

// How a key is written for people: "→", "Space", "N".
export const keyName = (key: string) => NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);

// The shortcut's main key, as written for people.
export const mainKey = (id: ShortcutId) => keyName(SHORTCUTS[id].keys[0]);

// "→, Space or Page Down"
export const allKeys = (id: ShortcutId) => {
  const names = SHORTCUTS[id].keys.map(keyName);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1) ?? ''}` : names.join('');
};

export const shortcutFor = (key: string) => {
  const pressed = key.length === 1 ? key.toLowerCase() : key;
  return (Object.keys(SHORTCUTS) as ShortcutId[]).find((id) => SHORTCUTS[id].keys.includes(pressed));
};
