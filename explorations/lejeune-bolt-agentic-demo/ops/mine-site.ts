/**
 * Ethical, reproducible miner for the public LeJeune Bolt first-party sites.
 * It uses an honest identity, obeys robots.txt, sends serial requests at least one second apart
 * per host, and stops on any 401, 403, or 429 without retrying, even with Retry-After.
 * Usage: bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts [--dry-run] [--root PATH]
 * Output stays staged until its manifest and hashes validate, then atomically updates current.
 * Runs contain manifest.jsonl, run.log, pages/, files/, meta/robots/, and meta/sitemaps/.
 */
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, readFile, realpath, rename, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const UA =
  "beep-explorations-site-miner/0.1 (research corpus for explorations/" +
  "lejeune-bolt-agentic-demo; contact via repository)";
const UA_TOKEN = "beep-explorations-site-miner";
const HOSTS = new Set([
  "lejeunebolt.com",
  "www.lejeunebolt.com",
  "rentals.lejeunebolt.com",
  "www.rentals.lejeunebolt.com",
  "tightenright.com",
  "www.tightenright.com",
]);
const PREFLIGHT = ["https://lejeunebolt.com/", "https://www.tightenright.com/"];
const FILE_EXT = new Set([".pdf", ".docx", ".xlsx", ".dxf", ".dwg"]);
const SKIP_EXT = new Set([
  ".avif",
  ".bmp",
  ".css",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".map",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
]);
const TRACKING = /^(utm_.+|fbclid|gclid|dclid|_ga|mc_cid|mc_eid)$/i;
type Kind = "robots" | "sitemap" | "page" | "file";
type Rule = { allow: boolean; path: string };
type Robots = { groups: Array<{ agents: string[]; rules: Rule[]; delay: number }>; sitemaps: string[] };
type Policy = { current: Robots; previous?: Robots; changed: boolean };
type Entry = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bytes: number;
  sha256: string;
  fetchedAt: string;
  robotsDecision: string;
  artifact?: string;
};
type Result = { entry: Entry; path: string };
class Stop extends Error {
  constructor(
    message: string,
    readonly exitCode = 1
  ) {
    super(message);
  }
}
const decoder = new TextDecoder();
const now = () => new Date().toISOString();
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const usage = () =>
  [
    "Usage: bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts [options]",
    "  --help         Show help.  --dry-run lists bootstrap URLs without fetching or writing.",
    "  --root <path>  Root (default: LEJEUNE_CORPUS_ROOT or ~/data-home/lejeune-bolt-corpus).",
    "Environment: LEJEUNE_REQUEST_CAP sets the per-host cap (default 800).",
  ].join("\n");
function parseArgs(argv: string[]): { dryRun: boolean; root: string } {
  let dryRun = false;
  let root = process.env.LEJEUNE_CORPUS_ROOT ?? join(homedir(), "data-home/lejeune-bolt-corpus");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--root" && argv[i + 1]) root = argv[++i];
    else throw new Stop(`unknown or incomplete option: ${argv[i]}\n${usage()}`, 2);
  }
  return { dryRun, root };
}
async function canonical(path: string): Promise<string> {
  const expanded = path === "~" ? homedir() : path.startsWith(`~${sep}`) ? join(homedir(), path.slice(2)) : path;
  const absolute = resolve(expanded);
  try {
    return await realpath(absolute);
  } catch {
    if (dirname(absolute) === absolute) throw new Stop(`cannot resolve corpus root: ${path}`, 2);
    return join(await canonical(dirname(absolute)), basename(absolute));
  }
}
function normalize(raw: string, base?: string): string | undefined {
  try {
    const url = new URL(raw.replaceAll("&amp;", "&"), base);
    if (url.protocol !== "https:" || !HOSTS.has(url.hostname.toLowerCase())) return undefined;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch {
    return undefined;
  }
}
function classify(url: string): Kind | "skip" {
  const ext = extname(new URL(url).pathname).toLowerCase();
  return FILE_EXT.has(ext) ? "file" : SKIP_EXT.has(ext) ? "skip" : "page";
}
function parseRobots(body: string): Robots {
  const groups: Robots["groups"] = [];
  const sitemaps: string[] = [];
  let group: Robots["groups"][number] | undefined;
  let directives = false;
  for (const source of body.split(/\r?\n/)) {
    const line = source.replace(/\s*#.*$/, "").trim();
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!group || directives) {
        group = { agents: [], rules: [], delay: 0 };
        groups.push(group);
        directives = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === "allow" || key === "disallow")) {
      directives = true;
      if (value) group.rules.push({ allow: key === "allow", path: value });
    } else if (group && key === "crawl-delay") {
      directives = true;
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) group.delay = delay;
    }
  }
  return { groups, sitemaps };
}
function applicable(policy: Robots): { rules: Rule[]; delay: number } {
  const exact = policy.groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && UA_TOKEN.includes(agent))
  );
  const selected = exact.length ? exact : policy.groups.filter((group) => group.agents.includes("*"));
  return {
    rules: selected.flatMap((group) => group.rules),
    delay: Math.max(1, ...selected.map((group) => group.delay || 0)),
  };
}
function decide(url: string, robots: Robots): { allowed: boolean; note: string } {
  const parsed = new URL(url);
  const target = parsed.pathname + parsed.search;
  const matches = applicable(robots).rules.filter((rule) => target.startsWith(rule.path));
  matches.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  const rule = matches[0];
  return rule
    ? { allowed: rule.allow, note: `${rule.allow ? "allowed" : "disallowed"}: ${rule.path}` }
    : { allowed: true, note: "allowed: no matching rule" };
}
function validType(kind: Kind, value: string): boolean {
  if (kind === "robots") return /^text\/plain\b/i.test(value);
  if (kind === "sitemap") return /(?:xml|text\/plain)/i.test(value);
  if (kind === "page") return /(?:text\/html|application\/xhtml\+xml)/i.test(value);
  return /(?:pdf|officedocument|dxf|dwg|acad|octet-stream|text\/plain)/i.test(value);
}
async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  const root = await canonical(options.root);
  const git = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe", stderr: "pipe" });
  if (git.exitCode !== 0) throw new Stop("cannot determine repository root; refusing corpus output", 2);
  const checkout = await canonical(decoder.decode(git.stdout).trim());
  if (root === checkout || root.startsWith(`${checkout}${sep}`) || root.includes(`${sep}beep-effect`)) {
    throw new Stop(`refusing corpus root inside a checkout or beep-effect path: ${root}`, 2);
  }
  const bootstrap = [...HOSTS].flatMap((host) => [
    `https://${host}/robots.txt`,
    `https://${host}/sitemap.xml`,
    `https://${host}/sitemap_index.xml`,
  ]);
  if (options.dryRun) {
    return;
  }
  const cap = Number(process.env.LEJEUNE_REQUEST_CAP ?? "800");
  if (!Number.isInteger(cap) || cap < 1) throw new Stop("LEJEUNE_REQUEST_CAP must be a positive integer", 2);
  const clock = now();
  const stamp = `${clock.slice(0, 10)}-${clock.slice(11, 23).replace(/\D/g, "")}`;
  const staging = join(root, "runs", `${stamp}.staging`);
  const final = join(root, "runs", stamp);
  const current = join(root, "current");
  for (const folder of ["meta/robots", "meta/sitemaps", ".tmp", "pages", "files"])
    await mkdir(join(staging, folder), { recursive: true });
  const manifest = join(staging, "manifest.jsonl");
  const logFile = join(staging, "run.log");
  const entries: Entry[] = [];
  const results = new Map<string, Result | null>();
  const policies = new Map<string, Policy>();
  const counts = new Map<string, number>();
  const lastRequest = new Map<string, number>();
  let priorRows = new Map<string, Entry>();
  try {
    const lines = (await readFile(join(current, "manifest.jsonl"), "utf8")).trim().split("\n");
    priorRows = new Map(
      lines.filter(Boolean).map((line) => {
        const row: Entry = JSON.parse(line);
        return [row.url, row];
      })
    );
  } catch {
    /* There is no validated prior run. */
  }
  const log = (message: string) => appendFile(logFile, `${now()} ${message}\n`);
  const record = async (row: Entry) => {
    entries.push(row);
    await appendFile(manifest, `${JSON.stringify(row)}\n`);
  };
  const pace = async (host: string) => {
    const count = (counts.get(host) ?? 0) + 1;
    if (count > cap) throw new Stop(`request cap ${cap} reached for ${host}`);
    counts.set(host, count);
    const delay = policies.has(host) ? applicable(policies.get(host)!.current).delay : 1;
    const wait = delay * 1000 - (Date.now() - (lastRequest.get(host) ?? 0));
    if (wait > 0) await sleep(wait);
    lastRequest.set(host, Date.now());
  };
  const permitted = async (url: string): Promise<string | undefined> => {
    const policy = policies.get(new URL(url).hostname);
    if (!policy) throw new Stop(`no robots policy loaded for ${url}`);
    const decision = decide(url, policy.current);
    const old = policy.previous && decide(url, policy.previous);
    if (!decision.allowed && policy.changed && old?.allowed) {
      await log(`REFUSAL robots policy newly prohibits ${url} (${decision.note})`);
      throw new Stop(`robots.txt changed to prohibit ${url}`);
    }
    if (decision.allowed) return decision.note;
    await log(`SKIP ${url} (${decision.note})`);
    await record({
      url,
      finalUrl: url,
      status: 0,
      contentType: "",
      bytes: 0,
      sha256: "",
      fetchedAt: now(),
      robotsDecision: decision.note,
    });
    return undefined;
  };
  const fetchOne = async (input: string, kind: Kind, robots: string, force = false): Promise<Result | null> => {
    const url = normalize(input);
    if (!url) {
      await log(`SKIP out-of-scope URL ${input}`);
      return null;
    }
    if (results.has(url)) return results.get(url) ?? null;
    const folder =
      kind === "page" ? "pages" : kind === "file" ? "files" : kind === "robots" ? "meta/robots" : "meta/sitemaps";
    const extension =
      kind === "page"
        ? ".html"
        : kind === "robots"
          ? ".txt"
          : kind === "sitemap"
            ? ".xml"
            : extname(new URL(url).pathname).toLowerCase();
    const name = kind === "robots" ? new URL(url).hostname + extension : digest(url).slice(0, 20) + extension;
    const artifact = `${folder}/${name}`;
    const destination = join(staging, artifact);
    const prior = priorRows.get(url);
    if (
      !force &&
      prior?.status &&
      prior.status >= 200 &&
      prior.status < 300 &&
      prior.artifact &&
      !isAbsolute(prior.artifact) &&
      !prior.artifact.split(/[\\/]/).includes("..")
    ) {
      try {
        const source = join(current, prior.artifact);
        const bytes = await readFile(source);
        if (bytes.length === prior.bytes && digest(bytes) === prior.sha256) {
          const temp = join(staging, ".tmp", `${name}.resume`);
          await copyFile(source, temp);
          await rename(temp, destination);
          const row = { ...prior, url, robotsDecision: robots, artifact };
          await record(row);
          const result = { entry: row, path: destination };
          results.set(url, result);
          return result;
        }
      } catch {
        await log(`CACHE MISS invalid prior artifact for ${url}`);
      }
    }
    let finalUrl = url;
    for (let redirects = 0; ; ) {
      await pace(new URL(finalUrl).hostname);
      let response: Response;
      try {
        response = await fetch(finalUrl, {
          headers: { "User-Agent": UA },
          redirect: "manual",
          signal: AbortSignal.timeout(60_000),
        });
      } catch (cause) {
        await log(`ERROR request failed for ${finalUrl}: ${cause instanceof Error ? cause.message : "unknown error"}`);
        throw new Stop(`request failed for ${finalUrl}; see ${logFile}`);
      }
      const status = response.status;
      const contentType = response.headers.get("content-type") ?? "";
      if (status === 401 || status === 403 || status === 429) {
        await response.body?.cancel();
        await log(`REFUSAL ${status} for ${finalUrl}; stopped without retry`);
        await record({
          url,
          finalUrl,
          status,
          contentType,
          bytes: 0,
          sha256: "",
          fetchedAt: now(),
          robotsDecision: robots,
        });
        throw new Stop(`remote refusal ${status} for ${finalUrl}; see ${logFile}`);
      }
      if (status >= 300 && status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects >= 3) throw new Stop(`redirect limit or missing Location for ${finalUrl}`);
        const target = normalize(location, finalUrl);
        if (!target) {
          await log(`REFUSAL off-scope redirect from ${finalUrl} to ${location}`);
          throw new Stop(`off-scope redirect refused for ${finalUrl}`);
        }
        if (kind !== "robots") {
          const next = await permitted(target);
          if (!next) throw new Stop(`redirect target disallowed by robots.txt: ${target}`);
          robots = next;
        }
        finalUrl = target;
        redirects++;
        continue;
      }
      if (status < 200 || status >= 300) {
        await response.body?.cancel();
        const row = {
          url,
          finalUrl,
          status,
          contentType,
          bytes: 0,
          sha256: "",
          fetchedAt: now(),
          robotsDecision: robots,
        };
        await log(`SKIP HTTP ${status} ${finalUrl}`);
        await record(row);
        results.set(url, null);
        return null;
      }
      if (!validType(kind, contentType)) {
        await response.body?.cancel();
        throw new Stop(`unexpected content type ${contentType || "(missing)"} for ${finalUrl}`);
      }
      const temp = join(staging, ".tmp", `${name}.${crypto.randomUUID()}`);
      await Bun.write(temp, response);
      const bytes = await readFile(temp);
      const sha256 = digest(bytes);
      await rename(temp, destination);
      const row = {
        url,
        finalUrl,
        status,
        contentType,
        bytes: bytes.length,
        sha256,
        fetchedAt: now(),
        robotsDecision: robots,
        artifact,
      };
      await record(row);
      const result = { entry: row, path: destination };
      results.set(url, result);
      return result;
    }
  };
  for (const host of HOSTS) {
    const url = `https://${host}/robots.txt`;
    const result = await fetchOne(url, "robots", "robots bootstrap", true);
    const currentText = result ? await readFile(result.path, "utf8") : "";
    let previousText: string | undefined;
    try {
      previousText = await readFile(join(current, "meta", "robots", `${host}.txt`), "utf8");
    } catch {
      /* There is no prior robots copy for this host. */
    }
    policies.set(host, {
      current: parseRobots(currentText),
      previous: previousText === undefined ? undefined : parseRobots(previousText),
      changed: previousText !== undefined && previousText !== currentText,
    });
  }
  for (const url of PREFLIGHT) {
    const robots = await permitted(url);
    if (!robots || !(await fetchOne(url, "page", robots, true))) throw new Stop(`preflight failed for ${url}`);
  }
  const sitemapQueue = [...HOSTS].flatMap((host) => {
    const robots = policies.get(host)!.current;
    return [`https://${host}/sitemap.xml`, `https://${host}/sitemap_index.xml`, ...robots.sitemaps];
  });
  const seenSitemaps = new Set<string>();
  const candidates = new Set<string>();
  while (sitemapQueue.length) {
    const raw = sitemapQueue.shift()!;
    const url = normalize(raw);
    if (!url) {
      await log(`SKIP out-of-scope sitemap URL ${raw}`);
      continue;
    }
    if (seenSitemaps.has(url)) continue;
    seenSitemaps.add(url);
    const robots = await permitted(url);
    if (!robots) continue;
    const result = await fetchOne(url, "sitemap", robots, true);
    if (!result) continue;
    const xml = await readFile(result.path, "utf8");
    for (const match of xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)) {
      const located = normalize(match[1].trim());
      if (!located) {
        await log(`SKIP out-of-scope sitemap loc ${match[1].trim()}`);
        continue;
      }
      if (/\.xml(?:\.gz)?$/i.test(new URL(located).pathname)) sitemapQueue.push(located);
      else if (classify(located) !== "skip") candidates.add(located);
    }
  }
  for (const url of candidates) {
    const kind = classify(url);
    const robots = await permitted(url);
    if (kind !== "skip" && robots) await fetchOne(url, kind, robots);
  }
  const discovered = new Set<string>();
  for (const result of results.values()) {
    if (!result?.entry.artifact?.startsWith("pages/")) continue;
    const html = await readFile(result.path, "utf8");
    for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
      const url = normalize(match[1], result.entry.finalUrl);
      if (url && !results.has(url) && classify(url) !== "skip") discovered.add(url);
      else if (!url && /^https?:/i.test(match[1])) await log(`SKIP out-of-scope discovered URL ${match[1]}`);
    }
  }
  for (const url of discovered) {
    const kind = classify(url);
    const robots = await permitted(url);
    if (kind !== "skip" && robots) await fetchOne(url, kind, robots);
  }
  const lines = (await readFile(manifest, "utf8")).trim().split("\n").filter(Boolean);
  for (const line of lines) JSON.parse(line);
  if (lines.length !== entries.length) throw new Stop("manifest line count changed during validation");
  for (const row of entries.filter((entry) => entry.status >= 200 && entry.status < 300)) {
    if (!row.artifact) throw new Stop(`2xx manifest row has no artifact: ${row.url}`);
    const bytes = await readFile(join(staging, row.artifact));
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256) {
      throw new Stop(`artifact validation failed: ${row.url}`);
    }
  }
  await rename(staging, final);
  const pointer = join(root, `.current-${stamp}.tmp`);
  await symlink(relative(root, final), pointer);
  await rename(pointer, current);
}
main().catch((cause: unknown) => {
  const failure = cause instanceof Stop ? cause : new Stop(cause instanceof Error ? cause.message : "unknown failure");
  process.exitCode = failure.exitCode;
});
