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
 * run by the path. The dispatch modules (`bin.ts`, `bin-main.ts`, `Root.ts`)
 * reach every command group; their edges into `src/commands` are cut the same
 * way and only the argv path is followed.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ts } from "ts-morph";
import { PolicyFingerprintError } from "../PolicyFingerprint.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/PolicyFingerprintGraph");

/**
 * The file tree a fingerprint is computed from, addressed by repo-relative
 * POSIX paths.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface PolicySourceTree {
  /** Every file under a directory, recursively, as repo-relative paths. */
  readonly files: (directory: string) => Effect.Effect<ReadonlyArray<string>, PolicyFingerprintError>;
  /** The text of one file, or `Option.none()` when it does not exist. */
  readonly read: (file: string) => Effect.Effect<O.Option<string>, PolicyFingerprintError>;
}

/**
 * One workspace package: its directory and raw `exports` / `imports` maps.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PolicyWorkspace extends S.Opaque<PolicyWorkspace, { readonly brand: unique symbol }>()(
  S.Struct({ directory: S.String, exports: S.Unknown, imports: S.Unknown, name: S.String }).pipe(
    $I.annoteSchema("PolicyWorkspace", { description: "PolicyWorkspace data used by the policy graph." })
  )
) {}

/**
 * The fixed entry points of the CLI being fingerprinted.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PolicyCliLayout extends S.Opaque<PolicyCliLayout, { readonly brand: unique symbol }>()(
  S.Struct({ commandsDirectory: S.String, rootBinding: S.String, rootModule: S.String, shell: S.Array(S.String) }).pipe(
    $I.annoteSchema("PolicyCliLayout", { description: "PolicyCliLayout data used by the policy graph." })
  )
) {}

interface ImportEdge {
  /** Local names bound by a named or default import; `none` for namespace, side-effect, re-export or dynamic edges. */
  readonly bindings: O.Option<ReadonlyArray<string>>;
  /** A literal `import("...")` expression rather than a declaration. */
  readonly dynamic: boolean;
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
  readonly imports: HashMap.HashMap<string, { readonly specifier: string; readonly imported: string }>;
  readonly opaqueDynamicImport: boolean;
  readonly starExports: ReadonlyArray<string>;
}

const CLI_COMMAND_MODULE = "effect/cli/Command";

const collectSome = <A, B>(values: Iterable<A>, f: (value: A) => O.Option<B>): Array<B> =>
  A.getSomes(A.map(A.fromIterable(values), f));

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;

const isNamespaceCall = (node: ts.Expression, namespaces: HashSet.HashSet<string>, member: string) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  HashSet.has(namespaces, node.expression.expression.text) &&
  node.expression.name.text === member;

const stringLiteral = (node: ts.Expression | undefined): O.Option<string> =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? O.some(node.text)
    : O.none();

const elementBinding = (node: ts.Expression): O.Option<string> => {
  const inner = unwrap(node);
  return ts.isIdentifier(inner) ? O.some(inner.text) : O.none();
};

interface DeclarationState {
  arrays: HashMap.HashMap<string, ReadonlyArray<ts.Expression>>;
  readonly definitions: Array<readonly [string, ts.Expression]>;
  readonly edges: Array<ImportEdge>;
  exports: ModuleSyntax["exports"];
  imports: ModuleSyntax["imports"];
  namespaces: HashSet.HashSet<string>;
  readonly starExports: Array<string>;
}

const readImportBindings = (state: DeclarationState, clause: ts.ImportClause, specifier: string) => {
  const named = clause.namedBindings;
  const locals: Array<string> = [];
  if (clause.name !== undefined) {
    locals.push(clause.name.text);
    state.imports = HashMap.set(state.imports, clause.name.text, { specifier, imported: "default" });
  }
  if (named !== undefined && ts.isNamedImports(named)) {
    for (const element of A.filter(named.elements, (element) => !element.isTypeOnly)) {
      locals.push(element.name.text);
      state.imports = HashMap.set(state.imports, element.name.text, {
        specifier,
        imported: element.propertyName?.text ?? element.name.text,
      });
    }
  }
  state.edges.push({ specifier, bindings: O.some(locals), dynamic: false });
};

const readImport = (state: DeclarationState, statement: ts.ImportDeclaration) => {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return;
  const clause = statement.importClause;
  const specifier = statement.moduleSpecifier.text;
  if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword) return;
  if (clause === undefined) {
    state.edges.push({ specifier, bindings: O.none(), dynamic: false });
    return;
  }
  const named = clause.namedBindings;
  if (named !== undefined && ts.isNamespaceImport(named)) {
    if (specifier === CLI_COMMAND_MODULE) state.namespaces = HashSet.add(state.namespaces, named.name.text);
    state.edges.push({ specifier, bindings: O.none(), dynamic: false });
    return;
  }
  readImportBindings(state, clause, specifier);
};

const readNamedExports = (state: DeclarationState, clause: ts.NamedExports, specifier: O.Option<string>) => {
  for (const element of A.filter(clause.elements, (element) => !element.isTypeOnly)) {
    const local = element.propertyName?.text ?? element.name.text;
    state.exports = HashMap.set(
      state.exports,
      element.name.text,
      O.isSome(specifier) ? { _tag: "From", specifier: specifier.value, imported: local } : { _tag: "Local", local }
    );
  }
};

const readExport = (state: DeclarationState, statement: ts.ExportDeclaration) => {
  if (statement.isTypeOnly) return;
  const specifier =
    statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
      ? O.some(statement.moduleSpecifier.text)
      : O.none<string>();
  const clause = statement.exportClause;
  if (O.isSome(specifier)) {
    state.edges.push({ specifier: specifier.value, bindings: O.none(), dynamic: false });
    if (clause === undefined) state.starExports.push(specifier.value);
  }
  if (clause !== undefined && ts.isNamedExports(clause)) readNamedExports(state, clause, specifier);
};

const readVariable = (state: DeclarationState, declaration: ts.VariableDeclaration, exported: boolean) => {
  if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) return;
  const name = declaration.name.text;
  if (exported) state.exports = HashMap.set(state.exports, name, { _tag: "Local", local: name });
  const initializer = unwrap(declaration.initializer);
  if (ts.isArrayLiteralExpression(initializer)) state.arrays = HashMap.set(state.arrays, name, initializer.elements);
  state.definitions.push([name, initializer]);
};

const readVariables = (state: DeclarationState, statement: ts.VariableStatement) => {
  const exported = A.some(statement.modifiers ?? [], (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  for (const declaration of statement.declarationList.declarations) readVariable(state, declaration, exported);
};

const readDeclarations = (source: ts.SourceFile): DeclarationState => {
  const state: DeclarationState = {
    edges: [],
    starExports: [],
    imports: HashMap.empty(),
    exports: HashMap.empty(),
    namespaces: HashSet.empty(),
    arrays: HashMap.empty(),
    definitions: [],
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
      readImport(state, statement);
    else if (ts.isExportDeclaration(statement)) readExport(state, statement);
    else if (ts.isVariableStatement(statement)) readVariables(state, statement);
  }
  return state;
};

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
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const moduleSyntax: {
  (text: string): (file: string) => ModuleSyntax;
  (file: string, text: string): ModuleSyntax;
} = dual(2, (file: string, text: string): ModuleSyntax => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    Str.endsWith("x")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const { edges, starExports, imports, exports, namespaces, arrays, definitions } = readDeclarations(source);
  let opaqueDynamicImport = false;

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = stringLiteral(node.arguments[0]);
      if (O.isSome(specifier)) edges.push({ specifier: specifier.value, bindings: O.none(), dynamic: true });
      else opaqueDynamicImport = true;
    }
    if (ts.isImportTypeNode(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(source);

  const subcommandElements = (node: ts.Expression): ReadonlyArray<O.Option<string>> => {
    const inner = unwrap(node);
    if (ts.isArrayLiteralExpression(inner))
      return A.map(inner.elements, (element) => (ts.isSpreadElement(element) ? O.none() : elementBinding(element)));
    if (ts.isIdentifier(inner))
      return O.match(HashMap.get(arrays, inner.text), {
        onNone: () => [O.none()],
        onSome: (elements) =>
          A.map(elements, (element) => (ts.isSpreadElement(element) ? O.none() : elementBinding(element))),
      });
    return [O.none()];
  };

  const analyzePipe = (call: ts.CallExpression, receiver: ts.Expression) => {
    const base = analyze(receiver);
    const piped = A.flatMap(call.arguments, (argument) => {
      const call = unwrap(argument);
      return ts.isCallExpression(call) && isNamespaceCall(call, namespaces, "withSubcommands")
        ? A.flatMap(call.arguments, subcommandElements)
        : [];
    });
    return { make: base.make, subcommands: [...base.subcommands, ...piped] };
  };

  const analyzeSubcommands = (call: ts.CallExpression) => {
    const [self, subcommands] = call.arguments;
    const base = self === undefined ? { make: O.none(), subcommands: [] } : analyze(self);
    return {
      make: base.make,
      subcommands: [...base.subcommands, ...(subcommands === undefined ? [] : subcommandElements(subcommands))],
    };
  };

  const analyze = (
    node: ts.Expression
  ): { readonly make: O.Option<ts.CallExpression>; readonly subcommands: ReadonlyArray<O.Option<string>> } => {
    const inner = unwrap(node);
    if (!ts.isCallExpression(inner)) return { make: O.none(), subcommands: [] };
    if (isNamespaceCall(inner, namespaces, "make")) return { make: O.some(inner), subcommands: [] };
    if (isNamespaceCall(inner, namespaces, "withSubcommands") && inner.arguments.length === 2) {
      return analyzeSubcommands(inner);
    }
    if (ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === "pipe") {
      return analyzePipe(inner, inner.expression.expression);
    }
    return { make: O.none(), subcommands: [] };
  };

  let commands = HashMap.empty<string, CommandDefinition>();
  for (const [name, initializer] of definitions) {
    const analysis = analyze(initializer);
    if (O.isSome(analysis.make)) {
      commands = HashMap.set(commands, name, {
        name: stringLiteral(analysis.make.value.arguments[0]),
        subcommands: analysis.subcommands,
      });
    }
  }
  return { edges, opaqueDynamicImport, imports, exports, starExports, commands };
});

const RUNTIME_EXPORT_CONDITIONS = ["bun", "import", "node", "default"] as const;

const exportTarget = (value: unknown): O.Option<string> => {
  if (P.isString(value)) return O.some(value);
  if (A.isArray(value)) return A.findFirst(A.map(value, exportTarget), O.isSome).pipe(O.flatten);
  if (P.isObject(value) && !A.isArray(value)) {
    const record = value as Readonly<Record<string, unknown>>;
    return pipe(
      RUNTIME_EXPORT_CONDITIONS,
      A.findFirst((condition) => R.has(record, condition)),
      O.flatMap((condition) => exportTarget(record[condition]))
    );
  }
  return O.none();
};

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
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const resolvePackageSubpath: {
  (key: string): (map: unknown) => O.Option<string>;
  (map: unknown, key: string): O.Option<string>;
} = dual(2, (map: unknown, key: string): O.Option<string> => {
  if (P.isString(map) || A.isArray(map)) return key === "." ? exportTarget(map) : O.none();
  if (!P.isObject(map)) return O.none();
  const record = map as Readonly<Record<string, unknown>>;
  if (R.has(record, key)) return exportTarget(record[key]);
  const patterns = pipe(
    R.keys(record),
    A.filter((pattern) => {
      const [prefix, suffix] = Str.split(pattern, "*");
      return (
        A.length(Str.split(pattern, "*")) === 2 &&
        prefix !== undefined &&
        suffix !== undefined &&
        Str.startsWith(prefix)(key) &&
        Str.endsWith(suffix)(key) &&
        key.length >= prefix.length + suffix.length
      );
    }),
    A.sort(Order.mapInput(Order.Number, (pattern: string) => -pattern.length))
  );
  return pipe(
    A.head(patterns),
    O.flatMap((pattern) => {
      const [prefix = "", suffix = ""] = Str.split(pattern, "*");
      const captured = Str.slice(prefix.length, key.length - suffix.length)(key);
      return O.map(exportTarget(record[pattern]), Str.replaceAll("*", captured));
    })
  );
});

const joinPath = (...parts: ReadonlyArray<string>): string =>
  A.join(
    A.reduce(A.flatMap(parts, Str.split("/")), A.empty<string>(), (segments, part) =>
      part === ".." ? A.dropRight(segments, 1) : part === "." || part === "" ? segments : A.append(segments, part)
    ),
    "/"
  );

const directoryOf = (file: string): string => A.join(A.dropRight(Str.split(file, "/"), 1), "/");

const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/;

/**
 * The resolved graph a fingerprint key reaches.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PolicyClosure extends S.Opaque<PolicyClosure, { readonly brand: unique symbol }>()(
  S.Struct({ modules: S.HashSet(S.String), opaqueWorkspaces: S.HashSet(S.String) }).pipe(
    $I.annoteSchema("PolicyClosure", { description: "PolicyClosure data used by the policy graph." })
  )
) {}

/**
 * One resolved command on an argv path.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PolicyCommandNode extends S.Opaque<PolicyCommandNode, { readonly brand: unique symbol }>()(
  S.Struct({ binding: S.String, module: S.String, name: S.String }).pipe(
    $I.annoteSchema("PolicyCommandNode", { description: "PolicyCommandNode data used by the policy graph." })
  )
) {}

/**
 * What a {@link makePolicyGraph} reader walks.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PolicyGraphOptions extends S.Opaque<PolicyGraphOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    tree: S.declare<PolicySourceTree>(
      (value): value is PolicySourceTree =>
        P.isObject(value) &&
        "files" in value &&
        P.isFunction(value.files) &&
        "read" in value &&
        P.isFunction(value.read)
    ),
    workspaces: S.Array(PolicyWorkspace),
  }).pipe($I.annoteSchema("PolicyGraphOptions", { description: "PolicyGraphOptions data used by the policy graph." }))
) {}

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
 * import { makePolicyGraph, PolicyGraphOptions } from "@beep/repo-cli/test/Lint"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const tree = { read: () => Effect.succeed(O.none()), files: () => Effect.succeed([]) }
 * const graph = makePolicyGraph(PolicyGraphOptions.make({ tree, workspaces: [] }))
 * console.log(typeof graph.closure) // "function"
 * ```
 *
 * @internal
 * @param options - Source tree and workspace definitions to traverse.
 * @returns A cached graph reader for command and import closures.
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

  const syntaxOf = Effect.fnUntraced(function* (file: string) {
    const cached = MutableHashMap.get(syntaxCache, file);
    if (O.isSome(cached)) return cached.value;
    const text = yield* tree.read(file);
    const syntax = O.map(text, (content) =>
      TYPESCRIPT_SOURCE.test(file)
        ? moduleSyntax(file, content)
        : {
            edges: [],
            opaqueDynamicImport: false,
            imports: HashMap.empty(),
            exports: HashMap.empty(),
            starExports: [],
            commands: HashMap.empty(),
          }
    );
    MutableHashMap.set(syntaxCache, file, syntax);
    return syntax;
  });

  const exists = Effect.fnUntraced(function* (file: string) {
    return O.isSome(yield* syntaxOf(file));
  });

  const resolveRelative = Effect.fnUntraced(function* (from: string, specifier: string) {
    const base = joinPath(directoryOf(from), specifier);
    const candidates = Str.endsWith(".js")(base)
      ? [`${Str.slice(0, -3)(base)}.ts`, `${Str.slice(0, -3)(base)}.tsx`, base]
      : [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    for (const candidate of candidates) if (yield* exists(candidate)) return O.some(candidate);
    return O.none<string>();
  });

  /** Resolve one specifier from a module; external packages resolve to `none`. */
  const resolve = Effect.fnUntraced(function* (from: string, specifier: string) {
    if (Str.startsWith(".")(specifier)) return yield* resolveRelative(from, specifier);
    if (Str.startsWith("#")(specifier)) {
      return yield* O.match(workspaceOf(from), {
        onNone: () => Effect.succeed(O.none<string>()),
        onSome: (workspace) =>
          O.match(resolvePackageSubpath(workspace.imports, specifier), {
            onNone: () => Effect.succeed(O.none<string>()),
            onSome: (target) => resolveRelative(`${workspace.directory}/package.json`, target),
          }),
      });
    }
    const segments = Str.split(specifier, "/");
    const name = Str.startsWith("@")(specifier) ? A.join(A.take(segments, 2), "/") : (segments[0] ?? "");
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

  const resolveStarExport = Effect.fnUntraced(function* (
    module: string,
    name: string,
    depth: number,
    specifiers: ReadonlyArray<string>
  ) {
    for (const specifier of specifiers) {
      const next = yield* resolve(module, specifier);
      if (O.isNone(next)) continue;
      const found = yield* resolveExport(next.value, name, depth + 1);
      if (O.isSome(found)) return found;
    }
    return O.none<{ readonly module: string; readonly local: string }>();
  });

  const resolveExport: (
    module: string,
    name: string,
    depth: number
  ) => Effect.Effect<O.Option<{ readonly module: string; readonly local: string }>, PolicyFingerprintError> =
    Effect.fnUntraced(function* (module: string, name: string, depth: number) {
      if (depth > 32) return O.none();
      const syntax = yield* syntaxOf(module);
      if (O.isNone(syntax)) return O.none();
      const target = HashMap.get(syntax.value.exports, name);
      if (O.isSome(target)) {
        if (target.value._tag === "Local") return yield* resolveLocal(module, target.value.local, depth + 1);
        const next = yield* resolve(module, target.value.specifier);
        return O.isNone(next) ? O.none() : yield* resolveExport(next.value, target.value.imported, depth + 1);
      }
      return yield* resolveStarExport(module, name, depth, syntax.value.starExports);
    });

  const resolveLocal = Effect.fnUntraced(function* (module: string, local: string, depth: number) {
    const syntax = yield* syntaxOf(module);
    if (O.isNone(syntax)) return O.none<{ readonly module: string; readonly local: string }>();
    if (HashMap.has(syntax.value.commands, local)) return O.some({ module, local });
    const imported = HashMap.get(syntax.value.imports, local);
    if (O.isNone(imported)) return O.some({ module, local });
    const next = yield* resolve(module, imported.value.specifier);
    return O.isNone(next) ? O.none() : yield* resolveExport(next.value, imported.value.imported, depth + 1);
  });

  const definitionOf = Effect.fnUntraced(function* (module: string, binding: string) {
    const syntax = yield* syntaxOf(module);
    return O.flatMap(syntax, (value) => HashMap.get(value.commands, binding));
  });

  const findSubcommand = Effect.fnUntraced(function* (module: string, current: CommandDefinition, token: string) {
    let next = O.none<{ readonly node: PolicyCommandNode; readonly definition: CommandDefinition }>();
    for (const element of current.subcommands) {
      if (O.isNone(element)) continue;
      const target = yield* resolveLocal(module, element.value, 0);
      if (O.isNone(target)) continue;
      const definition = yield* definitionOf(target.value.module, target.value.local);
      if (O.isSome(definition) && O.contains(definition.value.name, token)) {
        next = O.some({
          node: PolicyCommandNode.make({ module: target.value.module, binding: target.value.local, name: token }),
          definition: definition.value,
        });
        break;
      }
    }
    return next;
  });

  /**
   * Walk argv tokens from the root command. Returns every command on the
   * matched path, root first, and how many tokens it consumed.
   */
  const commandPath = Effect.fnUntraced(function* (layout: PolicyCliLayout, tokens: ReadonlyArray<string>) {
    const rootDefinition = yield* definitionOf(layout.rootModule, layout.rootBinding);
    if (O.isNone(rootDefinition)) {
      return yield* PolicyFingerprintError.make({
        message: `Cannot read the root command ${layout.rootBinding} in ${layout.rootModule}`,
        cause: layout.rootModule,
      });
    }
    const nodes: Array<PolicyCommandNode> = [
      PolicyCommandNode.make({
        module: layout.rootModule,
        binding: layout.rootBinding,
        name: O.getOrElse(rootDefinition.value.name, () => ""),
      }),
    ];
    let current = rootDefinition.value;
    let currentModule = layout.rootModule;
    for (const token of tokens) {
      const next = yield* findSubcommand(currentModule, current, token);
      if (O.isNone(next)) break;
      nodes.push(next.value.node);
      current = next.value.definition;
      currentModule = next.value.node.module;
    }
    return nodes;
  });

  /** The specifiers of a command node's module whose imports only bind its subcommands. */
  const subcommandSpecifiers = Effect.fnUntraced(function* (node: PolicyCommandNode) {
    const syntax = yield* syntaxOf(node.module);
    const definition = yield* definitionOf(node.module, node.binding);
    if (O.isNone(syntax) || O.isNone(definition)) return HashSet.empty<string>();
    const subcommands = HashSet.fromIterable(A.getSomes(definition.value.subcommands));
    return HashSet.fromIterable(
      collectSome(syntax.value.edges, (edge) =>
        O.isSome(edge.bindings) &&
        A.isReadonlyArrayNonEmpty(edge.bindings.value) &&
        A.every(edge.bindings.value, (binding) => HashSet.has(subcommands, binding))
          ? O.some(edge.specifier)
          : O.none()
      )
    );
  });

  const closureTargets = Effect.fnUntraced(function* (
    item: { readonly module: string; readonly cut: (specifier: string, target: string) => boolean },
    syntax: ModuleSyntax
  ) {
    const targets: Array<string> = [];
    for (const edge of syntax.edges) {
      const target = yield* resolve(item.module, edge.specifier);
      if (O.isNone(target)) {
        if (Str.startsWith(".")(edge.specifier)) {
          return yield* PolicyFingerprintError.make({
            message: `Cannot resolve ${edge.specifier} imported by ${item.module}`,
            cause: edge.specifier,
          });
        }
        continue;
      }
      if (item.cut(edge.specifier, target.value)) continue;
      targets.push(target.value);
    }
    return targets;
  });

  /**
   * The closure of a set of entry modules. An entry with cut specifiers does
   * not follow those edges; a module reached any other way follows all of its
   * edges.
   */
  const closure = Effect.fnUntraced(function* (
    entries: ReadonlyArray<{
      readonly module: string;
      readonly cut: (specifier: string, target: string) => boolean;
    }>
  ) {
    let modules = HashSet.empty<string>();
    let opaqueWorkspaces = HashSet.empty<string>();
    let expanded = HashSet.empty<string>();
    const pending: Array<{ readonly module: string; readonly cut: (specifier: string, target: string) => boolean }> = [
      ...entries,
    ];
    const noCut = () => false;
    const expand = Effect.fnUntraced(function* (item: {
      readonly module: string;
      readonly cut: (specifier: string, target: string) => boolean;
    }) {
      const full = item.cut === noCut;
      if (full ? HashSet.has(expanded, item.module) : HashSet.has(modules, item.module)) return;
      modules = HashSet.add(modules, item.module);
      if (full) expanded = HashSet.add(expanded, item.module);
      const syntax = yield* syntaxOf(item.module);
      if (O.isNone(syntax)) {
        return yield* PolicyFingerprintError.make({
          message: `Reached module ${item.module} does not exist`,
          cause: item.module,
        });
      }
      if (syntax.value.opaqueDynamicImport) {
        opaqueWorkspaces = O.match(workspaceOf(item.module), {
          onNone: () => opaqueWorkspaces,
          onSome: (workspace) => HashSet.add(opaqueWorkspaces, workspace.directory),
        });
      }
      for (const target of yield* closureTargets(item, syntax.value)) pending.push({ module: target, cut: noCut });
    });
    while (A.isReadonlyArrayNonEmpty(pending)) {
      const item = pending.pop();
      if (item !== undefined) yield* expand(item);
    }
    return PolicyClosure.make({ modules, opaqueWorkspaces });
  });

  const requireDispatchEdge = Effect.fnUntraced(function* (
    module: string,
    target: string,
    edge: ImportEdge,
    entries: HashSet.HashSet<string>
  ) {
    if (edge.dynamic || HashSet.has(entries, module)) return;
    return yield* PolicyFingerprintError.make({
      message: `Shell module ${module} statically imports command module ${target}`,
      cause: target,
    });
  });

  const shellTargets = Effect.fnUntraced(function* (
    module: string,
    syntax: ModuleSyntax,
    entries: HashSet.HashSet<string>,
    insideCommands: (target: string) => boolean
  ) {
    const targets: Array<string> = [];
    for (const edge of syntax.edges) {
      const target = yield* resolve(module, edge.specifier);
      if (O.isNone(target)) continue;
      if (!insideCommands(target.value)) {
        targets.push(target.value);
        continue;
      }
      yield* requireDispatchEdge(module, target.value, edge, entries);
    }
    return targets;
  });

  /**
   * The shell closure: everything the bin loads before it dispatches. The
   * walk never enters the commands directory; only the argv path is followed
   * there. A dispatch edge into it is a declaration in a shell entry or a
   * literal `import()` (a lazy dispatch manifest); a static import of a
   * command module from any other shell module would run that module for
   * every command, so it fails the computation. A shell entry's computed
   * dynamic import (`bin.ts` loading `bin-main.js` by URL) targets another
   * shell entry, so it is not treated as opaque.
   */
  const shellClosure = Effect.fnUntraced(function* (layout: PolicyCliLayout) {
    const entries = HashSet.fromIterable(layout.shell);
    const insideCommands = Str.startsWith(`${layout.commandsDirectory}/`);
    let modules = HashSet.empty<string>();
    let opaqueWorkspaces = HashSet.empty<string>();
    const pending = [...layout.shell];
    const expandShell = Effect.fnUntraced(function* (module: string) {
      if (HashSet.has(modules, module)) return;
      modules = HashSet.add(modules, module);
      const syntax = yield* syntaxOf(module);
      if (O.isNone(syntax))
        return yield* PolicyFingerprintError.make({ message: `Shell module ${module} does not exist`, cause: module });
      if (syntax.value.opaqueDynamicImport && !HashSet.has(entries, module)) {
        opaqueWorkspaces = O.match(workspaceOf(module), {
          onNone: () => opaqueWorkspaces,
          onSome: (workspace) => HashSet.add(opaqueWorkspaces, workspace.directory),
        });
      }
      pending.push(...(yield* shellTargets(module, syntax.value, entries, insideCommands)));
    });
    while (A.isReadonlyArrayNonEmpty(pending)) {
      const module = pending.pop();
      if (module !== undefined) yield* expandShell(module);
    }
    return PolicyClosure.make({ modules, opaqueWorkspaces });
  });

  /** The closure of one command path, without the shell. */
  const commandClosure = Effect.fnUntraced(function* (nodes: ReadonlyArray<PolicyCommandNode>) {
    const entries = yield* Effect.forEach(nodes, (node) =>
      Effect.map(subcommandSpecifiers(node), (specifiers) => ({
        module: node.module,
        cut: (specifier: string) => HashSet.has(specifiers, specifier),
      }))
    );
    return yield* closure(entries);
  });

  return { workspaceOf, commandPath, shellClosure, commandClosure, closure, resolve, syntaxOf } as const;
};

/**
 * A policy graph reader.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PolicyGraph = ReturnType<typeof makePolicyGraph>;

/**
 * Render a closure as Turbo inputs: every reached module, each reached
 * workspace manifest, one `src/**\/*.<ext>` glob per non-TypeScript asset
 * extension under each reached `src` (assets are read at runtime, not
 * imported), and the whole `src` of a workspace with an opaque dynamic import.
 *
 * **Details**
 *
 * Files are listed one by one rather than collapsed into directory globs, so
 * the inputs change only when an import edge changes, never when an unrelated
 * file is added. `covered` holds inputs another set already declares (the
 * shared seal); they are dropped.
 *
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
  const workspaceDirectories = A.sort(
    A.dedupe(
      collectSome(A.fromIterable(reached.modules), (module) => O.map(graph.workspaceOf(module), (w) => w.directory))
    ),
    Order.String
  );
  const inputs: Array<string> = A.fromIterable(reached.modules);
  for (const directory of workspaceDirectories) {
    inputs.push(`${directory}/package.json`);
    if (HashSet.has(reached.opaqueWorkspaces, directory)) {
      inputs.push(`${directory}/src/**`);
      continue;
    }
    const sources = yield* tree.files(`${directory}/src`);
    const extensions = A.dedupe(
      collectSome(sources, (file) => {
        if (TYPESCRIPT_SOURCE.test(file)) return O.none();
        const base = O.getOrElse(A.last(Str.split(file, "/")), () => file);
        return O.map(Str.lastIndexOf(".")(base), (index) => Str.slice(index + 1)(base));
      })
    );
    for (const extension of extensions) inputs.push(`${directory}/src/**/*.${extension}`);
  }
  const opaque = A.map(A.fromIterable(reached.opaqueWorkspaces), (directory) => `${directory}/src/`);
  return A.sort(
    A.dedupe(
      A.filter(
        inputs,
        (input) =>
          !HashSet.has(covered, input) &&
          (Str.endsWith("/src/**")(input) || !A.some(opaque, (prefix) => Str.startsWith(prefix)(input)))
      )
    ),
    Order.String
  );
});
