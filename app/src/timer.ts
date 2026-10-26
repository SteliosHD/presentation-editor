// The presenter's clock in the notes window: how long the talk has been running. It starts the first time
// presentation mode opens and keeps going until paused; reset puts it back to zero, and it starts again with the next
// presentation (or Start). Kept for the tab's session, so a reload mid-talk doesn't lose it.

// `since`: when it last started running, or null while paused. `armed`: waiting for presenting to start it.
type State = { elapsed: number; since: number | null; armed: boolean };

const KEY = 'presentation-viewer:talk-timer';
const FRESH: State = { elapsed: 0, since: null, armed: true };

const read = (): State => {
  try {
    return { ...FRESH, ...(JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<State>) };
  } catch {
    return FRESH;
  }
};

let state = read();
const save = (next: State) => {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the clock holds until the page reloads.
  }
};

const elapsed = () => state.elapsed + (state.since === null ? 0 : Date.now() - state.since);

export const talkTimer = {
  elapsed,
  running: () => state.since !== null,
  start: () => {
    if (state.since === null) save({ ...state, since: Date.now(), armed: false });
  },
  pause: () => {
    if (state.since !== null) save({ elapsed: elapsed(), since: null, armed: false });
  },
  reset: () => {
    save(FRESH);
  },
  // Presentation mode opening starts the clock, once after each reset.
  presenting: () => {
    if (state.armed) talkTimer.start();
  },
};

// "4:07", or "1:02:09" past an hour.
export const clockText = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? `${String(hours)}:${two(minutes)}:${two(seconds % 60)}` : `${String(minutes)}:${two(seconds % 60)}`;
};
