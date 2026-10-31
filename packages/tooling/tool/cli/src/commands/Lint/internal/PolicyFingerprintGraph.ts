/**
 * Static runtime import graph and command-tree walk behind the per-task
 * policy fingerprint.
 *
 * **Details**
 *
 * The graph is read from source text with the TypeScript parser, never by
 * loading modules, so the same code computes a fingerprint for the live
 * checkout, a test fixture or a historical tree. Type-only edges are skipped;
 * every other static, side-effect, re-export and literal dynamic import is an
 * edge. Workspace specifiers resolve through each package's `exports` map;
 * other bare specifiers are external and end the walk.
 *
 * A command path is resolved by walking `Command.make("<name>")` and
 * `Command.withSubcommands([...])` from the root command. Every command on
 * the path contributes its module and that module's imports, except an import
 * whose bindings are only that command's subcommands: those siblings are not
 * run by the path. The shell walk never enters the commands directory.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { ts } from "ts-morph";
import { PolicyClosure, PolicyCommandNode, PolicyFingerprintError } from "../PolicyFingerprint.schemas.ts";
import type { PolicyCliLayout, PolicyWorkspace } from "../PolicyFingerprint.schemas.ts";

/**
 * The file tree a fingerprint is computed from, addressed by repo-relative
 * POSIX paths.
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface PolicySourceTree {
  /** Every file under a directory, recursively, as repo-relative paths. */
  readonly files: (directory: string) => Effect.Effect<ReadonlyArray<string>, PolicyFingerprintError>;
  /** The text of one file, or `Option.none()` when it does not exist. */
  readonly read: (file: string) => Effect.Effect<O.Option<string>, PolicyFingerprintError>;
}

interface ImportEdge {
  /** Local names bound by a named or default import; `none` for namespace, side-effect, re-export or dynamic edges. */
  readonly bindings: O.Option<ReadonlyArray<string>>;
  /** A literal `import("...")` expression rather than a declaration. */
  readonly dynamic: boolean;
  readonly specifier: string;
}

interface ImportBinding {
  readonly imported: string;
  readonly specifier: string;
}

type ExportTarget =
  | { readonly _tag: "Local"; readonly local: string }
  | { readonly _tag: "From"; readonly specifier: string; readonly imported: string };

interface CommandDefinition {
  readonly name: O.Option<string>;
  /** One entry per subcommand: the local binding, or `none` for an expression the walk cannot name. */
  readonly subcommands: ReadonlyArray<O.Option<string>>;
}

interface ModuleSyntax {
  readonly commands: HashMap.HashMap<string, CommandDefinition>;
  readonly edges: ReadonlyArray<ImportEdge>;
  readonly exports: HashMap.HashMap<string, ExportTarget>;
  readonly imports: HashMap.HashMap<string, ImportBinding>;
  readonly opaqueDynamicImport: boolean;
  readonly starExports: ReadonlyArray<string>;
}

// Mutable accumulator for one module's top-level statements.
interface SyntaxCollector {
  readonly arrays: MutableHashMap.MutableHashMap<string, ReadonlyArray<ts.Expression>>;
  readonly definitions: Array<readonly [string, ts.Expression]>;
  readonly edges: Array<ImportEdge>;
  readonly exports: MutableHashMap.MutableHashMap<string, ExportTarget>;
  readonly imports: MutableHashMap.MutableHashMap<string, ImportBinding>;
  readonly namespaces: MutableHashSet.MutableHashSet<string>;
  opaqueDynamicImport: boolean;
  readonly starExports: Array<string>;
}

interface CommandAnalysis {
  readonly make: O.Option<ts.CallExpression>;
  readonly subcommands: ReadonlyArray<O.Option<string>>;
}

const CLI_COMMAND_MODULE = "effect/cli/Command";
const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/;
const RUNTIME_EXPORT_CONDITIONS = ["bun", "import", "node", "default"] as const;
const NO_ANALYSIS: CommandAnalysis = { make: O.none(), subcommands: [] };
const EMPTY_SYNTAX: ModuleSyntax = {
  commands: HashMap.empty(),
  edges: [],
  exports: HashMap.empty(),
  imports: HashMap.empty(),
  opaqueDynamicImport: false,
  starExports: [],
};

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;

const stringLiteral = (node: ts.Expression | undefined): O.Option<string> =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? O.some(node.text)
    : O.none();

const elementBinding = (node: ts.Expression): O.Option<string> => {
  const inner = unwrap(ts.isSpreadElement(node) ? node.expression : node);
  return ts.isIdentifier(inner) && !ts.isSpreadElement(node) ? O.some(inner.text) : O.none();
};

const declaration = (specifier: string, bindings: O.Option<ReadonlyArray<string>>): ImportEdge => ({
  specifier,
  bindings,
  dynamic: false,
});

// The local names an import clause binds at runtime, recorded for export resolution.
const importLocals = (collector: SyntaxCollector, specifier: string, clause: ts.ImportClause) => {
  const named = clause.namedBindings;
  const elements =
    named !== undefined && ts.isNamedImports(named) ? A.filter(named.elements, (e) => !e.isTypeOnly) : [];
  const bound: Array<readonly [string, string]> = [
    ...(clause.name === undefined ? [] : [[clause.name.text, "default"] as const]),
    ...A.map(elements, (element) => [element.name.text, element.propertyName?.text ?? element.name.text] as const),
  ];
  for (const [local, imported] of bound) MutableHashMap.set(collector.imports, local, { specifier, imported });
  return A.map(bound, ([local]) => local);
};

const namespaceOf = (clause: ts.ImportClause | undefined): O.Option<string> => {
  const named = clause?.namedBindings;
  return named !== undefined && ts.isNamespaceImport(named) ? O.some(named.name.text) : O.none();
};

// Side-effect and namespace imports bind nothing the subcommand cut can name.
const collectUnnamedImport = (collector: SyntaxCollector, specifier: string, namespace: O.Option<string>) => {
  if (O.isSome(namespace) && specifier === CLI_COMMAND_MODULE)
    MutableHashSet.add(collector.namespaces, namespace.value);
  collector.edges.push(declaration(specifier, O.none()));
};

const collectImport = (collector: SyntaxCollector, statement: ts.ImportDeclaration, specifier: string) => {
  const clause = statement.importClause;
  if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword) return;
  const namespace = namespaceOf(clause);
  if (clause === undefined || O.isSome(namespace)) return collectUnnamedImport(collector, specifier, namespace);
  collector.edges.push(declaration(specifier, O.some(importLocals(collector, specifier, clause))));
};

const exportTargetOf = (specifier: O.Option<string>, element: ts.ExportSpecifier): ExportTarget => {
  const local = element.propertyName?.text ?? element.name.text;
  return O.match(specifier, {
    onNone: () => ({ _tag: "Local", local }),
    onSome: (value) => ({ _tag: "From", specifier: value, imported: local }),
  });
};

const collectExport = (collector: SyntaxCollector, statement: ts.ExportDeclaration) => {
  if (statement.isTypeOnly) return;
  const specifier = O.flatMap(O.fromUndefinedOr(statement.moduleSpecifier), stringLiteral);
  const clause = statement.exportClause;
  if (O.isSome(specifier)) {
    collector.edges.push(declaration(specifier.value, O.none()));
    if (clause === undefined) collector.starExports.push(specifier.value);
  }
  const elements = clause !== undefined && ts.isNamedExports(clause) ? clause.elements : [];
  for (const element of A.filter(elements, (e) => !e.isTypeOnly))
    MutableHashMap.set(collector.exports, element.name.text, exportTargetOf(specifier, element));
};

const collectDefinition = (collector: SyntaxCollector, exported: boolean, item: ts.VariableDeclaration) => {
  if (!ts.isIdentifier(item.name) || item.initializer === undefined) return;
  const name = item.name.text;
  const initializer = unwrap(item.initializer);
  if (exported) MutableHashMap.set(collector.exports, name, { _tag: "Local", local: name });
  if (ts.isArrayLiteralExpression(initializer)) MutableHashMap.set(collector.arrays, name, initializer.elements);
  collector.definitions.push([name, initializer]);
};

const collectVariables = (collector: SyntaxCollector, statement: ts.VariableStatement) => {
  const exported = A.some(statement.modifiers ?? [], (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  for (const item of statement.declarationList.declarations) collectDefinition(collector, exported, item);
};

const collectStatement = (collector: SyntaxCollector, statement: ts.Statement) => {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
    return collectImport(collector, statement, statement.moduleSpecifier.text);
  if (ts.isExportDeclaration(statement)) return collectExport(collector, statement);
  if (ts.isVariableStatement(statement)) collectVariables(collector, statement);
};

const isDynamicImport = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;

// Literal `import("x")` is an edge anywhere in the module; a computed one makes the module opaque.
const collectDynamicImports = (collector: SyntaxCollector, node: ts.Node): void => {
  if (isDynamicImport(node)) {
    const specifier = stringLiteral(node.arguments[0]);
    if (O.isSome(specifier)) collector.edges.push({ specifier: specifier.value, bindings: O.none(), dynamic: true });
    else collector.opaqueDynamicImport = true;
  }
  if (!ts.isImportTypeNode(node)) ts.forEachChild(node, (child) => collectDynamicImports(collector, child));
};

const isNamespaceCall = (node: ts.CallExpression, namespaces: MutableHashSet.MutableHashSet<string>, member: string) =>
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  MutableHashSet.has(namespaces, node.expression.expression.text) &&
  node.expression.name.text === member;

const subcommandElements = (collector: SyntaxCollector, node: ts.Expression): ReadonlyArray<O.Option<string>> => {
  const inner = unwrap(node);
  if (ts.isArrayLiteralExpression(inner)) return A.map(inner.elements, elementBinding);
  const named = ts.isIdentifier(inner) ? MutableHashMap.get(collector.arrays, inner.text) : O.none();
  return O.match(named, { onNone: () => [O.none()], onSome: (elements) => A.map(elements, elementBinding) });
};

const pipedSubcommands = (collector: SyntaxCollector, argument: ts.Expression) => {
  const call = unwrap(argument);
  return ts.isCallExpression(call) && isNamespaceCall(call, collector.namespaces, "withSubcommands")
    ? A.flatMap(call.arguments, (element) => subcommandElements(collector, element))
    : [];
};

const withSubcommands = (base: CommandAnalysis, subcommands: ReadonlyArray<O.Option<string>>): CommandAnalysis => ({
  make: base.make,
  subcommands: [...base.subcommands, ...subcommands],
});

// `Command.make(...)`, `Command.withSubcommands(self, [...])` and `<command>.pipe(..., Command.withSubcommands([...]))`.
const analyzeCommand = (collector: SyntaxCollector, node: ts.Expression): CommandAnalysis => {
  const inner = unwrap(node);
  if (!ts.isCallExpression(inner)) return NO_ANALYSIS;
  if (isNamespaceCall(inner, collector.namespaces, "make")) return { make: O.some(inner), subcommands: [] };
  const [self, list] = inner.arguments;
  if (isNamespaceCall(inner, collector.namespaces, "withSubcommands") && self !== undefined && list !== undefined)
    return withSubcommands(analyzeCommand(collector, self), subcommandElements(collector, list));
  if (ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === "pipe")
    return withSubcommands(
      analyzeCommand(collector, inner.expression.expression),
      A.flatMap(inner.arguments, (argument) => pipedSubcommands(collector, argument))
    );
  return NO_ANALYSIS;
};

const commandDefinitions = (collector: SyntaxCollector): HashMap.HashMap<string, CommandDefinition> =>
  HashMap.fromIterable(
    A.getSomes(
      A.map(collector.definitions, ([name, initializer]) => {
        const analysis = analyzeCommand(collector, initializer);
        return O.map(
          analysis.make,
          (make) => [name, { name: stringLiteral(make.arguments[0]), subcommands: analysis.subcommands }] as const
        );
      })
    )
  );

/**
 * Read the import edges, export map and command definitions of one module.
 *
 * **Example** (Read a module's runtime edges)
 *
 * ```ts
 * import { moduleSyntax } from "@beep/repo-cli/test/Lint"
 *
 * const syntax = moduleSyntax("a.ts", 'import type { T } from "./t.ts"\nimport { b } from "./b.ts"')
 * console.log(syntax.edges.length) // 1
 * ```
 *
 * @param file - Repo-relative module path; `.tsx` selects the TSX parser.
 * @param text - Module source text.
 * @returns The module's runtime edges, export map and command definitions.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const moduleSyntax: {
  (text: string): (file: string) => ModuleSyntax;
  (file: string, text: string): ModuleSyntax;
} = dual(2, (file: string, text: string): ModuleSyntax => {
  const kind = Str.endsWith("x")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind);
  const collector: SyntaxCollector = {
    arrays: MutableHashMap.empty(),
    definitions: [],
    edges: [],
    exports: MutableHashMap.empty(),
    imports: MutableHashMap.empty(),
    namespaces: MutableHashSet.empty(),
    opaqueDynamicImport: false,
    starExports: [],
  };
  for (const statement of source.statements) collectStatement(collector, statement);
  collectDynamicImports(collector, source);
  return {
    commands: commandDefinitions(collector),
    edges: collector.edges,
    exports: HashMap.fromIterable(collector.exports),
    imports: HashMap.fromIterable(collector.imports),
    opaqueDynamicImport: collector.opaqueDynamicImport,
    starExports: collector.starExports,
  };
});

const conditionTarget = (record: Readonly<Record<string, unknown>>): O.Option<string> =>
  pipe(
    A.findFirst(RUNTIME_EXPORT_CONDITIONS, (condition) => R.has(record, condition)),
    O.flatMap((condition) => exportTarget(record[condition]))
  );

const exportTarget = (value: unknown): O.Option<string> => {
  if (P.isString(value)) return O.some(value);
  if (A.isArray(value)) return O.flatten(A.findFirst(A.map(value, exportTarget), O.isSome));
  return P.isObject(value) ? conditionTarget(value as Readonly<Record<string, unknown>>) : O.none();
};

const patternParts = (pattern: string): O.Option<readonly [string, string]> => {
  const parts = Str.split(pattern, "*");
  const [prefix, suffix] = parts;
  return A.length(parts) === 2 && prefix !== undefined && suffix !== undefined ? O.some([prefix, suffix]) : O.none();
};

const patternMatches = (key: string) => (pattern: string) =>
  O.exists(
    patternParts(pattern),
    ([prefix, suffix]) =>
      Str.startsWith(prefix)(key) && Str.endsWith(suffix)(key) && key.length >= prefix.length + suffix.length
  );

const patternTarget = (record: Readonly<Record<string, unknown>>, key: string) => (pattern: string) =>
  O.flatMap(patternParts(pattern), ([prefix, suffix]) =>
    O.map(exportTarget(record[pattern]), Str.replaceAll("*", Str.slice(prefix.length, key.length - suffix.length)(key)))
  );

const recordSubpath = (record: Readonly<Record<string, unknown>>, key: string): O.Option<string> =>
  R.has(record, key)
    ? exportTarget(record[key])
    : pipe(
        A.filter(R.keys(record), patternMatches(key)),
        A.sort(Order.mapInput(Order.Number, (pattern: string) => -pattern.length)),
        A.head,
        O.flatMap(patternTarget(record, key))
      );

/**
 * Resolve a subpath key (`"."`, `"./sub"`, `"#internal"`) against an
 * `exports` or `imports` map, with single-`*` patterns and Bun's runtime
 * conditions.
 *
 * **Example** (Resolve a wildcard subpath)
 *
 * ```ts
 * import { resolvePackageSubpath } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(resolvePackageSubpath({ "./*": "./src/*.ts" }, "./A"))) // "./src/A.ts"
 * ```
 *
 * @param map - A manifest's `exports` or `imports` value.
 * @param key - The subpath key to resolve.
 * @returns The target path relative to the package directory, or `none`.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const resolvePackageSubpath: {
  (key: string): (map: unknown) => O.Option<string>;
  (map: unknown, key: string): O.Option<string>;
} = dual(2, (map: unknown, key: string): O.Option<string> => {
  if (P.isString(map) || A.isArray(map)) return key === "." ? exportTarget(map) : O.none();
  return P.isObject(map) ? recordSubpath(map as Readonly<Record<string, unknown>>, key) : O.none();
});

const joinPath = (...parts: ReadonlyArray<string>): string =>
  A.join(
    A.reduce(A.flatMap(parts, Str.split("/")), A.empty<string>(), (segments, part) => {
      if (part === "..") return A.dropRight(segments, 1);
      return part === "." || part === "" ? segments : A.append(segments, part);
    }),
    "/"
  );

const directoryOf = (file: string): string => A.join(A.dropRight(Str.split(file, "/"), 1), "/");

const resolutionCandidates = (base: string): ReadonlyArray<string> =>
  Str.endsWith(".js")(base)
    ? [`${Str.slice(0, -3)(base)}.ts`, `${Str.slice(0, -3)(base)}.tsx`, base]
    : [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];

const packageNameOf = (specifier: string): string => {
  const segments = Str.split(specifier, "/");
  return Str.startsWith("@")(specifier) ? A.join(A.take(segments, 2), "/") : (segments[0] ?? "");
};

/** An entry of a closure walk and the edges it follows. */
interface WalkItem {
  readonly follow: EdgeFilter;
  readonly module: string;
  /** Reached through another module rather than named as an entry. */
  readonly transitive: boolean;
}

type EdgeFilter = (from: string, edge: ImportEdge, target: string) => Effect.Effect<boolean, PolicyFingerprintError>;

interface WalkState {
  readonly expanded: MutableHashSet.MutableHashSet<string>;
  readonly modules: MutableHashSet.MutableHashSet<string>;
  readonly opaque: MutableHashSet.MutableHashSet<string>;
}

const followAll: EdgeFilter = () => Effect.succeed(true);

/** The options of {@link makePolicyGraph}. */
interface PolicyGraphOptions {
  readonly tree: PolicySourceTree;
  readonly workspaces: ReadonlyArray<PolicyWorkspace>;
}

/**
 * Build a graph reader over a source tree and its workspaces.
 *
 * **Details**
 *
 * The reader caches parsed modules, so one reader serves every key of a
 * fingerprint computation.
 *
 * **Example** (Create a graph reader)
 *
 * ```ts
 * import { makePolicyGraph } from "@beep/repo-cli/test/Lint"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const tree = { read: () => Effect.succeed(O.none()), files: () => Effect.succeed([]) }
 * const graph = makePolicyGraph({ tree, workspaces: [] })
 * console.log(typeof graph.commandClosure) // "function"
 * ```
 *
 * @param options - The source tree and the workspaces specifiers may enter.
 * @returns The graph reader: workspace lookup, command-path walk and closures.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makePolicyGraph = ({ tree, workspaces }: PolicyGraphOptions) => {
  const byName = HashMap.fromIterable(A.map(workspaces, (workspace) => [workspace.name, workspace] as const));
  const byDepth = A.sort(
    workspaces,
    Order.mapInput(Order.Number, (workspace: PolicyWorkspace) => -workspace.directory.length)
  );
  const syntaxCache = MutableHashMap.empty<string, O.Option<ModuleSyntax>>();

  const workspaceOf = (file: string): O.Option<PolicyWorkspace> =>
    A.findFirst(byDepth, (workspace) => Str.startsWith(`${workspace.directory}/`)(file));

  const parse = (file: string, text: O.Option<string>) =>
    O.map(text, (content) => (TYPESCRIPT_SOURCE.test(file) ? moduleSyntax(file, content) : EMPTY_SYNTAX));

  const syntaxOf = (file: string): Effect.Effect<O.Option<ModuleSyntax>, PolicyFingerprintError> =>
    O.match(MutableHashMap.get(syntaxCache, file), {
      onSome: Effect.succeed,
      onNone: () =>
        Effect.map(tree.read(file), (text) => {
          const syntax = parse(file, text);
          MutableHashMap.set(syntaxCache, file, syntax);
          return syntax;
        }),
    });

  const requireSyntax = Effect.fnUntraced(function* (module: string) {
    const syntax = yield* syntaxOf(module);
    if (O.isSome(syntax)) return syntax.value;
    return yield* PolicyFingerprintError.make({ message: `Reached module ${module} does not exist`, cause: module });
  });

  const resolveRelative = Effect.fnUntraced(function* (from: string, specifier: string) {
    for (const candidate of resolutionCandidates(joinPath(directoryOf(from), specifier)))
      if (O.isSome(yield* syntaxOf(candidate))) return O.some(candidate);
    return O.none<string>();
  });

  const resolveImportsAlias = (from: string, specifier: string) =>
    O.match(
      O.flatMap(workspaceOf(from), (workspace) =>
        O.map(resolvePackageSubpath(workspace.imports, specifier), (target) => [workspace, target] as const)
      ),
      {
        onNone: () => Effect.succeed(O.none<string>()),
        onSome: ([workspace, target]) => resolveRelative(`${workspace.directory}/package.json`, target),
      }
    );

  const resolveWorkspaceSpecifier = Effect.fnUntraced(function* (from: string, specifier: string) {
    const name = packageNameOf(specifier);
    const workspace = HashMap.get(byName, name);
    if (O.isNone(workspace)) return O.none<string>();
    const key = specifier === name ? "." : `.${Str.slice(name.length)(specifier)}`;
    const target = resolvePackageSubpath(workspace.value.exports, key);
    if (O.isNone(target)) {
      return yield* PolicyFingerprintError.make({
        message: `Cannot resolve workspace specifier ${specifier} imported by ${from}`,
        cause: specifier,
      });
    }
    return yield* resolveRelative(`${workspace.value.directory}/package.json`, target.value);
  });

  // Resolve one specifier from a module; external packages resolve to `none`.
  const resolve = (from: string, specifier: string): Effect.Effect<O.Option<string>, PolicyFingerprintError> => {
    if (Str.startsWith(".")(specifier)) return resolveRelative(from, specifier);
    return Str.startsWith("#")(specifier)
      ? resolveImportsAlias(from, specifier)
      : resolveWorkspaceSpecifier(from, specifier);
  };

  const viaSpecifier = <A>(
    module: string,
    specifier: string,
    next: (target: string) => Effect.Effect<O.Option<A>, PolicyFingerprintError>
  ) => Effect.flatMap(resolve(module, specifier), O.match({ onNone: () => Effect.succeedNone, onSome: next }));

  type Binding = { readonly module: string; readonly local: string };

  const resolveStarExports = Effect.fnUntraced(function* (
    module: string,
    specifiers: ReadonlyArray<string>,
    name: string,
    depth: number
  ) {
    for (const specifier of specifiers) {
      const found = yield* viaSpecifier(module, specifier, (next) => resolveExport(next, name, depth + 1));
      if (O.isSome(found)) return found;
    }
    return O.none<Binding>();
  });

  const resolveExportTarget = (module: string, target: ExportTarget, depth: number) =>
    target._tag === "Local"
      ? resolveLocal(module, target.local, depth + 1)
      : viaSpecifier(module, target.specifier, (next) => resolveExport(next, target.imported, depth + 1));

  // Follow an exported name through local bindings, re-exports and `export *` barrels.
  const resolveExport = (
    module: string,
    name: string,
    depth: number
  ): Effect.Effect<O.Option<Binding>, PolicyFingerprintError> =>
    depth > 32
      ? Effect.succeedNone
      : Effect.flatMap(
          syntaxOf(module),
          O.match({
            onNone: () => Effect.succeedNone,
            onSome: (syntax) =>
              O.match(HashMap.get(syntax.exports, name), {
                onSome: (target) => resolveExportTarget(module, target, depth),
                onNone: () => resolveStarExports(module, syntax.starExports, name, depth),
              }),
          })
        );

  const resolveBinding = (module: string, local: string, syntax: ModuleSyntax, depth: number) => {
    const imported = HashMap.has(syntax.commands, local) ? O.none() : HashMap.get(syntax.imports, local);
    return O.match(imported, {
      onNone: () => Effect.succeedSome<Binding>({ module, local }),
      onSome: (binding) =>
        viaSpecifier(module, binding.specifier, (next) => resolveExport(next, binding.imported, depth + 1)),
    });
  };

  // Resolve a local binding to the module and binding that define it.
  const resolveLocal = (
    module: string,
    local: string,
    depth: number
  ): Effect.Effect<O.Option<Binding>, PolicyFingerprintError> =>
    Effect.flatMap(
      syntaxOf(module),
      O.match({ onNone: () => Effect.succeedNone, onSome: (syntax) => resolveBinding(module, local, syntax, depth) })
    );

  const definitionOf = (module: string, binding: string) =>
    Effect.map(
      syntaxOf(module),
      O.flatMap((syntax) => HashMap.get(syntax.commands, binding))
    );

  type PathStep = { readonly node: PolicyCommandNode; readonly definition: CommandDefinition };

  const subcommandNamed = Effect.fnUntraced(function* (module: string, local: string, token: string) {
    const target = yield* resolveLocal(module, local, 0);
    if (O.isNone(target)) return O.none<PathStep>();
    const definition = yield* definitionOf(target.value.module, target.value.local);
    return O.filter(definition, (value) => O.contains(value.name, token)).pipe(
      O.map(
        (value): PathStep => ({
          node: PolicyCommandNode.make({ module: target.value.module, binding: target.value.local, name: token }),
          definition: value,
        })
      )
    );
  });

  const matchSubcommand = Effect.fnUntraced(function* (step: PathStep, token: string) {
    for (const local of A.getSomes(step.definition.subcommands)) {
      const found = yield* subcommandNamed(step.node.module, local, token);
      if (O.isSome(found)) return found;
    }
    return O.none<PathStep>();
  });

  const rootStep = Effect.fnUntraced(function* (layout: PolicyCliLayout) {
    const definition = yield* definitionOf(layout.rootModule, layout.rootBinding);
    if (O.isNone(definition)) {
      return yield* PolicyFingerprintError.make({
        message: `Cannot read the root command ${layout.rootBinding} in ${layout.rootModule}`,
        cause: layout.rootModule,
      });
    }
    const name = O.getOrElse(definition.value.name, () => "");
    return {
      node: PolicyCommandNode.make({ module: layout.rootModule, binding: layout.rootBinding, name }),
      definition: definition.value,
    } satisfies PathStep;
  });

  // Walk argv tokens from the root command; returns every matched command, root first.
  const commandPath = Effect.fnUntraced(function* (layout: PolicyCliLayout, tokens: ReadonlyArray<string>) {
    let step = yield* rootStep(layout);
    const nodes = [step.node];
    for (const token of tokens) {
      const next = yield* matchSubcommand(step, token);
      if (O.isNone(next)) break;
      step = next.value;
      nodes.push(step.node);
    }
    return nodes;
  });

  const bindsOnly = (subcommands: HashSet.HashSet<string>) => (edge: ImportEdge) =>
    O.exists(
      edge.bindings,
      (bindings) => A.isReadonlyArrayNonEmpty(bindings) && A.every(bindings, (name) => HashSet.has(subcommands, name))
    );

  // The specifiers of a command node's module whose imports only bind its subcommands.
  const subcommandSpecifiers = Effect.fnUntraced(function* (node: PolicyCommandNode) {
    const syntax = yield* syntaxOf(node.module);
    const definition = yield* definitionOf(node.module, node.binding);
    const subcommands = HashSet.fromIterable(
      A.getSomes(O.match(definition, { onNone: () => [], onSome: (d) => d.subcommands }))
    );
    const edges = O.match(syntax, { onNone: A.empty<ImportEdge>, onSome: (value) => value.edges });
    return HashSet.fromIterable(A.map(A.filter(edges, bindsOnly(subcommands)), (edge) => edge.specifier));
  });

  const resolveEdge = Effect.fnUntraced(function* (from: string, edge: ImportEdge) {
    const target = yield* resolve(from, edge.specifier);
    if (O.isSome(target) || !Str.startsWith(".")(edge.specifier)) return target;
    return yield* PolicyFingerprintError.make({
      message: `Cannot resolve ${edge.specifier} imported by ${from}`,
      cause: edge.specifier,
    });
  });

  const followed = Effect.fnUntraced(function* (item: WalkItem, edge: ImportEdge) {
    const target = yield* resolveEdge(item.module, edge);
    if (O.isNone(target)) return O.none<string>();
    return (yield* item.follow(item.module, edge, target.value)) ? target : O.none<string>();
  });

  const recordOpaque = (state: WalkState, module: string) =>
    O.map(workspaceOf(module), (workspace) => MutableHashSet.add(state.opaque, workspace.directory));

  const visit = Effect.fnUntraced(function* (
    state: WalkState,
    item: WalkItem,
    transitive: EdgeFilter,
    exempt: HashSet.HashSet<string>
  ) {
    const syntax = yield* requireSyntax(item.module);
    if (syntax.opaqueDynamicImport && !HashSet.has(exempt, item.module)) recordOpaque(state, item.module);
    const targets = yield* Effect.forEach(syntax.edges, (edge) => followed(item, edge));
    return A.map(A.getSomes(targets), (module): WalkItem => ({ module, follow: transitive, transitive: true }));
  });

  const seen = (state: WalkState, item: WalkItem) =>
    item.transitive ? MutableHashSet.has(state.expanded, item.module) : MutableHashSet.has(state.modules, item.module);

  const markSeen = (state: WalkState, item: WalkItem) => {
    MutableHashSet.add(state.modules, item.module);
    if (item.transitive) MutableHashSet.add(state.expanded, item.module);
  };

  // One walk shared by the shell and command closures: entries follow
  // their own edge filter, every module reached through them follows
  // `transitive`. A module reached both ways is expanded fully.
  const walk = Effect.fnUntraced(function* (
    entries: ReadonlyArray<WalkItem>,
    transitive: EdgeFilter,
    exempt: HashSet.HashSet<string> = HashSet.empty()
  ) {
    const state: WalkState = {
      expanded: MutableHashSet.empty(),
      modules: MutableHashSet.empty(),
      opaque: MutableHashSet.empty(),
    };
    const pending = [...entries];
    for (let item = pending.pop(); item !== undefined; item = pending.pop()) {
      if (seen(state, item)) continue;
      markSeen(state, item);
      pending.push(...(yield* visit(state, item, transitive, exempt)));
    }
    return PolicyClosure.make({
      modules: HashSet.fromIterable(state.modules),
      opaqueWorkspaces: HashSet.fromIterable(state.opaque),
    });
  });

  // Everything the bin loads before it dispatches. The walk never enters the
  // commands directory; a dispatch edge into it is a declaration in a shell
  // entry or a literal `import()` (a lazy dispatch manifest). A static import
  // of a command module from any other shell module would run that module for
  // every command, so it fails the computation. A shell entry's computed
  // dynamic import (`bin.ts` loading `bin-main.js` by URL) targets another
  // shell entry, so it is not treated as opaque. Like the command walk, an
  // unresolvable relative import fails the computation instead of being
  // skipped: the import graph would otherwise silently lose a module.
  const shellClosure = (layout: PolicyCliLayout) => {
    const entries = HashSet.fromIterable(layout.shell);
    const insideCommands = Str.startsWith(`${layout.commandsDirectory}/`);
    const shellEdge: EdgeFilter = (from, edge, target) => {
      if (!insideCommands(target)) return Effect.succeed(true);
      if (edge.dynamic || HashSet.has(entries, from)) return Effect.succeed(false);
      return Effect.fail(
        PolicyFingerprintError.make({
          message: `Shell module ${from} statically imports command module ${target}`,
          cause: target,
        })
      );
    };
    return walk(
      A.map(layout.shell, (module): WalkItem => ({ module, follow: shellEdge, transitive: false })),
      shellEdge,
      entries
    );
  };

  // The closure of one command path, without the shell.
  const commandClosure = Effect.fnUntraced(function* (nodes: ReadonlyArray<PolicyCommandNode>) {
    const entries = yield* Effect.forEach(nodes, (node) =>
      Effect.map(
        subcommandSpecifiers(node),
        (specifiers): WalkItem => ({
          module: node.module,
          follow: (_from, edge) => Effect.succeed(!HashSet.has(specifiers, edge.specifier)),
          transitive: false,
        })
      )
    );
    return yield* walk(entries, followAll);
  });

  return { workspaceOf, commandPath, shellClosure, commandClosure, resolve, syntaxOf } as const;
};

/**
 * A policy graph reader.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PolicyGraph = ReturnType<typeof makePolicyGraph>;

const assetExtension = (file: string): O.Option<string> => {
  if (TYPESCRIPT_SOURCE.test(file)) return O.none();
  const base = O.getOrElse(A.last(Str.split(file, "/")), () => file);
  return O.map(Str.lastIndexOf(".")(base), (index) => Str.slice(index + 1)(base));
};

// A reached workspace's manifest plus its asset globs, or its whole `src` when opaque.
const workspaceInputs = Effect.fnUntraced(function* (tree: PolicySourceTree, directory: string, opaque: boolean) {
  if (opaque) return [`${directory}/package.json`, `${directory}/src/**`];
  const extensions = A.dedupe(A.getSomes(A.map(yield* tree.files(`${directory}/src`), assetExtension)));
  return [`${directory}/package.json`, ...A.map(extensions, (extension) => `${directory}/src/**/*.${extension}`)];
});

/**
 * Render a closure as Turbo inputs: every reached module, each reached
 * workspace manifest, one glob per non-TypeScript asset extension matching `*.<ext>` at any depth
 * under each reached `src` (assets are read at runtime, not imported), and
 * the whole `src` of a workspace with an opaque dynamic import.
 *
 * **Details**
 *
 * Files are listed one by one rather than collapsed into directory globs, so
 * the inputs change only when an import edge changes, never when an unrelated
 * file is added. `covered` holds inputs another set already declares (the
 * shared seal); they are dropped.
 *
 * @param tree - The source tree, for asset listings.
 * @param graph - The graph reader, for workspace lookup.
 * @param reached - The closure to render.
 * @param covered - Inputs already declared by a parent seal.
 * @returns Sorted, deduplicated Turbo inputs.
 * @internal
 * @category rendering
 * @since 0.0.0
 */
export const renderClosureInputs = Effect.fnUntraced(function* (
  tree: PolicySourceTree,
  graph: PolicyGraph,
  reached: PolicyClosure,
  covered: HashSet.HashSet<string>
) {
  const directories = A.sort(
    A.dedupe(
      A.map(A.getSomes(A.map(A.fromIterable(reached.modules), graph.workspaceOf)), (workspace) => workspace.directory)
    ),
    Order.String
  );
  const perWorkspace = yield* Effect.forEach(directories, (directory) =>
    workspaceInputs(tree, directory, HashSet.has(reached.opaqueWorkspaces, directory))
  );
  const opaque = A.map(A.fromIterable(reached.opaqueWorkspaces), (directory) => `${directory}/src/`);
  const insideOpaque = (input: string) =>
    !Str.endsWith("/src/**")(input) && A.some(opaque, (prefix) => Str.startsWith(prefix)(input));
  return A.sort(
    A.dedupe(
      A.filter(
        [...reached.modules, ...A.flatten(perWorkspace)],
        (input) => !HashSet.has(covered, input) && !insideOpaque(input)
      )
    ),
    Order.String
  );
});
