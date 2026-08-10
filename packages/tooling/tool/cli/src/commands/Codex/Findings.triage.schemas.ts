/**
 * Typed model of the `codex-triage/v1` ledger this CLI generates and re-reads.
 *
 * The version string matches the hand-written packets by convention, but this
 * schema is deliberately scoped to ledgers the CLI itself produces. Five
 * historical batches ship five mutually incompatible shapes under that same
 * string, so retrofitting a strict decoder onto them would reject four of five.
 * Judgment fields are `optionalKey` precisely so one ledger validates at every
 * packet phase: absent at capture, present once a triage agent has filled them
 * in, which is what lets a refresh round-trip a half-triaged file without
 * destroying work.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  CaptureDate,
  CodexFindingId,
  CodexFindingSeverity,
  CodexFindingStatus,
  GitCommitSha,
  GitHubRepoSlug,
} from "./Findings.capture.schemas.ts";
import { CodexPacketBranch, CodexRecordId } from "./Findings.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Codex/Findings.triage.schemas");

/**
 * What a triage agent decided to do about a finding.
 *
 * **Details**
 *
 * A freshly generated ledger sets every finding to `untriaged`. The Codex
 * packet policy forbids `accepted-risk`, but the literal remains in the domain
 * so an older ledger carrying it still decodes and can be reported on.
 *
 * **Example** (Reading the default disposition)
 *
 * ```ts
 * import { CodexDisposition } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexDisposition.is.untriaged("untriaged")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexDisposition = LiteralKit([
  "untriaged",
  "remediate",
  "already-fixed",
  "false-positive",
  "out-of-scope",
  "accepted-risk",
]).pipe(
  $I.annoteSchema("CodexDisposition", {
    description: "Decision a triage agent recorded for one captured finding.",
  })
);

/**
 * Disposition recorded for one finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexDisposition = typeof CodexDisposition.Type;

/**
 * Whether a reported finding actually reproduces at the current branch head.
 *
 * **Example** (Naming a verdict)
 *
 * ```ts
 * import { CodexVerdict } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexVerdict.is["confirmed-vulnerable"]("confirmed-vulnerable")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexVerdict = LiteralKit([
  "confirmed-vulnerable",
  "real",
  "already-fixed",
  "false-positive",
  "out-of-scope",
  "not-real",
  "partial",
]).pipe(
  $I.annoteSchema("CodexVerdict", {
    description: "Current-HEAD validation verdict recorded for one captured finding.",
  })
);

/**
 * Validation verdict recorded for one finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexVerdict = typeof CodexVerdict.Type;

/**
 * Progress of one workstream inside the ledger.
 *
 * **Example** (Reading the capture-time status)
 *
 * ```ts
 * import { CodexWorkStatus } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexWorkStatus.Options[0]) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexWorkStatus = LiteralKit(["pending", "in-progress", "implemented", "complete", "not-required"]).pipe(
  $I.annoteSchema("CodexWorkStatus", {
    description: "Progress of validation, remediation, or a remediation lane.",
  })
);

/**
 * Progress of one triage workstream.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexWorkStatus = typeof CodexWorkStatus.Type;

/**
 * Confidence a triage agent attached to its verdict.
 *
 * **Example** (Naming a confidence level)
 *
 * ```ts
 * import { CodexConfidence } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexConfidence.is.high("high")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexConfidence = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("CodexConfidence", {
    description: "Confidence a triage agent attached to a validation verdict.",
  })
);

/**
 * Confidence attached to a verdict.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexConfidence = typeof CodexConfidence.Type;

/**
 * How the batch reached the repository.
 *
 * **Details**
 *
 * `signed-in-csv-export` is what this CLI writes: the operator downloads the
 * findings view's own CSV export and ingests the file, so no credential and no
 * pasted script is ever involved. The two Chrome-control values exist only so
 * ledgers from the hand-built batches still decode.
 *
 * **Example** (Naming the capture method)
 *
 * ```ts
 * import { CodexCaptureMethod } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexCaptureMethod.is["signed-in-csv-export"]("signed-in-csv-export")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexCaptureMethod = LiteralKit([
  "signed-in-csv-export",
  "signed-in-chrome-control",
  "signed-in-chrome-control-and-csv-export",
]).pipe(
  $I.annoteSchema("CodexCaptureMethod", {
    description: "Mechanism that produced the captured findings batch.",
  })
);

/**
 * Mechanism that produced a batch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexCaptureMethod = typeof CodexCaptureMethod.Type;

/**
 * Identifier of one remediation lane.
 *
 * **Example** (Validating a lane identifier)
 *
 * ```ts
 * import { CodexLaneId } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexLaneId)("L1-bounded-file-ingestion")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexLaneId = S.String.check(
  S.isPattern(/^L\d+-[a-z0-9-]{1,60}$/, {
    identifier: $I`CodexLaneIdPatternCheck`,
    title: "Codex Lane Id Pattern",
    description: "Lane identifiers are L<n>- followed by a lowercase slug.",
    message: "Expected an L<n>-<slug> remediation lane identifier",
  })
).pipe(
  $I.annoteSchema("CodexLaneId", {
    description: "Identifier of one disjoint remediation lane.",
  })
);

/**
 * Identifier of a remediation lane.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexLaneId = typeof CodexLaneId.Type;

/**
 * Current-HEAD validation state of one finding.
 *
 * **Example** (Constructing capture-time validation state)
 *
 * ```ts
 * import { CodexTriageValidation } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * console.log(CodexTriageValidation.make({ status: "pending" }).status) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageValidation extends S.Class<CodexTriageValidation>($I`CodexTriageValidation`)(
  {
    status: CodexWorkStatus,
    confidence: S.optionalKey(CodexConfidence),
    rationale: S.optionalKey(S.String),
  },
  $I.annote("CodexTriageValidation", {
    description: "Current-HEAD validation state recorded for one finding.",
  })
) {}

/**
 * Remediation state of one finding.
 *
 * **Example** (Constructing capture-time remediation state)
 *
 * ```ts
 * import { CodexTriageRemediation } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const remediation = CodexTriageRemediation.make({
 *   status: "pending",
 *   changedFiles: [],
 *   verificationCommands: [],
 * })
 *
 * console.log(remediation.changedFiles.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageRemediation extends S.Class<CodexTriageRemediation>($I`CodexTriageRemediation`)(
  {
    status: CodexWorkStatus,
    changedFiles: S.Array(S.String),
    verificationCommands: S.Array(S.String),
    summary: S.optionalKey(S.String),
  },
  $I.annote("CodexTriageRemediation", {
    description: "Remediation state recorded for one finding.",
  })
) {}

/**
 * One finding's full ledger entry.
 *
 * **Gotchas**
 *
 * `ownerArea`, `verdict`, and `lane` are optional because a generated ledger
 * carries none of them. They are agent judgment, and inventing them at capture
 * time would fabricate triage that never happened.
 *
 * **Example** (Constructing a capture-time entry)
 *
 * ```ts
 * import {
 *   CodexTriageFinding,
 *   CodexTriageRemediation,
 *   CodexTriageValidation,
 * } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const entry = CodexTriageFinding.make({
 *   id: "CSF-001",
 *   codexId: "d2b9e11e8550819193516057a336ff90",
 *   title: "Unbounded source resolution",
 *   severity: "Medium",
 *   codexStatus: "Open",
 *   commit: "244529aa4f560421cd096c2a4a4cb3cd21923070",
 *   disposition: "untriaged",
 *   validation: CodexTriageValidation.make({ status: "pending" }),
 *   remediation: CodexTriageRemediation.make({
 *     status: "pending",
 *     changedFiles: [],
 *     verificationCommands: [],
 *   }),
 * })
 *
 * console.log(entry.disposition) // "untriaged"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageFinding extends S.Class<CodexTriageFinding>($I`CodexTriageFinding`)(
  {
    id: CodexRecordId,
    codexId: CodexFindingId,
    title: S.String,
    severity: CodexFindingSeverity,
    codexStatus: CodexFindingStatus,
    commit: GitCommitSha,
    ownerArea: S.optionalKey(S.String),
    verdict: S.optionalKey(CodexVerdict),
    disposition: CodexDisposition,
    lane: S.optionalKey(CodexLaneId),
    validation: CodexTriageValidation,
    remediation: CodexTriageRemediation,
  },
  $I.annote("CodexTriageFinding", {
    description: "One finding's entry in the codex-triage/v1 ledger.",
  })
) {}

/**
 * One remediation lane grouping findings that share a root cause.
 *
 * **Example** (Constructing a lane)
 *
 * ```ts
 * import { CodexTriageLane } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const lane = CodexTriageLane.make({ status: "pending", findings: ["CSF-001"] })
 *
 * console.log(lane.findings[0]) // "CSF-001"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageLane extends S.Class<CodexTriageLane>($I`CodexTriageLane`)(
  {
    status: CodexWorkStatus,
    findings: S.Array(CodexRecordId),
    title: S.optionalKey(S.String),
  },
  $I.annote("CodexTriageLane", {
    description: "One disjoint remediation lane grouping findings by shared root cause.",
  })
) {}

/**
 * Provenance header of the ledger.
 *
 * **Example** (Constructing ledger provenance)
 *
 * ```ts
 * import { CodexTriageMeta } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const meta = CodexTriageMeta.make({
 *   schemaVersion: "codex-triage/v1",
 *   repository: "kriegcloud/beep-effect",
 *   findingsView: "repo-scoped, status=open",
 *   branch: "security/codex-findings-2026-08-04",
 *   expectedCount: 26,
 *   capturedCount: 26,
 *   capturedAt: "2026-08-04",
 *   captureMethod: "signed-in-csv-export",
 * })
 *
 * console.log(meta.capturedCount) // 26
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageMeta extends S.Class<CodexTriageMeta>($I`CodexTriageMeta`)(
  {
    schemaVersion: S.Literal("codex-triage/v1"),
    repository: GitHubRepoSlug,
    findingsView: S.String,
    branch: CodexPacketBranch,
    expectedCount: S.Int,
    capturedCount: S.Int,
    capturedAt: CaptureDate,
    captureMethod: CodexCaptureMethod,
    note: S.optionalKey(S.String),
  },
  $I.annote("CodexTriageMeta", {
    description: "Provenance header of a codex-triage/v1 ledger.",
  })
) {}

/**
 * The complete `codex-triage/v1` ledger.
 *
 * **When to use**
 *
 * Use to encode a freshly captured ledger, and to decode an existing one before
 * a refresh so agent-authored triage is preserved rather than overwritten.
 *
 * **Example** (Encoding an empty ledger)
 *
 * ```ts
 * import { CodexTriageLedger, CodexTriageMeta } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const ledger = CodexTriageLedger.make({
 *   meta: CodexTriageMeta.make({
 *     schemaVersion: "codex-triage/v1",
 *     repository: "kriegcloud/beep-effect",
 *     findingsView: "repo-scoped, status=open",
 *     branch: "security/codex-findings-2026-08-04",
 *     expectedCount: 0,
 *     capturedCount: 0,
 *     capturedAt: "2026-08-04",
 *     captureMethod: "signed-in-csv-export",
 *   }),
 *   lanes: {},
 *   findings: [],
 * })
 *
 * console.log(ledger.findings.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexTriageLedger extends S.Class<CodexTriageLedger>($I`CodexTriageLedger`)(
  {
    meta: CodexTriageMeta,
    lanes: S.Record(CodexLaneId, CodexTriageLane),
    findings: S.Array(CodexTriageFinding),
  },
  $I.annote("CodexTriageLedger", {
    description: "Complete codex-triage/v1 ledger generated and re-read by the CLI.",
  })
) {}

/**
 * Decode an existing ledger, preserving whatever triage it already carries.
 *
 * **Example** (Rejecting a ledger with an unknown version)
 *
 * ```ts
 * import { decodeCodexTriageLedger } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 * import { Effect } from "effect"
 *
 * const program = decodeCodexTriageLedger({ meta: { schemaVersion: "codex-triage/v2" } }).pipe(
 *   Effect.map(() => "accepted"),
 *   Effect.orElseSucceed(() => "rejected")
 * )
 *
 * console.log(Effect.runSync(program)) // "rejected"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCodexTriageLedger: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CodexTriageLedger, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<CodexTriageLedger, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(CodexTriageLedger));

/**
 * Encode a ledger to its JSON wire shape.
 *
 * **Details**
 *
 * Encoding drops absent judgment fields rather than writing them as `null`, so
 * a freshly captured ledger round-trips to exactly the shape a triage agent
 * expects to fill in.
 *
 * **Example** (Encoding a capture-time ledger for disk)
 *
 * ```ts
 * import { CodexTriageLedger, CodexTriageMeta, encodeCodexTriageLedger } from "@beep/repo-cli/commands/Codex/Findings.triage.schemas"
 *
 * const encoded = encodeCodexTriageLedger(
 *   CodexTriageLedger.make({
 *     meta: CodexTriageMeta.make({
 *       schemaVersion: "codex-triage/v1",
 *       repository: "kriegcloud/beep-effect",
 *       findingsView: "repo-scoped, status=open",
 *       branch: "security/codex-findings-2026-08-04",
 *       expectedCount: 0,
 *       capturedCount: 0,
 *       capturedAt: "2026-08-04",
 *       captureMethod: "signed-in-csv-export",
 *     }),
 *     lanes: {},
 *     findings: [],
 *   })
 * )
 *
 * console.log(JSON.stringify(encoded).includes("codex-triage/v1")) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeCodexTriageLedger: {
  (options?: AST.ParseOptions): (input: unknown) => typeof CodexTriageLedger.Encoded;
  (input: unknown, options?: AST.ParseOptions): typeof CodexTriageLedger.Encoded;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownSync(CodexTriageLedger));
