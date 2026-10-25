import { ICONS } from './animations.ts';
import themeSource from './theme.css?raw';

// A new presentation for an AI agent to write: the brief (the slide prompt with the talk's details and exactly where
// to work) and the starter files that go with it. The prompt is built from the same lists the code uses, so it
// cannot drift from what the viewer supports. The menu's Slide Creation Prompt is the same prompt without details.

export type Details = { topic: string; audience: string; length: string };
// The folder's name, and its full path when it is known (the local app knows it; a browser only learns the name).
export type Where = { folder: string; path?: string };
export type StarterFile = { path: string; content: string };

const TOKENS = ['bg', 'panel', 'card', 'line', 'text', 'soft', 'muted', 'accent', 'good', 'bad', 'warn', 'warn-bg'];
export const BRIEF_FILE = 'AGENTS.md';

const whereToWork = ({ folder, path }: Where) => {
  const root = path ?? `the folder named “${folder}” (open me in it, or tell me where it is)`;
  const slides = path ? `${path}/slides/` : `${folder}/slides/`;
  return `Where to work
- The presentation folder is ${root}. Work only inside it.
- Write each slide to ${slides}. slides/01-welcome.html is a placeholder: delete it once your first slide is saved.
- Give the talk its look in theme.css: uncomment and change only the tokens the style needs.
- Leave ${BRIEF_FILE} as it is: it holds these instructions.

`;
};

export const slidePrompt = (
  details?: Details,
  where?: Where,
) => `Create a presentation for Presentation Viewer${where ? '' : ' in this folder'}.

Topic: ${details?.topic.trim() || '[what the talk is about]'}
Audience: ${details?.audience.trim() || '[who it is for]'}
Length: ${details?.length.trim() || '[number of slides, or minutes]'}

${where ? whereToWork(where) : ''}Before you write anything
- Ask me questions and wait for my answers: the style and look (colours, mood, a brand to follow), what each part should cover, slides I must have, data, quotes or images to use, and the tone.
- Then show me a slide-by-slide outline, each file name with a one-line summary, and start only once I approve it.

Folder
- theme.css (optional): set theme tokens on :root, only the ones you change.
- There is no title file: the presentation's title is the folder's name, and I can rename it in the viewer.
- slides/: one HTML file per slide, its name starting with a number that sets the order (01-title.html, 02-agenda.html and so on).

Each slide
- One <section class="slide"> per file, designed for a fixed 1200×675 canvas. Everything fits inside it.
- Build from the viewer's layouts: .kicker, h1/h2, .lead and .section for text; .flow with .box, .box.mid and .arrow; .stats with .stat; .cols with .col, .item and .fix; .steps (add .four for four across) with .step, .when and .cmd; .bottom with .later and .risk.
- For anything else, write your own markup with a <style> inside the slide, every rule under a class unique to that slide.
- Colours and fonts come only from theme tokens: ${TOKENS.map((t) => `var(--${t})`).join(', ')}, var(--font), var(--mono).
- Put speaker notes in <aside class="notes"> inside the slide.

Animations (optional; slides without one fade their blocks up in turn)
- Add slides/NN-name.ts next to NN-name.html, default-exporting (slide, gsap) => a GSAP tween or timeline. GSAP is passed in; the file has no imports.
- Animate into the finished layout with .from() or .fromTo(): previews, the PDF and viewers with reduced motion see the slide without its animation.
- Animate the slide's children, never the .slide element itself.
- Label every tween for the viewer's animation list: data: { label: 'What happens', icons: [...] }, with icon names from: ${Object.keys(ICONS).join(', ')}.
- To reveal a step only when the presenter clicks or presses →, add click: true to its data.

When done, list each slide file with a one-line summary.`;

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// The default theme with every token commented out, under a note for the agent: uncommenting one overrides it.
const starterTheme = () => {
  const body = themeSource.slice(themeSource.indexOf(':root')).replaceAll(/^(\s*)(--[\w-]+:[^;]+;)$/gm, '$1/* $2 */');
  return `/*
 * This presentation's theme. Every token below is the viewer's default, commented out.
 * Agent: once the style is agreed, uncomment and change only the tokens it needs; leave the rest as they are.
 * One accent colour; good / bad / warn only for meaning. Keep text readable from the back of a room.
 */
${body}`;
};

const welcomeSlide = (topic: string) => `<section class="slide">
  <!-- A placeholder while the agent works. Agent: delete this file once your first slide is saved. -->
  <p class="kicker">Being written</p>
  <h1>${escape(topic.trim() || 'Your presentation')}</h1>
  <p class="lead">Your agent is writing this presentation. Each slide appears here as soon as it is saved.</p>
  <aside class="notes">Placeholder from Presentation Viewer's starter folder.</aside>
</section>
`;

export const starterFiles = (details: Details, where: Where): StarterFile[] => [
  {
    path: BRIEF_FILE,
    content: `<!-- Made by Presentation Viewer: the brief for the AI agent writing this presentation. -->\n\n${slidePrompt(details, where)}\n`,
  },
  { path: 'theme.css', content: starterTheme() },
  { path: 'slides/01-welcome.html', content: welcomeSlide(details.topic) },
];
