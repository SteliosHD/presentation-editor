import { Check, Copy, createElement, X } from 'lucide';
import { ICONS } from './animations.ts';
import { must } from './player.ts';

// Edit → Slide Creation Prompt: a ready-made prompt that has an AI agent create a whole presentation in the
// format this viewer opens, plus a short note on doing it with an agent without the fixed prompt.
// The prompt is built from the same lists the code uses, so it cannot drift from what the viewer supports.

const TOKENS = ['bg', 'panel', 'card', 'line', 'text', 'soft', 'muted', 'accent', 'good', 'bad', 'warn', 'warn-bg'];

export const SLIDE_PROMPT = `Create a presentation for Presentation Viewer in this folder.

Topic: [what the talk is about]
Audience: [who it is for]
Length: [number of slides, or minutes]

Folder
- presentation.json: { "title": "Your talk's title" }
- theme.css (optional): set theme tokens on :root, only the ones you change.
- slides/: one HTML file per slide, its name starting with a number that sets the order (01-title.html, 02-agenda.html and so on).

Each slide
- One <section class="slide"> per file, designed for a fixed 1200×675 canvas. Everything fits inside it.
- Build from the viewer's layouts: .kicker, h1/h2, .lead and .section for text; .flow with .box, .box.mid and .arrow; .stats with .stat; .cols with .col, .item and .fix; .steps (add .four for four across) with .step, .when and .cmd; .bottom with .later and .risk.
- For anything else, write your own markup with a <style> inside the slide, every rule under a class unique to that slide.
- Colours and fonts come only from theme tokens: ${TOKENS.map((t) => `var(--${t})`).join(', ')}, var(--font), var(--mono).
- Put speaker notes in <aside class="notes"> inside the slide.

Animations (optional; slides without one fade their blocks up in turn)
- Add slides/NN-name.ts next to NN-name.html, default-exporting (slide, gsap) => a GSAP tween or timeline. GSAP is passed in; the file has no imports.
- Animate into the finished layout with .from() or .fromTo(): previews, the PDF and viewers with reduced motion see the slide without its animation.
- Animate the slide's children, never the .slide element itself.
- Label every tween for the viewer's animation list: data: { label: 'What happens', icons: [...] }, with icon names from: ${Object.keys(ICONS).join(', ')}.

When done, list each slide file with a one-line summary.`;

// A "Copy prompt" button: copies `text`, or, when the clipboard is refused (insecure origin or permissions),
// selects `source` so Cmd+C works and says so.
export const attachCopy = (button: HTMLElement, text: string, source: HTMLElement) => {
  const label = (state: 'ready' | 'copied' | 'manual') => {
    button.replaceChildren(
      createElement(state === 'copied' ? Check : Copy, { width: 16, height: 16, 'aria-hidden': 'true' }),
      { ready: 'Copy prompt', copied: 'Copied', manual: 'Press ⌘C to copy' }[state],
    );
    button.classList.toggle('done', state === 'copied');
  };
  let timer = 0;
  const settle = (state: 'copied' | 'manual') => {
    label(state);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      label('ready');
    }, 2500);
  };
  button.addEventListener('click', () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        settle('copied');
      })
      .catch(() => {
        const range = document.createRange();
        range.selectNodeContents(source);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        settle('manual');
      });
  });
  label('ready');
  return {
    reset: () => {
      label('ready');
    },
  };
};

export const createPromptDialog = () => {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal prompt-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header><h2>Slide Creation Prompt</h2><button class="modal-close" aria-label="Close"></button></header>
      <p class="modal-lead">Give this to an AI agent in an empty folder, then open that folder here.
      Fill in the three lines in brackets first.</p>
      <pre class="pd-prompt" tabindex="0" aria-label="Slide creation prompt"></pre>
      <section class="pd-manual">
        <h3>Or guide it yourself</h3>
        <p>Open your agent in the presentation folder, describe the talk in your own words, and ask it to follow the
        authoring guide in Presentation Viewer's <code>AGENTS.md</code>. Keep the folder open here while it works:
        every saved slide shows up straight away.</p>
      </section>
      <div class="modal-foot"><button class="primary pd-copy" autofocus></button></div>
    </div>`;
  document.body.append(dialog);
  const $ = (sel: string) => must(dialog.querySelector<HTMLElement>(sel), sel);
  $('.modal-close').append(createElement(X, { width: 18, height: 18 }));
  $('pre').textContent = SLIDE_PROMPT;

  const copy = attachCopy($('.pd-copy'), SLIDE_PROMPT, $('pre'));
  $('.modal-close').addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  return {
    show: () => {
      copy.reset();
      dialog.showModal();
    },
  };
};
