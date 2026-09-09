import { lintCommand } from "@beep/repo-cli";
import { collectTsconfigOverlayViolations } from "@beep/repo-cli/commands/Lint/TsconfigOverlay";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });

const testLayer = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive, TestConsole.layer).pipe(
  Layer.provideMerge(NodeServices.layer)
);

const CLEAN_OVERLAY = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "rootDir": "../../.."
  }
}
`;

// JSONC on purpose: comments and a trailing comma must parse, and the widening
// keys must be reported at both scopes.
const WIDENING_OVERLAY = `{
  // editor metadata is tolerated, the rest is not
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [],
  "files": ["src/index.ts"],
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "types": ["node", "bun"],
    "strict": false,
  },
}
`;

const writeOverlay = Effect.fn(function* (relativeDirectory: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(process.cwd(), relativeDirectory);
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* fs.writeFileString(path.join(directory, "tsconfig.check.json"), content);
});

describe("tsconfig-overlay lint command", { concurrent: false }, () => {
  it(
    "passes when every overlay stays inside the allowlist",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeOverlay("packages/drivers/example", CLEAN_OVERLAY);
            yield* writeOverlay("apps/example", CLEAN_OVERLAY);
            // Build output and fixtures are never overlays to judge.
            yield* writeOverlay("packages/drivers/example/node_modules/dep", WIDENING_OVERLAY);
            yield* writeOverlay("packages/drivers/example/test/fixtures/mock", WIDENING_OVERLAY);

            yield* runLintCommand(["tsconfig-overlay"]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[tsconfig-overlay] ok: 2 overlay(s), 0 violation(s)"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "fails and names every key an overlay sets outside the allowlist",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeOverlay("packages/drivers/example", CLEAN_OVERLAY);
            yield* writeOverlay("packages/drivers/widened", WIDENING_OVERLAY);

            const exit = yield* Effect.exit(runLintCommand(["tsconfig-overlay"]));

            expectReportedExit(exit);
            const errorText = A.join(A.filter(yield* TestConsole.errorLines, P.isString), "\n");
            expect(errorText).toContain(
              "[tsconfig-overlay] violation: 3 key(s) across 1 overlay(s) fall outside the allowlist"
            );
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json files");
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json compilerOptions.strict");
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json compilerOptions.types");
            expect(errorText).not.toContain("tsconfig.check.json $schema");
            expect(errorText).toContain("move anything else into the package's tsconfig.json");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "reports violations sorted by file, scope, and key",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const path = yield* Path.Path;
            yield* writeOverlay("packages/drivers/zeta", WIDENING_OVERLAY);
            yield* writeOverlay("apps/alpha", WIDENING_OVERLAY);

            const violations = yield* collectTsconfigOverlayViolations(path.resolve(process.cwd()));

            expect(A.map(violations, (violation) => [violation.file, violation.scope, violation.key] as const)).toEqual(
              [
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "strict"],
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "types"],
                ["apps/alpha/tsconfig.check.json", "document", "files"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "strict"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "types"],
                ["packages/drivers/zeta/tsconfig.check.json", "document", "files"],
              ]
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "fails loudly when an overlay is not a JSONC object",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeOverlay("packages/drivers/broken", "[\n");

            const exit = yield* Effect.exit(runLintCommand(["tsconfig-overlay"]));

            expect(exit._tag).toBe("Failure");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );
});
