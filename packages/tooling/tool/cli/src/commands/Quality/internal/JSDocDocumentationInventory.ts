import { $RepoCliId } from "@beep/identity/packages";
import { extractFencedCodeBlocks } from "@beep/repo-docgen/Core";
import { LiteralKit } from "@beep/schema";
import { A, O, Str, thunkFalse } from "@beep/utils";
import { DateTime, Effect, FileSystem, MutableHashMap, MutableHashSet, Path } from "effect";
import { pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import { formatJsonc } from "../../../internal/artifacts/index.ts";
import { isLabsWorkspacePath } from "../../../internal/cli/Labs/index.ts";
import { globPatternToRegExp as sharedGlobPatternToRegExp } from "../../../internal/GlobPattern.ts";
import {
  jsDocSectionBodyText,
  jsDocSectionOrder,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
} from "../../../internal/jsdoc/JSDocSections.ts";
import { runGitLines } from "../../../internal/repo-run/index.ts";
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
import type { JSDocSectionName } from "../../../internal/jsdoc/JSDocSections.ts";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/index.ts";
import type { WorkspacePackageInfo } from "./QualityArtifactSupport.ts";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocDocumentationInventory");

const JSDocDocumentationRuleCode = LiteralKit([
  "no-type-braces-in-tags",
  "no-hyphen-after-returns-or-throws",
  "deprecated-requires-link",
  "undescribed-see",
  "multiple-description-paragraphs",
  "leading-blank",
  "trailing-blank",
  "invalid-heading",
  "section-out-of-order",
  "duplicate-section",
  "empty-section",
  "section-after-example",
  "invalid-when-to-use-prefix",
  "malformed-example",
  "duplicate-example",
  "loose-ts-fence",
  "forbidden-remarks",
  "no-deprecated-effect-schema-import",
  "no-root-package-import",
  "use-required-namespace-import",
  "wrong-required-namespace-alias",
  "no-declare-statements",
  "no-any-in-examples",
  "no-type-assertions-in-examples",
  "category-must-be-lowercase",
  "missing-schema-annotation",
  "missing-schema-runtime-type-alias",
]).pipe(
  $I.annoteSchema("JSDocDocumentationRuleCode", {
    description: "Stable diagnostic codes emitted by the JSDoc documentation inventory.",
  })
);

type JSDocDocumentationRuleCode = typeof JSDocDocumentationRuleCode.Type;

const newDocumentationRuleCodes = JSDocDocumentationRuleCode.pickOptions([
  "undescribed-see",
  "multiple-description-paragraphs",
  "leading-blank",
  "trailing-blank",
  "invalid-heading",
  "section-out-of-order",
  "duplicate-section",
  "empty-section",
  "section-after-example",
  "invalid-when-to-use-prefix",
  "malformed-example",
  "duplicate-example",
  "loose-ts-fence",
  "forbidden-remarks",
  "no-root-package-import",
]);

/**
 * One JSDoc documentation finding produced by an inventory rule.
 *
 * **Example** (Construct a finding)
 *
 * ```ts
 * import { DocumentationIssue } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocumentationIssue)({ rule: "forbidden-remarks" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentationIssue = S.Struct({
  rule: JSDocDocumentationRuleCode,
  detail: S.String.pipe(S.UndefinedOr, S.optionalKey),
  lineOffset: S.Int.pipe(S.UndefinedOr, S.optionalKey),
  text: S.String.pipe(S.UndefinedOr, S.optionalKey),
  example: S.Int.pipe(S.UndefinedOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("DocumentationIssue", {
    description: "One JSDoc documentation finding produced by an inventory rule.",
  })
);

/**
 * One JSDoc documentation finding produced by an inventory rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentationIssue = typeof DocumentationIssue.Type;

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
  readonly documentationShapeViolations: ReadonlyArray<DocumentationIssue>;
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
    readonly documentationRuleFindings: JsonRecord;
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
/**
 * Default path for the human-readable JSDoc documentation inventory.
 *
 * **Example** (Resolve the companion inventory)
 *
 * ```ts
 * import { defaultJSDocDocumentationInventoryMarkdownPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocDocumentationInventoryMarkdownPath === "standards/jsdoc-documentation.inventory.md") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocDocumentationInventoryMarkdownPath = "standards/jsdoc-documentation.inventory.md";
const requiredExportTags = ["@example", "@category", "@since"];
const requiredModuleTags = ["@since"];
const forbiddenTags = ["@module", "@template"];
const requiredTsdocCustomTags = ["@effects", "@precondition", "@postcondition", "@invariant"];

const gitCommandErrorAdapter: GitCommandErrorAdapter<QualityArtifactGeneratorError> = {
  onSpawnFailure: (commandLine) => (cause) =>
    QualityArtifactGeneratorError.new(cause, `Failed to run ${commandLine}.`, { command: commandLine }),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    QualityArtifactGeneratorError.make({
      command: commandLine,
      exitCode,
      message: `${commandLine} failed:\n${output}`,
    }),
  onTruncated: O.none(),
};

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
    outputMarkdownPath:
      options.outputMarkdownPath ?? path.join(repoRoot, defaultJSDocDocumentationInventoryMarkdownPath),
    generatedAt,
  };
});

const markdownAnchor = (value: string): string =>
  Str.replace(/^-+|-+$/g, "")(Str.replace(/[^a-z0-9]+/g, "-")(Str.replace(/`/g, "")(Str.toLowerCase(value))));

const globPatternToRegExp = (pattern: string): RegExp =>
  sharedGlobPatternToRegExp(normalizeSlashes(Str.replace(/^\.\//, "")(pattern)));

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
  return A.map(extractFencedCodeBlocks(cleaned)[0], (example) => example.code);
};

const nonEmptyLines = (lines: ReadonlyArray<string>): ReadonlyArray<string> => A.filter(lines, Str.isNonEmpty);

const hasExampleCarrier = (commentText: string): boolean =>
  A.contains(tagsFromComment(commentText), "@example") ||
  A.some(
    parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText })).sections,
    (section) => section.name === "Example"
  );

const isPureTypeLevelExport = (declaration: Node): boolean =>
  Node.isTypeAliasDeclaration(declaration) ||
  Node.isInterfaceDeclaration(declaration) ||
  Node.isModuleDeclaration(declaration);

const missingRequiredExportTags = (
  declaration: Node,
  commentText: string,
  presentTags: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const requiredTags = isPureTypeLevelExport(declaration)
    ? A.filter(requiredExportTags, (tag) => tag !== "@example")
    : requiredExportTags;
  const effectiveTags = hasExampleCarrier(commentText) ? A.append(presentTags, "@example") : presentTags;
  return missingRequiredTags(effectiveTags, requiredTags);
};

/**
 * Score one JSDoc comment against the documentation section-shape rules.
 *
 * **Details**
 *
 * This is the exact scorer the JSDoc ratchet totals are built from, exported
 * within the package so the carrier-migration codemod can use it as a
 * per-block oracle: a rewrite is acceptable only when the finding set shrinks
 * or holds. It never becomes a cross-package public surface.
 *
 * **Example** (Score a legacy comment)
 *
 * ```ts
 * import { documentationShapeViolations } from "@beep/repo-cli/test/Quality"
 *
 * const findings = documentationShapeViolations("/** Lead.\n *\n * @remarks Detail. *" + "/")
 * console.log(findings.some((finding) => finding.rule === "forbidden-remarks")) // true
 * ```
 *
 * @param commentText - Raw JSDoc comment text to score.
 * @returns Shape findings for the comment, empty when compliant.
 * @category use-cases
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- this flat pass preserves the documented section-order state machine in one auditable rule boundary
export const documentationShapeViolations = (commentText: string): ReadonlyArray<DocumentationIssue> => {
  const findings: Array<DocumentationIssue> = [];
  const { bodyLines, sections } = parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText }));
  const hasNewStyleSections = A.isReadonlyArrayNonEmpty(sections);

  for (const value of valuesForTag(commentText, "@see")) {
    if (!/^\{@link\s+[^}]+}\s+\S/.test(value)) {
      A.appendInPlace(findings, { rule: "undescribed-see", detail: value });
    }
  }
  if (A.contains(tagsFromComment(commentText), "@remarks")) {
    A.appendInPlace(findings, { rule: "forbidden-remarks" });
  }

  const firstSectionLine = hasNewStyleSections ? A.headNonEmpty(sections).lineOffset - 1 : bodyLines.length;
  const leadWithSeparator = A.take(bodyLines, firstSectionLine);
  const lead = Str.isEmpty(Str.trim(leadWithSeparator[leadWithSeparator.length - 1] ?? ""))
    ? A.dropRight(leadWithSeparator, 1)
    : leadWithSeparator;
  if (Str.isEmpty(Str.trim(lead[0] ?? ""))) {
    A.appendInPlace(findings, { rule: "leading-blank" });
  }
  if (Str.isEmpty(Str.trim(lead[lead.length - 1] ?? ""))) {
    A.appendInPlace(findings, { rule: "trailing-blank" });
  }
  if (A.some(lead, (line) => /^\s*#{1,6}\s/.test(line))) {
    A.appendInPlace(findings, { rule: "invalid-heading" });
  }
  const trimmedLead = A.map(lead, Str.trim);
  if (A.some(A.drop(A.dropRight(trimmedLead, 1), 1), Str.isEmpty)) {
    A.appendInPlace(findings, { rule: "multiple-description-paragraphs" });
  }

  const seenSections = MutableHashSet.empty<JSDocSectionName>();
  const seenExampleTitles = MutableHashSet.empty<string>();
  let lastSectionOrder = -1;
  let exampleSeen = false;
  let exampleFenceCount = 0;

  for (const section of sections) {
    const bodyText = jsDocSectionBodyText(section);
    const meaningfulBody = nonEmptyLines(A.map(section.body, Str.trim));
    if (A.isReadonlyArrayEmpty(meaningfulBody)) {
      A.appendInPlace(findings, { rule: "empty-section", lineOffset: section.lineOffset, detail: section.name });
    }
    if (section.name === "Example") {
      exampleSeen = true;
      const fences = extractFencedCodeBlocks(bodyText)[0];
      exampleFenceCount += fences.length;
      const title = section.title ?? "";
      const hasEmptyFence = fences.length === 1 && Str.isEmpty(Str.trim(fences[0]?.code ?? ""));
      if (hasEmptyFence) {
        A.appendInPlace(findings, { rule: "empty-section", lineOffset: section.lineOffset, detail: section.name });
      }
      if (Str.isEmpty(title) || fences.length !== 1 || hasEmptyFence) {
        A.appendInPlace(findings, {
          rule: "malformed-example",
          lineOffset: section.lineOffset,
          detail: Str.isEmpty(title)
            ? "Example title is required."
            : hasEmptyFence
              ? "Example fence must contain code."
              : "Example must contain exactly one ts fence.",
        });
      }
      if (Str.isNonEmpty(title) && MutableHashSet.has(seenExampleTitles, title)) {
        A.appendInPlace(findings, { rule: "duplicate-example", lineOffset: section.lineOffset, detail: title });
      }
      MutableHashSet.add(seenExampleTitles, title);
      continue;
    }

    if (exampleSeen) {
      A.appendInPlace(findings, {
        rule: "section-after-example",
        lineOffset: section.lineOffset,
        detail: section.name,
      });
    }
    if (MutableHashSet.has(seenSections, section.name)) {
      A.appendInPlace(findings, { rule: "duplicate-section", lineOffset: section.lineOffset, detail: section.name });
    }
    MutableHashSet.add(seenSections, section.name);
    const currentOrder = jsDocSectionOrder[section.name];
    if (currentOrder < lastSectionOrder) {
      A.appendInPlace(findings, { rule: "section-out-of-order", lineOffset: section.lineOffset, detail: section.name });
    }
    lastSectionOrder = currentOrder;
    if (section.name === "When to use" && !/^(?:Use to|Use when|Use as|Use with)\b/.test(meaningfulBody[0] ?? "")) {
      A.appendInPlace(findings, { rule: "invalid-when-to-use-prefix", lineOffset: section.lineOffset });
    }
  }

  const allFenceCount = extractFencedCodeBlocks(A.join(bodyLines, "\n"))[0].length;
  for (let index = exampleFenceCount; index < allFenceCount; index += 1) {
    A.appendInPlace(findings, { rule: "loose-ts-fence" });
  }

  return findings;
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

const requiredNamespaceImports = [
  { module: "effect/Schema", alias: "S" },
  { module: "effect/Array", alias: "A" },
  { module: "effect/Option", alias: "O" },
  { module: "effect/Predicate", alias: "P" },
  { module: "effect/Record", alias: "R" },
];

const requiredNamespaceImportViolations = (
  example: string,
  exampleNumber: number,
  required: (typeof requiredNamespaceImports)[number]
): ReadonlyArray<DocumentationIssue> => {
  const escapedModule = escapeRegExp(required.module);
  const namedImportPattern = new RegExp(`import\\s*\\{[^}]+\\}\\s*from\\s*["']${escapedModule}["']`);
  const namespaceImportPattern = new RegExp(
    `import\\s*\\*\\s*as\\s+${required.alias}\\s*from\\s*["']${escapedModule}["']`
  );
  return A.flatten([
    namedImportPattern.test(example)
      ? [
          {
            example: exampleNumber,
            rule: "use-required-namespace-import" as const,
            detail: `Use import * as ${required.alias} from "${required.module}".`,
          },
        ]
      : [],
    Str.includes(`from "${required.module}"`)(example) && !namespaceImportPattern.test(example)
      ? [
          {
            example: exampleNumber,
            rule: "wrong-required-namespace-alias" as const,
            detail: `Examples importing ${required.module} must use the ${required.alias} namespace alias.`,
          },
        ]
      : [],
  ]);
};

const rootImportSpecifierPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g;

const rootPackageImportViolations = (
  example: string,
  exampleNumber: number,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<DocumentationIssue> =>
  pipe(
    Str.matchAll(rootImportSpecifierPattern)(example),
    A.fromIterable,
    A.flatMap((match) => {
      const moduleSpecifier = match[1];
      return P.isString(moduleSpecifier) && MutableHashSet.has(forbiddenRootImports, moduleSpecifier)
        ? [
            {
              example: exampleNumber,
              rule: "no-root-package-import" as const,
              detail: `Import stable public modules instead of the ${moduleSpecifier} package root.`,
            },
          ]
        : A.empty<DocumentationIssue>();
    })
  );

const exampleImportViolations = (
  commentText: string,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<DocumentationIssue> =>
  A.flatMap(A.entries(extractExamples(commentText)), ([exampleIndex, example]) => {
    const exampleNumber = exampleIndex + 1;
    const deprecatedSchemaImport: ReadonlyArray<DocumentationIssue> = /@effect\/schema/.test(example)
      ? [
          {
            example: exampleNumber,
            rule: "no-deprecated-effect-schema-import",
            detail: "Examples must import Schema APIs from effect/Schema, not @effect/schema.",
          },
        ]
      : [];
    return A.appendAll(
      A.appendAll(deprecatedSchemaImport, rootPackageImportViolations(example, exampleNumber, forbiddenRootImports)),
      A.flatMap(requiredNamespaceImports, (required) =>
        requiredNamespaceImportViolations(example, exampleNumber, required)
      )
    );
  });

const importStatementTerminatorPattern = /from\s*["'][^"']*["']\s*;?\s*$/;
const bareImportStatementPattern = /^\s*import\s*["'][^"']*["']\s*;?\s*$/;

const indexAfterImportStatement = (lines: ReadonlyArray<string>, start: number): number => {
  let cursor = start;
  while (cursor < lines.length && !importStatementTerminatorPattern.test(lines[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor + 1;
};

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
      index = indexAfterImportStatement(lines, index);
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
    return /\b(?:S\.(?:Class|TaggedError)|Model\.Class|[A-Za-z_$][\w$]*Entity\.Entity)\b/.test(text);
  }
  if (!Node.isVariableDeclaration(node)) {
    return false;
  }

  const initializer = decodeTrimmedString(node.getInitializer()?.getText() ?? "");
  return (
    /^(?:LiteralKit|DomainModel\.make|ProductEntity\.make|Table\.make)\s*\(/.test(initializer) ||
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
    /\$I\.annote(?:Schema|Class|Error)?\s*(?:<[\s\S]*?>)?\s*\(/.test(text) ||
    /\.annotate\s*\(/.test(text) ||
    /\bS\.annotate\s*\(/.test(text);

  if (!hasAnnotation) {
    A.appendInPlace(gaps, {
      rule: "missing-schema-annotation",
      detail: "Exported schemas should carry $I.annote, $I.annoteClass, $I.annoteError, or $I.annoteSchema metadata.",
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

const moduleDocumentationKind = (fileoverview: string | undefined, presentTags: ReadonlyArray<string>): string => {
  if (A.contains(presentTags, "@packageDocumentation")) {
    return "packageDocumentation";
  }
  if (A.contains(presentTags, "@module")) {
    return "module";
  }
  return fileoverview === undefined ? "none" : "jsdoc";
};

const moduleDocumentationIssues = (fileoverview: string | undefined) => {
  if (fileoverview === undefined) {
    return {
      malformedTags: [] as Array<DocumentationIssue>,
      categoryIssues: [] as Array<DocumentationIssue>,
      shapeIssues: [] as Array<DocumentationIssue>,
    };
  }
  return {
    malformedTags: malformedConditionalTags(fileoverview),
    categoryIssues: categoryViolations(fileoverview),
    shapeIssues: documentationShapeViolations(fileoverview),
  };
};

const analyzeModule = (
  sourceFile: SourceFile,
  packagePath: string,
  exportCount: number,
  repoRoot: string,
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): InventoryEntry => {
  const filePath = repoRelative(sourceFile.getFilePath(), repoRoot, path);
  const relativeFilePath = normalizeSlashes(path.relative(packagePath, sourceFile.getFilePath()));
  const fileoverview = O.getOrUndefined(topFileoverview(sourceFile));
  const presentTags = fileoverview === undefined ? [] : tagsFromComment(fileoverview);
  const missingTags = exportCount === 0 ? [] : missingRequiredTags(presentTags, requiredModuleTags);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = fileoverview === undefined ? exportCount > 0 : O.isNone(summaryFromComment(fileoverview));
  const docKind = moduleDocumentationKind(fileoverview, presentTags);
  const { malformedTags, categoryIssues, shapeIssues } = moduleDocumentationIssues(fileoverview);
  const importIssues = P.isUndefined(fileoverview)
    ? A.empty<DocumentationIssue>()
    : exampleImportViolations(fileoverview, forbiddenRootImports);
  const findingCount = countFindings(
    missingSummary,
    missingTags,
    forbidden,
    malformedTags,
    importIssues,
    categoryIssues,
    shapeIssues
  );

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
    exampleImportViolations: importIssues,
    unsafeExampleViolations: [],
    schemaAnnotationGaps: [],
    categoryViolations: categoryIssues,
    documentationShapeViolations: shapeIssues,
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
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): InventoryEntry => {
  const commentText = `${leadingJsDocText(declaration)}\n${declaration.getText()}`;
  const presentTags = tagsFromComment(commentText);
  const { filePath, repoPath, line } = declarationLocationOf(declaration, sourceFile, packagePath, repoRoot, path);
  const malformedTags = malformedConditionalTags(commentText);
  const importIssues = exampleImportViolations(commentText, forbiddenRootImports);
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
    documentationShapeViolations: [] as Array<DocumentationIssue>,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

const countFindings = (missingSummary: boolean, ...findingGroups: ReadonlyArray<ReadonlyArray<unknown>>): number =>
  A.reduce(findingGroups, missingSummary ? 1 : 0, (total, findings) => total + findings.length);

const analyzeDirectExport = (
  name: string,
  declaration: Node,
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): InventoryEntry => {
  const docText = getJsDocText(declaration);
  const presentTags = tagsFromComment(docText);
  const missingTags = missingRequiredExportTags(declaration, docText, presentTags);
  const { filePath, repoPath, line } = declarationLocationOf(declaration, sourceFile, packagePath, repoRoot, path);
  const malformedTags = malformedConditionalTags(docText);
  const importIssues = exampleImportViolations(docText, forbiddenRootImports);
  const unsafeIssues = unsafeExampleViolations(docText);
  const categoryIssues = categoryViolations(docText);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = O.isNone(summaryFromComment(docText));
  const schemaGaps = schemaAnnotationGaps(name, declaration, sourceFile);
  const shapeIssues = documentationShapeViolations(docText);
  const findingCount = countFindings(
    missingSummary,
    missingTags,
    forbidden,
    malformedTags,
    importIssues,
    unsafeIssues,
    categoryIssues,
    schemaGaps,
    shapeIssues
  );

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
    documentationShapeViolations: shapeIssues,
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
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): InventoryEntry => {
  const anchor = anchorDeclarationForOverloadGroup(declarations);
  const docText = getJsDocText(anchor);
  const presentTags = tagsFromComment(docText);
  const effectiveTags = hasExampleCarrier(docText) ? A.append(presentTags, "@example") : presentTags;
  const missingTags = missingRequiredTags(effectiveTags, requiredExportTags);
  const { filePath, repoPath, line } = declarationLocationOf(anchor, sourceFile, packagePath, repoRoot, path);
  const forbidden = forbiddenTagsIn(presentTags);
  const missingSummary = O.isNone(summaryFromComment(docText));
  const schemaGaps = schemaAnnotationGaps(name, anchor, sourceFile);

  // Malformed/forbidden-tag checks apply to any doc block found on any
  // signature in the group, not only the anchor's — a stray malformed
  // comment on a non-anchor overload signature must still surface.
  const groupDocTexts = A.filter(A.map(declarations, getJsDocText), Str.isNonEmpty);
  const malformedTags = A.flatMap(groupDocTexts, malformedConditionalTags);
  const importIssues = A.flatMap(groupDocTexts, (docText) => exampleImportViolations(docText, forbiddenRootImports));
  const unsafeIssues = A.flatMap(groupDocTexts, unsafeExampleViolations);
  const categoryIssues = A.flatMap(groupDocTexts, categoryViolations);
  const shapeIssues = A.flatMap(groupDocTexts, documentationShapeViolations);
  const findingCount = countFindings(
    missingSummary,
    missingTags,
    forbidden,
    malformedTags,
    importIssues,
    unsafeIssues,
    categoryIssues,
    schemaGaps,
    shapeIssues
  );

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
    documentationShapeViolations: shapeIssues,
    remediationStatus: findingCount === 0 ? "resolved" : "open",
  };
};

const collectReExportDescriptors = (
  sourceFile: SourceFile,
  packagePath: string,
  repoRoot: string,
  path: Path.Path,
  seen: MutableHashSet.MutableHashSet<string>,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
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
      analysis: analyzeExportDeclaration(declaration, sourceFile, packagePath, repoRoot, path, forbiddenRootImports),
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
  seen: MutableHashSet.MutableHashSet<string>,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
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
        analysis: analyzeFunctionOverloadGroup(
          name,
          ownDeclarations,
          sourceFile,
          packagePath,
          repoRoot,
          path,
          forbiddenRootImports
        ),
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
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<DirectExportDescriptor> => {
  const seen = MutableHashSet.empty<string>();
  const exports: Array<DirectExportDescriptor> = [
    ...collectReExportDescriptors(sourceFile, packagePath, repoRoot, path, seen, forbiddenRootImports),
  ];

  for (const [name, declarationsForName] of sourceFile.getExportedDeclarations()) {
    const ownDeclarations = A.filter(declarationsForName, (declaration) => declaration.getSourceFile() === sourceFile);
    if (!A.isReadonlyArrayNonEmpty(ownDeclarations)) {
      continue;
    }
    A.appendAllInPlace(
      exports,
      collectDirectExportDescriptorsForName(
        name,
        ownDeclarations,
        sourceFile,
        packagePath,
        repoRoot,
        path,
        seen,
        forbiddenRootImports
      )
    );
  }

  return exports;
};

const documentationRuleCounts = (entries: ReadonlyArray<InventoryEntry>): JsonRecord =>
  R.fromEntries(
    A.map(newDocumentationRuleCodes, (rule) => [
      rule,
      A.reduce(
        entries,
        0,
        (total, entry) =>
          total +
          A.filter(A.appendAll(entry.documentationShapeViolations, entry.exampleImportViolations), (issue) =>
            Str.equivalence(rule)(issue.rule)
          ).length
      ),
    ])
  );

const sourceFileIsInPackageInventory = (
  sourceFilePath: string,
  packageInfo: WorkspacePackageInfo,
  srcDir: string,
  exclude: ReadonlyArray<string>,
  repoRoot: string,
  path: Path.Path,
  trackedPaths: O.Option<MutableHashSet.MutableHashSet<string>>
): boolean =>
  O.match(trackedPaths, {
    onNone: () => true,
    onSome: (paths) => MutableHashSet.has(paths, repoRelative(sourceFilePath, repoRoot, path)),
  }) &&
  !A.some(exclude, (pattern) =>
    packageSourceMatchesExclude(packageInfo.absolutePath, srcDir, sourceFilePath, pattern, path)
  );

const analyzePackageSourceFile = (
  sourceFile: SourceFile,
  packageInfo: WorkspacePackageInfo,
  repoRoot: string,
  path: Path.Path,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<InventoryEntry> =>
  A.map(exportedDeclarationsFor(sourceFile, packageInfo.absolutePath, repoRoot, path, forbiddenRootImports), (entry) =>
    entry.analysis !== undefined
      ? {
          ...entry.analysis,
          filePath: normalizeSlashes(path.relative(packageInfo.absolutePath, sourceFile.getFilePath())),
          repoPath: repoRelative(sourceFile.getFilePath(), repoRoot, path),
        }
      : analyzeDirectExport(
          entry.name,
          entry.declaration,
          sourceFile,
          packageInfo.absolutePath,
          repoRoot,
          path,
          forbiddenRootImports
        )
  );

const packageInventoryStatus = (
  sourceFileCount: number,
  modules: ReadonlyArray<InventoryEntry>,
  exports: ReadonlyArray<InventoryEntry>,
  openFindingCount: number
): string => {
  if (sourceFileCount === 0 || (modules.length === 0 && exports.length === 0)) {
    return "no-public-src-surface";
  }
  return openFindingCount === 0 ? "clean" : "needs-remediation";
};

const entryFindingCount = (
  entries: ReadonlyArray<InventoryEntry>,
  findings: (entry: InventoryEntry) => ReadonlyArray<unknown>
): number => A.reduce(entries, 0, (total, entry) => total + findings(entry).length);

const packageInventoryCounts = (
  modules: ReadonlyArray<InventoryEntry>,
  exports: ReadonlyArray<InventoryEntry>,
  openModuleCount: number,
  openExportCount: number
) => ({
  openModules: openModuleCount,
  openExports: openExportCount,
  missingExportExamples: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@example")).length,
  missingExportCategories: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@category")).length,
  missingExportSince: A.filter(exports, (entry) => entry.missingRequiredTags.includes("@since")).length,
  missingExportSummaries: A.filter(exports, (entry) => entry.missingSummary).length,
  forbiddenTagFindings:
    entryFindingCount(modules, (entry) => entry.forbiddenTags) +
    entryFindingCount(exports, (entry) => entry.forbiddenTags),
  malformedConditionalTagFindings:
    entryFindingCount(modules, (entry) => entry.malformedConditionalTags) +
    entryFindingCount(exports, (entry) => entry.malformedConditionalTags),
  exampleImportFindings: entryFindingCount(A.appendAll(modules, exports), (entry) => entry.exampleImportViolations),
  unsafeExampleFindings: entryFindingCount(exports, (entry) => entry.unsafeExampleViolations),
  schemaAnnotationFindings: entryFindingCount(exports, (entry) => entry.schemaAnnotationGaps),
  documentationRuleFindings: documentationRuleCounts(A.appendAll(modules, exports)),
});

const analyzePackage = Effect.fn("JSDocDocumentationInventory.analyzePackage")(function* (
  packageInfo: WorkspacePackageInfo,
  topoOrder: number,
  repoRoot: string,
  path: Path.Path,
  trackedPaths: O.Option<MutableHashSet.MutableHashSet<string>>,
  forbiddenRootImports: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<PackageInventory, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const docgenPath = path.join(packageInfo.absolutePath, "docgen.json");
  const hasDocgenConfig = yield* fs.exists(docgenPath).pipe(Effect.orElseSucceed(thunkFalse));
  const docgenConfig = hasDocgenConfig ? yield* readJsonc(docgenPath) : {};
  const srcDir = P.isString(docgenConfig.srcDir) ? docgenConfig.srcDir : "src";
  const exclude = A.isArray(docgenConfig.exclude) ? A.filter(docgenConfig.exclude, P.isString) : [];
  const sourceRoot = path.join(packageInfo.absolutePath, srcDir);
  const sourceFiles = A.filter(yield* listSourceFiles(sourceRoot, path), (sourceFilePath) =>
    sourceFileIsInPackageInventory(sourceFilePath, packageInfo, srcDir, exclude, repoRoot, path, trackedPaths)
  );
  const project = createInMemoryTsMorphProject();
  const modules: Array<InventoryEntry> = [];
  const exports: Array<InventoryEntry> = [];

  for (const sourceFilePath of sourceFiles) {
    const sourceFile = project.addSourceFileAtPath(sourceFilePath);
    const packageExports = analyzePackageSourceFile(sourceFile, packageInfo, repoRoot, path, forbiddenRootImports);

    if (packageExports.length > 0) {
      A.appendInPlace(
        modules,
        analyzeModule(sourceFile, packageInfo.absolutePath, packageExports.length, repoRoot, path, forbiddenRootImports)
      );
      A.appendAllInPlace(exports, packageExports);
    }
  }

  const openModuleCount = A.filter(modules, (entry) => entry.remediationStatus === "open").length;
  const openExportCount = A.filter(exports, (entry) => entry.remediationStatus === "open").length;
  const status = packageInventoryStatus(sourceFiles.length, modules, exports, openModuleCount + openExportCount);

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
    counts: packageInventoryCounts(modules, exports, openModuleCount, openExportCount),
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
    documentationRuleFindings: R.fromEntries(A.map(newDocumentationRuleCodes, (rule) => [rule, 0])),
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
  const documentationTotals = R.fromEntries(
    A.map(newDocumentationRuleCodes, (rule) => [
      rule,
      A.reduce(packages, 0, (total, entry) => {
        const value = R.get(entry.counts.documentationRuleFindings, rule).pipe(O.filter(P.isNumber));
        return total + O.getOrElse(value, () => 0);
      }),
    ])
  );
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
    ...documentationTotals,
    rootPolicyOpen: rootPolicy.status === "open" ? 1 : 0,
  };
};

const detailWhen = (condition: boolean, detail: string): ReadonlyArray<string> => (condition ? [detail] : []);

const detailList = (entry: InventoryEntry): string =>
  A.match(
    A.flatten([
      detailWhen(entry.missingSummary, "missing summary"),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.missingRequiredTags),
        `missing ${A.join(entry.missingRequiredTags, ", ")}`
      ),
      detailWhen(A.isReadonlyArrayNonEmpty(entry.forbiddenTags), `forbidden ${A.join(entry.forbiddenTags, ", ")}`),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.malformedConditionalTags),
        `${entry.malformedConditionalTags.length} malformed conditional tag(s)`
      ),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.exampleImportViolations),
        `${entry.exampleImportViolations.length} example import violation(s)`
      ),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.unsafeExampleViolations),
        `${entry.unsafeExampleViolations.length} unsafe example violation(s)`
      ),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.schemaAnnotationGaps),
        `${entry.schemaAnnotationGaps.length} schema annotation/type-alias gap(s)`
      ),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.categoryViolations),
        `${entry.categoryViolations.length} category casing violation(s)`
      ),
      detailWhen(
        A.isReadonlyArrayNonEmpty(entry.documentationShapeViolations),
        `${entry.documentationShapeViolations.length} documentation section/link violation(s)`
      ),
    ]),
    { onEmpty: () => "resolved", onNonEmpty: (details) => A.join(details, "; ") }
  );

const renderInventoryTotals = (inventory: Inventory): ReadonlyArray<string> => [
  "## Totals",
  "",
  "| Metric | Count |",
  "|---|---:|",
  ...A.map(R.toEntries(inventory.totals), ([key, value]) => `| ${key} | ${value} |`),
];

const renderRootPolicy = (rootPolicy: RootPolicyInventory): ReadonlyArray<string> => [
  "## Root Policy",
  "",
  "| File | Tag | Status | Missing |",
  "|---|---|---|---|",
  ...A.map(
    rootPolicy.customTags,
    (tag) => `| ${rootPolicy.filePath} | \`${tag.tagName}\` | ${tag.status} | ${A.join(tag.missing, ", ") || "none"} |`
  ),
];

const renderPackageSummary = (packages: ReadonlyArray<PackageInventory>): ReadonlyArray<string> => [
  "## Package Summary",
  "",
  "| Order | Package | Path | Status | Modules | Exports | Open Modules | Open Exports |",
  "|---:|---|---|---|---:|---:|---:|---:|",
  ...A.map(
    packages,
    (pkg) =>
      `| ${pkg.topoOrder} | \`${pkg.packageName}\` | \`${pkg.packagePath}\` | ${pkg.status} | ${pkg.sourceCoverage.publicModuleCount} | ${pkg.sourceCoverage.publicExportCount} | ${pkg.counts.openModules} | ${pkg.counts.openExports} |`
  ),
];

const renderEntryFindings = (
  heading: string,
  entries: ReadonlyArray<InventoryEntry>,
  render: (entry: InventoryEntry) => string
): ReadonlyArray<string> =>
  A.match(entries, {
    onEmpty: () => [],
    onNonEmpty: (nonEmptyEntries) => ["", heading, ...A.map(nonEmptyEntries, render)],
  });

const renderOpenPackageFindings = (pkg: PackageInventory): ReadonlyArray<string> => [
  "",
  `### ${pkg.packageName}`,
  "",
  `Path: \`${pkg.packagePath}\``,
  ...renderEntryFindings(
    "Module findings:",
    A.filter(pkg.modules, (entry) => entry.remediationStatus === "open"),
    (entry) => `- \`${entry.filePath}:${entry.line}\` (${entry.docKind}) - ${detailList(entry)}`
  ),
  ...renderEntryFindings(
    "Export findings:",
    A.filter(pkg.exports, (entry) => entry.remediationStatus === "open"),
    (entry) =>
      `- \`${entry.filePath}:${entry.line}\` \`${entry.symbolName}\` (${entry.exportKind}) - ${detailList(entry)}`
  ),
];

const renderMarkdown = (inventory: Inventory): string => {
  const lines = A.flatten([
    [
      "# JSDoc Documentation Compliance Inventory",
      "",
      `Generated: ${inventory.generatedAt}`,
      "",
      "## Scope",
      "",
      "The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.",
      "",
    ],
    renderInventoryTotals(inventory),
    [""],
    renderRootPolicy(inventory.rootPolicy),
    [""],
    renderPackageSummary(inventory.packages),
    ["", "## Open Findings"],
    A.flatMap(
      A.filter(inventory.packages, (entry) => entry.status === "needs-remediation"),
      renderOpenPackageFindings
    ),
  ]);
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
  const fs = yield* FileSystem.FileSystem;
  const { generatedAt, repoRoot } = yield* resolveJSDocInventoryOptions(options);
  const packageByName = yield* discoverWorkspacePackages(repoRoot, path);
  const forbiddenRootImports = MutableHashSet.fromIterable(
    pipe(
      MutableHashMap.values(packageByName),
      A.fromIterable,
      A.filter((packageInfo) => Str.startsWith("packages/foundation/")(packageInfo.path)),
      A.map((packageInfo) => packageInfo.name),
      (packageNames) => A.prepend(packageNames, "effect")
    )
  );
  const topoNames = yield* topoSortPackageNames(repoRoot, path);
  const hasGitMetadata = yield* fs
    .exists(path.join(repoRoot, ".git"))
    .pipe(QualityArtifactGeneratorError.mapError("Failed to inspect repository Git metadata.", { filePath: repoRoot }));
  const trackedPaths = hasGitMetadata
    ? O.some(MutableHashSet.fromIterable(yield* runGitLines(repoRoot, ["ls-files"], gitCommandErrorAdapter)))
    : O.none<MutableHashSet.MutableHashSet<string>>();
  const rootPolicy = yield* analyzeRootPolicy(repoRoot, path);
  // Ecosystem members are documented to the published-package grammar and
  // gated by their own package docgen lane; the repo carrier grammar this
  // inventory enforces does not govern them (standards/architecture/
  // 14-ecosystem-packages.md, Style-Law Scoping). Lab apps under apps/labs
  // are likewise excluded: labs are ceremony-exempt scratch surfaces
  // (goals/lab-apps-lifecycle D2) and never enter the carrier-grammar
  // inventory.
  const inventoriedNames = A.filter(topoNames, (packageName) =>
    O.match(MutableHashMap.get(packageByName, packageName), {
      onNone: () => true,
      onSome: (info) => !Str.startsWith("packages/ecosystem/")(info.path) && !isLabsWorkspacePath(info.path),
    })
  );
  const packages = yield* Effect.forEach(
    inventoriedNames,
    (packageName, index) => {
      const packageInfo = MutableHashMap.get(packageByName, packageName);
      return O.isNone(packageInfo)
        ? Effect.succeed(analyzeMissingPackage(packageName, index + 1))
        : analyzePackage(packageInfo.value, index + 1, repoRoot, path, trackedPaths, forbiddenRootImports);
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
