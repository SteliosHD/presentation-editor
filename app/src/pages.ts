// A PDF shows each slide as it ends, without its pop-ups, then once more for each pop-up, with that pop-up laid over
// it. Adds those extra pages after each slide. Self-contained, so the local export can run it in the page it prints.
export const addPopupPages = (slides: Iterable<HTMLElement>) => {
  for (const slide of slides) {
    let last = slide;
    slide.querySelectorAll('.popup').forEach((_, n) => {
      const page = slide.cloneNode(true) as HTMLElement;
      page.querySelectorAll('.popup')[n].classList.add('shown');
      last.after(page);
      last = page;
    });
  }
};
