# Presentation Editor

A local app for presentations. A presentation is a folder of HTML slides, each with an optional GSAP animation. The app opens a presentation to edit, present (F) and export (HTML or PDF).

Run it with `node bin/presentation-editor.ts <presentation folder>` (or `presentation-editor <folder>` once linked). It serves http://localhost:4747 and reloads whenever the open presentation's slides, theme or `presentation.json` change. `sample/` is a working presentation to copy from.

## A presentation

```
my-presentation/
  presentation.json     { "title": "..." }  optional, defaults to the folder name
  theme.css             optional; overrides the default theme's tokens
  slides/
    01-title.html       one slide; the file name sets the order
    03-diagram.html
    03-diagram.ts       optional: that slide's own animation
  export/               written by Export; never edit
```

## Making a slide

1. Create `slides/NN-name.html` holding one `<section class="slide">`. The slide is a fixed 1200×675 canvas, scaled to fit.
2. Build it from the layouts in `app/src/slides.css` (each has a comment saying what it is; `sample/slides/` shows them in use), or from your own markup. Your own styles go in a `<style>` inside the slide, every rule under a class unique to that slide.
3. Colour and type come only from theme tokens: `var(--accent)`, `var(--font)` and so on, listed in `app/src/theme.css`.
4. Put speaker notes in `<aside class="notes">` inside the slide. They show only in the notes window (N).
5. For a custom animation, add `slides/NN-name.ts` with the same base name (see "Slide animations").

Done when the slide appears in the app's slide list, its content fits inside the 1200×675 frame (print and PDF clip anything outside), every step in the animation list above the slide reads as intended, and it looks right in presentation mode (F).

## Slide animations

Without its own `.ts` file, a slide gets the default entrance: its top-level blocks fade up one after another, and the cards inside `.flow`, `.stats`, `.cols`, `.steps` and `.bottom` come in one by one.

A slide's `.ts` file default-exports one function:

```ts
export default (slide: HTMLElement, gsap: typeof import('gsap').gsap) =>
  gsap.timeline().from(slide.querySelectorAll('.box'), { opacity: 0, y: 24, stagger: 0.1 });
```

- GSAP arrives as the second argument, so the file needs no imports and the presentation folder needs no `node_modules`.
- Return the tween or timeline. The app reverts it when the slide is left, so infinite loops (`repeat: -1`) are safe.
- Animate into the slide's natural layout with `.from()` / `.fromTo()`. The slide-list previews, the PDF and viewers with reduced motion switched on see slides without their animations, so the HTML and CSS alone must be the finished slide.
- Animate the slide's children. The `.slide` element's own transform holds its fit-to-screen scale.

`sample/slides/03-custom-loop.ts` is a complete example: drawn SVG lines, staggered nodes and a looping CSS-variable pulse.

## Annotating animations

The animation list above the slide shows one row per tween: timing, targets, what changes, easing, and icons. It names targets by their first class, so give animated elements a meaningful first class.

Annotate every tween in a custom animation through GSAP's `data` field:

```ts
.from(nodes, { scale: 0, stagger: 0.15, data: { label: 'Plan, Act, Check appear', icons: ['scale', 'stagger'] } })
```

- `label` replaces the generated description; the generated one stays as the row's tooltip.
- `icons` are names from `ICONS` in `app/src/animations.ts`. An unknown name shows a sparkle marked "unknown icon name".
- Unannotated tweens get icons chosen from the properties they animate.

## Theme

A presentation's `theme.css` sets values for the tokens in `app/src/theme.css` and loads after it, so it lists only the tokens it changes. The brief at the top of `app/src/theme.css` is the rulebook for a new theme.

## Working on Presentation Editor itself

The same app runs in four Vite modes; `app/src/source.ts` decides where the presentation comes from in each.

| Mode          | Built by                                       | Presentation from                                                                     | Open / Export                                                            |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `development` | `bin/presentation-editor.ts` (local server)    | the folder on disk, live-reloaded                                                     | macOS dialogs via the server (`server/dialogs.ts`); Chrome makes the PDF |
| `web`         | `pnpm build:web` → `dist/` (hosted, Vercel)    | a folder the viewer picks or drops, read in the browser; the bundled sample otherwise | browser folder picker; downloads built in the browser                    |
| `export`      | local Export HTML                              | baked in at build time                                                                | none                                                                     |
| `template`    | `pnpm build:web` → `dist/export-template.html` | JSON the hosted Export HTML embeds in the page                                        | none                                                                     |

- `pnpm typecheck`, `pnpm lint` and `pnpm format:check` pass before a change is finished.
- `app/src/main.ts` only wires the parts; each feature has its own module (`player`, `slide-list`, `animation-list`, `toolbar`, `presentation-mode`, `ink`, `nav` with the File and View menus, `open-dialog`).
- Every colour comes from a theme token; `app/src/theme.css` is the only file holding colour values, apart from `app/favicon.svg`, which browsers load on its own.
- Slide HTML and app chrome share one page, so app classes need names no slide layout uses. `.step` belongs to slides; the animation list uses `.anim-step`.
- The nav bar and the animation list are authoring tools: `export` and `template` builds leave them out. The slide list, toolbar, notes, pointer, numbers, drawing and presentation mode ship in exported files.
- The local server's `/api` handles only JSON POSTs from the app's own page; anything else passes through to Vite.
