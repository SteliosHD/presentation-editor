import { animationPrefs } from './animation-prefs.ts';
import type { Player } from './player.ts';

// Pop-ups (see animations.ts) stay hidden while editing, so the slide underneath can be worked on. Replay or playing a
// step shows them until you leave the slide, and so does the switch above the slide, which appears only on slides
// that have one. Presenting and exported files always show them.
export const createPopupSwitch = (player: Player, head: Element) => {
  const button = document.createElement('button');
  button.className = 'popup-switch';
  button.setAttribute('role', 'switch');
  button.innerHTML = '<span class="popup-switch-track"></span>Hide pop-ups';
  head.append(button);

  let revealed = false;
  let slide = -1;
  const hiding = () => animationPrefs.get().hidePopups && !revealed;
  const apply = () => {
    document.body.classList.toggle('hide-popups', animationPrefs.get().hidePopups);
    document.body.classList.toggle('popups-shown', revealed);
    button.setAttribute('aria-checked', String(hiding()));
    button.title = hiding()
      ? "This slide's pop-ups are hidden while editing. Presenting shows them."
      : "This slide's pop-ups are showing.";
  };

  button.addEventListener('click', () => {
    if (hiding()) animationPrefs.set({ hidePopups: false });
    else {
      revealed = false;
      animationPrefs.set({ hidePopups: true });
    }
  });
  animationPrefs.onChange(apply);

  return {
    render: (current: number) => {
      if (current !== slide) revealed = false;
      slide = current;
      button.hidden = !player.elements[current]?.querySelector('.popup');
      apply();
    },
    // Replay, or a step played from the list.
    reveal: () => {
      revealed = true;
      apply();
    },
  };
};
