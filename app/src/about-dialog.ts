import { createElement, X } from 'lucide';
import { must } from './player.ts';
import type { Site } from './site.ts';

// Help → Why use the Presentation Viewer: what the app is for and how it compares with asking Claude in a chat or
// with a slide app, plus any sections and links the site adds. The copy was written by an AI agent, and the modal
// says so.

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
        <h3>How it works</h3>
        <p>A presentation is a folder of numbered HTML slides. Give an agent the prompt from Edit → Slide Creation
        Prompt, open the folder here, and each slide appears as the agent saves it. If one looks wrong, you can
        redirect the agent before it writes the rest. On this website the folder updates live in Chrome and Edge;
        other browsers read it once, so open it again to see changes.</p>
        <h3>Compared with asking Claude in a chat</h3>
        <p>Each slide is its own file, so "fix slide 4" changes that one file and leaves the others as they were.
        The files stay on your computer, and any agent can pick them up later. Every talk uses the same layouts and
        theme. You also get tools a chat page doesn't have: speaker notes in a second window, a laser pointer,
        drawing on slides and slide numbers. For a quick one-off deck a chat is still faster, since it needs no
        folder or agent.</p>
        <h3>Compared with PowerPoint, Google Slides or Keynote</h3>
        <p>Slides are web pages, so any layout or animation is possible, and agents write HTML much better than
        they write PowerPoint files. It's free and runs in any browser, offline too. Those apps are still the better
        choice when you want to move things by hand, edit with others and leave comments, or hand in a .pptx built on
        a company template.</p>
        <h3>Who it's for</h3>
        <p>People who already work with an AI agent and want animated slides that look the way they want, reuse
        them for the next talk, and present from the browser.</p>
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
