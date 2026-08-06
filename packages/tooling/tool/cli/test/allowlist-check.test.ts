import {
  ALLOWLIST_PATH,
  AllowlistCheckOptions,
  formatRedactedSchemaDiagnostics,
  formatSchemaDiagnostics,
  runAllowlistCheck,
} from "@beep/repo-cli/test/Laws";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer);

const withTempRepo = <A, E>(use: (tmpDir: string) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");

      return { fs, tmpDir } as const;
    }),
    ({ tmpDir }) => use(tmpDir),
    ({ fs, tmpDir }) => fs.remove(tmpDir, { recursive: true })
  );

const writeRepoFile = Effect.fn("AllowlistCheckTest.writeRepoFile")(function* (
  repoRoot: string,
  relativePath: string,
  content: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(repoRoot, relativePath);
  const directoryPath = path.dirname(absolutePath);

  yield* fs.makeDirectory(directoryPath, { recursive: true }).pipe(Effect.orDie);
  yield* fs.writeFileString(absolutePath, content).pipe(Effect.orDie);
});

describe("allowlist-check", () => {
  it("formats schema diagnostics with path labels and optional redaction", () => {
    const result = S.decodeUnknownResult(
      S.Struct({
        token: S.Literal("expected-token"),
      })
    )({ token: "sk-test-secret" });

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result)) {
      const diagnostics = formatSchemaDiagnostics(result.failure);
      const redactedDiagnostics = formatRedactedSchemaDiagnostics(result.failure);

      // beta.103 built-in formatters no longer interpolate the rejected value, so
      // the unredacted form states the constraint rather than echoing the input.
      expect(diagnostics).toEqual([expect.stringContaining("token")]);
      expect(diagnostics[0]).toContain('Expected "expected-token"');
      expect(diagnostics[0]).not.toContain("sk-test-secret");

      // Redaction still replaces the message wholesale, which is what keeps
      // repo-authored messages — the ones that do interpolate values — safe.
      expect(redactedDiagnostics).toEqual([expect.stringContaining("token")]);
      expect(redactedDiagnostics[0]).toContain("Invalid data <redacted>");
      expect(redactedDiagnostics[0]).not.toContain("sk-test-secret");
    }
  });

  it("passes when all referenced files exist", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRepoFile(
            tmpDir,
            "packages/demo/src/index.ts",
            "export const value = Object.keys({ ok: true });\n"
          );
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "object-method",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: tmpDir,
            })
          );

          expect(summary.ok).toBe(true);
          expect(summary.diagnostics).toEqual([]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("fails when an allowlist entry points at a missing file", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/missing.ts",',
                '      "kind": "object-method",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: tmpDir,
            })
          );

          expect(summary.ok).toBe(false);
          expect(summary.diagnostics).toEqual([
            "entries.0.file: Referenced file does not exist: packages/demo/src/missing.ts",
          ]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("fails when allowlist entries repeat the same rule, file, and kind", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRepoFile(
            tmpDir,
            "packages/demo/src/index.ts",
            "export const value = Object.keys({ ok: true });\n"
          );
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "object-method",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    },",
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "object-method",',
                '      "reason": "test duplicate",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST-DUPLICATE"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: tmpDir,
            })
          );

          expect(summary.ok).toBe(false);
          expect(summary.diagnostics).toEqual([
            "entries.1: Duplicate allowlist key beep-laws/no-native-runtime::packages/demo/src/index.ts::object-method",
          ]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("fails when an allowlist entry uses an unsupported rule id", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/unknown-rule",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "object-method",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: tmpDir,
            })
          );

          expect(summary.ok).toBe(false);
          expect(summary.diagnostics).toEqual([expect.stringContaining("entries.0.rule")]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("fails when a native-runtime allowlist entry uses an unsupported kind", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "unknown-kind",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: tmpDir,
            })
          );

          expect(summary.ok).toBe(false);
          expect(summary.diagnostics).toEqual([expect.stringContaining("entries.0.kind")]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));

  it("resolves allowlist paths from the repository root when started in a subdirectory", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const workingDir = path.join(tmpDir, "packages/demo");

          yield* writeRepoFile(
            tmpDir,
            "packages/demo/src/index.ts",
            "export const value = Object.keys({ ok: true });\n"
          );
          yield* writeRepoFile(
            tmpDir,
            ALLOWLIST_PATH,
            A.join(
              [
                "{",
                '  "$schema": "./effect-laws.allowlist.schema.json",',
                '  "version": 1,',
                '  "entries": [',
                "    {",
                '      "rule": "beep-laws/no-native-runtime",',
                '      "file": "packages/demo/src/index.ts",',
                '      "kind": "object-method",',
                '      "reason": "test",',
                '      "owner": "@beep/test",',
                '      "issue": "TEST-ALLOWLIST"',
                "    }",
                "  ]",
                "}",
              ],
              "\n"
            )
          );

          const summary = yield* runAllowlistCheck(
            AllowlistCheckOptions.make({
              cwd: workingDir,
            })
          );

          expect(summary.ok).toBe(true);
          expect(summary.diagnostics).toEqual([]);
        })
      ).pipe(provideScopedLayer(testLayer), Effect.orDie)
    ));
});
