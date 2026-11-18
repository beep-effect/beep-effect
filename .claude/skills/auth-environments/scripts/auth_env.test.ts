import { expect, test } from "bun:test";
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
