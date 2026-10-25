/**
 * Sealed coverage artifacts shared by CI test producers and the report-only gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import * as O from "@beep/utils/Option";
import { IstanbulCoverageProvider } from "@vitest/coverage-istanbul/dist/provider.js";
import { createCoverageMap, createFileCoverage } from "@vitest/istanbul-lib-coverage";
import { createInstrumenter } from "@vitest/istanbul-lib-instrument";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Node, Project, ts } from "ts-morph";
import { createVitest } from "vitest/node";
import { messageWithCause } from "../../../internal/cli/CommandErrorFields.ts";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import {
  createContainedFileString,
  readContainedFileStringNoFollow,
  writeContainedFileString,
} from "../../../internal/cli/FsGuards.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";
import {
  CoveragePackageArtifact,
  CoverageProducerIdentity,
  CoverageProducerManifest,
  CoverageProducerPackage,
  CoverageRawFile,
  CoverageRuntimeReceipt,
  CoverageSourceIdentity,
} from "./CoverageArtifacts.schemas.ts";
import { coverageProducerEnvironment } from "./CoverageEnvironment.ts";
import {
  CoverageSnapshotEntry,
  compareCoverageRegressionBaseline,
  coveragePackageBaselineFromSummaryForTesting,
} from "./CoverageRegression.ts";
import type { Vitest } from "vitest/node";
import type { CoverageProducerCompareOptions, CoverageProducerWriteOptions } from "./CoverageArtifacts.schemas.ts";

export {
  CoverageProducerCompareOptions,
  CoverageProducerIdentity,
  CoverageProducerPackage,
  CoverageProducerPartition,
  CoverageProducerWriteOptions,
  CoverageRuntimeReceipt,
} from "./CoverageArtifacts.schemas.ts";

const configurationError = (message: string) => QualityTaskConfigurationError.new(`Coverage artifact: ${message}`);
const boundaryError = (message: string) => (cause: unknown) => configurationError(messageWithCause(message, cause));
const mapError = (message: string) => QualityTaskConfigurationError.mapError(`Coverage artifact: ${message}`);
const sorted = (values: ReadonlyArray<string>) => A.sort(A.dedupe(values), Order.String);
const sameStrings = A.makeEquivalence(Str.Equivalence);
const decodeSourceFiles = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.String)));
const encodeString = S.encodeEffect(S.fromJsonString(S.String));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeRaw = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, CoverageRawFile)));
const ManifestJson = S.fromJsonString(CoverageProducerManifest);
const encodeManifest = S.encodeEffect(ManifestJson);
const decodeManifest = S.decodeUnknownEffect(ManifestJson, { onExcessProperty: "error" });
const decodeResults = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      success: S.tag(true),
      numFailedTests: S.tag(0),
      numFailedTestSuites: S.tag(0),
      testResults: S.Array(S.Struct({ name: S.NonEmptyString, status: S.tag("passed") })),
    })
  )
);
const decodeRuntimeReceipt = S.decodeUnknownEffect(S.fromJsonString(CoverageRuntimeReceipt), {
  onExcessProperty: "error",
});
const decodeIdentity = S.decodeUnknownEffect(CoverageProducerIdentity);
const packageEquivalence = S.toEquivalence(CoverageProducerPackage);
const identityEquivalence = S.toEquivalence(CoverageProducerIdentity);
const sourceEquivalence = A.makeEquivalence(S.toEquivalence(CoverageSourceIdentity));

const requireUnique = Effect.fn("CoverageArtifacts.requireUnique")(function* (
  values: ReadonlyArray<string>,
  label: string
) {
  if (A.length(values) !== A.length(A.dedupe(values))) return yield* configurationError(`duplicate ${label}.`);
});

const relativeFile = Effect.fn("CoverageArtifacts.relativeFile")(function* (root: string, file: string) {
  const path = yield* Path.Path;
  const relative = path.relative(root, path.resolve(root, file));
  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    A.some(Str.split(relative, "/"), (part) => part === ".." || part === ".") ||
    Str.includes("\\")(relative)
  ) {
    return yield* configurationError(`path leaves its selected root: ${file}.`);
  }
  return relative;
});

const readText = Effect.fn("CoverageArtifacts.readText")(function* (root: string, file: string) {
  const path = yield* Path.Path;
  const relative = yield* relativeFile(root, file);
  const read = yield* readContainedFileStringNoFollow(root, path.join(root, relative)).pipe(
    mapError(`cannot safely read ${relative}.`)
  );
  if (!read.exists || O.isNone(read.contents)) return yield* configurationError(`missing required file ${relative}.`);
  return read.contents.value;
});

const digest = (text: string) => sha256Hex(text).pipe(mapError("cannot hash artifact bytes."));
const jsonDigest = (value: unknown) =>
  encodeJson(value).pipe(Effect.flatMap(digest), mapError("cannot hash identity."));

const gitRef = Effect.fn("CoverageArtifacts.gitRef")(function* (repoRoot: string, ref: string) {
  const result = yield* runCaptured({
    command: "git",
    args: ["rev-parse", "--verify", `${ref}^{commit}`],
    cwd: repoRoot,
  }).pipe(mapError(`cannot resolve ${ref}.`));
  if (result.exitCode !== 0) return yield* configurationError(`cannot resolve ${ref}.`);
  return Str.trim(result.output);
});

/**
 * Bind a coverage scope to the actual checkout and trusted workflow attempt.
 *
 * **Example** (Build the identity effect)
 * ```ts
 * import { resolveCoverageProducerIdentity } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * const identity = resolveCoverageProducerIdentity("/repo", { base: "origin/main", packageNames: [] })
 * console.log(Effect.isEffect(identity))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const resolveCoverageProducerIdentity = Effect.fn("CoverageArtifacts.resolveIdentity")(function* (
  repoRoot: string,
  options: { readonly base: string; readonly packageNames: ReadonlyArray<string> }
) {
  const executionSha = yield* gitRef(repoRoot, "HEAD");
  const baseSha = yield* gitRef(repoRoot, options.base);
  const runId = yield* configStringOption("BEEP_COVERAGE_RUN_ID").pipe(
    Effect.flatMap(O.match({ onSome: Effect.succeedSome, onNone: () => configStringOption("GITHUB_RUN_ID") }))
  );
  const attempt = yield* configStringOption("BEEP_COVERAGE_RUN_ATTEMPT").pipe(
    Effect.flatMap(O.match({ onSome: Effect.succeedSome, onNone: () => configStringOption("GITHUB_RUN_ATTEMPT") }))
  );
  if (O.isNone(runId) || O.isNone(attempt)) return yield* configurationError("workflow run and attempt are required.");
  const runAttempt = yield* S.decodeEffect(S.FiniteFromString)(attempt.value).pipe(
    mapError("invalid workflow attempt.")
  );
  const requestHeadSha = yield* configStringOption("BEEP_COVERAGE_REQUEST_HEAD_SHA");
  return yield* decodeIdentity({
    executionSha,
    baseSha,
    runId: runId.value,
    runAttempt,
    scopeDigest: yield* jsonDigest(sorted(options.packageNames)),
    ...O.getSomesStruct({ requestHeadSha }),
  }).pipe(mapError("invalid execution identity."));
});

const discoverInvocationSources = Effect.fn("CoverageArtifacts.discoverInvocationSources")(function* (
  repoRoot: string,
  packageRoot: string,
  invocation: CoverageProducerPackage,
  zeroWitness = false
) {
  const helper = new URL("./CoverageConfig.runtime.ts", import.meta.url);
  const helperUrl = yield* encodeString(helper.href).pipe(mapError("cannot encode discovery helper URL."));
  const bootstrap = `import(${helperUrl}).then(m=>m.runCoverageConfigRuntimeDiscovery(process.argv))`;
  const command = invocation.testCommand;
  const canonical = A.isReadonlyArrayEmpty(command)
    ? ["vitest", "run"]
    : A.drop(command, command[1] === "--bun" ? 2 : 1);
  const result = yield* runCaptured({
    command: invocation.testRuntime,
    args: [
      ...(invocation.testRuntime === "node" ? ["--experimental-strip-types"] : []),
      "--input-type=module",
      "--eval",
      bootstrap,
      "--",
      ...canonical,
    ],
    cwd: packageRoot,
    env: {
      ...coverageProducerEnvironment(),
      ...invocation.testEnvironment,
      BEEP_COVERAGE_EXPECTED_RUNTIME: invocation.testRuntime,
      BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION: invocation.testRuntimeVersion,
      BEEP_COVERAGE_EXPECTED_PROVIDER: invocation.provider,
      BEEP_COVERAGE_V8_ZERO_WITNESS: zeroWitness === true ? "1" : undefined,
    },
    extendEnv: true,
    source: "stdout",
  }).pipe(mapError("cannot discover canonical invocation sources."));
  if (result.exitCode !== 0 || result.truncated)
    return yield* configurationError(`canonical invocation source discovery failed: ${result.output}.`);
  const files = yield* decodeSourceFiles(result.output).pipe(mapError("invalid invocation source census."));
  return sorted(yield* Effect.forEach(files, (file) => relativeFile(repoRoot, file), { concurrency: 1 }));
});

/**
 * Resolve the provider's complete configured source census without running tests.
 *
 * **Example** (Discover selected sources)
 * ```ts
 * import { discoverCoverageArtifactSources } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(discoverCoverageArtifactSources("/repo", "packages/example")))
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const discoverCoverageArtifactSources = Effect.fn("CoverageArtifacts.discoverSources")(function* (
  repoRoot: string,
  packagePath: string,
  invocation?: CoverageProducerPackage
) {
  const path = yield* Path.Path;
  const packageRoot = path.join(repoRoot, yield* relativeFile(repoRoot, packagePath));
  if (invocation !== undefined) return yield* discoverInvocationSources(repoRoot, packageRoot, invocation);
  return yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () =>
        createVitest({
          root: packageRoot,
          watch: false,
          coverage: { enabled: true, provider: "istanbul", clean: false },
        }),
      catch: boundaryError("cannot resolve Vitest configuration."),
    }),
    Effect.fnUntraced(function* (context: Vitest) {
      const provider = new IstanbulCoverageProvider();
      yield* Effect.try({
        try: () => provider.initialize(context),
        catch: boundaryError("cannot initialize Istanbul discovery."),
      });
      const files = yield* Effect.tryPromise({
        try: () => provider.getUntestedFiles([]),
        catch: boundaryError("cannot discover configured coverage sources."),
      });
      return sorted(yield* Effect.forEach(files, (file) => relativeFile(repoRoot, file), { concurrency: 1 }));
    }),
    (context) => Effect.promise(() => context.close())
  );
});

const hasNoCoverageUnits = (coverage: Pick<CoverageRawFile, "statementMap" | "fnMap" | "branchMap">) =>
  A.isReadonlyArrayEmpty(R.keys(coverage.statementMap)) &&
  A.isReadonlyArrayEmpty(R.keys(coverage.fnMap)) &&
  A.isReadonlyArrayEmpty(R.keys(coverage.branchMap));

const isEmptyUndecoratedClass = (node: Node) =>
  Node.isClassDeclaration(node) &&
  A.isReadonlyArrayEmpty(node.getMembers()) &&
  A.isReadonlyArrayEmpty(node.getDecorators());

const isDefaultCallExport = (node: Node) =>
  Node.isExportAssignment(node) && !node.isExportEquals() && Node.isCallExpression(node.getExpression());

const isDirectiveStatement = (node: Node) =>
  Node.isExpressionStatement(node) && Node.isStringLiteral(node.getExpression());

const structuralZero = Effect.fn("CoverageArtifacts.structuralZero")(function* (file: string, source: string) {
  return yield* Effect.try({
    try: () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const parsed = project.createSourceFile(file, source);
      const statements = parsed.getStatements();
      const directives = A.takeWhile(statements, isDirectiveStatement);
      const admissible = A.every(
        statements,
        (statement) =>
          Node.isImportDeclaration(statement) ||
          Node.isExportDeclaration(statement) ||
          Node.isInterfaceDeclaration(statement) ||
          Node.isTypeAliasDeclaration(statement) ||
          isEmptyUndecoratedClass(statement) ||
          isDefaultCallExport(statement) ||
          A.contains(directives, statement)
      );
      if (!admissible) return undefined;
      const instrumenter = createInstrumenter({
        produceSourceMap: true,
        autoWrap: false,
        esModules: true,
        coverageVariable: "__VITEST_COVERAGE__",
        coverageGlobalScope: "globalThis",
        coverageGlobalScopeFunc: false,
        ignoreClassMethods: [],
        ignoreLines: true,
      });
      // Istanbul 2 parses JavaScript/JSX. Erase types without downleveling runtime
      // syntax or eliding value imports before asking it to prove zero units.
      const { outputText } = ts.transpileModule(source, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.Preserve,
          verbatimModuleSyntax: true,
        },
      });
      instrumenter.instrumentSync(outputText, file);
      return O.fromNullishOr(instrumenter.lastFileCoverage()).pipe(O.filter(hasNoCoverageUnits), O.getOrUndefined);
    },
    catch: boundaryError(`cannot prove zero coverage units for ${file}.`),
  }).pipe(
    Effect.flatMap((coverage) =>
      O.match(O.fromUndefinedOr(coverage), {
        onNone: () => Effect.succeedNone,
        onSome: (value) =>
          S.decodeEffect(CoverageRawFile)(value).pipe(Effect.asSome, mapError("invalid zero-unit witness.")),
      })
    )
  );
});

// ast-v8-to-istanbul derives a missing else count as parent minus consequent.
// Preserve that signed residual: the coverage library sums it and counts only >0.
const rawBranch = CoverageRawFile.fields.branchMap.value;
const rawBranchRange = rawBranch.fields.loc;
const sameRawBranchRange = S.toEquivalence(rawBranchRange);
const V8ImplicitElseResidual = S.Struct({
  provider: S.tag("v8"),
  branch: S.Struct({
    type: S.tag("if"),
    loc: rawBranchRange,
    locations: S.Tuple([rawBranchRange, rawBranch.fields.locations.value.members[1]]),
  }),
  hits: S.Tuple([S.Natural, S.Int.check(S.isLessThan(0))]),
});
const isV8ImplicitElseResidual = S.is(V8ImplicitElseResidual);
const isNatural = S.is(S.Natural);
const validSignedBranch = (
  provider: CoverageProducerPackage["provider"],
  branch: CoverageRawFile["branchMap"][string],
  hits: ReadonlyArray<number>
) => {
  const candidate = { provider, branch, hits };
  return (
    isV8ImplicitElseResidual(candidate) &&
    isNatural(candidate.hits[0] + candidate.hits[1]) &&
    sameRawBranchRange(candidate.branch.loc, candidate.branch.locations[0])
  );
};

const validBranchHits = (
  provider: CoverageProducerPackage["provider"],
  branch: CoverageRawFile["branchMap"][string],
  hits: O.Option<ReadonlyArray<number>>
) =>
  O.isSome(hits) &&
  A.length(hits.value) === A.length(branch.locations) &&
  (A.every(hits.value, isNatural) || validSignedBranch(provider, branch, hits.value));

const validateCounters = Effect.fn("CoverageArtifacts.validateCounters")(function* (
  file: CoverageRawFile,
  provider: CoverageProducerPackage["provider"]
) {
  for (const [locations, counters] of [
    Tuple.make(R.keys(file.statementMap), R.keys(file.s)),
    Tuple.make(R.keys(file.fnMap), R.keys(file.f)),
    Tuple.make(R.keys(file.branchMap), R.keys(file.b)),
  ]) {
    if (!sameStrings(sorted(locations), sorted(counters)))
      return yield* configurationError(`counter/location mismatch for ${file.path}.`);
  }
  for (const [key, branch] of R.toEntries(file.branchMap)) {
    const hits = R.get(file.b, key);
    if (!validBranchHits(provider, branch, hits))
      return yield* configurationError(`invalid branch counters (arity or signed residual) ${key} for ${file.path}.`);
  }
});

const normalizedRaw = Effect.fn("CoverageArtifacts.normalizedRaw")(function* (
  repoRoot: string,
  selection: CoverageProducerPackage,
  text: string
) {
  const path = yield* Path.Path;
  const decoded = yield* decodeRaw(text).pipe(mapError(`invalid raw coverage for ${selection.packageName}.`));
  const entries = yield* Effect.forEach(
    R.toEntries(decoded),
    Effect.fnUntraced(function* ([key, file]) {
      const normalized = yield* relativeFile(repoRoot, key);
      const normalizedValue = yield* relativeFile(repoRoot, file.path);
      yield* relativeFile(path.join(repoRoot, selection.packagePath), path.join(repoRoot, normalized));
      if (normalized !== normalizedValue) return yield* configurationError(`raw map key/path disagree for ${key}.`);
      yield* validateCounters(file, selection.provider);
      return [normalized, CoverageRawFile.make({ ...file, path: normalized })] as const;
    }),
    { concurrency: 1 }
  );
  yield* requireUnique(
    A.map(entries, ([file]) => file),
    "normalized report source"
  );
  return R.fromEntries(A.sortWith(entries, (entry) => entry[0], Order.String));
});

// V8 deliberately removes SSR imported-member aliases from its own unit map.
// Admit only immutable aliases rooted in an import, then require the actual
// configured provider to independently reproduce the zero-unit map.
const isV8ImportBindingSource = (file: string, source: string) => {
  const project = new Project({ useInMemoryFileSystem: true });
  const parsed = project.createSourceFile(file, source);
  const imports = A.flatMap(parsed.getImportDeclarations(), (declaration) => [
    ...O.toArray(O.fromUndefinedOr(declaration.getDefaultImport()?.getText())),
    ...O.toArray(O.fromUndefinedOr(declaration.getNamespaceImport()?.getText())),
    ...A.map(declaration.getNamedImports(), (named) => named.getAliasNode()?.getText() ?? named.getName()),
  ]);
  return A.every(parsed.getStatements(), (statement) => {
    if (Node.isImportDeclaration(statement) || Node.isExportDeclaration(statement)) return true;
    if (!Node.isVariableStatement(statement) || statement.getDeclarationKind() !== "const") return false;
    return A.every(statement.getDeclarations(), (declaration) => {
      if (!Node.isIdentifier(declaration.getNameNode())) return false;
      let value = declaration.getInitializer();
      if (value === undefined || !Node.isPropertyAccessExpression(value)) return false;
      while (Node.isPropertyAccessExpression(value)) value = value.getExpression();
      return Node.isIdentifier(value) && A.contains(imports, value.getText());
    });
  });
};

const requireZeroSource = Effect.fn("CoverageArtifacts.requireZeroSource")(function* (
  file: string,
  text: string,
  selection: CoverageProducerPackage,
  v8ZeroFiles: ReturnType<typeof discoverInvocationSources>
) {
  if (O.isSome(yield* structuralZero(file, text))) return;
  if (selection.provider !== "v8" || !isV8ImportBindingSource(file, text))
    return yield* configurationError(`missing executable source ${file}.`);
  if (!A.contains(yield* v8ZeroFiles, file))
    return yield* configurationError(`missing executable source ${file}; V8 witness has coverage units.`);
});

const sourceInventory = Effect.fn("CoverageArtifacts.sourceInventory")(function* (
  repoRoot: string,
  selection: CoverageProducerPackage,
  raw: Readonly<Record<string, CoverageRawFile>>
) {
  const files = yield* discoverCoverageArtifactSources(repoRoot, selection.packagePath, selection);
  const path = yield* Path.Path;
  const v8ZeroFiles = yield* Effect.cached(
    discoverInvocationSources(repoRoot, path.join(repoRoot, selection.packagePath), selection, true)
  );
  const unexpected = A.difference(R.keys(raw), files);
  if (A.isReadonlyArrayNonEmpty(unexpected))
    return yield* configurationError(`unexpected coverage sources: ${A.join(unexpected, ", ")}.`);
  return yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (file) {
      const text = yield* readText(repoRoot, file);
      const reported = R.get(raw, file);
      if (selection.provider === "v8" && O.isNone(reported))
        return yield* configurationError(`missing V8 source ${file}; no provider-backed zero witness.`);
      const structural = O.isNone(reported) || hasNoCoverageUnits(reported.value);
      if (structural) yield* requireZeroSource(file, text, selection, v8ZeroFiles);
      return CoverageSourceIdentity.make({ path: file, sha256: yield* digest(text), structuralZero: structural });
    }),
    { concurrency: 1 }
  );
});

const actualTests = Effect.fn("CoverageArtifacts.actualTests")(function* (
  repoRoot: string,
  selection: CoverageProducerPackage
) {
  const path = yield* Path.Path;
  const report = yield* readText(repoRoot, path.join(selection.packagePath, selection.testReportPath)).pipe(
    Effect.flatMap(decodeResults),
    mapError(`unsuccessful/missing test results for ${selection.packageName}.`)
  );
  const files = yield* Effect.forEach(report.testResults, (result) => relativeFile(repoRoot, result.name), {
    concurrency: 1,
  });
  yield* requireUnique(files, "executed test file");
  if (A.isReadonlyArrayNonEmpty(A.difference(files, selection.expectedTestFiles)))
    return yield* configurationError(`unexpected executed tests for ${selection.packageName}.`);
  return sorted(files);
});

const validateRuntimeReceipt = Effect.fn("CoverageArtifacts.validateRuntimeReceipt")(function* (
  selection: CoverageProducerPackage,
  receipt: CoverageRuntimeReceipt
) {
  if (
    !receipt.success ||
    receipt.invocationId !== selection.invocationId ||
    receipt.testRuntime !== selection.testRuntime ||
    receipt.runtimeVersion !== selection.testRuntimeVersion ||
    receipt.provider !== selection.provider
  ) {
    return yield* configurationError(
      `test runtime receipt differs from invocation ${selection.packageName}/${selection.invocationId}.`
    );
  }
});
const packageInvocationKey = (selection: CoverageProducerPackage) =>
  `${selection.packageName}:${selection.invocationId}`;

const sealPackage = Effect.fn("CoverageArtifacts.sealPackage")(function* (
  repoRoot: string,
  artifactRoot: string,
  selection: CoverageProducerPackage
) {
  const path = yield* Path.Path;
  yield* requireUnique(selection.expectedTestFiles, "expected test file");
  const original = yield* readText(
    repoRoot,
    path.join(selection.packagePath, path.dirname(selection.testReportPath), "coverage-final.json")
  );
  const raw = yield* normalizedRaw(repoRoot, selection, original);
  const text = yield* encodeJson(raw).pipe(mapError("cannot encode normalized raw coverage."));
  const receiptText = yield* readText(repoRoot, path.join(selection.packagePath, selection.runtimeReportPath));
  const receipt = yield* decodeRuntimeReceipt(receiptText).pipe(mapError("invalid test runtime receipt."));
  yield* validateRuntimeReceipt(selection, receipt);
  const reportDirectory = `reports/${yield* digest(packageInvocationKey(selection))}`;
  const reportPath = `${reportDirectory}/coverage-final.json`;
  const runtimeReceiptPath = `${reportDirectory}/runtime.json`;
  yield* writeContainedFileString(repoRoot, path.join(artifactRoot, runtimeReceiptPath), receiptText).pipe(
    mapError("cannot seal runtime receipt.")
  );
  const target = path.join(artifactRoot, reportPath);
  yield* writeContainedFileString(repoRoot, target, text).pipe(mapError("cannot seal raw report."));
  return CoveragePackageArtifact.make({
    selection,
    reportPath,
    reportSha256: yield* digest(text),
    runtimeReceiptPath,
    runtimeReceiptSha256: yield* digest(receiptText),
    actualTestFiles: yield* actualTests(repoRoot, selection),
    sources: yield* sourceInventory(repoRoot, selection, raw),
  });
});

const checkCheckout = Effect.fn("CoverageArtifacts.checkCheckout")(function* (
  repoRoot: string,
  identity: CoverageProducerIdentity
) {
  if ((yield* gitRef(repoRoot, "HEAD")) !== identity.executionSha)
    return yield* configurationError("tested execution SHA differs from the checkout.");
});

/**
 * Seal normalized raw reports only after the selected tests passed.
 *
 * **Example** (Inspect the producer effect)
 * ```ts
 * import { writeCoverageProducerArtifact } from "@beep/repo-cli/test/Quality"
 * console.log(typeof writeCoverageProducerArtifact) // function
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const writeCoverageProducerArtifact = Effect.fn("CoverageArtifacts.writeProducer")(function* (
  repoRoot: string,
  options: CoverageProducerWriteOptions
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* checkCheckout(repoRoot, options.identity);
  yield* requireUnique(A.map(options.packages, packageInvocationKey), "producer package invocation");
  const runtimeVersion = O.fromUndefinedOr(process.versions.bun);
  if (O.isNone(runtimeVersion)) return yield* configurationError("coverage producer must run under Bun.");
  const artifactRoot = path.resolve(repoRoot, options.artifactRoot);
  yield* relativeFile(repoRoot, artifactRoot);
  if (yield* fs.exists(path.join(artifactRoot, "manifest.json")))
    return yield* configurationError("producer manifest already exists; refusing stale output.");
  const packages = yield* Effect.forEach(options.packages, (entry) => sealPackage(repoRoot, artifactRoot, entry), {
    concurrency: 1,
  });
  const manifest = CoverageProducerManifest.make({
    schemaVersion: "coverage-producer/v1",
    identity: options.identity,
    partitionId: options.partitionId,
    rawFormat: "istanbul",
    coverageLibraryVersion: "1.0.2",
    producerRuntime: "bun",
    producerRuntimeVersion: runtimeVersion.value,
    packages,
  });
  yield* createContainedFileString(
    repoRoot,
    path.join(artifactRoot, "manifest.json"),
    yield* encodeManifest(manifest).pipe(mapError("cannot encode manifest."))
  ).pipe(mapError("cannot write manifest."));
});

const instrumentationIdentity = (file: CoverageRawFile) => ({
  statementMap: file.statementMap,
  fnMap: file.fnMap,
  branchMap: file.branchMap,
});

const PackageCensus = S.Struct({
  packagePath: S.String,
  testRuntime: S.String,
  testRuntimeVersion: S.String,
  provider: S.String,
  testOnly: S.Boolean,
  testCommand: S.Array(S.String),
  preparationCommands: CoverageProducerPackage.fields.preparationCommands,
  continuationScripts: CoverageProducerPackage.fields.continuationScripts,
  testEnvironment: S.Record(S.String, S.String),
  shardTotal: S.Finite,
  expectedTestFiles: S.Array(S.String),
  sources: S.Array(CoverageSourceIdentity),
});
const censusEquivalence = S.toEquivalence(PackageCensus);
const packageCensus = (entry: CoveragePackageArtifact) => ({
  packagePath: entry.selection.packagePath,
  testRuntime: entry.selection.testRuntime,
  testRuntimeVersion: entry.selection.testRuntimeVersion,
  provider: entry.selection.provider,
  testOnly: entry.selection.testOnly,
  testCommand: entry.selection.testCommand,
  preparationCommands: entry.selection.preparationCommands,
  continuationScripts: entry.selection.continuationScripts,
  testEnvironment: entry.selection.testEnvironment,
  shardTotal: entry.selection.shard?.total ?? 1,
  expectedTestFiles: sorted(entry.selection.expectedTestFiles),
  sources: entry.sources,
});
const samePackageCensus = (a: CoveragePackageArtifact, b: CoveragePackageArtifact) =>
  censusEquivalence(packageCensus(a), packageCensus(b));

const validatePackageSlices = Effect.fn("CoverageArtifacts.validatePackageSlices")(function* (
  slices: A.NonEmptyReadonlyArray<CoveragePackageArtifact>
) {
  const first = slices[0];
  const expected = first.selection;
  const shardCount = O.fromUndefinedOr(expected.shard).pipe(
    O.map((shard) => shard.total),
    O.getOrElse(() => 1)
  );
  if (A.length(slices) !== shardCount)
    return yield* configurationError(`incomplete shard set for ${expected.packageName}.`);
  const indexes = A.map(slices, (slice) => slice.selection.shard?.index ?? 1);
  if (!sameStrings(sorted(A.map(indexes, String)), sorted(A.map(A.range(1, shardCount), String))))
    return yield* configurationError(`duplicate/incomplete shard indexes for ${expected.packageName}.`);
  for (const slice of slices) {
    if (!samePackageCensus(slice, first))
      return yield* configurationError(`inconsistent package shard census for ${expected.packageName}.`);
  }
  const tests = A.flatMap(slices, (slice) => slice.actualTestFiles);
  yield* requireUnique(tests, "test file across shards");
  if (!sameStrings(sorted(tests), sorted(expected.expectedTestFiles)))
    return yield* configurationError(`incomplete executed test census for ${expected.packageName}.`);
  return expected;
});

const validatePackageInvocations = Effect.fn("CoverageArtifacts.validatePackageInvocations")(function* (
  slices: A.NonEmptyReadonlyArray<CoveragePackageArtifact>
) {
  const canonical = A.filter(slices, (slice) => !slice.selection.testOnly);
  const selection = yield* O.match(A.head(canonical), {
    onNone: () => configurationError("missing canonical coverage invocation."),
    onSome: (entry) => Effect.succeed(entry.selection),
  });
  if (A.length(A.dedupe(A.map(canonical, (slice) => slice.selection.provider))) !== 1)
    return yield* configurationError("mixed coverage providers within one package.");
  const groups = A.groupBy(slices, (slice) => slice.selection.invocationId);
  yield* Effect.forEach(R.values(groups), validatePackageSlices, { concurrency: 1 });
  const invocations = A.map(R.values(groups), (group) => group[0]);
  for (const [index, invocation] of A.map(invocations, (invocation, index) => Tuple.make(index, invocation))) {
    for (const previous of A.take(invocations, index)) {
      const overlaps = A.intersection(invocation.selection.expectedTestFiles, previous.selection.expectedTestFiles);
      if (invocation.selection.testRuntime === previous.selection.testRuntime && A.isReadonlyArrayNonEmpty(overlaps))
        return yield* configurationError(
          `overlapping same-runtime invocations for ${invocation.selection.packageName}.`
        );
    }
  }
  return selection;
});

const loadManifest = Effect.fn("CoverageArtifacts.loadManifest")(function* (
  repoRoot: string,
  file: string,
  options: CoverageProducerCompareOptions
) {
  const manifest = yield* readText(repoRoot, file).pipe(
    Effect.flatMap(decodeManifest),
    mapError("invalid producer manifest.")
  );
  if (
    manifest.identity.runAttempt > options.identity.runAttempt ||
    !identityEquivalence(
      CoverageProducerIdentity.make({ ...manifest.identity, runAttempt: options.identity.runAttempt }),
      options.identity
    )
  )
    return yield* configurationError("stale execution, base, scope, or workflow attempt.");
  const expected = A.findFirst(
    options.expectedPartitions,
    (partition) => partition.partitionId === manifest.partitionId
  );
  if (O.isNone(expected)) return yield* configurationError(`unexpected partition ${manifest.partitionId}.`);
  const actual = A.sort(
    manifest.packages,
    Order.mapInput(Order.String, (entry: CoveragePackageArtifact) => packageInvocationKey(entry.selection))
  );
  const selections = A.sort(expected.value.packages, Order.mapInput(Order.String, packageInvocationKey));
  if (
    !A.makeEquivalence(packageEquivalence)(
      A.map(actual, (entry) => entry.selection),
      selections
    )
  )
    return yield* configurationError(`package assignment differs for ${manifest.partitionId}.`);
  return manifest;
});

const newestProducerPartitions = Effect.fn("CoverageArtifacts.newestProducerPartitions")(function* (
  located: ReadonlyArray<[CoverageProducerManifest, string]>
) {
  return yield* Effect.forEach(
    R.values(A.groupBy(located, ([manifest]) => manifest.partitionId)),
    Effect.fnUntraced(function* (candidates) {
      const attempts = A.map(candidates, ([manifest]) => manifest.identity.runAttempt);
      if (A.length(attempts) !== A.length(A.dedupe(attempts)))
        return yield* configurationError("duplicate producer partition attempt.");
      return A.sortWith(candidates, ([manifest]) => manifest.identity.runAttempt, Order.flip(Order.Number))[0];
    })
  );
});

const libraryRange = (range: CoverageRawFile["statementMap"][string]) => ({
  ...range,
  end: { ...range.end, column: range.end.column ?? Number.POSITIVE_INFINITY },
});
const libraryCoverage = (file: CoverageRawFile) =>
  createFileCoverage({
    ...file,
    statementMap: R.map(file.statementMap, libraryRange),
    fnMap: R.map(file.fnMap, (fn) => ({
      ...fn,
      line: fn.line ?? fn.loc.start.line,
      decl: libraryRange(fn.decl),
      loc: libraryRange(fn.loc),
    })),
    branchMap: R.map(file.branchMap, (branch) => ({
      ...branch,
      line: branch.line ?? branch.loc.start.line,
      loc: libraryRange(branch.loc),
      locations: A.map(branch.locations, (range) => ({
        start: { line: range.start.line ?? branch.loc.end.line, column: range.start.column ?? 0 },
        end: {
          line: range.end.line ?? branch.loc.end.line,
          column: range.end.column ?? Number.POSITIVE_INFINITY,
        },
      })),
    })),
    b: R.map(file.b, A.fromIterable),
  });

const loadSliceCoverage = Effect.fn("CoverageArtifacts.loadSlice")(function* (
  repoRoot: string,
  directory: string,
  entry: CoveragePackageArtifact
) {
  const receiptText = yield* readText(directory, entry.runtimeReceiptPath);
  if ((yield* digest(receiptText)) !== entry.runtimeReceiptSha256)
    return yield* configurationError("runtime receipt digest mismatch.");
  const receipt = yield* decodeRuntimeReceipt(receiptText).pipe(mapError("invalid sealed runtime receipt."));
  yield* validateRuntimeReceipt(entry.selection, receipt);
  const report = yield* readText(directory, entry.reportPath);
  if ((yield* digest(report)) !== entry.reportSha256)
    return yield* configurationError(`report digest mismatch for ${entry.selection.packageName}.`);
  const raw = yield* normalizedRaw(repoRoot, entry.selection, report);
  const sources = yield* sourceInventory(repoRoot, entry.selection, raw);
  if (!sourceEquivalence(sources, entry.sources))
    return yield* configurationError(`stale source census for ${entry.selection.packageName}.`);
  return yield* Effect.forEach(
    sources,
    Effect.fnUntraced(function* (source) {
      const coverage = R.get(raw, source.path);
      if (O.isSome(coverage)) return coverage.value;
      const empty = yield* structuralZero(source.path, yield* readText(repoRoot, source.path));
      return yield* O.match(empty, {
        onSome: Effect.succeed,
        onNone: () => configurationError(`missing source ${source.path}.`),
      });
    }),
    { concurrency: 1 }
  );
});

/**
 * Validate complete partition artifacts and merge counters without running tests.
 *
 * **Example** (Inspect the collector effect)
 * ```ts
 * import { collectCoverageProducerArtifacts } from "@beep/repo-cli/test/Quality"
 * console.log(typeof collectCoverageProducerArtifacts) // function
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const collectCoverageProducerArtifacts = Effect.fn("CoverageArtifacts.collect")(function* (
  repoRoot: string,
  options: CoverageProducerCompareOptions
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* checkCheckout(repoRoot, options.identity);
  yield* requireUnique(
    A.map(options.expectedPartitions, (partition) => partition.partitionId),
    "expected partition"
  );
  const expectedNames = sorted(
    A.flatMap(options.expectedPartitions, (partition) => A.map(partition.packages, (entry) => entry.packageName))
  );
  if ((yield* jsonDigest(expectedNames)) !== options.identity.scopeDigest)
    return yield* configurationError("selected package scope differs from the execution identity.");
  const root = path.resolve(repoRoot, options.artifactRoot);
  yield* relativeFile(repoRoot, root);
  const files = yield* fs.glob("**/manifest.json", { root }).pipe(mapError("cannot enumerate producer manifests."));
  const manifests = yield* Effect.forEach(files, (file) => loadManifest(repoRoot, path.resolve(root, file), options), {
    concurrency: 1,
  });
  const selected = yield* newestProducerPartitions(A.zip(manifests, files));
  if (
    !sameStrings(
      sorted(A.map(selected, ([manifest]) => manifest.partitionId)),
      sorted(A.map(options.expectedPartitions, (partition) => partition.partitionId))
    )
  )
    return yield* configurationError("missing producer partitions.");
  const locatedPackages = A.flatMap(selected, ([manifest, file]: [CoverageProducerManifest, string]) =>
    A.map(manifest.packages, (entry) => ({ entry, directory: path.dirname(path.resolve(root, file)) }))
  );
  const packages = A.groupBy(locatedPackages, (slice) => slice.entry.selection.packageName);
  return yield* Effect.forEach(
    A.sortWith(R.toEntries(packages), (entry) => entry[0], Order.String),
    Effect.fnUntraced(function* ([packageName, located]) {
      const slices = A.map(located, (slice) => slice.entry);
      const selection = yield* validatePackageInvocations(slices);
      const merged = createCoverageMap({});
      const seen = R.empty<string, string>();
      const reports = yield* Effect.forEach(
        located,
        Effect.fnUntraced(function* ({ entry, directory }) {
          const files = yield* loadSliceCoverage(repoRoot, directory, entry);
          return entry.selection.testOnly ? [] : files;
        }),
        { concurrency: 1 }
      );
      for (const file of A.flatten(reports)) {
        const fingerprint = yield* jsonDigest(instrumentationIdentity(file));
        const previous = R.get(seen, file.path);
        if (O.isSome(previous) && previous.value !== fingerprint)
          return yield* configurationError(`incompatible instrumentation for ${file.path}.`);
        seen[file.path] = fingerprint;
        yield* Effect.try({
          try: () => merged.addFileCoverage(libraryCoverage(file)),
          catch: boundaryError(`cannot merge ${file.path}.`),
        });
      }
      const summary = R.fromEntries(
        A.map(
          merged.files(),
          (file) => [path.join(repoRoot, file), merged.fileCoverageFor(file).toSummary().toJSON()] as const
        )
      );
      const text = yield* encodeJson({ total: merged.getCoverageSummary().toJSON(), ...summary }).pipe(
        mapError("cannot encode merged summary.")
      );
      return CoverageSnapshotEntry.make({
        packageName,
        baseline: yield* coveragePackageBaselineFromSummaryForTesting(
          repoRoot,
          path.join(repoRoot, selection.packagePath),
          text
        ),
      });
    }),
    { concurrency: 1 }
  );
});

/**
 * Run the existing ratchet against validated producer snapshots, with no test fallback.
 *
 * **Example** (Inspect the comparison adapter)
 * ```ts
 * import { compareCoverageProducerArtifacts } from "@beep/repo-cli/test/Quality"
 * console.log(typeof compareCoverageProducerArtifacts) // function
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const compareCoverageProducerArtifacts = Effect.fn("CoverageArtifacts.compare")(function* (
  repoRoot: string,
  options: CoverageProducerCompareOptions
) {
  const snapshots = yield* collectCoverageProducerArtifacts(repoRoot, options);
  return yield* compareCoverageRegressionBaseline(
    repoRoot,
    options.scoped,
    sorted(
      A.flatMap(options.expectedPartitions, (partition) => A.map(partition.packages, (entry) => entry.packageName))
    ),
    snapshots
  );
});
