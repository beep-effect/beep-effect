/**
 * Structured vision-judge inventory schemas (`qa-inventory/v1`).
 *
 * The judge emits JSON only; this module is the contract that JSON must
 * satisfy before the CLI writes `inventory.json`. The verdict line can no
 * longer disagree with the findings array: {@link QaInventory} carries a
 * schema-level filter asserting `requiredCount` equals the number of P0 and P1
 * findings, so a miscounted verdict fails decoding instead of shipping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { RoundNumber, SequenceNumber } from "@beep/qa-capture";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Qa/Inventory.schemas");

/**
 * Severity domain of a vision-judge finding.
 *
 * **Details**
 *
 * `P0` blocks the round, `P1` must be fixed before the loop closes, and `P2`
 * is polish that never counts toward the required total.
 *
 * **Example** (Test severity membership)
 *
 * ```ts
 * import { QaSeverity } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * console.log(QaSeverity.is.P0("P0")) // true
 * console.log(QaSeverity.Options.length) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaSeverity = LiteralKit(["P0", "P1", "P2"]).pipe(
  $I.annoteSchema("QaSeverity", {
    description: "Severity domain of a vision-judge finding.",
  })
);

/**
 * Severity of a vision-judge finding.
 *
 * **Example** (Type a severity value)
 *
 * ```ts
 * import type { QaSeverity } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const severity: QaSeverity = "P1"
 * console.log(severity)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QaSeverity = typeof QaSeverity.Type;

/**
 * Review lenses a finding can be attributed to.
 *
 * **Details**
 *
 * The first eight are static lenses answerable from a single screenshot; the
 * rest are motion lenses that only frame strips and contact sheets can prove.
 *
 * **Example** (Check lens membership)
 *
 * ```ts
 * import { QaLens } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * console.log(QaLens.is["selection-smear"]("selection-smear")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaLens = LiteralKit([
  "affordance",
  "cancel-reset",
  "contrast",
  "cursor-affordance",
  "drag-ghost",
  "drop-preview",
  "floating-chrome",
  "focus-ring",
  "frame-discontinuity",
  "hover-latency",
  "legibility",
  "overflow",
  "proportions",
  "selection-smear",
  "transition-timing",
  "visual-hierarchy",
]).pipe(
  $I.annoteSchema("QaLens", {
    description: "Static and motion review lenses a vision-judge finding can be attributed to.",
  })
);

/**
 * Review lens a finding is attributed to.
 *
 * **Example** (Type a lens value)
 *
 * ```ts
 * import type { QaLens } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const lens: QaLens = "drag-ghost"
 * console.log(lens)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QaLens = typeof QaLens.Type;

/**
 * Artifact kinds a finding can cite as evidence.
 *
 * **Example** (Count evidence kind options)
 *
 * ```ts
 * import { QaEvidenceKind } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * console.log(QaEvidenceKind.Options.length) // 5
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaEvidenceKind = LiteralKit(["clip", "frame", "screenshot", "sheet", "strip"]).pipe(
  $I.annoteSchema("QaEvidenceKind", {
    description: "Artifact kinds a vision-judge finding can cite as evidence.",
  })
);

/**
 * Artifact kind cited by one evidence reference.
 *
 * **Example** (Type an evidence kind)
 *
 * ```ts
 * import type { QaEvidenceKind } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const kind: QaEvidenceKind = "strip"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QaEvidenceKind = typeof QaEvidenceKind.Type;

/**
 * Zero-padded two-digit ordinal inside a {@link QaFindingId}.
 *
 * **Example** (Validate zero-padded ordinal)
 *
 * ```ts
 * import { QaFindingOrdinal } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(QaFindingOrdinal)("07")) // true
 * console.log(S.is(QaFindingOrdinal)("7")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaFindingOrdinal = S.String.check(
  S.isPattern(/^[0-9]{2}$/, {
    identifier: $I`QaFindingOrdinalPatternCheck`,
    title: "Qa Finding Ordinal Pattern",
    description: "Finding ordinals are zero-padded two-digit numbers.",
    message: "Expected a zero-padded two-digit finding ordinal",
  })
).pipe(
  $I.annoteSchema("QaFindingOrdinal", {
    description: "Zero-padded two-digit ordinal inside a finding identifier.",
  })
);

/**
 * Branded `R<round>-<nn>` identifier of one vision-judge finding.
 *
 * **Example** (Validate finding id format)
 *
 * ```ts
 * import { QaFindingId } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(QaFindingId)("R3-01")) // true
 * console.log(S.is(QaFindingId)("R3-1")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaFindingId = S.TemplateLiteral(["R", RoundNumber, "-", QaFindingOrdinal]).pipe(
  S.brand("QaFindingId"),
  $I.annoteSchema("QaFindingId", {
    description: "Branded R<round>-<nn> identifier of one vision-judge finding.",
  })
);

/**
 * Identifier of one vision-judge finding.
 *
 * **Example** (Make branded finding id)
 *
 * ```ts
 * import { QaFindingId } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import type { QaFindingId as QaFindingIdValue } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const id: QaFindingIdValue = QaFindingId.make("R2-04")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QaFindingId = typeof QaFindingId.Type;

/**
 * One artifact a finding points at, with the witness events it correlates to.
 *
 * **Details**
 *
 * `path` is round-relative so an inventory stays valid when the round
 * directory moves into a goal packet's `history/`.
 *
 * **Example** (Construct evidence reference)
 *
 * ```ts
 * import { QaEvidenceRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const evidence = QaEvidenceRef.make({
 *   eventIds: [412, 418],
 *   kind: "strip",
 *   path: "frames/drag-w3-0002.png"
 * })
 * console.log(evidence.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaEvidenceRef extends S.Class<QaEvidenceRef>($I`QaEvidenceRef`)(
  {
    eventIds: S.Array(SequenceNumber).pipe(
      $I.annoteKey("QaEvidenceRef.eventIds", {
        description: "Witness sequence numbers this artifact corresponds to; may be empty.",
      })
    ),
    frameRange: S.OptionFromOptionalKey(S.Tuple([S.Int, S.Int])).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("QaEvidenceRef.frameRange", {
        description: "Inclusive first/last frame indexes inside a strip or sheet, when relevant.",
      })
    ),
    kind: QaEvidenceKind.pipe(
      $I.annoteKey("QaEvidenceRef.kind", {
        description: "Artifact kind being cited.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("QaEvidenceRef.path", {
        description: "Round-relative path of the cited artifact.",
      })
    ),
  },
  $I.annote("QaEvidenceRef", {
    description: "One artifact a vision-judge finding points at, with correlated witness events.",
  })
) {}

/**
 * The judge run that produced an inventory.
 *
 * **Example** (Construct judge reference)
 *
 * ```ts
 * import { QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const judge = QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" })
 * console.log(judge.model)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeRef extends S.Class<QaJudgeRef>($I`QaJudgeRef`)(
  {
    effort: S.String.pipe(
      $I.annoteKey("QaJudgeRef.effort", {
        description: "Reasoning effort the judge ran at.",
      })
    ),
    model: S.String.pipe(
      $I.annoteKey("QaJudgeRef.model", {
        description: "Model identifier that judged the round.",
      })
    ),
  },
  $I.annote("QaJudgeRef", {
    description: "The judge run that produced a QA inventory.",
  })
) {}

/**
 * One vision-judge finding with its evidence, reproduction, and fix.
 *
 * **Example** (Construct a full finding)
 *
 * ```ts
 * import { QaEvidenceRef, QaFinding, QaFindingId } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import * as O from "effect/Option"
 *
 * const finding = QaFinding.make({
 *   evidence: [
 *     QaEvidenceRef.make({ eventIds: [412], frameRange: O.none(), kind: "strip", path: "frames/drag-w3-0002.png" })
 *   ],
 *   fix: "preventDefault on pointerdown in Sash.tsx",
 *   id: QaFindingId.make("R2-01"),
 *   lens: "selection-smear",
 *   repro: "Drag the vertical sash 200px right over 1.5s",
 *   resolvedInRound: O.none(),
 *   severity: "P0",
 *   title: "Text selection smears across panels mid-drag"
 * })
 * console.log(finding.severity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaFinding extends S.Class<QaFinding>($I`QaFinding`)(
  {
    evidence: S.NonEmptyArray(QaEvidenceRef).pipe(
      $I.annoteKey("QaFinding.evidence", {
        description: "Artifacts backing the finding; a finding without evidence is not a finding.",
      })
    ),
    fix: S.String.pipe(
      $I.annoteKey("QaFinding.fix", {
        description: "Concrete change suggestion.",
      })
    ),
    id: QaFindingId.pipe(
      $I.annoteKey("QaFinding.id", {
        description: "Round-scoped finding identifier.",
      })
    ),
    lens: QaLens.pipe(
      $I.annoteKey("QaFinding.lens", {
        description: "Review lens the finding was seen through.",
      })
    ),
    repro: S.String.pipe(
      $I.annoteKey("QaFinding.repro", {
        description: "Gesture and timing needed to reproduce the defect.",
      })
    ),
    resolvedInRound: S.OptionFromOptionalKey(RoundNumber).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("QaFinding.resolvedInRound", {
        description: "Round that closed the finding, when a later round confirmed the fix.",
      })
    ),
    severity: QaSeverity.pipe(
      $I.annoteKey("QaFinding.severity", {
        description: "Finding severity.",
      })
    ),
    title: S.String.pipe(
      $I.annoteKey("QaFinding.title", {
        description: "One-line summary of the defect.",
      })
    ),
  },
  $I.annote("QaFinding", {
    description: "One vision-judge finding with its evidence, reproduction, and fix.",
  })
) {}

/**
 * Whether a finding counts toward the required (blocking) total.
 *
 * **Example** (Classify required severities)
 *
 * ```ts
 * import { isRequiredSeverity } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * console.log(isRequiredSeverity("P1")) // true
 * console.log(isRequiredSeverity("P2")) // false
 * ```
 *
 * @param severity - Severity to classify.
 * @returns True for P0 and P1, false for P2.
 * @category predicates
 * @since 0.0.0
 */
export const isRequiredSeverity = (severity: QaSeverity): boolean =>
  QaSeverity.$match(severity, {
    P0: () => true,
    P1: () => true,
    P2: () => false,
  });

/**
 * Count the findings that block the QA loop from closing.
 *
 * **Example** (Count empty findings list)
 *
 * ```ts
 * import { requiredFindingCount } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * console.log(requiredFindingCount([])) // 0
 * ```
 *
 * @param findings - Findings to count, in any order.
 * @returns How many findings carry a required severity.
 * @category utilities
 * @since 0.0.0
 */
export const requiredFindingCount = (findings: ReadonlyArray<{ readonly severity: QaSeverity }>): number =>
  A.length(A.filter(findings, (finding) => isRequiredSeverity(finding.severity)));

const RequiredCountCoherenceCheck = S.makeFilter(
  (inventory: {
    readonly findings: ReadonlyArray<{ readonly severity: QaSeverity }>;
    readonly requiredCount: number;
  }) => inventory.requiredCount === requiredFindingCount(inventory.findings),
  {
    identifier: $I`RequiredCountCoherenceCheck`,
    title: "Required Count Coherence",
    description: "requiredCount must equal the number of P0 and P1 findings.",
    message: "requiredCount disagrees with the P0/P1 findings in the inventory",
  }
);

/**
 * Schema-validated vision-judge inventory for one QA round.
 *
 * **Example** (Construct empty inventory)
 *
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 2,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(inventory.requiredCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaInventory extends S.Class<QaInventory>($I`QaInventory`)(
  S.Struct({
    findings: S.Array(QaFinding).pipe(
      $I.annoteKey("QaInventory.findings", {
        description: "Findings the judge produced, ordered by severity.",
      })
    ),
    judge: QaJudgeRef.pipe(
      $I.annoteKey("QaInventory.judge", {
        description: "Judge run that produced the inventory.",
      })
    ),
    requiredCount: S.Int.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`QaInventoryRequiredCountMinimumCheck`,
        title: "Qa Inventory Required Count Minimum",
        description: "Required counts are zero or greater.",
        message: "Expected a non-negative required count",
      })
    ).pipe(
      $I.annoteKey("QaInventory.requiredCount", {
        description: "Number of P0 and P1 findings; checked against the findings array.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("QaInventory.round", {
        description: "QA round the inventory judges.",
      })
    ),
    schemaVersion: S.Literal("qa-inventory/v1").pipe(
      $I.annoteKey("QaInventory.schemaVersion", {
        description: "Inventory schema version discriminator.",
      })
    ),
    sessionRef: S.String.pipe(
      $I.annoteKey("QaInventory.sessionRef", {
        description: "Round-relative path of the capture session manifest.",
      })
    ),
  }).check(RequiredCountCoherenceCheck),
  $I.annote("QaInventory", {
    description: "Schema-validated vision-judge inventory for one QA round.",
  })
) {}

/**
 * Decode an unknown value into a {@link QaInventory}.
 *
 * **Example** (Decode unknown as inventory)
 *
 * ```ts
 * import { decodeQaInventory } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaInventory({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaInventory: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<QaInventory, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<QaInventory, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(QaInventory));

/**
 * Encode a {@link QaInventory} back to its JSON-ready shape.
 *
 * **Example** (Encode inventory as effect)
 *
 * ```ts
 * import { encodeQaInventory, QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { Effect } from "effect"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(Effect.isEffect(encodeQaInventory(inventory))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeQaInventory: {
  (options?: AST.ParseOptions): (input: QaInventory) => Effect.Effect<typeof QaInventory.Encoded, S.SchemaError>;
  (input: QaInventory, options?: AST.ParseOptions): Effect.Effect<typeof QaInventory.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeEffect(QaInventory));
