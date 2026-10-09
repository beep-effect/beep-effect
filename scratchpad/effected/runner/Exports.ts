/**
 * Source analysis for the parity gate and the verbatim copy: export facets,
 * unsafe type assertions (D15), foreign `@effected/*` specifiers, and the
 * import rewrites of goal section 5.2.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ModuleKind, ModuleResolutionKind, Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import { ExportEntry, type ExportKind } from "./Ledger.schema.ts";
import type { ExportDeclaration, SourceFile } from "ts-morph";

const $I = $ScratchpadId.create("effected/runner/Exports");

const makeProject = (): Project =>
  new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
      moduleResolution: ModuleResolutionKind.Bundler,
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
      noEmit: true,
      skipLibCheck: true,
      strict: false,
      types: [],
    },
  });

const byName = Order.mapInput(Order.String, (entry: ExportEntry) => entry.name);

const kindOf = (value: boolean, type: boolean): ExportKind => (value && type ? "both" : type ? "type" : "value");

const facetsOf = (declarations: ReadonlyArray<Node>): ExportKind => {
  const value = A.some(
    declarations,
    (node) =>
      Node.isClassDeclaration(node) ||
      Node.isEnumDeclaration(node) ||
      Node.isModuleDeclaration(node) ||
      Node.isSourceFile(node) ||
      Node.isVariableDeclaration(node) ||
      Node.isFunctionDeclaration(node) ||
      Node.isExpression(node)
  );
  const type = A.some(
    declarations,
    (node) =>
      Node.isClassDeclaration(node) ||
      Node.isEnumDeclaration(node) ||
      Node.isModuleDeclaration(node) ||
      Node.isSourceFile(node) ||
      Node.isInterfaceDeclaration(node) ||
      Node.isTypeAliasDeclaration(node)
  );
  return kindOf(value, type);
};

const addTypeOnlyNames = (declaration: ExportDeclaration, names: MutableHashSet.MutableHashSet<string>): void => {
  const named = declaration.getNamedExports();
  if (declaration.isTypeOnly()) {
    if (A.isReadonlyArrayNonEmpty(named)) {
      for (const specifier of named) {
        MutableHashSet.add(names, specifier.getAliasNode()?.getText() ?? specifier.getName());
      }
      return;
    }
    const target = declaration.getModuleSpecifierSourceFile();
    if (target !== undefined) {
      for (const name of target.getExportedDeclarations().keys()) {
        MutableHashSet.add(names, name);
      }
    }
    return;
  }
  for (const specifier of named) {
    if (specifier.isTypeOnly()) {
      MutableHashSet.add(names, specifier.getAliasNode()?.getText() ?? specifier.getName());
    }
  }
};

const typeOnlyNames = (sourceFile: SourceFile): MutableHashSet.MutableHashSet<string> => {
  const names = MutableHashSet.empty<string>();
  for (const declaration of sourceFile.getExportDeclarations()) {
    addTypeOnlyNames(declaration, names);
  }
  return names;
};

/**
 * Every name an entry file exports, with its value/type facets, resolved
 * through re-exports.
 *
 * **Details**
 *
 * A name re-exported with `export type` carries only the `type` facet even
 * when its declaration is a class; the declaration's own facets apply
 * otherwise. Names sort by `name` so two readings compare positionally.
 *
 * **Example** (Read the facets of an entry file)
 *
 * ```ts
 * import { readExportFacets } from "@beep/scratchpad/effected/runner/Exports"
 *
 * const facets = readExportFacets("scratchpad/effected/jsonc/index.ts", ".")
 * console.log(facets.length > 0) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readExportFacets: {
  (entry: string): (entryPath: string) => ReadonlyArray<ExportEntry>;
  (entryPath: string, entry: string): ReadonlyArray<ExportEntry>;
} = dual(2, (entryPath: string, entry: string): ReadonlyArray<ExportEntry> => {
  const project = makeProject();
  const sourceFile = project.addSourceFileAtPath(entryPath);
  project.resolveSourceFileDependencies();
  const typeOnly = typeOnlyNames(sourceFile);
  const entries = A.map(A.fromIterable(sourceFile.getExportedDeclarations()), ([name, declarations]) =>
    ExportEntry.make({
      name,
      kind: MutableHashSet.has(typeOnly, name) ? "type" : facetsOf(declarations),
      entry,
    })
  );
  return A.sort(entries, byName);
});

/**
 * The kinds of unsafe type assertion D15 forbids.
 *
 * **Example** (Guard an assertion kind)
 *
 * ```ts
 * import { UnsafeAssertionKind } from "@beep/scratchpad/effected/runner/Exports"
 *
 * console.log(UnsafeAssertionKind.is["non-null"]("non-null")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnsafeAssertionKind = LiteralKit(["as", "non-null", "angle-cast", "any", "ts-ignore"]).annotate(
  $I.annote("UnsafeAssertionKind", { description: "One D15 unsafe assertion class." })
);

/**
 * The union of unsafe assertion kind literals.
 *
 * @see {@link UnsafeAssertionKind} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type UnsafeAssertionKind = typeof UnsafeAssertionKind.Type;

/**
 * One unsafe assertion at a source position.
 *
 * **Example** (Render a finding)
 *
 * ```ts
 * import { UnsafeAssertion } from "@beep/scratchpad/effected/runner/Exports"
 *
 * const finding = UnsafeAssertion.make({ file: "a.ts", line: 3, column: 7, kind: "as" })
 * console.log(finding.render()) // "a.ts:3:7 as"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnsafeAssertion extends S.Class<UnsafeAssertion>($I`UnsafeAssertion`)(
  {
    file: S.String,
    line: S.Int,
    column: S.Int,
    kind: UnsafeAssertionKind,
  },
  $I.annote("UnsafeAssertion", { description: "A D15 violation at file:line:column." })
) {
  /**
   * Renders the finding as `file:line:column kind`, the form gate output uses.
   *
   * **Example** (Render a finding)
   *
   * ```ts
   * import { UnsafeAssertion } from "@beep/scratchpad/effected/runner/Exports"
   *
   * console.log(UnsafeAssertion.make({ file: "b.ts", line: 9, column: 2, kind: "any" }).render()) // "b.ts:9:2 any"
   * ```
   */
  render(): string {
    return `${this.file}:${this.line}:${this.column} ${this.kind}`;
  }
}

const isAsConst = (node: Node): boolean => {
  if (!Node.isAsExpression(node)) return false;
  const typeNode = node.getTypeNode();
  return typeNode !== undefined && typeNode.getText() === "const";
};

const assertionKind = (node: Node): O.Option<UnsafeAssertionKind> => {
  if (Node.isAsExpression(node)) return isAsConst(node) ? O.none() : O.some("as");
  if (Node.isNonNullExpression(node)) return O.some("non-null");
  if (Node.isTypeAssertion(node)) return O.some("angle-cast");
  if (node.getKind() === SyntaxKind.AnyKeyword) return O.some("any");
  return O.none();
};

const TS_IGNORE = /\/\/\s*@ts-ignore/;

const scanOne = (sourceFile: SourceFile, label: string): ReadonlyArray<UnsafeAssertion> => {
  const findings: Array<UnsafeAssertion> = [];
  sourceFile.forEachDescendant((node) => {
    const kind = assertionKind(node);
    if (O.isSome(kind)) {
      const position = sourceFile.getLineAndColumnAtPos(node.getStart());
      findings.push(UnsafeAssertion.make({ file: label, line: position.line, column: position.column, kind: kind.value }));
    }
  });
  const lines = Str.split("\n")(sourceFile.getFullText());
  for (const [index, line] of lines.entries()) {
    if (TS_IGNORE.test(line)) {
      findings.push(UnsafeAssertion.make({ file: label, line: index + 1, column: 1, kind: "ts-ignore" }));
    }
  }
  return findings;
};

/**
 * Every D15 violation in the given files (absolute path, label pairs).
 *
 * **Example** (Scan a file list)
 *
 * ```ts
 * import { scanUnsafeAssertions } from "@beep/scratchpad/effected/runner/Exports"
 *
 * const findings = scanUnsafeAssertions([["/repo/scratchpad/effected/jsonc/index.ts", "scratchpad/effected/jsonc/index.ts"]])
 * console.log(findings.length) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanUnsafeAssertions = (
  files: ReadonlyArray<readonly [absolute: string, label: string]>
): ReadonlyArray<UnsafeAssertion> => {
  const project = makeProject();
  return A.flatMap(files, ([absolute, label]) => scanOne(project.addSourceFileAtPath(absolute), label));
};

// Import and export specifiers only (static, dynamic, side-effect, require and
// vitest module mocks). A string that merely starts with the scope, such as a
// service identity or an error message, is upstream text that S0 carries as is.
const FOREIGN =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.(?:mock|doMock|unmock|importActual|importMock)\s*\(\s*)["']@effected\/[^"']*["']/;
const LAB_ALIAS = /^\s*(?:import|export)\b.*\bfrom\s+["']@beep\/scratchpad\/effected\/|\bimport\(\s*["']@beep\/scratchpad\/effected\//;

/**
 * Lines that still name an `@effected/*` specifier, or import lab source
 * through the `@beep/scratchpad/effected/*` alias instead of a relative path
 * (D13; JSDoc example fences may use the alias), as `label:line`.
 *
 * **Example** (Find foreign specifiers in text)
 *
 * ```ts
 * import { foreignSpecifierLines } from "@beep/scratchpad/effected/runner/Exports"
 *
 * console.log(foreignSpecifierLines("a.ts", 'import { x } from "@effected/glob";\nconst y = 1;')) // ["a.ts:1"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const foreignSpecifierLines: {
  (text: string): (label: string) => ReadonlyArray<string>;
  (label: string, text: string): ReadonlyArray<string>;
} = dual(
  2,
  (label: string, text: string): ReadonlyArray<string> =>
    A.filterMap(Str.split("\n")(text), (line, index) =>
      FOREIGN.test(line) || LAB_ALIAS.test(line) ? Result.succeed(`${label}:${index + 1}`) : Result.failVoid
    )
);

/**
 * The exports map of each upstream kit package, by package name
 * (`@effected/<m>`): subpath (`.`, `./x`) to its `./src/...` file.
 *
 * @category type-level
 * @since 0.0.0
 */
export type KitExports = HashMap.HashMap<string, HashMap.HashMap<string, string>>;

/**
 * The specifier-bearing spans the copy rewrites: `from`, bare `import`,
 * dynamic `import(`, `vi.mock(` and `require(`.
 *
 * **Example** (Match a dynamic import)
 *
 * ```ts
 * import { SPECIFIER_PATTERN } from "@beep/scratchpad/effected/runner/Exports"
 *
 * console.log(Array.from('await import("./x.js")'.matchAll(SPECIFIER_PATTERN), (m) => m[3])) // ["./x.js"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SPECIFIER_PATTERN = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\bmock\(\s*|\brequire\(\s*)(["'])([^"'\n]+)\2/g;

const isRelative = (specifier: string): boolean => Str.startsWith("./")(specifier) || Str.startsWith("../")(specifier);

/**
 * `.js`/`.jsx` relative specifier extensions become `.ts`/`.tsx`.
 *
 * **Example** (Normalize an extension)
 *
 * ```ts
 * import { tsExtension } from "@beep/scratchpad/effected/runner/Exports"
 *
 * console.log(tsExtension("./x.js")) // "./x.ts"
 * console.log(tsExtension("./x")) // "./x"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const tsExtension = (specifier: string): string =>
  Str.endsWith(".js")(specifier)
    ? `${Str.slice(0, specifier.length - 3)(specifier)}.ts`
    : Str.endsWith(".jsx")(specifier)
      ? `${Str.slice(0, specifier.length - 4)(specifier)}.tsx`
      : specifier;

/**
 * How one copied file resolves specifiers: the pure path mapping the copy
 * applies to every import.
 *
 * **Details**
 *
 * `resolveRelative` turns a relative upstream specifier into the lab-relative
 * one (or none to leave it untouched); `resolveKit` does the same for an
 * `@effected/<dep>[/<subpath>]` specifier.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface SpecifierResolver {
  readonly resolveRelative: (specifier: string) => O.Option<string>;
  readonly resolveKit: (dep: string, subpath: string) => O.Option<string>;
}

const KIT = /^@effected\/([^/]+)(?:\/(.+))?$/;

/**
 * Rewrites every import specifier in `text` through the resolver (goal
 * section 5.2): relative `.js` to `.ts`, `@effected/*` to relative lab paths,
 * everything else unchanged.
 *
 * **Example** (Rewrite a kit import)
 *
 * ```ts
 * import { rewriteSpecifiers } from "@beep/scratchpad/effected/runner/Exports"
 * import * as O from "effect/Option"
 *
 * const out = rewriteSpecifiers('import { Glob } from "@effected/glob";\nimport { x } from "./x.js";', {
 *   resolveRelative: (s) => O.none(),
 *   resolveKit: (dep) => O.some(`../${dep}/index.ts`),
 * })
 * console.log(out) // 'import { Glob } from "../glob/index.ts";\nimport { x } from "./x.ts";'
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rewriteSpecifiers: {
  (resolver: SpecifierResolver): (text: string) => string;
  (text: string, resolver: SpecifierResolver): string;
} = dual(2, (text: string, resolver: SpecifierResolver): string =>
  text.replace(SPECIFIER_PATTERN, (whole, lead: string, quote: string, specifier: string) => {
    const kit = KIT.exec(specifier);
    if (kit !== null) {
      const dep = kit[1] ?? "";
      const subpath = kit[2] === undefined ? "." : `./${kit[2]}`;
      return O.match(resolver.resolveKit(dep, subpath), {
        onNone: () => whole,
        onSome: (resolved) => `${lead}${quote}${resolved}${quote}`,
      });
    }
    if (isRelative(specifier)) {
      const resolved = O.getOrElse(resolver.resolveRelative(specifier), () => specifier);
      return `${lead}${quote}${tsExtension(resolved)}${quote}`;
    }
    return whole;
  })
);
