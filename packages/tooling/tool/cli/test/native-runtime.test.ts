import { LawScanProject, NoNativeRuntimeRulesOptions, runNoNativeRuntimeRules } from "@beep/repo-cli/test/Laws";
import { makeSchemaFirstProject } from "@beep/repo-cli/test/Lint";
import { A, Str } from "@beep/utils";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
import { Project } from "ts-morph";
import {
  NodeTestLayer,
  withTempWorkingDirectory,
  writeDefaultTsconfig,
  writeProjectFile,
} from "./support/CommandTest.ts";
import type { NoNativeRuntimeRulesSummary } from "@beep/repo-cli/test/Laws";

const expectStrictNativeError = (
  summary: NoNativeRuntimeRulesSummary,
  affectedFiles: ReadonlyArray<string>,
  messageIds?: ReadonlyArray<string>
) => {
  expect(summary.warningCount).toBe(0);
  expect(summary.errorCount).toBe(1);
  expect(summary.strictFailure).toBe(true);
  expect(summary.affectedFiles).toEqual(affectedFiles);
  if (messageIds !== undefined) {
    expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.messageId)).toEqual(messageIds);
  }
  expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.severity)).toEqual(["error"]);
};

it.layer(NodeTestLayer, { timeout: "30 seconds" })("native runtime laws", (it) => {
  it.effect(
    "scans source files without reading inaccessible excluded docs directories",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* writeProjectFile(
            "tsconfig.base.json",
            '{ "compilerOptions": { "strict": true, "paths": { "@demo/*": ["./packages/demo/*"] } } }'
          );
          yield* writeProjectFile("tsconfig.json", '{ "extends": "./tsconfig.base.json", "include": ["**/*.ts"] }');
          yield* writeProjectFile("packages/demo/index.ts", "export const value = new Date();\n");
          yield* writeProjectFile("packages/demo/docs/examples/example.ts", "export const value = new Date();\n");
          yield* Effect.acquireRelease(fs.chmod("packages/demo/docs/examples", 0o000), () =>
            fs.chmod("packages/demo/docs/examples", 0o755).pipe(Effect.orDie)
          );

          const project = yield* makeSchemaFirstProject();
          expect(project.getCompilerOptions().strict).toBe(true);
          expect(project.getCompilerOptions().paths).toEqual({ "@demo/*": ["./packages/demo/*"] });
          expect(
            A.map(project.getSourceFiles(), (source) => path.relative(process.cwd(), source.getFilePath()))
          ).toEqual(["packages/demo/index.ts"]);

          const summary = yield* runNoNativeRuntimeRules(NoNativeRuntimeRulesOptions.make({ strictCheck: true }));
          expect(summary.scannedFiles).toBe(1);
          expect(summary.warningCount).toBe(1);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/demo/index.ts"]);
        })
      );
    })
  );

  it.effect(
    "exempts ecosystem members in full and explicit include scans",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          const source = "export const value = new Date();\n";
          yield* writeProjectFile("packages/ecosystem/member/src/index.ts", source);
          yield* writeProjectFile("packages/demo/src/index.ts", source);

          const fullSummary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({ strictCheck: true, excludePaths: [] })
          );
          expect(fullSummary.affectedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(fullSummary.strictFailure).toBe(true);

          const explicitSummary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
              includePaths: ["packages/ecosystem/member/src/index.ts"],
            })
          );
          expect(explicitSummary.scannedFiles).toBe(0);
          expect(explicitSummary.strictFailure).toBe(false);
        })
      );
    })
  );

  it.effect(
    "fails strict check for non-hotspot warnings",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile("packages/demo/src/index.ts", "export const value = new Date();\n");

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(1);
          expect(summary.warningCount).toBe(1);
          expect(summary.errorCount).toBe(0);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["packages/demo/src/index.ts"]);
          expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.severity)).toEqual(["warn"]);
        })
      );
    })
  );

  it.effect(
    "allows platform availability typeof guards",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            'export const canUseWindow = () => typeof window === "undefined" ? false : window.innerWidth > 0;\n'
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.scannedFiles).toBe(1);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.warningCount).toBe(0);
          expect(summary.errorCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(summary.affectedFiles).toEqual([]);
        })
      );
    })
  );

  it.effect(
    "fails strict check for hotspot-native runtime violations",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "packages/tooling/tool/cli/src/commands/Lint/index.ts",
            'export const fail = () => { throw new Error("boom"); };\n'
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expectStrictNativeError(summary, ["packages/tooling/tool/cli/src/commands/Lint/index.ts"]);
        })
      );
    })
  );

  it.effect(
    "formats every hotspot violation family",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "scratchpad/effect-ontology/Runtime/HotspotProbe.ts",
            A.join(
              [
                'import * as Fs from "node:fs";',
                "export const inspect = (value: unknown, values: Array<string>, text: string) => {",
                "  const keys = Object.keys({ value });",
                "  const cache = new Map<string, string>();",
                "  const proofs = new WeakMap<object, string>();",
                "  const now = new Date();",
                '  const error = new Error("boom");',
                "  const timestamp = Date.now();",
                "  const copied = Array.from(values);",
                '  const isText = typeof value === "string";',
                '  const request = fetch("https://example.com");',
                "  values.sort();",
                "  text.trim();",
                "  switch (isText) {",
                "    case true:",
                "      return { Fs, cache, copied, error, keys, now, proofs, request, timestamp };",
                "    default:",
                "      return undefined;",
                "  }",
                "};",
              ],
              "\n"
            )
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({ strictCheck: true, excludePaths: [] })
          );
          const messageIds = A.map(summary.diagnostics, (diagnostic) => diagnostic.messageId);

          expect(summary.warningCount).toBe(0);
          expect(summary.strictFailure).toBe(true);
          expect(summary.affectedFiles).toEqual(["scratchpad/effect-ontology/Runtime/HotspotProbe.ts"]);
          expect(messageIds).toEqual(
            expect.arrayContaining([
              "arrayStatic",
              "dateStatic",
              "mapSetCtor",
              "nativeError",
              "nativeFetch",
              "nativeSort",
              "nativeSwitch",
              "newDate",
              "nodeRuntimeImport",
              "objectMethod",
              "stringMethod",
              "typeofRuntime",
              "weakCollectionCtor",
            ])
          );
          expect(A.every(summary.diagnostics, (diagnostic) => diagnostic.message.length > 0)).toBe(true);
        })
      );
    })
  );

  it.effect(
    "reports weak collections under their own kind and keeps Map/Set under new-map-set",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/weak.ts",
            "export const proofs = new WeakMap<object, string>();\nexport const issued = new WeakSet<object>();\n"
          );
          yield* writeProjectFile(
            "packages/demo/src/strong.ts",
            "export const index = new Map<string, string>();\nexport const seen = new Set<string>();\n"
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({ strictCheck: true, excludePaths: [] })
          );
          const byFile = (file: string) =>
            A.filter(summary.diagnostics, (diagnostic) => diagnostic.file === `packages/demo/src/${file}`);

          expect(A.map(byFile("weak.ts"), (diagnostic) => diagnostic.messageId)).toEqual([
            "weakCollectionCtor",
            "weakCollectionCtor",
          ]);
          expect(A.every(byFile("weak.ts"), ({ message }) => pipe(message, Str.includes("identity/GC reason")))).toBe(
            true
          );
          expect(A.some(byFile("weak.ts"), ({ message }) => pipe(message, Str.includes("HashMap")))).toBe(false);
          expect(A.map(byFile("strong.ts"), (diagnostic) => diagnostic.messageId)).toEqual([
            "mapSetCtor",
            "mapSetCtor",
          ]);
        })
      );
    })
  );

  it.effect(
    "treats effect-ontology native Error construction as a strict violation",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts",
            'import * as Effect from "effect/Effect";\nexport const fail = Effect.die(new Error("boom"));\n'
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expectStrictNativeError(summary, ["scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts"]);
        })
      );
    })
  );

  it.effect(
    "fails strict check for switch statements outside hotspot files",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "export const label = (status: 'ready' | 'blocked') => {",
                "  switch (status) {",
                "    case 'ready':",
                "      return 'Ready';",
                "    case 'blocked':",
                "      return 'Blocked';",
                "  }",
                "};",
              ],
              "\n"
            )
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expectStrictNativeError(summary, ["packages/demo/src/index.ts"], ["nativeSwitch"]);
        })
      );
    })
  );

  it.effect(
    "suppresses allowlisted map-set constructors by snapshot path and kind",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            "packages/foundation/capability/chalk/src/internal/ChalkRuntime.ts",
            "export const cache = new WeakMap<object, string>();\n"
          );

          const summary = yield* runNoNativeRuntimeRules(
            NoNativeRuntimeRulesOptions.make({
              strictCheck: true,
              excludePaths: [],
            })
          );

          expect(summary.warningCount).toBe(0);
          expect(summary.errorCount).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(summary.touchedFiles).toBe(0);
          expect(summary.affectedFiles).toEqual([]);
        })
      );
    })
  );
  it.effect(
    "distinguishes computed native calls and runtime typeof checks from availability guards",
    Effect.fnUntraced(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      project.createSourceFile(
        "/repo/packages/demo/src/computed.ts",
        A.join(
          [
            'export const keys = Object["keys"]({ ok: true });',
            "export const values = Object.values({ ok: true });",
            "export const nested = globalThis.Object.keys({ ok: true });",
            "export const dynamic = Object[method]({ ok: true });",
            "export const called = helper();",
            'export const runtime = "string" === typeof value;',
            'export const member = typeof value.member === "number";',
            'export const unknownType = typeof value === "unknown";',
            "export const nonliteral = typeof value === expected;",
            'export const available = "undefined" !== typeof window;',
          ],
          "\n"
        )
      );
      project.createSourceFile("/repo/packages/demo/src/clean.ts", "export const value = 1;");
      project.createSourceFile("/repo/packages/demo/test/excluded.ts", "export const ignored = new Set();");
      const summary = yield* runNoNativeRuntimeRules(NoNativeRuntimeRulesOptions.make({ strictCheck: true })).pipe(
        Effect.provideService(LawScanProject, { project, repoRoot: "/repo" })
      );
      expect(summary.scannedFiles).toBe(2);
      expect(summary.affectedFiles).toEqual(["packages/demo/src/computed.ts"]);
      expect(A.map(summary.diagnostics, (diagnostic) => diagnostic.messageId)).toEqual([
        "objectMethod",
        "objectMethod",
        "typeofRuntime",
        "typeofRuntime",
      ]);
      expect(summary.strictFailure).toBe(true);
    })
  );
});
