// Animation for 10-ten-steps.html: ten labelled steps, to see how a long animation reads in the app's list. The last
// one loops; the app reverts it when the slide is left.
export default (slide: HTMLElement, gsap: typeof import('gsap').gsap) => {
  const $ = (sel: string) => slide.querySelectorAll(sel);
  const length = (_: number, el: SVGGeometryElement) => el.getTotalLength();
  return gsap
    .timeline({ defaults: { ease: 'power2.out' } })
    .from($('.kicker'), {
      opacity: 0,
      x: -20,
      duration: 0.4,
      data: { label: 'Label slides in', icons: ['fade', 'move-sideways'] },
    })
    .from(
      $('h2'),
      { opacity: 0, y: 24, duration: 0.5, data: { label: 'Title rises in', icons: ['fade', 'move'] } },
      '-=0.2',
    )
    .from($('.dash-metric'), {
      opacity: 0,
      y: 16,
      duration: 0.4,
      stagger: 0.1,
      data: { label: 'Four figures appear', icons: ['fade', 'stagger'] },
    })
    .from(
      $('.dash-value'),
      {
        filter: 'blur(6px)',
        duration: 0.6,
        stagger: 0.1,
        data: { label: 'Figures come into focus', icons: ['glow', 'stagger'] },
      },
      '<0.1',
    )
    .from($('.dash-chart'), {
      opacity: 0,
      scale: 0.96,
      duration: 0.4,
      data: { label: 'Chart panel opens', icons: ['fade', 'scale'] },
    })
    .from($('.dash-bar'), {
      scaleY: 0,
      duration: 0.5,
      stagger: 0.08,
      data: { label: 'Bars grow, left to right', icons: ['scale', 'stagger'] },
    })
    .from($('.dash-bar.dash-peak'), {
      backgroundColor: 'transparent',
      duration: 0.4,
      data: { label: 'Best quarter lights up', icons: ['highlight'] },
    })
    .fromTo(
      $('.dash-trend'),
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 0.8, data: { label: 'Trend line draws across', icons: ['draw'] } },
    )
    .from($('.dash-badge'), {
      opacity: 0,
      scale: 0.6,
      duration: 0.4,
      ease: 'back.out(2)',
      data: { label: 'Growth badge pops in', icons: ['scale'] },
    })
    .to($('.dash-badge'), {
      scale: 1.06,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      data: { label: 'Badge keeps breathing', icons: ['scale', 'loop'] },
    });
};
