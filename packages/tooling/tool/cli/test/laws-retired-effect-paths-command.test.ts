import { lawsCommand } from "@beep/repo-cli/commands/Laws";
import { RetiredEffectPathsOptions, runRetiredEffectPaths } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

it.layer(PlatformLayer, { timeout: "120 seconds" })((it) => {
  describe("retired-effect-paths command", { concurrent: false }, () => {
    it.effect(
      "reports, checks and emits JSON for the repository tree",
      Effect.fnUntraced(function* () {
        for (const args of [
          ["retired-effect-paths"],
          ["retired-effect-paths", "--check"],
          ["retired-effect-paths", "--json"],
        ]) {
          const exit = yield* runInProcess(args).pipe(withEmptyConfig, Effect.exit);
          assertTrue(Exit.isSuccess(exit), failureText(exit));
        }
      }),
      120_000
    );

    it.effect(
      "fails with the law's execution error when the directory is not a git checkout",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "retired-effect-paths-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");

        const exit = yield* runRetiredEffectPaths(
          RetiredEffectPathsOptions.make({ cwd: root, strictCheck: true })
        ).pipe(Effect.exit);

        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain("RetiredEffectPathsExecutionError");
      })
    );
  });
});
