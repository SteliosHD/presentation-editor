// Pictures a presentation keeps in its images/ folder. A slide refers to one by its path from the slide file,
// "../images/dot.jpg" (or "images/dot.jpg"), in an src or a CSS url(); the viewer swaps in the picture itself, so the
// slide looks the same wherever it is shown, exports included. Shared by the local server and the browser.

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export const imageType = (path: string) => TYPES[path.split('.').at(-1)?.toLowerCase() ?? ''];

const REFERENCE = /(["'(]\s*)(?:\.\.\/|\.\/)?(images\/[^"')\s]+)/g;

// The images/ paths a slide refers to, such as "images/logos/slack.svg".
export const imagePaths = (html: string) =>
  [...new Set([...html.matchAll(REFERENCE)].map((match) => decodeURI(match[2])))].filter(imageType);

// `pictures`: data: URLs by path. A path with no picture is left as written, so it shows as a missing image.
export const withImages = (html: string, pictures: Map<string, string>) =>
  html.replace(REFERENCE, (whole, open: string, path: string) => {
    const url = pictures.get(decodeURI(path));
    return url ? `${open}${url}` : whole;
  });
