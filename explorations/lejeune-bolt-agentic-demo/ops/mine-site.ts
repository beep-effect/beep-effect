/**
 * Ethical, reproducible miner for the public LeJeune Bolt first-party sites.
 *
 * Boundary (research/08-demo-options.md "Reproducible lejeunebolt.com mining sketch" and
 * RESEARCH.md "2026-08-25 constraints discovered"): one honest identity, robots.txt read per
 * host before any page request and applied to every URL, HTTPS on the three first-party hosts
 * (www. aliases included) for sitemap entries, discovered links, and redirects, exactly one
 * stored body per HTTP 200 response, and a stop without retry on any 401, 403, 429, challenge
 * page, or unexpected status. A refusal is the expected outcome when the site filters crawlers;
 * never switch identities to get past it.
 *
 * Usage: bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts [--dry-run] [--root PATH]
 * Output stays staged until its manifest and hashes validate, then atomically updates current.
 * Runs contain manifest.jsonl, run.log, pages/, files/, meta/robots/, and meta/sitemaps/.
 *
 * Fixture-only overrides (production uses the defaults): LEJEUNE_SEED_HOSTS (space-separated
 * hosts), LEJEUNE_SCHEME (http for a local fixture), LEJEUNE_PREFLIGHT (space-separated URLs).
 *
 * Bodies are read through a per-kind byte ceiling (robots 512 KiB, sitemaps 16 MiB, pages
 * 8 MiB, files 64 MiB or LEJEUNE_MAX_FILE_BYTES); an oversized response is recorded and skipped.
 * Robots rules support `*` wildcards and `$` end anchors with longest-pattern precedence.
 *
 * Exit codes: 2 usage or refused corpus root, 3 remote refusal, challenge, or unexpected
 * response, 4 robots.txt unreadable or newly prohibitive, 6 manifest validation failed.
 */
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, readFile, realpath, rename, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const UA_TOKEN = "beep-explorations-site-miner";
const UA = `${UA_TOKEN}/0.1 (research corpus for explorations/lejeune-bolt-agentic-demo; contact via repository)`;
const SCHEME = process.env.LEJEUNE_SCHEME === "http" ? "http:" : "https:";
const SEEDS = (process.env.LEJEUNE_SEED_HOSTS ?? "lejeunebolt.com rentals.lejeunebolt.com tightenright.com")
  .split(/\s+/)
  .filter(Boolean)
  .map((host) => host.toLowerCase());
const HOSTS = new Set(SEEDS.flatMap((host) => (host.startsWith("www.") ? [host] : [host, `www.${host}`])));
const PREFLIGHT = (process.env.LEJEUNE_PREFLIGHT ?? `https://lejeunebolt.com/ https://www.tightenright.com/`)
  .split(/\s+/)
  .filter(Boolean);
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
const CHALLENGE = /sgcaptcha|\/\.well-known\/[a-z_-]*captcha|cf-chl|challenge-platform|just a moment/i;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES: Record<Kind, number> = {
  robots: 512 * 1024,
  sitemap: 16 * 1024 * 1024,
  page: 8 * 1024 * 1024,
  file: Number(process.env.LEJEUNE_MAX_FILE_BYTES ?? String(64 * 1024 * 1024)),
};

type Kind = "robots" | "sitemap" | "page" | "file";
type Rule = { allow: boolean; path: string; pattern: RegExp };
type Group = { agents: string[]; rules: Rule[]; delay: number };
type Robots = { groups: Group[]; sitemaps: string[] };
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
type Options = { dryRun: boolean; root: string };
type Ctx = {
  root: string;
  staging: string;
  current: string;
  manifest: string;
  logFile: string;
  cap: number;
  entries: Entry[];
  results: Map<string, Result | null>;
  policies: Map<string, Policy>;
  counts: Map<string, number>;
  lastRequest: Map<string, number>;
  prior: Map<string, Entry>;
};
type Fetched = { status: number; contentType: string; location: string | null; body: Uint8Array; truncated: boolean };

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

// --- options and corpus root ---------------------------------------------------------------

const defaultRoot = () => process.env.LEJEUNE_CORPUS_ROOT ?? join(homedir(), "data-home/lejeune-bolt-corpus");

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, root: defaultRoot() };
  for (let i = 0; i < argv.length; i++) {
    i = applyArg(options, argv, i);
  }
  return options;
}

function applyArg(options: Options, argv: string[], i: number): number {
  const arg = argv[i];
  if (arg === "--dry-run") {
    options.dryRun = true;
    return i;
  }
  if (arg === "--root" && argv[i + 1]) {
    options.root = argv[i + 1];
    return i + 1;
  }
  throw new Stop(`unknown or incomplete option: ${arg}\n${usage()}`, 2);
}

const expandHome = (path: string): string =>
  path === "~" ? homedir() : path.startsWith(`~${sep}`) ? join(homedir(), path.slice(2)) : path;

async function canonical(path: string): Promise<string> {
  const absolute = resolve(expandHome(path));
  try {
    return await realpath(absolute);
  } catch {
    return canonicalMissing(path, absolute);
  }
}

async function canonicalMissing(path: string, absolute: string): Promise<string> {
  if (dirname(absolute) === absolute) throw new Stop(`cannot resolve corpus root: ${path}`, 2);
  return join(await canonical(dirname(absolute)), basename(absolute));
}

async function repoRoot(): Promise<string> {
  const git = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe", stderr: "pipe" });
  if (git.exitCode !== 0) throw new Stop("cannot determine repository root; refusing corpus output", 2);
  return canonical(decoder.decode(git.stdout).trim());
}

async function guardRoot(root: string): Promise<void> {
  const checkout = await repoRoot();
  const inside = root === checkout || root.startsWith(`${checkout}${sep}`) || root.includes(`${sep}beep-effect`);
  if (inside) throw new Stop(`refusing corpus root inside a checkout or beep-effect path: ${root}`, 2);
}

// --- URL scope --------------------------------------------------------------------------------

const parseUrl = (raw: string, base?: string): URL | undefined => {
  try {
    return new URL(raw.replaceAll("&amp;", "&"), base);
  } catch {
    return undefined;
  }
};

const hostOf = (url: string): string => new URL(url).host.toLowerCase();
const inScope = (url: URL): boolean => url.protocol === SCHEME && HOSTS.has(url.host.toLowerCase());

function stripTracking(url: URL): string {
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

function normalize(raw: string, base?: string): string | undefined {
  const url = parseUrl(raw, base);
  return url && inScope(url) ? stripTracking(url) : undefined;
}

function classify(url: string): Kind | "skip" {
  const ext = extname(new URL(url).pathname).toLowerCase();
  return FILE_EXT.has(ext) ? "file" : SKIP_EXT.has(ext) ? "skip" : "page";
}

const isSitemapUrl = (url: string): boolean => /\.xml(?:\.gz)?$/i.test(new URL(url).pathname);

// --- robots.txt ------------------------------------------------------------------------------

type RobotsState = { robots: Robots; group?: Group; directives: boolean };

const robotsLine = (source: string): [string, string] | undefined => {
  const line = source.replace(/\s*#.*$/, "").trim();
  const at = line.indexOf(":");
  return at < 0 ? undefined : [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()];
};

function robotsAgent(state: RobotsState, value: string): void {
  if (!state.group || state.directives) {
    state.group = { agents: [], rules: [], delay: 0 };
    state.robots.groups.push(state.group);
    state.directives = false;
  }
  state.group.agents.push(value.toLowerCase());
}

const rulePattern = (path: string): RegExp => {
  const anchored = path.endsWith("$");
  const escaped = (anchored ? path.slice(0, -1) : path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
};

function robotsRule(state: RobotsState, allow: boolean, value: string): void {
  if (!state.group) return;
  state.directives = true;
  if (value) state.group.rules.push({ allow, path: value, pattern: rulePattern(value) });
}

function robotsDelay(state: RobotsState, value: string): void {
  if (!state.group) return;
  state.directives = true;
  const delay = Number(value);
  if (Number.isFinite(delay) && delay >= 0) state.group.delay = delay;
}

function robotsSitemap(state: RobotsState, value: string): void {
  if (value) state.robots.sitemaps.push(value);
}

const DIRECTIVES: Record<string, (state: RobotsState, value: string) => void> = {
  sitemap: robotsSitemap,
  "user-agent": robotsAgent,
  allow: (state, value) => robotsRule(state, true, value),
  disallow: (state, value) => robotsRule(state, false, value),
  "crawl-delay": robotsDelay,
};

const robotsDirective = (state: RobotsState, key: string, value: string): void => DIRECTIVES[key]?.(state, value);

function parseRobots(body: string): Robots {
  const state: RobotsState = { robots: { groups: [], sitemaps: [] }, directives: false };
  for (const source of body.split(/\r?\n/)) {
    const parsed = robotsLine(source);
    if (parsed) robotsDirective(state, parsed[0], parsed[1]);
  }
  return state.robots;
}

const namesToken = (group: Group): boolean => group.agents.some((agent) => agent !== "*" && UA_TOKEN.includes(agent));
const namesWildcard = (group: Group): boolean => group.agents.includes("*");

function applicable(policy: Robots): { rules: Rule[]; delay: number } {
  const exact = policy.groups.filter(namesToken);
  const selected = exact.length ? exact : policy.groups.filter(namesWildcard);
  return {
    rules: selected.flatMap((group) => group.rules),
    delay: Math.max(1, ...selected.map((group) => group.delay || 0)),
  };
}

function decide(url: string, robots: Robots): { allowed: boolean; note: string } {
  const parsed = new URL(url);
  const target = parsed.pathname + parsed.search;
  const matches = applicable(robots).rules.filter((rule) => rule.pattern.test(target));
  matches.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  const rule = matches[0];
  return rule
    ? { allowed: rule.allow, note: `${rule.allow ? "allowed" : "disallowed"}: ${rule.path}` }
    : { allowed: true, note: "allowed: no matching rule" };
}

const TYPE_RULES: Record<Kind, RegExp> = {
  robots: /^text\/plain\b/i,
  sitemap: /(?:xml|text\/plain)/i,
  page: /(?:text\/html|application\/xhtml\+xml)/i,
  file: /(?:pdf|officedocument|dxf|dwg|acad|octet-stream|text\/plain)/i,
};
const validType = (kind: Kind, value: string): boolean => TYPE_RULES[kind].test(value);

// --- run context ------------------------------------------------------------------------------

async function loadPrior(current: string): Promise<Map<string, Entry>> {
  try {
    const lines = (await readFile(join(current, "manifest.jsonl"), "utf8")).trim().split("\n");
    return new Map(lines.filter(Boolean).map((line) => [JSON.parse(line).url as string, JSON.parse(line) as Entry]));
  } catch {
    return new Map();
  }
}

function requestCap(): number {
  const cap = Number(process.env.LEJEUNE_REQUEST_CAP ?? "800");
  if (!Number.isInteger(cap) || cap < 1) throw new Stop("LEJEUNE_REQUEST_CAP must be a positive integer", 2);
  return cap;
}

async function makeContext(root: string): Promise<Ctx> {
  const clock = now();
  const stamp = `${clock.slice(0, 10)}-${clock.slice(11, 23).replace(/\D/g, "")}`;
  const staging = join(root, "runs", `${stamp}.staging`);
  const current = join(root, "current");
  for (const folder of ["meta/robots", "meta/sitemaps", ".tmp", "pages", "files"]) {
    await mkdir(join(staging, folder), { recursive: true });
  }
  return {
    root,
    staging,
    current,
    manifest: join(staging, "manifest.jsonl"),
    logFile: join(staging, "run.log"),
    cap: requestCap(),
    entries: [],
    results: new Map(),
    policies: new Map(),
    counts: new Map(),
    lastRequest: new Map(),
    prior: await loadPrior(current),
  };
}

const log = (ctx: Ctx, message: string) => appendFile(ctx.logFile, `${now()} ${message}\n`);

async function record(ctx: Ctx, row: Entry): Promise<void> {
  ctx.entries.push(row);
  await appendFile(ctx.manifest, `${JSON.stringify(row)}\n`);
}

const emptyRow = (
  url: string,
  finalUrl: string,
  status: number,
  contentType: string,
  robotsDecision: string
): Entry => ({
  url,
  finalUrl,
  status,
  contentType,
  bytes: 0,
  sha256: "",
  fetchedAt: now(),
  robotsDecision,
});

function hostDelay(ctx: Ctx, host: string): number {
  const policy = ctx.policies.get(host);
  return policy ? applicable(policy.current).delay : 1;
}

function countRequest(ctx: Ctx, host: string): void {
  const count = (ctx.counts.get(host) ?? 0) + 1;
  if (count > ctx.cap) throw new Stop(`request cap ${ctx.cap} reached for ${host}`, 3);
  ctx.counts.set(host, count);
}

async function throttle(ctx: Ctx, host: string): Promise<void> {
  const wait = hostDelay(ctx, host) * 1000 - (Date.now() - (ctx.lastRequest.get(host) ?? 0));
  if (wait > 0) await sleep(wait);
  ctx.lastRequest.set(host, Date.now());
}

async function pace(ctx: Ctx, host: string): Promise<void> {
  countRequest(ctx, host);
  await throttle(ctx, host);
}

// --- robots decisions -------------------------------------------------------------------------

function policyFor(ctx: Ctx, url: string): Policy {
  const policy = ctx.policies.get(hostOf(url));
  if (!policy) throw new Stop(`no robots policy loaded for ${url}`, 4);
  return policy;
}

const newlyProhibited = (policy: Policy, url: string, allowed: boolean): boolean =>
  !allowed && policy.changed && policy.previous !== undefined && decide(url, policy.previous).allowed;

async function permitted(ctx: Ctx, url: string): Promise<string | undefined> {
  const policy = policyFor(ctx, url);
  const decision = decide(url, policy.current);
  if (newlyProhibited(policy, url, decision.allowed)) {
    await log(ctx, `REFUSAL robots policy newly prohibits ${url} (${decision.note})`);
    throw new Stop(`robots.txt changed to prohibit ${url}`, 4);
  }
  if (decision.allowed) return decision.note;
  await log(ctx, `SKIP ${url} (${decision.note})`);
  await record(ctx, emptyRow(url, url, 0, "", decision.note));
  return undefined;
}

// --- fetching ------------------------------------------------------------------------------------

const folderFor = (kind: Kind): string =>
  kind === "page" ? "pages" : kind === "file" ? "files" : kind === "robots" ? "meta/robots" : "meta/sitemaps";

function extensionFor(kind: Kind, url: string): string {
  if (kind === "page") return ".html";
  if (kind === "robots") return ".txt";
  return kind === "sitemap" ? ".xml" : extname(new URL(url).pathname).toLowerCase();
}

function artifactName(kind: Kind, url: string): string {
  const extension = extensionFor(kind, url);
  return kind === "robots" ? hostOf(url) + extension : digest(url).slice(0, 20) + extension;
}

const safeArtifact = (artifact: string | undefined): artifact is string =>
  artifact !== undefined && !isAbsolute(artifact) && !artifact.split(/[\\/]/).includes("..");

const reusable = (prior: Entry | undefined): prior is Entry & { artifact: string } =>
  prior !== undefined && prior.status === 200 && safeArtifact(prior.artifact);

async function priorBytes(ctx: Ctx, prior: Entry & { artifact: string }): Promise<Uint8Array | undefined> {
  try {
    const bytes = await readFile(join(ctx.current, prior.artifact));
    return bytes.length === prior.bytes && digest(bytes) === prior.sha256 ? bytes : undefined;
  } catch {
    return undefined;
  }
}

async function cacheHit(ctx: Ctx, url: string, robots: string, name: string, artifact: string): Promise<Result | null> {
  const prior = ctx.prior.get(url);
  if (!reusable(prior)) return null;
  const bytes = await priorBytes(ctx, prior);
  if (!bytes) {
    await log(ctx, `CACHE MISS invalid prior artifact for ${url}`);
    return null;
  }
  const destination = join(ctx.staging, artifact);
  const temp = join(ctx.staging, ".tmp", `${name}.resume`);
  await copyFile(join(ctx.current, prior.artifact), temp);
  await rename(temp, destination);
  const row = { ...prior, url, robotsDecision: robots, artifact };
  await record(ctx, row);
  return { entry: row, path: destination };
}

async function readCapped(response: Response, limit: number): Promise<{ body: Uint8Array; truncated: boolean }> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > limit || !response.body) {
    await response.body?.cancel();
    return { body: new Uint8Array(), truncated: declared > limit };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) {
      await response.body.cancel();
      return { body: new Uint8Array(), truncated: true };
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), truncated: false };
}

async function request(ctx: Ctx, url: string, kind: Kind): Promise<Fetched> {
  await pace(ctx, hostOf(url));
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    const capped = await readCapped(response, MAX_BODY_BYTES[kind]);
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      location: response.headers.get("location"),
      ...capped,
    };
  } catch (cause) {
    await log(ctx, `ERROR request failed for ${url}: ${cause instanceof Error ? cause.message : "unknown error"}`);
    throw new Stop(`request failed for ${url}; see ${ctx.logFile}`, 3);
  }
}

type Outcome = "refusal" | "redirect" | "missing" | "ok" | "unexpected" | "oversized";

const REFUSAL_STATUSES = new Set([401, 403, 429]);
const MISSING_STATUSES = new Set([404, 410]);
const OUTCOMES: ReadonlyArray<readonly [(status: number) => boolean, Outcome]> = [
  [(status) => status === 200, "ok"],
  [(status) => REFUSAL_STATUSES.has(status), "refusal"],
  [(status) => status >= 300 && status < 400, "redirect"],
  [(status) => MISSING_STATUSES.has(status) || status >= 500, "missing"],
];
const outcomeOf = (status: number): Outcome => OUTCOMES.find(([test]) => test(status))?.[1] ?? "unexpected";

type Hop = { url: string; finalUrl: string; kind: Kind; robots: string; redirects: number };

async function refuse(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<never> {
  await log(ctx, `REFUSAL ${fetched.status} for ${hop.finalUrl}; stopped without retry`);
  await record(ctx, emptyRow(hop.url, hop.finalUrl, fetched.status, fetched.contentType, hop.robots));
  throw new Stop(`remote refusal ${fetched.status} for ${hop.finalUrl}; see ${ctx.logFile}`, 3);
}

async function unexpected(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<never> {
  await log(ctx, `REFUSAL unexpected HTTP ${fetched.status} for ${hop.finalUrl}; stopped without retry`);
  await record(ctx, emptyRow(hop.url, hop.finalUrl, fetched.status, fetched.contentType, hop.robots));
  throw new Stop(`unexpected HTTP ${fetched.status} for ${hop.finalUrl}; treat it as a block and stop`, 3);
}

async function skipRedirect(ctx: Ctx, hop: Hop, fetched: Fetched, reason: string): Promise<null> {
  await log(ctx, `SKIP ${reason} for ${hop.finalUrl} (HTTP ${fetched.status} -> ${fetched.location ?? "no Location"})`);
  await record(ctx, emptyRow(hop.url, hop.finalUrl, fetched.status, fetched.contentType, hop.robots));
  ctx.results.set(hop.url, null);
  return null;
}

async function redirectTarget(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<string | null> {
  if (!fetched.location || hop.redirects >= MAX_REDIRECTS) {
    return skipRedirect(ctx, hop, fetched, "redirect limit or missing Location");
  }
  const target = normalize(fetched.location, hop.finalUrl);
  return target ?? skipRedirect(ctx, hop, fetched, "off-scope redirect");
}

async function redirectRobots(ctx: Ctx, hop: Hop, target: string): Promise<string> {
  const robots = hop.kind === "robots" ? hop.robots : await permitted(ctx, target);
  if (!robots) throw new Stop(`redirect target disallowed by robots.txt: ${target}`, 4);
  return robots;
}

async function redirectHop(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<Hop | null> {
  const target = await redirectTarget(ctx, hop, fetched);
  if (!target) return null;
  const robots = await redirectRobots(ctx, hop, target);
  return { ...hop, finalUrl: target, robots, redirects: hop.redirects + 1 };
}

async function missing(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<null> {
  await log(ctx, `SKIP HTTP ${fetched.status} ${hop.finalUrl}`);
  await record(ctx, emptyRow(hop.url, hop.finalUrl, fetched.status, fetched.contentType, hop.robots));
  ctx.results.set(hop.url, null);
  return null;
}

function guardType(hop: Hop, fetched: Fetched): void {
  if (!validType(hop.kind, fetched.contentType)) {
    throw new Stop(`unexpected content type ${fetched.contentType || "(missing)"} for ${hop.finalUrl}`, 3);
  }
}

const isChallenge = (kind: Kind, body: Uint8Array): boolean =>
  kind !== "file" && CHALLENGE.test(decoder.decode(body.subarray(0, 65_536)));

async function guardBody(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<void> {
  guardType(hop, fetched);
  if (isChallenge(hop.kind, fetched.body)) {
    await log(ctx, `REFUSAL challenge page served for ${hop.finalUrl}; the crawler identity is being filtered`);
    throw new Stop(`${hop.finalUrl} served a challenge page to the research identity; stop and do not change it`, 3);
  }
}

async function store(ctx: Ctx, hop: Hop, fetched: Fetched, name: string, artifact: string): Promise<Result> {
  await guardBody(ctx, hop, fetched);
  const destination = join(ctx.staging, artifact);
  const temp = join(ctx.staging, ".tmp", `${name}.${crypto.randomUUID()}`);
  await Bun.write(temp, fetched.body);
  await rename(temp, destination);
  const row: Entry = {
    ...emptyRow(hop.url, hop.finalUrl, fetched.status, fetched.contentType, hop.robots),
    bytes: fetched.body.length,
    sha256: digest(fetched.body),
    artifact,
  };
  await record(ctx, row);
  const result = { entry: row, path: destination };
  ctx.results.set(hop.url, result);
  return result;
}

type Terminal = Exclude<Outcome, "redirect">;
type Handler = (ctx: Ctx, hop: Hop, fetched: Fetched, name: string, artifact: string) => Promise<Result | null>;
async function oversized(ctx: Ctx, hop: Hop, fetched: Fetched): Promise<null> {
  await log(
    ctx,
    `SKIP body over ${MAX_BODY_BYTES[hop.kind]} bytes for ${hop.finalUrl} (HTTP ${fetched.status}); nothing stored`
  );
  await record(ctx, emptyRow(hop.url, hop.finalUrl, 0, fetched.contentType, `${hop.robots}; oversized body skipped`));
  ctx.results.set(hop.url, null);
  return null;
}

const HANDLERS: Record<Terminal, Handler> = {
  refusal: (ctx, hop, fetched) => refuse(ctx, hop, fetched),
  unexpected: (ctx, hop, fetched) => unexpected(ctx, hop, fetched),
  missing: (ctx, hop, fetched) => missing(ctx, hop, fetched),
  oversized: (ctx, hop, fetched) => oversized(ctx, hop, fetched),
  ok: store,
};

async function follow(ctx: Ctx, hop: Hop, name: string, artifact: string): Promise<Result | null> {
  for (let current = hop; ; ) {
    const fetched = await request(ctx, current.finalUrl, current.kind);
    const outcome = fetched.truncated ? "oversized" : outcomeOf(fetched.status);
    if (outcome !== "redirect") return HANDLERS[outcome](ctx, current, fetched, name, artifact);
    const next = await redirectHop(ctx, current, fetched);
    if (!next) return null;
    current = next;
  }
}

const knownResult = (ctx: Ctx, url: string): Result | null => ctx.results.get(url) ?? null;

async function resolveCached(ctx: Ctx, url: string, robots: string, name: string, artifact: string, force: boolean) {
  const cached = force ? null : await cacheHit(ctx, url, robots, name, artifact);
  if (cached) ctx.results.set(url, cached);
  return cached;
}

async function fetchOne(ctx: Ctx, input: string, kind: Kind, robots: string, force = false): Promise<Result | null> {
  const url = normalize(input);
  if (!url) {
    await log(ctx, `SKIP out-of-scope URL ${input}`);
    return null;
  }
  if (ctx.results.has(url)) return knownResult(ctx, url);
  const name = artifactName(kind, url);
  const artifact = `${folderFor(kind)}/${name}`;
  const cached = await resolveCached(ctx, url, robots, name, artifact, force);
  if (cached) return cached;
  return follow(ctx, { url, finalUrl: url, kind, robots, redirects: 0 }, name, artifact);
}

// --- phases -----------------------------------------------------------------------------------------

async function previousRobots(ctx: Ctx, host: string): Promise<string | undefined> {
  try {
    return await readFile(join(ctx.current, "meta", "robots", `${host}.txt`), "utf8");
  } catch {
    return undefined;
  }
}

async function loadPolicy(ctx: Ctx, host: string): Promise<void> {
  const result = await fetchOne(ctx, `${SCHEME}//${host}/robots.txt`, "robots", "robots bootstrap", true);
  if (!result)
    throw new Stop(`robots.txt for ${host} is unavailable; the policy cannot be evaluated, so the crawl stops`, 4);
  const currentText = await readFile(result.path, "utf8");
  const previousText = await previousRobots(ctx, host);
  ctx.policies.set(host, {
    current: parseRobots(currentText),
    previous: previousText === undefined ? undefined : parseRobots(previousText),
    changed: previousText !== undefined && previousText !== currentText,
  });
}

async function preflight(ctx: Ctx): Promise<void> {
  for (const url of PREFLIGHT) {
    const robots = await permitted(ctx, url);
    if (!robots || !(await fetchOne(ctx, url, "page", robots, true))) {
      throw new Stop(`preflight failed for ${url}; the research identity was not accepted, so the crawl stops`, 3);
    }
  }
}

const sitemapSeeds = (ctx: Ctx): string[] =>
  [...HOSTS].flatMap((host) => [
    `${SCHEME}//${host}/sitemap.xml`,
    `${SCHEME}//${host}/sitemap_index.xml`,
    ...(ctx.policies.get(host)?.current.sitemaps ?? []),
  ]);

type SitemapWork = { queue: string[]; candidates: Set<string> };

async function routeLocation(ctx: Ctx, raw: string, work: SitemapWork): Promise<void> {
  const located = normalize(raw);
  if (!located) {
    await log(ctx, `SKIP out-of-scope sitemap loc ${raw}`);
  } else if (isSitemapUrl(located)) {
    work.queue.push(located);
  } else if (classify(located) !== "skip") {
    work.candidates.add(located);
  }
}

async function sitemapLocations(ctx: Ctx, path: string, work: SitemapWork): Promise<void> {
  const xml = await readFile(path, "utf8");
  for (const match of xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)) {
    await routeLocation(ctx, match[1].trim(), work);
  }
}

async function sitemapResult(ctx: Ctx, url: string): Promise<Result | null> {
  const robots = await permitted(ctx, url);
  return robots ? fetchOne(ctx, url, "sitemap", robots, true) : null;
}

async function crawlSitemap(ctx: Ctx, raw: string, seen: Set<string>, work: SitemapWork): Promise<void> {
  const url = normalize(raw);
  if (!url) {
    await log(ctx, `SKIP out-of-scope sitemap URL ${raw}`);
    return;
  }
  if (seen.has(url)) return;
  seen.add(url);
  const result = await sitemapResult(ctx, url);
  if (result) await sitemapLocations(ctx, result.path, work);
}

async function crawlSitemaps(ctx: Ctx): Promise<Set<string>> {
  const work: SitemapWork = { queue: sitemapSeeds(ctx), candidates: new Set<string>() };
  const seen = new Set<string>();
  while (work.queue.length) {
    await crawlSitemap(ctx, work.queue.shift() as string, seen, work);
  }
  return work.candidates;
}

async function fetchCandidates(ctx: Ctx, urls: Iterable<string>): Promise<void> {
  for (const url of urls) {
    const kind = classify(url);
    if (kind === "skip") continue;
    const robots = await permitted(ctx, url);
    if (robots) await fetchOne(ctx, url, kind, robots);
  }
}

function noteCandidate(ctx: Ctx, url: string, discovered: Set<string>): void {
  if (!ctx.results.has(url) && classify(url) !== "skip") discovered.add(url);
}

async function noteOffScope(ctx: Ctx, href: string): Promise<void> {
  if (/^https?:/i.test(href)) await log(ctx, `SKIP out-of-scope discovered URL ${href}`);
}

async function discoverHref(ctx: Ctx, href: string, base: string, discovered: Set<string>): Promise<void> {
  const url = normalize(href, base);
  if (url) noteCandidate(ctx, url, discovered);
  else await noteOffScope(ctx, href);
}

async function discoverIn(ctx: Ctx, result: Result, discovered: Set<string>): Promise<void> {
  const html = await readFile(result.path, "utf8");
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    await discoverHref(ctx, match[1], result.entry.finalUrl, discovered);
  }
}

async function discoverLinks(ctx: Ctx): Promise<Set<string>> {
  const discovered = new Set<string>();
  for (const result of ctx.results.values()) {
    if (result?.entry.artifact?.startsWith("pages/")) await discoverIn(ctx, result, discovered);
  }
  return discovered;
}

async function validateArtifact(ctx: Ctx, row: Entry): Promise<void> {
  if (!row.artifact) throw new Stop(`2xx manifest row has no artifact: ${row.url}`, 6);
  const bytes = await readFile(join(ctx.staging, row.artifact));
  if (bytes.length !== row.bytes || digest(bytes) !== row.sha256) {
    throw new Stop(`artifact validation failed: ${row.url}`, 6);
  }
}

async function validate(ctx: Ctx): Promise<void> {
  const lines = (await readFile(ctx.manifest, "utf8")).trim().split("\n").filter(Boolean);
  for (const line of lines) JSON.parse(line);
  if (lines.length !== ctx.entries.length) throw new Stop("manifest line count changed during validation", 6);
  for (const row of ctx.entries.filter((entry) => entry.status === 200)) {
    await validateArtifact(ctx, row);
  }
}

async function publish(ctx: Ctx): Promise<string> {
  const final = ctx.staging.replace(/\.staging$/, "");
  await rename(ctx.staging, final);
  const pointer = join(ctx.root, `.current-${basename(final)}.tmp`);
  await symlink(relative(ctx.root, final), pointer);
  await rename(pointer, ctx.current);
  return final;
}

async function crawl(root: string): Promise<string> {
  const ctx = await makeContext(root);
  for (const host of HOSTS) await loadPolicy(ctx, host);
  await preflight(ctx);
  await fetchCandidates(ctx, await crawlSitemaps(ctx));
  await fetchCandidates(ctx, await discoverLinks(ctx));
  await validate(ctx);
  return publish(ctx);
}

const bootstrapUrls = (): string[] =>
  [...HOSTS].flatMap((host) => [
    `${SCHEME}//${host}/robots.txt`,
    `${SCHEME}//${host}/sitemap.xml`,
    `${SCHEME}//${host}/sitemap_index.xml`,
  ]);

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  const root = await canonical(options.root);
  await guardRoot(root);
  if (options.dryRun) {
    console.log(`dry run: ${bootstrapUrls().length} bootstrap URLs for ${HOSTS.size} hosts; root ${root} untouched`);
    console.log(bootstrapUrls().join(" "));
    return;
  }
  const final = await crawl(root);
  console.log(`published ${final}; current -> ${basename(final)}`);
}

main().catch((cause: unknown) => {
  const failure = cause instanceof Stop ? cause : new Stop(cause instanceof Error ? cause.message : "unknown failure");
  console.error(`mine-site: ${failure.message}`);
  process.exitCode = failure.exitCode;
});
