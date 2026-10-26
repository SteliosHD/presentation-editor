import type { Presentation } from 'virtual:presentation';
import { must, type Player } from './player.ts';

// The slide list on the left: a small, still copy of each slide. Copied before the first slide animates,
// so each shows its finished state. Badges mark slides with their own animation ("custom") and with pop-ups.
export const createSlideList = (presentation: Presentation, player: Player) => {
  const list = must(document.querySelector<HTMLElement>('.slide-list'), '.slide-list');
  const items = presentation.slides.map((slide, k) => {
    const button = document.createElement('button');
    const title = player.elements[k].querySelector('h1, h2')?.textContent ?? slide.file;
    button.innerHTML = `<span class="num">${k + 1}</span><span class="thumb"></span>`;
    const thumb = must(button.querySelector('.thumb'), '.thumb');
    thumb.append(player.elements[k].cloneNode(true));
    // The first line of the slide's notes, shown under the preview in the notes view.
    const note = player.elements[k].querySelector('.notes')?.textContent.trim().split('\n')[0] ?? '';
    button.append(Object.assign(document.createElement('span'), { className: 'thumb-note', textContent: note }));
    const popups = player.elements[k].querySelectorAll('.popup').length;
    const badges = [
      slide.animation ? '<span class="badge">custom</span>' : '',
      popups ? `<span class="badge badge-popup">${popups > 1 ? `${String(popups)} pop-ups` : 'pop-up'}</span>` : '',
    ].join('');
    if (badges) thumb.insertAdjacentHTML('beforeend', `<span class="badges">${badges}</span>`);
    button.title = `${title} (${slide.file})`;
    button.setAttribute('aria-label', `Slide ${k + 1}: ${title}`);
    button.addEventListener('click', () => {
      player.show(k);
    });
    const li = document.createElement('li');
    li.append(button);
    list.append(li);
    return button;
  });

  // Scrolls so the next two slides show below the current one, without losing the current one.
  let shown = 0;
  const reveal = () => {
    items[Math.min(shown + 2, items.length - 1)]?.scrollIntoView({ block: 'nearest' });
    items[shown]?.scrollIntoView({ block: 'nearest' });
  };

  // Previews are 1200x675 slides scaled to the thumbnail's width, which changes with the screen size.
  const first = list.querySelector<HTMLElement>('.thumb');
  if (first) {
    new ResizeObserver(() => {
      list.style.setProperty('--thumb-scale', (first.clientWidth / 1200).toFixed(4));
    }).observe(first);
  }
  // The list's room settles after the first render (the menu loads in later), so it scrolls again whenever it changes.
  const room = list.closest('.sidebar');
  if (room) new ResizeObserver(reveal).observe(room);

  return {
    render: (current: number) => {
      items.forEach((button, k) => button.classList.toggle('active', k === current));
      shown = current;
      reveal();
    },
  };
};
