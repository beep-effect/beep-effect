import { EntityKitFreezeOptions, lawsCommand, runEntityKitFreeze } from "@beep/repo-cli/commands/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import { NodeTestLayer } from "./support/CommandTest.ts";

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeTestLayer));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const KIT_IMPORT = 'import { make } from "@beep/shared-domain/entity/EntityKit";\n';

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  return yield* handle.exitCode;
});

const rulesOf = (summary: { readonly findings: ReadonlyArray<{ readonly file: string; readonly rule: string }> }) =>
  A.map(summary.findings, (finding) => [finding.file, finding.rule]);

it.layer(PlatformLayer, { timeout: "120 seconds" })((it) => {
  describe("entity-kit-freeze command", { concurrent: false }, () => {
    it.effect(
      "reports, checks and emits JSON for the repository tree",
      Effect.fnUntraced(function* () {
        for (const args of [["entity-kit-freeze"], ["entity-kit-freeze", "--check"], ["entity-kit-freeze", "--json"]]) {
          const exit = yield* runInProcess(args).pipe(withEmptyConfig, Effect.exit);
          assertTrue(Exit.isSuccess(exit), failureText(exit));
        }
      }),
      120_000
    );

    it.effect(
      "seeds, enforces and prunes the baseline in a seeded checkout",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "entity-kit-freeze-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");
        const initExit = yield* git(root, ["init", "--quiet"]);
        expect(initExit).toBe(0);
        const files = {
          "packages/a/src/Old.ts": KIT_IMPORT,
          "packages/a/src/Barrel.ts": 'import { ProductEntity } from "@beep/shared-domain";\n',
          "packages/a/src/Clean.ts": 'import * as P from "@beep/shared-domain/entity/Principal";\n',
          "packages/shared/domain/src/entity/EntityKit.ts": KIT_IMPORT,
          "docs/notes.ts": KIT_IMPORT,
        };
        for (const [file, content] of R.toEntries(files)) {
          yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
          yield* fs.writeFileString(path.join(root, file), content);
        }
        const addExit = yield* git(root, ["add", "--", ...R.keys(files)]);
        expect(addExit).toBe(0);

        const unseeded = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, strictCheck: true }));
        expect(unseeded.strictFailure).toBe(true);
        expect(rulesOf(unseeded)).toEqual([
          ["packages/a/src/Barrel.ts", "new-importer"],
          ["packages/a/src/Old.ts", "new-importer"],
        ]);

        const seeded = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, write: true }));
        expect([seeded.baselineFiles, seeded.prunedFiles, seeded.strictFailure]).toEqual([2, 0, false]);
        const baseline = yield* fs.readFileString(path.join(root, "standards/entity-kit-freeze.baseline.jsonc"));
        expect(baseline).toContain('"rule": "beep-laws/entity-kit-freeze"');
        expect(baseline).toContain('"frozenSince": "2026-11-06"');

        const clean = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, strictCheck: true }));
        expect([clean.strictFailure, clean.findings.length, clean.importerFiles]).toEqual([false, 0, 2]);

        yield* fs.writeFileString(path.join(root, "packages/a/src/New.ts"), KIT_IMPORT);
        yield* fs.writeFileString(path.join(root, "packages/a/src/Old.ts"), "export const done = true;\n");
        const addNewExit = yield* git(root, ["add", "--", "packages/a/src/New.ts"]);
        expect(addNewExit).toBe(0);
        const drifted = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, strictCheck: true }));
        expect(drifted.strictFailure).toBe(true);
        expect(rulesOf(drifted)).toEqual([
          ["packages/a/src/New.ts", "new-importer"],
          ["packages/a/src/Old.ts", "stale-baseline"],
        ]);

        const pruned = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, write: true }));
        expect([pruned.baselineFiles, pruned.prunedFiles, pruned.strictFailure]).toEqual([1, 1, true]);
        expect(rulesOf(pruned)).toEqual([["packages/a/src/New.ts", "new-importer"]]);
      })
    );

    it.effect(
      "fails with the law's execution error when the directory is not a git checkout",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "entity-kit-freeze-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");

        const exit = yield* runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: root, strictCheck: true })).pipe(
          Effect.exit
        );

        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain("EntityKitFreezeExecutionError");
      })
    );
  });
});
