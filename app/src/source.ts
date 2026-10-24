import { presentation as served, type Presentation, type SlideAnimation } from 'virtual:presentation';

// Where the presentation comes from:
// - the local app (any mode but "web" and "template"): the server's virtual module, live-reloaded, unless a
//   folder was dropped on it, which is read in the browser like the hosted app's;
// - the hosted app ("web"): a folder the viewer opened, kept only across the viewer's own reloads (opening it,
//   or a file in it changing), so refreshing the page closes it; the built-in sample for the one load that
//   "Try the sample" asked for; otherwise placeholder shapes until something is opened;
// - a downloaded file ("template"): JSON embedded in the page by the export.
// Stored and embedded presentations carry their animations as code, loaded here as modules.

export const isWeb = import.meta.env.MODE === 'web';
const STORE_KEY = 'presentation-viewer:opened';
// Set just before the viewer reloads itself with an opened folder; a reload without it is the user refreshing.
const KEEP_KEY = 'presentation-viewer:keep';
// Set by "Try the sample" for the one reload that loads it.
const SAMPLE_KEY = 'presentation-viewer:sample';
export const DATA_ID = 'presentation-data';

type Stored = Omit<Presentation, 'slides'> & { slides: Omit<Presentation['slides'][number], 'animation'>[] };

const loadAnimation = async (code: string) => {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    return ((await import(/* @vite-ignore */ url)) as { default: SlideAnimation }).default;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const hydrate = async (stored: Stored): Promise<Presentation> => ({
  ...stored,
  slides: await Promise.all(
    stored.slides.map(async (slide) =>
      slide.animationCode ? { ...slide, animation: await loadAnimation(slide.animationCode) } : slide,
    ),
  ),
});

// Without functions, so it can be stored or embedded as JSON.
export const toStored = (presentation: Presentation): Stored => ({
  ...presentation,
  slides: presentation.slides.map(({ file, html, animationFile, animationCode }) => ({
    file,
    html,
    animationFile,
    animationCode,
  })),
});

// Always followed by the viewer reloading itself, which keeps the folder open.
export const storeOpened = (presentation: Stored) => {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(presentation));
  sessionStorage.setItem(KEEP_KEY, '1');
};
export const requestSample = () => {
  try {
    sessionStorage.removeItem(STORE_KEY);
    sessionStorage.setItem(SAMPLE_KEY, '1');
  } catch {
    // Storage blocked: the viewer opens empty again.
  }
};
// A link can ask for the sample too, with ?sample in the address (nav.ts then clears it and starts the tour).
export const linkedToSample = () => new URLSearchParams(location.search).has('sample');
const takeSampleRequest = () => {
  if (linkedToSample()) return true;
  try {
    const requested = sessionStorage.getItem(SAMPLE_KEY) === '1';
    sessionStorage.removeItem(SAMPLE_KEY);
    return requested;
  } catch {
    return false;
  }
};

// What the hosted app shows before anything is opened: grey shapes standing in for three slides.
const placeholder = (shapes: string) => `<section class="slide placeholder">${shapes}</section>`;
const PLACEHOLDER: Presentation = {
  title: 'No presentation open',
  folder: '',
  theme: '',
  slides: [
    placeholder(
      '<i class="ph-kicker"></i><i class="ph-title"></i><i class="ph-title short"></i><i class="ph-line"></i>',
    ),
    placeholder(
      '<i class="ph-kicker"></i><i class="ph-title short"></i><div class="ph-row"><i></i><i></i><i></i></div>',
    ),
    placeholder(
      '<i class="ph-kicker"></i><i class="ph-title short"></i><div class="ph-row"><i></i><i></i></div><i class="ph-line"></i>',
    ),
  ].map((html, k) => ({ file: `slide ${k + 1}`, html })),
};

export const forgetOpened = () => {
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing stored, or storage blocked: either way the server's folder shows.
  }
};

const readOpened = () => {
  try {
    const kept = sessionStorage.getItem(KEEP_KEY) === '1';
    sessionStorage.removeItem(KEEP_KEY);
    if (!kept) sessionStorage.removeItem(STORE_KEY);
    const json = sessionStorage.getItem(STORE_KEY);
    return json ? (JSON.parse(json) as Stored) : null;
  } catch {
    return null;
  }
};

// `choose` is true when the hosted app should first ask which presentation to open. `inBrowser` is true when the
// presentation was read by the browser, so it has no folder on the server: no live reload, exports download.
// `empty` is true while the hosted app shows placeholders because nothing is open yet.
type Loaded = { presentation: Presentation; choose: boolean; inBrowser: boolean; empty: boolean };
export const loadPresentation = async (): Promise<Loaded> => {
  if (import.meta.env.MODE === 'template') {
    const json = document.getElementById(DATA_ID)?.textContent;
    if (!json) throw new Error('This file has no presentation in it.');
    return { presentation: await hydrate(JSON.parse(json) as Stored), choose: false, inBrowser: true, empty: false };
  }
  if (!served) throw new Error('No presentation was served.');
  const opened = readOpened();
  if (opened) return { presentation: await hydrate(opened), choose: false, inBrowser: true, empty: false };
  if (!isWeb) return { presentation: served, choose: false, inBrowser: false, empty: false };
  if (takeSampleRequest()) return { presentation: served, choose: false, inBrowser: true, empty: false };
  return { presentation: PLACEHOLDER, choose: true, inBrowser: true, empty: true };
};
