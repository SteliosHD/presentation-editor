import { Check, createElement, Minus, X } from 'lucide';
import { must } from './player.ts';
import type { Site } from './site.ts';

// Help → Why use the Presentation Viewer: three steps on how it works and a compact comparison with asking a chat
// for slides and with a slide app, plus any sections and links the site adds. The copy was written by an AI agent,
// and the modal says so.

const STEPS: [string, string][] = [
  ['Ask an agent', 'Give it the prompt from Edit → Slide Creation Prompt and your topic.'],
  ['Open its folder here', 'Each slide appears as it is saved; live in Chrome and Edge.'],
  ['Present or export', 'Press F to present, or export one HTML file or a PDF.'],
];

// Each answer: yes, partly or no, and the few words shown on hover.
type Answer = ['yes' | 'partly' | 'no', string];
const COMPARE: [string, Answer, Answer, Answer][] = [
  [
    'See slides as they are written',
    ['no', 'Only at the end'],
    ['no', 'You build each one'],
    ['yes', 'Live, slide by slide'],
  ],
  ['Change one slide only', ['partly', 'Often redoes the deck'], ['yes', 'By hand'], ['yes', 'One file per slide']],
  [
    'Any layout or animation',
    ['partly', 'Within one page'],
    ['partly', 'Within its templates'],
    ['yes', 'Anything a web page can do'],
  ],
  ['Notes, laser and pen', ['no', 'No presenting tools'], ['yes', 'Built in'], ['yes', 'In the browser']],
  [
    'One file that plays offline',
    ['no', 'Not as a deck'],
    ['partly', 'Needs the app, or a PDF'],
    ['yes', 'One HTML file'],
  ],
  ['Move things by hand', ['no', 'No'], ['yes', 'Drag and drop'], ['no', 'Ask the agent instead']],
  ['Edit together', ['no', 'No'], ['yes', 'In Google Slides'], ['no', 'Not yet']],
];
const MARKS = { yes: Check, partly: Minus, no: X } as const;
const WORDS = { yes: 'Yes', partly: 'Partly', no: 'No' } as const;

export const createAboutDialog = ({ repo, extra }: { repo: string; extra?: Site['about'] }) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal about-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header>
        <h2>Why use the Presentation Viewer</h2><button class="modal-close" aria-label="Close"></button>
      </header>
      <p class="modal-lead">An AI agent writes the slides. The viewer shows them while it works, and you present
      them from here.</p>
      <div class="about-copy">
        <ol class="about-steps">
          ${STEPS.map(([title, text]) => `<li><b>${title}</b><span>${text}</span></li>`).join('')}
        </ol>
        <h3>Compared with a chat or a slide app</h3>
        <div class="about-compare" role="table" aria-label="Compared with a chat and a slide app">
          <div class="about-row about-head" role="row">
            <span role="columnheader"></span><span role="columnheader">Chat</span>
            <span role="columnheader">Slide app</span><span role="columnheader" class="is-us">Viewer</span>
          </div>
          ${COMPARE.map(
            ([what, ...answers]) => `
            <div class="about-row" role="row">
              <span role="rowheader">${what}</span>
              ${answers
                .map(
                  ([mark, words], k) =>
                    `<span role="cell" class="about-cell ${mark}${k === 2 ? ' is-us' : ''}" title="${words}" aria-label="${WORDS[mark]}: ${words}"><i data-mark="${mark}"></i></span>`,
                )
                .join('')}
            </div>`,
          ).join('')}
        </div>
        <p class="about-pick">A slide app is still the better pick for moving things by hand or editing with others,
        and a chat is quickest for a one-off deck.</p>
        ${extra?.sections ?? ''}
      </div>
      <p class="about-note">Written by an AI agent.</p>
      <div class="modal-foot">
        ${extra?.links ?? ''}
        <a class="modal-link-button" href="${repo}" target="_blank" rel="noopener">Source on GitHub ↗</a>
      </div>
    </div>`;
  document.body.append(dialog);
  const close = must(dialog.querySelector('.modal-close'), '.modal-close');
  close.append(createElement(X, { width: 18, height: 18 }));
  for (const el of dialog.querySelectorAll<HTMLElement>('.about-cell i')) {
    el.append(
      createElement(MARKS[el.dataset.mark as keyof typeof MARKS], { width: 13, height: 13, 'aria-hidden': 'true' }),
    );
  }
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  return {
    show: () => {
      dialog.showModal();
    },
  };
};
