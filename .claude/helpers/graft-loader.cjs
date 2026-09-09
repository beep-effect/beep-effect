// Repo-owned bootstrap boundary: resolve the same installation as the agent's
// Graft executable, never an initializing user's path or a project fallback.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function trustedPath(candidate) {
  if (typeof process.geteuid !== 'function') return null;
  const uid = process.geteuid();
  try {
    const resolved = fs.realpathSync(candidate);
    for (let cursor = resolved; ; cursor = path.dirname(cursor)) {
      const stat = fs.statSync(cursor);
      if (stat.uid !== uid && stat.uid !== 0) return null;
      // Root-owned sticky temporary directories protect their owned children.
      const stickyRoot = stat.isDirectory() && stat.uid === 0 && (stat.mode & 0o1000) !== 0;
      if ((stat.mode & 0o022) !== 0 && !stickyRoot) return null;
      if (path.dirname(cursor) === cursor) break;
    }
    return resolved;
  } catch { return null; }
}

function resolveEntry(name) {
  if (name !== 'hooks.js' && name !== 'statusline.js') return null;
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const cli = trustedPath(path.join(directory, 'graft'));
    if (!cli) continue;
    const root = path.resolve(path.dirname(cli), '..');
    const metadata = trustedPath(path.join(root, 'package.json'));
    if (!metadata) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(metadata, 'utf8'));
      if (pkg.name !== '@nanonets/graft' || pkg.bin?.graft !== 'dist/cli.js') continue;
      if (cli !== path.join(root, 'dist', 'cli.js')) continue;
      const entry = trustedPath(path.join(root, 'dist', 'claude', name));
      if (entry === path.join(root, 'dist', 'claude', name)) return entry;
    } catch { /* invalid or unavailable installation */ }
  }
  return null;
}

function run(name, ...args) {
  const entry = resolveEntry(name);
  if (entry) {
    return import(pathToFileURL(entry).href).then((module) => module.main(...args)).catch(() => {
      // Optional integration: unavailable Graft must not interrupt the agent.
    });
  }
}

module.exports = { resolveEntry, run };
