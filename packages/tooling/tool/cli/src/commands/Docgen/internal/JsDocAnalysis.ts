/**
 * JSDoc subject analysis for Docgen package checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, flow, HashMap, Path, pipe } from "effect";
import * as P from "effect/Predicate";
import { Node, Project, SyntaxKind } from "ts-morph";
import { globPatternToRegExp } from "../../../internal/GlobPattern.ts";
import {
  byIssueAscending,
  DocgenAnalysisSummary,
  DocgenConfigDocument,
  DocgenExportAnalysis,
  DocgenPackageAnalysis,
} from "../Docgen.schemas.ts";
import { loadDocgenConfigDocument } from "./Workspace.ts";
import type { DomainError } from "@beep/repo-utils";
import type { FileSystem } from "effect";
import type { ExportDeclaration, JSDoc, SourceFile } from "ts-morph";
import type { DocgenExportKind, DocgenIssuePriority, DocgenWorkspacePackage } from "../Docgen.schemas.ts";

const DOCGEN_REQUIRED_TAGS = ["@category", "@example", "@since"] as const;

const normalizeSlashes = Str.replace(/\\/g, "/");

const relativePathWithinPackage = (absolutePackagePath: string, absoluteFilePath: string, path: Path.Path): string =>
  normalizeSlashes(path.relative(absolutePackagePath, absoluteFilePath));

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

const getOwningJsDocs = (node: Node): ReadonlyArray<JSDoc> => pipe(getJsDocs(node), A.last, O.toArray);

const extractJsDocTags = flow(
  getOwningJsDocs,
  A.flatMap((doc) => A.map(doc.getTags(), (tag) => `@${tag.getTagName()}`))
);

const extractJsDocCategoryValues = flow(
  getOwningJsDocs,
  A.flatMap((doc) =>
    A.flatMap(doc.getTags(), (tag) =>
      tag.getTagName() === "category" ? [Str.trim(tag.getCommentText() ?? "")] : A.empty<string>()
    )
  )
);

const getLeadingJsDocCommentText = (node: ExportDeclaration): O.Option<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.filter((range) => Str.startsWith("/**")(range.getText())),
    A.last,
    O.map((range) => range.getText())
  );

const extractJsDocTagsFromText = flow(
  Str.matchAll(/@([A-Za-z][\w-]*)/g),
  A.fromIterable,
  A.flatMap((match) => (match[1] === undefined ? A.empty<string>() : [`@${match[1]}`]))
);

const extractJsDocCategoryValuesFromText = flow(
  Str.split(/\r?\n/),
  A.flatMap((line) => {
    const match = /@category(?:\s+([^*]+?))?\s*(?:\*\/)?\s*$/.exec(line);

    return match === null ? A.empty<string>() : [Str.trim(match[1] ?? "")];
  })
);

const extractContext = flow(
  getOwningJsDocs,
  A.head,
  O.flatMap((doc) => O.fromNullishOr(doc.getDescription())),
  O.map((description) => Str.trim(description)),
  O.filter((description) => description.length > 0),
  O.map((description) => {
    const [firstLine] = Str.split("\n")(description);
    return firstLine === undefined ? description : firstLine;
  }),
  O.getOrUndefined
);

const hasJsDocComment = (node: Node): boolean => getOwningJsDocs(node).length > 0;

type DocgenRequiredTag = (typeof DOCGEN_REQUIRED_TAGS)[number];

const resolveRequiredTags = (config: DocgenConfigDocument): ReadonlyArray<DocgenRequiredTag> => {
  const tags = A.empty<DocgenRequiredTag>();

  A.appendInPlace(tags, "@category");

  if (config.enforceExamples === true) {
    A.appendInPlace(tags, "@example");
  }

  if (config.enforceVersion !== false) {
    A.appendInPlace(tags, "@since");
  }

  return tags;
};

const missingRequiredTags = (
  presentTags: ReadonlyArray<string>,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenRequiredTag> => A.filter(requiredTags, (tag) => !A.contains(presentTags, tag));

const categoryIssueMessages: (categoryValues: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.map(normalizeJSDocCategory),
  A.filter((category) => category.status === "rejected" || category.status === "unknown"),
  A.map((category) => category.message ?? `Invalid @category value ${category.original}.`)
);

const extractLeadingCommentTags = (node: Node): ReadonlyArray<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.flatMap((range) => extractJsDocTagsFromText(range.getText()))
  );

const extractLeadingCommentCategoryValues = (node: Node): ReadonlyArray<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.flatMap((range) => extractJsDocCategoryValuesFromText(range.getText()))
  );

const collectExportSpecifierTags = (sourceFile: SourceFile): HashMap.HashMap<string, ReadonlyArray<string>> => {
  let index = HashMap.empty<string, ReadonlyArray<string>>();

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration)) {
    for (const specifier of declaration.getNamedExports()) {
      const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName();
      const tags = pipe(
        [...extractLeadingCommentTags(specifier), ...extractJsDocTagsFromText(specifier.getText())],
        A.dedupe
      );

      if (A.isReadonlyArrayNonEmpty(tags)) {
        index = HashMap.set(index, exportName, tags);
      }
    }
  }

  return index;
};

const collectExportSpecifierCategoryValues = (
  sourceFile: SourceFile
): HashMap.HashMap<string, ReadonlyArray<string>> => {
  let index = HashMap.empty<string, ReadonlyArray<string>>();

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration)) {
    for (const specifier of declaration.getNamedExports()) {
      const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName();
      const categoryValues = pipe(
        [...extractLeadingCommentCategoryValues(specifier), ...extractJsDocCategoryValuesFromText(specifier.getText())],
        A.dedupe
      );

      if (A.isReadonlyArrayNonEmpty(categoryValues)) {
        index = HashMap.set(index, exportName, categoryValues);
      }
    }
  }

  return index;
};

const isStaticMemberAssignmentExportDeclaration = (node: Node): boolean =>
  Node.isIdentifier(node) && Node.isPropertyAccessExpression(node.getParent());

const getExportKind = (node: Node): DocgenExportKind => {
  if (Node.isFunctionDeclaration(node)) return "function";
  if (Node.isVariableDeclaration(node)) return "const";
  if (Node.isTypeAliasDeclaration(node)) return "type";
  if (Node.isInterfaceDeclaration(node)) return "interface";
  if (Node.isClassDeclaration(node)) return "class";
  if (Node.isModuleDeclaration(node)) return "namespace";
  if (Node.isEnumDeclaration(node)) return "enum";
  return "const";
};

const computePriority = (
  hasJsDoc: boolean,
  missingTags: ReadonlyArray<string>,
  categoryIssues: ReadonlyArray<string>
): DocgenIssuePriority => {
  const issueCount = missingTags.length + categoryIssues.length;

  if (!hasJsDoc || issueCount >= 3) {
    return "high";
  }
  if (issueCount > 0) {
    return "medium";
  }
  return "low";
};

const hasAnalysisIssue = (analysis: DocgenExportAnalysis): boolean =>
  analysis.missingTags.length > 0 || analysis.categoryIssues.length > 0;

const makeExportAnalysis = (options: {
  readonly name: string;
  readonly kind: DocgenExportKind;
  readonly filePath: string;
  readonly line: number;
  readonly presentTags: ReadonlyArray<string>;
  readonly missingTags: ReadonlyArray<string>;
  readonly categoryValues: ReadonlyArray<string>;
  readonly categoryIssues: ReadonlyArray<string>;
  readonly hasJsDoc: boolean;
  readonly declarationSource: string;
  readonly context?: string | undefined;
}): DocgenExportAnalysis =>
  DocgenExportAnalysis.make({
    name: options.name,
    kind: options.kind,
    filePath: options.filePath,
    line: options.line,
    presentTags: [...options.presentTags],
    missingTags: [...options.missingTags],
    categoryValues: [...options.categoryValues],
    categoryIssues: [...options.categoryIssues],
    hasJsDoc: options.hasJsDoc,
    priority: computePriority(options.hasJsDoc, options.missingTags, options.categoryIssues),
    declarationSource: options.declarationSource,
    ...O.getSomesStruct({ context: O.fromUndefinedOr(options.context) }),
  });

const analyzeExport = (
  name: string,
  node: Node,
  filePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>,
  inheritedTags: ReadonlyArray<string>,
  inheritedCategoryValues: ReadonlyArray<string>
): DocgenExportAnalysis => {
  const presentTags = pipe([...extractJsDocTags(node), ...inheritedTags], A.dedupe);
  const categoryValues = pipe([...extractJsDocCategoryValues(node), ...inheritedCategoryValues], A.dedupe);
  const missingTags = missingRequiredTags(presentTags, requiredTags);
  const categoryIssues = categoryIssueMessages(categoryValues);

  return makeExportAnalysis({
    name,
    kind: getExportKind(node),
    filePath,
    line: node.getStartLineNumber(),
    presentTags,
    missingTags,
    categoryValues,
    categoryIssues,
    hasJsDoc: hasJsDocComment(node) || A.isReadonlyArrayNonEmpty(inheritedTags),
    declarationSource: node.getText(),
    context: extractContext(node),
  });
};

const analyzeModuleFileoverview = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): O.Option<DocgenExportAnalysis> => {
  const match = /^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/.exec(sourceFile.getFullText());

  if (match === null) {
    if (!A.contains(requiredTags, "@since")) {
      return O.none();
    }

    return O.some(
      makeExportAnalysis({
        name: "<module fileoverview>",
        kind: "module-fileoverview",
        filePath: relativeFilePath,
        line: 1,
        presentTags: A.empty(),
        missingTags: ["@since"],
        categoryValues: A.empty(),
        categoryIssues: A.empty(),
        hasJsDoc: false,
        declarationSource: "",
        context: "Module fileoverview JSDoc is missing.",
      })
    );
  }

  const commentText = match[1] ?? "";
  const presentTags = pipe(
    ["@file", "@fileoverview", "@module", "@category", "@example"],
    A.filter((tag) => Str.includes(tag)(commentText))
  );
  const categoryValues = extractJsDocCategoryValuesFromText(commentText);
  const categoryIssues = categoryIssueMessages(categoryValues);
  const missingTags =
    /@since\b/.test(commentText) || !A.contains(requiredTags, "@since") ? A.empty<DocgenRequiredTag>() : ["@since"];

  if (missingTags.length === 0 && categoryIssues.length === 0) {
    return O.none();
  }

  const hasMissingTags = A.isReadonlyArrayNonEmpty(missingTags);
  const hasCategoryIssues = A.isReadonlyArrayNonEmpty(categoryIssues);
  const context = pipe(
    [
      pipe(
        hasMissingTags && hasCategoryIssues,
        O.liftPredicate(P.isTruthy),
        O.as("Module fileoverview is missing @since and has invalid @category metadata.")
      ),
      pipe(hasMissingTags, O.liftPredicate(P.isTruthy), O.as("Module fileoverview is missing @since.")),
    ] satisfies ReadonlyArray<O.Option<string>>,
    O.firstSomeOf,
    O.getOrElse(() => "Module fileoverview has invalid @category metadata.")
  );

  return O.some(
    makeExportAnalysis({
      name: "<module fileoverview>",
      kind: "module-fileoverview",
      filePath: relativeFilePath,
      line: 1,
      presentTags,
      missingTags,
      categoryValues,
      categoryIssues,
      hasJsDoc: true,
      declarationSource: commentText,
      context,
    })
  );
};

const analyzeReExports = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenExportAnalysis> =>
  pipe(
    sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration),
    A.map((declaration: ExportDeclaration) => {
      const jsDocTags = pipe(
        getJsDocs(declaration),
        A.flatMap((doc) => A.map(doc.getTags(), (tag) => `@${tag.getTagName()}`))
      );
      const leadingTags = pipe(
        getLeadingJsDocCommentText(declaration),
        O.map(extractJsDocTagsFromText),
        O.getOrElse(A.empty<string>)
      );
      const declarationTextTags = extractJsDocTagsFromText(declaration.getText());
      const presentTags = pipe([...jsDocTags, ...leadingTags, ...declarationTextTags], A.dedupe);
      const categoryValues = pipe(
        [
          ...extractJsDocCategoryValues(declaration),
          ...pipe(
            getLeadingJsDocCommentText(declaration),
            O.map(extractJsDocCategoryValuesFromText),
            O.getOrElse(A.empty<string>)
          ),
          ...extractJsDocCategoryValuesFromText(declaration.getText()),
        ],
        A.dedupe
      );
      const missingTags = missingRequiredTags(presentTags, requiredTags);
      const categoryIssues = categoryIssueMessages(categoryValues);

      return makeExportAnalysis({
        name: declaration.getText(),
        kind: "re-export",
        filePath: relativeFilePath,
        line: declaration.getStartLineNumber(),
        presentTags,
        missingTags,
        categoryValues,
        categoryIssues,
        hasJsDoc: presentTags.length > 0,
        declarationSource: declaration.getText(),
        context: `Re-export from ${declaration.getModuleSpecifierValue() ?? "<unknown>"} needs documentation.`,
      });
    }),
    A.filter(hasAnalysisIssue)
  );

const sourceFileMatchesExclude = (
  absolutePackagePath: string,
  srcDir: string,
  sourceFilePath: string,
  pattern: string
): boolean => {
  const normalizedPattern = normalizeSlashes(Str.replace(/^\.\//, "")(pattern));
  const packageRelative = Str.replace(
    `${normalizeSlashes(absolutePackagePath)}/`,
    ""
  )(normalizeSlashes(sourceFilePath));
  const srcRelative = Str.startsWith(`${srcDir}/`)(packageRelative)
    ? Str.slice(srcDir.length + 1)(packageRelative)
    : packageRelative;
  const patternRegex = globPatternToRegExp(normalizedPattern);

  return A.some([packageRelative, srcRelative], (candidate) => patternRegex.test(candidate));
};

const getSourceFiles = (
  project: Project,
  absolutePackagePath: string,
  srcDir: string,
  exclude: ReadonlyArray<string>
): ReadonlyArray<SourceFile> => {
  const baseDir = normalizeSlashes(`${absolutePackagePath}/${srcDir}`);
  project.addSourceFilesAtPaths(`${baseDir}/**/*.ts`);
  project.addSourceFilesAtPaths(`${baseDir}/**/*.tsx`);

  return pipe(
    project.getSourceFiles(),
    A.filter((sourceFile) => !Str.endsWith(".d.ts")(sourceFile.getFilePath())),
    A.filter(
      (sourceFile) =>
        !A.some(exclude, (pattern) =>
          sourceFileMatchesExclude(absolutePackagePath, srcDir, sourceFile.getFilePath(), pattern)
        )
    )
  );
};

const analyzeSourceFile = (
  sourceFile: SourceFile,
  absolutePackagePath: string,
  path: Path.Path,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenExportAnalysis> => {
  const relativeFilePath = relativePathWithinPackage(absolutePackagePath, sourceFile.getFilePath(), path);
  const reExports = analyzeReExports(sourceFile, relativeFilePath, requiredTags);
  const exportSpecifierTags = collectExportSpecifierTags(sourceFile);
  const exportSpecifierCategoryValues = collectExportSpecifierCategoryValues(sourceFile);
  const directExports = pipe(
    A.fromIterable(sourceFile.getExportedDeclarations().entries()),
    A.flatMap(([name, declarations]) => {
      const localDeclarations = pipe(
        declarations,
        A.filter((declaration) => declaration.getSourceFile() === sourceFile),
        A.filter((declaration) => !isStaticMemberAssignmentExportDeclaration(declaration))
      );
      const declarationGroupTags = pipe(localDeclarations, A.flatMap(extractJsDocTags), A.dedupe);
      const declarationGroupCategoryValues = pipe(localDeclarations, A.flatMap(extractJsDocCategoryValues), A.dedupe);
      const specifierTags = O.getOrElse(HashMap.get(exportSpecifierTags, name), A.empty<string>);
      const specifierCategoryValues = O.getOrElse(HashMap.get(exportSpecifierCategoryValues, name), A.empty<string>);

      return A.map(localDeclarations, (declaration) =>
        analyzeExport(
          name,
          declaration,
          relativeFilePath,
          requiredTags,
          [...declarationGroupTags, ...specifierTags],
          [...declarationGroupCategoryValues, ...specifierCategoryValues]
        )
      );
    })
  );

  if (reExports.length === 0 && directExports.length === 0) {
    return A.empty();
  }

  const moduleFileoverview = analyzeModuleFileoverview(sourceFile, relativeFilePath, requiredTags);

  return pipe(O.toArray(moduleFileoverview), A.appendAll(reExports), A.appendAll(directExports));
};

const computeAnalysisSummary = (analyses: ReadonlyArray<DocgenExportAnalysis>): DocgenAnalysisSummary =>
  DocgenAnalysisSummary.make({
    totalExports: analyses.length,
    fullyDocumented: A.filter(analyses, (analysis) => !hasAnalysisIssue(analysis)).length,
    missingDocumentation: A.filter(analyses, hasAnalysisIssue).length,
    missingCategory: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@category")).length,
    invalidCategory: A.filter(analyses, (analysis) => A.isReadonlyArrayNonEmpty(analysis.categoryIssues)).length,
    missingExample: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@example")).length,
    missingSince: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@since")).length,
  });

/**
 * Analyze required JSDoc metadata for one workspace package.
 *
 * @param targetPackage - Workspace package to inspect.
 * @returns Package analysis with sorted export findings and summary counts.
 * @effects Reads package-local docgen config and TypeScript source files.
 * @example
 * ```ts
 * import { analyzePackageDocumentation } from "@beep/repo-cli/commands/Docgen/internal/JsDocAnalysis"
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * import { Effect } from "effect"
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
 * const program = analyzePackageDocumentation(target)
 * console.log(Effect.isEffect(program))
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const analyzePackageDocumentation: (
  targetPackage: DocgenWorkspacePackage
) => Effect.Effect<DocgenPackageAnalysis, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocgenOperations.analyzePackageDocumentation"
)(function* (targetPackage) {
  const path = yield* Path.Path;
  const config = targetPackage.hasDocgenConfig
    ? yield* loadDocgenConfigDocument(targetPackage.absolutePath)
    : DocgenConfigDocument.make({
        srcDir: "src",
        exclude: A.empty(),
      });
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const srcDir = config.srcDir;
  const exclude = config.exclude;
  const requiredTags = resolveRequiredTags(config);
  const analyses = pipe(
    getSourceFiles(project, targetPackage.absolutePath, srcDir, exclude),
    A.flatMap((sourceFile) => analyzeSourceFile(sourceFile, targetPackage.absolutePath, path, requiredTags)),
    A.sort(byIssueAscending)
  );
  const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

  return DocgenPackageAnalysis.make({
    packageName: targetPackage.name,
    packagePath: targetPackage.relativePath,
    timestamp,
    exports: analyses,
    summary: computeAnalysisSummary(analyses),
  });
});
