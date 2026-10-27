import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  ALLOWLIST_PATH,
  AllowlistCheckOptions,
  AllowlistCheckSummary,
  formatRedactedSchemaDiagnostics,
  formatSchemaDiagnostics,
  reportAllowlistCheckSummary,
  runAllowlistCheck,
} from "@beep/repo-cli/test/Laws";
import { buildAllowlistSnapshotModuleFromJsoncText } from "@beep/repo-configs/internal/laws/EffectLawsAllowlistSnapshotCodegen";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type * as Scope from "effect/Scope";

const decodeUnknownStructInlineSchemaResult = S.decodeUnknownResult(
  S.Struct({
    token: S.tag("expected-token"),
  })
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

const ALLOWLIST_SNAPSHOT_PATH =
  "packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts";

const renderSingleEntryAllowlist = (kind: string): string =>
  A.join(
    [
      "{",
      '  "$schema": "./effect-laws.allowlist.schema.json",',
      '  "version": 1,',
      '  "entries": [',
      "    {",
      '      "rule": "beep-laws/no-native-runtime",',
      '      "file": "packages/demo/src/index.ts",',
      `      "kind": "${kind}",`,
      '      "reason": "test",',
      '      "owner": "@beep/test",',
      '      "issue": "TEST-ALLOWLIST"',
      "    }",
      "  ]",
      "}",
    ],
    "\n"
  );

const makeRepoWithEntry = Effect.fn("AllowlistCheckTest.makeRepoWithEntry")(function* (
  sourceText: string,
  kind: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const tmpDir = yield* fs.makeTempDirectoryScoped().pipe(Effect.orDie);
  yield* writeRepoFile(tmpDir, "bun.lock", "");
  yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", sourceText);
  yield* writeRepoFile(tmpDir, ALLOWLIST_PATH, renderSingleEntryAllowlist(kind));
  return tmpDir;
});

const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

it.layer(PlatformLayer, { timeout: "5 seconds" })("allowlist-check", (it) => {
  it("formats schema diagnostics with path labels and optional redaction", () => {
    const result = decodeUnknownStructInlineSchemaResult({ token: "sk-test-secret" });

    result.pipe(Result.isFailure, assertTrue);

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

  it.effect("passes when all referenced files exist", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
      yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const value = Object.keys({ ok: true });\n");
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
    }).pipe(Effect.orDie)
  );

  it.effect("fails when an allowlist entry points at a missing file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
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
    }).pipe(Effect.orDie)
  );

  it.effect("fails when allowlist entries repeat the same rule, file, and kind", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
      yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const value = Object.keys({ ok: true });\n");
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
    }).pipe(Effect.orDie)
  );

  it.effect("fails when an allowlist entry uses an unsupported rule id", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
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
    }).pipe(Effect.orDie)
  );

  it.effect("fails when a native-runtime allowlist entry uses an unsupported kind", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
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
    }).pipe(Effect.orDie)
  );

  it.effect("resolves allowlist paths from the repository root when started in a subdirectory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");
      const path = yield* Path.Path;
      const workingDir = path.join(tmpDir, "packages/demo");

      yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const value = Object.keys({ ok: true });\n");
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
    }).pipe(Effect.orDie)
  );

  it.effect("reports allowlist entries that no longer match a current violation", () =>
    Effect.gen(function* () {
      const tmpDir = yield* makeRepoWithEntry("export const value = 1;\n", "object-method");

      const summary = yield* runAllowlistCheck(AllowlistCheckOptions.make({ cwd: tmpDir }));

      expect(summary.ok).toBe(false);
      expect(summary.diagnostics).toEqual([
        "entries.0: No current violation matches allowlist key beep-laws/no-native-runtime::packages/demo/src/index.ts::object-method",
      ]);
    }).pipe(Effect.orDie)
  );

  it.effect("matches native-error entries for globalThis constructor access", () =>
    Effect.gen(function* () {
      const tmpDir = yield* makeRepoWithEntry(
        'export const created = new globalThis.Error("a");\nexport const called = globalThis["TypeError"]("b");\n',
        "native-error"
      );

      const summary = yield* runAllowlistCheck(AllowlistCheckOptions.make({ cwd: tmpDir }));

      expect(summary.ok).toBe(true);
      expect(summary.diagnostics).toEqual([]);
    }).pipe(Effect.orDie)
  );

  it.effect("reports a missing allowlist file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* writeRepoFile(tmpDir, "bun.lock", "");

      const summary = yield* runAllowlistCheck(AllowlistCheckOptions.make({ cwd: tmpDir }));

      expect(summary.ok).toBe(false);
      expect(summary.diagnostics).toEqual([`missing file: ${ALLOWLIST_PATH}`]);
    }).pipe(Effect.orDie)
  );

  it.effect("reports JSONC parse errors with their offsets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      yield* writeRepoFile(tmpDir, "bun.lock", "");
      yield* writeRepoFile(tmpDir, ALLOWLIST_PATH, '{ "version": 1, "entries": [');

      const summary = yield* runAllowlistCheck(AllowlistCheckOptions.make({ cwd: tmpDir }));

      expect(summary.ok).toBe(false);
      expect(summary.diagnostics[0]).toMatch(/^parse error at offset \d+$/);
    }).pipe(Effect.orDie)
  );

  it.effect("checks the generated allowlist snapshot when its directory exists", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* makeRepoWithEntry("export const value = Object.keys({ ok: true });\n", "object-method");
      const options = AllowlistCheckOptions.make({ cwd: tmpDir });
      yield* fs.makeDirectory(path.dirname(path.join(tmpDir, ALLOWLIST_SNAPSHOT_PATH)), { recursive: true });

      const missing = yield* runAllowlistCheck(options);
      expect(missing.ok).toBe(false);
      expect(missing.diagnostics).toEqual([`${ALLOWLIST_SNAPSHOT_PATH}: Generated allowlist snapshot is missing.`]);

      yield* writeRepoFile(tmpDir, ALLOWLIST_SNAPSHOT_PATH, "export const ALLOWLIST_SNAPSHOT = {} as const;\n");
      const stale = yield* runAllowlistCheck(options);
      expect(stale.ok).toBe(false);
      expect(stale.diagnostics).toEqual([
        `${ALLOWLIST_SNAPSHOT_PATH}: Generated allowlist snapshot is stale; run package codegen.`,
      ]);

      const expectedSnapshot = yield* buildAllowlistSnapshotModuleFromJsoncText(
        renderSingleEntryAllowlist("object-method")
      );
      yield* writeRepoFile(tmpDir, ALLOWLIST_SNAPSHOT_PATH, expectedSnapshot);
      const synced = yield* runAllowlistCheck(options);
      expect(synced.ok).toBe(true);
      expect(synced.diagnostics).toEqual([]);
    }).pipe(Effect.orDie)
  );

  it.effect("reports an OK summary on the log channel and failures on the error channel", () =>
    Effect.gen(function* () {
      yield* reportAllowlistCheckSummary(AllowlistCheckSummary.make({ ok: true }));
      yield* reportAllowlistCheckSummary(
        AllowlistCheckSummary.make({ ok: false, diagnostics: ["entries.0: first", "entries.1: second"] })
      );

      expect(yield* TestConsole.logLines).toEqual(["[laws-allowlist] OK"]);
      expect(yield* TestConsole.errorLines).toEqual([
        "[laws-allowlist] found 2 issue(s):",
        "- entries.0: first",
        "- entries.1: second",
      ]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
  it.effect("rejects empty entry metadata before checking referenced files", () =>
    Effect.gen(function* () {
      const tmpDir = yield* makeRepoWithEntry("export const value = 1;", "object-method");
      yield* writeRepoFile(
        tmpDir,
        ALLOWLIST_PATH,
        Str.replace('"reason": "test"', '"reason": ""')(renderSingleEntryAllowlist("object-method"))
      );
      const summary = yield* runAllowlistCheck(AllowlistCheckOptions.make({ cwd: tmpDir }));
      expect(summary.ok).toBe(false);
      expect(summary.diagnostics).toEqual([expect.stringContaining("entries.0.reason")]);
      expect(summary.diagnostics[0]).toContain("Expected non-empty string.");
    })
  );
});
