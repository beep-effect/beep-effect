/**
 * Read-only worker evaluation for JSDoc quality remediation packets.
 *
 * The eval lane consumes deterministic `docgen quality` remediation packets and
 * asks a Codex SDK worker to produce advisory scores plus draft JSDoc. It never
 * edits source files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Duration, Effect, FileSystem, Match, Order, Path, pipe, Result } from "effect";
import { dual, flow } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  encodeCommandJson,
  renderPrettyCommandJson,
} from "../../../internal/cli/Json.ts";
import { errorMessage as cliErrorMessage, durationMsSince, timestampIso } from "../../../internal/cli/Timing.ts";
import { DocgenQualityFindingCode, DocgenQualityReport } from "./Quality.ts";
import type { DocgenQualityFindingCode as DocgenQualityFindingCodeValue } from "./Quality.ts";

const $I = $RepoCliId.create("commands/Docgen/internal/QualityWorkerEval");

const QUALITY_WORKER_EVAL_SCHEMA_VERSION = 1 as const;
const DEFAULT_WORKER_EVAL_PACKET_LIMIT = 5;
const DEFAULT_WORKER_EVAL_TIMEOUT = Duration.seconds(180);
const DEFAULT_SOURCE_PACKET_LIMIT = 25;

const decodeQualityReportJson = S.decodeUnknownEffect(S.fromJsonString(DocgenQualityReport));

const DocgenQualityWorkerEvalLocalScore = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`DocgenQualityWorkerEvalLocalScoreMinimumCheck`,
        title: "Docgen Quality Worker Eval Local Score Minimum",
        description: "Worker eval local scores must be at least one.",
        message: "Expected a worker eval local score greater than or equal to one",
      }),
      S.isLessThanOrEqualTo(10, {
        identifier: $I`DocgenQualityWorkerEvalLocalScoreMaximumCheck`,
        title: "Docgen Quality Worker Eval Local Score Maximum",
        description: "Worker eval local scores must not exceed ten.",
        message: "Expected a worker eval local score less than or equal to ten",
      }),
    ],
    {
      identifier: $I`DocgenQualityWorkerEvalLocalScoreChecks`,
      title: "Docgen Quality Worker Eval Local Score",
      description: "Inclusive one-to-ten score bounds for advisory worker eval output.",
    }
  )
).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalLocalScore", {
    description: "Inclusive one-to-ten advisory score emitted by a worker eval.",
  })
);

class CodexSdkPackageMetadata extends S.Class<CodexSdkPackageMetadata>($I`CodexSdkPackageMetadata`)(
  {
    version: S.String,
  },
  $I.annote("CodexSdkPackageMetadata", {
    description: "Package metadata used to stamp worker eval reports with the Codex SDK version.",
  })
) {}

const decodeCodexSdkPackageMetadataJson = S.decodeUnknownEffect(S.fromJsonString(CodexSdkPackageMetadata));

/**
 * Worker provider supported by `docgen quality-worker-eval`.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalProvider } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalProvider.is.codex("codex"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalProvider = LiteralKit(["codex", "ollama", "lmstudio"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalProvider", {
    description: "Worker provider supported by docgen quality-worker-eval.",
  })
);

/**
 * Worker provider supported by `docgen quality-worker-eval`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalProvider } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const provider: DocgenQualityWorkerEvalProvider = "codex"
 * console.log(provider) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalProvider = typeof DocgenQualityWorkerEvalProvider.Type;

/**
 * Codex reasoning effort supported by `docgen quality-worker-eval`.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalReasoningEffort } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalReasoningEffort.is.low("low"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalReasoningEffort = LiteralKit(["minimal", "low", "medium", "high", "xhigh"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalReasoningEffort", {
    description: "Codex reasoning effort supported by docgen quality-worker-eval.",
  })
);

/**
 * Codex reasoning effort supported by `docgen quality-worker-eval`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalReasoningEffort } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const effort: DocgenQualityWorkerEvalReasoningEffort = "low"
 * console.log(effort) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalReasoningEffort = typeof DocgenQualityWorkerEvalReasoningEffort.Type;

/**
 * Source mode used to build a worker eval queue.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalScope } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalScope.is.input("input"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalScope = LiteralKit(["input", "package", "all"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalScope", {
    description: "Source mode used to build a worker eval queue.",
  })
);

/**
 * Source mode used to build a worker eval queue.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalScope } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const scope: DocgenQualityWorkerEvalScope = "package"
 * console.log(scope) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalScope = typeof DocgenQualityWorkerEvalScope.Type;

/**
 * Read-only packet execution status for worker eval.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalPacketStatus } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalPacketStatus.is.completed("completed"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalPacketStatus = LiteralKit(["completed", "failed", "timed-out"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalPacketStatus", {
    description: "Read-only packet execution status for worker eval.",
  })
);

/**
 * Read-only packet execution status for worker eval.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalPacketStatus } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const status: DocgenQualityWorkerEvalPacketStatus = "failed"
 * console.log(status) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalPacketStatus = typeof DocgenQualityWorkerEvalPacketStatus.Type;

/**
 * Advisory disposition assigned to a worker draft.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalReviewDisposition } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalReviewDisposition.is.candidate("candidate"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalReviewDisposition = LiteralKit(["candidate", "needs-human-review", "reject"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalReviewDisposition", {
    description: "Advisory disposition assigned to a worker draft.",
  })
);

/**
 * Advisory disposition assigned to a worker draft.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalReviewDisposition } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const disposition: DocgenQualityWorkerEvalReviewDisposition = "needs-human-review"
 * console.log(disposition) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalReviewDisposition = typeof DocgenQualityWorkerEvalReviewDisposition.Type;

/**
 * Closed repo-policy issue code emitted by a worker eval.
 *
 * @example
 * ```ts
 * import { DocgenQualityWorkerEvalPolicyViolationCode } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(DocgenQualityWorkerEvalPolicyViolationCode.is["trivial-example"]("trivial-example"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityWorkerEvalPolicyViolationCode = LiteralKit([
  "missing-required-tag",
  "missing-example",
  "trivial-example",
  "missing-observable-result",
  "non-compiling-example",
  "unsafe-example",
  "wrong-import-alias",
  "tsdoc-grammar",
  "noisy-conditional-tag",
  "runtime-behavior-change",
  "other",
]).pipe(
  $I.annoteSchema("DocgenQualityWorkerEvalPolicyViolationCode", {
    description: "Closed repo-policy issue code emitted by a worker eval.",
  })
);

/**
 * Closed repo-policy issue code emitted by a worker eval.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalPolicyViolationCode } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const code: DocgenQualityWorkerEvalPolicyViolationCode = "wrong-import-alias"
 * console.log(code) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalPolicyViolationCode = typeof DocgenQualityWorkerEvalPolicyViolationCode.Type;

/**
 * Structured response expected from the Codex worker.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalWorkerOutput } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const output: Pick<DocgenQualityWorkerEvalWorkerOutput, "localScore"> = { localScore: 7 }
 * console.log(output.localScore)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityWorkerEvalWorkerOutput extends S.Class<DocgenQualityWorkerEvalWorkerOutput>(
  $I`DocgenQualityWorkerEvalWorkerOutput`
)(
  {
    localScore: DocgenQualityWorkerEvalLocalScore,
    rationale: S.String,
    draftJsDoc: S.String,
    policyViolationCodes: S.Array(DocgenQualityWorkerEvalPolicyViolationCode),
    reviewDisposition: DocgenQualityWorkerEvalReviewDisposition,
  },
  $I.annote("DocgenQualityWorkerEvalWorkerOutput", {
    description: "Structured response expected from the Codex worker.",
  })
) {}

const decodeWorkerOutputJson = S.decodeUnknownEffect(S.fromJsonString(DocgenQualityWorkerEvalWorkerOutput));

class DocgenQualityWorkerEvalRuntime extends S.Class<DocgenQualityWorkerEvalRuntime>(
  $I`DocgenQualityWorkerEvalRuntime`
)(
  {
    totalDurationMs: S.Finite,
    packetTimeoutMs: S.Finite,
  },
  $I.annote("DocgenQualityWorkerEvalRuntime", {
    description: "Runtime measurements for one worker eval run.",
  })
) {}

class DocgenQualityWorkerEvalPacketResult extends S.Class<DocgenQualityWorkerEvalPacketResult>(
  $I`DocgenQualityWorkerEvalPacketResult`
)(
  {
    packetId: S.String,
    subjectId: S.String,
    sourceAnchor: S.String,
    packageName: S.String,
    packagePath: S.String,
    findingCodes: S.Array(DocgenQualityFindingCode),
    status: DocgenQualityWorkerEvalPacketStatus,
    localScore: S.NullOr(DocgenQualityWorkerEvalLocalScore),
    rationale: S.String,
    draftJsDoc: S.String,
    expectedVerificationCommand: S.String,
    policyViolationCodes: S.Array(DocgenQualityWorkerEvalPolicyViolationCode),
    reviewDisposition: DocgenQualityWorkerEvalReviewDisposition,
    durationMs: S.Finite,
    error: S.NullOr(S.String),
  },
  $I.annote("DocgenQualityWorkerEvalPacketResult", {
    description: "Worker result for one deterministic remediation packet.",
  })
) {}

class DocgenQualityWorkerEvalSummary extends S.Class<DocgenQualityWorkerEvalSummary>(
  $I`DocgenQualityWorkerEvalSummary`
)(
  {
    packages: S.Finite,
    sourcePackets: S.Finite,
    selectedPackets: S.Finite,
    completed: S.Finite,
    failed: S.Finite,
    timedOut: S.Finite,
    candidates: S.Finite,
    needsHumanReview: S.Finite,
    rejected: S.Finite,
  },
  $I.annote("DocgenQualityWorkerEvalSummary", {
    description: "Aggregate summary for a worker JSDoc quality eval.",
  })
) {}

/**
 * JSON report emitted by `docgen quality-worker-eval`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalReport } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const report: Pick<DocgenQualityWorkerEvalReport, "schemaVersion"> = { schemaVersion: 1 }
 * console.log(report.schemaVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityWorkerEvalReport extends S.Class<DocgenQualityWorkerEvalReport>(
  $I`DocgenQualityWorkerEvalReport`
)(
  {
    schemaVersion: S.Literal(QUALITY_WORKER_EVAL_SCHEMA_VERSION),
    generatedAt: S.String,
    sourceQualityReport: S.String,
    provider: DocgenQualityWorkerEvalProvider,
    model: S.String,
    reasoningEffort: S.NullOr(DocgenQualityWorkerEvalReasoningEffort),
    codexSdkVersion: S.String,
    scope: DocgenQualityWorkerEvalScope,
    summary: DocgenQualityWorkerEvalSummary,
    packets: S.Array(DocgenQualityWorkerEvalPacketResult),
    policyViolations: S.Array(DocgenQualityWorkerEvalPolicyViolationCode),
    runtime: DocgenQualityWorkerEvalRuntime,
    recommendation: S.String,
  },
  $I.annote("DocgenQualityWorkerEvalReport", {
    description: "JSON report emitted by docgen quality-worker-eval.",
  })
) {}

/**
 * Completed worker turn returned by the Codex runner.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalRunnerResult } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const result: DocgenQualityWorkerEvalRunnerResult = { finalResponse: "{}" }
 * console.log(result.finalResponse)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityWorkerEvalRunnerResult extends S.Class<DocgenQualityWorkerEvalRunnerResult>(
  $I`DocgenQualityWorkerEvalRunnerResult`
)(
  {
    finalResponse: S.String,
  },
  $I.annote("DocgenQualityWorkerEvalRunnerResult", {
    description: "Completed worker turn returned by the Codex runner.",
  })
) {}

/**
 * Inputs passed to the Codex runner for one remediation packet.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalRunnerInput } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const input: Pick<DocgenQualityWorkerEvalRunnerInput, "model"> = { model: "qwen3-coder" }
 * console.log(input.model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityWorkerEvalRunnerInput extends S.Class<DocgenQualityWorkerEvalRunnerInput>(
  $I`DocgenQualityWorkerEvalRunnerInput`
)(
  {
    baseUrl: S.optional(S.String),
    model: S.String,
    provider: DocgenQualityWorkerEvalProvider,
    reasoningEffort: S.optional(DocgenQualityWorkerEvalReasoningEffort),
    prompt: S.String,
    workingDirectory: S.String,
  },
  $I.annote("DocgenQualityWorkerEvalRunnerInput", {
    description: "Inputs passed to the Codex runner for one remediation packet.",
  })
) {}

/**
 * Runner used to execute one Codex eval turn.
 *
 * @example
 * ```ts
 * import type { DocgenQualityWorkerEvalRunner } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 * import { Effect } from "effect"
 *
 * const runner: DocgenQualityWorkerEvalRunner = (input) =>
 *   Effect.succeed({ finalResponse: JSON.stringify({ model: input.model }) })
 * const result = Effect.runSync(
 *   runner({
 *     model: "gpt-5.4-mini",
 *     provider: "codex",
 *     prompt: "Score this JSDoc packet.",
 *     workingDirectory: "/tmp/beep-jsdoc-eval"
 *   })
 * )
 * console.log(result.finalResponse)
 * ```
 * @category services
 * @since 0.0.0
 */
export type DocgenQualityWorkerEvalRunner = (
  input: DocgenQualityWorkerEvalRunnerInput
) => Effect.Effect<DocgenQualityWorkerEvalRunnerResult, DomainError>;

type QualityPackageReport = DocgenQualityReport["packages"][number];
type QualityReview = QualityPackageReport["reviews"][number];
type QualitySubject = QualityPackageReport["subjects"][number];
type QualityRemediationPacket = DocgenQualityReport["remediationPackets"][number];

type PacketCandidate = {
  readonly findingCodes: ReadonlyArray<DocgenQualityFindingCodeValue>;
  readonly impact: number;
  readonly isFail: boolean;
  readonly packageName: string;
  readonly packagePath: string;
  readonly packet: QualityRemediationPacket;
  readonly review: O.Option<QualityReview>;
  readonly sourceAnchor: string;
  readonly subject: O.Option<QualitySubject>;
};

/**
 * Options for one worker eval run.
 *
 * @example
 * ```ts
 * import type { AnalyzeDocgenQualityWorkerEvalOptions } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const options: Pick<AnalyzeDocgenQualityWorkerEvalOptions, "model"> = { model: "qwen3-coder" }
 * console.log(options.model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AnalyzeDocgenQualityWorkerEvalOptions extends S.Class<AnalyzeDocgenQualityWorkerEvalOptions>(
  $I`AnalyzeDocgenQualityWorkerEvalOptions`
)(
  {
    baseUrl: S.optional(S.String),
    codexSdkVersion: S.optional(S.String),
    model: S.String,
    packetLimit: S.optional(S.Finite),
    provider: DocgenQualityWorkerEvalProvider,
    reasoningEffort: S.optional(DocgenQualityWorkerEvalReasoningEffort),
    report: DocgenQualityReport,
    runner: S.optional(S.Any),
    scope: DocgenQualityWorkerEvalScope,
    sourceQualityReport: S.String,
    timeout: S.optional(S.Any),
  },
  $I.annote("AnalyzeDocgenQualityWorkerEvalOptions", {
    description: "Options for one worker eval run.",
  })
) {}

const errorMessage = (error: unknown): string => cliErrorMessage(error, "Unknown worker eval failure.");

const fileUrlPath = (value: string): string => decodeURIComponent(new URL(value).pathname);

const providerHint = (provider: DocgenQualityWorkerEvalProvider): string =>
  Match.value(provider).pipe(
    Match.when(
      "ollama",
      () => "Ensure Ollama is installed, the service is running, and the requested model has been pulled."
    ),
    Match.when(
      "lmstudio",
      () => "Ensure LM Studio is running with an OpenAI-compatible local server and the requested model is loaded."
    ),
    Match.orElse(() => "Ensure Codex authentication is configured for the hosted model.")
  );

const renderJson = Effect.fn("DocgenQualityWorkerEval.renderJson")(function* (value: unknown) {
  const encoded = yield* encodeCommandJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode docgen worker eval JSON."))
  );
  return renderPrettyCommandJson(encoded, { maxLength: DEFAULT_JSON_PRETTY_MAX_LENGTH });
});

const qualityWorkerEvalWorkerOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    localScore: { type: "number", minimum: 1, maximum: 10 },
    rationale: { type: "string" },
    draftJsDoc: { type: "string" },
    policyViolationCodes: {
      type: "array",
      items: {
        type: "string",
        enum: DocgenQualityWorkerEvalPolicyViolationCode.literals,
      },
    },
    reviewDisposition: {
      type: "string",
      enum: DocgenQualityWorkerEvalReviewDisposition.literals,
    },
  },
  required: ["localScore", "rationale", "draftJsDoc", "policyViolationCodes", "reviewDisposition"],
} as const;

const compactPolicyExcerpt = A.join(
  [
    "Repo JSDoc policy excerpt:",
    "- Score the whole JSDoc block, not tag presence alone.",
    "- Every owning exported symbol needs @example, @category, and @since.",
    "- Re-export declarations are graph edges; document the owning declaration.",
    "- A useful @example is fenced TypeScript with an observable result, assertion, decoded value, Effect execution, visible output, or type-level evidence.",
    "- `const result = ...; void result` is a compile trick, not useful documentation.",
    "- Conditional tags should appear only when they add information not visible in the TypeScript signature.",
    "- Examples must avoid any, type assertions, declare statements, deprecated imports, and empty Effect.gen bodies.",
    "- Use canonical aliases in examples: effect/Schema as S, effect/Array as A, effect/Option as O, effect/Predicate as P, effect/Record as R.",
  ],
  "\n"
);

const workerPrompt = (candidate: PacketCandidate): string =>
  A.join(
    [
      "You are evaluating a single exported-symbol JSDoc remediation packet.",
      "Use only the supplied packet and policy excerpt. Do not inspect files, run commands, or change source.",
      "Return structured JSON that matches the provided schema.",
      "",
      compactPolicyExcerpt,
      "",
      `Package: ${candidate.packageName} (${candidate.packagePath})`,
      `Source anchor: ${candidate.sourceAnchor}`,
      `Packet id: ${candidate.packet.id}`,
      `Subject id: ${candidate.packet.subjectId}`,
      "",
      "Deterministic finding codes:",
      ...A.map(candidate.findingCodes, (code) => `- ${code}`),
      "",
      "Remediation packet prompt:",
      candidate.packet.prompt,
      "",
      "Expected verification command:",
      candidate.packet.verificationCommand,
      "",
      "Draft a replacement JSDoc block, score it from 1-10, explain policy concerns, and classify the draft as candidate, needs-human-review, or reject.",
    ],
    "\n"
  );

const packetCandidateOrder: Order.Order<PacketCandidate> = Order.combine(
  Order.mapInput(Order.Number, (candidate) => (candidate.isFail ? 0 : 1)),
  Order.combine(
    Order.flip(Order.mapInput(Order.Number, (candidate) => candidate.impact)),
    Order.mapInput(Order.String, (candidate) => candidate.packet.subjectId)
  )
);

const findSubject = (pkg: QualityPackageReport, subjectId: string): O.Option<QualitySubject> =>
  A.findFirst(pkg.subjects, (subject) => subject.stableIdentity === subjectId);

const findReview = (pkg: QualityPackageReport, subjectId: string): O.Option<QualityReview> =>
  A.findFirst(pkg.reviews, (review) => review.subjectId === subjectId);

const packageForPacket = (
  report: DocgenQualityReport,
  packet: QualityRemediationPacket
): O.Option<QualityPackageReport> =>
  A.findFirst(report.packages, (pkg) => O.isSome(findSubject(pkg, packet.subjectId)));

const reviewFindingCodes: (review: O.Option<QualityReview>) => ReadonlyArray<DocgenQualityFindingCodeValue> = flow(
  O.map((value) => A.map(value.findings, (finding) => finding.code)),
  O.getOrElse(A.empty<DocgenQualityFindingCodeValue>)
);

const reviewImpact: (review: O.Option<QualityReview>) => number = flow(
  O.map((value) => A.reduce(value.findings, 0, (total, finding) => total + finding.scoreImpact)),
  O.getOrElse(() => 0)
);

const packetCandidate = (report: DocgenQualityReport, packet: QualityRemediationPacket): PacketCandidate => {
  const pkg = packageForPacket(report, packet);
  const subject = pipe(
    pkg,
    O.flatMap((value) => findSubject(value, packet.subjectId))
  );
  const review = pipe(
    pkg,
    O.flatMap((value) => findReview(value, packet.subjectId))
  );

  return {
    findingCodes: reviewFindingCodes(review),
    impact: reviewImpact(review),
    isFail: pipe(
      review,
      O.map((value) => value.tier === "fail"),
      O.getOrElse(() => false)
    ),
    packageName: pipe(
      pkg,
      O.map((value) => value.packageName),
      O.getOrElse(() => "unknown")
    ),
    packagePath: pipe(
      pkg,
      O.map((value) => value.packagePath),
      O.getOrElse(() => "unknown")
    ),
    packet,
    review,
    sourceAnchor: pipe(
      subject,
      O.map((value) => value.sourceAnchor),
      O.getOrElse(() => packet.subjectId)
    ),
    subject,
  };
};

/**
 * Select remediation packets for a capped worker eval run.
 *
 * @param candidates - Packet candidates grouped by package path for deterministic selection.
 * @param packetLimit - Maximum number of candidates to select; zero suppresses worker turns.
 * @returns Selected packet candidates in deterministic package-stratified order.
 * @example
 * ```ts
 * import { selectQualityWorkerEvalPackets } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const selected = selectQualityWorkerEvalPackets([], 5)
 * console.log(selected.length)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const selectQualityWorkerEvalPackets: {
  (candidates: ReadonlyArray<PacketCandidate>, packetLimit: number): ReadonlyArray<PacketCandidate>;
  (packetLimit: number): (candidates: ReadonlyArray<PacketCandidate>) => ReadonlyArray<PacketCandidate>;
} = dual(2, (candidates: ReadonlyArray<PacketCandidate>, packetLimit: number): ReadonlyArray<PacketCandidate> => {
  if (packetLimit <= 0) {
    return A.empty();
  }

  const grouped = pipe(
    candidates,
    A.groupBy((candidate) => candidate.packagePath),
    R.map(A.sort(packetCandidateOrder))
  );
  const packagePaths = pipe(R.keys(grouped), A.sort(Order.String));
  const maxGroupSize = pipe(
    R.values(grouped),
    A.reduce(0, (max, values) => Math.max(max, values.length))
  );
  const packetAtIndex = (index: number) =>
    flow(
      (packagePath: string) => O.fromNullishOr(grouped[packagePath]?.[index]),
      O.match({
        onNone: A.empty<PacketCandidate>,
        onSome: A.of,
      })
    );

  return pipe(
    A.range(0, Math.max(0, maxGroupSize - 1)),
    A.flatMap((index) => A.flatMap(packagePaths, packetAtIndex(index))),
    A.take(packetLimit)
  );
});

const importCodexSdk = Effect.fn("DocgenQualityWorkerEval.importCodexSdk")(function* () {
  return yield* Effect.tryPromise({
    try: () => import("@openai/codex-sdk"),
    catch: (cause) =>
      DomainError.make({
        message: `Failed to import @openai/codex-sdk: ${errorMessage(cause)}`,
        cause,
      }),
  });
});

const resolveCodexSdkVersion = Effect.fn("DocgenQualityWorkerEval.resolveCodexSdkVersion")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedMain = yield* Effect.try({
    try: () => import.meta.resolve("@openai/codex-sdk"),
    catch: (cause) =>
      DomainError.make({
        message: `Failed to resolve @openai/codex-sdk: ${errorMessage(cause)}`,
        cause,
      }),
  });
  const packageJsonPath = path.join(path.dirname(path.dirname(fileUrlPath(resolvedMain))), "package.json");
  const content = yield* fs
    .readFileString(packageJsonPath)
    .pipe(
      Effect.mapError(
        DomainError.newCause(`Failed to read @openai/codex-sdk package metadata from ${packageJsonPath}.`)
      )
    );
  const metadata = yield* decodeCodexSdkPackageMetadataJson(content).pipe(
    Effect.mapError(DomainError.newCause("Failed to decode @openai/codex-sdk metadata."))
  );

  return metadata.version;
});

const resolveCodexSdkVersionOrUnknown: Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =
  resolveCodexSdkVersion().pipe(Effect.option, Effect.map(O.getOrElse(() => "unknown")));

type CodexSdkModule = typeof import("@openai/codex-sdk");

const ossProviderBaseUrl = (value: string): string => {
  const trimmed = Str.trim(value);
  const normalized = Str.replace(/\/+$/, "")(trimmed);
  return Str.endsWith("/v1")(normalized) ? normalized : `${normalized}/v1`;
};

const makeCodexRunner = (sdkModule: CodexSdkModule): DocgenQualityWorkerEvalRunner =>
  Effect.fn("DocgenQualityWorkerEval.codexRunner")(function* ({
    baseUrl,
    model,
    prompt,
    provider,
    reasoningEffort,
    workingDirectory,
  }) {
    const codexOptions = Match.value(provider).pipe(
      Match.when("codex", () => ({
        config: {
          model_provider: "openai",
        },
      })),
      Match.orElse((provider) => ({
        config: {
          model_provider: provider,
          oss_provider: provider,
        },
      }))
    );
    const nonEmptyBaseUrl = pipe(O.fromNullishOr(baseUrl), O.map(Str.trim), O.filter(Str.isNonEmpty));
    const baseUrlOptions = pipe(
      nonEmptyBaseUrl,
      O.map((value) => ({ baseUrl: value })),
      O.getOrElse(() => ({}))
    );
    const ossBaseUrlEnvOptions =
      provider === "ollama"
        ? pipe(
            nonEmptyBaseUrl,
            O.map((value) => ({
              env: {
                CODEX_OSS_BASE_URL: ossProviderBaseUrl(value),
              },
            })),
            O.getOrElse(() => ({}))
          )
        : {};
    const codexOptionsWithBaseUrl = {
      ...codexOptions,
      ...baseUrlOptions,
      ...ossBaseUrlEnvOptions,
    };
    const reasoningThreadOptions = pipe(
      O.fromNullishOr(reasoningEffort),
      O.map((modelReasoningEffort) => ({ modelReasoningEffort })),
      O.getOrElse(() => ({}))
    );
    const codex = yield* Effect.try({
      try: () => new sdkModule.Codex(codexOptionsWithBaseUrl),
      catch: (cause) =>
        DomainError.make({
          message: `Failed to construct Codex SDK client for provider "${provider}" and model "${model}": ${errorMessage(cause)}`,
          cause,
        }),
    });
    const thread = yield* Effect.try({
      try: () =>
        codex.startThread({
          approvalPolicy: "never",
          model,
          networkAccessEnabled: false,
          sandboxMode: "read-only",
          webSearchMode: "disabled",
          workingDirectory,
          ...reasoningThreadOptions,
        }),
      catch: (cause) =>
        DomainError.make({
          message: `Failed to start Codex worker thread for provider "${provider}" and model "${model}": ${errorMessage(cause)} ${providerHint(provider)}`,
          cause,
        }),
    });
    const turn = yield* Effect.tryPromise({
      try: (signal) => thread.run(prompt, { outputSchema: qualityWorkerEvalWorkerOutputJsonSchema, signal }),
      catch: (cause) =>
        DomainError.make({
          message: `Codex worker turn failed for provider "${provider}" and model "${model}": ${errorMessage(cause)} ${providerHint(provider)}`,
          cause,
        }),
    });

    return {
      finalResponse: turn.finalResponse,
    };
  });

const makeDefaultCodexRunner = Effect.fn("DocgenQualityWorkerEval.makeDefaultCodexRunner")(function* () {
  const sdkModule = yield* importCodexSdk();
  return makeCodexRunner(sdkModule);
});

const makeIsolatedWorkerEvalDirectory = Effect.fn("DocgenQualityWorkerEval.makeIsolatedWorkerEvalDirectory")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs
      .makeTempDirectory({ prefix: "beep-docgen-worker-eval-" })
      .pipe(Effect.mapError(DomainError.newCause("Failed to create isolated docgen worker eval directory.")));
    yield* fs
      .writeFileString(
        path.join(directory, "README.md"),
        "This temporary worker directory intentionally contains no repository checkout. Evaluate only the prompt-supplied packet.\n"
      )
      .pipe(
        Effect.tapError(() => fs.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore)),
        Effect.mapError(DomainError.newCause("Failed to write isolated docgen worker eval directory marker."))
      );
    return directory;
  }
);

const removeIsolatedWorkerEvalDirectory = (directory: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore)
  );

const decodeWorkerOutput = (value: string): Effect.Effect<DocgenQualityWorkerEvalWorkerOutput, DomainError> =>
  decodeWorkerOutputJson(value).pipe(Effect.mapError(DomainError.newCause("Worker returned invalid eval JSON.")));

const failedPacketResult = ({
  candidate,
  durationMs,
  error,
  status,
}: {
  readonly candidate: PacketCandidate;
  readonly durationMs: number;
  readonly error: string;
  readonly status: DocgenQualityWorkerEvalPacketStatus;
}): DocgenQualityWorkerEvalPacketResult =>
  DocgenQualityWorkerEvalPacketResult.make({
    packetId: candidate.packet.id,
    subjectId: candidate.packet.subjectId,
    sourceAnchor: candidate.sourceAnchor,
    packageName: candidate.packageName,
    packagePath: candidate.packagePath,
    findingCodes: candidate.findingCodes,
    status,
    localScore: null,
    rationale: "",
    draftJsDoc: "",
    expectedVerificationCommand: candidate.packet.verificationCommand,
    policyViolationCodes: ["other"],
    reviewDisposition: "reject",
    durationMs,
    error,
  });

const completedPacketResult = ({
  candidate,
  durationMs,
  output,
}: {
  readonly candidate: PacketCandidate;
  readonly durationMs: number;
  readonly output: DocgenQualityWorkerEvalWorkerOutput;
}): DocgenQualityWorkerEvalPacketResult =>
  DocgenQualityWorkerEvalPacketResult.make({
    packetId: candidate.packet.id,
    subjectId: candidate.packet.subjectId,
    sourceAnchor: candidate.sourceAnchor,
    packageName: candidate.packageName,
    packagePath: candidate.packagePath,
    findingCodes: candidate.findingCodes,
    status: "completed",
    localScore: output.localScore,
    rationale: output.rationale,
    draftJsDoc: output.draftJsDoc,
    expectedVerificationCommand: candidate.packet.verificationCommand,
    policyViolationCodes: output.policyViolationCodes,
    reviewDisposition: output.reviewDisposition,
    durationMs,
    error: null,
  });

const runPacketEval = Effect.fn("DocgenQualityWorkerEval.runPacketEval")(function* ({
  baseUrl,
  candidate,
  model,
  provider,
  reasoningEffort,
  runner,
  timeout,
  workingDirectory,
}: {
  readonly baseUrl?: string;
  readonly candidate: PacketCandidate;
  readonly model: string;
  readonly provider: DocgenQualityWorkerEvalProvider;
  readonly reasoningEffort?: DocgenQualityWorkerEvalReasoningEffort;
  readonly runner: DocgenQualityWorkerEvalRunner;
  readonly timeout: Duration.Duration;
  readonly workingDirectory: string;
}) {
  const startedAtMs = globalThis.performance.now();
  const reasoningInput = pipe(
    O.fromNullishOr(reasoningEffort),
    O.map((value) => ({ reasoningEffort: value })),
    O.getOrElse(() => ({}))
  );
  const timed = yield* runner({
    ...O.getSomesStruct({ baseUrl: O.fromUndefinedOr(baseUrl) }),
    model,
    prompt: workerPrompt(candidate),
    provider,
    ...reasoningInput,
    workingDirectory,
  }).pipe(
    Effect.flatMap((result) => decodeWorkerOutput(result.finalResponse)),
    Effect.map((output) =>
      completedPacketResult({
        candidate,
        durationMs: durationMsSince(startedAtMs),
        output,
      })
    ),
    Effect.timeoutOption(timeout),
    Effect.result
  );

  if (Result.isFailure(timed)) {
    return failedPacketResult({
      candidate,
      durationMs: durationMsSince(startedAtMs),
      error: errorMessage(timed.failure),
      status: "failed",
    });
  }

  if (O.isNone(timed.success)) {
    return failedPacketResult({
      candidate,
      durationMs: durationMsSince(startedAtMs),
      error: `Timed out after ${Duration.toMillis(timeout)}ms.`,
      status: "timed-out",
    });
  }

  return timed.success.value;
});

const summarizePacketResults = (
  report: DocgenQualityReport,
  selectedPackets: number,
  packets: ReadonlyArray<DocgenQualityWorkerEvalPacketResult>
): DocgenQualityWorkerEvalSummary =>
  DocgenQualityWorkerEvalSummary.make({
    packages: report.packages.length,
    sourcePackets: report.remediationPackets.length,
    selectedPackets,
    completed: A.filter(packets, (packet) => packet.status === "completed").length,
    failed: A.filter(packets, (packet) => packet.status === "failed").length,
    timedOut: A.filter(packets, (packet) => packet.status === "timed-out").length,
    candidates: A.filter(packets, (packet) => packet.reviewDisposition === "candidate").length,
    needsHumanReview: A.filter(packets, (packet) => packet.reviewDisposition === "needs-human-review").length,
    rejected: A.filter(packets, (packet) => packet.reviewDisposition === "reject").length,
  });

const summarizePolicyViolations: (
  packets: ReadonlyArray<DocgenQualityWorkerEvalPacketResult>
) => ReadonlyArray<DocgenQualityWorkerEvalPolicyViolationCode> = flow(
  A.flatMap((packet) => packet.policyViolationCodes),
  A.dedupe,
  A.sort(Order.String)
);

const recommendationForSummary = (summary: DocgenQualityWorkerEvalSummary): string => {
  if (summary.selectedPackets === 0) {
    return "No packets were selected for worker evaluation.";
  }

  if (summary.completed === 0) {
    return "Keep workers experimental; no selected packets completed successfully.";
  }

  if (summary.rejected > 0 || summary.failed > 0 || summary.timedOut > 0) {
    return "Keep workers as read-only experimental triage until failures and rejected drafts are reviewed.";
  }

  if (summary.needsHumanReview > 0) {
    return "Keep workers read-only; completed drafts still need human review before remediation use.";
  }

  return "Worker drafts are candidate evidence only; compare against human review before graduation.";
};

/**
 * Decode a saved `docgen quality` JSON report for worker eval.
 *
 * @param content - JSON text emitted by `beep docgen quality --json`.
 * @returns Effect that yields the decoded quality report.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { decodeDocgenQualityReportForWorkerEval } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const qualityReportJson = JSON.stringify({
 *   schemaVersion: 2,
 *   rubricVersion: "jsdoc-quality-v1",
 *   generatedAt: "2026-05-12T00:00:00.000Z",
 *   scope: "all",
 *   scorer: "rubric",
 *   summary: { packages: 0, subjects: 0, passing: 0, warnings: 0, failures: 0, remediationPackets: 0 },
 *   packages: [],
 *   remediationPackets: []
 * })
 * const subjectCount = Effect.runSync(
 *   decodeDocgenQualityReportForWorkerEval(qualityReportJson).pipe(Effect.map((report) => report.summary.subjects))
 * )
 * console.log(subjectCount) // example value
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeDocgenQualityReportForWorkerEval = (
  content: string
): Effect.Effect<DocgenQualityReport, DomainError> =>
  decodeQualityReportJson(content).pipe(
    Effect.mapError(DomainError.newCause("Failed to decode docgen quality JSON report."))
  );

/**
 * Compute the source packet limit used for generated quality reports.
 *
 * @param packetLimit - Worker packet limit requested by the caller.
 * @returns Source quality-report packet cap used before worker-side selection.
 * @example
 * ```ts
 * import { qualityWorkerEvalSourcePacketLimit } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(qualityWorkerEvalSourcePacketLimit(5))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const qualityWorkerEvalSourcePacketLimit = (packetLimit: number): number =>
  packetLimit <= 0 ? 0 : Math.max(packetLimit, DEFAULT_SOURCE_PACKET_LIMIT);

/**
 * Default packet cap for `docgen quality-worker-eval`.
 *
 * @returns Default maximum number of worker packet turns.
 * @example
 * ```ts
 * import { defaultQualityWorkerEvalPacketLimit } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(defaultQualityWorkerEvalPacketLimit())
 * ```
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerEvalPacketLimit = (): number => DEFAULT_WORKER_EVAL_PACKET_LIMIT;

/**
 * Default hosted Codex reasoning effort for worker eval.
 *
 * @returns Default hosted Codex reasoning effort for worker eval.
 * @example
 * ```ts
 * import { defaultQualityWorkerEvalReasoningEffort } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * console.log(defaultQualityWorkerEvalReasoningEffort())
 * ```
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerEvalReasoningEffort = (): DocgenQualityWorkerEvalReasoningEffort => "low";

/**
 * Build a read-only worker eval report from a quality report.
 *
 * @effects
 * - Creates an isolated temporary working directory for packet-only worker turns.
 * - Runs read-only Codex worker turns through the configured runner; never edits source files.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   analyzeDocgenQualityWorkerEval,
 *   decodeDocgenQualityReportForWorkerEval
 * } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const qualityReportJson = JSON.stringify({
 *   schemaVersion: 2,
 *   rubricVersion: "jsdoc-quality-v1",
 *   generatedAt: "2026-05-12T00:00:00.000Z",
 *   scope: "all",
 *   scorer: "rubric",
 *   summary: { packages: 0, subjects: 0, passing: 0, warnings: 0, failures: 0, remediationPackets: 0 },
 *   packages: [],
 *   remediationPackets: []
 * })
 * const selectedPacketCount = decodeDocgenQualityReportForWorkerEval(qualityReportJson).pipe(
 *   Effect.flatMap((report) =>
 *     analyzeDocgenQualityWorkerEval({
 *       codexSdkVersion: "example-sdk",
 *       model: "gpt-5.4-mini",
 *       packetLimit: 0,
 *       provider: "codex",
 *       report,
 *       scope: "input",
 *       sourceQualityReport: "quality.json"
 *     })
 *   ),
 *   Effect.map((report) => report.summary.selectedPackets)
 * )
 * console.log(selectedPacketCount) // example value
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const analyzeDocgenQualityWorkerEval = Effect.fn("DocgenQualityWorkerEval.analyzeDocgenQualityWorkerEval")(
  function* ({
    baseUrl,
    codexSdkVersion,
    model,
    packetLimit = DEFAULT_WORKER_EVAL_PACKET_LIMIT,
    provider,
    reasoningEffort,
    report,
    runner,
    scope,
    sourceQualityReport,
    timeout = DEFAULT_WORKER_EVAL_TIMEOUT,
  }: AnalyzeDocgenQualityWorkerEvalOptions) {
    const startedAtMs = globalThis.performance.now();
    const sdkVersion = codexSdkVersion ?? (yield* resolveCodexSdkVersionOrUnknown);
    const resolvedBaseUrl = pipe(O.fromNullishOr(baseUrl), O.map(Str.trim), O.filter(Str.isNonEmpty), O.getOrUndefined);
    const candidates = A.map(report.remediationPackets, (packet) => packetCandidate(report, packet));
    const selected = selectQualityWorkerEvalPackets(candidates, packetLimit);
    let packets: ReadonlyArray<DocgenQualityWorkerEvalPacketResult>;
    if (selected.length === 0) {
      packets = A.empty();
    } else {
      const resolvedRunner = runner ?? (yield* makeDefaultCodexRunner());
      packets = yield* Effect.acquireUseRelease(
        makeIsolatedWorkerEvalDirectory(),
        (workingDirectory) =>
          Effect.forEach(
            selected,
            (candidate) => {
              const reasoningInput = pipe(
                O.fromNullishOr(reasoningEffort),
                O.map((value) => ({ reasoningEffort: value })),
                O.getOrElse(() => ({}))
              );

              return runPacketEval({
                ...O.getSomesStruct({ baseUrl: O.fromUndefinedOr(resolvedBaseUrl) }),
                candidate,
                model,
                provider,
                ...reasoningInput,
                runner: resolvedRunner,
                timeout,
                workingDirectory,
              });
            },
            { concurrency: 1 }
          ),
        removeIsolatedWorkerEvalDirectory
      );
    }
    const summary = summarizePacketResults(report, selected.length, packets);

    return DocgenQualityWorkerEvalReport.make({
      schemaVersion: QUALITY_WORKER_EVAL_SCHEMA_VERSION,
      generatedAt: timestampIso(),
      sourceQualityReport,
      provider,
      model,
      reasoningEffort: reasoningEffort ?? null,
      codexSdkVersion: sdkVersion,
      scope,
      summary,
      packets,
      policyViolations: summarizePolicyViolations(packets),
      runtime: DocgenQualityWorkerEvalRuntime.make({
        totalDurationMs: durationMsSince(startedAtMs),
        packetTimeoutMs: Duration.toMillis(timeout),
      }),
      recommendation: recommendationForSummary(summary),
    });
  }
);

/**
 * Render a worker eval report as stable JSON.
 *
 * @param report - Worker eval report to render.
 * @returns Effect that yields stable pretty JSON.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   analyzeDocgenQualityWorkerEval,
 *   decodeDocgenQualityReportForWorkerEval,
 *   generateQualityWorkerEvalJson
 * } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 *
 * const qualityReportJson = JSON.stringify({
 *   schemaVersion: 2,
 *   rubricVersion: "jsdoc-quality-v1",
 *   generatedAt: "2026-05-12T00:00:00.000Z",
 *   scope: "all",
 *   scorer: "rubric",
 *   summary: { packages: 0, subjects: 0, passing: 0, warnings: 0, failures: 0, remediationPackets: 0 },
 *   packages: [],
 *   remediationPackets: []
 * })
 * const hasSchemaVersion = decodeDocgenQualityReportForWorkerEval(qualityReportJson).pipe(
 *   Effect.flatMap((report) =>
 *     analyzeDocgenQualityWorkerEval({
 *       codexSdkVersion: "example-sdk",
 *       model: "gpt-5.4-mini",
 *       packetLimit: 0,
 *       provider: "codex",
 *       report,
 *       scope: "input",
 *       sourceQualityReport: "quality.json"
 *     })
 *   ),
 *   Effect.flatMap(generateQualityWorkerEvalJson),
 *   Effect.map((json) => json.includes("\"schemaVersion\": 1"))
 * )
 * console.log(hasSchemaVersion) // example value
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const generateQualityWorkerEvalJson = (
  report: DocgenQualityWorkerEvalReport
): Effect.Effect<string, DomainError> => renderJson(report);
