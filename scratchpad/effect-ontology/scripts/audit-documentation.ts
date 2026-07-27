/**
 * Audits public JSDoc and local check metadata across the Domain tree.
 *
 * @remarks
 * Exported declarations require examples, categories, and versions. Public
 * schema-backed class behavior additionally requires examples, parameter
 * descriptions, and return descriptions, including behavior exposed through
 * private implementation classes. Every locally constructed schema check must
 * carry a user-facing `message`.
 *
 * @example
 * ```sh
 * bun run --cwd scratchpad audit:effect-ontology-docs
 * ```
 *
 * @category tooling
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as ts from "typescript";

interface Finding {
  readonly file: string;
  readonly symbol: string;
  readonly missing: ReadonlyArray<string>;
}

const requiredExportTags = ["example", "category", "since"] as const;
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

const auditDeclarationTags = (file: string, symbol: string, node: ts.Node, fallback?: ts.Node): void => {
  auditedDeclarations += 1;
  const declarationTagNames = new Set([...tagNames(node), ...(fallback === undefined ? [] : tagNames(fallback))]);
  const missing = requiredExportTags.filter((tag) => !declarationTagNames.has(tag));

  if (missing.length > 0) {
    findings.push({ file, symbol, missing });
  }
};

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
      if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          auditDeclarationTags(relativePath, element.name.text, element, statement);
        }
      } else {
        const symbol =
          statement.exportClause !== undefined && ts.isNamespaceExport(statement.exportClause)
            ? statement.exportClause.name.text
            : (statement.moduleSpecifier?.getText(sourceFile) ?? "export");
        auditDeclarationTags(relativePath, symbol, statement);
      }

      continue;
    }

    if (hasModifier(statement, ts.SyntaxKind.ExportKeyword) && !ts.isExportAssignment(statement)) {
      for (const symbol of declarationNames(statement, sourceFile)) {
        auditDeclarationTags(relativePath, symbol, statement);
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
        ...(memberTags.has("example") ? [] : ["example"]),
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
  throw new Error(`Documentation audit failed:\n${JSON.stringify(findings, null, 2)}`);
}

Effect.runSync(
  Effect.log({
    declarations: auditedDeclarations,
    publicMethods: auditedMethods,
    messagedChecks: auditedChecks,
    failures: 0,
  })
);
