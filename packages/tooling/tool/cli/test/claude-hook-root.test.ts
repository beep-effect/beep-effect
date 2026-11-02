import * as NodeURL from "node:url";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const settingsPath = NodeURL.fileURLToPath(new URL("../../../../../.claude/settings.json", import.meta.url));

const HookSettings = S.Struct({
  hooks: S.Record(S.String, S.Array(S.Struct({ hooks: S.Array(S.Struct({ command: S.String })) }))),
});
const HookSettingsJson = S.fromJsonString(HookSettings);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("hook launch project containment", (it) => {
  it.effect("keeps executable hooks in the session launch project when CWD is attacker controlled", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const settings = yield* S.decodeEffect(HookSettingsJson)(yield* fs.readFileString(settingsPath));
      const commands = A.flatMap(R.values(settings.hooks), (groups) =>
        A.flatMap(groups, (group) => A.map(group.hooks, (hook) => hook.command))
      );
      const guarded = A.filter(commands, (command) => Str.includes(".claude/hooks/")(command));
      expect(guarded.length).toBeGreaterThan(0);
      for (const command of guarded) {
        expect(command).toContain('d="${CLAUDE_PROJECT_DIR:-}"; [ -n "$d" ] && [ -d "$d/.claude/hooks" ] || exit 0;');
        expect(command).not.toContain("git rev-parse --show-toplevel");
      }

      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-root-test-" });
      const trusted = path.join(root, "trusted");
      const attacker = path.join(root, "attacker");
      for (const dir of [trusted, attacker]) {
        yield* fs.makeDirectory(path.join(dir, ".claude", "hooks"), { recursive: true });
      }
      const fixtureDirs: ReadonlyArray<readonly [string, string]> = [
        [trusted, "trusted"],
        [attacker, "attacker"],
      ];
      for (const [dir, label] of fixtureDirs) {
        const shell = path.join(dir, ".claude", "hooks", "hook-pulse.sh");
        yield* fs.writeFileString(shell, `#!/bin/sh\necho ${label}-shell\n`);
        yield* fs.chmod(shell, 0o755);
      }
      const shellCommand = A.findFirst(guarded, (command) => Str.includes("hook-pulse.sh")(command)).pipe(
        O.getOrElse(() => "")
      );
      expect(shellCommand).not.toBe("");
      const result = Bun.spawnSync(["sh", "-c", shellCommand], {
        cwd: attacker,
        env: { ...process.env, CLAUDE_PROJECT_DIR: trusted },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toBe("trusted-shell\n");
      expect(result.stderr.toString()).toBe("");
    })
  );
});
