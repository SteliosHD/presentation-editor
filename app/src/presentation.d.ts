// The site add-on passed with --site, or null; app/src/site.ts explains it.
declare module 'virtual:site' {
  export type SiteContext = {
    // Shows the Open Presentation folder modal.
    openFolder: () => void;
    // Loads the built-in sample; only in the hosted app.
    trySample?: () => void;
  };

  export type Site = {
    // Runs once when the app starts, before anything renders.
    init?: () => void;
    // The hosted app opened with nothing loaded. Without it, the Open modal shows.
    start?: (ctx: SiteContext) => void;
    // The app's name at the top of the menu was clicked; `back` returns to the app. Without it, the icon is not a button.
    home?: (ctx: SiteContext & { back: () => void }) => void;
    // The footer's HTML. Without it, the footer links the license and the source.
    footer?: string;
    // Extra HTML for the menu's Why use the Presentation Viewer: sections after the built-in ones, and links in its foot.
    about?: { sections?: string; links?: string };
  };

  const site: Site | null;
  export default site;
}

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
