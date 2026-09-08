/**
 * server/files.ts
 *
 * A real file browser over `node:fs`. It is deliberately *not* a shell:
 * every path is resolved and confined to an explicit set of roots, dotfiles
 * and VCS/dependency directories are excluded, and only text files under a
 * size cap are ever returned.
 */
import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

export const BROWSE_ROOTS: string[] = (process.env.GAIA_BROWSE_ROOTS
  ? process.env.GAIA_BROWSE_ROOTS.split(path.delimiter)
  : [process.cwd()]
).map((p) => path.resolve(p));

const DENY_DIR_NAMES = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache', 'coverage']);
const DENY_FILE_PATTERNS = [/^\.env/, /\.pem$/, /\.key$/, /id_rsa/, /credentials?$/i, /\.db$/, /\.db-/, /\.sqlite/];

const MAX_PREVIEW_BYTES = 256 * 1024;
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.txt', '.yml', '.yaml',
  '.toml', '.sh', '.svg', '.env.example', '.gitignore', '.lock',
]);

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  readable: boolean;
}

export interface DirectoryListing {
  root: string;
  path: string;
  parent: string | null;
  entries: FileEntry[];
  denied: boolean;
}

/** Maps a client-supplied logical path onto a real path inside an allowed root. */
function resolveInsideRoots(requested: string): { absolute: string; logical: string } | { error: string } {
  const clean = (requested || '.').replace(/\\/g, '/');
  const isAbsolute = path.isAbsolute(clean);

  for (const root of BROWSE_ROOTS) {
    const base = isAbsolute ? clean : path.join(root, clean);
    const absolute = path.resolve(base);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) continue;

    // Every segment has to be checked, not just the last one: `.git/config`
    // would otherwise slip through because its basename is "config".
    const relative = path.relative(root, absolute) || '.';
    const segments = relative.split(path.sep).filter((segment) => segment && segment !== '.');
    for (const segment of segments) {
      if (DENY_DIR_NAMES.has(segment)) return { error: `access to '${segment}' is blocked` };
    }

    return { absolute, logical: relative };
  }
  return { error: 'path is outside of the browsable roots' };
}

function isDenied(name: string, isDirectory: boolean): boolean {
  if (isDirectory) return DENY_DIR_NAMES.has(name);
  return DENY_FILE_PATTERNS.some((re) => re.test(name));
}

export async function listDirectory(requested: string): Promise<DirectoryListing> {
  const resolved = resolveInsideRoots(requested);
  if ('error' in resolved) throw new FileBrowserError(resolved.error);

  const entries = await readdir(resolved.absolute, { withFileTypes: true });
  const out: FileEntry[] = [];

  for (const entry of entries) {
    if (isDenied(entry.name, entry.isDirectory())) continue;
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    const full = path.join(resolved.absolute, entry.name);
    let size = 0;
    let modified = '';
    try {
      const s = await stat(full);
      size = s.size;
      modified = s.mtime.toISOString();
    } catch {
      // unreadable entry (permissions) — still list it, flagged as unreadable
    }
    out.push({
      name: entry.name,
      path: resolved.logical === '.' ? entry.name : `${resolved.logical}/${entry.name}`,
      isDirectory: entry.isDirectory(),
      size,
      modified,
      readable: !isDenied(entry.name, entry.isDirectory()),
    });
  }

  out.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));

  const root = BROWSE_ROOTS[0];
  return {
    root,
    path: resolved.logical,
    parent: resolved.logical === '.' || resolved.logical === '' ? null : path.dirname(resolved.logical) || '.',
    entries: out,
    denied: false,
  };
}

export interface FilePreview {
  path: string;
  size: number;
  truncated: boolean;
  content: string;
  modified: string;
  encoding: 'utf8';
}

export async function readFilePreview(requested: string): Promise<FilePreview> {
  const resolved = resolveInsideRoots(requested);
  if ('error' in resolved) throw new FileBrowserError(resolved.error);

  const name = path.basename(resolved.absolute);
  if (isDenied(name, false)) throw new FileBrowserError(`'${name}' is blocked by the read policy`);

  const info = await stat(resolved.absolute);
  if (info.isDirectory()) throw new FileBrowserError('that path is a directory — open it instead');

  const extension = path.extname(name).toLowerCase();
  const allowed = TEXT_EXTENSIONS.has(extension) || extension === '' || name === 'LICENSE';
  if (!allowed) throw new FileBrowserError(`'${extension || 'no extension'}' is not a text file`);

  const handle = await readFile(resolved.absolute, { encoding: 'utf8' });
  const truncated = Buffer.byteLength(handle, 'utf8') > MAX_PREVIEW_BYTES;

  return {
    path: resolved.logical,
    size: info.size,
    truncated,
    content: truncated ? handle.slice(0, MAX_PREVIEW_BYTES) : handle,
    modified: info.mtime.toISOString(),
    encoding: 'utf8',
  };
}

export class FileBrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileBrowserError';
  }
}
