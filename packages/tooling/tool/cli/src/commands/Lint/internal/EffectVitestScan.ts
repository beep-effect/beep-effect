/** Full syntax-only Effect Vitest scan and ratchet orchestration. @packageDocumentation @since 0.0.0 */

import { findRepoRoot } from "@beep/repo-utils";
import { FsUtils, GlobOptions } from "@beep/repo-utils/FsUtils";
import { A, Str } from "@beep/utils";
import { Console, Effect, Equal, FileSystem, HashMap, Inspectable, MutableHashMap, Order, Path } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Project } from "ts-morph";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { diffMembership } from "../../../internal/ratchet/index.ts";
import { createWorkspaceOwnerResolver } from "../../../internal/tsmorph/index.ts";
import { EffectVitestLintError } from "../Lint.errors.ts";
import {
  EffectVitestCensusRow,
  EffectVitestFinding,
  EffectVitestInventoryDocument,
  EffectVitestScanTiming,
  EffectVitestSourceFileGlobs,
  isEffectVitestTestFilePath,
  makeEffectVitestFindingKey,
} from "../Lint.schemas.ts";
import { detectEffectVitestFindings } from "./EffectVitestDetectors.ts";
import { applyEffectVitestPrimitiveGraph } from "./EffectVitestPolicy.ts";
import { readEffectVitestPrimitiveGraph } from "./EffectVitestPrimitives.ts";
import {
  readEffectVitestInventory,
  writeEffectVitestCensus,
  writeEffectVitestInventory,
  writeEffectVitestRows,
} from "./EffectVitestStore.ts";
import type { EffectVitestLintOptions, EffectVitestPrimitiveGraphDocument } from "../Lint.schemas.ts";

const EffectVitestPackageMetadata = S.Struct({
  name: S.Literal("@effect/vitest"),
  version: S.NonEmptyString,
});

/**
 * Fail when the installed Effect Vitest package does not match the decoded graph header.
 *
 * **Example** (Build the version guard)
 *
 * ```ts
 * import { verifyEffectVitestPin } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * import { readEffectVitestPrimitiveGraph } from "@beep/repo-cli/commands/Lint"
 *
 * const program = readEffectVitestPrimitiveGraph(process.cwd()).pipe(
 *   Effect.flatMap((graph) => verifyEffectVitestPin(process.cwd(), graph))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyEffectVitestPin: {
  (
    root: string,
    graph: EffectVitestPrimitiveGraphDocument
  ): Effect.Effect<void, EffectVitestLintError, FileSystem.FileSystem | Path.Path>;
  (
    graph: EffectVitestPrimitiveGraphDocument
  ): (root: string) => Effect.Effect<void, EffectVitestLintError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn("EffectVitestScan.verifyPin")(function* (root: string, graph: EffectVitestPrimitiveGraphDocument) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packagePath = path.resolve(root, "node_modules", graph.package, "package.json");
    const text = yield* fs
      .readFileString(packagePath)
      .pipe(EffectVitestLintError.mapError("Unable to read the installed @effect/vitest package metadata."));
    const installed = yield* S.decodeEffect(S.fromJsonString(EffectVitestPackageMetadata))(text).pipe(
      Effect.mapError((cause) =>
        EffectVitestLintError.new(
          `Unable to decode installed @effect/vitest package metadata: ${Inspectable.toStringUnknown(cause, 0)}`
        )
      )
    );
    if (!Equal.equals(installed.version, graph.version)) {
      return yield* EffectVitestLintError.new(
        `Installed ${graph.package} ${installed.version} does not match graph pin ${graph.tag} (${graph.sha}). ` +
          "Regenerate source anchors at the new tag, review the semantic diff, and update the graph pin before rerunning effect-vitest."
      );
    }
  })
);

const findingOrder = Order.mapInput(Order.String, (finding: EffectVitestFinding) => finding.id);

/**
 * Count physical source lines without treating a terminal newline as an empty line.
 *
 * **Example** (Count empty and unterminated sources)
 *
 * ```ts
 * import { countEffectVitestSourceLines } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(countEffectVitestSourceLines("")) // 0
 * console.log(countEffectVitestSourceLines("one\ntwo")) // 2
 * console.log(countEffectVitestSourceLines("one\n")) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const countEffectVitestSourceLines = (text: string): number =>
  Str.isEmpty(text) ? 0 : Str.split("\n")(text).length - (Str.endsWith("\n")(text) ? 1 : 0);

/**
 * Discover the schema-owned D9 path set through the repository filesystem service.
 *
 * **Details**
 *
 * The schema keeps includes and `!` exclusions together for persistence. This
 * boundary converts exclusions to `GlobOptions.ignore` because the shared glob
 * service treats every pattern-array entry as an alternative.
 *
 * **Example** (Discover files beneath a repository root)
 *
 * ```ts
 * import { discoverEffectVitestSourcePaths } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = discoverEffectVitestSourcePaths(process.cwd())
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const discoverEffectVitestSourcePaths = Effect.fn("EffectVitestScan.discoverSourcePaths")(function* (
  root: string
) {
  const fsUtils = yield* FsUtils;
  const excludedGlobs = A.filter(EffectVitestSourceFileGlobs, Str.startsWith("!"));
  const includedGlobs = A.filter(EffectVitestSourceFileGlobs, (pattern) => !Str.startsWith("!")(pattern));
  return yield* fsUtils
    .globFiles(
      includedGlobs,
      GlobOptions.make({
        cwd: root,
        absolute: true,
        ignore: A.map(excludedGlobs, Str.slice(1)),
      })
    )
    .pipe(EffectVitestLintError.mapError("Unable to discover the Effect Vitest D9 scope."));
});

const legacyFindingKey = (finding: EffectVitestFinding): string =>
  makeEffectVitestFindingKey(
    EffectVitestFinding.make({ ...finding, occurrence: O.none(), id: Str.replace(/#\d+$/u, "#1")(finding.id) })
  );
const occurrenceGroup = (finding: EffectVitestFinding): string =>
  makeEffectVitestFindingKey(EffectVitestFinding.make({ ...finding, id: Str.replace(/#\d+$/u, "#1")(finding.id) }));
const findingGroups = (findings: ReadonlyArray<EffectVitestFinding>, key: (finding: EffectVitestFinding) => string) => {
  const groups = MutableHashMap.empty<string, ReadonlyArray<EffectVitestFinding>>();
  for (const finding of findings) {
    const identity = key(finding);
    MutableHashMap.set(groups, identity, [
      ...O.getOrElse(MutableHashMap.get(groups, identity), A.empty<EffectVitestFinding>),
      finding,
    ]);
  }
  return groups;
};
const membershipKeys = (current: ReadonlyArray<EffectVitestFinding>, baseline: ReadonlyArray<EffectVitestFinding>) => {
  const currentGroups = findingGroups(current, legacyFindingKey);
  const baselineGroups = findingGroups(baseline, legacyFindingKey);
  return (finding: EffectVitestFinding): string => {
    const legacy = legacyFindingKey(finding);
    const left = MutableHashMap.get(currentGroups, legacy);
    const right = MutableHashMap.get(baselineGroups, legacy);
    const uniqueLegacy =
      O.exists(left, (rows) => rows.length === 1) &&
      O.exists(right, (rows) => rows.length === 1) &&
      (O.exists(left, (rows) => A.some(rows, (row) => O.isNone(row.occurrence))) ||
        O.exists(right, (rows) => A.some(rows, (row) => O.isNone(row.occurrence))));
    return uniqueLegacy ? legacy : makeEffectVitestFindingKey(finding);
  };
};

/**
 * Reapply justified exceptions only across unambiguous occurrence matches.
 *
 * **Details**
 *
 * Ordinary membership may bridge unique legacy fingerprints, but an exception
 * requires matching stored anchors on both sides. Legacy rows lack full historical
 * statement/context identity and always require explicit re-review. Duplicate
 * anchored occurrences also remain open even when their ordinal keys match.
 *
 * **Example** (Preserve an exception reason)
 *
 * ```ts
 * import { preserveEffectVitestExceptions } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(preserveEffectVitestExceptions([], O.none()).length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const preserveEffectVitestExceptions: {
  (
    live: ReadonlyArray<EffectVitestFinding>,
    existing: O.Option<EffectVitestInventoryDocument>
  ): ReadonlyArray<EffectVitestFinding>;
  (
    existing: O.Option<EffectVitestInventoryDocument>
  ): (live: ReadonlyArray<EffectVitestFinding>) => ReadonlyArray<EffectVitestFinding>;
} = dual(2, (live: ReadonlyArray<EffectVitestFinding>, existing: O.Option<EffectVitestInventoryDocument>) => {
  const previous = O.getOrElse(
    O.map(existing, (document) => document.findings),
    A.empty<EffectVitestFinding>
  );
  const key = makeEffectVitestFindingKey;
  const previousGroups = findingGroups(previous, occurrenceGroup);
  const liveGroups = findingGroups(live, occurrenceGroup);
  const keyedPrevious: ReadonlyArray<readonly [string, EffectVitestFinding]> = A.map(
    previous,
    (finding): readonly [string, EffectVitestFinding] => [key(finding), finding]
  );
  const previousByKey = HashMap.fromIterable(keyedPrevious);
  return A.map(live, (finding) => {
    const match = HashMap.get(previousByKey, key(finding));
    return O.match(match, {
      onNone: () => finding,
      onSome: (candidate) =>
        candidate.status === "exception" &&
        O.isSome(candidate.reason) &&
        O.exists(MutableHashMap.get(previousGroups, occurrenceGroup(candidate)), (rows) => rows.length === 1) &&
        O.exists(MutableHashMap.get(liveGroups, occurrenceGroup(finding)), (rows) => rows.length === 1) &&
        O.isSome(candidate.occurrence) &&
        O.isSome(finding.occurrence)
          ? EffectVitestFinding.make({ ...finding, status: "exception", reason: candidate.reason })
          : finding,
    });
  });
});

type EffectVitestFindingDifference = {
  readonly currentCount: number;
  readonly baselineCount: number;
  readonly introduced: ReadonlyArray<EffectVitestFinding>;
  readonly resolved: ReadonlyArray<EffectVitestFinding>;
};

/**
 * Diff live findings against the baseline using the shared membership ratchet.
 *
 * **Example** (Classify baseline growth)
 *
 * ```ts
 * import { diffEffectVitestFindings } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(diffEffectVitestFindings([], []).introduced.length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const diffEffectVitestFindings: {
  (
    current: ReadonlyArray<EffectVitestFinding>,
    baseline: ReadonlyArray<EffectVitestFinding>
  ): EffectVitestFindingDifference;
  (
    baseline: ReadonlyArray<EffectVitestFinding>
  ): (current: ReadonlyArray<EffectVitestFinding>) => EffectVitestFindingDifference;
} = dual(2, (current: ReadonlyArray<EffectVitestFinding>, baseline: ReadonlyArray<EffectVitestFinding>) => {
  const key = membershipKeys(current, baseline);
  const keyedCurrent = A.map(current, (finding) => ({ finding, key: key(finding) }));
  const keyedBaseline = A.map(baseline, (finding) => ({ finding, key: key(finding) }));
  const keyedOrder = Order.mapInput(
    Order.String,
    (entry: { readonly finding: EffectVitestFinding }) => entry.finding.id
  );
  const difference = diffMembership({
    current: keyedCurrent,
    baseline: keyedBaseline,
    equivalence: (left, right) => left.key === right.key,
    order: keyedOrder,
  });
  return {
    currentCount: difference.currentCount,
    baselineCount: difference.baselineCount,
    introduced: A.map(difference.introduced, ({ finding }) => finding),
    resolved: A.map(difference.resolved, ({ finding }) => finding),
  };
});

/**
 * Run the requested P0c census, baseline, rows, or default-ratchet modes.
 *
 * **Details**
 *
 * The operation verifies the installed rc.112 pin, builds one syntax-only
 * project from the D9 paths, and returns a scan receipt distinct from package
 * test timing.
 *
 * **Example** (Build the default ratchet effect)
 *
 * ```ts
 * import { EffectVitestLintOptions, runEffectVitestLint } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const options = EffectVitestLintOptions.make({ census: false, write: false, rows: O.none() })
 * console.log(Effect.isEffect(runEffectVitestLint(options))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runEffectVitestLint = Effect.fn("EffectVitestScan.run")(function* (options: EffectVitestLintOptions) {
  const root = yield* findRepoRoot().pipe(
    EffectVitestLintError.mapError("Unable to locate the repository root for effect-vitest.")
  );
  const graph = yield* readEffectVitestPrimitiveGraph(root);
  yield* verifyEffectVitestPin(root, graph);
  const started = performance.now();
  const ownerOf = yield* createWorkspaceOwnerResolver({
    root,
    fallbackOwner: "@beep/root",
    fallbackPrefixes: [{ prefix: "infra/", owner: "@beep/infra" }],
  });
  const sourcePaths = yield* discoverEffectVitestSourcePaths(root);
  yield* Console.log(
    `[effect-vitest:phase] discoveryMs=${(performance.now() - started).toFixed(1)} files=${sourcePaths.length}`
  );
  const census = A.empty<EffectVitestCensusRow>();
  const findings = A.empty<EffectVitestFinding>();
  const encoder = new TextEncoder();

  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths(sourcePaths);
  yield* Console.log(`[effect-vitest:phase] projectMs=${(performance.now() - started).toFixed(1)}`);
  for (const sourceFile of project.getSourceFiles()) {
    const absolute = sourceFile.getFilePath();
    const file = Str.replace(`${root}/`, "")(absolute);
    const owner = ownerOf(absolute);
    const kind = isEffectVitestTestFilePath(file) ? "test" : "support";
    const text = sourceFile.getFullText();
    census.push(
      EffectVitestCensusRow.make({
        file,
        package: owner,
        kind,
        bytes: encoder.encode(text).byteLength,
        lines: countEffectVitestSourceLines(text),
      })
    );
    const detected = detectEffectVitestFindings(sourceFile, file, owner);
    findings.push(...(kind === "test" ? detected : A.filter(detected, (finding) => finding.ruleId === "EV003")));
  }
  yield* Console.log(
    `[effect-vitest:phase] detectMs=${(performance.now() - started).toFixed(1)} findings=${findings.length}`
  );

  const censusOrder = Order.mapInput(Order.String, (row: EffectVitestCensusRow) => row.file);
  const graphBackedFindings = yield* applyEffectVitestPrimitiveGraph(findings, graph);
  const sortedFindings = A.sort(graphBackedFindings, findingOrder);
  const existing = yield* readEffectVitestInventory(root);
  if (O.isSome(existing) && !Equal.equals(existing.value.effectVitestVersion, graph.version)) {
    return yield* EffectVitestLintError.new(
      `Baseline pin ${existing.value.effectVitestVersion} does not match graph pin ${graph.version}; refresh it with effect-vitest --write after reviewing the pinned source diff.`
    );
  }
  const merged = preserveEffectVitestExceptions(sortedFindings, existing);
  yield* Console.log(`[effect-vitest:phase] mergeMs=${(performance.now() - started).toFixed(1)}`);
  const document = EffectVitestInventoryDocument.make({
    schemaVersion: "effect-vitest-inventory/v1",
    effectVitestVersion: graph.version,
    scope: EffectVitestSourceFileGlobs,
    findings: merged,
  });

  if (options.census) yield* writeEffectVitestCensus(root, A.sort(census, censusOrder));
  if (options.census)
    yield* Console.log(`[effect-vitest:phase] censusWriteMs=${(performance.now() - started).toFixed(1)}`);
  if (options.write) yield* writeEffectVitestInventory(root, document);
  if (options.write)
    yield* Console.log(`[effect-vitest:phase] inventoryWriteMs=${(performance.now() - started).toFixed(1)}`);
  if (O.isSome(options.rows)) yield* writeEffectVitestRows(root, options.rows.value, merged);
  if (O.isSome(options.rows))
    yield* Console.log(`[effect-vitest:phase] rowsWriteMs=${(performance.now() - started).toFixed(1)}`);

  const timing = EffectVitestScanTiming.make({
    scanMs: performance.now() - started,
    fileCount: census.length,
    findingCount: merged.length,
  });
  yield* Console.log(
    `[effect-vitest] files=${timing.fileCount} findings=${timing.findingCount} scanMs=${timing.scanMs.toFixed(1)}`
  );

  if (!options.write && !options.census && O.isNone(options.rows)) {
    const baseline = O.getOrElse(
      O.map(existing, (value) => value.findings),
      A.empty<EffectVitestFinding>
    );
    const difference = diffEffectVitestFindings(merged, baseline);
    if (difference.introduced.length > 0) {
      yield* Console.error(`[effect-vitest] ${difference.introduced.length} new finding(s)`);
      return yield* failWithReportedExit("effect-vitest: ratchet failed on new instances.");
    }
    yield* Console.log(
      `[effect-vitest] introduced=${difference.introduced.length} resolved=${difference.resolved.length}`
    );
  }
  return timing;
});
