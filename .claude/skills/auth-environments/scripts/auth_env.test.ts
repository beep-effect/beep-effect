import { expect, spyOn, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Fs from "node:fs";
import * as Os from "node:os";
import {
  URL_RE,
  ANSI,
  OK_RE,
  BAD_RE,
  PROMPT_RE,
  HELPER,
  HOSTS,
  sshArgv,
  loginCommand,
  REMOTE_PATH,
  CONNECT_TIMEOUT_SECONDS,
  HostUnreachable,
  main,
} from "./auth_env.ts";
const sample =
  "Opening browser to sign in…\r\nIf the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&client_id=x&state=y&login_hint=a%40example.invalid\r\nPaste code here if prompted > ";
test("recorded OAuth URL output", () => {
  const url = URL_RE.exec(sample.replace(ANSI, ""))?.[0];
  expect(url?.startsWith("https://claude.com/cai/oauth/authorize?")).toBe(true);
  expect(url).not.toContain("Paste");
});
test("recorded prompt and outcome strings", () => {
  expect(PROMPT_RE.test(sample)).toBe(true);
  expect(OK_RE.test("Login successful.")).toBe(true);
  expect(BAD_RE.test("OAuth error: invalid_grant")).toBe(true);
  expect(OK_RE.test(sample)).toBe(false);
});
test("helper resolves to sibling TypeScript skill", () => expect(Fs.existsSync(HELPER)).toBe(true));
test("hosts use canonical wrappers and dedicated control paths", () => {
  for (const [host, [wrapper]] of Object.entries(HOSTS)) {
    expect(wrapper.startsWith("ssh-")).toBe(true);
    expect(sshArgv(host)).toContain(`ControlPath=${Os.homedir()}/.ssh/cm-auth-${host}`);
  }
});
test("recorded hostile email remains one remote shell word", () => {
  const cmd = loginCommand("a'b;touch x@example.invalid");
  expect(cmd.startsWith(REMOTE_PATH + " claude auth login")).toBe(true);
  expect(cmd.endsWith(`--email 'a'"'"'b;touch x@example.invalid'`)).toBe(true);
});
test("every ssh route bounds the connect phase", () => {
  for (const host of Object.keys(HOSTS)) expect(sshArgv(host)).toContain(`ConnectTimeout=${CONNECT_TIMEOUT_SECONDS}`);
  expect(CONNECT_TIMEOUT_SECONDS).toBeLessThanOrEqual(15);
});
const runStatus = async (argv: readonly string[], offline: string) => {
  const lines: string[] = [];
  const spy = spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
  try {
    const code = await Effect.runPromise(
      main(argv, {
        status: (host) =>
          host === offline
            ? Effect.fail(new HostUnreachable({ host, reason: "ssh exited 255" }))
            : Effect.succeed({ email: `${host}@example.invalid`, ok: true }),
        login: () => Effect.succeed(true),
      })
    );
    return { code, lines };
  } finally {
    spy.mockRestore();
  }
};
test("an unreachable host is reported while the other hosts still are", async () => {
  const { code, lines } = await runStatus(["status"], "grok-bot");
  expect(code).toBe(1);
  expect(lines).toContain("[grok-bot] unreachable: ssh exited 255");
  for (const host of Object.keys(HOSTS).filter((host) => host !== "grok-bot"))
    expect(lines).toContain(`[${host}] currently ${host}@example.invalid`);
  const summary = lines.slice(lines.indexOf("\nsummary:") + 1);
  expect(summary).toHaveLength(Object.keys(HOSTS).length);
  expect(summary).toContain(`  ${"grok-bot".padEnd(14)} unreachable`);
  expect(summary).toContain(`  ${"dankserver".padEnd(14)} dankserver@example.invalid`);
});
test("a single unreachable host still prints its summary and exits nonzero", async () => {
  const { code, lines } = await runStatus(["status", "grok-bot"], "grok-bot");
  expect(code).toBe(1);
  expect(lines.slice(-2)).toEqual(["\nsummary:", `  ${"grok-bot".padEnd(14)} unreachable`]);
});
test("all reachable hosts exit zero", async () => {
  const { code } = await runStatus(["status"], "none");
  expect(code).toBe(0);
});
