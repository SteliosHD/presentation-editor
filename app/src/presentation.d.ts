declare module 'virtual:presentation' {
  import type { gsap } from 'gsap';

  // A slide's own animation: slides/<name>.ts next to slides/<name>.html, default-exporting this.
  export type SlideAnimation = (slide: HTMLElement, g: typeof gsap) => gsap.core.Animation;

  export interface PresentationSlide {
    file: string;
    html: string;
    animation?: SlideAnimation;
    animationFile?: string;
    // The animation as plain JavaScript, for embedding in downloaded files.
    animationCode?: string;
  }

  export interface Presentation {
    title: string;
    folder: string;
    theme: string;
    slides: PresentationSlide[];
  }

  // Null in the downloadable player, which reads its presentation from the page instead.
  export const presentation: Presentation | null;
}
