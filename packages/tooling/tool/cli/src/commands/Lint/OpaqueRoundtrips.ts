/**
 * Type-aware regression gate for strict equality of generated Opaque samples.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Project, ts } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { adaptGitKitError, sortedUniquePaths } from "../../internal/repo-run/GitExec.ts";

const $I = $RepoCliId.create("commands/Lint/OpaqueRoundtrips");

/**
 * One assertion comparing a raw generated sample with a freshly built Opaque value.
 *
 * **Example** (Describe an unsafe assertion)
 * ```ts
 * import { OpaqueRoundtripFinding } from "@beep/repo-cli/commands/Lint/OpaqueRoundtrips"
 * console.log(OpaqueRoundtripFinding.make({ file: "a.test.ts", line: 1, opaque: ["Value"], text: "expect(decoded).toStrictEqual(sample)" }).line)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export class OpaqueRoundtripFinding extends S.Opaque<OpaqueRoundtripFinding, { readonly brand: unique symbol }>()(
  S.Struct({ file: S.String, line: S.Int, opaque: S.Array(S.String), text: S.String }).pipe(
    $I.annoteSchema("OpaqueRoundtripFinding", {
      description: "Location, Opaque classes and text of an unsafe generated-sample assertion.",
    })
  )
) {}

/**
 * Opaque roundtrip source discovery or compiler failure.
 *
 * **Example** (Describe a scan failure)
 * ```ts
 * import { OpaqueRoundtripsError } from "@beep/repo-cli/commands/Lint/OpaqueRoundtrips"
 * console.log(OpaqueRoundtripsError.make({ message: "Unable to inspect", cause: "boom" })._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OpaqueRoundtripsError extends S.TaggedError<OpaqueRoundtripsError, { readonly brand: unique symbol }>()(
  $I`OpaqueRoundtripsError`,
  { message: S.String, cause: S.Defect() },
  $I.annoteError<OpaqueRoundtripsError>("OpaqueRoundtripsError", {
    description: "Opaque roundtrip source discovery or compiler failure.",
  })
) {}

const failure = (message: string) => (cause: unknown) => OpaqueRoundtripsError.make({ message, cause });
const isOpaqueClass = (symbol: ts.Symbol | undefined): boolean =>
  A.some(
    symbol?.declarations ?? [],
    (declaration) =>
      ts.isClassDeclaration(declaration) &&
      A.some(declaration.heritageClauses ?? [], (clause) =>
        A.some(clause.types, (type) => /\.Opaque\s*</.test(type.expression.getText()))
      )
  );

const isReference = (type: ts.Type): type is ts.TypeReference =>
  (type.flags & ts.TypeFlags.Object) !== 0 && "target" in type;

const propertyTypes = (checker: ts.TypeChecker, type: ts.Type): ReadonlyArray<ts.Type> =>
  A.getSomes(
    A.map(checker.getPropertiesOfType(type), (property) => {
      if (property.getName() === "brand") return O.none();
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      return O.map(O.fromUndefinedOr(declaration), (location) => checker.getTypeOfSymbolAtLocation(property, location));
    })
  );

const childTypes = (checker: ts.TypeChecker, type: ts.Type): ReadonlyArray<ts.Type> => {
  if (type.isUnionOrIntersection()) return type.types;
  if ((checker.isArrayType(type) || checker.isTupleType(type)) && isReference(type))
    return checker.getTypeArguments(type);
  return (type.flags & ts.TypeFlags.Object) === 0 ? [] : propertyTypes(checker, type);
};

const opaqueNames = (checker: ts.TypeChecker, root: ts.Type): ReadonlyArray<string> => {
  let found = HashSet.empty<string>();
  let seen = HashSet.empty<ts.Type>();
  const visit = (type: ts.Type, depth: number): void => {
    // Compiler types are mutable graphs; preserve the prototype scanner's reference identity.
    if (depth > 8 || HashSet.has(seen, Equal.byReferenceUnsafe(type))) return;
    seen = HashSet.add(seen, type);
    const symbol = type.getSymbol();
    if (!type.isUnionOrIntersection() && isOpaqueClass(symbol)) found = HashSet.add(found, symbol?.getName() ?? "?");
    for (const child of childTypes(checker, type)) visit(child, depth + 1);
  };
  visit(root, 0);
  return A.sort(found, Order.String);
};

const bindingNames = (name: ts.BindingName, names: HashSet.HashSet<string>): HashSet.HashSet<string> => {
  if (ts.isIdentifier(name)) return HashSet.add(names, name.text);
  let result = names;
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) result = bindingNames(element.name, result);
  }
  return result;
};

// Preserve the prototype scanner's call boundary: even an identity call is treated as fresh.
const rawSample = (node: ts.Node, names: HashSet.HashSet<string>): boolean => {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found || ts.isCallExpression(child)) return;
    if (ts.isIdentifier(child) && HashSet.has(names, child.text)) found = true;
    else ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

// One hop of plain aliases: `const x = sample` or `const { a } = sample` inside the callback keeps
// the sample raw. The initializer must reference a parameter outside any call, so the call boundary
// above (`identity(sample)` is fresh) is unchanged.
const aliasDeclarations = (body: ts.Node): ReadonlyArray<ts.VariableDeclaration> => {
  const found = A.empty<ts.VariableDeclaration>();
  const visit = (child: ts.Node): void => {
    if (ts.isVariableDeclaration(child) && child.initializer !== undefined) found.push(child);
    ts.forEachChild(child, visit);
  };
  visit(body);
  return found;
};

const withAliases =
  (parameters: HashSet.HashSet<string>) =>
  (scope: HashSet.HashSet<string>, declaration: ts.VariableDeclaration): HashSet.HashSet<string> =>
    declaration.initializer !== undefined && rawSample(declaration.initializer, parameters)
      ? bindingNames(declaration.name, scope)
      : scope;

const collectParameters = (names: HashSet.HashSet<string>, node: ts.Node): HashSet.HashSet<string> => {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return names;
  const parameters = A.reduce(node.parameters, HashSet.empty<string>(), (scope, parameter) =>
    bindingNames(parameter.name, scope)
  );
  const withSamples = HashSet.union(names, parameters);
  return A.reduce(aliasDeclarations(node.body), withSamples, withAliases(parameters));
};

const collectArgumentSamples = (node: ts.Node, names: HashSet.HashSet<string>): HashSet.HashSet<string> => {
  const scope = collectParameters(names, node);
  return ts.isCallExpression(node) ? A.reduce(node.arguments, scope, collectParameters) : scope;
};

// A call is a property run when an argument's type is an Arbitrary (effect/Arbitrary and fast-check
// both name it so), directly or as an array/tuple element. Resolving the type rather than matching
// the argument text also catches a hoisted `const arb = Arbitrary.schema(X)` passed by name.
const isArbitraryType = (type: ts.Type): boolean => (type.aliasSymbol ?? type.getSymbol())?.getName() === "Arbitrary";

const elementTypes = (checker: ts.TypeChecker, type: ts.Type): ReadonlyArray<ts.Type> =>
  (checker.isArrayType(type) || checker.isTupleType(type)) && isReference(type) ? checker.getTypeArguments(type) : [];

const holdsArbitrary =
  (checker: ts.TypeChecker) =>
  (argument: ts.Expression): boolean => {
    const type = checker.getTypeAtLocation(argument);
    return isArbitraryType(type) || A.some(elementTypes(checker, type), isArbitraryType);
  };

const sampleScope = (
  checker: ts.TypeChecker,
  node: ts.Node,
  names: HashSet.HashSet<string>
): HashSet.HashSet<string> => {
  if (!ts.isCallExpression(node) || !A.some(node.arguments, holdsArbitrary(checker))) return names;
  return A.reduce(node.arguments, names, (scope, argument) => collectArgumentSamples(argument, scope));
};

const expectOperand = (node: ts.Expression): O.Option<ts.Expression> => {
  if (!ts.isCallExpression(node)) return O.none();
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "expect") return O.none();
  return O.fromUndefinedOr(node.arguments[0]);
};

const strictEqualityOperands = (node: ts.Node): O.Option<readonly [ts.Expression, ts.Expression]> => {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return O.none();
  if (node.expression.name.text !== "toStrictEqual") return O.none();
  return O.zipWith(expectOperand(node.expression.expression), O.fromUndefinedOr(node.arguments[0]), Tuple.make);
};

const assertionOpaqueNames = (
  checker: ts.TypeChecker,
  samples: HashSet.HashSet<string>,
  operands: readonly [ts.Expression, ts.Expression]
): ReadonlyArray<string> => {
  const [actual, expected] = operands;
  if (rawSample(actual, samples) === rawSample(expected, samples)) return [];
  return A.sort(
    HashSet.fromIterable(A.flatMap(operands, (operand) => opaqueNames(checker, checker.getTypeAtLocation(operand)))),
    Order.String
  );
};

const assertionFinding = (checker: ts.TypeChecker, samples: HashSet.HashSet<string>, node: ts.Node) => {
  if (HashSet.size(samples) === 0) return O.none<OpaqueRoundtripFinding>();
  const opaque = O.map(strictEqualityOperands(node), (operands) => assertionOpaqueNames(checker, samples, operands));
  return O.map(O.filter(opaque, A.isReadonlyArrayNonEmpty), (names) => {
    const source = node.getSourceFile();
    return OpaqueRoundtripFinding.make({
      file: source.fileName,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      opaque: names,
      text: Str.slice(0, 160)(Str.replace(/\s+/g, " ")(node.getText(source))),
    });
  });
};

/**
 * Detect unsafe assertions in compiler sources using the prototype scanner's exact rule.
 *
 * **Example** (Scan an empty compiler program)
 * ```ts
 * import { detectOpaqueRoundtrips } from "@beep/repo-cli/commands/Lint/OpaqueRoundtrips"
 * import { ts } from "ts-morph"
 * console.log(detectOpaqueRoundtrips(ts.createProgram([], {}))([]).length) // 0
 * ```
 * @param program - Compiler program whose type checker resolves assertion operands.
 * @returns A scanner from source files to their opaque round-trip findings.
 * @category diagnostics
 * @since 0.0.0
 */
export const detectOpaqueRoundtrips =
  (program: ts.Program) =>
  (sources: ReadonlyArray<ts.SourceFile>): ReadonlyArray<OpaqueRoundtripFinding> => {
    const checker = program.getTypeChecker();
    const findings = A.empty<OpaqueRoundtripFinding>();
    const visit = (node: ts.Node, samples: HashSet.HashSet<string>): void => {
      const scope = sampleScope(checker, node, samples);
      O.map(assertionFinding(checker, scope, node), (finding) => findings.push(finding));
      ts.forEachChild(node, (child) => visit(child, scope));
    };
    for (const source of sources) visit(source, HashSet.empty());
    return findings;
  };

const isCandidate = (file: string): boolean => {
  const text = ts.sys.readFile(file);
  return (
    text !== undefined && /effect\/(testing\/)?Arbitrary|FastCheck/.test(text) && Str.includes("toStrictEqual")(text)
  );
};

const nearestConfig = (path: Path.Path, root: string, file: string): O.Option<string> => {
  let dir = path.dirname(file);
  while (Str.startsWith(root)(dir)) {
    const config = A.findFirst(
      A.map(["tsconfig.test.json", "tsconfig.json"], (name) => path.join(dir, name)),
      ts.sys.fileExists
    );
    if (O.isSome(config)) return config;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return O.none();
};

const groupCandidates = (path: Path.Path, root: string, candidates: ReadonlyArray<string>) => {
  let groups = HashMap.empty<string, ReadonlyArray<string>>();
  for (const file of candidates) {
    O.map(nearestConfig(path, root, file), (config) => {
      groups = HashMap.set(groups, config, A.append(O.getOrElse(HashMap.get(groups, config), A.empty<string>), file));
    });
  }
  return groups;
};

const compilerLibraries = (path: Path.Path) => {
  // ts-morph bundles standard libraries in memory rather than beside ts.sys's compiler path.
  // Feed those same libraries to the bare host so callback inference remains intact.
  const libraries = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext },
  });
  libraries.createSourceFile("library-probe.ts", "export {};");
  return HashMap.fromIterable(
    A.map(
      A.filter(libraries.getProgram().compilerObject.getSourceFiles(), (source) => source.isDeclarationFile),
      (source) => Tuple.make(path.basename(source.fileName), source.text)
    )
  );
};

const compilerHost = (path: Path.Path, libraryText: HashMap.HashMap<string, string>, options: ts.CompilerOptions) => {
  const host = { ...ts.createCompilerHost(options), useSourceOfProjectReferenceRedirect: () => true };
  const readSource = host.getSourceFile;
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
    const library = HashMap.get(libraryText, path.basename(file));
    return O.isSome(library)
      ? ts.createSourceFile(file, library.value, languageVersion)
      : readSource(file, languageVersion, onError, shouldCreateNewSourceFile);
  };
  return host;
};

const configFindings = (
  path: Path.Path,
  libraryText: HashMap.HashMap<string, string>,
  config: string,
  files: ReadonlyArray<string>
): ReadonlyArray<OpaqueRoundtripFinding> => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  );
  if (parsed === undefined) return [];
  const options = { ...parsed.options, noEmit: true };
  const program = ts.createProgram({
    rootNames: A.fromIterable(files),
    options,
    host: compilerHost(path, libraryText, options),
    ...(parsed.projectReferences === undefined ? {} : { projectReferences: parsed.projectReferences }),
  });
  const sources = A.getSomes(A.map(files, (file) => O.fromUndefinedOr(program.getSourceFile(file))));
  return detectOpaqueRoundtrips(program)(sources);
};

// The tracked test files the scan type-checks.
const TEST_FILE_PATHSPEC = ["*.test.ts", "*.test.tsx"];

const scan = Effect.fn("OpaqueRoundtrips.scan")(function* () {
  const root = yield* findRepoRoot();
  const path = yield* Path.Path;
  const git = yield* Git;
  const entries = yield* git.lsFiles(root, { pathspec: TEST_FILE_PATHSPEC }).pipe(
    Effect.mapError(
      adaptGitKitError(GitCommand.lsFiles(TEST_FILE_PATHSPEC), {
        onSpawnFailure: failure,
        onNonZeroExit: ({ commandLine, exitCode }) => failure(`${commandLine} exited ${exitCode}`)(exitCode),
        onTruncated: O.none(),
      })
    )
  );
  const tracked = sortedUniquePaths(A.map(entries, (entry) => entry.path));
  return yield* Effect.try({
    try: () => {
      const candidates = A.filter(
        A.map(tracked, (file) => path.join(root, file)),
        isCandidate
      );
      const libraryText = compilerLibraries(path);
      const findings = A.flatMap(A.fromIterable(groupCandidates(path, root, candidates)), ([config, files]) =>
        configFindings(path, libraryText, config, files)
      );
      return {
        findings: A.map(findings, (finding) =>
          OpaqueRoundtripFinding.make({ ...finding, file: path.relative(root, finding.file) })
        ),
        candidates: candidates.length,
      };
    },
    catch: failure("Unable to inspect Opaque roundtrip assertions"),
  });
});

const run = Effect.fn("OpaqueRoundtrips.run")(function* () {
  const { findings, candidates } = yield* scan();
  for (const site of findings)
    yield* Console.log(`${site.file}:${site.line} [${A.join(site.opaque, ", ")}] ${site.text}`);
  yield* Console.log(
    `Arbitrary-sample Opaque toStrictEqual asserts: ${findings.length} in ${HashSet.size(HashSet.fromIterable(A.map(findings, (site) => site.file)))} file(s); scanned ${candidates} candidate file(s)`
  );
  if (A.isReadonlyArrayNonEmpty(findings))
    return yield* failWithReportedExit("opaque-roundtrips: normalise generated samples before strict equality.");
});

/**
 * Reject strict equality roundtrips over raw Arbitrary Opaque samples.
 *
 * **Example** (Inspect the command name)
 * ```ts
 * import { lintOpaqueRoundtripsCommand } from "@beep/repo-cli/commands/Lint/OpaqueRoundtrips"
 * console.log(lintOpaqueRoundtripsCommand.name) // opaque-roundtrips
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const lintOpaqueRoundtripsCommand = Command.make("opaque-roundtrips", {}, run).pipe(
  Command.withDescription("Reject prototype-sensitive strict equality roundtrips over generated Opaque samples")
);
