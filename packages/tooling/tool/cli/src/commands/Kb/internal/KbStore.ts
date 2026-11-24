/**
 * Private knowledge-ledger persistence: frozen v1 readers, read-time import and v2-only writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { ClaimReference } from "@beep/epistemics/ClaimImport.schema";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  checkAppend,
  declaresFormat,
  eventLine,
  LineFormat,
  legacyMissingFacts,
  lineDigest,
  readClaimHistory,
} from "../../../internal/claims/ClaimHistory.ts";
import { makeClaimsV1Row } from "../../../internal/claims/ClaimRowV1.ts";
import {
  Assertion,
  KbClaim,
  KbClaimCore,
  KbClaimEvent,
  KbEvidenceSignals,
  KbLegacyImported,
  KbProposition,
  KbReviewState,
  kbLogicalKey,
} from "../Kb.schemas.ts";
import type { ClaimLine, JoinedClaim } from "../../../internal/claims/ClaimHistory.ts";
import type { KbCoreEvent } from "../Kb.schemas.ts";

const $I = $RepoCliId.create("commands/Kb/internal/KbStore");
const fields = Assertion.fields;
const frozen = makeClaimsV1Row({
  $I,
  proposition: KbProposition,
  logicalKey: kbLogicalKey,
  ids: { row: fields.id, evidence: fields.id, principal: fields.id },
});

/**
 * Frozen untagged claims.jsonl row: the stored kb claim-row/v1 bytes.
 *
 * @category schemas
 * @since 0.0.0
 */
export const KbClaimsV1Row = frozen.ClaimsV1Row;

/**
 * Frozen untagged assertions.jsonl row naming its claim by a bare kb old id.
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbAssertionV1Row extends S.Opaque<KbAssertionV1Row, { readonly brand: unique symbol }>()(
  S.Struct({
    id: fields.id,
    claimId: fields.id,
    captureId: fields.captureId,
    sourceRef: fields.sourceRef,
    selector: fields.selector,
    quote: fields.quote,
    quoteDigest: fields.quoteDigest,
    audience: fields.audience,
    derivation: fields.derivation,
    review: fields.review,
    outcome: fields.outcome,
  }).pipe($I.annoteSchema("KbAssertionV1Row", { description: "One frozen untagged kb assertion/v1 line." }))
) {}

/**
 * Content-addressed arrows bound to the knowledge claim core.
 *
 * @category services
 * @since 0.0.0
 */
export const kbArrows = makeClaimArrows({ $I, ClaimCore: KbClaimCore });

/**
 * One decoded claims.jsonl line: a stored claim or a separate claim-local record.
 *
 * @category models
 * @since 0.0.0
 */
export type KbClaimLine = ClaimLine<KbLegacyImported, KbCoreEvent, KbReviewState, KbEvidenceSignals>;

const isClaimEvent = declaresFormat(LineFormat.make({ key: "version", version: "kb-claim-record/v2" }));
const isAssertionV2 = declaresFormat(LineFormat.make({ key: "version", version: "kb-assertion/v2" }));
const decodeEvent = S.decodeUnknownEffect(KbClaimEvent);
const decodeV1 = S.decodeUnknownEffect(KbClaimsV1Row);
const decodeAssertion = S.decodeUnknownEffect(Assertion);
const decodeAssertionV1 = S.decodeUnknownEffect(KbAssertionV1Row);
const encodeEvent = S.encodeEffect(S.fromJsonString(KbClaimEvent));

/**
 * Turn one frozen v1 row into retained historical facts; the digest names the stored bytes.
 *
 * @category transformations
 * @since 0.0.0
 */
export const importKbClaimRow = Effect.fnUntraced(function* (line: string, row: typeof KbClaimsV1Row.Type) {
  const payloadDigest = yield* lineDigest(line);
  return KbLegacyImported.make({
    version: "legacy-claim-import/v1",
    ledger: "kb",
    oldId: row.id,
    payloadDigest,
    proposition: row.proposition,
    logicalKey: row.logicalKey,
    originalKnowledge: row.knowledge,
    validTime: row.validTime,
    supportRefs: row.supportedBy,
    challengeRefs: row.challengedBy,
    predecessor: row.supersedes,
    review: row.review,
    signals: KbEvidenceSignals.make(row.signals),
    missingFacts: legacyMissingFacts,
  });
});

/**
 * Decode one claims.jsonl line by its declared format: v2 events by tag, untagged rows as frozen v1.
 *
 * @category parsing
 * @since 0.0.0
 */
export const decodeKbClaimLine = Effect.fnUntraced(function* (line: string, json: unknown) {
  if (isClaimEvent(json)) {
    const event = yield* decodeEvent(json);
    return eventLine<KbLegacyImported, KbCoreEvent, KbReviewState, KbEvidenceSignals>(event);
  }
  const row = yield* decodeV1(json);
  const imported = yield* importKbClaimRow(line, row);
  return { _tag: "Claim", entry: { _tag: "Imported", row: imported } } satisfies KbClaimLine;
});

/**
 * Decode one assertions.jsonl line; a v1 claimId becomes an explicit imported kb reference.
 *
 * @category parsing
 * @since 0.0.0
 */
export const decodeKbAssertionLine = Effect.fnUntraced(function* (json: unknown) {
  if (isAssertionV2(json)) return yield* decodeAssertion(json);
  const { claimId, ...row } = yield* decodeAssertionV1(json);
  return Assertion.make({ ...row, claim: ClaimReference.cases.Imported.make({ ledger: "kb", oldId: claimId }) });
});

const toView = (joined: JoinedClaim<KbLegacyImported, KbCoreEvent, KbReviewState, KbEvidenceSignals>): KbClaim =>
  KbClaim.make({
    source: joined.entry.row,
    reference: joined.reference,
    predecessor: joined.predecessor,
    evidence: joined.evidence,
    review: joined.review,
    signals: joined.signals,
    knowledge: ClaimKnowledgeInterval.make(joined.knowledge),
    valid: joined.valid,
  });

const proposed = KbReviewState.cases.Proposed.make({});

/**
 * Verify every native core, resolve the whole history and join each claim with its records.
 *
 * @category projections
 * @since 0.0.0
 */
export const joinKbClaims = Effect.fnUntraced(function* (lines: ReadonlyArray<KbClaimLine>) {
  const joined = yield* readClaimHistory({ ledger: "kb", lines, proposed, mint: kbArrows.mint });
  return A.map(joined, toView);
});

/**
 * Check v2 events against the existing history and encode them as v2 lines only.
 *
 * @category persistence
 * @since 0.0.0
 */
export const planKbAppend = Effect.fnUntraced(function* (
  existing: ReadonlyArray<KbClaimLine>,
  events: ReadonlyArray<KbClaimEvent>
) {
  yield* checkAppend({
    ledger: "kb",
    existing,
    added: A.map(events, (event) => eventLine<KbLegacyImported, KbCoreEvent, KbReviewState, KbEvidenceSignals>(event)),
    proposed,
    mint: kbArrows.mint,
    appendClaim: kbArrows.appendClaim,
  });
  return yield* Effect.forEach(events, (event) => encodeEvent(event), { concurrency: 1 });
});
