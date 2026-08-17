/**
 * Audits package documentation, owning exports, public class behavior, and
 * local schema-check metadata across the included effect-ontology source tree.
 *
 * **Details**
 *
 * Re-export declarations are graph edges and therefore inherit documentation
 * from their owning declarations. Tests, generated docs, local dependencies,
 * and the Vitest entrypoint are excluded to match the focused docgen config.
 *
 * **Example** (Run the documentation audit)
 *
 * ```ts
 * const command = "bun run --cwd scratchpad audit:effect-ontology-docs"
 * console.log(command)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { isCanonicalJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories";
import { A, Str } from "@beep/utils";
import { Effect, HashMap, HashSet } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as ts from "typescript";

interface Finding {
  readonly file: string;
  readonly symbol: string;
  readonly issues: ReadonlyArray<string>;
}

interface AuditDocOptions {
  readonly allowPackageDocumentation: boolean;
  readonly requireCategory: boolean;
  readonly requireDescription: boolean;
  readonly requireExample: boolean;
  readonly requireSince: boolean;
}

interface DocSection {
  readonly kind: "When to use" | "Details" | "Gotchas" | "Example";
  readonly line: number;
  readonly title: string | undefined;
}

const sectionOrder: Readonly<Record<DocSection["kind"], number>> = {
  "When to use": 0,
  Details: 1,
  Gotchas: 2,
  Example: 3,
};
const tagOrder: ReadonlyArray<string> = [
  "typeParam",
  "param",
  "returns",
  "return",
  "throws",
  "effects",
  "precondition",
  "postcondition",
  "invariant",
  "deprecated",
  "defaultValue",
  "see",
  "public",
  "beta",
  "alpha",
  "internal",
  "experimental",
  "category",
  "since",
];
const tagRanks = HashMap.fromIterable(A.map(tagOrder, (tag, index): readonly [string, number] => [tag, index]));
const forbiddenTagPattern = /@(example|module|remarks|template)\b/gu;
const canonicalExample = /\*\*Example\*\*\s*\([^\r\n)]+\)/u;
const sectionPattern = /^\*\*(When to use|Details|Gotchas|Example)\*\*(?:\s*\(([^)]*)\))?$/u;
const checkFactories = HashSet.make(
  "isBetween",
  "isGreaterThan",
  "isGreaterThanOrEqualTo",
  "isInt",
  "isLessThanOrEqualTo",
  "isPattern",
  "makeFilter"
);
const helperModules = HashSet.make(
  "effect/Array",
  "effect/Option",
  "effect/Predicate",
  "effect/Record",
  "effect/Schema"
);
const sourceRoot = new URL("../", import.meta.url);
const sourceModules = new Bun.Glob("**/*.ts");
const findings: Array<Finding> = [];
let auditedModules = 0;
let auditedDeclarations = 0;
let auditedMembers = 0;
let auditedChecks = 0;

const includedModule = (relativePath: string): boolean =>
  relativePath !== "vitest.config.ts" &&
  !A.some(["docs/", "node_modules/", "test/"], (prefix) => Str.startsWith(prefix)(relativePath));

const addFinding = (file: string, symbol: string, issues: ReadonlyArray<string>): void => {
  const uniqueIssues = A.dedupe(issues);
  if (A.isReadonlyArrayNonEmpty(uniqueIssues)) {
    findings.push({ file, symbol, issues: uniqueIssues });
  }
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) && A.some(ts.getModifiers(node) ?? [], (modifier) => modifier.kind === kind);

const owningJSDoc = (node: ts.Node, sourceFile: ts.SourceFile): string =>
  A.last(A.filter(ts.getJSDocCommentsAndTags(node), ts.isJSDoc)).pipe(
    O.map((doc) => doc.getText(sourceFile)),
    O.getOrElse(() => "")
  );

const docLines = (doc: string): ReadonlyArray<string> =>
  pipeDocLines(doc).map((line) => line.replace(/^\s*\* ?/u, "").trimEnd());

const pipeDocLines = (doc: string): ReadonlyArray<string> => {
  const withoutDelimiters = doc.replace(/^\/\*\*/u, "").replace(/\*\/$/u, "");
  return Str.split(/\r?\n/u)(withoutDelimiters);
};

const hasLeadDescription = (lines: ReadonlyArray<string>): boolean => {
  for (const line of lines) {
    const trimmed = Str.trim(line);
    if (Str.isEmpty(trimmed)) {
      continue;
    }
    return !Str.startsWith("@")(trimmed) && !Str.startsWith("**")(trimmed);
  }
  return false;
};

const leadParagraphCount = (lines: ReadonlyArray<string>): number => {
  let count = 0;
  let insideParagraph = false;

  for (const line of lines) {
    const trimmed = Str.trim(line);
    if (Str.startsWith("@")(trimmed) || sectionPattern.test(trimmed)) {
      break;
    }
    if (Str.isEmpty(trimmed)) {
      insideParagraph = false;
      continue;
    }
    if (!insideParagraph) {
      count += 1;
      insideParagraph = true;
    }
  }

  return count;
};

const tagValues = (doc: string, tag: "category" | "since"): ReadonlyArray<string> => {
  const pattern = tag === "category" ? /@category\s+([^\s*]+)/gu : /@since\s+([^\s*]+)/gu;
  return A.flatMap(A.fromIterable(Str.matchAll(pattern)(doc)), (match) =>
    match[1] === undefined ? A.empty<string>() : [Str.trim(match[1])]
  );
};

const sectionsFromLines = (lines: ReadonlyArray<string>): ReadonlyArray<DocSection> =>
  A.flatMap(lines, (line, index) => {
    const match = sectionPattern.exec(Str.trim(line));
    if (match === null || match[1] === undefined) {
      return A.empty<DocSection>();
    }
    const kind = match[1];
    if (kind !== "When to use" && kind !== "Details" && kind !== "Gotchas" && kind !== "Example") {
      return A.empty<DocSection>();
    }
    return [
      {
        kind,
        line: index,
        title: match[2] === undefined ? undefined : Str.trim(match[2]),
      },
    ];
  });

const sectionBody = (
  section: DocSection,
  sectionIndex: number,
  sections: ReadonlyArray<DocSection>,
  lines: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const nextSection = sections[sectionIndex + 1];
  const end = nextSection?.line ?? lines.length;
  return A.filter(A.take(lines, end).slice(section.line + 1), (line) => !Str.startsWith("@")(Str.trim(line)));
};

const auditExampleCode = (code: string): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  const sourceFile = ts.createSourceFile(
    "documentation-example.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  if (Str.includes("@effect/schema")(code)) {
    issues.push("example-deprecated-effect-schema-import");
  }

  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      issues.push("example-type-assertion");
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      issues.push("example-any");
    }
    if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) {
      issues.push("example-declare");
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      HashSet.has(helperModules, node.moduleSpecifier.text) &&
      node.importClause !== undefined &&
      (node.importClause.name !== undefined ||
        node.importClause.namedBindings === undefined ||
        !ts.isNamespaceImport(node.importClause.namedBindings))
    ) {
      issues.push("example-named-helper-import");
    }
    if (ts.isVoidExpression(node)) {
      issues.push("example-void-discard");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.getText(sourceFile) === "Effect.gen" &&
      node.arguments[0] !== undefined &&
      (ts.isFunctionExpression(node.arguments[0]) || ts.isArrowFunction(node.arguments[0])) &&
      ts.isBlock(node.arguments[0].body) &&
      node.arguments[0].body.statements.length === 0
    ) {
      issues.push("example-empty-effect-generator");
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return A.dedupe(issues);
};

const auditSections = (doc: string): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  const lines = docLines(doc);
  const sections = sectionsFromLines(lines);
  let previousSectionRank = -1;
  let seenNonExampleSections = HashSet.empty<string>();
  let seenExampleTitles = HashSet.empty<string>();

  for (const [index, section] of sections.entries()) {
    const rank = sectionOrder[section.kind];
    if (rank < previousSectionRank) {
      issues.push("section-order");
    }
    previousSectionRank = rank;

    if (section.kind !== "Example") {
      if (HashSet.has(seenNonExampleSections, section.kind)) {
        issues.push(`duplicate-section:${section.kind}`);
      }
      seenNonExampleSections = HashSet.add(seenNonExampleSections, section.kind);
    }

    const body = sectionBody(section, index, sections, lines);
    const meaningfulBody = A.filter(body, (line) => Str.isNonEmpty(Str.trim(line)));
    if (A.isReadonlyArrayEmpty(meaningfulBody)) {
      issues.push(`empty-section:${section.kind}`);
    }

    if (section.kind === "When to use") {
      const opener = meaningfulBody[0];
      if (
        opener === undefined ||
        !A.some(["Use to ", "Use when ", "Use as ", "Use with "], (prefix) => Str.startsWith(prefix)(opener))
      ) {
        issues.push("when-to-use-opener");
      }
    }

    if (section.kind !== "Example") {
      continue;
    }

    if (section.title === undefined || Str.isEmpty(section.title)) {
      issues.push("example-title");
    } else if (HashSet.has(seenExampleTitles, section.title)) {
      issues.push(`duplicate-example-title:${section.title}`);
    } else {
      seenExampleTitles = HashSet.add(seenExampleTitles, section.title);
    }

    const fenceLines = A.filter(body, (line) => Str.startsWith("```")(Str.trim(line)));
    if (
      fenceLines.length !== 2 ||
      Str.trim(fenceLines[0] ?? "") !== "```ts" ||
      Str.trim(fenceLines[1] ?? "") !== "```"
    ) {
      issues.push("example-fence");
      continue;
    }

    const openingFence = body.findIndex((line) => Str.trim(line) === "```ts");
    const closingFence = body.findIndex((line, lineIndex) => lineIndex > openingFence && Str.trim(line) === "```");
    if (openingFence >= 0 && closingFence > openingFence) {
      issues.push(...auditExampleCode(A.join("\n")(body.slice(openingFence + 1, closingFence))));
    }
  }

  let currentSection: DocSection["kind"] | undefined;
  let seenTag = false;
  for (const line of lines) {
    const trimmed = Str.trim(line);
    const match = sectionPattern.exec(trimmed);
    if (
      match?.[1] === "When to use" ||
      match?.[1] === "Details" ||
      match?.[1] === "Gotchas" ||
      match?.[1] === "Example"
    ) {
      if (seenTag) {
        issues.push("section-after-tag");
      }
      currentSection = match[1];
      continue;
    }
    if (trimmed === "```ts" && currentSection !== "Example") {
      issues.push("loose-ts-fence");
    }
    if (Str.startsWith("@")(trimmed)) {
      seenTag = true;
      currentSection = undefined;
    }
  }

  return A.dedupe(issues);
};

const auditTags = (doc: string): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  const lines = docLines(doc);
  let previousRank = -1;

  for (const match of Str.matchAll(forbiddenTagPattern)(doc)) {
    issues.push(`forbidden-tag:@${match[1] ?? "unknown"}`);
  }

  for (const line of lines) {
    const trimmed = Str.trim(line);
    const tagMatch = /^@([A-Za-z][\w-]*)\b/u.exec(trimmed);
    if (tagMatch?.[1] !== undefined) {
      const rank = O.getOrUndefined(HashMap.get(tagRanks, tagMatch[1]));
      if (rank !== undefined) {
        if (rank < previousRank) {
          issues.push("tag-order");
        }
        previousRank = rank;
      }
    }
    if (/^@see\b/u.test(trimmed) && !/^@see\s+\{@link\s+[^}]+\}\s+\S/u.test(trimmed)) {
      issues.push("undescribed-see");
    }
    if (/^@deprecated\b/u.test(trimmed) && !/^@deprecated\s+.*\{@link\s+[^}]+\}.*\S/u.test(trimmed)) {
      issues.push("unlinked-deprecation");
    }
    if (/^@default\b/u.test(trimmed)) {
      issues.push("legacy-default-tag");
    }
    if (/^@(param|returns|throws)\s+\{/u.test(trimmed)) {
      issues.push("tsdoc-type-blob");
    }
    if (/^@(returns|throws)\s+-/u.test(trimmed)) {
      issues.push("tsdoc-result-hyphen");
    }
    if (/^@param\b/u.test(trimmed) && !/^@param\s+\S+\s+-\s+\S/u.test(trimmed)) {
      issues.push("tsdoc-param-description");
    }
    if (/^@(returns|throws)\s*$/u.test(trimmed)) {
      issues.push("tsdoc-result-description");
    }
  }

  return A.dedupe(issues);
};

const auditDoc = (doc: string, options: AuditDocOptions): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  const lines = docLines(doc);
  const categories = tagValues(doc, "category");
  const versions = tagValues(doc, "since");
  const paragraphs = leadParagraphCount(lines);

  if (Str.isEmpty(doc)) {
    issues.push("jsdoc");
  }
  if (options.requireDescription && !hasLeadDescription(lines)) {
    issues.push("description");
  }
  if (paragraphs > 1) {
    issues.push("lead-paragraph-count");
  }
  const firstLeadLine = A.findFirst(lines, (line) => Str.isNonEmpty(Str.trim(line)));
  if (O.exists(firstLeadLine, (line) => Str.startsWith("#")(Str.trim(line)))) {
    issues.push("lead-heading");
  }
  if (!options.allowPackageDocumentation && /@packageDocumentation\b/u.test(doc)) {
    issues.push("misplaced-packageDocumentation");
  }
  if (options.requireCategory && A.isReadonlyArrayEmpty(categories)) {
    issues.push("category");
  }
  if (categories.length > 1) {
    issues.push("duplicate-category");
  }
  for (const category of categories) {
    if (!isCanonicalJSDocCategory(category)) {
      issues.push(`category:${category}`);
    }
  }
  if (options.requireSince && A.isReadonlyArrayEmpty(versions)) {
    issues.push("since");
  }
  if (versions.length > 1) {
    issues.push("duplicate-since");
  }
  for (const version of versions) {
    if (version !== "0.0.0") {
      issues.push(`since:${version}`);
    }
  }
  if (options.requireExample && !canonicalExample.test(doc)) {
    issues.push("example");
  }

  return pipeIssues(issues, auditSections(doc), auditTags(doc));
};

const pipeIssues = (...groups: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  A.dedupe(A.flatten(groups));

const auditModuleDoc = (relativePath: string, sourceFile: ts.SourceFile): void => {
  auditedModules += 1;
  const match = /^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/u.exec(sourceFile.getFullText());
  const doc = match?.[1] ?? "";
  const issues = auditDoc(doc, {
    allowPackageDocumentation: true,
    requireCategory: false,
    requireDescription: true,
    requireExample: false,
    requireSince: true,
  });
  if (!/@packageDocumentation\b/u.test(doc)) {
    addFinding(relativePath, "<module>", [...issues, "packageDocumentation"]);
    return;
  }
  addFinding(relativePath, "<module>", issues);
};

const declarationNames = (statement: ts.Statement, sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  if (ts.isVariableStatement(statement)) {
    return A.map(statement.declarationList.declarations, (declaration) => declaration.name.getText(sourceFile));
  }

  if (
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  ) {
    return statement.name === undefined ? [ts.SyntaxKind[statement.kind]] : [statement.name.getText(sourceFile)];
  }

  return [ts.SyntaxKind[statement.kind]];
};

const auditDeclaration = (
  relativePath: string,
  symbol: string,
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): void => {
  auditedDeclarations += 1;
  addFinding(
    relativePath,
    symbol,
    auditDoc(owningJSDoc(statement, sourceFile), {
      allowPackageDocumentation: false,
      requireCategory: true,
      requireDescription: true,
      requireExample: true,
      requireSince: true,
    })
  );
};

const auditClassMembers = (relativePath: string, statement: ts.ClassDeclaration, sourceFile: ts.SourceFile): void => {
  for (const member of statement.members) {
    const isBehaviorMember =
      ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member);
    const isPublicInstanceProperty =
      ts.isPropertyDeclaration(member) && !hasModifier(member, ts.SyntaxKind.StaticKeyword);
    if (
      hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
      hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
      ts.isConstructorDeclaration(member) ||
      (!isBehaviorMember && !isPublicInstanceProperty)
    ) {
      continue;
    }

    auditedMembers += 1;
    const memberTags = HashSet.fromIterable(A.map(ts.getJSDocTags(member), (tag) => tag.tagName.text));
    const issues = [
      ...auditDoc(owningJSDoc(member, sourceFile), {
        allowPackageDocumentation: false,
        requireCategory: false,
        requireDescription: true,
        requireExample: true,
        requireSince: false,
      }),
      ...(isBehaviorMember && !HashSet.has(memberTags, "returns") && !HashSet.has(memberTags, "return")
        ? ["returns"]
        : []),
      ...(ts.isMethodDeclaration(member) &&
      A.some(member.parameters, (parameter) => ts.getJSDocParameterTags(parameter).length === 0)
        ? ["param"]
        : []),
    ];

    addFinding(relativePath, `${statement.name?.text ?? "anonymous"}.${member.name.getText(sourceFile)}`, issues);
  }
};

const auditChecks = (relativePath: string, sourceFile: ts.SourceFile): void => {
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "S" &&
      HashSet.has(checkFactories, node.expression.name.text)
    ) {
      auditedChecks += 1;
      const carriesMessage = A.some(
        node.arguments,
        (argument) =>
          ts.isObjectLiteralExpression(argument) &&
          A.some(argument.properties, (property) => property.name?.getText(sourceFile) === "message")
      );

      if (!carriesMessage) {
        addFinding(relativePath, node.expression.getText(sourceFile), ["message"]);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

for await (const relativePath of sourceModules.scan({ cwd: sourceRoot.pathname })) {
  if (!includedModule(relativePath)) {
    continue;
  }

  const sourceFile = ts.createSourceFile(
    relativePath,
    await Bun.file(new URL(relativePath, sourceRoot)).text(),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  auditModuleDoc(relativePath, sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
      continue;
    }

    if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const symbol of declarationNames(statement, sourceFile)) {
        auditDeclaration(relativePath, symbol, statement, sourceFile);
      }
    }

    if (ts.isClassDeclaration(statement)) {
      auditClassMembers(relativePath, statement, sourceFile);
    }
  }

  auditChecks(relativePath, sourceFile);
}

Effect.runSync(
  A.isReadonlyArrayNonEmpty(findings)
    ? S.encodeEffect(S.fromJsonString(S.Unknown.pipe(S.Array)))(findings).pipe(
        Effect.flatMap((encodedFindings) =>
          Effect.die(
            `Documentation audit failed (${findings.length} findings across ${auditedModules} modules, ${auditedDeclarations} owning declarations, ${auditedMembers} public members, and ${auditedChecks} schema checks):\n${encodedFindings}`
          )
        )
      )
    : Effect.log({
        modules: auditedModules,
        declarations: auditedDeclarations,
        publicMembers: auditedMembers,
        messagedChecks: auditedChecks,
        failures: 0,
      })
);
