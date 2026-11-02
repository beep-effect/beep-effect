import { lawsCommand, RetiredIriAuthoritiesOptions, runRetiredIriAuthorities } from "@beep/repo-cli/commands/Laws";
import { RetiredEffectPathsOptions, runRetiredEffectPaths } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
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

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

// Assembled from labels so this file never spells a retired host or the public origin.
const RETIRED_IRI = `https://${A.join(["beep", "dev"], ".")}/epistemic/Claim`;
const ORIGIN = `https://${A.join(["beep-effect", "com"], ".")}`;

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  return yield* handle.exitCode;
});

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

  describe("retired-iri-authorities command", { concurrent: false }, () => {
    it.effect(
      "reports, checks and emits JSON for the repository tree",
      Effect.fnUntraced(function* () {
        for (const args of [
          ["retired-iri-authorities"],
          ["retired-iri-authorities", "--check"],
          ["retired-iri-authorities", "--json"],
        ]) {
          const exit = yield* runInProcess(args).pipe(withEmptyConfig, Effect.exit);
          assertTrue(Exit.isSuccess(exit), failureText(exit));
        }
      }),
      120_000
    );

    it.effect(
      "turns strict on a seeded tracked violation and never sees untracked or exempt files",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "retired-iri-authorities-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");
        expect(yield* git(root, ["init", "--quiet"])).toBe(0);
        const files = {
          "docs/seed.md": `see ${RETIRED_IRI}\n`,
          "packages/x/src/a.ts": `export const docs = "${ORIGIN}/docs";\n`,
          "packages/x/test/a.test.ts": `export const docs = "${ORIGIN}/docs";\n`,
          "goals/x/history/brief.md": `see ${RETIRED_IRI}\n`,
          "docs/untracked.md": `see ${RETIRED_IRI}\n`,
          "docs/deleted.md": `see ${RETIRED_IRI}\n`,
        };
        for (const [file, content] of R.toEntries(files)) {
          yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
          yield* fs.writeFileString(path.join(root, file), content);
        }
        expect(
          yield* git(root, [
            "add",
            "--",
            "docs/seed.md",
            "packages/x/src/a.ts",
            "packages/x/test/a.test.ts",
            "goals/x/history/brief.md",
            "docs/deleted.md",
          ])
        ).toBe(0);
        // A tracked file deleted from the working tree is skipped, not an error.
        yield* fs.remove(path.join(root, "docs/deleted.md"));

        const strict = yield* runRetiredIriAuthorities(
          RetiredIriAuthoritiesOptions.make({ cwd: root, strictCheck: true })
        );
        expect(strict.strictFailure).toBe(true);
        expect(strict.exemptFiles).toBe(1);
        expect(A.map(strict.findings, (finding) => [finding.file, finding.rule])).toEqual([
          ["docs/seed.md", "retired-authority"],
          ["packages/x/src/a.ts", "public-origin-literal"],
        ]);

        const report = yield* runRetiredIriAuthorities(RetiredIriAuthoritiesOptions.make({ cwd: root }));
        expect([report.strictFailure, report.findings.length]).toEqual([false, 2]);
      })
    );

    it.effect(
      "fails with the law's execution error when the directory is not a git checkout",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "retired-iri-authorities-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");

        const exit = yield* runRetiredIriAuthorities(
          RetiredIriAuthoritiesOptions.make({ cwd: root, strictCheck: true })
        ).pipe(Effect.exit);

        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain("RetiredIriAuthoritiesExecutionError");
      })
    );
  });
});
