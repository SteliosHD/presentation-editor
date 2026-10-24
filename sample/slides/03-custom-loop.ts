// Animation for 03-custom-loop.html. The presentation calls it with the slide and GSAP, and reverts what it returns
// when the slide is left, so the endless pulse stops there. Each step's data field labels it in the app's
// animation list; see presentation-viewer/AGENTS.md.
export default (slide: HTMLElement, gsap: typeof import('gsap').gsap) => {
  const $ = (sel: string) => slide.querySelectorAll(sel);
  const length = (_: number, el: SVGGeometryElement) => el.getTotalLength();
  return gsap
    .timeline({ defaults: { ease: 'power2.out' } })
    .from($('.kicker, h2'), {
      opacity: 0,
      y: 24,
      duration: 0.5,
      stagger: 0.07,
      data: { label: 'Heading rises in', icons: ['fade', 'move'] },
    })
    .from(
      $('.hub'),
      {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(2)',
        data: { label: 'Agent pops in', icons: ['scale'] },
      },
      '-=0.2',
    )
    .fromTo(
      $('.loop line'),
      { strokeDasharray: length, strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 0.6,
        stagger: 0.15,
        data: { label: 'Connections draw out', icons: ['draw', 'stagger'] },
      },
    )
    .from(
      $('.node:not(.hub)'),
      {
        scale: 0,
        opacity: 0,
        duration: 0.4,
        ease: 'back.out(2)',
        stagger: 0.15,
        data: { label: 'Plan, Act, Check appear', icons: ['scale', 'stagger'] },
      },
      '<0.3',
    )
    .fromTo(
      $('.hub'),
      { '--pulse': 0 },
      {
        '--pulse': 1,
        duration: 1.6,
        repeat: -1,
        ease: 'none',
        data: { label: 'Agent keeps pulsing', icons: ['glow', 'loop'] },
      },
    );
};
