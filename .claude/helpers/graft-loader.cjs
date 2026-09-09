// Repo-owned bootstrap boundary: resolve the same installation as the agent's
// Graft executable, never an initializing user's path or a project fallback.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");

// Get-Acl exposes numeric SIDs and access masks without localized account names.
// Input paths travel over stdin, never through PowerShell source interpolation.
const windowsAclScript = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$paths = ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())
$sidType = [System.Security.Principal.SecurityIdentifier]
$rows = @(foreach ($item in $paths) {
  $acl = Get-Acl -LiteralPath $item
  $raw = [System.Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)
  if ($null -eq $raw.DiscretionaryAcl) { throw 'Null DACL' }
  @{
    path = $item
    owner = $acl.GetOwner($sidType).Value
    rules = @($acl.GetAccessRules($true, $true, $sidType) | ForEach-Object {
      @{
        sid = $_.IdentityReference.Value
        allow = $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow
        inheritOnly = ($_.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0
        rights = [int64]$_.FileSystemRights
      }
    })
  }
})
@{ user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; rows = $rows } | ConvertTo-Json -Depth 6 -Compress
`;

function windowsPathsTrusted(files, root) {
  const queried = new Map();
  for (const file of files) {
    for (let cursor = file; ; cursor = path.dirname(cursor)) {
      const relative = path.relative(root, cursor);
      const inside =
        relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
      queried.set(cursor, queried.get(cursor) || inside || files.includes(cursor));
      if (path.dirname(cursor) === cursor) break;
    }
  }
  try {
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot || !path.isAbsolute(systemRoot)) return false;
    const shell = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const result = JSON.parse(
      execFileSync(
        shell,
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(windowsAclScript, "utf16le").toString("base64"),
        ],
        {
          input: JSON.stringify([...queried.keys()]),
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 5000,
          windowsHide: true,
        }
      )
    );
    if (typeof result.user !== "string" || !/^S-1-(?:\d+-)+\d+$/.test(result.user)) return false;
    if (!Array.isArray(result.rows) || result.rows.length !== queried.size) return false;
    const trusted = new Set([
      result.user,
      "S-1-5-18",
      "S-1-5-32-544",
      "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464", // TrustedInstaller
    ]);
    for (const row of result.rows) {
      if (!queried.has(row.path) || !trusted.has(row.owner) || !Array.isArray(row.rules)) return false;
      // Outside the installation, creation of sibling directories is harmless;
      // replacement of an existing ancestor or changing its ACL is not.
      const mutationMask = queried.get(row.path) ? 0x500d0156 : 0x500d0152;
      for (const rule of row.rules) {
        if (
          typeof rule.sid !== "string" ||
          typeof rule.allow !== "boolean" ||
          typeof rule.inheritOnly !== "boolean" ||
          !Number.isInteger(rule.rights) ||
          rule.rights < -2147483648 ||
          rule.rights > 4294967295
        )
          return false;
        if (rule.allow && !rule.inheritOnly && !trusted.has(rule.sid) && (rule.rights & mutationMask) !== 0)
          return false;
      }
      queried.delete(row.path);
    }
    return queried.size === 0;
  } catch {
    return false;
  }
}

function trustedPath(candidate) {
  if (typeof process.geteuid !== "function") return null;
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
  } catch {
    return null;
  }
}

function resolveEntry(name) {
  if (name !== "hooks.js" && name !== "statusline.js") return null;
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    try {
      const windows = process.platform === "win32";
      const cli = windows
        ? fs.realpathSync(path.join(directory, "graft.cmd"))
        : trustedPath(path.join(directory, "graft"));
      if (!cli) continue;
      const root = windows
        ? fs.realpathSync(path.join(path.dirname(cli), "node_modules", "@nanonets", "graft"))
        : path.resolve(path.dirname(cli), "..");
      const metadataPath = path.join(root, "package.json");
      const metadata = windows ? fs.realpathSync(metadataPath) : trustedPath(metadataPath);
      if (!metadata || metadata !== metadataPath) continue;
      const pkg = JSON.parse(fs.readFileSync(metadata, "utf8"));
      if (pkg.name !== "@nanonets/graft" || pkg.bin?.graft !== "dist/cli.js") continue;
      const executablePath = path.join(root, "dist", "cli.js");
      const executable = fs.realpathSync(executablePath);
      if (executable !== executablePath || (!windows && cli !== executable)) continue;
      const entryPath = path.join(root, "dist", "claude", name);
      const entry = windows ? fs.realpathSync(entryPath) : trustedPath(entryPath);
      if (entry !== entryPath) continue;
      if (!windows || windowsPathsTrusted([cli, executable, metadata, entry], root)) return entry;
    } catch {
      /* invalid or unavailable installation */
    }
  }
  return null;
}

// Graft's session upkeep rewrites this repo's tracked wiring (settings blocks,
// shims, MCP entries, the AGENTS.md section, and with default options the
// machine-wide Codex config) whenever `graft/.cache/wiring-stamp.json` is
// missing or names another version. The cache is git-ignored, so every fresh
// checkout and every upgrade would otherwise drift on its first session. The
// repository owns the wiring: record the running version as already applied
// before any Graft entry point runs, so reconcile is a no-op by construction.
function ensureWiringStamp(entry) {
  try {
    const root = path.resolve(path.dirname(entry), "..", "..");
    const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    if (typeof version !== "string" || version === "") return;
    const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const graftDir = path.join(repo, process.env.GRAFT_DIR || "graft");
    const stampPath = path.join(graftDir, ".cache", "wiring-stamp.json");
    try {
      if (JSON.parse(fs.readFileSync(stampPath, "utf8")).version === version) return;
    } catch {
      /* missing or unreadable stamp: write one */
    }
    const hosts = ["claude"];
    if (fs.existsSync(path.join(repo, "AGENTS.md"))) hosts.push("agents");
    if (fs.existsSync(path.join(repo, ".grok", "skills", "graft", "SKILL.md"))) hosts.push("grok");
    fs.mkdirSync(path.dirname(stampPath), { recursive: true });
    const tmp = `${stampPath}.${process.pid}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify(
        {
          version,
          hosts: hosts.sort(),
          opts: { global: false, mcp: false, hooks: true, statusline: true },
          at: new Date().toISOString(),
        },
        null,
        2
      )
    );
    fs.renameSync(tmp, stampPath);
  } catch {
    /* best effort: an unwritable cache only means upkeep may refresh once */
  }
}

function run(name, ...args) {
  const entry = resolveEntry(name);
  if (entry) {
    ensureWiringStamp(entry);
    return import(pathToFileURL(entry).href)
      .then((module) => module.main(...args))
      .catch(() => {
        // Optional integration: unavailable Graft must not interrupt the agent.
      });
  }
}

module.exports = { ensureWiringStamp, resolveEntry, run, windowsPathsTrusted };
