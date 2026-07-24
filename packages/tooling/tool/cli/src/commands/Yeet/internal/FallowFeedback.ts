/**
 * Fallow advisory envelope mapping for Yeet quality packets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Console, Context, Effect, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { csvValues } from "../../../internal/cli/Flags.ts";
import { commandTextForStep, RepoRunPlan } from "../../../internal/repo-run/index.ts";
import {
  FallowFeatureFamily,
  FallowReportEnvelope,
  FindingAttributionKind,
} from "../../Quality/internal/FallowEnvelope.schema.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { buildQualityIssueIndex, QualityIssue, QualityIssueIndex, QualityIssueRouting } from "./QualityIssueIndex.ts";
import type {
  FallowFailureEnvelope,
  FallowReportFinding,
  FallowReportOk,
} from "../../Quality/internal/FallowEnvelope.schema.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FallowFeedback");

const fallowEnvelopeFileNames = A.map(FallowFeatureFamily.Options, (feature) => `${feature}.json`);

// Local aliases keep this module's prior names while sourcing the single
// shared Fallow report-envelope codec, eliminating producer/consumer drift.
type FallowOkEnvelope = FallowReportOk;
type FallowFinding = FallowReportFinding;
const FallowEnvelope = FallowReportEnvelope;
type FallowEnvelope = FallowReportEnvelope;

class FallowYeetIssueFixture extends S.Class<FallowYeetIssueFixture>($I`FallowYeetIssueFixture`)(
  {
    id: S.String,
    sourceFeature: FallowFeatureFamily,
    sourceEnvelopeRef: S.String,
    sourceFindingId: S.String,
    tool: S.Literal("fallow"),
    parser: S.String,
    subCategory: S.String,
    blocking: S.Literal(false),
    attribution: FindingAttributionKind,
  },
  $I.annote("FallowYeetIssueFixture", {
    description: "Expected Yeet issue projection for one Fallow fixture finding.",
  })
) {}

class FallowFixtureDocument extends S.Class<FallowFixtureDocument>($I`FallowFixtureDocument`)(
  {
    schemaVersion: S.Literal("fallow-quality-enforcement/report-fixtures/v1"),
    fixtures: S.NonEmptyArray(FallowEnvelope),
    yeetIssueFixtures: S.NonEmptyArray(FallowYeetIssueFixture),
  },
  $I.annote("FallowFixtureDocument", {
    description: "Checked-in Fallow report envelope fixture document.",
  })
) {}

const decodeFallowEnvelopeJson = S.decodeUnknownEffect(S.fromJsonString(FallowEnvelope));
const decodeFallowFixtureDocumentJsonc = decodeJsoncTextAs(FallowFixtureDocument);
const decodeRepoRunPlanJson = S.decodeUnknownEffect(S.fromJsonString(RepoRunPlan));
const decodeQualityIssueIndexJson = S.decodeUnknownEffect(S.fromJsonString(QualityIssueIndex));
const encodeQualityIssueIndexJson = S.encodeUnknownEffect(S.fromJsonString(QualityIssueIndex));

const readFileText = Effect.fn("YeetFallowFeedback.readFileText")(function* (
  filePath: string
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read "${filePath}".`, { file: filePath })));
});

/**
 * Configurable allowed root the Fallow advisory feedback reader/writer is
 * constrained to.
 *
 * Every Fallow feedback path (the `--from` envelope directory, the `--emit`
 * output index, and the fixture document) is resolved within this root via
 * {@link resolvePathWithinRoot}, following symlinks and canonicalizing the
 * deepest existing ancestor so not-yet-created write targets are still guarded.
 * A candidate that escapes the root through `..`, an absolute path outside it,
 * or a symlink pointing outside it is rejected before any bytes are read or
 * written — preventing repo-controlled symlink file clobber (CSF-011).
 *
 * The reference defaults to {@link O.none}, which resolves against the repository
 * root (the production behavior). Provide an override (see
 * {@link layerFallowFeedbackAllowedRoot}) to constrain feedback to an explicit
 * output directory — for example a temp directory in tests, or a non-repo Fallow
 * output dir — while keeping the symlink/traversal protection intact.
 *
 * @example
 * ```ts
 * import { FallowFeedbackAllowedRoot } from "@beep/repo-cli/commands/Yeet/internal/FallowFeedback"
 * console.log(FallowFeedbackAllowedRoot.key)
 * ```
 * @category guards
 * @since 0.0.0
 */
export const FallowFeedbackAllowedRoot: Context.Reference<O.Option<string>> = Context.Reference<O.Option<string>>(
  $I`FallowFeedbackAllowedRoot`,
  {
    defaultValue: O.none<string>,
  }
);

/**
 * Build a layer that overrides the {@link FallowFeedbackAllowedRoot} allowed
 * root with an explicit directory.
 *
 * Pass the configured Fallow output directory (or, in tests, a temp directory)
 * that the advisory feedback reader/writer is permitted to resolve paths within.
 * The symlink/traversal protection of {@link resolvePathWithinRoot} is preserved
 * — any candidate that escapes the supplied root is still rejected.
 *
 * @param root - Absolute directory the advisory feedback reader/writer may resolve paths within.
 * @returns A layer that sets {@link FallowFeedbackAllowedRoot} to the supplied root.
 * @example
 * ```ts
 * import { layerFallowFeedbackAllowedRoot } from "@beep/repo-cli/commands/Yeet/internal/FallowFeedback"
 * const OutputRoot = layerFallowFeedbackAllowedRoot("/tmp/fallow-output")
 * console.log(OutputRoot) // example value
 * ```
 * @category guards
 * @since 0.0.0
 */
export const layerFallowFeedbackAllowedRoot = (root: string): Layer.Layer<never> =>
  Layer.succeed(FallowFeedbackAllowedRoot)(O.some(root));

const resolveAllowedRoot = Effect.fn("YeetFallowFeedback.resolveAllowedRoot")(function* (): Effect.fn.Return<
  string,
  YeetCommandError,
  Path.Path | FileSystem.FileSystem
> {
  const configuredRoot = yield* FallowFeedbackAllowedRoot;
  return yield* O.match(configuredRoot, {
    onNone: () => findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repository root."))),
    onSome: (root) => Effect.succeed(root),
  });
});

const resolveRepoPath = Effect.fn("YeetFallowFeedback.resolveRepoPath")(function* (
  value: string
): Effect.fn.Return<string, YeetCommandError, Path.Path | FileSystem.FileSystem> {
  const allowedRoot = yield* resolveAllowedRoot();
  // Resolve the candidate (relative or absolute) against the configured allowed
  // root, following symlinks and canonicalizing the deepest existing ancestor so
  // not-yet-created write targets are still guarded. Fails closed (PathSafetyError)
  // when the real path escapes the root via `..`, an absolute path outside the
  // root, or a symlink pointing outside it — preventing repo-controlled symlink
  // file clobber (CSF-011).
  return yield* resolvePathWithinRoot({ root: allowedRoot, candidate: value }).pipe(
    Effect.mapError(YeetCommandError.new(`Path "${value}" is not contained within the allowed Fallow feedback root.`))
  );
});

const writeQualityIssueIndex = Effect.fn("YeetFallowFeedback.writeQualityIssueIndex")(function* (
  emitPath: string,
  index: QualityIssueIndex
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteEmitPath = yield* resolveRepoPath(emitPath);
  const json = yield* encodeQualityIssueIndexJson(index).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode Fallow quality issue index."))
  );
  yield* fs
    .makeDirectory(path.dirname(absoluteEmitPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create output directory for "${absoluteEmitPath}".`)));
  yield* fs
    .writeFileString(absoluteEmitPath, `${json}\n`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write "${absoluteEmitPath}".`)));
});

const readQualityIssueIndex = Effect.fn("YeetFallowFeedback.readQualityIssueIndex")(function* (
  emitPath: string
): Effect.fn.Return<QualityIssueIndex, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const absoluteEmitPath = yield* resolveRepoPath(emitPath);
  const text = yield* readFileText(absoluteEmitPath);
  return yield* decodeQualityIssueIndexJson(text).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode emitted QualityIssueIndex "${absoluteEmitPath}".`))
  );
});

const fallbackPackageName = "@beep/root" as const;

const routeForFallow = (reason: string): ReadonlyArray<QualityIssueRouting> => [
  QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason }),
];

const sourceFileFromRef = (sourceRef: string): O.Option<string> =>
  pipe(Str.split(sourceRef, "#")[0], O.fromUndefinedOr, O.filter(Str.isNonEmpty));

const categoryForFallow = (feature: typeof FallowFeatureFamily.Type): QualityIssue["category"] =>
  feature === "security" ? "security-audit" : "repo-law";

const severityForFallow = (blocking: boolean): QualityIssue["severity"] => (blocking ? "error" : "warning");

const fallowFindingIssue = (envelope: FallowOkEnvelope, finding: FallowFinding, advisory: boolean): QualityIssue => {
  const blocking = advisory ? false : finding.blocking;
  return QualityIssue.make({
    id: `fallow:${envelope.subcommand}:${finding.id}`,
    category: categoryForFallow(finding.featureFamily),
    subCategory: finding.subCategory,
    severity: severityForFallow(blocking),
    blocking,
    confidence: "structured",
    message: `Fallow ${finding.featureFamily} ${finding.attribution} finding: ${finding.id}.`,
    evidence: [envelope.reportPath, finding.sourceRef],
    packageName: fallbackPackageName,
    ...O.getOrElse(
      pipe(
        sourceFileFromRef(finding.sourceRef),
        O.map((file) => ({ file }))
      ),
      () => ({})
    ),
    sourceAnchor: finding.id,
    tool: "fallow",
    parser: finding.parser,
    attribution: finding.attribution,
    command: envelope.command,
    exitCode: envelope.exitStatus,
    rawOutputRef: envelope.rawOutputRef,
    routing: routeForFallow("Fallow advisory finding"),
  });
};

const fallowFailureIssue = (envelope: FallowFailureEnvelope, advisory: boolean): QualityIssue => {
  const blocking = advisory ? false : envelope.status === "base-resolution-failed" || envelope.status === "tool-failed";
  return QualityIssue.make({
    id: `fallow:${envelope.subcommand}:${envelope.status}`,
    category:
      envelope.status === "invalid-json" || envelope.status === "invalid-report" ? "parser-error" : "command-failure",
    subCategory: `fallow:${envelope.subcommand}:${envelope.status}`,
    severity: severityForFallow(blocking),
    blocking,
    confidence: "partial",
    message: `Fallow ${envelope.subcommand} envelope status ${envelope.status}: ${envelope.stderrExcerpt}`,
    evidence: [envelope.reportPath],
    packageName: fallbackPackageName,
    tool: "fallow",
    parser: `fallow/${envelope.subcommand}/v1`,
    attribution: "not-applicable",
    sourceAnchor: envelope.status,
    command: envelope.command,
    exitCode: envelope.exitStatus,
    rawOutputRef: envelope.rawOutputRef,
    rawExcerpt: envelope.stderrExcerpt,
    routing: routeForFallow("Fallow advisory envelope failure"),
  });
};

const issuesFromEnvelope = (envelope: FallowEnvelope, advisory: boolean): ReadonlyArray<QualityIssue> =>
  envelope.status === "ok"
    ? A.map(envelope.report.findings, (finding) => fallowFindingIssue(envelope, finding, advisory))
    : [fallowFailureIssue(envelope, advisory)];

const issueIndexFromEnvelopes = (envelopes: ReadonlyArray<FallowEnvelope>, advisory: boolean): QualityIssueIndex =>
  buildQualityIssueIndex(
    pipe(
      envelopes,
      A.flatMap((envelope) => issuesFromEnvelope(envelope, advisory))
    )
  );

const assertAdvisoryEnvelopes = Effect.fn("YeetFallowFeedback.assertAdvisoryEnvelopes")(function* (
  envelopes: ReadonlyArray<FallowEnvelope>,
  advisory: boolean
): Effect.fn.Return<void, YeetCommandError> {
  // Reject self-contradictory payloads up front: a successful envelope's findings
  // must share its subcommand feature family, otherwise the issue id (derived from
  // the subcommand) and category/message (derived from the finding) would disagree.
  const inconsistentRefs = pipe(
    envelopes,
    A.filter(
      (envelope) =>
        envelope.status === "ok" &&
        !envelope.report.findings.every((finding) => finding.featureFamily === envelope.subcommand)
    ),
    A.map((envelope) => envelope.reportPath)
  );
  if (!A.isReadonlyArrayEmpty(inconsistentRefs)) {
    return yield* YeetCommandError.make({
      message: `Fallow advisory feedback received envelope(s) whose findings disagree with the subcommand feature family: ${A.join(inconsistentRefs, ", ")}`,
      exitCode: 1,
    });
  }
  if (!advisory) {
    return;
  }
  const nonAdvisoryRefs = pipe(
    envelopes,
    A.filter((envelope) => !envelope.advisory),
    A.map((envelope) => envelope.reportPath)
  );
  if (!A.isReadonlyArrayEmpty(nonAdvisoryRefs)) {
    return yield* YeetCommandError.make({
      message: `Fallow advisory feedback received non-advisory envelope(s): ${A.join(nonAdvisoryRefs, ", ")}`,
      exitCode: 1,
    });
  }
});

const readEnvelopeFile = Effect.fn("YeetFallowFeedback.readEnvelopeFile")(function* (
  filePath: string
): Effect.fn.Return<FallowEnvelope, YeetCommandError, FileSystem.FileSystem> {
  const text = yield* readFileText(filePath);
  return yield* decodeFallowEnvelopeJson(text).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode Fallow envelope "${filePath}".`, { file: filePath }))
  );
});

const envelopePaths = Effect.fn("YeetFallowFeedback.envelopePaths")(function* (
  fromPath: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteFromPath = yield* resolveRepoPath(fromPath);
  const entries = yield* fs.readDirectory(absoluteFromPath).pipe(
    // Treat only a missing directory as "no envelopes yet"; surface every other
    // failure (permission errors, invalid paths, ...) so misconfiguration is not
    // silently masked by a successful empty QualityIssueIndex.
    Effect.catch((error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(A.empty<string>())
        : Effect.fail(
            YeetCommandError.make({
              message: `Failed to read Fallow envelope directory "${absoluteFromPath}".`,
              file: absoluteFromPath,
              cause: error,
            })
          )
    )
  );
  return pipe(
    entries,
    A.filter((entry) => A.contains(fallowEnvelopeFileNames, entry)),
    A.map((entry) => path.join(absoluteFromPath, entry)),
    A.sort(Order.String)
  );
});

const spaceValues = (value: string): ReadonlyArray<string> =>
  pipe(Str.split(value, " "), A.map(Str.trim), A.filter(Str.isNonEmpty));

const readEnvelopesFromDirectory = Effect.fn("YeetFallowFeedback.readEnvelopesFromDirectory")(function* (
  fromPath: string
): Effect.fn.Return<ReadonlyArray<FallowEnvelope>, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const paths = yield* envelopePaths(fromPath);
  return yield* Effect.forEach(paths, readEnvelopeFile, { concurrency: 1 });
});

const feedbackEnvelopes = (
  envelopes: ReadonlyArray<FallowEnvelope>,
  advisory: boolean
): ReadonlyArray<FallowEnvelope> =>
  advisory
    ? pipe(
        envelopes,
        A.filter((envelope) => envelope.advisory)
      )
    : envelopes;

/**
 * Convert Fallow advisory envelopes from a directory into a Yeet issue index.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetFallowFeedback = Effect.fn("YeetFallowFeedback.runYeetFallowFeedback")(function* (options: {
  readonly advisory: boolean;
  readonly emit: string;
  readonly from: string;
}): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const envelopes = yield* readEnvelopesFromDirectory(options.from);
  const selectedEnvelopes = feedbackEnvelopes(envelopes, options.advisory);
  yield* assertAdvisoryEnvelopes(selectedEnvelopes, options.advisory);
  const index = issueIndexFromEnvelopes(selectedEnvelopes, options.advisory);
  yield* writeQualityIssueIndex(options.emit, index);
  yield* Console.log(`[yeet] Fallow advisory issue index written to ${options.emit}`);
});

const fixtureIssueMatches = (issue: QualityIssue, fixture: FallowYeetIssueFixture): boolean =>
  issue.tool === fixture.tool &&
  issue.parser === fixture.parser &&
  issue.subCategory === fixture.subCategory &&
  issue.blocking === fixture.blocking &&
  issue.attribution === fixture.attribution &&
  issue.sourceAnchor === fixture.sourceFindingId;

const fixtureDiagnostics = (
  index: QualityIssueIndex,
  fixtures: ReadonlyArray<FallowYeetIssueFixture>,
  assertions: ReadonlyArray<string>
): ReadonlyArray<string> => [
  ...(A.contains(assertions, "QualityIssueIndex") && index.schemaVersion !== "yeet-quality-issue-index/v1"
    ? ["emitted document is not a QualityIssueIndex"]
    : []),
  ...(A.contains(assertions, "tool=fallow") && A.some(index.issues, (issue) => issue.tool !== "fallow")
    ? ["expected every issue.tool to be fallow"]
    : []),
  ...(A.contains(assertions, "blocking=false") && A.some(index.issues, (issue) => issue.blocking)
    ? ["expected every Fallow advisory issue to be nonblocking"]
    : []),
  ...(A.contains(assertions, "attribution") && A.some(index.issues, (issue) => issue.attribution === undefined)
    ? ["expected every Fallow issue to carry attribution"]
    : []),
  ...A.flatMap(fixtures, (fixture) =>
    A.some(index.issues, (issue) => fixtureIssueMatches(issue, fixture))
      ? []
      : [`missing Yeet issue fixture projection for ${fixture.id}`]
  ),
];

/**
 * Decode checked-in Fallow fixtures and assert Yeet issue projection invariants.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetFallowFixtureCheck = Effect.fn("YeetFallowFeedback.runYeetFallowFixtureCheck")(function* (options: {
  readonly assertions: string;
  readonly emit: string;
  readonly fixturePath: string;
}): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const absoluteFixturePath = yield* resolveRepoPath(options.fixturePath);
  const fixtureText = yield* readFileText(absoluteFixturePath);
  const document = yield* decodeFallowFixtureDocumentJsonc(fixtureText).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode Fallow fixture document "${options.fixturePath}".`))
  );
  yield* assertAdvisoryEnvelopes(document.fixtures, true);
  const index = issueIndexFromEnvelopes(document.fixtures, true);
  yield* writeQualityIssueIndex(options.emit, index);
  const emittedIndex = yield* readQualityIssueIndex(options.emit);
  const diagnostics = fixtureDiagnostics(emittedIndex, document.yeetIssueFixtures, csvValues(options.assertions));
  if (!A.isReadonlyArrayEmpty(diagnostics)) {
    return yield* YeetCommandError.make({
      message: `Fallow fixture check failed:\n${A.join(
        A.map(diagnostics, (diagnostic) => `- ${diagnostic}`),
        "\n"
      )}`,
      exitCode: 1,
    });
  }
  yield* Console.log(`[yeet] Fallow fixture check ok: ${options.fixturePath}`);
});

const readStdinText = Effect.fn("YeetFallowFeedback.readStdinText")(function* (
  fromStdin: boolean
): Effect.fn.Return<string, YeetCommandError> {
  if (!fromStdin) {
    return yield* YeetCommandError.make({
      message: "yeet plan-contract-check requires --from-stdin.",
      exitCode: 1,
    });
  }
  if (process.stdin.isTTY) {
    return yield* YeetCommandError.make({
      message: "yeet plan-contract-check --from-stdin received no stdin.",
      exitCode: 1,
    });
  }
  return yield* Effect.tryPromise(() => Bun.stdin.text()).pipe(
    Effect.mapError((cause) =>
      YeetCommandError.make({
        message: `Failed to read yeet plan stdin: ${cause instanceof Error ? cause.message : String(cause)}`,
        exitCode: 1,
      })
    )
  );
});

const decodePlanText = Effect.fn("YeetFallowFeedback.decodePlanText")(function* (
  text: string
): Effect.fn.Return<RepoRunPlan, YeetCommandError> {
  const jsonText = Str.trim(text);
  return yield* decodeRepoRunPlanJson(jsonText).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode yeet run plan."))
  );
});

const fallowAdvisoryPrecedenceDiagnostics = (
  plan: RepoRunPlan,
  stepIndex: number,
  step: RepoRunPlan["steps"][number]
): ReadonlyArray<string> => {
  if (step.id !== "advisory:01-fallow-feedback") {
    return [];
  }
  const laterPhaseBeforeAdvisory = pipe(
    plan.steps,
    A.take(stepIndex),
    A.filter((candidate) => candidate.phase === "full" || candidate.phase === "publish"),
    A.map((candidate) => candidate.id)
  );
  return [
    ...(step.phase === "feedback" ? [] : [`expected step phase feedback, got ${step.phase}`]),
    ...(A.isReadonlyArrayEmpty(laterPhaseBeforeAdvisory)
      ? []
      : [
          `expected Fallow advisory feedback before full/publish step(s), got before it: ${A.join(laterPhaseBeforeAdvisory, ", ")}`,
        ]),
  ];
};

/**
 * Assert a named Yeet plan step exists with exact command shape.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetPlanContractCheck = Effect.fn("YeetFallowFeedback.runYeetPlanContractCheck")(function* (options: {
  readonly expectArgs: string;
  readonly expectCommand: string;
  readonly expectStepId: string;
  readonly expectStepLabel: string;
  readonly fromStdin: boolean;
}): Effect.fn.Return<void, YeetCommandError> {
  const text = yield* readStdinText(options.fromStdin);
  const plan = yield* decodePlanText(text);
  const step = A.findFirst(plan.steps, (candidate) => candidate.id === options.expectStepId);
  if (O.isNone(step)) {
    return yield* YeetCommandError.make({
      message: `missing yeet plan step ${options.expectStepId}`,
      exitCode: 1,
    });
  }
  const stepIndex = A.findFirstIndex(plan.steps, (candidate) => candidate.id === options.expectStepId);
  const expectedArgs = spaceValues(options.expectArgs);
  const diagnostics = [
    ...(step.value.label === options.expectStepLabel
      ? []
      : [`expected step label ${options.expectStepLabel}, got ${step.value.label}`]),
    ...(step.value.command === options.expectCommand
      ? []
      : [`expected step command ${options.expectCommand}, got ${step.value.command}`]),
    ...(A.join(step.value.args, " ") === A.join(expectedArgs, " ")
      ? []
      : [`expected step args ${A.join(expectedArgs, " ")}, got ${A.join(step.value.args, " ")}`]),
    ...pipe(
      stepIndex,
      O.match({
        onNone: () => [],
        onSome: (index) => fallowAdvisoryPrecedenceDiagnostics(plan, index, step.value),
      })
    ),
  ];
  if (!A.isReadonlyArrayEmpty(diagnostics)) {
    return yield* YeetCommandError.make({
      message: `yeet plan-contract-check failed for ${options.expectStepId}:\n${A.join(
        A.map(diagnostics, (diagnostic) => `- ${diagnostic}`),
        "\n"
      )}`,
      command: commandTextForStep(step.value),
      exitCode: 1,
    });
  }
  yield* Console.log(`[yeet] plan contract ok: ${options.expectStepId}`);
});
