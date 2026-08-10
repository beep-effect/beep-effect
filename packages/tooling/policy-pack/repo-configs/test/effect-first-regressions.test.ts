import { fileURLToPath } from "node:url";
import { buildAllowlistSnapshotModuleFromJsoncText } from "@beep/repo-configs/internal/eslint/EffectLawsAllowlistSnapshotCodegen";
import { resolveImportSpecifierImportKind } from "@beep/repo-configs/internal/eslint/RuleAstSchemas";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import * as O from "effect/Option";

const docsEslintConfigPath = fileURLToPath(new URL("../src/eslint/DocsESLintConfig.ts", import.meta.url));
const requireCategoryTagRulePath = fileURLToPath(new URL("../src/eslint/RequireCategoryTagRule.ts", import.meta.url));

const retainedModulePaths = [docsEslintConfigPath, requireCategoryTagRulePath];

const allowlistRuntimePath = fileURLToPath(new URL("../src/eslint/EffectLawsAllowlist.ts", import.meta.url));
const snapshotCodegenPath = fileURLToPath(
  new URL("../src/internal/eslint/EffectLawsAllowlistSnapshotCodegen.ts", import.meta.url)
);
const allowlistSchemasPath = fileURLToPath(
  new URL("../src/internal/eslint/EffectLawsAllowlistSchemas.ts", import.meta.url)
);
const generatedSnapshotPath = fileURLToPath(
  new URL("../src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts", import.meta.url)
);
const allowlistJsoncPath = fileURLToPath(
  new URL("../../../../../standards/effect-laws.allowlist.jsonc", import.meta.url)
);

const readText = Effect.fn(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path);
});

layer(NodeServices.layer)("effect-first regressions", (it) => {
  describe("effect-first regressions", () => {
    it.effect(
      "disallows Match.value usage in retained docs and governance modules",
      Effect.fn(function* () {
        for (const filePath of retainedModulePaths) {
          const source = yield* readText(filePath);
          expect(Str.contains(source, "Match.value("), `${filePath} should not use Match.value`).toBe(false);
        }
      })
    );

    it.effect(
      "disallows try/catch blocks in retained docs and governance modules",
      Effect.fn(function* () {
        for (const filePath of [...retainedModulePaths, allowlistRuntimePath]) {
          const source = yield* readText(filePath);
          expect(source).not.toMatch(/\btry\s*\{|\bcatch\s*\(/);
        }
      })
    );

    it.effect(
      "keeps allowlist runtime free of Promise APIs",
      Effect.fn(function* () {
        const source = yield* readText(allowlistRuntimePath);
        expect(source).not.toMatch(/Promise<|Effect\.runPromise|\.then\(|\.catch\(|\basync\b|\bawait\b/);
      })
    );

    it.effect(
      "keeps docs linting on the dedicated docs config surface",
      Effect.fn(function* () {
        const docsConfigSource = yield* readText(docsEslintConfigPath);
        const requireCategorySource = yield* readText(requireCategoryTagRulePath);

        expect(Str.contains(docsConfigSource, "beep-laws")).toBe(false);
        expect(Str.contains(docsConfigSource, "eslint-plugin-tsdoc")).toBe(true);
        expect(Str.contains(requireCategorySource, "../internal/eslint/RuleAstSchemas.ts")).toBe(true);
        expect(Str.contains(requireCategorySource, "../internal/eslint/RuleHelpers.ts")).toBe(true);
        expect(Str.contains(requireCategorySource, "const firstSome =")).toBe(false);
      })
    );

    it.effect(
      "disallows direct JSON.stringify in internal eslint source",
      Effect.fn(function* () {
        for (const filePath of [snapshotCodegenPath, allowlistSchemasPath]) {
          const source = yield* readText(filePath);
          expect(Str.contains(source, "JSON.stringify(")).toBe(false);
        }
      })
    );

    it.effect(
      "keeps generated allowlist snapshot in sync with standards allowlist",
      Effect.fn(function* () {
        const allowlistJsonc = yield* readText(allowlistJsoncPath);
        const expectedGeneratedSnapshot = yield* buildAllowlistSnapshotModuleFromJsoncText(allowlistJsonc);
        const actualGeneratedSnapshot = yield* readText(generatedSnapshotPath);
        expect(actualGeneratedSnapshot).toBe(expectedGeneratedSnapshot);
      })
    );

    it("resolves import kinds in data-first and data-last forms", () => {
      expect(O.getOrUndefined(resolveImportSpecifierImportKind({ importKind: "type" }))).toBe("type");
      expect(O.getOrUndefined(resolveImportSpecifierImportKind({}, "value"))).toBe("value");
      expect(O.getOrUndefined(resolveImportSpecifierImportKind("type")({ importKind: "value" }))).toBe("value");
      expect(O.isNone(resolveImportSpecifierImportKind(undefined)({}))).toBe(true);
    });
  });
});
