/**
 * Schemas for the Terminal of Record synthetic session rendered by the Todox
 * homepage. Every record on screen is an instance of these shapes, so the
 * instrument vocabulary, record addressing, and receipt fields are enforced
 * at the type and decode boundary instead of by convention.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TodoxId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $TodoxId.create("session/Session.schema");

/**
 * The producer line printed in every receipt. It is content, not chrome, and
 * names the deterministic fixture so no visitor mistakes the session for a
 * live model run.
 *
 * **Example** (Read the producer line)
 *
 * ```ts
 * import { PRODUCER } from "@/session/Session.schema"
 *
 * console.log(PRODUCER)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PRODUCER = "FIXTURE RUNTIME (DETERMINISTIC · NO LIVE MODEL)";

/**
 * Instrument-grade state words. Nothing else may appear in a state cell.
 *
 * **Example** (Guard a state word)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RecordState } from "@/session/Session.schema"
 *
 * console.log(S.is(RecordState)("ACCEPTED (SCOPED)"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RecordState = LiteralKit([
  "CANDIDATE",
  "NEEDS REVIEW",
  "ACCEPTED (SCOPED)",
  "REJECTED",
  "SUPERSEDED",
  "SOURCE UNAVAILABLE",
  "CONFLICTING EVIDENCE",
  "PENDING",
]).pipe(
  $I.annoteSchema("RecordState", {
    description: "Instrument vocabulary for the state cell of every session record.",
  })
);

/**
 * Runtime type for {@link RecordState}.
 *
 * @category models
 * @since 0.0.0
 */
type RecordState = typeof RecordState.Type;

/**
 * Record families addressed on screen.
 *
 * **Example** (Guard a record kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RecordKind } from "@/session/Session.schema"
 *
 * console.log(S.is(RecordKind)("CLM"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const RecordKind = LiteralKit(["SRC", "CLM", "TSK", "DRF", "QST", "GTE", "PKT"]).pipe(
  $I.annoteSchema("RecordKind", {
    description: "Record family prefix: source, claim, task, draft, question, gate, packet.",
  })
);

/**
 * Runtime type for {@link RecordKind}.
 *
 * @category models
 * @since 0.0.0
 */
type RecordKind = typeof RecordKind.Type;

/**
 * A stable visible record number such as `CLM 0101`.
 *
 * **Example** (Guard a record number)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RecordNumber } from "@/session/Session.schema"
 *
 * console.log(S.is(RecordNumber)("CLM 0101"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RecordNumber = S.String.check(S.isPattern(/^(SRC|CLM|TSK|DRF|QST|GTE|PKT) \d{4}$/)).pipe(
  $I.annoteSchema("RecordNumber", {
    description: "Visible record address: a record kind prefix and a four-digit number.",
  })
);

/**
 * Runtime type for {@link RecordNumber}.
 *
 * @category models
 * @since 0.0.0
 */
type RecordNumber = typeof RecordNumber.Type;

/**
 * Source span identifiers inside one source artifact.
 *
 * @category models
 * @since 0.0.0
 */
const SpanId = LiteralKit(["S1", "S2", "S3", "S4", "S5", "S6"]).pipe(
  $I.annoteSchema("SpanId", { description: "Span index inside a source artifact." })
);

/**
 * Runtime type for {@link SpanId}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpanId = typeof SpanId.Type;

/**
 * Every actor that speaks on screen. Each actor owns one typographic voice.
 *
 * @category models
 * @since 0.0.0
 */
const Actor = LiteralKit(["MIRA PARK", "TIA ROWAN", "FIXTURE RUNTIME"]).pipe(
  $I.annoteSchema("Actor", { description: "Synthetic session actors: client, advisor, producer." })
);

/**
 * Runtime type for {@link Actor}.
 *
 * @category models
 * @since 0.0.0
 */
type Actor = typeof Actor.Type;

/**
 * Whether a record comes from the canonical fixture's expected outputs or was
 * authored for the demonstration at production fidelity.
 *
 * @category models
 * @since 0.0.0
 */
const Provenance = LiteralKit(["fixture", "authored"]).pipe(
  $I.annoteSchema("Provenance", { description: "Fixture-verbatim or authored synthetic content." })
);

/**
 * Runtime type for {@link Provenance}.
 *
 * @category models
 * @since 0.0.0
 */
type Provenance = typeof Provenance.Type;

/**
 * A reference to one span of one source record, rendered as `SRC 0001·S2`.
 *
 * **Example** (Build a span reference)
 *
 * ```ts
 * import { SpanRef } from "@/session/Session.schema"
 *
 * const ref = SpanRef.make({ source: "SRC 0001", span: "S2" })
 * console.log(ref.span)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpanRef extends S.Class<SpanRef>($I`SpanRef`)(
  {
    source: RecordNumber,
    span: SpanId,
  },
  $I.annote("SpanRef", { description: "A source record number and a span inside it." })
) {}

/**
 * Renders a span reference in the on-screen `SRC 0001·S2` form.
 *
 * **Example** (Format a span reference)
 *
 * ```ts
 * import { SpanRef, spanRefLabel } from "@/session/Session.schema"
 *
 * console.log(spanRefLabel(SpanRef.make({ source: "SRC 0001", span: "S2" })))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const spanRefLabel = (ref: SpanRef): string => `${ref.source}·${ref.span}`;

/**
 * One verbatim span of a source artifact.
 *
 * **Example** (Make a verbatim span)
 *
 * ```ts
 * import { SourceSpan } from "@/session/Session.schema"
 *
 * const span = SourceSpan.make({ id: "S2", text: "We need cash by the fall.", fixtureId: "email-0001" })
 * console.log(span.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceSpan extends S.Class<SourceSpan>($I`SourceSpan`)(
  {
    id: SpanId,
    text: S.String,
    fixtureId: S.String,
  },
  $I.annote("SourceSpan", { description: "A verbatim span of a source artifact." })
) {}

/**
 * A source artifact (email or call note) with its spans.
 *
 * **Example** (Check the synthetic email)
 *
 * ```ts
 * import { SourceArtifact } from "@/session/Session.schema"
 * import { emailSource } from "@/session/session"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SourceArtifact)(emailSource), emailSource.spans.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceArtifact extends S.Class<SourceArtifact>($I`SourceArtifact`)(
  {
    no: RecordNumber,
    kind: LiteralKit(["EMAIL", "CALL NOTE"]),
    from: Actor,
    to: Actor,
    subject: S.String,
    dated: S.String,
    fixtureId: S.String,
    provenance: Provenance,
    spans: S.NonEmptyArray(SourceSpan),
  },
  $I.annote("SourceArtifact", { description: "A source artifact and its verbatim spans." })
) {}

/**
 * The receipt attached to every record: requested action, reviewer, candidate
 * reference, evidence, policy basis, decision state, time, and producer.
 *
 * **Example** (Read a record's receipt)
 *
 * ```ts
 * import { reviewPassage } from "@/session/session"
 *
 * const receipt = reviewPassage.records[0].receipt
 * console.log(receipt.reviewer, receipt.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Receipt extends S.Class<Receipt>($I`Receipt`)(
  {
    requestedAction: S.String,
    reviewer: Actor,
    candidateRef: RecordNumber,
    evidence: S.Array(SpanRef),
    policyBasis: S.String,
    state: RecordState,
    time: S.String,
    producer: S.Literal(PRODUCER),
  },
  $I.annote("Receipt", { description: "Activity receipt fields for one record." })
) {}

/**
 * One addressable record in a screen passage.
 *
 * **Example** (Read the cursor record)
 *
 * ```ts
 * import { reviewPassage } from "@/session/session"
 * import * as A from "effect/Array"
 *
 * const record = A.headNonEmpty(reviewPassage.records)
 * console.log(record.no, record.kind, record.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionRecord extends S.Class<SessionRecord>($I`SessionRecord`)(
  {
    no: RecordNumber,
    kind: RecordKind,
    text: S.String,
    state: RecordState,
    actor: Actor,
    time: S.String,
    evidence: S.Array(SpanRef),
    fixtureId: S.String,
    provenance: Provenance,
    receipt: Receipt,
    confidence: S.optionalKey(LiteralKit(["HIGH", "MEDIUM", "LOW"])),
    note: S.optionalKey(S.String),
    editedFrom: S.optionalKey(S.String),
    priorState: S.optionalKey(RecordState),
    supersededBy: S.optionalKey(RecordNumber),
    supersededOn: S.optionalKey(S.String),
  },
  $I.annote("SessionRecord", { description: "An addressable record row with its receipt." })
) {}

/**
 * The approval gate shown at the head of the review passage.
 *
 * **Example** (Make a pending gate)
 *
 * ```ts
 * import { ApprovalGate } from "@/session/Session.schema"
 *
 * const gate = ApprovalGate.make({
 *   no: "GTE 0300",
 *   reviewer: "TIA ROWAN",
 *   state: "PENDING",
 *   policyBasis: "Client-facing drafts wait for advisor review.",
 *   requestedActions: ["Send the draft reply"],
 *   fixtureId: "gate-0300",
 * })
 * console.log(gate.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApprovalGate extends S.Class<ApprovalGate>($I`ApprovalGate`)(
  {
    no: RecordNumber,
    reviewer: Actor,
    state: RecordState,
    policyBasis: S.String,
    requestedActions: S.NonEmptyArray(S.String),
    fixtureId: S.String,
  },
  $I.annote("ApprovalGate", { description: "The pending approval gate and its policy basis." })
) {}

/**
 * A supersession chain rendered as `CLM 0099 ⟶ CLM 0103`.
 *
 * **Example** (Make a supersession chain)
 *
 * ```ts
 * import { Chain } from "@/session/Session.schema"
 *
 * const chain = Chain.make({ from: "CLM 0099", to: "CLM 0103" })
 * console.log(`${chain.from} ⟶ ${chain.to}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Chain extends S.Class<Chain>($I`Chain`)(
  {
    from: RecordNumber,
    to: RecordNumber,
  },
  $I.annote("Chain", { description: "Prior record and the record that supersedes it." })
) {}

/**
 * One screen passage: a beat of the session with its records.
 *
 * **Example** (Read a passage's cursor)
 *
 * ```ts
 * import { reviewPassage } from "@/session/session"
 *
 * console.log(reviewPassage.beat, reviewPassage.cursor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenPassage extends S.Class<ScreenPassage>($I`ScreenPassage`)(
  {
    id: S.String,
    beat: S.String,
    clock: S.String,
    sources: S.Array(SourceArtifact),
    litSpan: S.optionalKey(SpanRef),
    gate: S.optionalKey(ApprovalGate),
    chain: S.optionalKey(Chain),
    records: S.NonEmptyArray(SessionRecord),
    cursor: RecordNumber,
    defaultOpen: S.optionalKey(RecordNumber),
  },
  $I.annote("ScreenPassage", { description: "A screen beat: sources, gate, chain, records." })
) {}

/**
 * One entry of the meeting-preparation packet.
 *
 * **Example** (Make a packet line)
 *
 * ```ts
 * import { PacketEntry } from "@/session/Session.schema"
 *
 * const entry = PacketEntry.make({
 *   text: "Client needs cash before the fall.",
 *   refs: ["CLM 0101"],
 *   evidence: [{ source: "SRC 0001", span: "S2" }],
 * })
 * console.log(entry.refs.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketEntry extends S.Class<PacketEntry>($I`PacketEntry`)(
  {
    text: S.String,
    refs: S.Array(RecordNumber),
    evidence: S.Array(SpanRef),
  },
  $I.annote("PacketEntry", { description: "A packet line with its record and span references." })
) {}

/**
 * One packet section in the DEMO-SCRIPT order.
 *
 * **Example** (Read the first packet section)
 *
 * ```ts
 * import { packet } from "@/session/session"
 * import * as A from "effect/Array"
 *
 * console.log(A.headNonEmpty(packet.sections).heading)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketSection extends S.Class<PacketSection>($I`PacketSection`)(
  {
    heading: S.String,
    entries: S.NonEmptyArray(PacketEntry),
  },
  $I.annote("PacketSection", { description: "A headed packet section." })
) {}

/**
 * The assembled meeting-preparation packet with its receipt.
 *
 * **Example** (Read the packet receipt)
 *
 * ```ts
 * import { packet } from "@/session/session"
 *
 * console.log(packet.no, packet.forCall, packet.receipt.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Packet extends S.Class<Packet>($I`Packet`)(
  {
    no: RecordNumber,
    forCall: S.String,
    sections: S.NonEmptyArray(PacketSection),
    excluded: S.NonEmptyArray(S.String),
    focal: PacketEntry,
    receipt: Receipt,
    fixtureId: S.String,
  },
  $I.annote("Packet", { description: "The bounded context packet and its activity receipt." })
) {}
