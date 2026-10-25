import { Check, Copy, createElement, X } from 'lucide';
import { must } from './player.ts';
import { slidePrompt } from './starter.ts';

// The menu's Slide Creation Prompt: a ready-made prompt that has an AI agent create a whole presentation in the
// format this viewer opens, plus a short note on doing it with an agent without the fixed prompt.

export const SLIDE_PROMPT = slidePrompt();

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
