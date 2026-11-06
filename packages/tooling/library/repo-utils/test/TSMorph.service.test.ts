import {
  makeSymbolId,
  SymbolId,
  SymbolIdentityParts,
  SymbolQualifiedName,
  TSMorphService,
  TsMorphDiagnosticsRequest,
  TsMorphFileOutlineRequest,
  TsMorphProjectInspectionRequest,
  TsMorphProjectScopeRequest,
  TsMorphSourceFileError,
  TsMorphSourceTextRequest,
  TsMorphSymbolLookupRequest,
  TsMorphSymbolNotFoundError,
  TsMorphSymbolSearchRequest,
  TsMorphSymbolSourceRequest,
  TsMorphUnsupportedFileError,
} from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { REPO_ROOT, TestLayer, WORKSPACE_ROOT } from "./TSMorph.test-support.ts";

const decodeUnknownSymbolId = S.decodeUnknownEffect(SymbolId);
const encodeUnknownSymbolId = S.encodeUnknownEffect(SymbolId);

const TSCONFIG_PATH = "packages/tooling/library/repo-utils/tsconfig.json";
const MODEL_FILE_PATH = "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts";
const FIXTURE_TSCONFIG_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-diagnostics/tsconfig.json";
const FIXTURE_CLEAN_FILE_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-diagnostics/src/clean.ts";
const FIXTURE_BROKEN_FILE_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-diagnostics/src/broken.ts";
const DECLARATION_FILE_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-declaration/ambient.d.ts";
const LATE_FILE_TSCONFIG_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/tsconfig.json";
const LATE_FILE_INCLUDED_FILE_PATH =
  "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/included.ts";
const LATE_FILE_EXTRA_FILE_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/extra.ts";
const OUTLINE_ORDER_FILE_PATH = "packages/tooling/library/repo-utils/test/fixtures/tsmorph-outline-order/source.ts";
const OUTSIDE_WORKSPACE_FILE_PATH = "packages/foundation/ui-system/ui/src/css.d.ts";

const decodeDiagnosticsRequest = S.decodeUnknownEffect(TsMorphDiagnosticsRequest);
const decodeFileOutlineRequest = S.decodeUnknownEffect(TsMorphFileOutlineRequest);
const decodeProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);
const decodeProjectScopeRequest = S.decodeUnknownEffect(TsMorphProjectScopeRequest);
const decodeSourceTextRequest = S.decodeUnknownEffect(TsMorphSourceTextRequest);
const decodeSymbolQualifiedName = S.decodeUnknownEffect(SymbolQualifiedName);
const decodeSymbolLookupRequest = S.decodeUnknownEffect(TsMorphSymbolLookupRequest);
const decodeSymbolSearchRequest = S.decodeUnknownEffect(TsMorphSymbolSearchRequest);
const decodeSymbolSourceRequest = S.decodeUnknownEffect(TsMorphSymbolSourceRequest);

const repoUtilsScopeRequest = (mode: "syntax" | "semantic" = "syntax") =>
  decodeProjectScopeRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: TSCONFIG_PATH,
    },
    repoRootPath: REPO_ROOT,
    mode,
    referencePolicy: "workspaceOnly",
  });

const fixtureScopeRequest = (mode: "syntax" | "semantic" = "semantic") =>
  decodeProjectScopeRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: FIXTURE_TSCONFIG_PATH,
    },
    repoRootPath: REPO_ROOT,
    mode,
    referencePolicy: "workspaceOnly",
  });

const lateFileScopeRequest = (mode: "syntax" | "semantic" = "syntax") =>
  decodeProjectScopeRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: LATE_FILE_TSCONFIG_PATH,
    },
    repoRootPath: REPO_ROOT,
    mode,
    referencePolicy: "workspaceOnly",
  });

const TSMORPH_TIMEOUT = 40_000;

describe("SymbolId schema arbitrary", () => {
  it.effect.prop(
    "only generates decodable, round-tripping symbol ids",
    [Arbitrary.schema(SymbolId)],
    ([symbolId]) =>
      Effect.gen(function* () {
        const decoded = yield* decodeUnknownSymbolId(symbolId);
        const encodedUnknownSymbolId = yield* encodeUnknownSymbolId(decoded);
        expect(encodedUnknownSymbolId).toBe(symbolId);

        return true;
      }),
    { arbitrary: fcRuns(50) }
  );
});

const makeIsolatedRepository = Effect.fn("TSMorphTest.makeIsolatedRepository")(function* (
  marker: string,
  configName: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  yield* fs.makeDirectory(path.join(root, ".git"));
  yield* fs.makeDirectory(path.join(root, "src"));
  yield* fs.writeFileString(
    path.join(root, configName),
    '{"compilerOptions":{"noLib":true},"include":["src/**/*.ts"]}'
  );
  yield* fs.writeFileString(path.join(root, "src/index.ts"), `export function ${marker}() { return 1; }\n`);
  return root;
});

it.layer(TestLayer, { timeout: TSMORPH_TIMEOUT })("TSMorphService", (it) => {
  it.effect.each([true, false])("isolates repository project pools when loadTsconfigFiles is %s", (loadTsconfigFiles) =>
    Effect.gen(function* () {
      const service = yield* TSMorphService;
      for (const marker of ["firstMarker", "secondMarker"]) {
        const root = yield* makeIsolatedRepository(marker, "tsconfig.pool-isolation.json");
        const decodedProjectInspectionRequest = yield* decodeProjectInspectionRequest({
          entrypoint: { _tag: "tsconfig", tsConfigPath: "tsconfig.pool-isolation.json" },
          repoRootPath: root,
          mode: "syntax",
          referencePolicy: "workspaceOnly",
          filePaths: ["src/index.ts"],
          sourceFileGlobs: [],
          loadTsconfigFiles,
        });
        const result = yield* service.inspectProject(decodedProjectInspectionRequest, ({ project, sourceFiles }) => ({
          texts: A.map(sourceFiles, (file) => file.getFullText()),
          projectTexts: A.map(project.getSourceFiles(), (file) => file.getFullText()),
        }));
        expect(result.texts).toEqual([`export function ${marker}() { return 1; }\n`]);
        expect(result.projectTexts).toEqual([`export function ${marker}() { return 1; }\n`]);
      }
    })
  );

  it.effect("resolves cached scope ids within the current root and rejects ambiguous external lookup", () =>
    Effect.gen(function* () {
      const service = yield* TSMorphService;
      const firstRoot = yield* makeIsolatedRepository("firstMarker", "tsconfig.scope-isolation.json");
      const secondRoot = yield* makeIsolatedRepository("secondMarker", "tsconfig.scope-isolation.json");
      const originalCwd = yield* Effect.acquireRelease(
        Effect.sync(() => process.cwd()),
        (cwd) => Effect.sync(() => process.chdir(cwd))
      );
      const decodedProjectScopeRequest = yield* decodeProjectScopeRequest({
        entrypoint: { _tag: "tsconfig", tsConfigPath: "tsconfig.scope-isolation.json" },
        repoRootPath: firstRoot,
        mode: "syntax",
        referencePolicy: "workspaceOnly",
      });
      const firstScope = yield* service.resolveProjectScope(decodedProjectScopeRequest);
      const decodedFileOutlineRequest = yield* decodeFileOutlineRequest({
        scopeId: firstScope.scopeId,
        filePath: "src/index.ts",
      });
      const firstOnly = yield* service.getFileOutline(decodedFileOutlineRequest);
      expect(A.map(firstOnly.symbols, (symbol) => symbol.name)).toContain("firstMarker");
      const decodedProjectScopeRequest1 = yield* decodeProjectScopeRequest({
        entrypoint: { _tag: "tsconfig", tsConfigPath: "tsconfig.scope-isolation.json" },
        repoRootPath: secondRoot,
        mode: "syntax",
        referencePolicy: "workspaceOnly",
      });
      const secondScope = yield* service.resolveProjectScope(decodedProjectScopeRequest1);
      expect(secondScope.scopeId).toBe(firstScope.scopeId);
      for (const { root, marker } of [
        { root: firstRoot, marker: "firstMarker" },
        { root: secondRoot, marker: "secondMarker" },
        { root: firstRoot, marker: "firstMarker" },
      ]) {
        yield* Effect.sync(() => process.chdir(root));
        const decodedFileOutlineRequest2 = yield* decodeFileOutlineRequest({
          scopeId: firstScope.scopeId,
          filePath: "src/index.ts",
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest2);
        expect(A.map(outline.symbols, (symbol) => symbol.name)).toContain(marker);
        const decodedSymbolSearchRequest = yield* decodeSymbolSearchRequest({
          scopeId: firstScope.scopeId,
          query: "Marker",
          categories: [],
          kinds: [],
          limit: 10,
        });
        const symbols = yield* service.searchSymbols(decodedSymbolSearchRequest);
        expect(A.map(symbols.symbols, (symbol) => symbol.name)).toEqual([marker]);
      }
      yield* Effect.sync(() => process.chdir(originalCwd));
      const decodedFileOutlineRequest3 = yield* decodeFileOutlineRequest({
        scopeId: firstScope.scopeId,
        filePath: "src/index.ts",
      });
      const error = yield* service.getFileOutline(decodedFileOutlineRequest3).pipe(Effect.flip);
      expect(error._tag).toBe("TsMorphScopeResolutionError");
      expect(error.message).toContain("ambiguous across repository roots");
    })
  );

  describe("file entrypoint tsconfig discovery", () => {
    const fileScopeRequest = (repoRootPath: string, filePath: string) =>
      decodeProjectScopeRequest({
        entrypoint: { _tag: "file", filePath },
        repoRootPath,
        mode: "syntax",
        referencePolicy: "workspaceOnly",
      });

    it.effect("absolutises a relative explicit root before ascending to the owning tsconfig", () =>
      Effect.gen(function* () {
        const service = yield* TSMorphService;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeIsolatedRepository("relativeRootMarker", "tsconfig.json");
        yield* fs.makeDirectory(path.join(root, "src/nested/deeper"), { recursive: true });
        yield* fs.writeFileString(path.join(root, "src/nested/deeper/leaf.ts"), "export const leaf = 1;\n");

        const fileScopeRequest4 = yield* fileScopeRequest(
          path.relative(process.cwd(), root),
          "src/nested/deeper/leaf.ts"
        );
        const scope = yield* service.resolveProjectScope(fileScopeRequest4);

        expect(scope.repoRootPath).toBe(root);
        expect(scope.tsConfigPath).toBe("tsconfig.json");
      })
    );

    it.effect("stops the owning-tsconfig ascent at the repository root", () =>
      Effect.gen(function* () {
        const service = yield* TSMorphService;
        const root = yield* makeIsolatedRepository("ceilingMarker", "tsconfig.other.json");

        const fileScopeRequest5 = yield* fileScopeRequest(root, "src/index.ts");
        const error = yield* service.resolveProjectScope(fileScopeRequest5).pipe(Effect.flip);

        expect(error._tag).toBe("TsMorphScopeResolutionError");
        expect(error.message).toBe(
          `No owning "tsconfig.json" could be found for "src/index.ts" within repository root "${root}".`
        );
      })
    );
  });

  describe("resolveProjectScope", () => {
    it.effect(
      "resolves a workspace tsconfig into a stable scope",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        yield* Effect.logInfo("repo-utils.tsmorph.resolve.start");
        const repoUtilsScopeRequest6 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest6);
        yield* Effect.logInfo("repo-utils.tsmorph.resolve.complete");

        expect(scope.scopeId).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
        expect(scope.cacheKey).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
        expect(scope.repoRootPath).toBe(REPO_ROOT);
        expect(scope.workspaceDirectoryPath).toBe(WORKSPACE_ROOT);
        expect(scope.tsConfigPath).toBe(TSCONFIG_PATH);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("inspectProject", () => {
    it.effect(
      "loads a semantic project and exposes scoped source files without saving mutations",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const absoluteFixturePath = path.resolve(REPO_ROOT, LATE_FILE_EXTRA_FILE_PATH);
        const before = yield* fs.readFileString(absoluteFixturePath);

        const decodedProjectInspectionRequest7 = yield* decodeProjectInspectionRequest({
          entrypoint: {
            _tag: "tsconfig",
            tsConfigPath: LATE_FILE_TSCONFIG_PATH,
          },
          repoRootPath: REPO_ROOT,
          mode: "semantic",
          referencePolicy: "workspaceOnly",
          filePaths: [LATE_FILE_EXTRA_FILE_PATH],
          sourceFileGlobs: [],
        });
        const result = yield* service.inspectProject(decodedProjectInspectionRequest7, ({ scope, sourceFiles }) => {
          const target = pipe(
            sourceFiles,
            A.findFirst((sourceFile) => sourceFile.getFilePath() === absoluteFixturePath)
          );
          if (O.isNone(target)) {
            return {
              changedText: "",
              scopeId: scope.scopeId,
              sourceFileCount: sourceFiles.length,
            } as const;
          }

          target.value.replaceWithText(`${before}\nexport const transientInspectProjectValue = 1;\n`);
          const changedText = target.value.getFullText();
          target.value.replaceWithText(before);

          return {
            changedText,
            scopeId: scope.scopeId,
            sourceFileCount: sourceFiles.length,
          } as const;
        });
        const after = yield* fs.readFileString(absoluteFixturePath);

        expect(result.scopeId).toBe(
          "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/tsconfig.json::semantic#workspaceOnly"
        );
        expect(result.sourceFileCount).toBeGreaterThan(0);
        expect(result.changedText).toContain("transientInspectProjectValue");
        expect(after).toBe(before);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "skips missing source file glob directories during read-only inspection",
      Effect.fn(function* () {
        const service = yield* TSMorphService;

        const decodedProjectInspectionRequest8 = yield* decodeProjectInspectionRequest({
          entrypoint: {
            _tag: "tsconfig",
            tsConfigPath: LATE_FILE_TSCONFIG_PATH,
          },
          repoRootPath: REPO_ROOT,
          mode: "syntax",
          referencePolicy: "workspaceOnly",
          filePaths: [],
          sourceFileGlobs: ["packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/missing/**/*.ts"],
        });
        const result = yield* service.inspectProject(decodedProjectInspectionRequest8, ({ scope, sourceFiles }) => ({
          scopeId: scope.scopeId,
          sourceFileCount: sourceFiles.length,
        }));

        expect(result.scopeId).toBe(
          "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/tsconfig.json::syntax#workspaceOnly"
        );
        expect(result.sourceFileCount).toBeGreaterThan(0);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "loads only the explicit files of a package syntax request and keeps ordinary inspection separate",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const path = yield* Path.Path;
        const explicit = path.resolve(REPO_ROOT, LATE_FILE_EXTRA_FILE_PATH);
        const packageRequest = yield* TsMorphProjectInspectionRequest.packageSyntax(
          REPO_ROOT,
          LATE_FILE_TSCONFIG_PATH,
          [explicit]
        );
        expect(packageRequest.loadTsconfigFiles).toBe(false);
        const packageFiles = yield* service.inspectProject(packageRequest, ({ sourceFiles }) =>
          A.map(sourceFiles, (sourceFile) => sourceFile.getFilePath())
        );
        expect(packageFiles).toEqual([explicit]);

        const decodedProjectInspectionRequest9 = yield* decodeProjectInspectionRequest({
          entrypoint: { _tag: "tsconfig", tsConfigPath: LATE_FILE_TSCONFIG_PATH },
          repoRootPath: REPO_ROOT,
          mode: "syntax",
          referencePolicy: "workspaceOnly",
          filePaths: [LATE_FILE_EXTRA_FILE_PATH],
          sourceFileGlobs: [],
          loadTsconfigFiles: false,
        });
        const explicitByPath = yield* service.inspectProject(
          decodedProjectInspectionRequest9,
          ({ sourceFiles }) => sourceFiles.length
        );
        expect(explicitByPath).toBe(1);

        const decodedProjectInspectionRequest10 = yield* decodeProjectInspectionRequest({
          entrypoint: { _tag: "tsconfig", tsConfigPath: LATE_FILE_TSCONFIG_PATH },
          repoRootPath: REPO_ROOT,
          mode: "syntax",
          referencePolicy: "workspaceOnly",
          filePaths: [],
          sourceFileGlobs: [],
        });
        const ordinaryCount = yield* service.inspectProject(
          decodedProjectInspectionRequest10,
          ({ sourceFiles }) => sourceFiles.length
        );
        expect(ordinaryCount).toBeGreaterThanOrEqual(1);
        const packageAgain = yield* service.inspectProject(packageRequest, ({ sourceFiles }) => sourceFiles.length);
        expect(packageAgain).toBe(1);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("readSourceText", () => {
    it.effect(
      "reads source text for a known TypeScript file through the scoped project",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const decodedSourceTextRequest = yield* decodeSourceTextRequest({
          filePath: MODEL_FILE_PATH,
        });
        const sourceText = yield* service.readSourceText(decodedSourceTextRequest);

        expect(sourceText.filePath).toBe(MODEL_FILE_PATH);
        expect(sourceText.sourceText).toContain("export class TsMorphProjectScope");
        expect(sourceText.contentHash).toMatch(/^[0-9a-f]{64}$/u);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("getFileOutline", () => {
    it.effect(
      "extracts a non-empty outline for a known TypeScript file",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest11 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest11);
        const decodedFileOutlineRequest12 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: MODEL_FILE_PATH,
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest12);

        expect(outline.filePath).toBe(MODEL_FILE_PATH);
        expect(outline.symbols.length).toBeGreaterThan(0);
        expect(
          A.some(
            outline.symbols,
            (symbol) => symbol.name === "TsMorphProjectScope" && symbol.kind === "ClassDeclaration"
          )
        ).toBe(true);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "preserves source declaration order within a file outline",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest13 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest13);
        const decodedFileOutlineRequest14 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: OUTLINE_ORDER_FILE_PATH,
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest14);
        const names = pipe(
          outline.symbols,
          A.map((symbol) => symbol.name)
        );

        expect(names).toEqual(["ZebraThing", "AlphaThing"]);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("getSymbolById / readSymbolSource", () => {
    it.effect(
      "loads a normalized class symbol and its extracted source text",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest15 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest15);
        const decodedFileOutlineRequest16 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: MODEL_FILE_PATH,
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest16);
        const targetSymbol = pipe(
          outline.symbols,
          A.findFirst((symbol) => symbol.name === "TsMorphProjectScope" && symbol.kind === "ClassDeclaration")
        );

        targetSymbol.pipe(O.isSome, assertTrue);
        if (O.isNone(targetSymbol)) {
          return;
        }

        const decodedSymbolLookupRequest = yield* decodeSymbolLookupRequest({
          scopeId: scope.scopeId,
          symbolId: targetSymbol.value.id,
        });
        const lookup = yield* service.getSymbolById(decodedSymbolLookupRequest);
        const decodedSymbolSourceRequest = yield* decodeSymbolSourceRequest({
          scopeId: scope.scopeId,
          symbolId: targetSymbol.value.id,
        });
        const source = yield* service.readSymbolSource(decodedSymbolSourceRequest);
        const decodedSourceTextRequest17 = yield* decodeSourceTextRequest({
          filePath: MODEL_FILE_PATH,
        });
        const sourceFile = yield* service.readSourceText(decodedSourceTextRequest17);
        const sourceFileBytes = new TextEncoder().encode(sourceFile.sourceText);
        const symbolSlice = sourceFileBytes.slice(
          lookup.symbol.byteOffset,
          lookup.symbol.byteOffset + lookup.symbol.byteLength
        );

        expect(lookup.symbol.id).toBe(targetSymbol.value.id);
        expect(lookup.symbol.qualifiedName).toBe("TsMorphProjectScope");
        expect(source.symbol.id).toBe(targetSymbol.value.id);
        expect(source.sourceText).toContain("export class TsMorphProjectScope");
        expect(source.contentHash).toBe(targetSymbol.value.contentHash);
        expect(new TextDecoder().decode(symbolSlice)).toBe(source.sourceText);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "fails with a typed error for missing symbol ids",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest18 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest18);
        const decodedFileOutlineRequest19 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: MODEL_FILE_PATH,
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest19);
        const filePath = pipe(
          outline.symbols,
          A.head,
          O.map((symbol) => symbol.filePath)
        );

        filePath.pipe(O.isSome, assertTrue);
        if (O.isNone(filePath)) {
          return;
        }

        const missingSymbolId = makeSymbolId(
          SymbolIdentityParts.make({
            filePath: filePath.value,
            qualifiedName: yield* decodeSymbolQualifiedName("DefinitelyMissingSymbol"),
            kind: "ClassDeclaration",
          })
        );
        const decodedSymbolLookupRequest20 = yield* decodeSymbolLookupRequest({
          scopeId: scope.scopeId,
          symbolId: missingSymbolId,
        });
        const lookupError = yield* service.getSymbolById(decodedSymbolLookupRequest20).pipe(Effect.flip);
        const decodedSymbolSourceRequest21 = yield* decodeSymbolSourceRequest({
          scopeId: scope.scopeId,
          symbolId: missingSymbolId,
        });
        const sourceError = yield* service.readSymbolSource(decodedSymbolSourceRequest21).pipe(Effect.flip);

        expect(lookupError).toBeInstanceOf(TsMorphSymbolNotFoundError);
        expect(lookupError._tag).toBe("TsMorphSymbolNotFoundError");
        if (lookupError._tag !== "TsMorphSymbolNotFoundError") {
          return;
        }
        expect(lookupError.symbolId).toBe(missingSymbolId);
        expect(sourceError).toBeInstanceOf(TsMorphSymbolNotFoundError);
        expect(sourceError._tag).toBe("TsMorphSymbolNotFoundError");
        if (sourceError._tag !== "TsMorphSymbolNotFoundError") {
          return;
        }
        expect(sourceError.symbolId).toBe(missingSymbolId);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("searchSymbols", () => {
    it.effect(
      "searches deterministically and honors category, kind, and limit filters",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest22 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest22);
        const decodedSymbolSearchRequest23 = yield* decodeSymbolSearchRequest({
          scopeId: scope.scopeId,
          query: "TsMorph",
          categories: [],
          kinds: [],
          limit: 50,
        });
        const allMatches = yield* service.searchSymbols(decodedSymbolSearchRequest23);
        const decodedSymbolSearchRequest24 = yield* decodeSymbolSearchRequest({
          scopeId: scope.scopeId,
          query: "TsMorph",
          categories: ["class"],
          kinds: ["ClassDeclaration"],
          limit: 50,
        });
        const unbounded = yield* service.searchSymbols(decodedSymbolSearchRequest24);
        const decodedSymbolSearchRequest25 = yield* decodeSymbolSearchRequest({
          scopeId: scope.scopeId,
          query: "TsMorph",
          categories: ["class"],
          kinds: ["ClassDeclaration"],
          limit: 1,
        });
        const limited = yield* service.searchSymbols(decodedSymbolSearchRequest25);
        const decodedSymbolSearchRequest26 = yield* decodeSymbolSearchRequest({
          scopeId: scope.scopeId,
          query: "   ",
          categories: [],
          kinds: [],
          limit: 10,
        });
        const blank = yield* service.searchSymbols(decodedSymbolSearchRequest26);
        const names = pipe(
          unbounded.symbols,
          A.map((symbol) => symbol.name)
        );

        expect(unbounded.total).toBeGreaterThan(1);
        expect(unbounded.symbols.length).toBeLessThanOrEqual(unbounded.total);
        expect(allMatches.total).toBeGreaterThanOrEqual(unbounded.total);
        expect(limited.total).toBe(unbounded.total);
        expect(limited.symbols).toHaveLength(1);
        expect(blank.total).toBe(0);
        expect(blank.symbols).toEqual([]);
        expect(names).toEqual(A.sort(names, Order.String));
        expect(
          A.every(unbounded.symbols, (symbol) => symbol.category === "class" && symbol.kind === "ClassDeclaration")
        ).toBe(true);
        expect(A.some(unbounded.symbols, (symbol) => symbol.name === "TsMorphProjectScope")).toBe(true);
        expect(limited.symbols[0]?.name).toBe(unbounded.symbols[0]?.name);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("scope symbol index", () => {
    it.effect(
      "refreshes the cached symbol index when a late-loaded implementation file enters the project",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const lateFileScopeRequest27 = yield* lateFileScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(lateFileScopeRequest27);
        const decodedSymbolSearchRequest28 = yield* decodeSymbolSearchRequest({
          scopeId: scope.scopeId,
          query: "IncludedThing",
          categories: [],
          kinds: [],
          limit: 10,
        });
        const initialSearch = yield* service.searchSymbols(decodedSymbolSearchRequest28);
        const decodedFileOutlineRequest29 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: LATE_FILE_EXTRA_FILE_PATH,
        });
        const outline = yield* service.getFileOutline(decodedFileOutlineRequest29);
        const targetSymbol = pipe(
          outline.symbols,
          A.findFirst((symbol) => symbol.name === "ExtraThing" && symbol.kind === "ClassDeclaration")
        );

        expect(initialSearch.total).toBeGreaterThan(0);
        expect(A.some(initialSearch.symbols, (symbol) => symbol.filePath === LATE_FILE_INCLUDED_FILE_PATH)).toBe(true);
        expect(outline.filePath).toBe(LATE_FILE_EXTRA_FILE_PATH);
        targetSymbol.pipe(O.isSome, assertTrue);
        if (O.isNone(targetSymbol)) {
          return;
        }

        const decodedSymbolLookupRequest30 = yield* decodeSymbolLookupRequest({
          scopeId: scope.scopeId,
          symbolId: targetSymbol.value.id,
        });
        const lookup = yield* service.getSymbolById(decodedSymbolLookupRequest30);

        expect(lookup.symbol.filePath).toBe(LATE_FILE_EXTRA_FILE_PATH);
        expect(lookup.symbol.qualifiedName).toBe("ExtraThing");
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("getDiagnostics", () => {
    it.effect(
      "returns no diagnostics for a known clean file in semantic mode",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const fixtureScopeRequest31 = yield* fixtureScopeRequest("semantic");
        const scope = yield* service.resolveProjectScope(fixtureScopeRequest31);
        const decodedDiagnosticsRequest = yield* decodeDiagnosticsRequest({
          scopeId: scope.scopeId,
          filePath: FIXTURE_CLEAN_FILE_PATH,
        });
        const diagnostics = yield* service.getDiagnostics(decodedDiagnosticsRequest);

        expect(diagnostics.filePath).toBe(FIXTURE_CLEAN_FILE_PATH);
        expect(diagnostics.diagnostics).toEqual([]);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "normalizes file-local diagnostics for an intentionally broken fixture",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const fixtureScopeRequest32 = yield* fixtureScopeRequest("semantic");
        const scope = yield* service.resolveProjectScope(fixtureScopeRequest32);
        const decodedDiagnosticsRequest33 = yield* decodeDiagnosticsRequest({
          scopeId: scope.scopeId,
          filePath: FIXTURE_BROKEN_FILE_PATH,
        });
        const diagnostics = yield* service.getDiagnostics(decodedDiagnosticsRequest33);
        const firstDiagnostic = pipe(diagnostics.diagnostics, A.head);

        expect(diagnostics.filePath).toBe(FIXTURE_BROKEN_FILE_PATH);
        expect(diagnostics.diagnostics.length).toBeGreaterThan(0);
        firstDiagnostic.pipe(O.isSome, assertTrue);
        if (O.isNone(firstDiagnostic)) {
          return;
        }

        expect(firstDiagnostic.value.category).toBe("error");
        expect(firstDiagnostic.value.code).toBe(2322);
        expect(firstDiagnostic.value.message).toMatch(/not assignable to type 'number'/u);
        expect(firstDiagnostic.value.startLine).toBe(1);
        expect(firstDiagnostic.value.startColumn).toBeGreaterThan(0);
        expect(firstDiagnostic.value.endColumn).toBeGreaterThanOrEqual(firstDiagnostic.value.startColumn);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("updateSourceFile", () => {
    it.effect(
      "reports a no-op edit without changing the source bytes",
      Effect.fnUntraced(function* () {
        const service = yield* TSMorphService;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixturePath = path.resolve(REPO_ROOT, FIXTURE_CLEAN_FILE_PATH);
        const before = yield* fs.readFileString(fixturePath);

        const changed = yield* service.updateSourceFile(FIXTURE_CLEAN_FILE_PATH, (sourceFile) => {
          expect(sourceFile.getFullText()).toBe(before);
        });

        expect(changed).toBe(false);
        const readFileString34 = yield* fs.readFileString(fixturePath);
        expect(readFileString34).toBe(before);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("typed error coverage", () => {
    it.effect(
      "rejects files outside the workspace boundary with a source file error",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest35 = yield* repoUtilsScopeRequest("semantic");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest35);
        const decodedDiagnosticsRequest36 = yield* decodeDiagnosticsRequest({
          scopeId: scope.scopeId,
          filePath: OUTSIDE_WORKSPACE_FILE_PATH,
        });
        const error = yield* service.getDiagnostics(decodedDiagnosticsRequest36).pipe(Effect.flip);

        expect(error).toBeInstanceOf(TsMorphSourceFileError);
        expect(error._tag).toBe("TsMorphSourceFileError");
        if (error._tag !== "TsMorphSourceFileError") {
          return;
        }
        expect(O.getOrNull(error.scopeId)).toBe(scope.scopeId);
        expect(O.getOrNull(error.filePath)).toBe(OUTSIDE_WORKSPACE_FILE_PATH);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "rejects declaration files for outline extraction with an unsupported file error",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const repoUtilsScopeRequest37 = yield* repoUtilsScopeRequest("syntax");
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest37);
        const decodedFileOutlineRequest38 = yield* decodeFileOutlineRequest({
          scopeId: scope.scopeId,
          filePath: DECLARATION_FILE_PATH,
        });
        const error = yield* service.getFileOutline(decodedFileOutlineRequest38).pipe(Effect.flip);

        expect(error).toBeInstanceOf(TsMorphUnsupportedFileError);
        expect(error._tag).toBe("TsMorphUnsupportedFileError");
        if (error._tag !== "TsMorphUnsupportedFileError") {
          return;
        }
        expect(error.filePath).toBe(DECLARATION_FILE_PATH);
      }),
      TSMORPH_TIMEOUT
    );
  });
});
