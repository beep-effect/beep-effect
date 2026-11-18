#!/usr/bin/env bun
/** Update the fleet through its canonical routes, serializing all touch-gated steps. */
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Crypto from "node:crypto";
import { dlopen, FFIType } from "bun:ffi";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as ChildProcess from "effect/process/ChildProcess";
import { quote } from "../../auth-environments/scripts/auth_env.ts";
import { runAdapter } from "../../plasma-sensitive-entry/scripts/transport.ts";
import * as Config from "./config.ts";

export const HOSTS: Readonly<Record<string, (typeof Config.HOSTS)[keyof typeof Config.HOSTS]>> = Config.HOSTS;
export const HARNESSES: readonly string[] = Config.HARNESSES;
export const CLI: readonly string[] = Config.CLI;
export const DESKTOP: readonly string[] = Config.DESKTOP;
const aliases: Readonly<Record<string, string>> = Config.ALIASES;
const onlyOn: Readonly<Record<string, readonly string[]>> = Config.ONLY_ON;
const pacman: Readonly<Record<string, string>> = Config.PACMAN;
const debNames: Readonly<Record<string, readonly string[]>> = Config.DEB_NAMES;
const home = Os.homedir(),
  bin = `${home}/.local/bin`;
const state = `${home}/.local/state/beep/update-harnesses`,
  cache = `${home}/.cache/beep/update-harnesses`;
const t3opt = `${home}/.local/opt/t3code`,
  kimiDir = `${home}/.local/opt/kimi-code`;
const kimiAppimage = `${kimiDir}/KimiCode-linux-x86_64.AppImage`,
  kimiInstalled = `${kimiDir}/latest-linux-installed.yml`;
const kimiFeed = "https://code.kimi.com/kimi-code/desktop/latest-linux.yml";
const hostScript = new URL("harness_host.sh", import.meta.url).pathname;
const keepalive = ["-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4"];
const apparmorPath = "/etc/apparmor.d/beep-cursor-sandbox",
  hub = "dankstation";
const Row = S.Struct({
  host: S.String,
  harness: S.String,
  status: S.String,
  before: S.String,
  after: S.String,
  method: S.String,
  path: S.String,
  note: S.String,
});
type Row = typeof Row.Type;
const Pins = S.Struct({ drift: S.Boolean, sdk: S.String, cli: S.String });
type Pins = typeof Pins.Type;
const Feed = S.Struct({ version: S.String, url: S.String, sha512: S.String, size: S.NullOr(S.Number) });
type Feed = typeof Feed.Type;
const Deb = S.Struct({ url: S.String, name: S.String, sha256: S.String });
type Deb = typeof Deb.Type;
const Options = S.Struct({
  mode: S.Literals(["plan", "status", "update"]),
  hosts: S.Array(S.String),
  harnesses: S.Array(S.String),
  systemUpgrade: S.Boolean,
  noJunieMigrate: S.Boolean,
});
type Options = typeof Options.Type;
const row = (
  host: string,
  harness: string,
  status: string,
  before = "-",
  after = "-",
  method = "-",
  path = "-",
  note = ""
): Row => ({ host, harness, status, before, after, method, path, note });
const shellJoin = (args: readonly string[]) => args.map(quote).join(" ");

/** Resolve the public CLI aliases against the selected vocabulary. */
export function canonical(name: string, known: readonly string[]) {
  const key = aliases[name.toLowerCase()] ?? name.toLowerCase();
  return known.includes(key) ? key : undefined;
}
/** Keep the fixed harness ordering and host eligibility rules. */
export function plan(hosts: readonly string[], harnesses: readonly string[]) {
  return Object.fromEntries(
    hosts.map((host) => [
      host,
      HARNESSES.filter((h) => harnesses.includes(h) && (onlyOn[h] ?? Object.keys(HOSTS)).includes(host)),
    ])
  );
}
/** Parse only host-agent protocol records, preserving empty tab fields. */
export const parseRecords = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("@@"))
    .map((line) => line.replace(/\r$/, "").split("\t"));
/** Convert host-agent protocol records into summary rows and optional sandbox pins. */
export function rowsFromRecords(
  host: string,
  records: readonly string[][],
  mode: string
): { rows: Row[]; pins?: Pins } {
  const rows: Row[] = [],
    notes: Record<string, string[]> = {};
  let pins: Pins | undefined;
  for (const rec of records) {
    if (rec[0] === "@@INSTALL" && rec.length >= 7 && mode === "status") {
      const active = rec[2] ?? "",
        writable = rec[4];
      const note =
        ({ "1": "active", "0": "shadowed", stale: "under an unused node version" }[active] ?? active) +
        (writable !== "1" ? ", not writable by this account" : "");
      rows.push(row(host, rec[1] ?? "", "installed", rec[5], "-", rec[3], rec[6], note));
    } else if (rec[0] === "@@RESULT" && rec.length >= 8)
      rows.push(row(host, rec[1] ?? "", rec[2] ?? "", rec[3], rec[4], rec[5], rec[6], rec[7]));
    else if (rec[0] === "@@APPARMOR" && rec.length >= 4)
      pins = { drift: rec[1] === "1", sdk: rec[2] ?? "", cli: rec[3] ?? "" };
    else if (rec[0] === "@@NOTE" && rec.length >= 3) (notes[rec[1] ?? ""] ??= []).push(rec[2] ?? "");
  }
  return {
    rows: rows.map((r) => ({
      ...r,
      note: [r.note, ...(notes[r.harness] ?? [])].filter((n) => n && n !== "-").join("; "),
    })),
    ...(pins ? { pins } : {}),
  };
}
/** Fill every harness gap when an agent exits without a result. */
export const missingRows = (host: string, requested: readonly string[], rows: readonly Row[], why: string) =>
  requested
    .filter((h) => !rows.some((r) => r.harness === h))
    .map((h) => row(host, h, "failed", "-", "-", "-", "-", why));
/** Compare only active installs to their meaningful npm latest tag. */
export function markLatest(rows: Row[], latest: Readonly<Record<string, string>>) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r?.status === "installed" && r.harness in latest && r.note.startsWith("active")) {
      const next = latest[r.harness];
      if (next === r.before) rows[i] = { ...r, status: "current" };
      else if (next && next !== "-") rows[i] = { ...r, status: "pending", after: next };
    }
  }
}
/** Compare T3 worker builds with the hub's published fork build. */
export function markT3Published(rows: Row[], published: string) {
  if (!published || published === "-") return;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r?.harness === "t3code" && r.status === "installed")
      rows[i] = r.before === published ? { ...r, status: "current" } : { ...r, status: "pending", after: published };
  }
}
/** Read the x86_64 AppImage entry from the electron-builder feed. */
export function parseElectronFeed(text: string): Feed | undefined {
  const version = /^version:\s*['"]?([^'"\s]+)/m.exec(text)?.[1];
  for (const block of text.split(/^\s*-\s+(?=url:)/m).slice(1)) {
    const url = /url:\s*(\S+)/.exec(block)?.[1],
      sha512 = /sha512:\s*(\S+)/.exec(block)?.[1],
      size = /size:\s*(\d+)/.exec(block)?.[1];
    if (url?.endsWith(".AppImage"))
      return version && sha512 ? { version, url, sha512, size: size ? Number(size) : null } : undefined;
  }
  return undefined;
}
/** Replace only the two named sandbox profile attachment paths. */
export const repinProfile = (text: string, sdk: string, cli: string) =>
  text.replace(
    /^(\s*profile\s+beep-cursor-(sdk|cli)-sandbox\s+)(\S+)(.*)$/gm,
    (line, prefix: string, kind: string, _old: string, tail: string) => {
      const next = kind === "sdk" ? sdk : cli;
      return next && next !== "-" ? prefix + next + tail : line;
    }
  );
/** Admit Debian files only from exact mirror hosts and post-authentication records. */
export function vettedDebs(output: string): Deb[] {
  let started = false;
  const out: Deb[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("@@ADMIN start")) started = true;
    else if (started && line.startsWith("@@URI ")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length !== 4) continue;
      const [, url, name, sha256] = parts;
      if (!url || !name || !sha256) continue;
      const parsed = URL.parse(url);
      if (
        parsed &&
        ["http:", "https:"].includes(parsed.protocol) &&
        Config.DEBIAN_MIRRORS.includes(parsed.hostname) &&
        /^[A-Za-z0-9][A-Za-z0-9.+_~%-]*\.deb$/.test(name) &&
        /^[0-9a-f]{64}$/.test(sha256)
      )
        out.push({ url, name, sha256 });
    }
  }
  return out;
}
/** Stable summary table matching the Python CLI's spacing and ordering. */
export function render(rows: readonly Row[]) {
  const order: Readonly<Record<string, number>> = Config.STATUS_ORDER;
  const ordered = rows.toSorted(
    (a, b) =>
      Object.keys(HOSTS).indexOf(a.host) - Object.keys(HOSTS).indexOf(b.host) ||
      (HARNESSES.includes(a.harness) ? HARNESSES.indexOf(a.harness) : 99) -
        (HARNESSES.includes(b.harness) ? HARNESSES.indexOf(b.harness) : 99) ||
      (order[a.status] ?? 9) - (order[b.status] ?? 9)
  );
  const table = [
    ["host", "harness", "status", "version", "method", "note"],
    ...ordered.map((r) => [
      r.host,
      r.harness,
      r.status,
      ["-", r.before].includes(r.after) ? r.before : `${r.before} -> ${r.after}`,
      r.method,
      (r.note + (["-", ""].includes(r.path) ? "" : ` [${r.path}]`)).trim(),
    ]),
  ];
  const widths = Array.from({ length: 5 }, (_, i) => Math.max(...table.map((r) => r[i]?.length ?? 0)));
  return table
    .map(
      (r) =>
        r
          .slice(0, 5)
          .map((c, i) => c.padEnd(widths[i] ?? 0))
          .join("  ") +
        "  " +
        r[5]
    )
    .join("\n");
}
const readText = (path: string) => {
  try {
    return Fs.readFileSync(path, "utf8").trim();
  } catch {
    return "-";
  }
};
const publishedT3 = () => {
  try {
    const v: unknown = JSON.parse(readText(`${t3opt}/publish/latest.json`));
    return v && typeof v === "object" && "version" in v && typeof v.version === "string" ? v.version : "-";
  } catch {
    return "-";
  }
};
const controlPath = (host: string) => `${home}/.ssh/cm-harness-${host}`;
/** Existing-master-only transport: the fallback destination cannot resolve. */
export const muxArgv = (host: string) => [
  "ssh",
  "-F",
  "/dev/null",
  "-o",
  `ControlPath=${controlPath(host)}`,
  "-o",
  "ControlMaster=no",
  "-o",
  "BatchMode=yes",
  ...keepalive,
  `harness-${host}.invalid`,
];

class Run {
  readonly stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  readonly logPath: string;
  readonly logFd: number;
  readonly rows: Row[] = [];
  constructor(readonly args: Options) {
    this.logPath = `${state}/${this.stamp}-${args.mode}.log`;
    this.logFd = Fs.openSync(this.logPath, "a", 0o600);
  }
  say(host: string, message: string) {
    console.log(`[${host}] ${message}`);
    this.log(`[${host}] ${message}`);
  }
  log(text: string) {
    Fs.writeSync(this.logFd, text.endsWith("\n") ? text : text + "\n");
  }
  add(...rows: Row[]) {
    this.rows.push(...rows);
  }
  sh = Effect.fn("Harness.command")(
    (argv: readonly string[], timeout = 900, input?: Uint8Array, env: NodeJS.ProcessEnv = process.env) =>
      Effect.scoped(
        Effect.gen({ self: this }, function* () {
          const [command, ...args] = argv;
          if (!command) return { status: 127, output: Buffer.alloc(0) };
          this.log(`$ ${shellJoin(argv).slice(0, 2000)}`);
          const output: Buffer[] = [];
          return yield* Effect.gen({ self: this }, function* () {
            const child = yield* ChildProcess.make(command, args, {
              env,
              extendEnv: false,
              stdin: input ? Stream.make(input) : "ignore",
              stdout: "pipe",
              stderr: "pipe",
              forceKillAfter: "5 seconds",
            });
            const status = yield* Effect.all(
              [
                child.exitCode,
                Stream.runForEach(child.stdout, (chunk) =>
                  Effect.sync(() => {
                    output.push(Buffer.from(chunk));
                  })
                ),
                Stream.runForEach(child.stderr, (chunk) =>
                  Effect.sync(() => {
                    Fs.writeSync(this.logFd, chunk);
                  })
                ),
              ],
              { concurrency: 3 }
            );
            return { status: Number(status[0]), output: Buffer.concat(output) };
          }).pipe(
            Effect.timeout(`${timeout} seconds`),
            Effect.catchTag("TimeoutError", () =>
              Effect.sync(() => {
                this.log(`timeout after ${timeout}s`);
                return { status: 124, output: Buffer.concat(output) };
              })
            )
          );
        })
      )
  );
}
const masterAlive = Effect.fn("Harness.masterAlive")(function* (run: Run, host: string) {
  return (
    Fs.existsSync(controlPath(host)) &&
    (yield* run.sh(
      ["ssh", "-F", "/dev/null", "-o", `ControlPath=${controlPath(host)}`, "-O", "check", "harness.invalid"],
      30
    )).status === 0
  );
});
const ensureAgent = Effect.fn("Harness.ensureAgent")(function* (run: Run) {
  if (!Fs.existsSync(`${home}/.ssh/agent-dankserver.sock`)) yield* run.sh([`${bin}/ssh-dankserver-yubi`, "-G"], 60);
});
const openMaster = Effect.fn("Harness.openMaster")(function* (run: Run, host: string) {
  if (yield* masterAlive(run, host)) return true;
  const config = HOSTS[host];
  if (!config?.wrapper) return false;
  if (config.agent_init === "dankserver-agent") yield* ensureAgent(run);
  const argv = [
    `${bin}/${config.wrapper}`,
    "-o",
    "ControlMaster=yes",
    "-o",
    "ControlPersist=2h",
    "-o",
    `ControlPath=${controlPath(host)}`,
    "-o",
    "ConnectTimeout=25",
    ...keepalive,
    "-fN",
  ];
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (config.touch) run.say(host, `touch the YubiKey now (SSH, attempt ${attempt}/3)`);
    yield* run.sh(argv, 120);
    if (yield* masterAlive(run, host)) return true;
    if (!config.touch) break;
  }
  return false;
});
const adminRun = Effect.fn("Harness.adminRun")(function* (
  run: Run,
  host: string,
  script: string,
  args: readonly string[]
) {
  const config = HOSTS[host];
  if (!config?.admin) return { status: 2, output: "" };
  if (config.admin_agent === "dankserver-agent") yield* ensureAgent(run);
  const [wrapper, ...route] = config.admin;
  let output = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    run.say(host, `admin route: touch the YubiKey for SSH, then for sudo (attempt ${attempt}/3)`);
    const result = yield* run.sh(
      [
        `${bin}/${wrapper}`,
        ...route,
        ...keepalive,
        shellJoin(["bash", "-c", Config.ADMIN_PRELUDE + script, "admin", ...args]),
      ],
      3600
    );
    output = result.output.toString("utf8").replaceAll("\r", "");
    run.log(output);
    if (output.includes("@@ADMIN start") || ![255, 124].includes(result.status))
      return { status: result.status, output };
  }
  return { status: 255, output };
});
const guarded = Effect.fn("Harness.guarded")(
  <A, E, R>(run: Run, host: string, harnesses: readonly string[], effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const message = `internal error: ${cause}`;
          run.say(host, message);
          run.add(...harnesses.map((h) => row(host, h, "failed", "-", "-", "-", "-", message)));
        })
      )
    )
);
const agentPhase = Effect.fn("Harness.agentPhase")(function* (
  run: Run,
  host: string,
  harnesses: readonly string[],
  pins: Record<string, Pins>
) {
  const noMigrate = run.args.noJunieMigrate;
  const result = HOSTS[host]?.wrapper
    ? yield* run.sh(
        [
          ...muxArgv(host),
          (noMigrate ? "HARNESS_JUNIE_MIGRATE=0 " : "") + "bash -s -- " + shellJoin([run.args.mode, ...harnesses]),
        ],
        7200,
        Fs.readFileSync(hostScript)
      )
    : yield* run.sh(["bash", hostScript, run.args.mode, ...harnesses], 7200, undefined, {
        ...process.env,
        ...(noMigrate ? { HARNESS_JUNIE_MIGRATE: "0" } : {}),
      });
  const output = result.output.toString("utf8");
  run.log(output);
  if (result.status) run.say(host, `host agent exited ${result.status}; see ${run.logPath}`);
  const parsed = rowsFromRecords(host, parseRecords(output), run.args.mode);
  if (host !== hub && harnesses.includes("t3code") && run.args.mode === "status")
    markT3Published(parsed.rows, publishedT3());
  const rows = [
    ...parsed.rows,
    ...missingRows(host, harnesses, parsed.rows, `host agent exit ${result.status}; no record (see log)`),
  ];
  run.add(...rows);
  if (parsed.pins) pins[host] = parsed.pins;
  for (const r of rows)
    if (["updated", "failed"].includes(r.status))
      run.say(host, `${r.harness}: ${r.status} ${r.before} -> ${r.after} ${r.note}`.trimEnd());
});
const hubT3 = Effect.fn("Harness.hubT3")(function* (run: Run) {
  const before = readText(`${t3opt}/source-version`);
  if (run.args.mode === "status") {
    const rows = [row(hub, "t3code", "installed", before, "-", "fork-sync", t3opt)];
    markT3Published(rows, publishedT3());
    run.add(...rows);
    return;
  }
  run.say(hub, "t3code: fork sync + build + publish (can take up to 90 min)");
  const result = yield* run.sh(["systemctl", "--user", "start", "t3code-source-update.service"], 95 * 60),
    after = readText(`${t3opt}/source-version`);
  const [status, note] =
    result.status === 124
      ? ["pending", "sync still running; workers pull it within 30 min"]
      : result.status
        ? ["failed", "see ~/.local/state/t3code-sync/"]
        : after !== before
          ? ["updated", "restart prompt posted if the app is open"]
          : ["current", ""];
  run.add(row(hub, "t3code", status ?? "failed", before, after, "fork-sync", t3opt, note));
});
const download = Effect.fn("Harness.download")(function* (url: string, timeout: number) {
  const response = yield* HttpClient.get(url).pipe(Effect.timeout(`${timeout} seconds`));
  return Buffer.from(yield* response.arrayBuffer);
});
const processRunning = (needle: string) =>
  Fs.readdirSync("/proc")
    .filter((name) => /^\d+$/.test(name))
    .some((name) => {
      try {
        return Fs.readFileSync(`/proc/${name}/cmdline`).toString().replaceAll("\0", " ").includes(needle);
      } catch {
        return false;
      }
    });
const kimiDesktop = Effect.fn("Harness.kimiDesktop")(function* (run: Run) {
  const installed = /^version:\s*(\S+)/m.exec(readText(kimiInstalled))?.[1] ?? "-";
  if (!Fs.existsSync(kimiAppimage)) {
    run.add(row(hub, "kimi-desktop", "absent", "-", "-", "-", "-", `no ${kimiAppimage}`));
    return;
  }
  const loaded = yield* download(kimiFeed, 30).pipe(Effect.result);
  if (loaded._tag === "Failure") {
    run.add(row(hub, "kimi-desktop", "failed", installed, "-", "-", "-", `feed: ${loaded.failure}`));
    return;
  }
  const feedText = loaded.success.toString("utf8"),
    feed = parseElectronFeed(feedText);
  if (!feed) {
    run.add(
      row(hub, "kimi-desktop", "failed", installed, "-", "-", "-", "feed: feed has no version or AppImage checksum")
    );
    return;
  }
  let result = row(hub, "kimi-desktop", "current", installed, feed.version, "appimage-feed", kimiAppimage);
  if (feed.version === installed) {
    run.add(result);
    return;
  }
  if (run.args.mode === "status") {
    run.add({ ...result, status: "pending" });
    return;
  }
  const part = `${kimiDir}/.KimiCode-${feed.version}.AppImage.part`;
  const saved = yield* Effect.gen(function* () {
    const bytes = yield* download(new URL(feed.url, kimiFeed).href, 60);
    if (
      Crypto.createHash("sha512").update(bytes).digest("base64") !== feed.sha512 ||
      (feed.size && bytes.length !== feed.size)
    )
      return false;
    Fs.writeFileSync(part, bytes, { mode: 0o755 });
    Fs.chmodSync(part, 0o755);
    Fs.renameSync(kimiAppimage, `${kimiDir}/KimiCode-linux-x86_64.AppImage.prev`);
    Fs.renameSync(part, kimiAppimage);
    Fs.writeFileSync(kimiInstalled, feedText);
    return true;
  }).pipe(Effect.catchCause(() => Effect.succeed(false)));
  if (!saved) {
    Fs.rmSync(part, { force: true });
    run.add(row(hub, "kimi-desktop", "failed", installed, "-", "-", "-", "checksum or size mismatch"));
    return;
  }
  run.add({ ...result, status: "updated", note: processRunning(kimiAppimage) ? "restart Kimi Code to load it" : "" });
});
const pacmanQuery = Effect.fn("Harness.pacmanQuery")(function* (run: Run, pkgs: readonly string[]) {
  const result = yield* run.sh(["pacman", "-Q", ...pkgs], 60);
  return Object.fromEntries(
    result.output
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(" ");
        return [line.slice(0, i), line.slice(i + 1)];
      })
  );
});
const pacmanDesktop = Effect.fn("Harness.pacmanDesktop")(function* (run: Run, harnesses: readonly string[]) {
  const pkgs = Object.fromEntries(harnesses.filter((h) => h in pacman).map((h) => [pacman[h] ?? "", h]));
  if (!Object.keys(pkgs).length) return;
  const installed = yield* pacmanQuery(run, Object.keys(pkgs));
  Fs.mkdirSync(`${cache}/checkup-db`, { recursive: true });
  const check = yield* run.sh(["checkupdates"], 300, undefined, {
    ...process.env,
    CHECKUPDATES_DB: `${cache}/checkup-db`,
  });
  if (![0, 2].includes(check.status)) {
    run.add(
      ...Object.entries(pkgs).map(([p, h]) => row(hub, h, "failed", installed[p], "-", "-", "-", "checkupdates failed"))
    );
    return;
  }
  const pending: Record<string, string> = {};
  for (const line of check.output.toString().split("\n")) {
    const m = /^(\S+)\s+\S+\s+->\s+(\S+)/.exec(line);
    if (m?.[1] && m[1] in pkgs && m[2]) pending[m[1]] = m[2];
  }
  const targets = Object.keys(pending).filter((p) => p in installed);
  for (const [p, h] of Object.entries(pkgs)) {
    if (!(p in installed)) run.add(row(hub, h, "absent", "-", "-", "-", "-", `${p} not installed`));
    else if (!(p in pending)) run.add(row(hub, h, "current", installed[p], installed[p], "pacman", p));
    else if (run.args.mode === "status" || !run.args.systemUpgrade)
      run.add(
        row(
          hub,
          h,
          "pending",
          installed[p],
          pending[p],
          "pacman",
          p,
          run.args.mode === "status" ? "" : "Arch updates whole systems only: rerun with --system-upgrade (pacman -Syu)"
        )
      );
  }
  if (run.args.mode === "status" || !targets.length || !run.args.systemUpgrade) return;
  const runner = `ok=0; for i in 1 2 3; do echo "sudo attempt $i/3"; timeout 60 ${quote(`${bin}/yubi-sudo`)} -v && { ok=1; break; }; done; [ $ok = 1 ] || exit 77; sudo -n pacman -Syu --noconfirm`;
  run.say(hub, `pacman -Syu (pending: ${targets.join(" ")}): touch the YubiKey now`);
  const status = yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make("script", ["-qec", runner, "/dev/null"], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const [status] = yield* Effect.all(
        [
          child.exitCode,
          Stream.runForEach(child.stdout, (b) =>
            Effect.sync(() => {
              Fs.writeSync(run.logFd, b);
            })
          ),
          Stream.runForEach(child.stderr, (b) =>
            Effect.sync(() => {
              Fs.writeSync(run.logFd, b);
            })
          ),
        ],
        { concurrency: 3 }
      );
      return status;
    })
  );
  const after = yield* pacmanQuery(run, targets);
  for (const p of targets) {
    const st = status === 77 ? "failed" : status ? "failed" : after[p] !== installed[p] ? "updated" : "current";
    let note =
      status === 77
        ? "YubiKey authentication failed three times"
        : status
          ? `pacman exit ${status}; check the system before retrying`
          : "";
    if (st === "updated" && processRunning(`/usr/lib/${p.replace(/-bin$/, "")}`)) note = "restart the app to load it";
    run.add(row(hub, pkgs[p] ?? "", st, installed[p], after[p], "pacman", p, note));
  }
});
const dpkgVersions = Effect.fn("Harness.dpkgVersions")(function* (run: Run, host: string, names: readonly string[]) {
  const fmt = "'${Package}\t${Version}\t${db:Status-Abbrev}\\n'";
  const result = yield* run.sh([...muxArgv(host), `dpkg-query -W -f ${fmt} ${shellJoin(names)} 2>/dev/null; true`], 60);
  if (result.status) return undefined;
  const out: Record<string, string> = {};
  for (const line of result.output.toString().split("\n")) {
    const [name, version, st] = line.split("\t");
    if (name && version && st?.startsWith("ii")) out[name] = version;
  }
  return out;
});
const pushDebs = Effect.fn("Harness.pushDebs")(function* (run: Run, host: string, debs: readonly Deb[]) {
  const stage = `${cache}/grok-bot-debs-${run.stamp}`;
  Fs.mkdirSync(stage, { recursive: true });
  return yield* Effect.gen(function* () {
    for (const d of debs) {
      const bytes = yield* download(d.url, 120);
      if (Crypto.createHash("sha256").update(bytes).digest("hex") !== d.sha256) return false;
      Fs.writeFileSync(`${stage}/${d.name}`, bytes);
    }
    const tar = yield* run.sh(["tar", "-C", stage, "-cf", "-", ...debs.map((d) => d.name)]);
    if (tar.status) return false;
    const result = yield* run.sh(
      [...muxArgv(host), `d="$HOME/.cache/beep-debs/${run.stamp}" && mkdir -p "$d" && tar -C "$d" -xf -`],
      1800,
      tar.output
    );
    return result.status === 0;
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        run.say(host, `deb push failed: ${cause}`);
        return false;
      })
    )
  );
});
const grokBotDebs = Effect.fn("Harness.grokBotDebs")(function* (run: Run, harnesses: readonly string[]) {
  const host = "grok-bot",
    wanted = harnesses.filter((h) => h in debNames);
  if (!wanted.length) return;
  const present = yield* dpkgVersions(run, host, [...new Set(wanted.flatMap((h) => debNames[h] ?? []))].toSorted());
  if (!present) {
    run.add(...wanted.map((h) => row(host, h, "unreachable", "-", "-", "-", "-", "dpkg query failed (asleep?)")));
    return;
  }
  const byHarness = Object.fromEntries(wanted.map((h) => [h, debNames[h]?.find((n) => n in present)]));
  for (const [h, pkg] of Object.entries(byHarness)) {
    if (!pkg) run.add(row(host, h, "absent", "-", "-", "-", "-", "no Debian package installed"));
    else if (run.args.mode === "status") run.add(row(host, h, "installed", present[pkg], "-", "apt", pkg));
  }
  const pkgs = Object.values(byHarness).filter((p): p is string => Boolean(p));
  if (run.args.mode === "status" || !pkgs.length) return;
  let result = yield* adminRun(run, host, Config.APT_UPGRADE, ["-", "--", ...pkgs]);
  const debs = vettedDebs(result.output);
  if (result.output.includes("@@ADMIN apt-failed") && debs.length) {
    run.say(host, `apt needs ${debs.length} Debian pool file(s) the box cannot fetch; pushing from the hub`);
    if (yield* pushDebs(run, host, debs))
      result = yield* adminRun(run, host, Config.APT_UPGRADE, [
        run.stamp,
        ...debs.map((d) => `${d.name}=${d.sha256}`),
        "--",
        ...pkgs,
      ]);
  }
  const after = (yield* dpkgVersions(run, host, pkgs)) ?? {},
    ok = result.output.includes("@@ADMIN apt-ok");
  for (const [h, pkg] of Object.entries(byHarness)) {
    if (!pkg) continue;
    if (ok)
      run.add(row(host, h, after[pkg] !== present[pkg] ? "updated" : "current", present[pkg], after[pkg], "apt", pkg));
    else
      run.add(
        row(
          host,
          h,
          "failed",
          present[pkg],
          after[pkg],
          "apt",
          pkg,
          result.status === 77 ? "YubiKey authentication failed" : "apt failed; see log (runbook: grok-bot section)"
        )
      );
  }
});
const apparmorFix = Effect.fn("Harness.apparmorFix")(function* (run: Run, host: string, rec: Pins) {
  if (!rec.drift) return;
  const base = row(host, "cursor-sandbox", "pending", "-", "-", "apparmor", apparmorPath);
  if (run.args.mode === "status") {
    run.add({ ...base, note: "profile pins stale helper paths; update repins it" });
    return;
  }
  if (!HOSTS[host]?.admin) {
    run.add({ ...base, status: "skipped", note: "pins drifted; this host has no admin route here" });
    return;
  }
  const current = (yield* run.sh([...muxArgv(host), `cat ${apparmorPath}`], 60)).output.toString(),
    updated = repinProfile(current, rec.sdk, rec.cli);
  if (!current || updated === current) {
    run.add({ ...base, status: "skipped", note: "could not compute new pins (helper missing?)" });
    return;
  }
  const result = yield* adminRun(run, host, Config.APPARMOR_FIX, [Buffer.from(updated).toString("base64")]);
  const check = (yield* run.sh(
    [...muxArgv(host), "env PATH=$HOME/.local/bin:$PATH timeout 60 cursor-agent sandbox run echo ok"],
    90
  )).output.toString();
  const ok = result.output.includes("@@ADMIN ok") && check.trim().endsWith("ok");
  run.add({
    ...base,
    status: ok ? "updated" : "failed",
    note: ok
      ? "repinned; restart T3 on the host when idle if Cursor turns still fail preflight"
      : result.status === 77
        ? "YubiKey authentication failed"
        : "repin or sandbox check failed; see log",
  });
});
const execute = Effect.fn("Harness.execute")(function* (run: Run, matrix: Readonly<Record<string, string[]>>) {
  const pins: Record<string, Pins> = {},
    local = matrix[hub] ?? [],
    reachable: string[] = [];
  const hubT3Fiber = local.includes("t3code")
    ? yield* Effect.forkChild(guarded(run, hub, ["t3code"], hubT3(run)))
    : undefined;
  const jobs = [];
  const localCli = local.filter((h) => CLI.includes(h));
  if (localCli.length)
    jobs.push(yield* Effect.forkChild(guarded(run, hub, localCli, agentPhase(run, hub, localCli, pins))));
  if (local.includes("kimi-desktop"))
    jobs.push(yield* Effect.forkChild(guarded(run, hub, ["kimi-desktop"], kimiDesktop(run))));
  yield* guarded(
    run,
    hub,
    local.filter((h) => h in pacman),
    pacmanDesktop(run, local)
  );
  for (const host of Object.keys(matrix).filter((h) => h !== hub)) {
    if (yield* openMaster(run, host)) reachable.push(host);
    else
      run.add(...(matrix[host] ?? []).map((h) => row(host, h, "unreachable", "-", "-", "-", "-", HOSTS[host]?.down)));
  }
  for (const host of reachable) {
    const cli = (matrix[host] ?? []).filter((h) => CLI.includes(h));
    if (cli.length) jobs.push(yield* Effect.forkChild(guarded(run, host, cli, agentPhase(run, host, cli, pins))));
  }
  yield* Effect.forEach(jobs, Fiber.join, { concurrency: 8 });
  if (hubT3Fiber) yield* Fiber.join(hubT3Fiber);
  const pulls = [];
  for (const host of reachable)
    if (matrix[host]?.includes("t3code")) {
      if (!(yield* openMaster(run, host))) {
        run.add(row(host, "t3code", "unreachable", "-", "-", "-", "-", "SSH master lost during the hub build"));
        continue;
      }
      if (run.args.mode === "update")
        run.say(host, "t3code: pulling the published fork build (restarts the host's T3 if it changes)");
      pulls.push(yield* Effect.forkChild(guarded(run, host, ["t3code"], agentPhase(run, host, ["t3code"], pins))));
    }
  yield* Effect.forEach(pulls, Fiber.join, { concurrency: 8 });
  for (const [host, rec] of Object.entries(pins))
    if ((matrix[host] ?? []).some((h) => ["cursor-agent", "t3code"].includes(h)) && (yield* openMaster(run, host)))
      yield* guarded(run, host, ["cursor-sandbox"], apparmorFix(run, host, rec));
  if (reachable.includes("grok-bot")) {
    const wanted = (matrix["grok-bot"] ?? []).filter((h) => h in debNames);
    if (wanted.length) {
      if (yield* openMaster(run, "grok-bot"))
        yield* guarded(run, "grok-bot", wanted, grokBotDebs(run, matrix["grok-bot"] ?? []));
      else
        run.add(
          ...wanted.map((h) => row("grok-bot", h, "unreachable", "-", "-", "-", "-", "went to sleep during the run"))
        );
    }
  }
  if (run.args.mode === "status") {
    const latest: Record<string, string> = {};
    for (const [h, pkg] of Object.entries(Config.NPM_LATEST)) {
      const result = yield* run.sh(["npm", "view", pkg, "version"], 60);
      latest[h] = result.status === 0 ? result.output.toString().trim() : "-";
    }
    markLatest(run.rows, latest);
  }
});
const libc = dlopen("libc.so.6", { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });
const main = Effect.gen(function* () {
  const argv = process.argv.slice(2),
    mode = argv.shift();
  if (mode !== "plan" && mode !== "status" && mode !== "update") {
    console.error(
      "usage: update_harnesses.ts {plan,status,update} [--host H] [--harness X] [--system-upgrade] [--no-junie-migrate]"
    );
    return 2;
  }
  const hosts: string[] = [],
    harnesses: string[] = [];
  let systemUpgrade = false,
    noJunieMigrate = false;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === "--host" || arg === "--harness") {
      const name = argv.shift() ?? "",
        known = arg === "--host" ? Object.keys(HOSTS) : HARNESSES,
        key = canonical(name, known);
      if (!key) {
        console.error(`unknown name '${name}'; expected one of ${known.join(", ")}`);
        return 1;
      }
      (arg === "--host" ? hosts : harnesses).push(key);
    } else if (arg === "--system-upgrade") systemUpgrade = true;
    else if (arg === "--no-junie-migrate") noJunieMigrate = true;
    else {
      console.error(`unrecognized arguments: ${arg}`);
      return 2;
    }
  }
  if (!hosts.length) hosts.push(...Object.keys(HOSTS));
  if (!harnesses.length) harnesses.push(...HARNESSES);
  const matrix = Object.fromEntries(Object.entries(plan(hosts, harnesses)).filter(([, hs]) => hs.length));
  if (mode === "plan") {
    for (const [host, hs] of Object.entries(matrix)) console.log(`${host.padEnd(12)} ${hs.join(" ")}`);
    return 0;
  }
  Fs.mkdirSync(state, { recursive: true });
  Fs.mkdirSync(cache, { recursive: true });
  const lock = Fs.openSync(`${state}/run.lock`, "w", 0o600);
  if (libc.symbols.flock(lock, 2 | 4) !== 0) {
    Fs.closeSync(lock);
    console.error("another update-harnesses run holds the lock; not starting a second one");
    return 75;
  }
  const run = new Run({ mode, hosts, harnesses, systemUpgrade, noJunieMigrate });
  try {
    const touchHosts: string[] = [];
    for (const h of Object.keys(matrix)) if (HOSTS[h]?.touch && !(yield* masterAlive(run, h))) touchHosts.push(h);
    if (touchHosts.length) console.log(`YubiKey touches ahead, one at a time: SSH to ${touchHosts.join(", ")}`);
    yield* execute(run, matrix);
    console.log();
    console.log(render(run.rows));
    const receipt = `${state}/${run.stamp}-${mode}.json`;
    const codec = S.fromJsonString(
      S.Struct({ mode: S.String, stamp: S.String, matrix: S.Record(S.String, S.Array(S.String)), rows: S.Array(Row) })
    );
    Fs.writeFileSync(receipt, yield* S.encodeEffect(codec)({ mode, stamp: run.stamp, matrix, rows: run.rows }), {
      mode: 0o600,
    });
    console.log(`\nreceipt: ${receipt}\nlog: ${run.logPath}`);
    return run.rows.some((r) => ["failed", "unreachable"].includes(r.status)) ? 1 : 0;
  } finally {
    Fs.closeSync(run.logFd);
    libc.symbols.flock(lock, 8);
    Fs.closeSync(lock);
  }
});
if (import.meta.main)
  process.exitCode = await runAdapter(
    main.pipe(Effect.provide(BunServices.layer), Effect.provide(BunHttpClient.layer)),
    1
  );
