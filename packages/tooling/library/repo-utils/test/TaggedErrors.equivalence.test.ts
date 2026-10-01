import {
  CyclicDependencyError,
  DomainError,
  NoSuchFileError,
  ProjectScopeId,
  SymbolId,
  TsConfigFilePath,
  TsMorphProjectLoadError,
  TsMorphScopeResolutionError,
  TsMorphServiceUnavailableError,
  TsMorphSourceFileError,
  TsMorphSymbolNotFoundError,
  TsMorphUnsupportedFileError,
  TypeScriptImplementationFilePath,
} from "@beep/repo-utils";
import { OptionInjectionError } from "@beep/repo-utils/errors/OptionInjectionError";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { flow, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(schema: S.Schema<A>, a: A, b: A, different: A): void => {
  const same = S.toEquivalence(schema);

  assertTrue(same(a, b));
  assertFalse(same(a, different));
};

const decodeProjectScopeId = flow(S.decodeUnknownResult(ProjectScopeId), Result.getOrThrow);
const decodeSymbolId = flow(S.decodeUnknownResult(SymbolId), Result.getOrThrow);
const scopeId = decodeProjectScopeId("tsconfig.json::syntax#workspaceOnly");
const otherScopeId = decodeProjectScopeId("other/tsconfig.json::syntax#workspaceOnly");
const tsConfigPath = TsConfigFilePath.make("tsconfig.json");
const filePath = TypeScriptImplementationFilePath.make("src/example.ts");
const otherFilePath = TypeScriptImplementationFilePath.make("src/other.ts");
const symbolId = decodeSymbolId("src/example.ts::Example#ClassDeclaration");

describe("repo-utils declared-field equivalence", () => {
  it("compares TsMorphServiceUnavailableError by fields", () => {
    const a = TsMorphServiceUnavailableError.make({ method: "inspect", message: "unavailable" });
    const b = TsMorphServiceUnavailableError.make({ method: "inspect", message: "unavailable" });
    const different = TsMorphServiceUnavailableError.make({ method: "search", message: "unavailable" });

    expectDeclaredEquivalence(TsMorphServiceUnavailableError, a, b, different);
  });

  it("compares TsMorphScopeResolutionError by fields", () => {
    const a = TsMorphScopeResolutionError.make({ entrypoint: "tsconfig.json", message: "not found" });
    const b = TsMorphScopeResolutionError.make({ entrypoint: "tsconfig.json", message: "not found" });
    const different = TsMorphScopeResolutionError.make({ entrypoint: "other.json", message: "not found" });

    expectDeclaredEquivalence(TsMorphScopeResolutionError, a, b, different);
  });

  it("compares TsMorphProjectLoadError by fields", () => {
    const a = TsMorphProjectLoadError.make({ scopeId, tsConfigPath, message: "load failed" });
    const b = TsMorphProjectLoadError.make({ scopeId, tsConfigPath, message: "load failed" });
    const different = TsMorphProjectLoadError.make({ scopeId: otherScopeId, tsConfigPath, message: "load failed" });

    expectDeclaredEquivalence(TsMorphProjectLoadError, a, b, different);
  });

  it("compares TsMorphSourceFileError by fields", () => {
    const a = TsMorphSourceFileError.make({ scopeId: O.some(scopeId), filePath: O.some(filePath), message: "missing" });
    const b = TsMorphSourceFileError.make({ scopeId: O.some(scopeId), filePath: O.some(filePath), message: "missing" });
    const different = TsMorphSourceFileError.make({
      scopeId: O.some(scopeId),
      filePath: O.some(otherFilePath),
      message: "missing",
    });

    expectDeclaredEquivalence(TsMorphSourceFileError, a, b, different);
  });

  it("compares TsMorphSymbolNotFoundError by fields", () => {
    const a = TsMorphSymbolNotFoundError.make({ scopeId, symbolId, message: "missing" });
    const b = TsMorphSymbolNotFoundError.make({ scopeId, symbolId, message: "missing" });
    const different = TsMorphSymbolNotFoundError.make({ scopeId, symbolId, message: "different" });

    expectDeclaredEquivalence(TsMorphSymbolNotFoundError, a, b, different);
  });

  it("compares TsMorphUnsupportedFileError by fields", () => {
    const a = TsMorphUnsupportedFileError.make({ filePath, message: "unsupported" });
    const b = TsMorphUnsupportedFileError.make({ filePath, message: "unsupported" });
    const different = TsMorphUnsupportedFileError.make({ filePath: otherFilePath, message: "unsupported" });

    expectDeclaredEquivalence(TsMorphUnsupportedFileError, a, b, different);
  });

  it("compares CyclicDependencyError by fields", () => {
    const a = CyclicDependencyError.make({ message: "cycle", cycles: [["a", "b", "a"]] });
    const b = CyclicDependencyError.make({ message: "cycle", cycles: [["a", "b", "a"]] });
    const different = CyclicDependencyError.make({ message: "cycle", cycles: [["a", "c", "a"]] });

    expectDeclaredEquivalence(CyclicDependencyError, a, b, different);
  });

  it("compares DomainError by message and ignores cause", () => {
    const a = DomainError.make({ message: "failed", cause: "same cause" });
    const b = DomainError.make({ message: "failed", cause: "same cause" });
    const different = DomainError.make({ message: "different", cause: "same cause" });
    const differentCause = DomainError.make({ message: "failed", cause: "different cause" });

    expectDeclaredEquivalence(DomainError, a, b, different);
    expect(S.toEquivalence(DomainError)(a, differentCause)).toBe(true);
  });

  it("compares NoSuchFileError by fields", () => {
    const a = NoSuchFileError.make({ path: "/missing", message: "not found" });
    const b = NoSuchFileError.make({ path: "/missing", message: "not found" });
    const different = NoSuchFileError.make({ path: "/other", message: "not found" });

    expectDeclaredEquivalence(NoSuchFileError, a, b, different);
  });

  it("compares OptionInjectionError by fields", () => {
    const a = OptionInjectionError.make({ message: "unsafe", value: "--flag" });
    const b = OptionInjectionError.make({ message: "unsafe", value: "--flag" });
    const different = OptionInjectionError.make({ message: "unsafe", value: "--other" });

    expectDeclaredEquivalence(OptionInjectionError, a, b, different);
  });
});
