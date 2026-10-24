import type { Presentation } from 'virtual:presentation';
import { must, type Player } from './player.ts';

// The slide list on the left: a small, still copy of each slide. Copied before the first slide animates,
// so each shows its finished state. Slides with their own animation get a "custom" badge.
export const createSlideList = (presentation: Presentation, player: Player) => {
  const list = must(document.querySelector('.slide-list'), '.slide-list');
  const items = presentation.slides.map((slide, k) => {
    const button = document.createElement('button');
    const title = player.elements[k].querySelector('h1, h2')?.textContent ?? slide.file;
    button.innerHTML = `<span class="num">${k + 1}</span><span class="thumb"></span>`;
    const thumb = must(button.querySelector('.thumb'), '.thumb');
    thumb.append(player.elements[k].cloneNode(true));
    if (slide.animation) thumb.insertAdjacentHTML('beforeend', '<span class="badge">custom</span>');
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

  return {
    render: (current: number) => {
      items.forEach((button, k) => button.classList.toggle('active', k === current));
      items[current].scrollIntoView({ block: 'nearest' });
    },
  };
};
