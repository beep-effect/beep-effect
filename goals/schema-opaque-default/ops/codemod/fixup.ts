#!/usr/bin/env bun
/**
 * Diagnostics-driven consumer fix-up for the schema-opaque-default codemod.
 *
 * Run from the repository root after `run.ts`, feeding it the compiler output
 * of `bun run check` / `quality test-tsgo` (turbo `@pkg:task:` prefixes are
 * understood):
 *
 *   bun run goals/schema-opaque-default/ops/codemod/fixup.ts <log>... [--check] [--report <file.json>]
 *     [--only <repo-relative file>...] [--skip <repo-relative file>...]
 *
 * Diagnostic positions are only valid against the tree the log was produced
 * from: re-run a fresh check before re-running the fix-up (or narrow it to
 * untouched files with `--only`).
 *
 * Branding (D4) makes a plain object no longer assignable to a schema class
 * type. Rules, each applied only when the diagnostic proves it:
 *
 * - brand mismatch → wrap the offending value as `X.make(<value>)`, following
 *   `Types of property 'p'` hops into object literals, array elements (by
 *   `_tag` when `X` is tagged), arrow-function bodies and `return` values;
 *   `X` gets a value import when the file has none (same package: relative
 *   path; other package: its `./*` export subpath).
 * - `TS2554 Expected 1-2 arguments, but got 0` on `X.make()` → `X.make({})`
 *   (an all-optional `S.Opaque` takes its input object explicitly).
 * - `TS2527` on `export const A = B` → `export const A: typeof B = B`.
 *
 * Everything else is reported as manual work. Re-running on a fresh log is
 * safe: fixed sites no longer produce diagnostics.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import ts from "@typescript/typescript6";
import { indexSchemaClasses } from "./codemod.ts";
import type { SchemaClassEntry } from "./codemod.ts";

interface Diagnostic {
  readonly code: number;
  readonly col: number;
  readonly file: string;
  readonly line: number;
  readonly lines: ReadonlyArray<string>;
}

interface Edit {
  readonly end: number;
  readonly start: number;
  readonly text: string;
}

interface PackageInfo {
  readonly dir: string;
  /** Explicit (non-pattern) export subpaths and their repo-relative target files. */
  readonly entries: ReadonlyArray<readonly [string, string]>;
  /** Subpath prefixes the export map hides (`"./internal/*": null`). */
  readonly excluded: ReadonlyArray<string>;
  readonly name: string;
  /** `./*` export pattern split around `*`, e.g. `["src/", ".ts"]`. */
  readonly star: readonly [string, string] | undefined;
}

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SCOPE_ROOTS = ["apps", "packages", "infra", "scratchpad", "goals", "explorations", "tools"] as const;

const gitFiles = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  execFileSync("git", ["ls-files", ...args], { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split("\n")
    .filter((file) => file.length > 0);

const exportTarget = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    for (const key of ["types", "import", "default", "bun"]) {
      const nested = (value as Record<string, unknown>)[key];
      const found = exportTarget(nested);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

export const listPackages = (): ReadonlyArray<PackageInfo> =>
  gitFiles(["--", "**/package.json"])
    .filter((file) => !file.includes("node_modules/"))
    .flatMap((manifest) => {
      try {
        const json = JSON.parse(readFileSync(path.join(repoRoot, manifest), "utf8"));
        if (typeof json.name !== "string") return [];
        // `"./_generated/*": null`-style exclusions hide those subpaths from the `./*` pattern.
        const excluded = Object.entries((json.exports ?? {}) as Record<string, unknown>)
          .filter(([key, value]) => value === null && key.endsWith("/*"))
          .map(([key]) => key.slice(2, -1));
        const target = exportTarget(json.exports?.["./*"]);
        const star = target?.includes("*")
          ? ([
              target.slice(0, target.indexOf("*")).replace(/^\.\//, ""),
              target.slice(target.indexOf("*") + 1),
            ] as const)
          : undefined;
        const dir = path.dirname(manifest);
        const entries: Array<readonly [string, string]> = [];
        for (const [key, value] of Object.entries((json.exports ?? {}) as Record<string, unknown>)) {
          const file = exportTarget(value);
          if (key.includes("*") || file === undefined || file.includes("*")) continue;
          entries.push([key, path.posix.normalize(path.posix.join(dir, file))]);
        }
        return [{ name: json.name, dir, star, entries, excluded }];
      } catch {
        return [];
      }
    });

// ---------------------------------------------------------------------------
// Log parsing
// ---------------------------------------------------------------------------

const HEAD = /^(?:(@[^:\s]+\/[^:\s]+|[^:\s@][^:\s]*):[\w:-]+: )?(\S+?\.tsx?)\((\d+),(\d+)\): error TS(\d+): (.*)$/;
const PREFIX = /^(?:@[^:\s]+\/[^:\s]+|[^:\s@][^:\s]*):[\w:-]+: /;

const parseLog = (text: string, packageDirs: ReadonlyMap<string, string>): ReadonlyArray<Diagnostic> => {
  const out: Array<Diagnostic> = [];
  let current: { file: string; line: number; col: number; code: number; lines: Array<string> } | undefined;
  const flush = (): void => {
    if (current !== undefined) out.push(current);
    current = undefined;
  };
  for (const raw of text.split("\n")) {
    const match = HEAD.exec(raw);
    if (match !== null) {
      flush();
      const [, pkg, file = "", line = "0", col = "0", code = "0", message = ""] = match;
      const base = pkg === undefined ? "" : (packageDirs.get(pkg) ?? "");
      const candidates = [path.join(repoRoot, base, file), path.join(repoRoot, file)];
      const absolute = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? file;
      current = {
        file: path.relative(repoRoot, absolute),
        line: Number(line),
        col: Number(col),
        code: Number(code),
        lines: [message],
      };
      continue;
    }
    const body = raw.replace(PREFIX, "");
    if (current !== undefined && /^\s+\S/.test(body)) current.lines.push(body.trim());
    else flush();
  }
  flush();
  const seen = new Set<string>();
  return out.filter((diagnostic) => {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.col}:${diagnostic.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ---------------------------------------------------------------------------
// Chain interpretation
// ---------------------------------------------------------------------------

const TYPE_NAME = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)?$/;
const EXACT = String.raw`(?: with 'exactOptionalPropertyTypes: true'\. Consider adding 'undefined' to the types of the target's properties\.|\.)`;
const ARGUMENT_LINE = new RegExp(`^Argument of type '(.*)' is not assignable to parameter of type '(.*)'${EXACT}$`);
const TYPE_LINE = new RegExp(`^Type '(.*)' is not assignable to type '(.*)'${EXACT}$`);
const MISSING_LINE = /^Property 'brand' is missing in type '(.*)' but required in type '([^']+)'\.$/;
const BRAND_LITERAL = /^\{ readonly (brand|nominal): unique symbol; \}$/;
const PROPERTY_HOP = /^Types of property '([^']+)' are incompatible\.$/;
const DOTTED_HOP = /^The types of '([^']+)' are incompatible between these types\.$/;

interface BrandPlan {
  /** Whether the value at the end of the path has exactly the reported source type. */
  readonly direct: boolean;
  /** The class was picked out of a union target (only `_tag`-matched literals are safe). */
  readonly fromUnion: boolean;
  /** Property path from the diagnostic expression to the value. */
  readonly hops: ReadonlyArray<string>;
  /** The schema class to construct with. */
  readonly name: string;
}

const sourceTypeOf = (line: string): string | undefined =>
  ARGUMENT_LINE.exec(line)?.[1] ?? TYPE_LINE.exec(line)?.[1] ?? MISSING_LINE.exec(line)?.[1];

/** Reads which schema class a brand diagnostic wants and where its value sits. */
const brandPlan = (diagnostic: Diagnostic): BrandPlan | undefined => {
  const lines = diagnostic.lines;
  let nameIndex = -1;
  let name: string | undefined;
  lines.forEach((line, index) => {
    const missing = MISSING_LINE.exec(line);
    if (missing?.[2] !== undefined && BRAND_LITERAL.test(missing[2])) {
      // `... but required in type '{ readonly brand: unique symbol; }'`: the class is the
      // nearest enclosing assignability target that names a type.
      for (let back = index - 1; back >= 0; back--) {
        const backLine = lines[back] ?? "";
        if (PROPERTY_HOP.test(backLine) || DOTTED_HOP.test(backLine)) break;
        const enclosing = TYPE_LINE.exec(lines[back] ?? "") ?? ARGUMENT_LINE.exec(lines[back] ?? "");
        const enclosingName = enclosing?.[2]?.replace(/ \| undefined$/, "");
        if (enclosingName !== undefined && TYPE_NAME.test(enclosingName)) {
          name = enclosingName;
          nameIndex = back;
          break;
        }
      }
    } else if (missing?.[2] !== undefined) {
      name = missing[2];
      nameIndex = index;
    } else if (line === "Types of property 'brand' are incompatible." && index > 0) {
      const previous = TYPE_LINE.exec(lines[index - 1] ?? "") ?? ARGUMENT_LINE.exec(lines[index - 1] ?? "");
      if (previous?.[2] !== undefined) {
        name = previous[2];
        nameIndex = index - 1;
      }
    }
  });
  if (name === undefined || !TYPE_NAME.test(name)) return undefined;
  const hops: Array<string> = [];
  let lastSource: string | undefined = sourceTypeOf(lines[0] ?? "");
  for (let index = 0; index < nameIndex; index++) {
    const line = lines[index] ?? "";
    const hop = PROPERTY_HOP.exec(line)?.[1] ?? DOTTED_HOP.exec(line)?.[1];
    if (hop !== undefined) {
      hops.push(...hop.split("."));
      lastSource = sourceTypeOf(lines[index + 1] ?? "");
    }
  }
  const valueSource = sourceTypeOf(lines[nameIndex] ?? "");
  const targetOf = (line: string): string | undefined => ARGUMENT_LINE.exec(line)?.[2] ?? TYPE_LINE.exec(line)?.[2];
  const fromUnion = lines
    .slice(0, nameIndex + 1)
    .some((line) => / \| /.test((targetOf(line) ?? "").replace(/ \| undefined$/, "")));
  return { name, hops, direct: lastSource !== undefined && lastSource === valueSource, fromUnion };
};

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

const findNodeAt = (sf: ts.SourceFile, pos: number): ts.Node | undefined => {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (pos >= node.getStart(sf) && pos < node.end) {
      found = node;
      ts.forEachChild(node, visit);
    }
  };
  visit(sf);
  return found;
};

type Target = ts.Expression | ts.ShorthandPropertyAssignment;

/** The expression a diagnostic at `pos` is about. */
const targetAt = (sf: ts.SourceFile, pos: number): Target | undefined => {
  let node = findNodeAt(sf, pos);
  if (node === undefined) return undefined;
  if (node.kind === ts.SyntaxKind.ReturnKeyword && ts.isReturnStatement(node.parent)) return node.parent.expression;
  if (ts.isReturnStatement(node)) return node.expression;
  if (ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)) return node.parent;
  if (ts.isIdentifier(node) && ts.isParameter(node.parent) && node.parent.name === node) return node.parent.initializer;
  if (
    ts.isJsxOpeningLikeElement(node.parent) ||
    ts.isJsxClosingElement(node.parent) ||
    ts.isJsxAttribute(node.parent)
  ) {
    return undefined;
  }
  if (
    ts.isIdentifier(node) &&
    "name" in node.parent &&
    (node.parent as ts.NamedDeclaration).name === node &&
    !ts.isPropertyAccessExpression(node.parent)
  ) {
    if (
      !ts.isPropertyAssignment(node.parent) &&
      !ts.isVariableDeclaration(node.parent) &&
      !ts.isPropertyDeclaration(node.parent)
    ) {
      return undefined;
    }
  }
  if (
    ts.isIdentifier(node) &&
    (ts.isPropertyAssignment(node.parent) ||
      ts.isVariableDeclaration(node.parent) ||
      ts.isPropertyDeclaration(node.parent)) &&
    node.parent.name === node
  ) {
    return node.parent.initializer;
  }
  while (
    node.parent !== undefined &&
    ts.isExpression(node.parent) &&
    node.parent.getStart(sf) === pos &&
    !ts.isArrowFunction(node.parent)
  ) {
    node = node.parent;
  }
  return ts.isExpression(node) ? node : undefined;
};

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node) || ts.isAsExpression(node)
    ? unwrap(node.expression)
    : node;

const propertyNamed = (literal: ts.ObjectLiteralExpression, key: string): Target | undefined => {
  for (const property of literal.properties) {
    if (property.name === undefined) continue;
    const text = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined;
    if (text !== key) continue;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property;
  }
  return undefined;
};

const tagOfLiteral = (literal: ts.ObjectLiteralExpression): string | undefined => {
  const tag = propertyNamed(literal, "_tag");
  return tag !== undefined && !ts.isShorthandPropertyAssignment(tag) && ts.isStringLiteral(unwrap(tag))
    ? (unwrap(tag) as ts.StringLiteral).text
    : undefined;
};

/** Values to wrap for a plan: follows hops, then fans out over arrays and function bodies. */
const resolveValues = (
  target: Target,
  plan: BrandPlan,
  tagOf: (name: string) => string | undefined
): ReadonlyArray<Target> => {
  let node: Target = target;
  for (const hop of plan.hops) {
    if (ts.isShorthandPropertyAssignment(node)) return [];
    const inner = unwrap(node);
    if (!ts.isObjectLiteralExpression(inner)) return [];
    const next = propertyNamed(inner, hop);
    if (next === undefined) return [];
    node = next;
  }
  if (ts.isShorthandPropertyAssignment(node)) return [node];
  const inner = unwrap(node);
  if (ts.isArrayLiteralExpression(inner)) {
    const tag = tagOf(plan.name);
    return inner.elements.filter((element) => {
      const value = unwrap(element);
      if (!ts.isObjectLiteralExpression(value)) return false;
      return tag === undefined || tagOfLiteral(value) === tag;
    });
  }
  if (ts.isArrowFunction(inner)) {
    if (!ts.isBlock(inner.body)) return [inner.body];
    const returns: Array<ts.Expression> = [];
    const visit = (child: ts.Node): void => {
      if (ts.isFunctionLike(child)) return;
      if (ts.isReturnStatement(child) && child.expression !== undefined) returns.push(child.expression);
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(inner.body, visit);
    return returns;
  }
  return plan.direct || ts.isObjectLiteralExpression(inner) ? [node] : [];
};

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

type BindingKind = "local" | "value-import" | "type-import" | "absent";

const bindingOf = (sf: ts.SourceFile, name: string): { kind: BindingKind; node?: ts.Node } => {
  const head = name.split(".")[0] ?? name;
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) continue;
    const clause = statement.importClause;
    const bindings = clause.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings) && bindings.name.text === head) {
      return { kind: clause.isTypeOnly ? "type-import" : "value-import", node: statement };
    }
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.name.text === head) {
          return { kind: clause.isTypeOnly || element.isTypeOnly ? "type-import" : "value-import", node: element };
        }
      }
    }
  }
  let local = false;
  const visit = (node: ts.Node): void => {
    if (local) return;
    if (
      (ts.isClassDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      node.name.text === head
    ) {
      local = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { kind: local ? "local" : "absent" };
};

/**
 * Turns type-only imports into value imports, one replacement per import
 * declaration so several promoted names never produce overlapping edits.
 */
const promotionEdits = (sf: ts.SourceFile, specifiers: ReadonlyArray<ts.ImportSpecifier>): ReadonlyArray<Edit> => {
  const byDeclaration = new Map<ts.ImportDeclaration | ts.JSDocImportTag, Set<ts.ImportSpecifier>>();
  for (const specifier of specifiers) {
    const declaration = specifier.parent.parent.parent;
    const set = byDeclaration.get(declaration) ?? new Set<ts.ImportSpecifier>();
    set.add(specifier);
    byDeclaration.set(declaration, set);
  }
  const edits: Array<Edit> = [];
  for (const [declaration, promoted] of byDeclaration) {
    const clause = declaration.importClause;
    const named = clause?.namedBindings;
    if (clause === undefined || named === undefined || !ts.isNamedImports(named)) continue;
    if (!clause.isTypeOnly) {
      // `import { type X }` → `import { X }`
      for (const specifier of promoted) {
        edits.push({
          start: specifier.getStart(sf),
          end: (specifier.propertyName ?? specifier.name).getStart(sf),
          text: "",
        });
      }
      continue;
    }
    const spec = declaration.moduleSpecifier.getText(sf);
    const values = named.elements.filter((element) => promoted.has(element)).map((element) => element.getText(sf));
    const types = named.elements.filter((element) => !promoted.has(element)).map((element) => element.getText(sf));
    const valueImport = `import { ${values.join(", ")} } from ${spec};`;
    const text = types.length === 0 ? valueImport : `import type { ${types.join(", ")} } from ${spec};\n${valueImport}`;
    edits.push({ start: declaration.getStart(sf), end: declaration.end, text });
  }
  return edits;
};

const packageOf = (file: string, packages: ReadonlyArray<PackageInfo>): PackageInfo | undefined => {
  let best: PackageInfo | undefined;
  for (const info of packages) {
    if (file.startsWith(`${info.dir}/`) && (best === undefined || info.dir.length > best.dir.length)) best = info;
  }
  return best;
};

/** Module specifier the consumer uses to import `declaring`, or undefined when no public path exists. */
export const specifierFor = (
  consumer: string,
  declaring: string,
  packages: ReadonlyArray<PackageInfo>
): string | undefined => {
  const from = packageOf(consumer, packages);
  const to = packageOf(declaring, packages);
  if (to === undefined) return undefined;
  // Package tests import package source through its public `@beep/*` path (repo law).
  const isTest = /\/(test|tests|__tests__)\//.test(consumer.slice(to.dir.length));
  if (from?.dir === to.dir && !(isTest && consumer.startsWith(`${to.dir}/`) && to.dir.startsWith("packages/"))) {
    const relative = path.posix.relative(path.posix.dirname(consumer), declaring);
    return relative.startsWith(".") ? relative : `./${relative}`;
  }
  if (from?.dir === to.dir && isTest) {
    const viaPackage = packageSpecifier(to, declaring);
    if (viaPackage !== undefined) return viaPackage;
    const relative = path.posix.relative(path.posix.dirname(consumer), declaring);
    return relative.startsWith(".") ? relative : `./${relative}`;
  }
  return packageSpecifier(to, declaring);
};

const packageSpecifier = (to: PackageInfo, declaring: string): string | undefined => {
  const inside = path.posix.relative(to.dir, declaring);
  if (to.star !== undefined) {
    const [prefix, suffix] = to.star;
    const sub = inside.slice(prefix.length, inside.length - suffix.length);
    if (inside.startsWith(prefix) && inside.endsWith(suffix) && !to.excluded.some((hidden) => sub.startsWith(hidden))) {
      return `${to.name}/${sub}`;
    }
  }
  // Explicit export map: the shortest subpath whose entry file re-exports the declaration.
  const reachable = to.entries
    .filter(([, target]) => reExports(target, declaring, 0))
    .map(([key]) => (key === "." ? to.name : `${to.name}/${key.replace(/^\.\//, "")}`))
    .sort((left, right) => right.length - left.length);
  return reachable[reachable.length - 1];
};

/** Whether `entry` is `declaring` or reaches it through relative `export * from` / `export { } from` chains. */
const reExports = (entry: string, declaring: string, depth: number): boolean => {
  if (entry === declaring) return true;
  if (depth > 4 || !existsSync(path.join(repoRoot, entry))) return false;
  const text = readFileSync(path.join(repoRoot, entry), "utf8");
  for (const match of text.matchAll(/export\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+"(\.[^"]+)"/g)) {
    if (/export\s+\*\s+as\s/.test(match[0])) continue;
    const spec = match[1] ?? "";
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(entry), spec)).replace(/\.(js|mjs)$/, "");
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    if (candidates.some((candidate) => reExports(candidate, declaring, depth + 1))) return true;
  }
  return false;
};

const addImport = (sf: ts.SourceFile, name: string, spec: string): Edit => {
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === spec &&
      statement.importClause !== undefined &&
      !statement.importClause.isTypeOnly &&
      statement.importClause.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const elements = statement.importClause.namedBindings.elements;
      const last = elements[elements.length - 1];
      if (last !== undefined) return { start: last.end, end: last.end, text: `, ${name}` };
    }
  }
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const anchor = imports[imports.length - 1];
  const at = anchor?.end ?? 0;
  return {
    start: at,
    end: at,
    text: `${anchor === undefined ? "" : "\n"}import { ${name} } from "${spec}";${anchor === undefined ? "\n" : ""}`,
  };
};

/** Description string of a class's `annoteSchema`/`annote`/`annotate` call, if literal. */
const annotationDescription = (node: ts.ClassDeclaration): string | undefined => {
  let found: string | undefined;
  const visit = (child: ts.Node): void => {
    if (found !== undefined) return;
    if (
      ts.isPropertyAssignment(child) &&
      ts.isIdentifier(child.name) &&
      child.name.text === "description" &&
      (ts.isStringLiteral(child.initializer) || ts.isNoSubstitutionTemplateLiteral(child.initializer))
    ) {
      found = child.initializer.text;
      return;
    }
    if (ts.isClassElement(child)) return;
    ts.forEachChild(child, visit);
  };
  for (const clause of node.heritageClauses ?? []) visit(clause);
  return found;
};

/** `class X` → `export class X`, adding a docgen-ready JSDoc when the class has none. */
const exportEdit = (sf: ts.SourceFile, name: string): Edit | undefined => {
  let target: ts.ClassDeclaration | undefined;
  for (const statement of sf.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text === name) target = statement;
  }
  if (target === undefined) return undefined;
  const start = target.getStart(sf);
  const hasDoc = ts.getJSDocCommentsAndTags(target).length > 0;
  const description = annotationDescription(target) ?? `Schema for ${name}.`;
  const doc = hasDoc
    ? ""
    : `/**\n * ${description.replace(/\*\//g, "*\\/")}\n *\n * @category models\n * @since 0.0.0\n */\n`;
  return { start, end: start, text: `${doc}export ` };
};

/** Non-exported top-level classes of `file` that its exported declarations mention. */
const hiddenReferenced = (sf: ts.SourceFile): ReadonlyArray<string> => {
  const hidden = new Set<string>();
  const exportedNames = new Set<string>();
  for (const statement of sf.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements)
        exportedNames.add((element.propertyName ?? element.name).text);
    }
  }
  for (const statement of sf.statements) {
    if (ts.isClassDeclaration(statement) && statement.name !== undefined && statement.heritageClauses !== undefined) {
      const exported = (ts.getModifiers(statement) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!exported && !exportedNames.has(statement.name.text)) hidden.add(statement.name.text);
    }
  }
  if (hidden.size === 0) return [];
  // Worklist from exported statements through local (non-exported) consts and classes.
  const locals = new Map<string, ts.Node>();
  for (const statement of sf.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
          locals.set(declaration.name.text, declaration.initializer);
        }
      }
    } else if (ts.isClassDeclaration(statement) && statement.name !== undefined) {
      locals.set(statement.name.text, statement);
    }
  }
  const isExported = (statement: ts.Statement): boolean =>
    (ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) ||
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && exportedNames.has(declaration.name.text)
      )) ||
    (ts.isClassDeclaration(statement) && statement.name !== undefined && exportedNames.has(statement.name.text));
  const used = new Set<string>();
  const seen = new Set<string>();
  const queue: Array<ts.Node> = sf.statements.filter(isExported);
  while (queue.length > 0) {
    const next = queue.pop() as ts.Node;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && !seen.has(node.text)) {
        if (hidden.has(node.text)) used.add(node.text);
        const local = locals.get(node.text);
        if (local !== undefined) {
          seen.add(node.text);
          queue.push(local);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(next);
  }
  return [...used];
};

/** Hidden classes in `file` and in the workspace modules it imports. */
const hiddenClassesBehind = (
  file: string,
  packages: ReadonlyArray<PackageInfo>,
  sourceOf: (file: string) => ts.SourceFile | undefined
): ReadonlyArray<{ readonly file: string; readonly name: string }> => {
  const sf = sourceOf(file);
  if (sf === undefined) return [];
  const modules = new Set<string>([file]);
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const spec = statement.moduleSpecifier.text;
    for (const target of resolveModule(file, spec, packages)) modules.add(target);
  }
  return [...modules].flatMap((module) => {
    const moduleSf = sourceOf(module);
    return moduleSf === undefined ? [] : hiddenReferenced(moduleSf).map((name) => ({ file: module, name }));
  });
};

/** Repo files a specifier resolves to (barrels expanded one level). */
const resolveModule = (from: string, spec: string, packages: ReadonlyArray<PackageInfo>): ReadonlyArray<string> => {
  const withExt = (base: string): ReadonlyArray<string> =>
    [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].filter(
      (candidate) => existsSync(path.join(repoRoot, candidate)) && /\.tsx?$/.test(candidate)
    );
  let direct: ReadonlyArray<string> = [];
  if (spec.startsWith(".")) {
    direct = withExt(path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.(js|mjs)$/, ""));
  } else {
    const info = packages
      .filter((candidate) => spec === candidate.name || spec.startsWith(`${candidate.name}/`))
      .sort((left, right) => right.name.length - left.name.length)[0];
    if (info === undefined) return [];
    const sub = spec === info.name ? "." : `./${spec.slice(info.name.length + 1)}`;
    const entry = info.entries.find(([key]) => key === sub);
    if (entry !== undefined) direct = [entry[1]];
    else if (info.star !== undefined && sub !== ".")
      direct = withExt(path.posix.join(info.dir, `${info.star[0]}${sub.slice(2)}`).replace(/\.ts$/, ""));
  }
  const out = new Set<string>(direct);
  for (const file of direct) {
    const text = readFileSync(path.join(repoRoot, file), "utf8");
    for (const match of text.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+"(\.[^"]+)"/g)) {
      for (const target of withExt(
        path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1] ?? "")).replace(/\.(js|mjs)$/, "")
      )) {
        out.add(target);
      }
    }
  }
  return [...out];
};

/** Whether an import specifier node comes from a relative path or a workspace package. */
const importsFromWorkspace = (node: ts.Node, packages: ReadonlyArray<PackageInfo>): boolean => {
  let current: ts.Node | undefined = node;
  while (current !== undefined && !ts.isImportDeclaration(current)) current = current.parent;
  if (current === undefined || !ts.isStringLiteral(current.moduleSpecifier)) return false;
  const spec = current.moduleSpecifier.text;
  return (
    spec.startsWith(".") ||
    spec.startsWith("@/") ||
    spec.startsWith("#") ||
    packages.some((info) => spec === info.name || spec.startsWith(`${info.name}/`))
  );
};

/** Parse-error count of a rewritten file (a guard against overlapping edits). */
const syntaxErrors = (file: string, text: string): number => {
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const diagnostics: ReadonlyArray<unknown> =
    (sf as unknown as { parseDiagnostics?: ReadonlyArray<unknown> }).parseDiagnostics ?? [];
  return diagnostics.length;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = (): void => {
  const argv = process.argv.slice(2);
  const auditUnions = argv.includes("--audit-unions");
  const check = argv.includes("--check") || auditUnions;
  const reportIndex = argv.indexOf("--report");
  const report = reportIndex >= 0 ? argv[reportIndex + 1] : undefined;
  const stops = ["--only", "--skip"].map((flag) => argv.indexOf(flag)).filter((at) => at >= 0);
  const stop = stops.length === 0 ? -1 : Math.min(...stops);
  const logs = argv
    .slice(0, stop < 0 ? argv.length : stop)
    .filter((arg, index) => !arg.startsWith("--") && (reportIndex < 0 || index !== reportIndex + 1));
  const packages = listPackages();
  const packageDirs = new Map(packages.map((info) => [info.name, info.dir]));
  const listAfter = (flag: string): ReadonlySet<string> | undefined => {
    const at = argv.indexOf(flag);
    if (at < 0) return undefined;
    const rest = argv.slice(at + 1);
    const stopAt = rest.findIndex((arg) => arg.startsWith("--"));
    return new Set(stopAt < 0 ? rest : rest.slice(0, stopAt));
  };
  const only = listAfter("--only");
  const skip = listAfter("--skip") ?? new Set<string>();
  const diagnostics = logs
    .flatMap((log) => parseLog(readFileSync(log, "utf8"), packageDirs))
    .filter((diagnostic) => (only === undefined || only.has(diagnostic.file)) && !skip.has(diagnostic.file));

  const scopeFiles = gitFiles(["--cached", "--others", "--exclude-standard", "--", ...SCOPE_ROOTS]).filter(
    (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts") && !/(^|\/)(node_modules|dist|\.repos)\//.test(file)
  );
  const classes = indexSchemaClasses(
    scopeFiles
      .filter((file) => existsSync(path.join(repoRoot, file)))
      .map((file) => ({ file, text: readFileSync(path.join(repoRoot, file), "utf8") }))
  );
  const classesByName = new Map<string, Array<SchemaClassEntry>>();
  for (const entry of classes) classesByName.set(entry.name, [...(classesByName.get(entry.name) ?? []), entry]);
  const discriminantsOf = (name: string): Readonly<Record<string, string>> => {
    const entries = classesByName.get(name.split(".").pop() ?? name) ?? [];
    return entries.length === 1
      ? (entries[0]?.tagFields ?? {})
      : Object.assign({}, ...entries.map((entry) => entry.tagFields));
  };
  const tagOf = (name: string): string | undefined => {
    const tags = new Set((classesByName.get(name.split(".").pop() ?? name) ?? []).map((entry) => entry.tag));
    return tags.size === 1 ? [...tags][0] : undefined;
  };

  const editsByFile = new Map<string, Array<Edit>>();
  const handled = new Set<string>();
  const fixed: Array<string> = [];
  const exportedNow: Array<string> = [];
  const promotions = new Map<string, Set<ts.ImportSpecifier>>();
  const manual: Array<{ site: string; code: number; reason: string; message: string }> = [];
  const sources = new Map<string, ts.SourceFile>();
  const sourceOf = (file: string): ts.SourceFile | undefined => {
    if (sources.has(file)) return sources.get(file);
    const absolute = path.join(repoRoot, file);
    if (!existsSync(absolute)) return undefined;
    const sf = ts.createSourceFile(
      file,
      readFileSync(absolute, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    sources.set(file, sf);
    return sf;
  };
  const editsFor = (file: string): Array<Edit> => {
    const edits = editsByFile.get(file) ?? [];
    editsByFile.set(file, edits);
    return edits;
  };

  for (const diagnostic of diagnostics) {
    const site = `${diagnostic.file}:${diagnostic.line}:${diagnostic.col}`;
    const chain = diagnostic.lines.join(" | ");
    const reject = (reason: string): void => {
      manual.push({ site, code: diagnostic.code, reason, message: chain.slice(0, 700) });
    };
    const sf = sourceOf(diagnostic.file);
    if (sf === undefined) {
      if (/'brand'/.test(chain)) reject("file-not-found");
      continue;
    }
    let pos: number;
    try {
      pos = sf.getPositionOfLineAndCharacter(diagnostic.line - 1, diagnostic.col - 1);
    } catch {
      reject("stale-position");
      continue;
    }

    // TS2554: `X.make()` on an all-optional Opaque needs its input object.
    if (diagnostic.code === 2554 && /^Expected 1-2 arguments, but got 0\.$/.test(diagnostic.lines[0] ?? "")) {
      const node = findNodeAt(sf, pos);
      let call: ts.Node | undefined = node;
      while (call !== undefined && !ts.isCallExpression(call)) call = call.parent;
      if (
        call !== undefined &&
        ts.isCallExpression(call) &&
        call.arguments.length === 0 &&
        ts.isPropertyAccessExpression(call.expression) &&
        /^make(Option|Effect)?$/.test(call.expression.name.text)
      ) {
        const key = `${diagnostic.file}@make${call.getStart(sf)}`;
        if (!handled.has(key)) {
          handled.add(key);
          editsFor(diagnostic.file).push({ start: call.arguments.pos, end: call.arguments.end, text: "{}" });
          fixed.push(site);
        }
      } else {
        reject("expected-args-not-a-make-call");
      }
      continue;
    }

    // TS2527: `export const A = B` aliasing a class value needs an explicit `typeof B`.
    if (diagnostic.code === 2527) {
      const node = findNodeAt(sf, pos);
      const declaration = node !== undefined && ts.isVariableDeclaration(node.parent) ? node.parent : undefined;
      const init = declaration?.initializer;
      if (
        declaration !== undefined &&
        declaration.type === undefined &&
        init !== undefined &&
        (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init))
      ) {
        editsFor(diagnostic.file).push({
          start: declaration.name.end,
          end: declaration.name.end,
          text: `: typeof ${init.getText(sf)}`,
        });
        fixed.push(site);
      } else {
        // The inferred type inlines a branded class that its module does not export, so the
        // class's anonymous `unique symbol` cannot be named. Export those classes.
        const hidden = hiddenClassesBehind(diagnostic.file, packages, sourceOf);
        let exportedAny = false;
        for (const entry of hidden) {
          const exportKey = `${entry.file}#export:${entry.name}`;
          const declaringSf = sourceOf(entry.file);
          if (declaringSf === undefined || handled.has(exportKey)) continue;
          handled.add(exportKey);
          const edit = exportEdit(declaringSf, entry.name);
          if (edit === undefined) continue;
          editsFor(entry.file).push(edit);
          exportedNow.push(`${entry.file}#${entry.name}`);
          exportedAny = true;
        }
        if (exportedAny || hidden.some((entry) => handled.has(`${entry.file}#export:${entry.name}`))) {
          fixed.push(site);
          continue;
        }
        reject("unique-symbol-inference");
      }
      continue;
    }

    if (!/'brand'/.test(chain)) continue;
    const plan = brandPlan(diagnostic);
    if (plan !== undefined && !classesByName.has(plan.name.split(".").pop() ?? plan.name)) {
      reject("target-is-not-a-schema-class");
      continue;
    }
    if (auditUnions && plan?.fromUnion === true) {
      process.stdout.write(`UNION ${diagnostic.file} ${plan.name} tag=${tagOf(plan.name) ?? "-"}\n`);
    }
    if (plan === undefined) {
      reject("target-not-a-bare-schema-type");
      continue;
    }
    const target = targetAt(sf, pos);
    if (target === undefined) {
      reject("no-expression-at-site");
      continue;
    }
    const resolved = resolveValues(target, plan, tagOf);
    // Out of a union, only a literal whose `_tag` names the chosen class is provably that class.
    const wanted = tagOf(plan.name);
    const values = plan.fromUnion
      ? resolved.filter((value) => {
          const inner = ts.isShorthandPropertyAssignment(value) ? undefined : unwrap(value);
          return (
            wanted !== undefined &&
            inner !== undefined &&
            ts.isObjectLiteralExpression(inner) &&
            tagOfLiteral(inner) === wanted
          );
        })
      : resolved;
    // A discriminant (`S.tag`) field must be written as the class's own literal, or the class
    // TS reported may just be the last union member it tried (`level: 0 | 1 | 2 | 3`).
    const discriminants = discriminantsOf(plan.name);
    const unsafe = values.some((value) => {
      if (ts.isShorthandPropertyAssignment(value)) return Object.keys(discriminants).includes(value.name.text);
      const inner = unwrap(value);
      if (!ts.isObjectLiteralExpression(inner)) return Object.keys(discriminants).length > 0;
      return Object.entries(discriminants).some(([field, literal]) => {
        const property = propertyNamed(inner, field);
        if (property === undefined) return field !== "_tag";
        return ts.isShorthandPropertyAssignment(property) || unwrap(property).getText(sf) !== literal;
      });
    });
    if (unsafe) {
      reject("discriminant-not-literal");
      continue;
    }
    if (plan.fromUnion && values.length === 0 && resolved.length > 0) {
      reject("union-member-not-provable");
      continue;
    }
    if (values.length === 0) {
      reject(plan.hops.length > 0 ? "property-path-not-literal" : "value-is-wrapped-in-a-container");
      continue;
    }

    const binding = bindingOf(sf, plan.name);
    const importEdits: Array<Edit> = [];
    if (
      (binding.kind === "value-import" || binding.kind === "type-import") &&
      binding.node !== undefined &&
      !importsFromWorkspace(binding.node, packages)
    ) {
      // The name is bound to an external module (`import * as P from "effect/Predicate"`).
      reject("name-shadowed-by-external-import");
      continue;
    }
    if (binding.kind === "absent") {
      const declared = classesByName.get(plan.name) ?? [];
      const consumerPackage = packageOf(diagnostic.file, packages)?.dir;
      const inPackage = (entries: ReadonlyArray<SchemaClassEntry>) =>
        entries.filter((entry) => packageOf(entry.file, packages)?.dir === consumerPackage);
      const exportedPool = declared.filter((entry) => entry.exported);
      let pool = inPackage(exportedPool).length > 0 ? inPackage(exportedPool) : exportedPool;
      if (pool.length === 0 && inPackage(declared).length === 1) {
        // A private class that already shapes another module's call sites: export it.
        const entry = inPackage(declared)[0] as SchemaClassEntry;
        const exportKey = `${entry.file}#export:${entry.name}`;
        const declaringSf = sourceOf(entry.file);
        if (declaringSf !== undefined && !handled.has(exportKey)) {
          handled.add(exportKey);
          const edit = exportEdit(declaringSf, entry.name);
          if (edit !== undefined) {
            editsFor(entry.file).push(edit);
            exportedNow.push(`${entry.file}#${entry.name}`);
          }
        }
        if (handled.has(exportKey)) pool = [entry];
      }
      const unique = pool.length === 1 ? pool[0] : undefined;
      const spec = unique === undefined ? undefined : specifierFor(diagnostic.file, unique.file, packages);
      if (spec === undefined) {
        const anyDecl = (classesByName.get(plan.name) ?? []).length > 0;
        reject(
          pool.length > 1
            ? `ambiguous-class-${plan.name}`
            : anyDecl && exportedPool.length === 0
              ? `private-class-${plan.name}`
              : `no-import-path-${plan.name}`
        );
        continue;
      }
      const key = `${diagnostic.file}#import:${plan.name}`;
      if (!handled.has(key)) {
        handled.add(key);
        importEdits.push(addImport(sf, plan.name, spec));
      }
    }
    const promotion =
      binding.kind === "type-import" && binding.node !== undefined && ts.isImportSpecifier(binding.node)
        ? binding.node
        : undefined;

    const edits = editsFor(diagnostic.file);
    let applied = 0;
    for (const value of values) {
      const start = value.getStart(sf);
      const key = `${diagnostic.file}@${start}`;
      if (handled.has(key)) continue;
      if (ts.isShorthandPropertyAssignment(value)) {
        handled.add(key);
        const local = value.name.text;
        edits.push({ start, end: value.end, text: `${local}: ${plan.name}.make(${local})` });
        applied++;
        continue;
      }
      if (value.getText(sf).startsWith(`${plan.name}.make(`)) continue;
      // Already the argument of a `.make(...)` call: wrapping again would nest constructors.
      const parent = value.parent;
      if (
        parent !== undefined &&
        ts.isCallExpression(parent) &&
        ts.isPropertyAccessExpression(parent.expression) &&
        parent.expression.name.text === "make"
      ) {
        continue;
      }
      handled.add(key);
      edits.push({ start, end: start, text: `${plan.name}.make(` }, { start: value.end, end: value.end, text: ")" });
      applied++;
    }
    if (applied > 0) {
      edits.push(...importEdits);
      if (promotion !== undefined) {
        const list = promotions.get(diagnostic.file) ?? new Set<ts.ImportSpecifier>();
        list.add(promotion);
        promotions.set(diagnostic.file, list);
      }
      fixed.push(site);
    }
  }

  for (const [file, specifiers] of promotions) {
    const sf = sources.get(file);
    if (sf !== undefined) editsFor(file).push(...promotionEdits(sf, [...specifiers]));
  }
  const changed: Array<string> = [];
  for (const [file, edits] of editsByFile) {
    const sf = sources.get(file);
    if (sf === undefined || edits.length === 0) continue;
    const ordered = edits
      .map((edit, order) => ({ edit, order }))
      .sort((left, right) => right.edit.start - left.edit.start || right.order - left.order);
    let text = sf.text;
    for (const { edit } of ordered) text = `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`;
    if (text !== sf.text) {
      if (syntaxErrors(file, text) > 0) {
        manual.push({ site: file, code: 0, reason: "edit-would-break-syntax", message: "fix-up edits left unapplied" });
        continue;
      }
      changed.push(file);
      if (!check) writeFileSync(path.join(repoRoot, file), text);
    }
  }
  if (!check && changed.length > 0) {
    for (let index = 0; index < changed.length; index += 200) {
      execFileSync(
        path.join(repoRoot, "node_modules/.bin/biome"),
        [
          "check",
          "--write",
          "--linter-enabled=false",
          "--no-errors-on-unmatched",
          ...changed.slice(index, index + 200),
        ],
        { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] }
      );
    }
  }
  const reasons: Record<string, number> = {};
  for (const entry of manual) {
    const bucket = entry.reason.replace(/-(class|path)-.*$/, "-$1");
    reasons[bucket] = (reasons[bucket] ?? 0) + 1;
  }
  const summary = {
    diagnostics: diagnostics.length,
    fixed: fixed.length,
    changedFiles: changed.length,
    exportedClasses: exportedNow,
    changed,
    manual: manual.length,
    reasons,
  };
  if (report !== undefined) writeFileSync(path.resolve(report), `${JSON.stringify({ ...summary, manual }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (check && changed.length > 0) process.exit(1);
};

if (import.meta.main) main();
