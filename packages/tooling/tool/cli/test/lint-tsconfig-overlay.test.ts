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

// A reference-free package: its tsconfig.json has no references, so the
// overlay's `[]` is exact.
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
    "rootDir": "../../.."
  }
}
`;

const CANONICAL_WITH_REFERENCE = `{
  "extends": "../../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "references": [{ "path": "../dep/tsconfig.json" }]
}
`;

// The post-switch shape: the overlay repeats the canonical reference verbatim.
const MIRRORED_OVERLAY = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [
    {
      "path": "../dep/tsconfig.json"
    }
  ],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "rootDir": "../../.."
  }
}
`;

// An overlay that never carried the key at all reads as no references.
const KEYLESS_OVERLAY = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true
  }
}
`;

// JSONC on purpose: comments and a trailing comma must parse, and the widening
// keys must be reported at both scopes. `module` / `moduleResolution` left the
// allowlist with the reference-keeping switch (quality-lane audit D3).
const WIDENING_OVERLAY = `{
  // editor metadata is tolerated, the rest is not
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [],
  "files": ["src/index.ts"],
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node", "bun"],
    "strict": false,
  },
}
`;

const writePackageFile = Effect.fn(function* (relativeDirectory: string, fileName: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(process.cwd(), relativeDirectory);
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* fs.writeFileString(path.join(directory, fileName), content);
});

const writeOverlay = (relativeDirectory: string, content: string) =>
  writePackageFile(relativeDirectory, "tsconfig.check.json", content);
const writeCanonical = (relativeDirectory: string, content: string) =>
  writePackageFile(relativeDirectory, "tsconfig.json", content);

describe("tsconfig-overlay lint command", { concurrent: false }, () => {
  it(
    "passes when every overlay stays inside the allowlist and mirrors its tsconfig.json references",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeCanonical("packages/drivers/example", CANONICAL_WITH_REFERENCE);
            yield* writeOverlay("packages/drivers/example", MIRRORED_OVERLAY);
            // No tsconfig.json beside it: a reference-free overlay is exact.
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
            expect(errorText).toContain("[tsconfig-overlay] violation: 5 finding(s) across 1 overlay(s)");
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json files");
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json compilerOptions.module");
            expect(errorText).toContain(
              "  - packages/drivers/widened/tsconfig.check.json compilerOptions.moduleResolution"
            );
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json compilerOptions.strict");
            expect(errorText).toContain("  - packages/drivers/widened/tsconfig.check.json compilerOptions.types");
            expect(errorText).not.toContain("tsconfig.check.json $schema");
            expect(errorText).toContain("move anything else into the package's tsconfig.json");
            expect(errorText).not.toContain("bun run beep tsconfig-sync --write");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "fails when an overlay's references drift from its tsconfig.json",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            // The pre-switch shape: canonical references, overlay `[]`.
            yield* writeCanonical("packages/drivers/lagging", CANONICAL_WITH_REFERENCE);
            yield* writeOverlay("packages/drivers/lagging", CLEAN_OVERLAY);
            // No `references` key at all reads as an empty list.
            yield* writeCanonical("packages/drivers/keyless", CANONICAL_WITH_REFERENCE);
            yield* writeOverlay("packages/drivers/keyless", KEYLESS_OVERLAY);
            // An extra reference the canonical file never declared.
            yield* writeOverlay("packages/drivers/extra", MIRRORED_OVERLAY);

            const exit = yield* Effect.exit(runLintCommand(["tsconfig-overlay"]));

            expectReportedExit(exit);
            const errorText = A.join(A.filter(yield* TestConsole.errorLines, P.isString), "\n");
            expect(errorText).toContain("[tsconfig-overlay] violation: 3 finding(s) across 3 overlay(s)");
            expect(errorText).toContain(
              "  - packages/drivers/lagging/tsconfig.check.json references: expected the 1 reference(s) of tsconfig.json, found 0 (missing 1, extra 0)"
            );
            expect(errorText).toContain(
              "  - packages/drivers/keyless/tsconfig.check.json references: expected the 1 reference(s) of tsconfig.json, found 0 (missing 1, extra 0)"
            );
            expect(errorText).toContain(
              "  - packages/drivers/extra/tsconfig.check.json references: expected the 0 reference(s) of tsconfig.json, found 1 (missing 0, extra 1)"
            );
            expect(errorText).toContain("regenerate with: bun run beep tsconfig-sync --write");
            expect(errorText).not.toContain("move anything else into the package's tsconfig.json");
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
            yield* writeCanonical("packages/drivers/zeta", CANONICAL_WITH_REFERENCE);
            yield* writeOverlay("packages/drivers/zeta", WIDENING_OVERLAY);
            yield* writeOverlay("apps/alpha", WIDENING_OVERLAY);

            const violations = yield* collectTsconfigOverlayViolations(path.resolve(process.cwd()));

            expect(A.map(violations, (violation) => [violation.file, violation.scope, violation.key] as const)).toEqual(
              [
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "module"],
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "moduleResolution"],
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "strict"],
                ["apps/alpha/tsconfig.check.json", "compilerOptions", "types"],
                ["apps/alpha/tsconfig.check.json", "document", "files"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "module"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "moduleResolution"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "strict"],
                ["packages/drivers/zeta/tsconfig.check.json", "compilerOptions", "types"],
                ["packages/drivers/zeta/tsconfig.check.json", "document", "files"],
                ["packages/drivers/zeta/tsconfig.check.json", "references", "references"],
              ]
            );
            const drift = A.findFirst(violations, (violation) => violation.scope === "references");
            expect(drift._tag === "Some" ? drift.value.detail : undefined).toBe(
              "expected the 1 reference(s) of tsconfig.json, found 0 (missing 1, extra 0)"
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "mirrors tsconfig.build.json when it owns the package's references",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const path = yield* Path.Path;
            // tsconfig-sync writes references into tsconfig.build.json when a
            // package has one, so the overlay must repeat that file, not
            // tsconfig.json.
            yield* writeCanonical("packages/drivers/owner", CANONICAL_WITH_REFERENCE);
            yield* writePackageFile(
              "packages/drivers/owner",
              "tsconfig.build.json",
              `{
  "extends": "./tsconfig.json",
  "references": [{ "path": "../dep/tsconfig.json" }, { "path": "../other/tsconfig.json" }]
}
`
            );
            yield* writeOverlay("packages/drivers/owner", MIRRORED_OVERLAY);

            const violations = yield* collectTsconfigOverlayViolations(path.resolve(process.cwd()));
            const drift = A.findFirst(violations, (violation) => violation.scope === "references");

            expect(A.length(violations)).toBe(1);
            expect(drift._tag === "Some" ? drift.value.detail : undefined).toBe(
              "expected the 2 reference(s) of tsconfig.build.json, found 1 (missing 1, extra 0)"
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
