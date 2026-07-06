/**
 * Knip regression-baseline ratchet helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { Console, Effect, FileSystem, Order, Path, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { parse } from "jsonc-parser";
import { QualityScriptCommandError } from "../Quality.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ParseError } from "jsonc-parser";

const $I = $RepoCliId.create("commands/Quality/internal/KnipRatchet");

const defaultBaselinePath = "standards/knip.regression-baseline.jsonc";
const knipCommand = "bun run knip --reporter json";
const regenerationCommand = "bun run beep quality knip --write-baseline";
const baselineHeader = `// Regenerate with: ${regenerationCommand}
// New packages are covered by knip.jsonc workspace discovery; keep new packages clean or regenerate this baseline in the same PR with reviewer-visible rationale.
`;
const newPackageHandling =
  "New packages are covered by knip.jsonc workspace discovery. Keep new packages free of Knip findings; if an intentional finding is unavoidable, regenerate this baseline in the same PR and document the rationale for review.";

/**
 * Normalized Knip finding category.
 *
 * @example
 * ```ts
 * import { KnipFindingKind } from "@beep/repo-cli/test/Quality"
 * console.log(KnipFindingKind.is.exports("exports"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const KnipFindingKind = LiteralKit([
  "binaries",
  "dependencies",
  "devDependencies",
  "enumMembers",
  "exports",
  "files",
  "namespaceMembers",
  "optionalPeerDependencies",
  "types",
  "unlisted",
  "unresolved",
]).pipe(
  $I.annoteSchema("KnipFindingKind", {
    description: "Stable Knip finding category retained in the regression baseline.",
  })
);

/**
 * Normalized Knip finding category.
 *
 * @example
 * ```ts
 * import type { KnipFindingKind } from "@beep/repo-cli/test/Quality"
 * const kind: KnipFindingKind = "exports"
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type KnipFindingKind = typeof KnipFindingKind.Type;

/**
 * Position-bearing raw Knip finding item.
 *
 * @category models
 * @since 0.0.0
 */
class KnipRawFindingItem extends S.Class<KnipRawFindingItem>($I`KnipRawFindingItem`)(
  {
    name: S.String,
    line: S.optionalKey(S.Finite),
    col: S.optionalKey(S.Finite),
    pos: S.optionalKey(S.Finite),
  },
  $I.annote("KnipRawFindingItem", {
    description: "Raw Knip reporter item; position fields are decoded but omitted from the stable baseline.",
  })
) {}

const KnipRawFindingItems = KnipRawFindingItem.pipe(S.Array);

/**
 * Raw Knip issue container.
 *
 * @category models
 * @since 0.0.0
 */
class KnipRawIssue extends S.Class<KnipRawIssue>($I`KnipRawIssue`)(
  {
    file: S.String,
    binaries: S.optionalKey(KnipRawFindingItems),
    dependencies: S.optionalKey(KnipRawFindingItems),
    devDependencies: S.optionalKey(KnipRawFindingItems),
    enumMembers: S.optionalKey(KnipRawFindingItems),
    exports: S.optionalKey(KnipRawFindingItems),
    files: S.optionalKey(KnipRawFindingItems),
    namespaceMembers: S.optionalKey(KnipRawFindingItems),
    optionalPeerDependencies: S.optionalKey(KnipRawFindingItems),
    types: S.optionalKey(KnipRawFindingItems),
    unlisted: S.optionalKey(KnipRawFindingItems),
    unresolved: S.optionalKey(KnipRawFindingItems),
  },
  $I.annote("KnipRawIssue", {
    description: "Raw Knip JSON reporter issue container.",
  })
) {}

/**
 * Raw Knip JSON reporter document.
 *
 * @category models
 * @since 0.0.0
 */
class KnipRawReport extends S.Class<KnipRawReport>($I`KnipRawReport`)(
  {
    issues: S.Array(KnipRawIssue),
  },
  $I.annote("KnipRawReport", {
    description: "Raw Knip JSON reporter document.",
  })
) {}

/**
 * Stable Knip finding identity retained in the committed baseline.
 *
 * @example
 * ```ts
 * import { KnipFinding } from "@beep/repo-cli/test/Quality"
 * const finding = KnipFinding.make({ kind: "exports", file: "src/index.ts", name: "unused" })
 * console.log(finding.kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KnipFinding extends S.Class<KnipFinding>($I`KnipFinding`)(
  {
    kind: KnipFindingKind,
    file: S.String,
    name: S.String,
  },
  $I.annote("KnipFinding", {
    description: "Stable Knip finding identity used for fail-on-growth comparison.",
  })
) {}

/**
 * Deterministic count summary for a Knip baseline or run.
 *
 * @category models
 * @since 0.0.0
 */
export class KnipFindingSummary extends S.Class<KnipFindingSummary>($I`KnipFindingSummary`)(
  {
    total_findings: S.Finite,
    binaries: S.Finite,
    dependencies: S.Finite,
    devDependencies: S.Finite,
    enumMembers: S.Finite,
    exports: S.Finite,
    files: S.Finite,
    namespaceMembers: S.Finite,
    optionalPeerDependencies: S.Finite,
    types: S.Finite,
    unlisted: S.Finite,
    unresolved: S.Finite,
  },
  $I.annote("KnipFindingSummary", {
    description: "Deterministic count summary for normalized Knip findings.",
  })
) {}

/**
 * Committed Knip fail-on-growth baseline.
 *
 * @category models
 * @since 0.0.0
 */
export class KnipRegressionBaseline extends S.Class<KnipRegressionBaseline>($I`KnipRegressionBaseline`)(
  {
    schema_version: S.Literal(1),
    command: S.String,
    regeneration_command: S.String,
    comparison: S.String,
    new_package_handling: S.String,
    normalization: S.Struct({
      ordering: S.String,
      omitted_fields: S.Array(S.String),
    }),
    check: KnipFindingSummary,
    findings: S.Array(KnipFinding),
  },
  $I.annote("KnipRegressionBaseline", {
    description: "Committed Knip regression baseline used by the quality ratchet.",
  })
) {}

/**
 * Knip comparison result.
 *
 * @category models
 * @since 0.0.0
 */
export class KnipComparison extends S.Class<KnipComparison>($I`KnipComparison`)(
  {
    current_count: S.Finite,
    baseline_count: S.Finite,
    introduced: S.Array(KnipFinding),
    resolved: S.Array(KnipFinding),
  },
  $I.annote("KnipComparison", {
    description: "Difference between normalized current Knip findings and the committed baseline.",
  })
) {}

const decodeKnipRawReportText = S.decodeUnknownEffect(S.fromJsonString(KnipRawReport));
const decodeKnipRegressionBaseline = S.decodeUnknownEffect(KnipRegressionBaseline);
const sameKnipFinding = S.toEquivalence(KnipFinding);

const findingOrder = Order.combine(
  Order.mapInput(Order.String, (finding: KnipFinding) => finding.kind),
  Order.combine(
    Order.mapInput(Order.String, (finding: KnipFinding) => finding.file),
    Order.mapInput(Order.String, (finding: KnipFinding) => finding.name)
  )
);

const emptyRawFindings = (): ReadonlyArray<KnipRawFindingItem> => A.empty<KnipRawFindingItem>();

const rawItemsForKind = (issue: KnipRawIssue, kind: KnipFindingKind): ReadonlyArray<KnipRawFindingItem> =>
  KnipFindingKind.$match(kind, {
    binaries: () => issue.binaries ?? emptyRawFindings(),
    dependencies: () => issue.dependencies ?? emptyRawFindings(),
    devDependencies: () => issue.devDependencies ?? emptyRawFindings(),
    enumMembers: () => issue.enumMembers ?? emptyRawFindings(),
    exports: () => issue.exports ?? emptyRawFindings(),
    files: () => issue.files ?? emptyRawFindings(),
    namespaceMembers: () => issue.namespaceMembers ?? emptyRawFindings(),
    optionalPeerDependencies: () => issue.optionalPeerDependencies ?? emptyRawFindings(),
    types: () => issue.types ?? emptyRawFindings(),
    unlisted: () => issue.unlisted ?? emptyRawFindings(),
    unresolved: () => issue.unresolved ?? emptyRawFindings(),
  });

const normalizeIssueKind = (issue: KnipRawIssue, kind: KnipFindingKind): ReadonlyArray<KnipFinding> =>
  pipe(
    rawItemsForKind(issue, kind),
    A.map((item) =>
      KnipFinding.make({
        kind,
        file: issue.file,
        name: item.name,
      })
    )
  );

const normalizeRawReport = (report: KnipRawReport): ReadonlyArray<KnipFinding> =>
  pipe(
    report.issues,
    A.flatMap((issue) =>
      pipe(
        KnipFindingKind.Options,
        A.flatMap((kind) => normalizeIssueKind(issue, kind))
      )
    ),
    A.dedupeWith(sameKnipFinding),
    A.sort(findingOrder)
  );

const countKind = (findings: ReadonlyArray<KnipFinding>, kind: KnipFindingKind): number =>
  pipe(
    findings,
    A.filter((finding) => finding.kind === kind),
    A.length
  );

const summarizeFindings = (findings: ReadonlyArray<KnipFinding>): KnipFindingSummary =>
  KnipFindingSummary.make({
    total_findings: A.length(findings),
    binaries: countKind(findings, "binaries"),
    dependencies: countKind(findings, "dependencies"),
    devDependencies: countKind(findings, "devDependencies"),
    enumMembers: countKind(findings, "enumMembers"),
    exports: countKind(findings, "exports"),
    files: countKind(findings, "files"),
    namespaceMembers: countKind(findings, "namespaceMembers"),
    optionalPeerDependencies: countKind(findings, "optionalPeerDependencies"),
    types: countKind(findings, "types"),
    unlisted: countKind(findings, "unlisted"),
    unresolved: countKind(findings, "unresolved"),
  });

const makeBaseline = (findings: ReadonlyArray<KnipFinding>): KnipRegressionBaseline =>
  KnipRegressionBaseline.make({
    schema_version: 1,
    command: knipCommand,
    regeneration_command: regenerationCommand,
    comparison: "fail-on-growth: current findings must be a subset of the committed baseline",
    new_package_handling: newPackageHandling,
    normalization: {
      ordering: "kind,file,name",
      omitted_fields: ["line", "col", "pos"],
    },
    check: summarizeFindings(findings),
    findings,
  });

const parseJsonc = (text: string, filePath: string): Effect.Effect<unknown, QualityScriptCommandError> => {
  const parseErrors: Array<ParseError> = [];
  const document = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (A.isReadonlyArrayNonEmpty(parseErrors)) {
    return QualityScriptCommandError.make({
      message: `${filePath} is not valid JSONC: ${A.join(
        A.map(parseErrors, (error) => `parse error ${error.error} at offset ${error.offset}`),
        "; "
      )}`,
      exitCode: 1,
    });
  }

  return Effect.succeed(document);
};

const decodeBaselineText = (text: string, filePath: string) =>
  parseJsonc(text, filePath).pipe(
    Effect.flatMap(decodeKnipRegressionBaseline),
    QualityScriptCommandError.mapError(`Failed to decode ${filePath}.`)
  );

const readBaseline = Effect.fn("KnipRatchet.readBaseline")(function* (
  repoRoot: string,
  baselinePath: string
): Effect.fn.Return<KnipRegressionBaseline, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(repoRoot, baselinePath);
  const text = yield* fs
    .readFileString(absolutePath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${baselinePath}.`));

  return yield* decodeBaselineText(text, baselinePath);
});

const writeBaseline = Effect.fn("KnipRatchet.writeBaseline")(function* (
  repoRoot: string,
  baselinePath: string,
  baseline: KnipRegressionBaseline
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(repoRoot, baselinePath);
  const json = yield* jsonStringifyPretty(baseline).pipe(
    QualityScriptCommandError.mapError(`Failed to encode ${baselinePath}.`)
  );

  yield* fs
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${path.dirname(absolutePath)}.`));
  yield* fs
    .writeFileString(absolutePath, `${baselineHeader}${json}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${baselinePath}.`));
});

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (acc, chunk) => `${acc}${chunk}`
    )
  );

type KnipProcessResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const runKnipReporterJson = Effect.fn("KnipRatchet.runKnipReporterJson")(function* (
  repoRoot: string
): Effect.fn.Return<KnipProcessResult, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[knip] ${knipCommand}`);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", ["run", "knip", "--reporter", "json"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        {
          concurrency: 3,
        }
      );
      return {
        stdout: Str.trim(stdout),
        stderr: Str.trim(stderr),
        exitCode,
      };
    })
  ).pipe(
    QualityScriptCommandError.mapError(`Failed to run ${knipCommand}.`, {
      command: knipCommand,
    })
  );
});

const decodeCurrentFindings = (result: KnipProcessResult) =>
  decodeKnipRawReportText(result.stdout).pipe(
    Effect.map(normalizeRawReport),
    QualityScriptCommandError.mapError(
      `Failed to decode Knip JSON output from ${knipCommand}${Str.isNonEmpty(result.stderr) ? `; stderr: ${result.stderr}` : ""}.`,
      {
        command: knipCommand,
        exitCode: result.exitCode,
      }
    )
  );

const includesFinding = (findings: ReadonlyArray<KnipFinding>, finding: KnipFinding): boolean =>
  A.some(findings, (candidate) => sameKnipFinding(candidate, finding));

const findingsMissingFrom = (
  source: ReadonlyArray<KnipFinding>,
  target: ReadonlyArray<KnipFinding>
): ReadonlyArray<KnipFinding> =>
  pipe(
    source,
    A.filter((finding) => !includesFinding(target, finding)),
    A.sort(findingOrder)
  );

const compareFindings = (current: ReadonlyArray<KnipFinding>, baseline: ReadonlyArray<KnipFinding>): KnipComparison =>
  KnipComparison.make({
    current_count: A.length(current),
    baseline_count: A.length(baseline),
    introduced: findingsMissingFrom(current, baseline),
    resolved: findingsMissingFrom(baseline, current),
  });

const renderFinding = (finding: KnipFinding): string => `${finding.kind}: ${finding.file}#${finding.name}`;

const renderFindingLines = (findings: ReadonlyArray<KnipFinding>, limit: number): ReadonlyArray<string> => {
  const shown = A.take(findings, limit);
  const omittedCount = A.length(findings) - A.length(shown);
  return [
    ...A.map(shown, (finding) => `  - ${renderFinding(finding)}`),
    ...pipe(
      omittedCount,
      O.liftPredicate((count) => count > 0),
      O.map((count) => A.of(`  - ... ${count} more`)),
      O.getOrElse(() => A.empty<string>())
    ),
  ];
};

const enforceComparison = Effect.fn("KnipRatchet.enforceComparison")(function* (
  comparison: KnipComparison,
  baselinePath: string
): Effect.fn.Return<void, QualityScriptCommandError> {
  if (A.isReadonlyArrayNonEmpty(comparison.introduced)) {
    yield* Console.error(
      A.join(
        [
          `[knip] regression: ${A.length(comparison.introduced)} finding(s) are not present in ${baselinePath}`,
          ...renderFindingLines(comparison.introduced, 25),
          `[knip] fix the finding(s), or regenerate with: ${regenerationCommand}`,
        ],
        "\n"
      )
    );
    return yield* QualityScriptCommandError.make({
      message: "Knip regression baseline grew.",
      command: knipCommand,
      exitCode: 1,
    });
  }

  yield* Console.log(
    `[knip] ok: current=${comparison.current_count} baseline=${comparison.baseline_count} introduced=0`
  );

  if (A.isReadonlyArrayNonEmpty(comparison.resolved)) {
    yield* Console.log(
      A.join(
        [
          `[knip] tighten-baseline: ${A.length(comparison.resolved)} baseline finding(s) are no longer present`,
          ...renderFindingLines(comparison.resolved, 25),
          `[knip] regenerate with: ${regenerationCommand}`,
        ],
        "\n"
      )
    );
  }
});

/**
 * Options accepted by {@link runKnipRatchet}.
 *
 * @example
 * ```ts
 * import type { RunKnipRatchetOptions } from "@beep/repo-cli/test/Quality"
 * const options: RunKnipRatchetOptions = { baselinePath: "standards/knip.regression-baseline.jsonc", writeBaseline: false }
 * console.log(options)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RunKnipRatchetOptions = {
  readonly baselinePath: string;
  readonly writeBaseline: boolean;
};

/**
 * Run Knip and enforce or refresh the committed regression baseline.
 *
 * @param options - Baseline path and write mode.
 * @returns Effect that fails only when current Knip findings grow beyond the baseline.
 * @example
 * ```ts
 * import { runKnipRatchet } from "@beep/repo-cli/test/Quality"
 * const program = runKnipRatchet({ baselinePath: "standards/knip.regression-baseline.jsonc", writeBaseline: false })
 * console.log(program)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runKnipRatchet = Effect.fn("KnipRatchet.runKnipRatchet")(function* ({
  baselinePath,
  writeBaseline: shouldWriteBaseline,
}: RunKnipRatchetOptions): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const current = yield* runKnipReporterJson(repoRoot).pipe(Effect.flatMap(decodeCurrentFindings));
  const normalizedCurrent = pipe(current, A.sort(findingOrder));

  if (shouldWriteBaseline) {
    yield* writeBaseline(repoRoot, baselinePath, makeBaseline(normalizedCurrent));
    yield* Console.log(`[knip] wrote ${baselinePath} with ${A.length(normalizedCurrent)} finding(s)`);
    return;
  }

  const baseline = yield* readBaseline(repoRoot, baselinePath);
  const normalizedBaseline = pipe(baseline.findings, A.dedupeWith(sameKnipFinding), A.sort(findingOrder));
  yield* enforceComparison(compareFindings(normalizedCurrent, normalizedBaseline), baselinePath);
});

/**
 * Repo-relative location of the committed Knip regression baseline consumed
 * when `--baseline` is not passed.
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultKnipBaselinePath = defaultBaselinePath;

/**
 * Normalize raw Knip JSON reporter text for focused tests.
 *
 * @param text - Raw stdout captured from `bun run knip --reporter json`.
 * @returns Effect yielding the normalized, stably-ordered finding set.
 * @category testing
 * @since 0.0.0
 */
export const normalizeKnipReportForTesting = (text: string) =>
  decodeKnipRawReportText(text).pipe(Effect.map(normalizeRawReport));

/**
 * Compare normalized Knip finding sets for focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const compareKnipFindingsForTesting = compareFindings;

/**
 * Build a deterministic Knip baseline for focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const makeKnipBaselineForTesting = makeBaseline;
