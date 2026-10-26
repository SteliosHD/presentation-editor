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

  // Previews are 1200x675 slides scaled to the thumbnail's width, which changes with the screen size.
  const first = list.querySelector<HTMLElement>('.thumb');
  if (first) {
    new ResizeObserver(() => {
      list.style.setProperty('--thumb-scale', (first.clientWidth / 1200).toFixed(4));
    }).observe(first);
  }

  return {
    render: (current: number) => {
      items.forEach((button, k) => button.classList.toggle('active', k === current));
      items[current].scrollIntoView({ block: 'nearest' });
    },
  };
};
