import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str, thunkFalse } from "@beep/utils";
import { DateTime, Effect, FileSystem, MutableHashMap, MutableHashSet, Path } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import { formatJsonc } from "../../../internal/artifacts/index.ts";
import { createInMemoryTsMorphProject, leadingJsDocText, topFileoverview } from "../../../internal/tsmorph/index.ts";
import {
  declarationKind,
  defaultRepoRoot,
  discoverWorkspacePackages,
  escapeRegExp,
  getDocNode,
  getJsDocText,
  JsonRecord,
  listSourceFiles,
  normalizeSlashes,
  QualityArtifactGeneratorError,
  readJsonc,
  repoRelative,
  stripCommentFraming,
  summaryFromComment,
  tagsFromComment,
  topoSortPackageNames,
  valuesForTag,
} from "./QualityArtifactSupport.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { SourceFile } from "ts-morph";
import type { WorkspacePackageInfo } from "./QualityArtifactSupport.ts";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocDocumentationInventory");

type DocumentationIssue = {
  readonly rule: string;
  readonly detail?: string;
  readonly lineOffset?: number;
  readonly text?: string;
  readonly example?: number;
};

type InventoryEntry = JsonRecord & {
  readonly remediationStatus: "open" | "resolved";
  readonly missingSummary: boolean;
  readonly missingRequiredTags: ReadonlyArray<string>;
  readonly forbiddenTags: ReadonlyArray<string>;
  readonly malformedConditionalTags: ReadonlyArray<DocumentationIssue>;
  readonly exampleImportViolations: ReadonlyArray<DocumentationIssue>;
  readonly unsafeExampleViolations: ReadonlyArray<DocumentationIssue>;
  readonly schemaAnnotationGaps: ReadonlyArray<DocumentationIssue>;
  readonly categoryViolations: ReadonlyArray<DocumentationIssue>;
};

type PackageInventory = JsonRecord & {
  readonly packageName: string;
  readonly packagePath: string;
  readonly topoOrder: number;
  readonly status: string;
  readonly sourceCoverage: JsonRecord & {
    readonly publicModuleCount: number;
    readonly publicExportCount: number;
  };
  readonly docgenCoverage: JsonRecord;
  readonly counts: JsonRecord & {
    readonly openModules: number;
    readonly openExports: number;
    readonly missingExportExamples: number;
    readonly missingExportCategories: number;
    readonly missingExportSince: number;
    readonly missingExportSummaries: number;
    readonly forbiddenTagFindings: number;
    readonly malformedConditionalTagFindings: number;
    readonly exampleImportFindings: number;
    readonly unsafeExampleFindings: number;
    readonly schemaAnnotationFindings: number;
  };
  readonly modules: ReadonlyArray<InventoryEntry>;
  readonly exports: ReadonlyArray<InventoryEntry>;
};

type RootPolicyInventory = JsonRecord & {
  readonly filePath: string;
  readonly customTags: ReadonlyArray<{
    readonly tagName: string;
    readonly status: string;
    readonly missing: ReadonlyArray<string>;
  }>;
  readonly status: string;
};

type Inventory = JsonRecord & {
  readonly generatedAt: string;
  readonly totals: JsonRecord;
  readonly rootPolicy: RootPolicyInventory;
  readonly packages: ReadonlyArray<PackageInventory>;
};

type DirectExportDescriptor =
  | {
      readonly key: string;
      readonly analysis: InventoryEntry;
      readonly name?: never;
      readonly declaration?: never;
    }
  | {
      readonly key: string;
      readonly analysis?: never;
      readonly name: string;
      readonly declaration: Node;
    };

const outputJsonRelativePath = "standards/jsdoc-documentation.inventory.jsonc";
const outputMarkdownRelativePath = "standards/jsdoc-documentation.inventory.md";
const requiredExportTags = ["@example", "@category", "@since"];
const requiredModuleTags = ["@since"];
const forbiddenTags = ["@module", "@template"];
const requiredTsdocCustomTags = ["@effects", "@precondition", "@postcondition", "@invariant"];

const JSDocInventoryDirectoryPath = S.String.pipe(
  $I.annoteSchema("JSDocInventoryDirectoryPath", {
    description: "Directory path used while building JSDoc documentation inventory artifacts.",
  })
);
const JSDocInventoryOutputPath = S.String.pipe(
  $I.annoteSchema("JSDocInventoryOutputPath", {
    description: "Output file path used by JSDoc documentation inventory artifacts.",
  })
);
const JSDocInventoryGeneratedAt = S.String.pipe(
  $I.annoteSchema("JSDocInventoryGeneratedAt", {
    description: "ISO timestamp recorded on generated JSDoc documentation inventory artifacts.",
  })
);

/**
 * Options for building or writing the JSDoc documentation inventory.
 *
 * @category configuration
 * @since 0.0.0
 */
export class JSDocDocumentationInventoryOptions extends S.Class<JSDocDocumentationInventoryOptions>(
  $I`JSDocDocumentationInventoryOptions`
)(
  {
    rootDir: S.optionalKey(JSDocInventoryDirectoryPath),
    outputJsonPath: S.optionalKey(JSDocInventoryOutputPath),
    outputMarkdownPath: S.optionalKey(JSDocInventoryOutputPath),
    generatedAt: S.optionalKey(JSDocInventoryGeneratedAt),
  },
  $I.annote("JSDocDocumentationInventoryOptions", {
    description: "Options for building or writing the JSDoc documentation inventory artifacts.",
  })
) {}

/**
 * Result returned after writing JSDoc inventory artifacts.
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDocumentationInventoryWriteResult extends S.Class<JSDocDocumentationInventoryWriteResult>(
  $I`JSDocDocumentationInventoryWriteResult`
)(
  {
    outputJsonPath: S.String,
    outputMarkdownPath: S.String,
    totals: JsonRecord,
  },
  $I.annote("JSDocDocumentationInventoryWriteResult", {
    description: "Output metadata returned after writing JSDoc documentation inventory artifacts.",
  })
) {}

const resolveJSDocInventoryOptions = Effect.fn("JSDocDocumentationInventory.resolveOptions")(function* (
  options: JSDocDocumentationInventoryOptions = {}
) {
  const path = yield* Path.Path;
  const repoRoot = options.rootDir ?? defaultRepoRoot;
  const generatedAt = options.generatedAt ?? (yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)));

  return {
    repoRoot,
    outputJsonPath: options.outputJsonPath ?? path.join(repoRoot, outputJsonRelativePath),
    outputMarkdownPath: options.outputMarkdownPath ?? path.join(repoRoot, outputMarkdownRelativePath),
    generatedAt,
  };
});

const markdownAnchor = (value: string): string =>
  Str.replace(/^-+|-+$/g, "")(Str.replace(/[^a-z0-9]+/g, "-")(Str.replace(/`/g, "")(Str.toLowerCase(value))));

const globPatternToRegExp = (pattern: string): RegExp => {
  const normalized = normalizeSlashes(Str.replace(/^\.\//, "")(pattern));
  let source = "^";
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];
    const next = normalized[index + 1];
    const afterNext = normalized[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      index += 1;
      continue;
    }

    source += escapeRegExp(char ?? "");
    index += 1;
  }

  return new RegExp(`${source}$`);
};

const packageSourceMatchesExclude = (
  packagePath: string,
  srcDir: string,
  sourceFilePath: string,
  pattern: string,
  path: Path.Path
): boolean => {
  const packageRelative = normalizeSlashes(path.relative(packagePath, sourceFilePath));
  const srcRelative = Str.startsWith(`${srcDir}/`)(packageRelative)
    ? Str.slice(srcDir.length + 1)(packageRelative)
    : packageRelative;
  const matcher = globPatternToRegExp(pattern);

  return matcher.test(packageRelative) || matcher.test(srcRelative);
};

const extractExamples = (commentText: string): ReadonlyArray<string> => {
  const cleaned = A.join(stripCommentFraming(commentText), "\n");
  const examples: Array<string> = [];
  const codeFencePattern = /```(?:ts|typescript)\s*\n([\s\S]*?)```/g;
  let match = codeFencePattern.exec(cleaned);

  while (match !== null) {
    A.appendInPlace(examples, match[1] ?? "");
    match = codeFencePattern.exec(cleaned);
  }

  return examples;
};

const missingRequiredTags = (
  presentTags: ReadonlyArray<string>,
  requiredTags: ReadonlyArray<string>
): ReadonlyArray<string> => requiredTags.filter((tag) => !presentTags.includes(tag));

const malformedConditionalTags = (commentText: string): ReadonlyArray<DocumentationIssue> => {
  const findings: Array<DocumentationIssue> = [];
  const lines = stripCommentFraming(commentText);

  for (const [index, line] of A.entries(lines)) {
    const lineNumber = index + 1;

    if (/^\s*@(?:param|returns|throws)\s+\{[^}]+}/.test(line)) {
      A.appendInPlace(findings, {
        rule: "no-type-braces-in-tags",
        lineOffset: lineNumber,
        text: Str.trim(line),
      });
    }

    if (/^\s*@(?:returns|throws)\s+-\s+/.test(line)) {
      A.appendInPlace(findings, {
        rule: "no-hyphen-after-returns-or-throws",
        lineOffset: lineNumber,
        text: Str.trim(line),
      });
    }

    if (/^\s*@deprecated\b/.test(line) && !Str.includes("{@link")(line)) {
      A.appendInPlace(findings, {
        rule: "deprecated-requires-link",
        lineOffset: lineNumber,
        text: Str.trim(line),
      });
    }
  }

  return findings;
};

const exampleImportViolations = (commentText: string): ReadonlyArray<DocumentationIssue> => {
  const violations: Array<DocumentationIssue> = [];
  const requiredNamespaceImports = [
    { module: "effect/Schema", alias: "S" },
    { module: "effect/Array", alias: "A" },
    { module: "effect/Option", alias: "O" },
    { module: "effect/Predicate", alias: "P" },
    { module: "effect/Record", alias: "R" },
  ];

  for (const [exampleIndex, example] of A.entries(extractExamples(commentText))) {
    if (/@effect\/schema/.test(example)) {
      A.appendInPlace(violations, {
        example: exampleIndex + 1,
        rule: "no-deprecated-effect-schema-import",
        detail: "Examples must import Schema APIs from effect/Schema, not @effect/schema.",
      });
    }

    for (const required of requiredNamespaceImports) {
      const namedImportPattern = new RegExp(
        `import\\s*\\{[^}]+\\}\\s*from\\s*["']${escapeRegExp(required.module)}["']`
      );
      const namespaceImportPattern = new RegExp(
        `import\\s*\\*\\s*as\\s+${required.alias}\\s*from\\s*["']${escapeRegExp(required.module)}["']`
      );

      if (namedImportPattern.test(example)) {
        A.appendInPlace(violations, {
          example: exampleIndex + 1,
          rule: "use-required-namespace-import",
          detail: `Use import * as ${required.alias} from "${required.module}".`,
        });
      }

      if (Str.includes(`from "${required.module}"`)(example) && !namespaceImportPattern.test(example)) {
        A.appendInPlace(violations, {
          example: exampleIndex + 1,
          rule: "wrong-required-namespace-alias",
          detail: `Examples importing ${required.module} must use the ${required.alias} namespace alias.`,
        });
      }
    }
  }

  return violations;
};

const importStatementTerminatorPattern = /from\s*["'][^"']*["']\s*;?\s*$/;
const bareImportStatementPattern = /^\s*import\s*["'][^"']*["']\s*;?\s*$/;

// Strips complete import statements — including multi-line named-import
// blocks (`import {\n  type X as Y,\n} from "mod"`) — rather than only lines
// that start with `import `, so continuation lines like `type X as Y,` never
// reach the no-type-assertions scan below (ruling R3-J3).
const stripImportStatements = (example: string): string => {
  const lines = Str.split(/\r?\n/)(example);
  const kept: Array<string> = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (bareImportStatementPattern.test(line)) {
      index += 1;
      continue;
    }
    if (/^\s*import\b/.test(line)) {
      let cursor = index;
      while (cursor < lines.length && !importStatementTerminatorPattern.test(lines[cursor] ?? "")) {
        cursor += 1;
      }
      index = cursor + 1;
      continue;
    }
    A.appendInPlace(kept, Str.trim(line));
    index += 1;
  }

  return A.join(kept, "\n");
};

const stringLiteralPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

// Removes single- and double-quoted string literal bodies before the
// declare/any/as-assertion scans below run — otherwise ordinary prose quoted
// inside an example (a fixture string containing the word "declare", a
// description string reading "... as Effect ...") false-positives as unsafe
// example content (rulings R20, R21).
const stripStringLiterals = (example: string): string => Str.replace(stringLiteralPattern, "")(example);

const unsafeExampleViolations = (commentText: string): ReadonlyArray<DocumentationIssue> => {
  const violations: Array<DocumentationIssue> = [];

  for (const [exampleIndex, example] of A.entries(extractExamples(commentText))) {
    const nonImportText = stripStringLiterals(stripImportStatements(example));

    if (/\bdeclare\b/.test(nonImportText)) {
      A.appendInPlace(violations, {
        example: exampleIndex + 1,
        rule: "no-declare-statements",
        detail: "Examples must be executable snippets, not declaration stubs.",
      });
    }

    if (/\bany\b/.test(nonImportText)) {
      A.appendInPlace(violations, {
        example: exampleIndex + 1,
        rule: "no-any-in-examples",
        detail: "Examples must not use any.",
      });
    }

    if (/\bas\s+(?:const|unknown|never|string|number|boolean|readonly|[A-Z_$({[])/.test(nonImportText)) {
      A.appendInPlace(violations, {
        example: exampleIndex + 1,
        rule: "no-type-assertions-in-examples",
        detail: "Examples must construct values through public APIs instead of type assertions.",
      });
    }
  }

  return violations;
};

const forbiddenTagsIn = (presentTags: ReadonlyArray<string>): ReadonlyArray<string> =>
  presentTags.filter((tag) => A.contains(forbiddenTags, tag));

const categoryViolations = (commentText: string): ReadonlyArray<DocumentationIssue> =>
  A.map(
    A.filter(valuesForTag(commentText, "@category"), (value) => /[A-Z]/.test(value)),
    (value) => ({
      rule: "category-must-be-lowercase",
      detail: value,
    })
  );

const decodeTrimmedString = S.decodeSync(S.Trim);

const textLooksLikeSchemaExport = (name: string, node: Node): boolean => {
  if (Str.startsWith("$")(name)) {
    return false;
  }
  if (Node.isClassDeclaration(node)) {
    const text = getDocNode(node).getText();
    return /\b(?:S\.Class|Model\.Class|TaggedErrorClass)\b/.test(text);
  }
  if (!Node.isVariableDeclaration(node)) {
    return false;
  }

  const initializer = decodeTrimmedString(node.getInitializer()?.getText() ?? "");
  return (
    /^(?:LiteralKit|TaggedErrorClass|DomainModel\.make|Table\.make)\s*\(/.test(initializer) ||
    /^S\.(?:String|Number|Boolean|BigInt|Symbol|Object|Unknown|Any|Never|Void|Null|Undefined|Date|Array|Record|Struct|Union|Literal|TemplateLiteral|Tuple|Class|Enums|OptionFrom|NullOr|TaggedStruct|TaggedError)(?:\s*(?:[({[;,]|$)|\.pipe\s*\()/.test(
      initializer
    )
  );
};

const schemaAnnotationGaps = (name: string, node: Node, sourceFile: SourceFile): ReadonlyArray<DocumentationIssue> => {
  if (!textLooksLikeSchemaExport(name, node)) {
    return [];
  }

  const gaps: Array<DocumentationIssue> = [];
  const text = getDocNode(node).getText();
  const hasAnnotation =
    /\$I\.annote(?:Schema)?\s*\(/.test(text) || /\.annotate\s*\(/.test(text) || /\bS\.annotate\s*\(/.test(text);

  if (!hasAnnotation) {
    A.appendInPlace(gaps, {
      rule: "missing-schema-annotation",
      detail: "Exported schemas should carry $I.annote or $I.annoteSchema metadata.",
    });
  }

  if (!Node.isClassDeclaration(node) && sourceFile.getTypeAlias(name) === undefined) {
    A.appendInPlace(gaps, {
      rule: "missing-schema-runtime-type-alias",
      detail: `Exported non-class schema ${name} should have an exported same-name runtime type alias.`,
    });
  }

  return gaps;
};

const analyzeModule = (
  sourceFile: SourceFile,
  packagePath: string,
  exportCount: number,
  repoRoot: string,
  path: Path.Path
): InventoryEntry => {
  const filePath = repoRelative(sourceFile.getFilePath(), repoRoot, path);
  const relativeFilePath = normalizeSlashes(path.relative(packagePath, sourceFile.getFilePath()));
  const fileoverview = O.getOrUndefined(topFileoverview(sourceFile));
  const presentTags = fileoverview === undefined ? [] : tagsFromComment(fileoverview);
  const missingTags = exportCount === 0 ? [] : missingRequiredTags(presentTags, requiredModuleTags);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = fileoverview === undefined ? exportCount > 0 : O.isNone(summaryFromComment(fileoverview));
  let docKind = "jsdoc";
  if (A.contains(presentTags, "@packageDocumentation")) {
    docKind = "packageDocumentation";
  } else if (A.contains(presentTags, "@module")) {
    docKind = "module";
  } else if (fileoverview === undefined) {
    docKind = "none";
  }
  const malformedTags = fileoverview === undefined ? [] : malformedConditionalTags(fileoverview);
  const categoryIssues = fileoverview === undefined ? [] : categoryViolations(fileoverview);
  const findingCount =
    missingTags.length + forbidden.length + malformedTags.length + categoryIssues.length + (missingSummary ? 1 : 0);

  return {
    docKind,
    filePath: relativeFilePath,
    repoPath: filePath,
    line: 1,
    anchor: markdownAnchor(`${filePath}-1-module`),
    currentTags: presentTags,
    missingRequiredTags: missingTags,
    forbiddenTags: forbidden,
    missingSummary,
    malformedConditionalTags: malformedTags,
    exampleImportViolations: [],
    unsafeExampleViolations: [],
    schemaAnnotationGaps: [],
    categoryViolations: categoryIssues,
    exportCount,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

const declarationLocationOf = (
  declaration: Node,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path
): { readonly filePath: string; readonly repoPath: string; readonly line: number } => ({
  filePath: normalizeSlashes(path.relative(packagePath, sourceFile.getFilePath())),
  repoPath: repoRelative(sourceFile.getFilePath(), repoRoot, path),
  line: declaration.getStartLineNumber(),
});

const analyzeExportDeclaration = (
  declaration: Node,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path
): InventoryEntry => {
  const commentText = `${leadingJsDocText(declaration)}\n${declaration.getText()}`;
  const presentTags = tagsFromComment(commentText);
  const { filePath, repoPath, line } = declarationLocationOf(declaration, sourceFile, packagePath, repoRoot, path);
  const malformedTags = malformedConditionalTags(commentText);
  const importIssues = exampleImportViolations(commentText);
  const unsafeIssues = unsafeExampleViolations(commentText);
  const categoryIssues = categoryViolations(commentText);
  const forbidden = forbiddenTagsIn(presentTags);
  // Re-export declarations are graph edges, not symbol-quality subjects
  // (.patterns/jsdoc-documentation.md:91-96; rulings R2, R5): exempt them from
  // requiredExportTags and missingSummary entirely instead of demanding fake
  // examples on a barrel.
  const missingTags: ReadonlyArray<string> = [];
  const missingSummary = false;
  const findingCount =
    missingTags.length +
    forbidden.length +
    malformedTags.length +
    importIssues.length +
    unsafeIssues.length +
    categoryIssues.length +
    (missingSummary ? 1 : 0);

  return {
    symbolName: declaration.getText(),
    exportKind: "re-export",
    filePath,
    repoPath,
    line,
    anchor: markdownAnchor(`${repoPath}-${line}-${declaration.getText()}`),
    currentTags: presentTags,
    missingRequiredTags: missingTags,
    forbiddenTags: forbidden,
    missingSummary,
    malformedConditionalTags: malformedTags,
    exampleImportViolations: importIssues,
    unsafeExampleViolations: unsafeIssues,
    schemaAnnotationGaps: [] as Array<DocumentationIssue>,
    categoryViolations: categoryIssues,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

const analyzeDirectExport = (
  name: string,
  declaration: Node,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path
): InventoryEntry => {
  const docText = getJsDocText(declaration);
  const presentTags = tagsFromComment(docText);
  const missingTags = missingRequiredTags(presentTags, requiredExportTags);
  const { filePath, repoPath, line } = declarationLocationOf(declaration, sourceFile, packagePath, repoRoot, path);
  const malformedTags = malformedConditionalTags(docText);
  const importIssues = exampleImportViolations(docText);
  const unsafeIssues = unsafeExampleViolations(docText);
  const categoryIssues = categoryViolations(docText);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = O.isNone(summaryFromComment(docText));
  const schemaGaps = schemaAnnotationGaps(name, declaration, sourceFile);
  const findingCount =
    missingTags.length +
    forbidden.length +
    malformedTags.length +
    importIssues.length +
    unsafeIssues.length +
    categoryIssues.length +
    schemaGaps.length +
    (missingSummary ? 1 : 0);

  return {
    symbolName: name,
    exportKind: declarationKind(declaration),
    filePath,
    repoPath,
    line,
    anchor: markdownAnchor(`${repoPath}-${line}-${name}`),
    currentTags: presentTags,
    missingRequiredTags: missingTags,
    forbiddenTags: forbidden,
    missingSummary,
    malformedConditionalTags: malformedTags,
    exampleImportViolations: importIssues,
    unsafeExampleViolations: unsafeIssues,
    schemaAnnotationGaps: schemaGaps,
    categoryViolations: categoryIssues,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

// R19: a function-overload group (one or more overload signatures plus the
// implementation, all sharing one exported name) scores as ONE unit — the
// group is anchored on whichever signature carries a doc block
// (conventionally the first; the implementation signature falls back when
// none does). .patterns/jsdoc-documentation.md is silent on overloads, and
// scoring every continuation signature and the implementation line
// independently meant no overload-bearing package could ever reach clean.
const anchorDeclarationForOverloadGroup = (declarations: A.NonEmptyReadonlyArray<Node>): Node => {
  const documented = A.filter(declarations, (declaration) => Str.isNonEmpty(getJsDocText(declaration)));
  return A.isReadonlyArrayNonEmpty(documented) ? A.headNonEmpty(documented) : A.headNonEmpty(declarations);
};

const analyzeFunctionOverloadGroup = (
  name: string,
  declarations: A.NonEmptyReadonlyArray<Node>,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path
): InventoryEntry => {
  const anchor = anchorDeclarationForOverloadGroup(declarations);
  const docText = getJsDocText(anchor);
  const presentTags = tagsFromComment(docText);
  const missingTags = missingRequiredTags(presentTags, requiredExportTags);
  const { filePath, repoPath, line } = declarationLocationOf(anchor, sourceFile, packagePath, repoRoot, path);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = O.isNone(summaryFromComment(docText));
  const schemaGaps = schemaAnnotationGaps(name, anchor, sourceFile);

  // Malformed/forbidden-tag checks apply to any doc block found on any
  // signature in the group, not only the anchor's — a stray malformed
  // comment on a non-anchor overload signature must still surface.
  const groupDocTexts = A.filter(A.map(declarations, getJsDocText), Str.isNonEmpty);
  const malformedTags = A.flatMap(groupDocTexts, malformedConditionalTags);
  const importIssues = A.flatMap(groupDocTexts, exampleImportViolations);
  const unsafeIssues = A.flatMap(groupDocTexts, unsafeExampleViolations);
  const categoryIssues = A.flatMap(groupDocTexts, categoryViolations);
  const findingCount =
    missingTags.length +
    forbidden.length +
    malformedTags.length +
    importIssues.length +
    unsafeIssues.length +
    categoryIssues.length +
    schemaGaps.length +
    (missingSummary ? 1 : 0);

  return {
    symbolName: name,
    exportKind: declarationKind(anchor),
    filePath,
    repoPath,
    line,
    anchor: markdownAnchor(`${repoPath}-${line}-${name}`),
    currentTags: presentTags,
    missingRequiredTags: missingTags,
    forbiddenTags: forbidden,
    missingSummary,
    malformedConditionalTags: malformedTags,
    exampleImportViolations: importIssues,
    unsafeExampleViolations: unsafeIssues,
    schemaAnnotationGaps: schemaGaps,
    categoryViolations: categoryIssues,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

const collectReExportDescriptors = (
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path,
  seen: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<DirectExportDescriptor> => {
  const descriptors: Array<DirectExportDescriptor> = [];
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration)) {
    if (declaration.getModuleSpecifierValue() === undefined) {
      continue;
    }
    const key = `re-export:${declaration.getStart()}`;
    MutableHashSet.add(seen, key);
    A.appendInPlace(descriptors, {
      key,
      analysis: analyzeExportDeclaration(declaration, sourceFile, packagePath, repoRoot, path),
    });
  }
  return descriptors;
};

// R19: one exported name can own more than one declaration only as a
// function-overload group (signatures + implementation) — everything else
// (a single declaration, or non-function duplicates) keeps the original
// per-declaration scoring.
const collectDirectExportDescriptorsForName = (
  name: string,
  ownDeclarations: A.NonEmptyReadonlyArray<Node>,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path,
  seen: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<DirectExportDescriptor> => {
  if (ownDeclarations.length > 1 && A.every(ownDeclarations, Node.isFunctionDeclaration)) {
    const key = `${name}:group:${A.headNonEmpty(ownDeclarations).getStart()}`;
    if (MutableHashSet.has(seen, key)) {
      return [];
    }
    MutableHashSet.add(seen, key);
    return [
      {
        key,
        analysis: analyzeFunctionOverloadGroup(name, ownDeclarations, sourceFile, packagePath, repoRoot, path),
      },
    ];
  }

  const descriptors: Array<DirectExportDescriptor> = [];
  for (const declaration of ownDeclarations) {
    const key = `${name}:${declaration.getStart()}`;
    if (MutableHashSet.has(seen, key)) {
      continue;
    }
    MutableHashSet.add(seen, key);
    A.appendInPlace(descriptors, { key, name, declaration });
  }
  return descriptors;
};

const exportedDeclarationsFor = (
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path
): ReadonlyArray<DirectExportDescriptor> => {
  const seen = MutableHashSet.empty<string>();
  const exports: Array<DirectExportDescriptor> = [
    ...collectReExportDescriptors(sourceFile, packagePath, repoRoot, path, seen),
  ];

  for (const [name, declarationsForName] of sourceFile.getExportedDeclarations()) {
    const ownDeclarations = A.filter(declarationsForName, (declaration) => declaration.getSourceFile() === sourceFile);
    if (!A.isReadonlyArrayNonEmpty(ownDeclarations)) {
      continue;
    }
    A.appendAllInPlace(
      exports,
      collectDirectExportDescriptorsForName(name, ownDeclarations, sourceFile, packagePath, repoRoot, path, seen)
    );
  }

  return exports;
};

const analyzePackage = Effect.fn("JSDocDocumentationInventory.analyzePackage")(function* (
  packageInfo: WorkspacePackageInfo,
  topoOrder: number,
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<PackageInventory, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const docgenPath = path.join(packageInfo.absolutePath, "docgen.json");
  const hasDocgenConfig = yield* fs.exists(docgenPath).pipe(Effect.orElseSucceed(thunkFalse));
  const docgenConfig = hasDocgenConfig ? yield* readJsonc(docgenPath) : {};
  const srcDir = P.isString(docgenConfig.srcDir) ? docgenConfig.srcDir : "src";
  const exclude = A.isArray(docgenConfig.exclude) ? A.filter(docgenConfig.exclude, P.isString) : [];
  const sourceRoot = path.join(packageInfo.absolutePath, srcDir);
  const sourceFiles = A.filter(
    yield* listSourceFiles(sourceRoot, path),
    (sourceFilePath) =>
      !A.some(exclude, (pattern) =>
        packageSourceMatchesExclude(packageInfo.absolutePath, srcDir, sourceFilePath, pattern, path)
      )
  );
  const project = createInMemoryTsMorphProject();
  const modules: Array<InventoryEntry> = [];
  const exports: Array<InventoryEntry> = [];

  for (const sourceFilePath of sourceFiles) {
    const sourceFile = project.addSourceFileAtPath(sourceFilePath);
    const packageExports: Array<InventoryEntry> = [];
    const directExports = exportedDeclarationsFor(sourceFile, packageInfo.absolutePath, repoRoot, path);

    for (const entry of directExports) {
      if (entry.analysis !== undefined) {
        A.appendInPlace(packageExports, {
          ...entry.analysis,
          filePath: normalizeSlashes(path.relative(packageInfo.absolutePath, sourceFile.getFilePath())),
          repoPath: repoRelative(sourceFile.getFilePath(), repoRoot, path),
        });
        continue;
      }
      A.appendInPlace(
        packageExports,
        analyzeDirectExport(entry.name, entry.declaration, sourceFile, packageInfo.absolutePath, repoRoot, path)
      );
    }

    if (packageExports.length > 0) {
      A.appendInPlace(
        modules,
        analyzeModule(sourceFile, packageInfo.absolutePath, packageExports.length, repoRoot, path)
      );
      A.appendAllInPlace(exports, packageExports);
    }
  }

  const openModuleCount = A.filter(modules, (entry) => entry.remediationStatus === "open").length;
  const openExportCount = A.filter(exports, (entry) => entry.remediationStatus === "open").length;
  let status = "needs-remediation";
  if (sourceFiles.length === 0 || (modules.length === 0 && exports.length === 0)) {
    status = "no-public-src-surface";
  } else if (openModuleCount + openExportCount === 0) {
    status = "clean";
  }

  return {
    packageName: packageInfo.name,
    packagePath: packageInfo.path,
    topoOrder,
    status,
    sourceCoverage: {
      srcDir,
      sourceFileCount: sourceFiles.length,
      publicModuleCount: modules.length,
      publicExportCount: exports.length,
    },
    docgenCoverage: {
      hasDocgenConfig,
      enforceDescriptions: docgenConfig.enforceDescriptions === true,
      enforceExamples: docgenConfig.enforceExamples === true,
      enforceVersion: docgenConfig.enforceVersion !== false,
    },
    counts: {
      openModules: openModuleCount,
      openExports: openExportCount,
      missingExportExamples: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@example")).length,
      missingExportCategories: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@category")).length,
      missingExportSince: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@since")).length,
      missingExportSummaries: A.filter(exports, (entry) => entry.missingSummary).length,
      forbiddenTagFindings:
        A.reduce(modules, 0, (total, entry) => total + entry.forbiddenTags.length) +
        A.reduce(exports, 0, (total, entry) => total + entry.forbiddenTags.length),
      malformedConditionalTagFindings:
        A.reduce(modules, 0, (total, entry) => total + entry.malformedConditionalTags.length) +
        A.reduce(exports, 0, (total, entry) => total + entry.malformedConditionalTags.length),
      exampleImportFindings: A.reduce(exports, 0, (total, entry) => total + entry.exampleImportViolations.length),
      unsafeExampleFindings: A.reduce(exports, 0, (total, entry) => total + entry.unsafeExampleViolations.length),
      schemaAnnotationFindings: A.reduce(exports, 0, (total, entry) => total + entry.schemaAnnotationGaps.length),
    },
    modules,
    exports,
  };
});

const analyzeMissingPackage = (packageName: string, topoOrder: number): PackageInventory => ({
  packageName,
  packagePath: "<unresolved>",
  topoOrder,
  status: "missing-workspace-metadata",
  sourceCoverage: {
    srcDir: "src",
    sourceFileCount: 0,
    publicModuleCount: 0,
    publicExportCount: 0,
  },
  docgenCoverage: {
    hasDocgenConfig: false,
    enforceDescriptions: false,
    enforceExamples: false,
    enforceVersion: false,
  },
  counts: {
    openModules: 0,
    openExports: 0,
    missingExportExamples: 0,
    missingExportCategories: 0,
    missingExportSince: 0,
    missingExportSummaries: 0,
    forbiddenTagFindings: 0,
    malformedConditionalTagFindings: 0,
    exampleImportFindings: 0,
    unsafeExampleFindings: 0,
    schemaAnnotationFindings: 0,
  },
  modules: [] as Array<InventoryEntry>,
  exports: [] as Array<InventoryEntry>,
});

const analyzeRootPolicy = Effect.fn("JSDocDocumentationInventory.analyzeRootPolicy")(function* (
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<RootPolicyInventory, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const tsdocPath = path.join(repoRoot, "tsdoc.json");
  const tsdoc = yield* readJsonc(tsdocPath);
  const tagDefinitions: Array<JsonRecord> = A.isArray(tsdoc.tagDefinitions)
    ? (tsdoc.tagDefinitions as Array<JsonRecord>)
    : [];
  const supportForTags: JsonRecord = (tsdoc.supportForTags ?? {}) as JsonRecord;

  const customTags = A.map(requiredTsdocCustomTags, (tagName) => {
    const hasDefinition = tagDefinitions.some((entry) => entry?.tagName === tagName);
    const hasSupport = supportForTags[tagName] === true;
    return {
      tagName,
      hasDefinition,
      hasSupport,
      status: hasDefinition && hasSupport ? "resolved" : "open",
      missing: [...(hasDefinition ? [] : ["tagDefinitions"]), ...(hasSupport ? [] : ["supportForTags"])],
    };
  });

  return {
    filePath: "tsdoc.json",
    requiredCustomTags: requiredTsdocCustomTags,
    customTags,
    status: A.every(customTags, (entry) => entry.status === "resolved") ? "resolved" : "open",
  };
});

const inventoryTotals = (packages: ReadonlyArray<PackageInventory>, rootPolicy: RootPolicyInventory) => {
  const openPackageCount = packages.filter((entry) => entry.status === "needs-remediation").length;
  return {
    packages: packages.length,
    cleanPackages: packages.filter((entry) => entry.status === "clean").length,
    packagesWithoutPublicSrcSurface: packages.filter((entry) => entry.status === "no-public-src-surface").length,
    packagesNeedingRemediation: openPackageCount,
    publicModules: packages.reduce((total, entry) => total + entry.sourceCoverage.publicModuleCount, 0),
    publicExports: packages.reduce((total, entry) => total + entry.sourceCoverage.publicExportCount, 0),
    openModules: packages.reduce((total, entry) => total + entry.counts.openModules, 0),
    openExports: packages.reduce((total, entry) => total + entry.counts.openExports, 0),
    missingExportExamples: packages.reduce((total, entry) => total + entry.counts.missingExportExamples, 0),
    missingExportCategories: packages.reduce((total, entry) => total + entry.counts.missingExportCategories, 0),
    missingExportSince: packages.reduce((total, entry) => total + entry.counts.missingExportSince, 0),
    forbiddenTagFindings: packages.reduce((total, entry) => total + entry.counts.forbiddenTagFindings, 0),
    malformedConditionalTagFindings: packages.reduce(
      (total, entry) => total + entry.counts.malformedConditionalTagFindings,
      0
    ),
    exampleImportFindings: packages.reduce((total, entry) => total + entry.counts.exampleImportFindings, 0),
    unsafeExampleFindings: packages.reduce((total, entry) => total + entry.counts.unsafeExampleFindings, 0),
    schemaAnnotationFindings: packages.reduce((total, entry) => total + entry.counts.schemaAnnotationFindings, 0),
    rootPolicyOpen: rootPolicy.status === "open" ? 1 : 0,
  };
};

const detailList = (entry: InventoryEntry): string => {
  const details: Array<string> = [];

  if (entry.missingSummary) {
    A.appendInPlace(details, "missing summary");
  }
  if (entry.missingRequiredTags.length > 0) {
    A.appendInPlace(details, `missing ${entry.missingRequiredTags.join(", ")}`);
  }
  if (entry.forbiddenTags.length > 0) {
    A.appendInPlace(details, `forbidden ${entry.forbiddenTags.join(", ")}`);
  }
  if (entry.malformedConditionalTags.length > 0) {
    A.appendInPlace(details, `${entry.malformedConditionalTags.length} malformed conditional tag(s)`);
  }
  if (entry.exampleImportViolations.length > 0) {
    A.appendInPlace(details, `${entry.exampleImportViolations.length} example import violation(s)`);
  }
  if (entry.unsafeExampleViolations.length > 0) {
    A.appendInPlace(details, `${entry.unsafeExampleViolations.length} unsafe example violation(s)`);
  }
  if (entry.schemaAnnotationGaps.length > 0) {
    A.appendInPlace(details, `${entry.schemaAnnotationGaps.length} schema annotation/type-alias gap(s)`);
  }
  if (entry.categoryViolations.length > 0) {
    A.appendInPlace(details, `${entry.categoryViolations.length} category casing violation(s)`);
  }

  return details.length === 0 ? "resolved" : A.join(details, "; ");
};

const renderMarkdown = (inventory: Inventory): string => {
  const lines: Array<string> = [];
  A.appendInPlace(lines, "# JSDoc Documentation Compliance Inventory");
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, `Generated: ${inventory.generatedAt}`);
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "## Scope");
  A.appendInPlace(lines, "");
  A.appendInPlace(
    lines,
    "The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: required export tags, summaries, TSDoc grammar, forbidden legacy tags, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps."
  );
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "## Totals");
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "| Metric | Count |");
  A.appendInPlace(lines, "|---|---:|");
  for (const [key, value] of R.toEntries(inventory.totals)) {
    A.appendInPlace(lines, `| ${key} | ${value} |`);
  }
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "## Root Policy");
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "| File | Tag | Status | Missing |");
  A.appendInPlace(lines, "|---|---|---|---|");
  for (const tag of inventory.rootPolicy.customTags) {
    A.appendInPlace(
      lines,
      `| ${inventory.rootPolicy.filePath} | \`${tag.tagName}\` | ${tag.status} | ${tag.missing.join(", ") || "none"} |`
    );
  }
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "## Package Summary");
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "| Order | Package | Path | Status | Modules | Exports | Open Modules | Open Exports |");
  A.appendInPlace(lines, "|---:|---|---|---|---:|---:|---:|---:|");
  for (const pkg of inventory.packages) {
    A.appendInPlace(
      lines,
      `| ${pkg.topoOrder} | \`${pkg.packageName}\` | \`${pkg.packagePath}\` | ${pkg.status} | ${pkg.sourceCoverage.publicModuleCount} | ${pkg.sourceCoverage.publicExportCount} | ${pkg.counts.openModules} | ${pkg.counts.openExports} |`
    );
  }
  A.appendInPlace(lines, "");
  A.appendInPlace(lines, "## Open Findings");

  for (const pkg of inventory.packages.filter((entry) => entry.status === "needs-remediation")) {
    A.appendInPlace(lines, "");
    A.appendInPlace(lines, `### ${pkg.packageName}`);
    A.appendInPlace(lines, "");
    A.appendInPlace(lines, `Path: \`${pkg.packagePath}\``);

    const openModules = pkg.modules.filter((entry) => entry.remediationStatus === "open");
    if (openModules.length > 0) {
      A.appendInPlace(lines, "");
      A.appendInPlace(lines, "Module findings:");
      for (const moduleEntry of openModules) {
        A.appendInPlace(
          lines,
          `- \`${moduleEntry.filePath}:${moduleEntry.line}\` (${moduleEntry.docKind}) - ${detailList(moduleEntry)}`
        );
      }
    }

    const openExports = pkg.exports.filter((entry) => entry.remediationStatus === "open");
    if (openExports.length > 0) {
      A.appendInPlace(lines, "");
      A.appendInPlace(lines, "Export findings:");
      for (const exportEntry of openExports) {
        A.appendInPlace(
          lines,
          `- \`${exportEntry.filePath}:${exportEntry.line}\` \`${exportEntry.symbolName}\` (${exportEntry.exportKind}) - ${detailList(exportEntry)}`
        );
      }
    }
  }

  return `${A.join(lines, "\n")}\n`;
};

/**
 * Build the deterministic JSDoc documentation inventory for a repository.
 *
 * @category generators
 * @since 0.0.0
 */
export const buildJSDocDocumentationInventory = Effect.fn("JSDocDocumentationInventory.build")(function* (
  options: JSDocDocumentationInventoryOptions = {}
): Effect.fn.Return<
  Inventory,
  QualityArtifactGeneratorError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const { generatedAt, repoRoot } = yield* resolveJSDocInventoryOptions(options);
  const packageByName = yield* discoverWorkspacePackages(repoRoot, path);
  const topoNames = yield* topoSortPackageNames(repoRoot, path);
  const rootPolicy = yield* analyzeRootPolicy(repoRoot, path);
  const packages = yield* Effect.forEach(
    topoNames,
    (packageName, index) => {
      const packageInfo = MutableHashMap.get(packageByName, packageName);
      return O.isNone(packageInfo)
        ? Effect.succeed(analyzeMissingPackage(packageName, index + 1))
        : analyzePackage(packageInfo.value, index + 1, repoRoot, path);
    },
    { concurrency: 1 }
  );

  return {
    standard: "jsdoc-documentation",
    version: 1,
    generatedAt,
    source: {
      packageUniverseCommand: "bun run topo-sort",
      generator: "bun run beep quality jsdoc-inventory",
      policy: ".patterns/jsdoc-documentation.md",
      skill: ".claude/skills/jsdoc-annotation-specialist/SKILL.md",
    },
    requiredExportTags,
    requiredModuleTags,
    forbiddenTags,
    rootPolicy,
    totals: inventoryTotals(packages, rootPolicy),
    packages,
  };
});

/**
 * Write JSDoc inventory JSONC and Markdown artifacts.
 *
 * @category generators
 * @since 0.0.0
 */
export const writeJSDocDocumentationInventory = Effect.fn("JSDocDocumentationInventory.write")(function* (
  options: JSDocDocumentationInventoryOptions = {}
): Effect.fn.Return<
  JSDocDocumentationInventoryWriteResult,
  QualityArtifactGeneratorError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { generatedAt, outputJsonPath, outputMarkdownPath, repoRoot } = yield* resolveJSDocInventoryOptions(options);
  const inventory = yield* buildJSDocDocumentationInventory({
    ...options,
    rootDir: repoRoot,
    generatedAt,
  });
  yield* fs.makeDirectory(path.dirname(outputJsonPath), { recursive: true }).pipe(
    QualityArtifactGeneratorError.mapError(`Failed to create artifact directory for ${outputJsonPath}.`, {
      filePath: outputJsonPath,
    })
  );
  const jsonContent = yield* formatJsonc(inventory).pipe(
    QualityArtifactGeneratorError.mapError("Failed to format generated JSONC artifact.", {})
  );
  yield* fs
    .writeFileString(outputJsonPath, jsonContent)
    .pipe(QualityArtifactGeneratorError.mapError(`Failed to write ${outputJsonPath}.`, { filePath: outputJsonPath }));
  yield* fs.writeFileString(outputMarkdownPath, renderMarkdown(inventory)).pipe(
    QualityArtifactGeneratorError.mapError(`Failed to write ${outputMarkdownPath}.`, {
      filePath: outputMarkdownPath,
    })
  );

  return {
    outputJsonPath,
    outputMarkdownPath,
    totals: inventory.totals,
  };
});
