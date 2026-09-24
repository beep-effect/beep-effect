import {
  ByteLength,
  ByteOffset,
  ColumnNumber,
  ContentHash,
  ContentHashFromSourceText,
  FilePathToTsConfigFilePath,
  FilePathToTypeScriptDeclarationFilePath,
  FilePathToTypeScriptFilePath,
  FilePathToTypeScriptImplementationFilePath,
  LineNumber,
  makeProjectCacheKey,
  makeProjectScopeId,
  makeSymbol,
  makeSymbolId,
  ProjectIdentityParts,
  ProjectScopeId,
  ProjectScopeIdParts,
  RepoRootPath,
  Symbol,
  SymbolCategory,
  SymbolFilePath,
  SymbolId,
  SymbolIdentityParts,
  SymbolIdParts,
  SymbolKind,
  SymbolKindToCategory,
  SymbolNameSegment,
  SymbolQualifiedName,
  symbolCategoryFromKind,
  TsConfigFilePath,
  TsMorphDiagnostic,
  TsMorphDiagnosticsResult,
  TsMorphFileOutline,
  TsMorphProjectScope,
  TsMorphProjectScopeRequest,
  TsMorphReferencePolicy,
  TsMorphScopeMode,
  TsMorphSearchLimit,
  TsMorphSourceTextResult,
  TsMorphSymbolLookupResult,
  TsMorphSymbolSearchRequest,
  TsMorphSymbolSearchResult,
  TsMorphSymbolSourceResult,
  TypeScriptDeclarationFilePath,
  TypeScriptFilePath,
  TypeScriptImplementationFilePath,
  TypeScriptImplementationFilePathToSymbolFilePath,
  WorkspaceDirectoryPath,
} from "@beep/repo-utils/TSMorph/index";
import {
  InternalTsMorphNode,
  InternalTsMorphProject,
  InternalTsMorphSourceFile,
} from "@beep/repo-utils/TSMorph/TSMorph.model";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Option as O } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { Project } from "ts-morph";

const decodeContentHashFromSourceText = S.decodeEffect(ContentHashFromSourceText);
const decodeFilePathToTsConfigFilePath = S.decodeEffect(FilePathToTsConfigFilePath);
const decodeFilePathToTypeScriptDeclarationFilePath = S.decodeEffect(FilePathToTypeScriptDeclarationFilePath);
const decodeFilePathToTypeScriptFilePath = S.decodeEffect(FilePathToTypeScriptFilePath);
const decodeFilePathToTypeScriptImplementationFilePath = S.decodeEffect(FilePathToTypeScriptImplementationFilePath);
const decodeProjectIdentityParts = S.decodeEffect(ProjectIdentityParts);
const decodeSymbolIdentityParts = S.decodeEffect(SymbolIdentityParts);
const decodeSymbolKindToCategory = S.decodeEffect(SymbolKindToCategory);
const decodeTypeScriptImplementationFilePathToSymbolFilePath = S.decodeEffect(
  TypeScriptImplementationFilePathToSymbolFilePath
);
const encodeProjectIdentityParts = S.encodeEffect(ProjectIdentityParts);
const encodeSymbolIdentityParts = S.encodeEffect(SymbolIdentityParts);

const decodeRepoRootPath = S.decodeUnknownEffect(RepoRootPath);
const decodeWorkspaceDirectoryPath = S.decodeUnknownEffect(WorkspaceDirectoryPath);
const decodeTsConfigFilePath = S.decodeUnknownEffect(TsConfigFilePath);
const decodeTypeScriptImplementationFilePath = S.decodeUnknownEffect(TypeScriptImplementationFilePath);
const decodeTypeScriptDeclarationFilePath = S.decodeUnknownEffect(TypeScriptDeclarationFilePath);
const decodeTypeScriptFilePath = S.decodeUnknownEffect(TypeScriptFilePath);
const decodeSymbolQualifiedName = S.decodeUnknownEffect(SymbolQualifiedName);
const decodeSymbolFilePath = S.decodeUnknownEffect(SymbolFilePath);
const decodeSymbolKind = S.decodeUnknownEffect(SymbolKind);
const decodeSymbolCategory = S.decodeUnknownEffect(SymbolCategory);
const decodeSymbolId = S.decodeUnknownEffect(SymbolId);
const decodeSymbolIdParts = S.decodeUnknownEffect(SymbolIdParts);
const decodeProjectScopeId = S.decodeUnknownEffect(ProjectScopeId);
const decodeProjectScopeIdParts = S.decodeUnknownEffect(ProjectScopeIdParts);
const decodeLineNumber = S.decodeUnknownEffect(LineNumber);
const decodeColumnNumber = S.decodeUnknownEffect(ColumnNumber);
const decodeSearchLimit = S.decodeUnknownEffect(TsMorphSearchLimit);
const platformLayer = Layer.mergeAll(NodeServices.layer);
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));
const decodeSymbol = S.decodeUnknownEffect(Symbol);
const decodeTsMorphProjectScopeRequest = S.decodeUnknownEffect(TsMorphProjectScopeRequest);
const decodeTsMorphProjectScope = S.decodeUnknownEffect(TsMorphProjectScope);
const decodeTsMorphFileOutline = S.decodeUnknownEffect(TsMorphFileOutline);
const decodeTsMorphSourceTextResult = S.decodeUnknownEffect(TsMorphSourceTextResult);
const decodeTsMorphSymbolLookupResult = S.decodeUnknownEffect(TsMorphSymbolLookupResult);
const decodeTsMorphSymbolSearchRequest = S.decodeUnknownEffect(TsMorphSymbolSearchRequest);
const decodeTsMorphSymbolSearchResult = S.decodeUnknownEffect(TsMorphSymbolSearchResult);
const decodeTsMorphSymbolSourceResult = S.decodeUnknownEffect(TsMorphSymbolSourceResult);
const decodeTsMorphDiagnostic = S.decodeUnknownEffect(TsMorphDiagnostic);
const decodeTsMorphDiagnosticsResult = S.decodeUnknownEffect(TsMorphDiagnosticsResult);
const decodeInternalProject = S.decodeUnknownEffect(InternalTsMorphProject);
const decodeInternalSourceFile = S.decodeUnknownEffect(InternalTsMorphSourceFile);
const decodeInternalNode = S.decodeUnknownEffect(InternalTsMorphNode);
const encodeSymbol = S.encodeEffect(Symbol);

const baseSymbolInput = {
  filePath: SymbolFilePath.make("src/main.ts"),
  name: SymbolNameSegment.make("login"),
  qualifiedName: SymbolQualifiedName.make("UserService.login"),
  kind: SymbolKind.Enum.MethodDeclaration,
  signature: "login(id: string): User",
  docstring: O.none<string>(),
  summary: O.none<string>(),
  decorators: [],
  keywords: ["login"],
  parentId: O.none<SymbolId>(),
  startLine: LineNumber.make(10),
  endLine: LineNumber.make(18),
  byteOffset: ByteOffset.make(128),
  byteLength: ByteLength.make(84),
  contentHash: ContentHash.make("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
};

const baseSymbol = makeSymbol({
  ...baseSymbolInput,
  contentHash: baseSymbolInput.contentHash,
});

describe("TSMorph model taxonomy", () => {
  describe("path primitives", () => {
    it.effect(
      "accepts repo and workspace directory paths",
      Effect.fnUntraced(function* () {
        expect(yield* decodeRepoRootPath("/repo/root")).toBe("/repo/root");
        expect(yield* decodeWorkspaceDirectoryPath("/repo/root/packages/tooling/library/repo-utils")).toBe(
          "/repo/root/packages/tooling/library/repo-utils"
        );
      })
    );

    it.effect(
      "validates tsconfig file paths",
      Effect.fnUntraced(function* () {
        expect(yield* decodeTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json")).toBe(
          "packages/tooling/library/repo-utils/tsconfig.json"
        );
        expect(yield* decodeTsConfigFilePath("packages/foo/tsconfig.build.json")).toBe(
          "packages/foo/tsconfig.build.json"
        );
        expect(Exit.isFailure(yield* Effect.exit(decodeTsConfigFilePath("packages/foo/tsconfig.ts")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeTsConfigFilePath("packages/foo/tsconfig#dev.json")))).toBe(true);
      })
    );

    it.effect(
      "splits implementation and declaration TypeScript file paths strictly",
      Effect.fnUntraced(function* () {
        expect(yield* decodeTypeScriptImplementationFilePath("src/main.ts")).toBe("src/main.ts");
        expect(yield* decodeTypeScriptImplementationFilePath("src/component.tsx")).toBe("src/component.tsx");
        expect(yield* decodeTypeScriptImplementationFilePath("src/module.mts")).toBe("src/module.mts");
        expect(Exit.isFailure(yield* Effect.exit(decodeTypeScriptImplementationFilePath("src/types.d.ts")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeTypeScriptImplementationFilePath("src/main.js")))).toBe(true);

        expect(yield* decodeTypeScriptDeclarationFilePath("src/types.d.ts")).toBe("src/types.d.ts");
        expect(yield* decodeTypeScriptDeclarationFilePath("src/types.d.mts")).toBe("src/types.d.mts");
        expect(Exit.isFailure(yield* Effect.exit(decodeTypeScriptDeclarationFilePath("src/main.ts")))).toBe(true);

        expect(yield* decodeTypeScriptFilePath("src/main.ts")).toBe("src/main.ts");
        expect(yield* decodeTypeScriptFilePath("src/types.d.ts")).toBe("src/types.d.ts");
      })
    );

    it.effect(
      "keeps SymbolFilePath implementation-only and delimiter-safe",
      Effect.fnUntraced(function* () {
        expect(yield* decodeSymbolFilePath("src/main.ts")).toBe("src/main.ts");
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolFilePath("src/types.d.ts")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolFilePath("src::main.ts")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolFilePath("src/main#one.ts")))).toBe(true);
      })
    );
  });

  describe("pure transformations", () => {
    it.effect(
      "refines generic file paths into stricter TypeScript path schemas",
      Effect.fnUntraced(function* () {
        expect(yield* decodeFilePathToTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json")).toBe(
          "packages/tooling/library/repo-utils/tsconfig.json"
        );
        expect(yield* decodeFilePathToTypeScriptImplementationFilePath("src/main.ts")).toBe("src/main.ts");
        expect(yield* decodeFilePathToTypeScriptDeclarationFilePath("src/types.d.ts")).toBe("src/types.d.ts");
        expect(yield* decodeFilePathToTypeScriptFilePath("src/types.d.ts")).toBe("src/types.d.ts");
        expect(yield* decodeTypeScriptImplementationFilePathToSymbolFilePath("src/main.ts")).toBe("src/main.ts");
      })
    );

    it.effect(
      "maps exact symbol kinds to coarse categories",
      Effect.fnUntraced(function* () {
        expect(symbolCategoryFromKind("FunctionDeclaration")).toBe(SymbolCategory.Enum.function);
        expect(symbolCategoryFromKind("Constructor")).toBe(SymbolCategory.Enum.member);
        expect(symbolCategoryFromKind("EnumDeclaration")).toBe(SymbolCategory.Enum.type);
        expect(yield* decodeSymbolKindToCategory("MethodDeclaration")).toBe("member");
        expect(yield* decodeSymbolCategory("member")).toBe("member");
      })
    );

    it.effect(
      "roundtrips symbol ids and scope ids through parsed tuple parts",
      Effect.fnUntraced(function* () {
        const symbolId = yield* decodeSymbolId("src/main.ts::UserService.login#MethodDeclaration");
        expect(yield* decodeSymbolIdParts(symbolId)).toEqual([
          "src/main.ts",
          "::",
          "UserService.login",
          "#",
          "MethodDeclaration",
        ]);

        const scopeId = makeProjectScopeId({
          tsConfigPath: yield* decodeTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json"),
          mode: TsMorphScopeMode.Enum.syntax,
          referencePolicy: TsMorphReferencePolicy.Enum.workspaceOnly,
        });

        expect(scopeId).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
        expect(yield* decodeProjectScopeId(scopeId)).toBe(scopeId);
        expect(yield* decodeProjectScopeIdParts(scopeId)).toEqual([
          "packages/tooling/library/repo-utils/tsconfig.json",
          "::",
          "syntax",
          "#",
          "workspaceOnly",
        ]);
        expect(
          makeProjectCacheKey({
            tsConfigPath: yield* decodeTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json"),
            mode: TsMorphScopeMode.Enum.syntax,
            referencePolicy: TsMorphReferencePolicy.Enum.workspaceOnly,
          })
        ).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
      })
    );

    it.effect(
      "round-trips schema-derived project identity parts through the encoded wire shape",
      Effect.fnUntraced(function* () {
        const result = yield* Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ProjectIdentityParts)]),
          ([value]) =>
            Effect.gen(function* () {
              const encoded = yield* encodeProjectIdentityParts(value);
              const decoded = yield* decodeProjectIdentityParts(encoded);

              expect(decoded).toEqual(value);
              expect(yield* decodeProjectScopeId(makeProjectScopeId(decoded))).toBe(makeProjectScopeId(decoded));

              return true;
            }),
          { runs: 20 }
        );

        expect(result._tag).toBe("Passed");
      })
    );

    it.effect(
      "round-trips schema-derived symbol identity parts through the encoded wire shape",
      Effect.fnUntraced(function* () {
        const result = yield* Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(SymbolIdentityParts)]),
          ([value]) =>
            Effect.gen(function* () {
              const encoded = yield* encodeSymbolIdentityParts(value);
              const decoded = yield* decodeSymbolIdentityParts(encoded);

              expect(decoded).toEqual(value);
              expect(yield* decodeSymbolId(makeSymbolId(decoded))).toBe(makeSymbolId(decoded));

              return true;
            }),
          { runs: 20 }
        );

        expect(result._tag).toBe("Passed");
      })
    );
  });

  describe("effectful transformations", () => {
    it.effect("derives content hashes from source text", () =>
      Effect.gen(function* () {
        const hash = yield* decodeContentHashFromSourceText("export const a = 1;\n");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }).pipe(provideScopedLayer(platformLayer))
    );
  });

  describe("runtime instance schemas", () => {
    it.effect(
      "accepts live ts-morph runtime instances and rejects plain objects",
      Effect.fnUntraced(function* () {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          "src/main.ts",
          "export class UserService { login(id: string) { return id; } }",
          { overwrite: true }
        );
        const classDeclaration = sourceFile.getClassOrThrow("UserService");

        expect(yield* decodeInternalProject(project)).toBe(project);
        expect(yield* decodeInternalSourceFile(sourceFile)).toBe(sourceFile);
        expect(yield* decodeInternalNode(classDeclaration)).toBe(classDeclaration);
        expect(Exit.isFailure(yield* Effect.exit(decodeInternalProject({})))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeInternalSourceFile({})))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeInternalNode({})))).toBe(true);
      })
    );
  });

  describe("symbol primitives", () => {
    it.effect(
      "accepts strict qualified names and exact kinds",
      Effect.fnUntraced(function* () {
        expect(yield* decodeSymbolQualifiedName("UserService")).toBe("UserService");
        expect(yield* decodeSymbolQualifiedName("UserService.login")).toBe("UserService.login");
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolQualifiedName("UserService.#login")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolQualifiedName("UserService.[Symbol.iterator]")))).toBe(
          true
        );

        expect(yield* decodeSymbolKind("MethodDeclaration")).toBe("MethodDeclaration");
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolKind("QualifiedName")))).toBe(true);
        expect(Exit.isFailure(yield* Effect.exit(decodeSymbolKind("Identifier")))).toBe(true);
      })
    );

    it.effect(
      "decodes every schema-derived SymbolId and round-trips it identically",
      Effect.fnUntraced(function* () {
        const arbitrary = Arbitrary.schema(SymbolId);
        const result = yield* Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([symbolId]) =>
            Effect.gen(function* () {
              const decoded = yield* decodeSymbolId(symbolId);
              expect(decoded).toBe(symbolId);
              expect(yield* decodeSymbolIdParts(symbolId)).toEqual([...(yield* decodeSymbolIdParts(decoded))]);

              return true;
            }),
          fcRuns(50)
        );

        expect(result._tag).toBe("Passed");
      })
    );

    it.effect(
      "builds normalized symbols with derived ids and categories",
      Effect.fnUntraced(function* () {
        const symbol = makeSymbol(baseSymbolInput);

        expect(symbol.id).toBe(
          makeSymbolId({
            filePath: yield* decodeSymbolFilePath("src/main.ts"),
            qualifiedName: yield* decodeSymbolQualifiedName("UserService.login"),
            kind: yield* decodeSymbolKind("MethodDeclaration"),
          })
        );
        expect(symbol.category).toBe(SymbolCategory.Enum.member);
        expect(
          (yield* decodeSymbol({
            id: "src/main.ts::UserService.login#MethodDeclaration",
            filePath: "src/main.ts",
            name: "login",
            qualifiedName: "UserService.login",
            kind: "MethodDeclaration",
            category: "member",
            signature: "login(id: string): User",
            docstring: null,
            summary: null,
            decorators: [],
            keywords: ["login"],
            parentId: null,
            startLine: 10,
            endLine: 18,
            byteOffset: 128,
            byteLength: 84,
            contentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          })).kind
        ).toBe("MethodDeclaration");
      })
    );
  });

  describe("request/result classes", () => {
    it.effect(
      "decodes project scope and file/source requests",
      Effect.fnUntraced(function* () {
        const baseSymbolEncoded = yield* encodeSymbol(baseSymbol);
        const request = yield* decodeTsMorphProjectScopeRequest({
          entrypoint: {
            _tag: "tsconfig",
            tsConfigPath: "packages/tooling/library/repo-utils/tsconfig.json",
          },
          repoRootPath: null,
          mode: "syntax",
          referencePolicy: "workspaceOnly",
        });

        expect(O.isNone(request.repoRootPath)).toBe(true);

        const scope = yield* decodeTsMorphProjectScope({
          scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
          cacheKey: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
          repoRootPath: "/repo/root",
          workspaceDirectoryPath: "/repo/root/packages/tooling/library/repo-utils",
          tsConfigPath: "packages/tooling/library/repo-utils/tsconfig.json",
          mode: "syntax",
          referencePolicy: "workspaceOnly",
        });

        expect(scope.scopeId).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");

        expect(
          (yield* decodeTsMorphFileOutline({
            scopeId: scope.scopeId,
            filePath: "src/main.ts",
            symbols: [baseSymbolEncoded],
          })).symbols
        ).toHaveLength(1);

        expect(
          (yield* decodeTsMorphSourceTextResult({
            filePath: "src/main.ts",
            sourceText: "export const a = 1;",
            contentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          })).filePath
        ).toBe("src/main.ts");
      })
    );

    it.effect(
      "decodes symbol lookup, search, source, and diagnostics results",
      Effect.fnUntraced(function* () {
        const baseSymbolEncoded = yield* encodeSymbol(baseSymbol);
        expect(yield* decodeSearchLimit(25)).toBe(25);
        expect(yield* decodeLineNumber(1)).toBe(1);
        expect(yield* decodeColumnNumber(2)).toBe(2);

        expect(
          (yield* decodeTsMorphSymbolLookupResult({
            scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
            symbol: baseSymbolEncoded,
          })).symbol.id
        ).toBe(baseSymbol.id);

        const searchRequest = yield* decodeTsMorphSymbolSearchRequest({
          scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
          query: "user",
          categories: ["member"],
          kinds: ["MethodDeclaration"],
          limit: 25,
        });

        expect(searchRequest.limit).toBe(25);

        expect(
          (yield* decodeTsMorphSymbolSearchResult({
            scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
            query: "user",
            limit: 25,
            symbols: [baseSymbolEncoded],
            total: 1,
          })).total
        ).toBe(1);

        expect(
          (yield* decodeTsMorphSymbolSourceResult({
            scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
            symbol: baseSymbolEncoded,
            sourceText: "login(id: string): User { return user; }",
            contentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          })).symbol.id
        ).toBe(baseSymbol.id);

        expect(
          (yield* decodeTsMorphDiagnostic({
            category: "error",
            code: 2322,
            message: "Type 'string' is not assignable to type 'number'.",
            source: null,
            startLine: 4,
            startColumn: 10,
            endLine: 4,
            endColumn: 16,
          })).category
        ).toBe("error");

        expect(
          (yield* decodeTsMorphDiagnosticsResult({
            scopeId: "packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly",
            filePath: "src/main.ts",
            diagnostics: [
              {
                category: "error",
                code: 2322,
                message: "Type 'string' is not assignable to type 'number'.",
                source: null,
                startLine: 4,
                startColumn: 10,
                endLine: 4,
                endColumn: 16,
              },
            ],
          })).diagnostics
        ).toHaveLength(1);
      })
    );
  });
});
