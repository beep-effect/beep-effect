import {
  makeSymbolId,
  SymbolId,
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
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { REPO_ROOT, TestLayer, WORKSPACE_ROOT } from "./TSMorph.test-support.js";

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

const decodeDiagnosticsRequest = S.decodeUnknownSync(TsMorphDiagnosticsRequest);
const decodeFileOutlineRequest = S.decodeUnknownSync(TsMorphFileOutlineRequest);
const decodeProjectInspectionRequest = S.decodeUnknownSync(TsMorphProjectInspectionRequest);
const decodeProjectScopeRequest = S.decodeUnknownSync(TsMorphProjectScopeRequest);
const decodeSourceTextRequest = S.decodeUnknownSync(TsMorphSourceTextRequest);
const decodeSymbolQualifiedName = S.decodeUnknownSync(SymbolQualifiedName);
const decodeSymbolLookupRequest = S.decodeUnknownSync(TsMorphSymbolLookupRequest);
const decodeSymbolSearchRequest = S.decodeUnknownSync(TsMorphSymbolSearchRequest);
const decodeSymbolSourceRequest = S.decodeUnknownSync(TsMorphSymbolSourceRequest);

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
  it("only generates decodable, round-tripping symbol ids", () => {
    const symbolIdArbitrary = S.toArbitrary(SymbolId);
    const decodeSymbolId = S.decodeUnknownSync(SymbolId);
    const encodeSymbolId = S.encodeUnknownSync(SymbolId);

    fc.assert(
      fc.property(symbolIdArbitrary, (symbolId) => {
        const decoded = decodeSymbolId(symbolId);
        expect(encodeSymbolId(decoded)).toBe(symbolId);
      }),
      fcRuns(50)
    );
  });
});

layer(TestLayer, { timeout: TSMORPH_TIMEOUT })("TSMorphService", (it) => {
  describe("resolveProjectScope", () => {
    it.effect(
      "resolves a workspace tsconfig into a stable scope",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));

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

        const result = yield* service.inspectProject(
          decodeProjectInspectionRequest({
            entrypoint: {
              _tag: "tsconfig",
              tsConfigPath: LATE_FILE_TSCONFIG_PATH,
            },
            repoRootPath: REPO_ROOT,
            mode: "semantic",
            referencePolicy: "workspaceOnly",
            filePaths: [LATE_FILE_EXTRA_FILE_PATH],
            sourceFileGlobs: [],
          }),
          ({ scope, sourceFiles }) => {
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
          }
        );
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

        const result = yield* service.inspectProject(
          decodeProjectInspectionRequest({
            entrypoint: {
              _tag: "tsconfig",
              tsConfigPath: LATE_FILE_TSCONFIG_PATH,
            },
            repoRootPath: REPO_ROOT,
            mode: "syntax",
            referencePolicy: "workspaceOnly",
            filePaths: [],
            sourceFileGlobs: ["packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/missing/**/*.ts"],
          }),
          ({ scope, sourceFiles }) => ({
            scopeId: scope.scopeId,
            sourceFileCount: sourceFiles.length,
          })
        );

        expect(result.scopeId).toBe(
          "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/tsconfig.json::syntax#workspaceOnly"
        );
        expect(result.sourceFileCount).toBeGreaterThan(0);
      }),
      TSMORPH_TIMEOUT
    );
  });

  describe("readSourceText", () => {
    it.effect(
      "reads source text for a known TypeScript file through the scoped project",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const sourceText = yield* service.readSourceText(
          decodeSourceTextRequest({
            filePath: MODEL_FILE_PATH,
          })
        );

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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const outline = yield* service.getFileOutline(
          decodeFileOutlineRequest({
            scopeId: scope.scopeId,
            filePath: MODEL_FILE_PATH,
          })
        );

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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const outline = yield* service.getFileOutline(
          decodeFileOutlineRequest({
            scopeId: scope.scopeId,
            filePath: OUTLINE_ORDER_FILE_PATH,
          })
        );
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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const outline = yield* service.getFileOutline(
          decodeFileOutlineRequest({
            scopeId: scope.scopeId,
            filePath: MODEL_FILE_PATH,
          })
        );
        const targetSymbol = pipe(
          outline.symbols,
          A.findFirst((symbol) => symbol.name === "TsMorphProjectScope" && symbol.kind === "ClassDeclaration")
        );

        expect(O.isSome(targetSymbol)).toBe(true);
        if (O.isNone(targetSymbol)) {
          return;
        }

        const lookup = yield* service.getSymbolById(
          decodeSymbolLookupRequest({
            scopeId: scope.scopeId,
            symbolId: targetSymbol.value.id,
          })
        );
        const source = yield* service.readSymbolSource(
          decodeSymbolSourceRequest({
            scopeId: scope.scopeId,
            symbolId: targetSymbol.value.id,
          })
        );
        const sourceFile = yield* service.readSourceText(
          decodeSourceTextRequest({
            filePath: MODEL_FILE_PATH,
          })
        );
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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const outline = yield* service.getFileOutline(
          decodeFileOutlineRequest({
            scopeId: scope.scopeId,
            filePath: MODEL_FILE_PATH,
          })
        );
        const filePath = pipe(
          outline.symbols,
          A.head,
          O.map((symbol) => symbol.filePath)
        );

        expect(O.isSome(filePath)).toBe(true);
        if (O.isNone(filePath)) {
          return;
        }

        const missingSymbolId = makeSymbolId({
          filePath: filePath.value,
          qualifiedName: decodeSymbolQualifiedName("DefinitelyMissingSymbol"),
          kind: "ClassDeclaration",
        });
        const lookupError = yield* service
          .getSymbolById(
            decodeSymbolLookupRequest({
              scopeId: scope.scopeId,
              symbolId: missingSymbolId,
            })
          )
          .pipe(Effect.flip);
        const sourceError = yield* service
          .readSymbolSource(
            decodeSymbolSourceRequest({
              scopeId: scope.scopeId,
              symbolId: missingSymbolId,
            })
          )
          .pipe(Effect.flip);

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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const allMatches = yield* service.searchSymbols(
          decodeSymbolSearchRequest({
            scopeId: scope.scopeId,
            query: "TsMorph",
            categories: [],
            kinds: [],
            limit: 50,
          })
        );
        const unbounded = yield* service.searchSymbols(
          decodeSymbolSearchRequest({
            scopeId: scope.scopeId,
            query: "TsMorph",
            categories: ["class"],
            kinds: ["ClassDeclaration"],
            limit: 50,
          })
        );
        const limited = yield* service.searchSymbols(
          decodeSymbolSearchRequest({
            scopeId: scope.scopeId,
            query: "TsMorph",
            categories: ["class"],
            kinds: ["ClassDeclaration"],
            limit: 1,
          })
        );
        const blank = yield* service.searchSymbols(
          decodeSymbolSearchRequest({
            scopeId: scope.scopeId,
            query: "   ",
            categories: [],
            kinds: [],
            limit: 10,
          })
        );
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
        const scope = yield* service.resolveProjectScope(lateFileScopeRequest("syntax"));
        const initialSearch = yield* service.searchSymbols(
          decodeSymbolSearchRequest({
            scopeId: scope.scopeId,
            query: "IncludedThing",
            categories: [],
            kinds: [],
            limit: 10,
          })
        );
        const outline = yield* service.getFileOutline(
          decodeFileOutlineRequest({
            scopeId: scope.scopeId,
            filePath: LATE_FILE_EXTRA_FILE_PATH,
          })
        );
        const targetSymbol = pipe(
          outline.symbols,
          A.findFirst((symbol) => symbol.name === "ExtraThing" && symbol.kind === "ClassDeclaration")
        );

        expect(initialSearch.total).toBeGreaterThan(0);
        expect(A.some(initialSearch.symbols, (symbol) => symbol.filePath === LATE_FILE_INCLUDED_FILE_PATH)).toBe(true);
        expect(outline.filePath).toBe(LATE_FILE_EXTRA_FILE_PATH);
        expect(O.isSome(targetSymbol)).toBe(true);
        if (O.isNone(targetSymbol)) {
          return;
        }

        const lookup = yield* service.getSymbolById(
          decodeSymbolLookupRequest({
            scopeId: scope.scopeId,
            symbolId: targetSymbol.value.id,
          })
        );

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
        const scope = yield* service.resolveProjectScope(fixtureScopeRequest("semantic"));
        const diagnostics = yield* service.getDiagnostics(
          decodeDiagnosticsRequest({
            scopeId: scope.scopeId,
            filePath: FIXTURE_CLEAN_FILE_PATH,
          })
        );

        expect(diagnostics.filePath).toBe(FIXTURE_CLEAN_FILE_PATH);
        expect(diagnostics.diagnostics).toEqual([]);
      }),
      TSMORPH_TIMEOUT
    );

    it.effect(
      "normalizes file-local diagnostics for an intentionally broken fixture",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const scope = yield* service.resolveProjectScope(fixtureScopeRequest("semantic"));
        const diagnostics = yield* service.getDiagnostics(
          decodeDiagnosticsRequest({
            scopeId: scope.scopeId,
            filePath: FIXTURE_BROKEN_FILE_PATH,
          })
        );
        const firstDiagnostic = pipe(diagnostics.diagnostics, A.head);

        expect(diagnostics.filePath).toBe(FIXTURE_BROKEN_FILE_PATH);
        expect(diagnostics.diagnostics.length).toBeGreaterThan(0);
        expect(O.isSome(firstDiagnostic)).toBe(true);
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

  describe("typed error coverage", () => {
    it.effect(
      "rejects files outside the workspace boundary with a source file error",
      Effect.fn(function* () {
        const service = yield* TSMorphService;
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("semantic"));
        const error = yield* service
          .getDiagnostics(
            decodeDiagnosticsRequest({
              scopeId: scope.scopeId,
              filePath: OUTSIDE_WORKSPACE_FILE_PATH,
            })
          )
          .pipe(Effect.flip);

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
        const scope = yield* service.resolveProjectScope(repoUtilsScopeRequest("syntax"));
        const error = yield* service
          .getFileOutline(
            decodeFileOutlineRequest({
              scopeId: scope.scopeId,
              filePath: DECLARATION_FILE_PATH,
            })
          )
          .pipe(Effect.flip);

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
