import { createElement, X } from 'lucide';
import { must } from './player.ts';

// Help → About Presentation Viewer: why the viewer exists. The copy is a placeholder written by an AI agent until
// the author writes his own, and the modal says so.

export const createAboutDialog = ({ repo }: { repo: string }) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal about-dialog';
  dialog.innerHTML = `
    <div class="modal-body">
      <header><h2>About Presentation Viewer</h2><button class="modal-close" aria-label="Close"></button></header>
      <p class="modal-lead">A slide viewer built for one person's way of working, and shared in case it fits yours.</p>
      <div class="about-copy">
        <p>Stelios got tired of fitting his talks into a presentation app's way of doing things: slides locked inside
        one file format, animations buried in menus, and nothing that a text editor, version control or an AI agent
        could work with directly.</p>
        <p>So he built this one for his own needs. A presentation is a folder of plain HTML slides, each with an
        optional GSAP animation, so any editor or agent can write it. The app shows every slide and every animation
        step, presents it, and exports it as a single HTML file or a PDF.</p>
        <p>It's free and open source under the MIT license. Change it to suit the way you work.</p>
      </div>
      <p class="about-note">Written by an AI agent on Stelios' behalf.</p>
      <div class="modal-foot">
        <a class="modal-link-button" href="https://bitzas.dev" target="_blank" rel="noopener">bitzas.dev ↗</a>
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
