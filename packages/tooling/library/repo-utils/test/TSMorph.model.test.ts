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
  SymbolInit,
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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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

const baseSymbolInput = SymbolInit.make({
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
});

const baseSymbol = makeSymbol({
  ...baseSymbolInput,
  contentHash: baseSymbolInput.contentHash,
});

describe("TSMorph model taxonomy", () => {
  describe("path primitives", () => {
    it.effect(
      "accepts repo and workspace directory paths",
      Effect.fnUntraced(function* () {
        const decodedRepoRootPath = yield* decodeRepoRootPath("/repo/root");
        expect(decodedRepoRootPath).toBe("/repo/root");
        const decodedWorkspaceDirectoryPath = yield* decodeWorkspaceDirectoryPath(
          "/repo/root/packages/tooling/library/repo-utils"
        );
        expect(decodedWorkspaceDirectoryPath).toBe("/repo/root/packages/tooling/library/repo-utils");
      })
    );

    it.effect(
      "validates tsconfig file paths",
      Effect.fnUntraced(function* () {
        const decodedTsConfigFilePath = yield* decodeTsConfigFilePath(
          "packages/tooling/library/repo-utils/tsconfig.json"
        );
        expect(decodedTsConfigFilePath).toBe("packages/tooling/library/repo-utils/tsconfig.json");
        const decodedTsConfigFilePath1 = yield* decodeTsConfigFilePath("packages/foo/tsconfig.build.json");
        expect(decodedTsConfigFilePath1).toBe("packages/foo/tsconfig.build.json");
        (yield* Effect.exit(decodeTsConfigFilePath("packages/foo/tsconfig.ts"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeTsConfigFilePath("packages/foo/tsconfig#dev.json"))).pipe(Exit.isFailure, assertTrue);
      })
    );

    it.effect(
      "splits implementation and declaration TypeScript file paths strictly",
      Effect.fnUntraced(function* () {
        const decodedTypeScriptImplementationFilePath = yield* decodeTypeScriptImplementationFilePath("src/main.ts");
        expect(decodedTypeScriptImplementationFilePath).toBe("src/main.ts");
        const decodedTypeScriptImplementationFilePath2 =
          yield* decodeTypeScriptImplementationFilePath("src/component.tsx");
        expect(decodedTypeScriptImplementationFilePath2).toBe("src/component.tsx");
        const decodedTypeScriptImplementationFilePath3 =
          yield* decodeTypeScriptImplementationFilePath("src/module.mts");
        expect(decodedTypeScriptImplementationFilePath3).toBe("src/module.mts");
        (yield* Effect.exit(decodeTypeScriptImplementationFilePath("src/types.d.ts"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeTypeScriptImplementationFilePath("src/main.js"))).pipe(Exit.isFailure, assertTrue);

        const decodedTypeScriptDeclarationFilePath = yield* decodeTypeScriptDeclarationFilePath("src/types.d.ts");
        expect(decodedTypeScriptDeclarationFilePath).toBe("src/types.d.ts");
        const decodedTypeScriptDeclarationFilePath4 = yield* decodeTypeScriptDeclarationFilePath("src/types.d.mts");
        expect(decodedTypeScriptDeclarationFilePath4).toBe("src/types.d.mts");
        (yield* Effect.exit(decodeTypeScriptDeclarationFilePath("src/main.ts"))).pipe(Exit.isFailure, assertTrue);

        const decodedTypeScriptFilePath = yield* decodeTypeScriptFilePath("src/main.ts");
        expect(decodedTypeScriptFilePath).toBe("src/main.ts");
        const decodedTypeScriptFilePath5 = yield* decodeTypeScriptFilePath("src/types.d.ts");
        expect(decodedTypeScriptFilePath5).toBe("src/types.d.ts");
      })
    );

    it.effect(
      "keeps SymbolFilePath implementation-only and delimiter-safe",
      Effect.fnUntraced(function* () {
        const decodedSymbolFilePath = yield* decodeSymbolFilePath("src/main.ts");
        expect(decodedSymbolFilePath).toBe("src/main.ts");
        (yield* Effect.exit(decodeSymbolFilePath("src/types.d.ts"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeSymbolFilePath("src::main.ts"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeSymbolFilePath("src/main#one.ts"))).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  describe("pure transformations", () => {
    it.effect(
      "refines generic file paths into stricter TypeScript path schemas",
      Effect.fnUntraced(function* () {
        const decodedFilePathToTsConfigFilePath = yield* decodeFilePathToTsConfigFilePath(
          "packages/tooling/library/repo-utils/tsconfig.json"
        );
        expect(decodedFilePathToTsConfigFilePath).toBe("packages/tooling/library/repo-utils/tsconfig.json");
        const decodedFilePathToTypeScriptImplementationFilePath =
          yield* decodeFilePathToTypeScriptImplementationFilePath("src/main.ts");
        expect(decodedFilePathToTypeScriptImplementationFilePath).toBe("src/main.ts");
        const decodedFilePathToTypeScriptDeclarationFilePath =
          yield* decodeFilePathToTypeScriptDeclarationFilePath("src/types.d.ts");
        expect(decodedFilePathToTypeScriptDeclarationFilePath).toBe("src/types.d.ts");
        const decodedFilePathToTypeScriptFilePath = yield* decodeFilePathToTypeScriptFilePath("src/types.d.ts");
        expect(decodedFilePathToTypeScriptFilePath).toBe("src/types.d.ts");
        const decodedTypeScriptImplementationFilePathToSymbolFilePath =
          yield* decodeTypeScriptImplementationFilePathToSymbolFilePath("src/main.ts");
        expect(decodedTypeScriptImplementationFilePathToSymbolFilePath).toBe("src/main.ts");
      })
    );

    it.effect(
      "maps exact symbol kinds to coarse categories",
      Effect.fnUntraced(function* () {
        expect(symbolCategoryFromKind("FunctionDeclaration")).toBe(SymbolCategory.Enum.function);
        expect(symbolCategoryFromKind("Constructor")).toBe(SymbolCategory.Enum.member);
        expect(symbolCategoryFromKind("EnumDeclaration")).toBe(SymbolCategory.Enum.type);
        const decodedSymbolKindToCategory = yield* decodeSymbolKindToCategory("MethodDeclaration");
        expect(decodedSymbolKindToCategory).toBe("member");
        const decodedSymbolCategory = yield* decodeSymbolCategory("member");
        expect(decodedSymbolCategory).toBe("member");
      })
    );

    it.effect(
      "roundtrips symbol ids and scope ids through parsed tuple parts",
      Effect.fnUntraced(function* () {
        const symbolId = yield* decodeSymbolId("src/main.ts::UserService.login#MethodDeclaration");
        const decodedSymbolIdParts = yield* decodeSymbolIdParts(symbolId);
        expect(decodedSymbolIdParts).toEqual(["src/main.ts", "::", "UserService.login", "#", "MethodDeclaration"]);

        const scopeId = makeProjectScopeId(
          ProjectIdentityParts.make({
            tsConfigPath: yield* decodeTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json"),
            mode: TsMorphScopeMode.Enum.syntax,
            referencePolicy: TsMorphReferencePolicy.Enum.workspaceOnly,
          })
        );

        expect(scopeId).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
        const decodedProjectScopeId = yield* decodeProjectScopeId(scopeId);
        expect(decodedProjectScopeId).toBe(scopeId);
        const decodedProjectScopeIdParts = yield* decodeProjectScopeIdParts(scopeId);
        expect(decodedProjectScopeIdParts).toEqual([
          "packages/tooling/library/repo-utils/tsconfig.json",
          "::",
          "syntax",
          "#",
          "workspaceOnly",
        ]);
        expect(
          makeProjectCacheKey(
            ProjectIdentityParts.make({
              tsConfigPath: yield* decodeTsConfigFilePath("packages/tooling/library/repo-utils/tsconfig.json"),
              mode: TsMorphScopeMode.Enum.syntax,
              referencePolicy: TsMorphReferencePolicy.Enum.workspaceOnly,
            })
          )
        ).toBe("packages/tooling/library/repo-utils/tsconfig.json::syntax#workspaceOnly");
      })
    );

    it.effect.prop(
      "round-trips schema-derived project identity parts through the encoded wire shape",
      [Arbitrary.schema(ProjectIdentityParts)],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeProjectIdentityParts(value);
          const decoded = yield* decodeProjectIdentityParts(encoded);

          expect(decoded).toEqual(value);
          const decodedProjectScopeId6 = yield* decodeProjectScopeId(makeProjectScopeId(decoded));
          expect(decodedProjectScopeId6).toBe(makeProjectScopeId(decoded));

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect.prop(
      "round-trips schema-derived symbol identity parts through the encoded wire shape",
      [Arbitrary.schema(SymbolIdentityParts)],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeSymbolIdentityParts(value);
          const decoded = yield* decodeSymbolIdentityParts(encoded);

          expect(decoded).toEqual(value);
          const decodedSymbolId = yield* decodeSymbolId(makeSymbolId(decoded));
          expect(decodedSymbolId).toBe(makeSymbolId(decoded));

          return true;
        }),
      { arbitrary: fcRuns(20) }
    );
  });

  it.layer(NodeCrypto.layer, { timeout: "10 seconds" })("effectful transformations", (it) => {
    it.effect("derives content hashes from source text", () =>
      Effect.gen(function* () {
        const hash = yield* decodeContentHashFromSourceText("export const a = 1;\n");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      })
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

        const decodedInternalProject = yield* decodeInternalProject(project);
        expect(decodedInternalProject).toBe(project);
        const decodedInternalSourceFile = yield* decodeInternalSourceFile(sourceFile);
        expect(decodedInternalSourceFile).toBe(sourceFile);
        const decodedInternalNode = yield* decodeInternalNode(classDeclaration);
        expect(decodedInternalNode).toBe(classDeclaration);
        (yield* Effect.exit(decodeInternalProject({}))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeInternalSourceFile({}))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeInternalNode({}))).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  describe("symbol primitives", () => {
    it.effect(
      "accepts strict qualified names and exact kinds",
      Effect.fnUntraced(function* () {
        const decodedSymbolQualifiedName = yield* decodeSymbolQualifiedName("UserService");
        expect(decodedSymbolQualifiedName).toBe("UserService");
        const decodedSymbolQualifiedName7 = yield* decodeSymbolQualifiedName("UserService.login");
        expect(decodedSymbolQualifiedName7).toBe("UserService.login");
        (yield* Effect.exit(decodeSymbolQualifiedName("UserService.#login"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeSymbolQualifiedName("UserService.[Symbol.iterator]"))).pipe(
          Exit.isFailure,
          assertTrue
        );

        const decodedSymbolKind = yield* decodeSymbolKind("MethodDeclaration");
        expect(decodedSymbolKind).toBe("MethodDeclaration");
        (yield* Effect.exit(decodeSymbolKind("QualifiedName"))).pipe(Exit.isFailure, assertTrue);
        (yield* Effect.exit(decodeSymbolKind("Identifier"))).pipe(Exit.isFailure, assertTrue);
      })
    );

    it.effect.prop(
      "decodes every schema-derived SymbolId and round-trips it identically",
      [Arbitrary.schema(SymbolId)],
      ([symbolId]) =>
        Effect.gen(function* () {
          const decoded = yield* decodeSymbolId(symbolId);
          expect(decoded).toBe(symbolId);
          const decodedSymbolIdParts8 = yield* decodeSymbolIdParts(symbolId);
          expect(decodedSymbolIdParts8).toEqual([...(yield* decodeSymbolIdParts(decoded))]);

          return true;
        }),
      { arbitrary: fcRuns(50) }
    );

    it.effect(
      "builds normalized symbols with derived ids and categories",
      Effect.fnUntraced(function* () {
        const symbol = makeSymbol(baseSymbolInput);

        expect(symbol.id).toBe(
          makeSymbolId(
            SymbolIdentityParts.make({
              filePath: yield* decodeSymbolFilePath("src/main.ts"),
              qualifiedName: yield* decodeSymbolQualifiedName("UserService.login"),
              kind: yield* decodeSymbolKind("MethodDeclaration"),
            })
          )
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

        assertNone(request.repoRootPath);

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
        const decodedSearchLimit = yield* decodeSearchLimit(25);
        expect(decodedSearchLimit).toBe(25);
        const decodedLineNumber = yield* decodeLineNumber(1);
        expect(decodedLineNumber).toBe(1);
        const decodedColumnNumber = yield* decodeColumnNumber(2);
        expect(decodedColumnNumber).toBe(2);

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
