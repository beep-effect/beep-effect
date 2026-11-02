import * as NodeURL from "node:url";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const hookPath = NodeURL.fileURLToPath(new URL("../../../../../.claude/hooks/packet-projections.sh", import.meta.url));
const projectionCalls = "run beep goals index --write\nrun beep explore atlas --write\n";

it.layer(NodeServices.layer, { timeout: "30 seconds" })("packet projections SessionStart hook", (it) => {
  const runHook = Effect.fn("PacketProjectionsHookTest.runHook")(function* (options: {
    readonly dependencies: boolean;
    readonly stubExit: number;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-packet-projections-test-" });
    const repo = path.join(root, "repo");
    const bin = path.join(root, "bin");
    const log = path.join(root, "bun-calls.log");
    yield* fs.makeDirectory(repo, { recursive: true });
    yield* fs.makeDirectory(bin, { recursive: true });
    yield* fs.writeFileString(log, "");
    if (options.dependencies) {
      yield* fs.makeDirectory(path.join(repo, "node_modules", "effect"), { recursive: true });
    }
    const stub = path.join(bin, "bun");
    yield* fs.writeFileString(stub, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$STUB_LOG"\nexit ${options.stubExit}\n`);
    yield* fs.chmod(stub, 0o755);

    const result = Bun.spawnSync(["bash", hookPath], {
      cwd: root,
      env: { CLAUDE_PROJECT_DIR: repo, HOME: root, PATH: `${bin}:/usr/bin:/bin`, STUB_LOG: log },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      calls: yield* fs.readFileString(log),
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
      stdout: result.stdout.toString(),
    };
  });

  it.effect("skips both projection commands when node_modules/effect is absent", () =>
    Effect.gen(function* () {
      const result = yield* runHook({ dependencies: false, stubExit: 0 });
      expect(result).toStrictEqual({ calls: "", exitCode: 0, stderr: "", stdout: "" });
    })
  );

  it.effect("runs both projection commands when dependencies are installed", () =>
    Effect.gen(function* () {
      const result = yield* runHook({ dependencies: true, stubExit: 0 });
      expect(result).toStrictEqual({ calls: projectionCalls, exitCode: 0, stderr: "", stdout: "" });
    })
  );

  it.effect("stays non-blocking when both projection commands fail", () =>
    Effect.gen(function* () {
      const result = yield* runHook({ dependencies: true, stubExit: 1 });
      expect(result).toStrictEqual({ calls: projectionCalls, exitCode: 0, stderr: "", stdout: "" });
    })
  );
});
