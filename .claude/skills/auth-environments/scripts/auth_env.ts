#!/usr/bin/env bun
/** Fleet Claude login; OAuth code bytes stay in the private FIFO and remote PTY. */
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as BunServices from "@effect/platform-bun/BunServices";
import { requestCode, runAdapter } from "../../plasma-sensitive-entry/scripts/transport.ts";
import { runOwned } from "../../plasma-sensitive-entry/scripts/prompt.ts";

const bin = `${Os.homedir()}/.local/bin`;
export const HELPER = new URL("../../plasma-sensitive-entry/scripts/prompt.ts", import.meta.url).pathname;
export const REMOTE_PATH = "env PATH=$HOME/.local/bin:$HOME/.bun/bin:/usr/local/bin:$PATH";
export const HOSTS: Record<string, readonly [string, boolean, string | undefined]> = {
  "grok-bot": ["ssh-grok-bot", false, undefined],
  "beep-worker": ["ssh-beep-worker-yubi", true, "dankserver-agent"],
  dankserver: ["ssh-dankserver-worker", true, "dankserver-agent"],
  "tbk-worker": ["ssh-tbk-worker", true, undefined],
  "tom-pc-1-wsl": ["ssh-tom-pc-1-wsl", true, undefined],
};
export const URL_RE = /https:\/\/(?:[a-z0-9.-]+\.)?(?:claude\.(?:ai|com)|anthropic\.com)\/\S*oauth\/authorize\S+/;
export const OK_RE = /[Ll]ogin successful|[Ll]ogged in as|[Ss]uccessfully (?:logged|authenticated|signed)/;
export const BAD_RE = /[Ii]nvalid (?:code|grant)|[Aa]uthentication failed|OAuth error|[Ee]rror:/;
export const PROMPT_RE = /[Pp]aste code/;
export const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r/g;
const log = (host: string, message: string) => console.log(`[${host}] ${message}`);
/** POSIX single-word shell quoting, matching shlex.quote. */
export const quote = (value: string) =>
  /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'"'"'`)}'`;
/** Wrapper-only SSH route with a dedicated per-host control socket. */
export function sshArgv(host: string) {
  return [
    `${bin}/${HOSTS[host]?.[0]}`,
    "-o",
    "ControlMaster=auto",
    "-o",
    "ControlPersist=1h",
    "-o",
    `ControlPath=${Os.homedir()}/.ssh/cm-auth-${host}`,
  ];
}
/** Quote email only; HOME and PATH expand on the remote host. */
export const loginCommand = (email: string) => `${REMOTE_PATH} claude auth login --claudeai --email ${quote(email)}`;

const openMaster = Effect.fn("Auth.openMaster")(function* (host: string) {
  if (HOSTS[host]?.[2] === "dankserver-agent" && !Fs.existsSync(`${Os.homedir()}/.ssh/agent-dankserver.sock`))
    yield* runOwned([`${bin}/ssh-dankserver-yubi`, "-G"], process.env, 60);
  if (Fs.existsSync(`${Os.homedir()}/.ssh/cm-auth-${host}`)) return;
  if (HOSTS[host]?.[1]) log(host, "touch the YubiKey now");
  yield* runOwned([...sshArgv(host), "-fN"], process.env, 120);
});
const status = Effect.fn("Auth.status")(function* (host: string) {
  yield* openMaster(host);
  return yield* Effect.gen(function* () {
    const result = yield* runOwned([...sshArgv(host), `${REMOTE_PATH} claude auth status`], process.env, 120);
    const text = result.output.toString("utf8");
    const data: unknown = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(
      text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
    );
    if (P.isObject(data))
      return {
        email: "email" in data && P.isString(data.email) ? data.email : undefined,
        ok: "loggedIn" in data && Boolean(data.loggedIn),
      };
    return { email: undefined, ok: false };
  }).pipe(Effect.catchCause(() => Effect.succeed({ email: undefined, ok: false })));
});
const guiEnv = Effect.fn("Auth.guiEnv")(function* () {
  let env: NodeJS.ProcessEnv = { ...process.env };
  // A complete selected session remains intact. Discovery is current-user-only.
  if (!(env.DBUS_SESSION_BUS_ADDRESS && (env.DISPLAY || env.WAYLAND_DISPLAY))) {
    const uid = process.geteuid?.();
    if (!uid || uid !== process.getuid?.()) return undefined;
    const runtime = `/run/user/${uid}`,
      bus = `${runtime}/bus`;
    const ownership = yield* Effect.try(() => [Fs.lstatSync(runtime), Fs.lstatSync(bus)]).pipe(Effect.option);
    if (ownership._tag === "None") return undefined;
    const [directory, socket] = ownership.value;
    if (
      !directory?.isDirectory() ||
      directory.uid !== uid ||
      directory.mode & 0o077 ||
      !socket?.isSocket() ||
      socket.uid !== uid
    )
      return undefined;
    const metadata = { XDG_RUNTIME_DIR: runtime, DBUS_SESSION_BUS_ADDRESS: `unix:path=${bus}` };
    if (Object.entries(metadata).some(([key, value]) => env[key] !== undefined && env[key] !== value)) return undefined;
    env = { ...env, ...metadata };
  }
  const result = yield* runOwned(["busctl", "--user", "status"], env, 5);
  return result.status === 0 ? env : undefined;
});

const login = Effect.fn("Auth.login")((host: string, email: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* openMaster(host);
      let seen = "";
      let alive = true;
      // Bun's Linux PTY API supplies the same controlling terminal as openpty + SSH -tt.
      const terminal = new Bun.Terminal({
        cols: 80,
        rows: 24,
        data(_terminal, bytes) {
          seen += Buffer.from(bytes).toString("utf8").replace(ANSI, "");
          // No remote output, before or after code submission, reaches a tool transcript.
          if (seen.length > 65536) seen = seen.slice(-65536);
        },
      });
      const child = Bun.spawn([...sshArgv(host), "-tt", loginCommand(email)], { terminal });
      child.exited.then(() => {
        alive = false;
      });
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          if (alive) child.kill("SIGTERM");
          yield* Effect.tryPromise(() => child.exited).pipe(
            Effect.timeout("10 seconds"),
            Effect.catchCause(() =>
              Effect.gen(function* () {
                child.kill("SIGKILL");
                yield* Effect.tryPromise(() => child.exited).pipe(Effect.timeout("5 seconds"), Effect.ignore);
              })
            )
          );
          terminal.close();
          seen = "";
        })
      );
      try {
        let url: string | undefined;
        const deadline = performance.now() + 120000;
        while (alive && !url && performance.now() < deadline) {
          url = URL_RE.exec(seen)?.[0]?.replace(/[).,'"]+$/, "");
          if (!url) yield* Effect.sleep("200 millis");
        }
        if (!url) {
          log(host, "no OAuth URL within 120 s");
          return false;
        }
        const env = yield* guiEnv();
        if (!env) {
          log(host, "dialog unavailable");
          return false;
        }
        for (let attempt = 1; attempt <= 3; attempt++) {
          // xdg-open is intentionally short-lived; scoped process cleanup covers cancellation.
          yield* Effect.forkChild(runOwned(["xdg-open", url], env, 30));
          log(host, `browser + KDE code dialog opened (attempt ${attempt})`);
          const result = yield* requestCode(
            `${host}: Claude Code sign-in`,
            `Paste the authorization code from the browser; it goes only to \`claude auth login\` on ${host}`,
            300,
            env
          ).pipe(
            Effect.raceFirst(
              Effect.gen(function* () {
                while (alive) yield* Effect.sleep("200 millis");
                return { status: 2, answer: Buffer.alloc(0) };
              })
            )
          );
          if (!alive) {
            result.answer.fill(0);
            log(host, "remote login exited before the code arrived");
            return false;
          }
          if (!result.answer.length || result.answer.some((byte) => byte < 0x20 || byte === 0x7f)) {
            result.answer.fill(0);
            log(
              host,
              result.status === 1
                ? "cancelled"
                : result.status === 3 || result.status === -3
                  ? "timed out"
                  : "dialog unavailable"
            );
            return false;
          }
          seen = "";
          try {
            terminal.write(result.answer);
            terminal.write("\n");
          } finally {
            result.answer.fill(0);
          }
          const end = performance.now() + 120000;
          let verdict = "timeout";
          while (performance.now() < end) {
            if (OK_RE.test(seen)) {
              verdict = "ok";
              break;
            }
            if (BAD_RE.test(seen) || PROMPT_RE.test(seen)) {
              verdict = "bad";
              break;
            }
            if (!alive) {
              verdict = "eof";
              break;
            }
            yield* Effect.sleep("200 millis");
          }
          seen = "";
          if (verdict === "ok") {
            log(host, "login successful");
            return true;
          }
          if (verdict === "bad") {
            log(host, "code rejected; reopening");
            continue;
          }
          log(host, `no confirmation (${verdict})`);
          return false;
        }
        return false;
      } finally {
        seen = "";
      }
    })
  )
);
const main = Effect.gen(function* () {
  const args = process.argv.slice(2),
    action = args.shift();
  if (action !== "status" && action !== "login") {
    console.error("usage: auth_env.ts {status,login} [--email EMAIL] [--force] [HOST ...]");
    return 2;
  }
  let email: string | undefined,
    force = false;
  const hosts: string[] = [];
  while (args.length) {
    const arg = args.shift();
    if (arg === "--email") email = args.shift();
    else if (arg === "--force") force = true;
    else if (arg) hosts.push(arg);
  }
  if (!hosts.length) hosts.push(...Object.keys(HOSTS));
  const unknown = hosts.filter((host) => !(host in HOSTS));
  if (unknown.length) {
    console.error(`unknown host(s): ${unknown.join(", ")}; known: ${Object.keys(HOSTS).join(", ")}`);
    return 1;
  }
  if (action === "login" && !email) {
    console.error("login needs --email");
    return 1;
  }
  const summary: Record<string, string> = {};
  for (const host of hosts) {
    const before = yield* status(host);
    log(host, `currently ${before.email || "unknown"}${before.ok ? "" : " (not logged in)"}`);
    if (action === "status") {
      summary[host] = before.email || "unknown";
      continue;
    }
    if (before.email === email && !force) {
      summary[host] = `${before.email} (unchanged)`;
      continue;
    }
    yield* login(host, email ?? "");
    const after = yield* status(host);
    summary[host] = `${after.email || "unknown"}${after.email === email ? "" : `  <-- expected ${email}`}`;
  }
  console.log("\nsummary:");
  for (const [host, line] of Object.entries(summary)) console.log(`  ${host.padEnd(14)} ${line}`);
  return 0;
});
if (import.meta.main) process.exitCode = await runAdapter(main.pipe(Effect.provide(BunServices.layer)), 1);
