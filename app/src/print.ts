import type { Presentation } from 'virtual:presentation';
import { addPopupPages } from './pages.ts';
import { toSlide } from './player.ts';

// A PDF with real, selectable text: the browser's own print, saved as PDF. Fresh copies of the slides go on a print
// stage (so the slide on show is untouched), each pop-up gets its own page as in the other PDF (pages.ts), and the
// print styles in app.css put one slide on each 1200×675 page. The browser's print dialog opens to save it.
export const printPdf = async (presentation: Presentation) => {
  const stage = document.createElement('div');
  stage.className = 'print-stage';
  const slides = presentation.slides.map((slide) => toSlide(slide.html));
  stage.append(...slides);
  addPopupPages(slides);
  document.body.append(stage);
  document.body.classList.add('printing-text');
  await Promise.all(
    [...stage.querySelectorAll('img')].map((img) =>
      img.decode().catch(() => {
        // A picture that can't load prints as missing, as it shows on screen.
      }),
    ),
  );
  const title = document.title;
  // The PDF's suggested file name.
  document.title = presentation.title;
  const done = () => {
    stage.remove();
    document.body.classList.remove('printing-text');
    document.title = title;
    removeEventListener('afterprint', done);
  };
  addEventListener('afterprint', done);
  print();
};
