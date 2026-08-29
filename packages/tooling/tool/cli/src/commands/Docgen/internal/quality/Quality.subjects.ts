/**
 * Exported-symbol subject extraction for Docgen quality reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { parseComment } from "@beep/repo-docgen/Parser";
import { ContentHashFromSourceText, DomainError, findRepoRoot } from "@beep/repo-utils";
import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Duration, Effect, FileSystem, flow, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, Project } from "ts-morph";
import { boundedText, firstLine } from "../../../../internal/cli/Timing.ts";
import { escapeRegexChar, globPatternToRegExp } from "../../../../internal/GlobPattern.ts";
import { DocgenConfigDocument } from "../../Docgen.schemas.ts";
import { loadDocgenConfigDocument } from "../Workspace.ts";
import {
  DocgenQualityDiagnostic,
  DocgenQualityPackageStatus,
  DocgenQualitySubject,
  DocgenQualitySubjectCandidate,
} from "./Quality.schemas.ts";
import type { Diagnostic, JSDoc, SourceFile } from "ts-morph";
import type { DocgenWorkspacePackage } from "../../Docgen.schemas.ts";
import type { DocgenRelatedSymbol } from "./Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Docgen/internal/quality/Quality.subjects");

const decodeContentHashFromSourceText = S.decodeUnknownEffect(ContentHashFromSourceText);
const QUALITY_REQUIRED_EXPORT_TAGS = ["@category", "@example", "@since"] as const;
const QUALITY_REQUIRED_MODULE_TAGS = ["@since"] as const;

const QUALITY_TS_GLOBS = ["**/*.ts", "**/*.tsx"] as const;
const EXCLUDED_SOURCE_SEGMENTS = [
  "/.git/",
  "/.turbo/",
  "/build/",
  "/coverage/",
  "/dist/",
  "/docs/",
  "/node_modules/",
  "/test/",
  "/tests/",
] as const;
const EXCLUDED_SOURCE_SUFFIXES = [".stories.ts", ".stories.tsx"] as const;

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

/**
 * Wall-clock budget used while collecting package quality subjects.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { QualityRuntimeBudget } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 *
 * const budget = QualityRuntimeBudget.make({ startedAtMs: 0, timeoutMs: 1_000 })
 * console.log(budget.timeoutMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QualityRuntimeBudget extends S.Class<QualityRuntimeBudget>($I`QualityRuntimeBudget`)(
  {
    startedAtMs: S.Finite,
    timeoutMs: S.Finite,
  },
  $I.annote("QualityRuntimeBudget", {
    description: "Wall-clock budget used while collecting package quality subjects.",
  })
) {}

/**
 * Create a runtime budget from an Effect duration.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { makeRuntimeBudget } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 * import { Duration } from "effect"
 *
 * const budget = makeRuntimeBudget(Duration.seconds(1))
 * console.log(budget.timeoutMs)
 * ```
 *
 * @param timeout - Maximum allowed runtime.
 * @returns Runtime budget anchored to the current performance clock.
 * @category constructors
 * @since 0.0.0
 */
export const makeRuntimeBudget = (timeout: Duration.Duration): QualityRuntimeBudget =>
  QualityRuntimeBudget.make({
    startedAtMs: globalThis.performance.now(),
    timeoutMs: Duration.toMillis(timeout),
  });

/**
 * Read elapsed runtime for a quality-analysis budget.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { budgetDurationMs } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 *
 * console.log(budgetDurationMs({ startedAtMs: performance.now(), timeoutMs: 1_000 }) >= 0)
 * ```
 *
 * @param budget - Runtime budget created by `makeRuntimeBudget`.
 * @returns Elapsed milliseconds rounded for report stability.
 * @category getters
 * @since 0.0.0
 */
export const budgetDurationMs = (budget: QualityRuntimeBudget): number =>
  Math.max(0, Math.round(globalThis.performance.now() - budget.startedAtMs));

/**
 * Check whether a quality-analysis budget has expired.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { budgetExceeded } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 *
 * console.log(budgetExceeded({ startedAtMs: 0, timeoutMs: 0 }))
 * ```
 *
 * @param budget - Runtime budget to inspect.
 * @returns `true` when elapsed time is at least the configured timeout.
 * @category predicates
 * @since 0.0.0
 */
export const budgetExceeded = (budget: QualityRuntimeBudget): boolean => budgetDurationMs(budget) >= budget.timeoutMs;

/**
 * Format the package timeout diagnostic used in partial quality reports.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { packageTimeoutMessage } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * console.log(packageTimeoutMessage(target, { startedAtMs: 0, timeoutMs: 1_000 }))
 * console.log(packageTimeoutMessage({ startedAtMs: 0, timeoutMs: 1_000 })(target))
 * ```
 *
 * @param target - Workspace package being analyzed.
 * @param budget - Runtime budget that expired.
 * @returns Stable timeout message.
 * @category formatting
 * @since 0.0.0
 */
export const packageTimeoutMessage: {
  (target: DocgenWorkspacePackage, budget: QualityRuntimeBudget): string;
  (budget: QualityRuntimeBudget): (target: DocgenWorkspacePackage) => string;
} = dual(
  2,
  (target: DocgenWorkspacePackage, budget: QualityRuntimeBudget): string =>
    `Timed out after ${budget.timeoutMs}ms while analyzing ${target.relativePath}.`
);

const sourceFileMatchesExclude = (
  relativeFilePath: string,
  srcDir: string,
  exclude: ReadonlyArray<string> | undefined
): boolean => {
  const normalized = normalizeSlashes(relativeFilePath);

  if (Str.endsWith(".d.ts")(normalized)) {
    return true;
  }

  if (A.some(EXCLUDED_SOURCE_SUFFIXES, (suffix) => Str.endsWith(suffix)(normalized))) {
    return true;
  }

  if (A.some(EXCLUDED_SOURCE_SEGMENTS, (segment) => Str.includes(segment)(normalized))) {
    return true;
  }

  if (exclude === undefined) {
    return false;
  }

  const srcRelative = Str.startsWith(`${srcDir}/`)(normalized) ? Str.slice(srcDir.length + 1)(normalized) : normalized;

  return A.some(exclude, (pattern) =>
    A.some([normalized, srcRelative], (candidate) =>
      globPatternToRegExp(normalizeSlashes(Str.replace(/^\.\//, "")(pattern))).test(candidate)
    )
  );
};

const getJsDocs = (node: Node): ReadonlyArray<JSDoc> => {
  if (Node.isJSDocable(node)) {
    return node.getJsDocs();
  }

  if (Node.isVariableDeclaration(node)) {
    const statement = node.getVariableStatement();
    if (statement !== undefined) {
      return statement.getJsDocs();
    }
  }

  return A.empty();
};

const getLastJsDocText = (node: Node): string =>
  pipe(
    getJsDocs(node),
    A.last,
    O.map((doc) => doc.getText()),
    O.getOrElse(thunkEmptyStr)
  );

const getLeadingJsDocCommentText = (node: Node): string =>
  pipe(
    node.getLeadingCommentRanges(),
    A.filter((range) => Str.startsWith("/**")(range.getText())),
    A.last,
    O.map((range) => range.getText()),
    O.getOrElse(thunkEmptyStr)
  );

const getTopFileoverviewText = (sourceFile: SourceFile): string => {
  const match = /^\s*(\/\*\*[\s\S]*?\*\/)/.exec(sourceFile.getFullText());
  return match?.[1] ?? "";
};

const isFileoverviewJsDoc = (rawJsDoc: string): boolean => /@(packageDocumentation|fileoverview|file)\b/.test(rawJsDoc);

const isInternalJsDoc = (rawJsDoc: string): boolean => /@internal\b/.test(rawJsDoc);

const hasInternalJsDoc = (node: Node): boolean => A.some(getJsDocs(node), (doc) => isInternalJsDoc(doc.getText()));

const normalizeTags = (rawJsDoc: string): Record<string, ReadonlyArray<string>> => {
  if (Str.trim(rawJsDoc).length === 0) {
    return {};
  }

  const parsed = parseComment(rawJsDoc);
  return pipe(
    parsed.tags,
    R.map((value) => (value === undefined ? A.empty<string>() : A.fromIterable(value)))
  );
};

const tagValues = (tags: Record<string, ReadonlyArray<string>>, tagName: string): ReadonlyArray<string> =>
  tags[tagName] ?? A.empty<string>();

const hasTag = (tags: Record<string, ReadonlyArray<string>>, tagName: string): boolean =>
  R.has(tags, Str.replace(/^@/, "")(tagName));

const hasInheritDoc = (rawJsDoc: string): boolean => /\{@inheritDoc\s+[^}]+\}/.test(rawJsDoc);

const isSchemaCompanionTypeAlias = (exportName: string, declarationKind: string, signature: string): boolean =>
  declarationKind === "type" &&
  (new RegExp(
    `^export\\s+type\\s+${escapeRegexChar(exportName)}\\s+=\\s+typeof\\s+${escapeRegexChar(exportName)}\\.Type\\b`
  ).test(signature) ||
    new RegExp(
      `^export\\s+type\\s+${escapeRegexChar(exportName)}\\s+=\\s+\\w+\\.Schema\\.Type<\\s*typeof\\s+${escapeRegexChar(exportName)}\\s*>`
    ).test(signature));

const isCompanionNamespace = (exportName: string, declarationKind: string, signature: string): boolean =>
  declarationKind === "namespace" &&
  new RegExp(`^export\\s+declare\\s+namespace\\s+${escapeRegexChar(exportName)}\\b`).test(signature);

const isSchemaCompanionInterface = (exportName: string, declarationKind: string, signature: string): boolean =>
  declarationKind === "interface" &&
  new RegExp(`^export\\s+interface\\s+${escapeRegexChar(exportName)}\\b[\\s\\S]*\\bextends\\s+\\w+\\.`).test(signature);

const descriptionFromRawJsDoc = (rawJsDoc: string): string | null => {
  if (Str.trim(rawJsDoc).length === 0) {
    return null;
  }

  return parseComment(rawJsDoc).description ?? null;
};

const descriptionFromDeclarationSource = (declarationSource: string): string | null => {
  const match =
    /\bannote(?:Schema)?\([\s\S]*?\bdescription\s*:\s*"([^"]+)"/.exec(declarationSource) ??
    /\bannote(?:Schema)?\([\s\S]*?\bdescription\s*:\s*'([^']+)'/.exec(declarationSource);

  return match?.[1] ?? null;
};

const categoryIssueMessages = flow(
  A.map(normalizeJSDocCategory),
  A.filter((category) => category.status === "rejected" || category.status === "unknown"),
  A.map((category) => category.message ?? `Invalid @category value ${category.original}.`)
);

const missingRequiredTags = (kind: string, tags: Record<string, ReadonlyArray<string>>): ReadonlyArray<string> => {
  const requiredTags = kind === "module-fileoverview" ? QUALITY_REQUIRED_MODULE_TAGS : QUALITY_REQUIRED_EXPORT_TAGS;
  return A.filter(requiredTags, (tag) => !hasTag(tags, tag));
};

const effectiveMissingRequiredTags = (
  exportName: string,
  kind: string,
  signature: string,
  tags: Record<string, ReadonlyArray<string>>,
  rawJsDoc: string
): ReadonlyArray<string> => {
  const missingTags = missingRequiredTags(kind, tags);

  if (
    !hasInheritDoc(rawJsDoc) &&
    !isSchemaCompanionTypeAlias(exportName, kind, signature) &&
    !isCompanionNamespace(exportName, kind, signature) &&
    !isSchemaCompanionInterface(exportName, kind, signature)
  ) {
    return missingTags;
  }

  return A.filter(missingTags, (tag) => tag !== "@example");
};

const getExportKind = (node: Node): string => {
  if (Node.isFunctionDeclaration(node)) return "function";
  if (Node.isVariableDeclaration(node)) return "const";
  if (Node.isTypeAliasDeclaration(node)) return "type";
  if (Node.isInterfaceDeclaration(node)) return "interface";
  if (Node.isClassDeclaration(node)) return "class";
  if (Node.isModuleDeclaration(node)) return "namespace";
  if (Node.isEnumDeclaration(node)) return "enum";
  return "const";
};

type ExportedDeclarationCandidate = {
  readonly name: string;
  readonly declaration: Node;
  readonly anchorNode?: Node;
  readonly rawJsDoc?: string;
  readonly exportDeclarationText?: string;
};

type LocalDeclaration = {
  readonly name: string;
  readonly declaration: Node;
};

const collectLocalDeclarations = (sourceFile: SourceFile): ReadonlyArray<LocalDeclaration> => {
  let declarations = A.empty<LocalDeclaration>();

  for (const statement of sourceFile.getStatements()) {
    if (Node.isVariableStatement(statement)) {
      for (const declaration of statement.getDeclarations()) {
        declarations = A.append(declarations, {
          declaration,
          name: declaration.getName(),
        });
      }
      continue;
    }

    if (
      Node.isFunctionDeclaration(statement) ||
      Node.isClassDeclaration(statement) ||
      Node.isInterfaceDeclaration(statement) ||
      Node.isTypeAliasDeclaration(statement) ||
      Node.isEnumDeclaration(statement) ||
      Node.isModuleDeclaration(statement)
    ) {
      const name = statement.getName();

      if (name !== undefined) {
        declarations = A.append(declarations, {
          declaration: statement,
          name,
        });
      }
    }
  }

  return declarations;
};

const isDeclarationAlreadyExported = (declaration: Node): boolean => {
  if (Node.isVariableDeclaration(declaration)) {
    return declaration.getVariableStatement()?.isExported() ?? false;
  }

  return P.hasProperty(declaration, "isExported") && P.isFunction(declaration.isExported)
    ? declaration.isExported() === true
    : false;
};

const collectExportedDeclarationCandidates = (sourceFile: SourceFile): ReadonlyArray<ExportedDeclarationCandidate> => {
  let candidates = A.empty<ExportedDeclarationCandidate>();
  const localDeclarations = collectLocalDeclarations(sourceFile);
  const documentedOverloadNames = new Set<string>();
  for (const statement of sourceFile.getStatements()) {
    if (
      Node.isFunctionDeclaration(statement) &&
      statement.isOverload() &&
      Str.trim(getLastJsDocText(statement)).length > 0
    ) {
      const name = statement.getName();
      if (name !== undefined) {
        documentedOverloadNames.add(name);
      }
    }
  }

  for (const exportAssignment of sourceFile.getExportAssignments()) {
    if (exportAssignment.isExportEquals()) {
      continue;
    }

    const rawJsDoc = getLeadingJsDocCommentText(exportAssignment);
    const expression = exportAssignment.getExpression();
    const declarations = Node.isIdentifier(expression)
      ? pipe(
          localDeclarations,
          A.filter((entry) => entry.name === expression.getText()),
          A.filter((entry) => !isDeclarationAlreadyExported(entry.declaration)),
          A.map((entry) => entry.declaration)
        )
      : [expression];

    for (const declaration of declarations) {
      candidates = A.append(candidates, {
        name: "default",
        declaration,
        anchorNode: exportAssignment,
        ...(Str.trim(rawJsDoc).length > 0 ? { rawJsDoc } : {}),
        exportDeclarationText: boundedText(firstLine(exportAssignment.getText()), 240),
      });
    }
  }

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    if (exportDeclaration.getModuleSpecifierValue() !== undefined) {
      continue;
    }

    const rawJsDoc = getLeadingJsDocCommentText(exportDeclaration);

    for (const specifier of exportDeclaration.getNamedExports()) {
      const localName = specifier.getName();
      const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName();
      if (localName !== exportName) {
        continue;
      }
      const declarations = pipe(
        localDeclarations,
        A.filter((entry) => entry.name === localName),
        A.map((entry) => entry.declaration)
      );

      for (const declaration of declarations) {
        candidates = A.append(candidates, {
          name: exportName,
          declaration,
          anchorNode: exportDeclaration,
          ...(Str.trim(rawJsDoc).length > 0 ? { rawJsDoc } : {}),
          exportDeclarationText: boundedText(firstLine(exportDeclaration.getText()), 240),
        });
      }
    }
  }

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement)) {
      const name = statement.getName();
      const hasOwnDocs = Str.trim(getLastJsDocText(statement)).length > 0;
      if ((statement.isOverload() || !statement.hasBody()) && !hasOwnDocs) {
        continue;
      }
      if (name !== undefined && documentedOverloadNames.has(name) && !statement.isOverload() && !hasOwnDocs) {
        continue;
      }
    }

    if (Node.isVariableStatement(statement) && statement.isExported()) {
      for (const declaration of statement.getDeclarations()) {
        candidates = A.append(candidates, {
          name: declaration.getName(),
          declaration,
        });
      }
      continue;
    }

    if (
      (Node.isFunctionDeclaration(statement) ||
        Node.isClassDeclaration(statement) ||
        Node.isInterfaceDeclaration(statement) ||
        Node.isTypeAliasDeclaration(statement) ||
        Node.isEnumDeclaration(statement) ||
        Node.isModuleDeclaration(statement)) &&
      statement.isExported()
    ) {
      const name = statement.isDefaultExport() ? "default" : statement.getName();

      if (name !== undefined) {
        candidates = A.append(candidates, {
          name,
          declaration: statement,
        });
      }
    }
  }

  return A.dedupeWith(candidates, (left, right) => left.name === right.name && left.declaration === right.declaration);
};

const nodeLine = (node: Node): number => node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;

const signatureText = (node: Node): string => {
  const text = Node.isVariableDeclaration(node)
    ? (node.getVariableStatement()?.getText() ?? node.getText())
    : node.getText();
  return boundedText(firstLine(text), 240);
};

const declarationText = (node: Node): string =>
  boundedText(
    Node.isVariableDeclaration(node) ? (node.getVariableStatement()?.getText() ?? node.getText()) : node.getText(),
    2_000
  );

const diagnosticCategory = Match.type<number>().pipe(
  Match.withReturnType<string>(),
  Match.when(0, () => "warning"),
  Match.when(1, () => "error"),
  Match.when(2, () => "suggestion"),
  Match.when(3, () => "message"),
  Match.orElse(() => "unknown")
);

const diagnosticMessageText = (
  message:
    | string
    | {
        getMessageText: () => string;
      }
): string => (P.isString(message) ? message : message.getMessageText());

const collectDiagnostics = (
  diagnostics: ReadonlyArray<Diagnostic>,
  startLine: number,
  endLine: number
): ReadonlyArray<DocgenQualityDiagnostic> =>
  pipe(
    diagnostics,
    A.filter((diagnostic) => {
      const source = diagnostic.getSourceFile();
      const start = diagnostic.getStart();

      if (source === undefined || start === undefined) {
        return false;
      }

      const line = source.getLineAndColumnAtPos(start).line;
      return line >= startLine && line <= endLine;
    }),
    A.take(5),
    A.map((diagnostic) => {
      const source = diagnostic.getSourceFile();
      const start = diagnostic.getStart();
      const line = source === undefined || start === undefined ? startLine : source.getLineAndColumnAtPos(start).line;
      return DocgenQualityDiagnostic.make({
        category: diagnosticCategory(diagnostic.getCategory()),
        code: diagnostic.getCode(),
        line,
        message: diagnosticMessageText(diagnostic.getMessageText()),
      });
    })
  );

const makeSubjectCandidate = ({
  declarationKind,
  declarationSource,
  diagnostics,
  endLine,
  exportName,
  filePath,
  generatedDocSnippet,
  hashSourceText,
  line,
  packageName,
  packagePath,
  rawJsDoc,
  relatedSymbols,
  repoPath,
  signature,
}: {
  readonly declarationKind: string;
  readonly declarationSource: string;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly endLine: number;
  readonly exportName: string;
  readonly filePath: string;
  readonly generatedDocSnippet: string | null;
  readonly hashSourceText: string;
  readonly line: number;
  readonly packageName: string;
  readonly packagePath: string;
  readonly rawJsDoc: string;
  readonly relatedSymbols: ReadonlyArray<DocgenRelatedSymbol>;
  readonly repoPath: string;
  readonly signature: string;
}): DocgenQualitySubjectCandidate => {
  const tags = normalizeTags(rawJsDoc);
  const jsDocDescription = descriptionFromRawJsDoc(rawJsDoc);
  const categoryValues = tagValues(tags, "category");
  const identityStem = `${packageName}:${repoPath}:${declarationKind}:${exportName}`;
  return {
    packageName,
    packagePath,
    filePath,
    repoPath,
    sourceAnchor: `${repoPath}:${line}`,
    exportName,
    declarationKind,
    signature,
    declarationSource,
    rawJsDoc,
    description: jsDocDescription ?? descriptionFromDeclarationSource(declarationSource),
    tags,
    parsedExamples: tagValues(tags, "example"),
    generatedDocSnippet,
    identityStem,
    diagnostics: collectDiagnostics(diagnostics, line, endLine),
    relatedSymbols,
    deterministicMissingTags: effectiveMissingRequiredTags(exportName, declarationKind, signature, tags, rawJsDoc),
    categoryValues,
    categoryIssues: categoryIssueMessages(categoryValues),
    hashSourceText: A.join([packageName, repoPath, declarationKind, exportName, hashSourceText], "\n"),
  };
};

const isInterestingSourceFile = (
  target: DocgenWorkspacePackage,
  sourceFile: SourceFile,
  srcDir: string,
  exclude: ReadonlyArray<string> | undefined,
  path: Path.Path
): boolean => {
  const absoluteFilePath = normalizeSlashes(sourceFile.getFilePath());
  const absolutePackagePath = normalizeSlashes(target.absolutePath);

  if (!Str.startsWith(`${absolutePackagePath}/`)(absoluteFilePath)) {
    return false;
  }

  const relativeFilePath = normalizeSlashes(path.relative(target.absolutePath, sourceFile.getFilePath()));
  return Str.startsWith(`${srcDir}/`)(relativeFilePath) && !sourceFileMatchesExclude(relativeFilePath, srcDir, exclude);
};

const collectModuleSubject = ({
  diagnostics,
  filePath,
  generatedDocSnippet,
  packageName,
  packagePath,
  repoPath,
  sourceFile,
}: {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly filePath: string;
  readonly generatedDocSnippet: string | null;
  readonly packageName: string;
  readonly packagePath: string;
  readonly repoPath: string;
  readonly sourceFile: SourceFile;
}): O.Option<DocgenQualitySubjectCandidate> => {
  const rawJsDoc = getTopFileoverviewText(sourceFile);

  if (Str.trim(rawJsDoc).length === 0 || !isFileoverviewJsDoc(rawJsDoc)) {
    return O.none();
  }

  return O.some(
    makeSubjectCandidate({
      declarationKind: "module-fileoverview",
      declarationSource: rawJsDoc,
      diagnostics,
      endLine: 1,
      exportName: "<module fileoverview>",
      filePath,
      generatedDocSnippet,
      hashSourceText: `${rawJsDoc}\n${repoPath}`,
      line: 1,
      packageName,
      packagePath,
      rawJsDoc,
      relatedSymbols: A.empty(),
      repoPath,
      signature: `module ${repoPath}`,
    })
  );
};

// Re-export declarations are permanent export graph edges, not owner
// declarations for quality scoring. The owning declaration remains the subject.
const collectReExportSubjects = A.empty;

const collectDirectExportSubjects = ({
  diagnostics,
  filePath,
  generatedDocSnippet,
  packageName,
  packagePath,
  repoPath,
  sourceFile,
}: {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly filePath: string;
  readonly generatedDocSnippet: string | null;
  readonly packageName: string;
  readonly packagePath: string;
  readonly repoPath: string;
  readonly sourceFile: SourceFile;
}): ReadonlyArray<DocgenQualitySubjectCandidate> => {
  let subjects = A.empty<DocgenQualitySubjectCandidate>();

  for (const candidate of collectExportedDeclarationCandidates(sourceFile)) {
    const { declaration, name: exportName } = candidate;
    const declarationJsDoc = getLastJsDocText(declaration);
    const rawJsDoc = Str.trim(declarationJsDoc).length > 0 ? declarationJsDoc : (candidate.rawJsDoc ?? "");
    if (isInternalJsDoc(rawJsDoc) || hasInternalJsDoc(declaration)) {
      continue;
    }
    const line = nodeLine(candidate.anchorNode ?? declaration);
    const declarationSource = declarationText(declaration);

    subjects = A.append(
      subjects,
      makeSubjectCandidate({
        declarationKind: getExportKind(declaration),
        declarationSource,
        diagnostics,
        endLine: sourceFile.getLineAndColumnAtPos(declaration.getEnd()).line,
        exportName,
        filePath,
        generatedDocSnippet,
        hashSourceText: `${rawJsDoc}\n${declarationSource}\n${candidate.exportDeclarationText ?? ""}`,
        line,
        packageName,
        packagePath,
        rawJsDoc,
        relatedSymbols: A.empty(),
        repoPath,
        signature: signatureText(declaration),
      })
    );
  }

  return subjects;
};

const generatedDocSnippetForFile = Effect.fn("DocgenQuality.generatedDocSnippetForFile")(function* (
  target: DocgenWorkspacePackage,
  sourceFilePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const moduleName = Str.replace(/\.(tsx?|mts|cts)$/, ".md")(sourceFilePath);
  const docPath = path.join(target.absolutePath, "docs", "modules", moduleName);
  const exists = yield* fs.exists(docPath);

  if (!exists) {
    return null;
  }

  const content = yield* fs.readFileString(docPath);
  return boundedText(content, 1_000);
});

/**
 * Finalize a quality subject candidate with a stable content hash identity.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { finalizeSubject } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(finalizeSubject)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param candidate - Subject candidate collected from a source declaration.
 * @returns Fully identified quality subject.
 * @effects Hashes the candidate source text and maps hash failures to `DomainError`.
 * @category workflows
 * @since 0.0.0
 */
export const finalizeSubject = Effect.fn("DocgenQuality.finalizeSubject")(function* (
  candidate: DocgenQualitySubjectCandidate
) {
  const contentHash = yield* decodeContentHashFromSourceText(candidate.hashSourceText).pipe(
    Effect.mapError(DomainError.newCause("Failed to compute JSDoc quality subject hash."))
  );
  const { hashSourceText: _hashSourceText, identityStem, ...subject } = candidate;
  void _hashSourceText;
  return DocgenQualitySubject.make({
    ...subject,
    stableIdentity: `${identityStem}:${Str.slice(0, 12)(contentHash)}`,
    contentHash,
  });
});

/**
 * Result of collecting package subject candidates for docgen quality analysis.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { PackageSubjectCandidateResult } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 *
 * const result = PackageSubjectCandidateResult.make({
 *   candidates: [],
 *   error: null,
 *   status: "completed",
 *   timedOut: false
 * })
 * console.log(result.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageSubjectCandidateResult extends S.Class<PackageSubjectCandidateResult>(
  $I`PackageSubjectCandidateResult`
)(
  {
    candidates: S.Array(DocgenQualitySubjectCandidate),
    error: S.NullOr(S.String),
    status: DocgenQualityPackageStatus,
    timedOut: S.Boolean,
  },
  $I.annote("PackageSubjectCandidateResult", {
    description: "Result of collecting package subject candidates for docgen quality analysis",
  })
) {}

/**
 * Collect exported-symbol JSDoc subject candidates for one package.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { collectPackageSubjectCandidates } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(collectPackageSubjectCandidates)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param target - Workspace package to inspect.
 * @param budget - Runtime budget for the collection pass.
 * @returns Candidate collection result with partial status when the budget expires.
 * @effects Reads package configuration and TypeScript source files.
 * @category workflows
 * @since 0.0.0
 */
export const collectPackageSubjectCandidates = Effect.fn("DocgenQuality.collectPackageSubjectCandidates")(function* (
  target: DocgenWorkspacePackage,
  budget: QualityRuntimeBudget
) {
  const path = yield* Path.Path;
  const config = target.hasDocgenConfig
    ? yield* loadDocgenConfigDocument(target.absolutePath)
    : DocgenConfigDocument.make({
        srcDir: "src",
        exclude: A.empty(),
      });
  const repoRoot = yield* findRepoRoot();
  const srcDir = config.srcDir ?? "src";
  const exclude = config.exclude;
  const sourceFileGlobs = pipe(
    QUALITY_TS_GLOBS,
    A.map((glob) => normalizeSlashes(path.join(target.absolutePath, srcDir, glob)))
  );
  return yield* Effect.try({
    try: () => {
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
      });
      project.addSourceFilesAtPaths([...sourceFileGlobs]);
      let subjects = A.empty<DocgenQualitySubjectCandidate>();

      for (const sourceFile of project.getSourceFiles()) {
        if (budgetExceeded(budget)) {
          return {
            candidates: subjects,
            error: packageTimeoutMessage(target, budget),
            status: "partial" as const,
            timedOut: true,
          } satisfies PackageSubjectCandidateResult;
        }

        if (!isInterestingSourceFile(target, sourceFile, srcDir, exclude, path)) {
          continue;
        }

        const filePath = normalizeSlashes(path.relative(target.absolutePath, sourceFile.getFilePath()));
        const repoPath = normalizeSlashes(path.relative(repoRoot, sourceFile.getFilePath()));
        const payload = {
          diagnostics: A.empty<Diagnostic>(),
          filePath,
          generatedDocSnippet: null,
          packageName: target.name,
          packagePath: target.relativePath,
          repoPath,
          sourceFile,
        };

        subjects = [
          ...subjects,
          ...pipe(
            collectModuleSubject(payload),
            O.match({
              onNone: A.empty,
              onSome: (subject) => [subject],
            })
          ),
          ...collectReExportSubjects(),
          ...collectDirectExportSubjects(payload),
        ];
      }

      return {
        candidates: subjects,
        error: null,
        status: "completed" as const,
        timedOut: false,
      } satisfies PackageSubjectCandidateResult;
    },
    catch: DomainError.newCause(`Failed to inspect ${target.relativePath} source files for JSDoc quality.`),
  });
});

/**
 * Attach generated-doc snippets to finalized quality subjects.
 *
 * **Example** (Collect docgen quality subjects)
 *
 * ```ts
 * import { withGeneratedDocSnippets } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.subjects"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(withGeneratedDocSnippets)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param target - Workspace package that owns the subjects.
 * @param subjects - Finalized quality subjects to enrich.
 * @returns Subjects with generated Markdown snippets when available.
 * @effects Reads generated docs from the package `docs/modules` tree.
 * @category workflows
 * @since 0.0.0
 */
export const withGeneratedDocSnippets = Effect.fn("DocgenQuality.withGeneratedDocSnippets")(function* (
  target: DocgenWorkspacePackage,
  subjects: ReadonlyArray<DocgenQualitySubject>
) {
  const snippets = yield* Effect.forEach(
    pipe(
      subjects,
      A.map((subject) => subject.filePath),
      A.dedupe,
      A.sort(Order.String)
    ),
    (filePath) =>
      generatedDocSnippetForFile(target, filePath).pipe(
        Effect.map((snippet) => ({
          filePath,
          snippet,
        }))
      ),
    { concurrency: 4 }
  );
  return A.map(subjects, (subject) => {
    const snippet = pipe(
      snippets,
      A.findFirst((candidate) => candidate.filePath === subject.filePath),
      O.map((candidate) => candidate.snippet),
      O.getOrElse(() => subject.generatedDocSnippet)
    );
    return snippet === subject.generatedDocSnippet
      ? subject
      : DocgenQualitySubject.make({
          ...subject,
          generatedDocSnippet: snippet,
        });
  });
});
