import type { Presentation } from 'virtual:presentation';

// The presentation's title is its folder's name until it is renamed in the viewer. A new name is kept in this
// browser, per folder, and goes into the files it exports; there is no title file in the folder.

const key = (folder: string) => `presentation-viewer:title:${folder}`;

export const applySavedTitle = (presentation: Presentation) => {
  try {
    presentation.title = localStorage.getItem(key(presentation.folder)) ?? presentation.title;
  } catch {
    // Storage blocked: the folder's name stands.
  }
};

const save = (folder: string, title: string | null) => {
  try {
    if (title === null) localStorage.removeItem(key(folder));
    else localStorage.setItem(key(folder), title);
  } catch {
    // Storage blocked: the new name holds until the page reloads.
  }
};

// The title above the slide becomes a text field on click: Enter or leaving it keeps the new name, Esc cancels, and
// an empty name goes back to the folder's.
export const makeTitleEditable = (el: HTMLElement, presentation: Presentation, onChange: () => void) => {
  const folderName = presentation.folder.split('/').at(-1) ?? presentation.folder;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.title = 'Click to rename the presentation';
  const edit = () => {
    const input = document.createElement('input');
    input.className = 'stage-title-input';
    input.value = presentation.title;
    input.setAttribute('aria-label', 'Presentation title');
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      if (keep) {
        const next = input.value.trim();
        presentation.title = next || folderName;
        save(presentation.folder, next && next !== folderName ? next : null);
        el.textContent = presentation.title;
        onChange();
      }
      input.replaceWith(el);
      el.focus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(false);
      }
    });
    input.addEventListener('blur', () => {
      finish(true);
    });
    el.replaceWith(input);
    input.focus();
    input.select();
  };
  el.addEventListener('click', edit);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') edit();
  });
};
