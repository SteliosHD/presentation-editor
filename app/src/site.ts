import site from 'virtual:site';

// The site add-on: an optional module that a hosted site built around this tool supplies, for what belongs to
// that site rather than to the tool (a landing page, credits, analytics). Pass it with --site <file> to
// bin/presentation-viewer.ts or server/build-web.ts; the file default-exports a `Site` (its fields are described
// in presentation.d.ts). Without one, the tool behaves as each field's default says.

export type { Site, SiteContext } from 'virtual:site';

export default site;

// Helpers for add-ons, so they need nothing from the app's internals.
export { must, reduceMotion } from './player.ts';
