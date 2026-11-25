/**
 * Private hold-ledger persistence: frozen v1 readers, read-time import and v2-only writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { ClaimReference } from "@beep/epistemics/ClaimImport.schema";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { mintActivityId } from "@beep/jsonc/ActivityStart";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  checkAppend,
  declaresFormat,
  eventLine,
  LineFormat,
  legacyMissingFacts,
  lineDigest,
  namesFormat,
  readClaimHistory,
} from "../../../internal/claims/ClaimHistory.ts";
import { makeClaimsV1Row } from "../../../internal/claims/ClaimRowV1.ts";
import {
  HoldClaim,
  HoldClaimCore,
  HoldClaimEvent,
  HoldCoreEvent,
  HoldCoreRecord,
  HoldEvidenceSignals,
  HoldLegacyImported,
  HoldPrincipalId,
  HoldProposition,
  HoldReviewState,
  holdLogicalKey,
  ProbeRun,
  ProbeRunId,
} from "../Holds.schemas.ts";
import type { ValidTime } from "@beep/epistemics/Claim";
import type { ActivityStart } from "@beep/jsonc/ActivityStart";
import type * as DateTime from "effect/DateTime";
import type { ClaimLine, JoinedClaim } from "../../../internal/claims/ClaimHistory.ts";
import type { HoldAgentRef } from "../Holds.schemas.ts";

const $I = $RepoCliId.create("commands/Holds/internal/HoldStore");
const frozen = makeClaimsV1Row({
  $I,
  proposition: HoldProposition,
  logicalKey: holdLogicalKey,
  ids: { row: S.NonEmptyString, evidence: ProbeRunId, principal: HoldPrincipalId },
});

/**
 * Frozen untagged hold-ledger/claims.jsonl row: the stored hold claim-row/v1 bytes.
 *
 * @category schemas
 * @since 0.0.0
 */
export const HoldClaimsV1Row = frozen.ClaimsV1Row;

const runFields = ProbeRun.fields;

/**
 * Frozen hold-probe-run/v1 row naming its hold by a bare old version id.
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldProbeRunV1Row extends S.Opaque<HoldProbeRunV1Row, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("hold-probe-run/v1"),
    id: runFields.id,
    holdId: runFields.holdId,
    holdVersionId: S.NonEmptyString,
    ranAt: runFields.ranAt,
    commitSha: runFields.commitSha,
    runtime: runFields.runtime,
    controlVersion: runFields.controlVersion,
    control: runFields.control,
    candidateVersion: runFields.candidateVersion,
    candidate: runFields.candidate,
    verdict: runFields.verdict,
  }).pipe($I.annoteSchema("HoldProbeRunV1Row", { description: "One frozen hold-probe-run/v1 line." }))
) {}

/**
 * Content-addressed arrows bound to the hold claim core.
 *
 * @category services
 * @since 0.0.0
 */
export const holdArrows = makeClaimArrows({ $I, ClaimCore: HoldClaimCore });

/**
 * One decoded claims.jsonl line: a stored hold or a separate claim-local record.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldClaimLine = ClaimLine<HoldLegacyImported, HoldCoreEvent, HoldReviewState, HoldEvidenceSignals>;

const isVersioned = namesFormat("version");
const isRunV1 = declaresFormat(LineFormat.make({ key: "schemaVersion", version: "hold-probe-run/v1" }));
const decodeEvent = S.decodeUnknownEffect(HoldClaimEvent);
const decodeV1 = S.decodeUnknownEffect(HoldClaimsV1Row);
const decodeRun = S.decodeUnknownEffect(ProbeRun);
const decodeRunV1 = S.decodeUnknownEffect(HoldProbeRunV1Row);
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeEvent = S.encodeEffect(S.fromJsonString(HoldClaimEvent));

/**
 * Turn one frozen v1 row into retained historical facts; the digest names the stored bytes.
 *
 * @category transformations
 * @since 0.0.0
 */
export const importHoldClaimRow = Effect.fnUntraced(function* (line: string, row: typeof HoldClaimsV1Row.Type) {
  const payloadDigest = yield* lineDigest(line);
  return HoldLegacyImported.make({
    version: "legacy-claim-import/v1",
    ledger: "holds",
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
    signals: HoldEvidenceSignals.make(row.signals),
    missingFacts: legacyMissingFacts,
  });
});

/**
 * Decode one claims.jsonl line by its declared format: versioned lines as exact v2 events, untagged rows as frozen v1.
 *
 * @category parsing
 * @since 0.0.0
 */
export const decodeHoldClaimLine = Effect.fnUntraced(function* (line: string) {
  const json = yield* decodeJson(line);
  if (isVersioned(json)) {
    const event = yield* decodeEvent(json);
    return eventLine<HoldLegacyImported, HoldCoreEvent, HoldReviewState, HoldEvidenceSignals>(event);
  }
  const row = yield* decodeV1(json);
  const imported = yield* importHoldClaimRow(line, row);
  return { _tag: "Claim", entry: { _tag: "Imported", row: imported } } satisfies HoldClaimLine;
});

/**
 * Decode one runs.jsonl line; a v1 holdVersionId becomes an explicit imported holds reference.
 *
 * @category parsing
 * @since 0.0.0
 */
export const decodeProbeRunLine = Effect.fnUntraced(function* (line: string) {
  const json = yield* decodeJson(line);
  if (!isRunV1(json)) return yield* decodeRun(json);
  const { schemaVersion: _format, holdVersionId, ...run } = yield* decodeRunV1(json);
  return ProbeRun.make({
    ...run,
    schemaVersion: "hold-probe-run/v2",
    claim: ClaimReference.cases.Imported.make({ ledger: "holds", oldId: holdVersionId }),
  });
});

const toView = (
  joined: JoinedClaim<HoldLegacyImported, HoldCoreEvent, HoldReviewState, HoldEvidenceSignals>
): HoldClaim =>
  HoldClaim.make({
    source: joined.entry.row,
    reference: joined.reference,
    predecessor: joined.predecessor,
    logicalKey: joined.logicalKey,
    evidence: joined.evidence,
    review: joined.review,
    signals: joined.signals,
    knowledge: ClaimKnowledgeInterval.make(joined.knowledge),
    valid: joined.valid,
  });

const proposed = HoldReviewState.cases.Proposed.make({});

/**
 * Verify every native core, resolve the whole history and join each hold with its records.
 *
 * @category projections
 * @since 0.0.0
 */
export const joinHoldClaims = Effect.fnUntraced(function* (lines: ReadonlyArray<HoldClaimLine>) {
  const joined = yield* readClaimHistory({ ledger: "holds", lines, proposed, mint: holdArrows.mint });
  return A.map(joined, toView);
});

/**
 * Check v2 events against the existing history and encode them as v2 lines only.
 *
 * @category persistence
 * @since 0.0.0
 */
export const planHoldAppend = Effect.fnUntraced(function* (
  existing: ReadonlyArray<HoldClaimLine>,
  events: ReadonlyArray<HoldClaimEvent>
) {
  yield* checkAppend({
    ledger: "holds",
    existing,
    added: A.map(events, (event) =>
      eventLine<HoldLegacyImported, HoldCoreEvent, HoldReviewState, HoldEvidenceSignals>(event)
    ),
    proposed,
    mint: holdArrows.mint,
    appendClaim: holdArrows.appendClaim,
  });
  return yield* Effect.forEach(events, (event) => encodeEvent(event), { concurrency: 1 });
});

const decodeNativeProposition = S.decodeEffect(S.toType(HoldClaimCore.fields.proposition));

/**
 * Build the v2 events of a renewal: a new native core superseding its predecessor.
 *
 * **Details**
 * Every creation fact is explicit: the caller supplies the clock readings, the activity and the
 * asserting agent. A native predecessor is named by the core's own supersedes field; an
 * imported predecessor is linked by a separate succession record, never by a cast id.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeHoldRenewal = Effect.fnUntraced(function* (renewal: {
  readonly predecessor: HoldClaim;
  readonly proposition: HoldProposition;
  readonly lease: ValidTime;
  readonly activity: ActivityStart;
  readonly assertedBy: typeof HoldAgentRef.Type;
  readonly scope: string;
  readonly generatedAt: DateTime.Utc;
  readonly knowledgeStart: DateTime.Utc;
  readonly supportedBy: ReadonlyArray<ProbeRunId>;
}) {
  const proposition = yield* decodeNativeProposition(renewal.proposition);
  const generatedBy = yield* mintActivityId(renewal.activity);
  const native =
    renewal.predecessor.reference._tag === "Native" ? O.some(renewal.predecessor.reference.claim) : O.none();
  const core = HoldClaimCore.make({
    proposition,
    logicalKey: holdLogicalKey(proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: native,
    generatedBy,
    assertedBy: renewal.assertedBy,
    valid: renewal.lease,
    knowledgeStart: renewal.knowledgeStart,
    scope: renewal.scope,
  });
  const claim = yield* holdArrows.mint(core);
  const reference = ClaimReference.cases.Native.make({ claim });
  const coreEvent = HoldCoreEvent.make({
    record: HoldCoreRecord.make({ claim, core }),
    activity: renewal.activity,
    generatedAt: renewal.generatedAt,
  });
  const succession = O.isNone(native)
    ? [
        HoldClaimEvent.cases.Succession.make({
          claim,
          predecessor: renewal.predecessor.reference,
          at: renewal.knowledgeStart,
        }),
      ]
    : [];
  const evidence = A.isReadonlyArrayNonEmpty(renewal.supportedBy)
    ? [
        HoldClaimEvent.cases.Evidence.make({
          claim: reference,
          supportedBy: renewal.supportedBy,
          challengedBy: [],
          at: renewal.knowledgeStart,
        }),
      ]
    : [];
  const events: ReadonlyArray<HoldClaimEvent> = [coreEvent, ...succession, ...evidence];
  return { claim, events };
});
