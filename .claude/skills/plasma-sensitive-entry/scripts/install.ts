#!/usr/bin/env bun
/** Preserve existing instructions and refuse competing global discovery installs. */
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as BunServices from "@effect/platform-bun/BunServices";

export const START = "<!-- plasma-sensitive-entry:begin -->";
export const END = "<!-- plasma-sensitive-entry:end -->";
export const RULE = `${START}
## Sensitive human input

When an authorized task needs a password, OTP, recovery code, token or other
sensitive human text, read \`~/.agents/skills/plasma-sensitive-entry/SKILL.md\`
and use its masked Plasma delivery process. Never ask for the value in chat,
question tools, terminal input or files. Existing local YubiKey notification
wrappers, remote authentication wrappers and agent 1Password routes take
precedence. If secure GUI delivery is unavailable, stop sensitive collection.
${END}
`;

/** Preflight all links and markers, then atomically replace the current rule. */
export const install = Effect.fn("Plasma.install")(function* (home: string, source: string) {
  const path = yield* Path.Path;
  return yield* Effect.try(() => {
    const targets = [
      path.join(home, ".agents/skills/plasma-sensitive-entry"),
      path.join(home, ".claude/skills/plasma-sensitive-entry"),
    ];
    const instructions = path.join(home, ".codex/AGENTS.md");
    const stat = (name: string) => {
      try {
        return Fs.lstatSync(name);
      } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "ENOENT") return undefined;
        throw e;
      }
    };
    const existing = stat(instructions);
    if (existing?.isSymbolicLink()) return false;
    const original = existing ? Fs.readFileSync(instructions, "utf8") : "";
    for (const target of targets) {
      const info = stat(target);
      if (info && (!info.isSymbolicLink() || Fs.realpathSync(target) !== source)) return false;
    }
    const starts = original.split(START).length - 1,
      ends = original.split(END).length - 1;
    if (starts !== ends || starts > 1 || (starts && original.indexOf(END) < original.indexOf(START))) return false;
    const updated = starts
      ? original.slice(0, original.indexOf(START)) +
        RULE.replace(/\n$/, "") +
        original.slice(original.indexOf(END) + END.length)
      : original.replace(/\n+$/, "") + "\n\n" + RULE;
    for (const target of targets) {
      Fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!stat(target)) Fs.symlinkSync(source, target, "dir");
    }
    Fs.mkdirSync(path.dirname(instructions), { recursive: true });
    const temporary = Fs.mkdtempSync(path.join(path.dirname(instructions), ".AGENTS.md."));
    const file = path.join(temporary, "rule");
    try {
      const fd = Fs.openSync(file, "wx", existing ? existing.mode & 0o7777 : 0o600);
      try {
        Fs.writeFileSync(fd, updated);
        if (existing) Fs.fchmodSync(fd, existing.mode & 0o7777);
        Fs.fsyncSync(fd);
      } finally {
        Fs.closeSync(fd);
      }
      Fs.renameSync(file, instructions);
    } finally {
      Fs.rmSync(temporary, { recursive: true, force: true });
    }
    return true;
  });
});
if (import.meta.main) {
  const ok = await Effect.runPromise(
    install(Os.homedir(), Fs.realpathSync(new URL("..", import.meta.url))).pipe(
      Effect.provide(BunServices.layer),
      Effect.catchCause(() => Effect.succeed(false))
    )
  );
  if (ok) console.log("Global Codex default rule and Codex/Claude skill discovery links installed.");
  else {
    console.error("Global skill installation failed; reconcile existing targets before retrying.");
    process.exitCode = 2;
  }
}
