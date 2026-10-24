import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Native macOS file dialogs, shown by the server through osascript, since a web page cannot learn real paths.
// `activate` brings osascript's own dialog to the front without needing permission to control another app.
// Each returns the chosen path, or null when the user cancels.

const run = promisify(execFile);
const quote = (text: string) => `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

const ask = async (script: string) => {
  if (process.platform !== 'darwin') throw new Error('File dialogs need macOS; use the path box under ▾ instead.');
  try {
    const { stdout } = await run('osascript', ['-e', 'activate', '-e', `POSIX path of (${script})`]);
    return stdout.trim().replace(/\/$/, '');
  } catch (err) {
    if (String(err).includes('(-128)')) return null;
    throw err;
  }
};

export const chooseFolder = (startIn: string) =>
  ask(`choose folder with prompt "Open a presentation folder" default location (POSIX file ${quote(startIn)})`);

export const chooseSaveFile = (title: string, name: string, startIn: string) =>
  ask(
    `choose file name with prompt ${quote(title)} default name ${quote(name)} default location (POSIX file ${quote(startIn)})`,
  );
