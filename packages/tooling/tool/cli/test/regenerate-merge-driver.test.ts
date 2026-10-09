import { fileURLToPath } from "node:url";
import { installRegenerateMergeDriver } from "@beep/repo-cli/commands/Worktree";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const sourceRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const driverPath = `${sourceRoot}scripts/regenerate-merge-driver.sh`;
const provideNodeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  NodeServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
    Effect.scoped
  );

describe("regenerate merge driver", () => {
  it("leaves allowlisted projections conflicted until the merged tree is available", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory({ prefix: "beep-regenerate-driver-" });
      const git = (args: ReadonlyArray<string>) =>
        Bun.spawnSync({ cmd: ["git", ...args], cwd: root, stderr: "pipe", stdout: "pipe" });
      expect(git(["init"]).exitCode).toBe(0);
      const ancestor = path.join(root, "ancestor");
      const current = path.join(root, "current");
      const other = path.join(root, "other");
      yield* fs.writeFileString(ancestor, "ancestor\n");
      yield* fs.writeFileString(current, "current\n");
      yield* fs.writeFileString(other, "other\n");
      const generated = Bun.spawnSync({
        cmd: [driverPath, ancestor, current, other, "tsconfig.json"],
        cwd: root,
        stderr: "pipe",
        stdout: "pipe",
      });
      expect(generated.exitCode).not.toBe(0);
      expect(generated.stderr.toString()).toContain("left tsconfig.json conflicted");
      expect(yield* fs.readFileString(current)).toBe("current\n");
      const refused = Bun.spawnSync({
        cmd: [driverPath, ancestor, current, other, "bun.lock"],
        cwd: root,
        stderr: "pipe",
        stdout: "pipe",
      });
      expect(refused.exitCode).not.toBe(0);
      expect(refused.stderr.toString()).toContain("refused non-projection path: bun.lock");
      yield* fs.makeDirectory(path.join(root, "scripts"));
      yield* fs.copyFile(driverPath, path.join(root, "scripts", "regenerate-merge-driver.sh"));
      yield* installRegenerateMergeDriver(root);
      yield* installRegenerateMergeDriver(root);
      const configured = git(["config", "--local", "--get", "merge.regenerate.driver"]);
      expect(configured.exitCode).toBe(0);
      expect(configured.stdout.toString()).toContain("scripts/regenerate-merge-driver.sh");
      yield* fs.remove(root, { recursive: true });
    }).pipe(provideNodeServices, Effect.runPromise));
});
