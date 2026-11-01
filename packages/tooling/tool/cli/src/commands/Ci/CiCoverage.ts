/**
 * Coverage artifacts produced by the hosted unit and Labs test executions.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { toSortedRecord } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";
import { isLabsWorkspaceDir } from "../../internal/cli/Labs/index.ts";
import { runCaptured } from "../../internal/process/StepExec.ts";
import { workspaceManifests } from "../../internal/RepoWorkspaces.ts";
import {
  CoverageProducerCompareOptions,
  CoverageProducerPackage,
  CoverageProducerPartition,
  CoverageProducerWriteOptions,
  compareCoverageProducerArtifacts,
  writeCoverageProducerArtifact,
} from "../Quality/internal/CoverageArtifacts.ts";
import {
  coverageProducerEnvironment,
  QualityTaskStep,
  resolveCiCoverageArtifactPlan,
  runQualityTaskStreamingStepGroup,
} from "../Quality/Tasks.ts";
import { CiCommandError } from "./Ci.errors.ts";
import { CI_LANE_PARTITIONS, withCiLaneDefaultPlacements } from "./CiLanePartitions.ts";
import type { CoverageScopeOwner } from "../Quality/internal/CoverageScope.ts";
import type { CiCoverageArtifactPlan } from "../Quality/Tasks.ts";
import type { CiLanePartitionProof, CiLaneRunOptions } from "./CiLane.ts";
import type { CiLanePartitionShard } from "./CiLanePartitions.ts";

const $I = $RepoCliId.create("commands/Ci/CiCoverage");
const VitestTestFile = S.Struct({ file: S.String }).pipe(
  $I.annoteSchema("VitestTestFile", {
    description: "A configured test file discovered by Vitest without executing it.",
  })
);
const decodeTestFiles = S.decodeUnknownEffect(S.fromJsonString(S.Array(VitestTestFile)));
const normalize = Str.replace(/\\/g, "/");
const CanonicalVitestCommand = S.String.check(
  S.isPattern(
    /^(?:[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9_./:@%+,-]*\s+)*bunx\s+(?:--bun\s+)?vitest\s+run(?:\s+(?:'[^'\n]*'|"(?:\\["\\$`]|[^"\\$`\n])*"|(?:\\[^\n]|[^\s;&|<>()"'`$\\#{}~])+))*$/u
  )
).pipe(
  $I.annoteSchema("CanonicalVitestCommand", {
    description: "A literal Vitest invocation with optional literal environment assignments, without shell evaluation.",
  })
);
const isCanonicalVitestCommand = S.is(CanonicalVitestCommand);
const isEnvironmentAssignment = S.is(S.String.check(S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*=/u)));
const isScriptReference = S.is(S.String.check(S.isPattern(/^bun\s+run\s+[A-Za-z0-9_@][A-Za-z0-9_:@./-]*$/u)));
const isPreparationCommand = S.is(
  S.String.check(S.isPattern(/^bun\s+run\s+--cwd\s+[A-Za-z0-9_@][A-Za-z0-9_@./-]*\s+[A-Za-z0-9_@][A-Za-z0-9_:@./-]*$/u))
);
class CanonicalVitestInvocation extends S.Opaque<CanonicalVitestInvocation, { readonly brand: unique symbol }>()(
  S.Struct({
    command: S.tag("bunx"),
    args: S.Array(S.String),
    cwd: S.String,
    env: S.Record(S.String, S.String),
    continuationScripts: S.Array(S.String),
    preparationCommands: CoverageProducerPackage.fields.preparationCommands,
  }).pipe(
    $I.annoteSchema("CanonicalVitestInvocation", {
      description: "A parsed literal runner invocation with explicit package environment and no shell operators.",
    })
  )
) {}

const decodeInvocations = S.decodeUnknownEffect(S.NonEmptyArray(CanonicalVitestInvocation));
const decodePreparations = S.decodeUnknownEffect(CoverageProducerPackage.fields.preparationCommands);

// Whole quoted words and escaped characters retain pathname-expansion provenance.
const canonicalWordValue = (word: string) => {
  if (Str.startsWith("'")(word)) return Str.slice(1, -1)(word);
  if (Str.startsWith('"')(word)) return Str.replace(/\\(["\\$`])/gu, "$1")(Str.slice(1, -1)(word));
  return Str.replace(/\\(.)/gu, "$1")(word);
};
const expandCanonicalWord = Effect.fnUntraced(function* (word: string, cwd: string) {
  const value = canonicalWordValue(word);
  if (P.or(Str.startsWith("'"), Str.startsWith('"'))(word) || Str.startsWith("-")(value)) return [value];
  // Support the simple pathname stars used by canonical package scripts. Other
  // shell pattern dialects require their own package-script parity qualification.
  const active = Str.replace(/\\./gu, "")(word);
  if (/[?[\]]|\*\*/u.test(active))
    return yield* CiCommandError.make({ message: `Unsupported canonical pathname pattern: ${word}.` });
  if (!Str.includes("*")(active)) return [value];
  if (Str.includes("\\")(word))
    return yield* CiCommandError.make({ message: `Unsupported escaped canonical pathname pattern: ${word}.` });
  const path = yield* Path.Path;
  if (path.isAbsolute(value) || A.some(Str.split("/")(value), (part) => part === ".." || part === "node_modules"))
    return yield* CiCommandError.make({
      message: `Canonical pathname pattern must remain inside its package: ${word}.`,
    });
  const fs = yield* FileSystem.FileSystem;
  const matches = yield* fs.glob(word, { root: cwd }).pipe(CiCommandError.mapError(`Failed to expand ${word}.`));
  return A.isReadonlyArrayEmpty(matches) ? [value] : A.sort(matches, Order.String);
});

const coverageTestCommands = Effect.fn("CiCoverage.testCommands")(function* (
  script: string,
  packageName: string,
  cwd: string
) {
  const segments = Str.split(/\s+&&\s+/)(Str.trim(script));
  const [preparations, remaining] = A.span(segments, isPreparationCommand);
  const preparationCommands = yield* decodePreparations(A.map(preparations, Str.split(/\s+/))).pipe(
    CiCommandError.mapError(`Invalid preparation command for ${packageName}.`)
  );
  const [prefix, continuations] = A.span(remaining, isCanonicalVitestCommand);
  const continuationPattern = /^bun\s+run\s+[A-Za-z0-9_@][A-Za-z0-9_:@./-]*$/u;
  if (A.isReadonlyArrayEmpty(prefix) || !A.every(continuations, (command) => continuationPattern.test(command)))
    return yield* CiCommandError.make({
      message: `Coverage owner ${packageName} must use a canonical Vitest test script.`,
    });
  const commands = yield* Effect.forEach(
    prefix,
    Effect.fnUntraced(function* (command, index) {
      const words = A.map(
        A.fromIterable(Str.matchAll(/'[^'\n]*'|"(?:\\.|[^"\\])*"|(?:\\.|[^\s'"\\])+/gu)(command)),
        (match) => match[0]
      );
      const [assignments, tokens] = A.span(words, isEnvironmentAssignment);
      const args = A.flatten(yield* Effect.forEach(A.drop(tokens, 1), (word) => expandCanonicalWord(word, cwd)));
      const env = A.reduce(assignments, R.empty<string, string>(), (values, assignment) => {
        const name = A.headNonEmpty(Str.split("=")(assignment));
        return R.set(values, name, Str.slice(name.length + 1)(assignment));
      });
      return CanonicalVitestInvocation.make({
        command: "bunx",
        cwd,
        env,
        args,
        preparationCommands: index === 0 ? preparationCommands : [],
        continuationScripts:
          index === prefix.length - 1 ? A.map(continuations, (value) => Str.replace(/^bun\s+run\s+/, "")(value)) : [],
      });
    })
  );
  return yield* decodeInvocations(commands).pipe(
    CiCommandError.mapError(`Invalid canonical invocation list for ${packageName}.`)
  );
});

const coverageTestRuntimeVersion = Effect.fn("CiCoverage.testRuntimeVersion")(function* (
  command: CanonicalVitestInvocation,
  packageName: string,
  testRuntime: CoverageProducerPackage["testRuntime"]
) {
  const version = yield* runCaptured({
    command: testRuntime,
    args: ["--print", `process.versions.${testRuntime}`],
    cwd: command.cwd,
    env: { ...coverageProducerEnvironment(), ...command.env },
    extendEnv: true,
    source: "stdout",
    trim: true,
  }).pipe(CiCommandError.mapError(`Failed to inspect test runtime for ${packageName}.`));
  if (version.exitCode !== 0 || version.truncated || Str.isEmpty(version.output)) {
    return yield* CiCommandError.make({ message: `Invalid test runtime version for ${packageName}.` });
  }
  return version.output;
});

const coverageTestInventory = Effect.fn("CiCoverage.testInventory")(function* (
  command: CanonicalVitestInvocation,
  packageName: string
) {
  const path = yield* Path.Path;
  const runtimeArgs = command.args[0] === "--bun" ? ["--bun"] : [];
  // Vitest's optional JSON output path must not consume a positional test filter.
  const result = yield* runCaptured({
    command: command.command,
    args: [...runtimeArgs, "vitest", "list", "--filesOnly", ...A.drop(command.args, runtimeArgs.length + 2), "--json"],
    cwd: command.cwd,
    env: { ...coverageProducerEnvironment(), ...command.env },
    extendEnv: true,
    source: "stdout",
    trim: true,
  }).pipe(CiCommandError.mapError(`Failed to discover tests for ${packageName}.`));
  if (result.exitCode !== 0 || result.truncated)
    return yield* CiCommandError.make({
      message: `Test discovery for ${packageName} failed or exceeded its capture bound.`,
    });
  const files = yield* decodeTestFiles(result.output).pipe(
    CiCommandError.mapError(`Invalid Vitest test inventory for ${packageName}.`)
  );
  return A.sort(A.dedupe(A.map(files, (file) => normalize(path.resolve(command.cwd, file.file)))), Order.String);
});
const sameCommands = S.toEquivalence(CanonicalVitestInvocation);
const sameTestFiles = A.makeEquivalence(Str.Equivalence);
const normalizedUnitCommand = (command: CanonicalVitestInvocation) =>
  CanonicalVitestInvocation.make({
    ...command,
    args: A.filter(command.args, (arg) => arg !== "--bun" && arg !== "--coverage"),
  });
const cliCoverageCommands = Effect.fn("CiCoverage.cliCommands")(function* (
  script: string,
  unit: A.NonEmptyReadonlyArray<CanonicalVitestInvocation>,
  cwd: string
) {
  const commands = yield* coverageTestCommands(script, "@beep/repo-cli", cwd);
  if (
    commands.length !== 1 ||
    unit.length !== 1 ||
    commands[0].args[0] === "--bun" ||
    !sameCommands(normalizedUnitCommand(commands[0]), normalizedUnitCommand(unit[0]))
  )
    return yield* CiCommandError.make({
      message: "CLI coverage must preserve the canonical unit arguments and environment while using Node/V8.",
    });
  return commands;
});

const resolveCoverageScript = Effect.fn("CiCoverage.resolveCoverageScript")(function* (
  scripts: Readonly<Record<string, string>>,
  packageName: string
) {
  let script = scripts.coverage ?? "";
  let visited = ["coverage"];
  while (isScriptReference(script)) {
    const name = Str.replace(/^bun\s+run\s+/, "")(script);
    if (A.contains(visited, name))
      return yield* CiCommandError.make({ message: `Cyclic coverage script for ${packageName}.` });
    visited = A.append(visited, name);
    script = scripts[name] ?? "";
  }
  return script;
});

const unitOnlyInvocation = Effect.fn("CiCoverage.unitOnlyInvocation")(function* (
  command: CanonicalVitestInvocation,
  packageName: string,
  seen: ReadonlyArray<string>
) {
  const path = yield* Path.Path;
  const files = yield* coverageTestInventory(command, packageName);
  if (packageName === "@beep/repo-cli" && !sameTestFiles(files, seen))
    return yield* CiCommandError.make({
      message: "CLI coverage test census differs from its canonical unit invocation.",
    });
  const missing = A.difference(files, seen);
  if (A.isReadonlyArrayEmpty(missing)) return O.none();
  const extra = CanonicalVitestInvocation.make({
    ...command,
    args: [
      ...A.filter(command.args, (arg) => arg !== "--coverage"),
      ...A.map(seen, (file) => `--exclude=${normalize(path.relative(command.cwd, file))}`),
    ],
    preparationCommands: [],
    continuationScripts: [],
  });
  const actual = yield* coverageTestInventory(extra, packageName);
  if (!sameTestFiles(missing, actual))
    return yield* CiCommandError.make({ message: `Disjoint unit coverage census differs for ${packageName}.` });
  return O.some({ command: extra, files: actual, testOnly: true });
});

const configuredInvocations = Effect.fn("CiCoverage.configuredInvocations")(function* (
  scripts: Readonly<Record<string, string>>,
  packageName: string,
  cwd: string
) {
  const unit = yield* coverageTestCommands(scripts["beep:test"] ?? "", packageName, cwd);
  const script = yield* resolveCoverageScript(scripts, packageName);
  const coverage =
    packageName === "@beep/repo-cli"
      ? yield* cliCoverageCommands(script, unit, cwd)
      : yield* coverageTestCommands(script, packageName, cwd);
  const continuations = A.dedupe(A.flatMap(A.appendAll(coverage, unit), (command) => command.continuationScripts));
  const undeclared = A.findFirst(continuations, (continuation) => scripts[continuation] === undefined);
  if (O.isSome(undeclared))
    return yield* CiCommandError.make({
      message: `Coverage owner ${packageName} has no continuation script ${undeclared.value}.`,
    });
  const runtimes = A.dedupe(A.map(coverage, (command) => command.args[0] === "--bun"));
  if (runtimes.length !== 1)
    return yield* CiCommandError.make({ message: `Mixed canonical coverage runtimes for ${packageName}.` });
  let invocations = yield* Effect.forEach(
    coverage,
    Effect.fnUntraced(function* (command) {
      return { command, files: yield* coverageTestInventory(command, packageName), testOnly: false };
    })
  );
  let seen = A.flatMap(invocations, (invocation) => invocation.files);
  if (A.length(seen) !== A.length(A.dedupe(seen)))
    return yield* CiCommandError.make({ message: `Overlapping canonical coverage invocations for ${packageName}.` });
  for (const command of unit) {
    const extra = yield* unitOnlyInvocation(command, packageName, seen);
    if (O.isSome(extra)) {
      invocations = A.append(invocations, extra.value);
      seen = A.appendAll(seen, extra.value.files);
    }
  }
  const preparations = A.dedupeWith(
    A.flatMap(A.appendAll(coverage, unit), (command) => command.preparationCommands),
    A.makeEquivalence(Str.Equivalence)
  );
  return A.map(invocations, (invocation, index) => ({
    ...invocation,
    command: CanonicalVitestInvocation.make({
      ...invocation.command,
      preparationCommands: index === 0 ? preparations : [],
      continuationScripts: index === invocations.length - 1 ? continuations : [],
    }),
  }));
});

/** Config-aware test discovery, without importing or executing the test bodies. */
const discoverCoveragePackages = Effect.fn("CiCoverage.discoverCoveragePackages")(function* (
  repoRoot: string,
  owners: ReadonlyArray<CoverageScopeOwner>,
  shard?: CiLanePartitionShard
) {
  const path = yield* Path.Path;
  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    CiCommandError.mapError("Failed to read coverage test owners.")
  );
  const selections = yield* Effect.forEach(
    owners,
    Effect.fnUntraced(function* (owner) {
      const workspace = yield* O.match(HashMap.get(workspaces, owner.packageName), {
        onNone: () => CiCommandError.make({ message: `Coverage owner ${owner.packageName} is not a workspace.` }),
        onSome: Effect.succeed,
      });
      const invocations = yield* configuredInvocations(
        toSortedRecord(workspace.manifest.scripts),
        owner.packageName,
        workspace.dir
      );
      return yield* Effect.forEach(
        invocations,
        Effect.fnUntraced(function* ({ command, files, testOnly }, index) {
          const reportDirectory = invocations.length === 1 ? "coverage" : `coverage/invocation-${index}`;
          const testRuntime = command.args[0] === "--bun" ? "bun" : "node";
          const testRuntimeVersion = yield* coverageTestRuntimeVersion(command, owner.packageName, testRuntime);
          return CoverageProducerPackage.make({
            packageName: owner.packageName,
            packagePath: owner.packagePath,
            invocationId: String(index),
            testRuntime,
            testOnly,
            provider: testRuntime === "bun" ? "istanbul" : "v8",
            testRuntimeVersion,
            testCommand: [command.command, ...command.args],
            continuationScripts: command.continuationScripts,
            preparationCommands: command.preparationCommands,
            testEnvironment: command.env,
            runtimeReportPath: `${reportDirectory}/runtime.json`,
            expectedTestFiles: A.sort(
              A.dedupe(A.map(files, (file) => normalize(path.relative(repoRoot, file)))),
              Order.String
            ),
            testReportPath: `${reportDirectory}/unit-results.json`,
            ...(shard === undefined ? {} : { shard }),
          });
        })
      );
    }),
    { concurrency: 2 }
  );
  return A.flatten(selections);
});

/**
 * Resolve the same authoritative coverage owner selection for producers and the consumer.
 *
 * **Example** (Inspect coverage planning)
 *
 * ```ts
 * import { ciCoveragePlan } from "@beep/repo-cli/commands/Ci/CiCoverage"
 * console.log(typeof ciCoveragePlan) // function
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ciCoveragePlan = Effect.fn("CiCoverage.plan")(function* (repoRoot: string, options: CiLaneRunOptions) {
  if (options.filter !== undefined) {
    return yield* CiCommandError.make({
      message: "Artifact coverage uses the authoritative affected owner plan; --filter is not supported.",
    });
  }
  return yield* resolveCiCoverageArtifactPlan(repoRoot, options.affected ? ["--affected"] : [], options.base);
});

/**
 * Freshly execute one unit partition and then seal exactly its selected coverage packages.
 *
 * **Example** (Inspect the unit producer)
 *
 * ```ts
 * import { runCiCoveragePartition } from "@beep/repo-cli/commands/Ci/CiCoverage"
 * console.log(typeof runCiCoveragePartition) // function
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runCiCoveragePartition = Effect.fn("CiCoverage.runPartition")(function* (
  repoRoot: string,
  options: CiLaneRunOptions,
  plan: CiCoverageArtifactPlan,
  proof: CiLanePartitionProof,
  step: QualityTaskStep | undefined
) {
  const packages = yield* discoverCoveragePackages(
    repoRoot,
    A.filter(plan.owners, (owner) => A.contains(proof.packages, owner.packageName)),
    proof.shard
  );
  yield* runAndWrite(repoRoot, options, plan, proof.partition, packages, step);
});

const runAndWrite = Effect.fn("CiCoverage.runAndWrite")(function* (
  repoRoot: string,
  options: CiLaneRunOptions,
  plan: CiCoverageArtifactPlan,
  partitionId: string,
  packages: ReadonlyArray<CoverageProducerPackage>,
  step: QualityTaskStep | undefined
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageNames = A.dedupe(A.map(packages, (entry) => entry.packageName));
  for (const entry of A.dedupeWith(packages, (left, right) => left.packagePath === right.packagePath)) {
    yield* fs
      .remove(path.join(repoRoot, entry.packagePath, "coverage"), { recursive: true, force: true })
      .pipe(CiCommandError.mapError(`Failed to clear stale coverage for ${entry.packageName}.`));
  }
  if (step !== undefined) {
    yield* runOrdinaryCoverageStep(repoRoot, step, packageNames);
  }
  yield* runCompoundCoverageSteps(repoRoot, packages, packageNames, step?.env);
  yield* writeCoverageProducerArtifact(
    repoRoot,
    CoverageProducerWriteOptions.make({
      artifactRoot: options.coverageOutput ?? ".beep/ci-coverage",
      identity: plan.identity,
      partitionId,
      packages,
    })
  ).pipe(
    Effect.mapError((cause) => {
      const message = `Failed to seal coverage partition ${partitionId}.`;
      return CiCommandError.new(cause, P.isError(cause) ? messageWithCause(message, cause) : message);
    })
  );
});

const coverageReporterArgument = (repoRoot: string) =>
  `--reporter=${repoRoot}/packages/tooling/tool/cli/src/commands/Ci/CiCoverage.reporter.ts`;

const runOrdinaryCoverageStep = Effect.fn("CiCoverage.runOrdinaryStep")(function* (
  repoRoot: string,
  step: QualityTaskStep,
  compoundNames: ReadonlyArray<string>
) {
  const args = A.filter(
    step.args,
    (arg) => !A.some(compoundNames, (name) => arg === `${name}#test` || arg === `--filter=${name}`)
  );
  if (A.isReadonlyArrayNonEmpty(compoundNames) && !A.some(args, Str.endsWith("#test"))) return;
  yield* runQualityTaskStreamingStepGroup(step.label, [
    QualityTaskStep.make({
      ...step,
      args: [...args, coverageReporterArgument(repoRoot)],
      env: {
        ...coverageProducerEnvironment(),
        ...step.env,
        BEEP_COVERAGE_INVOCATION_ID: "0",
        BEEP_COVERAGE_RUNTIME_RECEIPT: "coverage/runtime.json",
      },
    }),
  ]);
});

const runCompoundCoverageSteps = Effect.fn("CiCoverage.runCompoundSteps")(function* (
  repoRoot: string,
  packages: ReadonlyArray<CoverageProducerPackage>,
  packageNames: ReadonlyArray<string>,
  environment: QualityTaskStep["env"]
) {
  if (A.isReadonlyArrayEmpty(packages)) return;
  const path = yield* Path.Path;
  yield* runQualityTaskStreamingStepGroup("ci:coverage:compound-prerequisites", [
    QualityTaskStep.make({
      label: "ci:coverage:compound-prerequisites",
      command: "bunx",
      cwd: repoRoot,
      args: ["turbo", "run", "build", ...A.map(packageNames, (name) => `--filter=${name}^...`), "--concurrency=2"],
    }),
  ]);
  const steps = A.map(packages, (entry) =>
    QualityTaskStep.make({
      label: `ci:test:${entry.packageName}:${entry.invocationId}`,
      command: "bunx",
      cwd: path.join(repoRoot, entry.packagePath),
      args: [
        ...A.filter(A.drop(entry.testCommand, 1), (arg) => arg !== "--coverage" && arg !== "--coverage=true"),
        ...A.filter(
          A.drop(ciCoverageTestArgs, 1),
          (arg) => !Str.startsWith("--outputFile=")(arg) && !Str.startsWith("--coverage.provider=")(arg)
        ),
        `--coverage.provider=${entry.provider}`,
        `--coverage.reportsDirectory=${path.dirname(entry.testReportPath)}`,
        `--outputFile=${entry.testReportPath}`,
        coverageReporterArgument(repoRoot),
        ...(entry.shard === undefined ? [] : [`--shard=${entry.shard.index}/${entry.shard.total}`]),
      ],
      env: {
        ...environment,
        ...coverageProducerEnvironment(),
        ...entry.testEnvironment,
        BEEP_COVERAGE_INVOCATION_ID: entry.invocationId,
        BEEP_COVERAGE_RUNTIME_RECEIPT: entry.runtimeReportPath,
      },
    })
  );
  yield* Effect.forEach(
    A.zip(steps, packages),
    Effect.fnUntraced(function* ([step, entry]) {
      for (const command of entry.preparationCommands)
        yield* runQualityTaskStreamingStepGroup(`${step.label}:prepare`, [
          QualityTaskStep.make({
            ...step,
            command: command[0],
            args: A.drop(command, 1),
            env: { ...step.env, BEEP_COVERAGE_INVOCATION_ID: undefined, BEEP_COVERAGE_RUNTIME_RECEIPT: undefined },
          }),
        ]);
      yield* runQualityTaskStreamingStepGroup(step.label, [step]);
      for (const script of entry.continuationScripts)
        yield* runQualityTaskStreamingStepGroup(`${step.label}:${script}`, [
          QualityTaskStep.make({
            ...step,
            command: "bun",
            args: ["run", script],
            env: { ...step.env, BEEP_COVERAGE_INVOCATION_ID: undefined, BEEP_COVERAGE_RUNTIME_RECEIPT: undefined },
          }),
        ]);
    }),
    { discard: true }
  );
});

/**
 * Labs retain their own test execution and artifact rather than disappearing from the unit split.
 *
 * **Example** (Inspect the Labs producer)
 *
 * ```ts
 * import { runCiLabsCoverage } from "@beep/repo-cli/commands/Ci/CiCoverage"
 * console.log(typeof runCiLabsCoverage) // function
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runCiLabsCoverage = Effect.fn("CiCoverage.runLabs")(function* (
  repoRoot: string,
  options: CiLaneRunOptions,
  checks: ReadonlyArray<QualityTaskStep>
) {
  const plan = yield* ciCoveragePlan(repoRoot, options);
  const owners = A.filter(plan.owners, (owner) => isLabsWorkspaceDir(owner.packagePath));
  if (!options.coverageOnly) yield* runQualityTaskStreamingStepGroup("ci:labs:checks", checks);
  const packages = yield* discoverCoveragePackages(repoRoot, owners);
  const step = A.isReadonlyArrayEmpty(packages)
    ? undefined
    : QualityTaskStep.make({
        label: "ci:labs:test",
        command: "bunx",
        cwd: repoRoot,
        args: [
          "turbo",
          "run",
          ...A.map(packages, (entry) => `${entry.packageName}#test`),
          "--only",
          "--force",
          "--concurrency=2",
          ...A.map(packages, (entry) => `--filter=${entry.packageName}`),
          ...ciCoverageTestArgs,
        ],
      });
  yield* runAndWrite(repoRoot, options, plan, "labs", packages, step);
});

/**
 * Artifact comparison only: no test producer or fallback can be reached through this route.
 *
 * **Example** (Inspect artifact comparison)
 *
 * ```ts
 * import { runCiCoverageComparison } from "@beep/repo-cli/commands/Ci/CiCoverage"
 * console.log(typeof runCiCoverageComparison) // function
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runCiCoverageComparison = Effect.fn("CiCoverage.compare")(function* (
  repoRoot: string,
  options: CiLaneRunOptions
) {
  const plan = yield* ciCoveragePlan(repoRoot, options);
  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    CiCommandError.mapError("Failed to read coverage partition inventory.")
  );
  const path = yield* Path.Path;
  const testOwners = A.filter(
    workspaces.pipe(HashMap.entries, A.fromIterable),
    ([, entry]) =>
      !isLabsWorkspaceDir(normalize(path.relative(repoRoot, entry.dir))) && HashMap.has(entry.manifest.scripts, "test")
  );
  const partitions = withCiLaneDefaultPlacements(
    A.filter(CI_LANE_PARTITIONS, (entry) => entry.lane === "test-unit"),
    A.map(testOwners, ([name]) => name)
  );
  const executableNames = A.map(testOwners, ([name]) => name);
  const missing = A.filter(
    plan.owners,
    (owner) => !isLabsWorkspaceDir(owner.packagePath) && !A.contains(executableNames, owner.packageName)
  );
  if (A.isReadonlyArrayNonEmpty(missing)) {
    return yield* CiCommandError.make({
      message: `Coverage owners have no unit test task: ${A.join(
        A.map(missing, (owner) => owner.packageName),
        ", "
      )}.`,
    });
  }
  const discovered = yield* discoverCoveragePackages(repoRoot, plan.owners);
  const expectedPartitions = A.map(partitions, (partition) =>
    CoverageProducerPartition.make({
      partitionId: partition.id,
      packages: A.map(
        A.filter(discovered, (entry) => A.contains(partition.packages, entry.packageName)),
        (entry) =>
          CoverageProducerPackage.make({
            ...entry,
            ...(partition.shard === undefined ? {} : { shard: partition.shard }),
          })
      ),
    })
  );
  const labs = A.filter(discovered, (entry) => isLabsWorkspaceDir(entry.packagePath));
  yield* compareCoverageProducerArtifacts(
    repoRoot,
    CoverageProducerCompareOptions.make({
      artifactRoot: options.coverageInput ?? ".beep/ci-coverage-inputs",
      identity: plan.identity,
      scoped: plan.scoped,
      // Affected (pull request) runs pin the base like every other affected coverage lane does
      // through TURBO_SCM_BASE, so a row the pull request lowered is judged where it belongs.
      ...(options.affected && Str.isNonEmpty(options.base) ? { base: options.base } : {}),
      expectedPartitions: A.append(
        expectedPartitions,
        CoverageProducerPartition.make({ partitionId: "labs", packages: labs })
      ),
    })
  ).pipe(CiCommandError.mapError("Coverage producer artifacts are incomplete or failed regression comparison."));
});

/**
 * Vitest instrumentation and test-file receipt share the original unit invocation.
 *
 * **Example** (Inspect instrumentation flags)
 *
 * ```ts
 * import { ciCoverageTestArgs } from "@beep/repo-cli/commands/Ci/CiCoverage"
 * console.log(ciCoverageTestArgs.includes("--coverage")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciCoverageTestArgs: ReadonlyArray<string> = [
  "--",
  "--coverage",
  "--coverage.provider=istanbul",
  "--coverage.reporter=json",
  "--coverage.reporter=json-summary",
  "--reporter=default",
  "--reporter=json",
  "--outputFile=coverage/unit-results.json",
  "--fileParallelism=true",
  "--maxWorkers=1",
];
