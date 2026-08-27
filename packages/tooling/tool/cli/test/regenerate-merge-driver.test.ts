import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const driverPath = `${sourceRoot}scripts/regenerate-merge-driver.sh`;
const setupPath = `${sourceRoot}scripts/setup-regenerate-merge-driver.sh`;
const provideNodeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

describe("regenerate merge driver", () => {
  it("regenerates only allowlisted projections and bootstrap installs the fail-loud driver", () =>
    Effect.runPromise(
      provideNodeServices(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-regenerate-driver-" });
          const bin = path.join(root, "bin");
          yield* fs.makeDirectory(bin);
          yield* fs.writeFileString(
            path.join(bin, "bun"),
            '#!/usr/bin/env bash\nif [[ "$*" == *"config-sync"* ]]; then printf "generated\\n" >tsconfig.json; fi\n'
          );
          yield* fs.chmod(path.join(bin, "bun"), 0o755);
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
            env: { ...Bun.env, PATH: `${bin}:${Bun.env.PATH ?? ""}` },
            stderr: "pipe",
            stdout: "pipe",
          });
          expect(generated.exitCode, generated.stderr.toString()).toBe(0);
          expect(yield* fs.readFileString(current)).toBe("generated\n");

          const refused = Bun.spawnSync({
            cmd: [driverPath, ancestor, current, other, "bun.lock"],
            cwd: root,
            stderr: "pipe",
            stdout: "pipe",
          });
          expect(refused.exitCode).not.toBe(0);
          expect(refused.stderr.toString()).toContain("refused non-projection path: bun.lock");

          const installed = Bun.spawnSync({
            cmd: [setupPath, root],
            cwd: root,
            stderr: "pipe",
            stdout: "pipe",
          });
          expect(installed.exitCode, installed.stderr.toString()).toBe(0);
          const configured = git(["config", "--local", "--get", "merge.regenerate.driver"]);
          expect(configured.exitCode).toBe(0);
          expect(configured.stdout.toString()).toContain("scripts/regenerate-merge-driver.sh");
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));
});
