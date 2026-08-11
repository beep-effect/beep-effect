/**
 * Audits public JSDoc and local check metadata across the Domain tree.
 *
 * **Details**
 *
 * Owning declarations require categories and versions, while value-level
 * declarations additionally require examples. Public schema-backed class
 * behavior requires examples, parameter descriptions, and return descriptions,
 * including behavior exposed through private implementation classes. Every
 * locally constructed schema check must carry a user-facing `message`.
 *
 * **Example** (Run the documentation audit)
 *
 * ```ts
 * const command = "bun run --cwd scratchpad audit:effect-ontology-docs"
 * console.log(command)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as ts from "typescript";

interface Finding {
  readonly file: string;
  readonly symbol: string;
  readonly missing: ReadonlyArray<string>;
}

const requiredDeclarationTags = ["category", "since"] as const;
const requiredValueDeclarationTags = ["example", ...requiredDeclarationTags] as const;
const canonicalExample = /\*\*Example\*\*\s*\([^\r\n)]+\)/;
const checkFactories = new Set([
  "isBetween",
  "isGreaterThan",
  "isGreaterThanOrEqualTo",
  "isInt",
  "isLessThanOrEqualTo",
  "isPattern",
  "makeFilter",
]);
const domainRoot = new URL("../Domain/", import.meta.url);
const domainModules = new Bun.Glob("**/*.ts");
const findings: Array<Finding> = [];
let auditedDeclarations = 0;
let auditedMethods = 0;
let auditedChecks = 0;

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;

const tagNames = (node: ts.Node): ReadonlySet<string> => new Set(ts.getJSDocTags(node).map((tag) => tag.tagName.text));

const hasExample = (node: ts.Node, sourceFile: ts.SourceFile): boolean =>
  tagNames(node).has("example") || canonicalExample.test(node.getFullText(sourceFile));

const auditDeclarationTags = (
  file: string,
  symbol: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
  requireExample: boolean
): void => {
  auditedDeclarations += 1;
  const declarationTagNames = tagNames(node);
  const requiredTags = requireExample ? requiredValueDeclarationTags : requiredDeclarationTags;
  const missing = requiredTags.filter((tag) =>
    tag === "example" ? !hasExample(node, sourceFile) : !declarationTagNames.has(tag)
  );

  if (missing.length > 0) {
    findings.push({ file, symbol, missing });
  }
};

const isValueLevelDeclaration = (statement: ts.Statement): boolean =>
  ts.isVariableStatement(statement) ||
  ts.isFunctionDeclaration(statement) ||
  ts.isClassDeclaration(statement) ||
  ts.isEnumDeclaration(statement);

const declarationNames = (statement: ts.Statement, sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => declaration.name.getText(sourceFile));
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

for await (const relativePath of domainModules.scan({
  cwd: domainRoot.pathname,
})) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    await Bun.file(new URL(relativePath, domainRoot)).text(),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      continue;
    }

    if (hasModifier(statement, ts.SyntaxKind.ExportKeyword) && !ts.isExportAssignment(statement)) {
      for (const symbol of declarationNames(statement, sourceFile)) {
        auditDeclarationTags(relativePath, symbol, statement, sourceFile, isValueLevelDeclaration(statement));
      }
    }

    if (!ts.isClassDeclaration(statement)) {
      continue;
    }

    for (const member of statement.members) {
      if (
        hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
        ts.isConstructorDeclaration(member) ||
        (!ts.isMethodDeclaration(member) &&
          !ts.isGetAccessorDeclaration(member) &&
          !ts.isSetAccessorDeclaration(member))
      ) {
        continue;
      }

      auditedMethods += 1;
      const memberTags = tagNames(member);
      const missing = [
        ...(hasExample(member, sourceFile) ? [] : ["example"]),
        ...(memberTags.has("returns") || memberTags.has("return") ? [] : ["returns"]),
        ...(ts.isMethodDeclaration(member) &&
        member.parameters.some((parameter) => ts.getJSDocParameterTags(parameter).length === 0)
          ? ["param"]
          : []),
      ];

      if (missing.length > 0) {
        findings.push({
          file: relativePath,
          symbol: `${statement.name?.text ?? "anonymous"}.${member.name.getText(sourceFile)}`,
          missing,
        });
      }
    }
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "S" &&
      checkFactories.has(node.expression.name.text)
    ) {
      auditedChecks += 1;
      const carriesMessage = node.arguments.some(
        (argument) =>
          ts.isObjectLiteralExpression(argument) &&
          argument.properties.some((property) => property.name?.getText(sourceFile) === "message")
      );

      if (!carriesMessage) {
        findings.push({
          file: relativePath,
          symbol: node.expression.getText(sourceFile),
          missing: ["message"],
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (findings.length > 0) {
  const encodeFindings = S.encodeSync(S.fromJsonString(S.Array(S.Unknown)));
  throw new Error(`Documentation audit failed:\n${encodeFindings(findings)}`);
}

Effect.runSync(
  Effect.log({
    declarations: auditedDeclarations,
    publicMethods: auditedMethods,
    messagedChecks: auditedChecks,
    failures: 0,
  })
);
