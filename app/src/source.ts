import { presentation as served, type Presentation, type SlideAnimation } from 'virtual:presentation';

// Where the presentation comes from:
// - the local app (any mode but "web" and "template"): the server's virtual module, live-reloaded;
// - the hosted app ("web"): a folder the viewer opened, kept for the tab's session, else the built-in sample;
// - a downloaded file ("template"): JSON embedded in the page by the export.
// Stored and embedded presentations carry their animations as code, loaded here as modules.

export const isWeb = import.meta.env.MODE === 'web';
const STORE_KEY = 'presentation-editor:opened';
// Set once the viewer picks the sample, so the hosted app stops asking for this tab.
const SAMPLE_KEY = 'presentation-editor:sample';
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

export const storeOpened = (presentation: Stored) => {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(presentation));
};
export const useSample = () => {
  try {
    sessionStorage.removeItem(STORE_KEY);
    sessionStorage.setItem(SAMPLE_KEY, '1');
  } catch {
    // Storage blocked: the sample still shows; the hosted app will ask again next visit.
  }
};
const sampleChosen = () => {
  try {
    return sessionStorage.getItem(SAMPLE_KEY) === '1';
  } catch {
    return false;
  }
};

export const openedInBrowser = () => readOpened() !== null;

const readOpened = () => {
  try {
    const json = sessionStorage.getItem(STORE_KEY);
    return json ? (JSON.parse(json) as Stored) : null;
  } catch {
    return null;
  }
};

// `choose` is true when the hosted app should first ask which presentation to open.
export const loadPresentation = async (): Promise<{ presentation: Presentation; choose: boolean }> => {
  if (import.meta.env.MODE === 'template') {
    const json = document.getElementById(DATA_ID)?.textContent;
    if (!json) throw new Error('This file has no presentation in it.');
    return { presentation: await hydrate(JSON.parse(json) as Stored), choose: false };
  }
  if (!served) throw new Error('No presentation was served.');
  if (!isWeb) return { presentation: served, choose: false };
  const opened = readOpened();
  if (opened) return { presentation: await hydrate(opened), choose: false };
  return { presentation: served, choose: !sampleChosen() };
};
