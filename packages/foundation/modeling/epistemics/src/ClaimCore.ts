/**
 * Checked claim identity and promotion arrows over caller-bound core ingredients.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchorVerificationReceipt, toTextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ValidTime } from "./Claim/index.ts";
import { ClaimId, makeClaimRecords } from "./ClaimCore.schema.ts";
import { ClaimLogEntry, ClaimLogViolation } from "./ClaimLog.schema.ts";
import { appendProjection, checkClaimLog } from "./ClaimLog.ts";
import type { AnnotationDocumentView } from "@beep/annotation/AnnotationDocument";
import type { AnnotationId } from "@beep/annotation/AnnotationId";
import type { VerifiedTextAnchor } from "@beep/text/VerifiedTextAnchor";
import type { AppendResult } from "./ClaimLog.schema.ts";
import type { SchemaIdentity } from "./Factory/index.ts";

const $I = $EpistemicsId.create("ClaimCore");
const sameSource = S.toEquivalence(SourceTextIdentity);
const sameReceipt = S.toEquivalence(TextAnchorVerificationReceipt);
const CoreRefusal = LiteralKit([
  "invalid-core",
  "invalid-record",
  "key-mismatch",
  "invalid-creation-support",
  "generation-mismatch",
]).pipe($I.annoteSchema("CoreRefusal", { description: "Sanitized reasons a core boundary refuses input." }));

/**
 * A sanitized core-boundary failure; input text and schema issue details do not escape.
 *
 * **Example** (Describe an invalid record)
 *
 * ```ts
 * import { ClaimCoreInvalid } from "@beep/epistemics/ClaimCore"
 * console.log(ClaimCoreInvalid.make({ reason: "invalid-record" }).reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimCoreInvalid extends S.TaggedError<ClaimCoreInvalid, { readonly brand: unique symbol }>(
  $I.make("ClaimCoreInvalid")
)(
  "ClaimCoreInvalid",
  { reason: CoreRefusal },
  $I.annote("ClaimCoreInvalid", { description: "A refused claim identity or creation boundary." })
) {}

/**
 * The declared one-core claim/v1 canonical JSON preimage and independent golden vector.
 *
 * **Example** (Read the identity version)
 *
 * ```ts
 * import { ClaimPreimage } from "@beep/epistemics/ClaimCore"
 * console.log(ClaimPreimage.domainTag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimPreimage = definePreimage({
  domainTag: DomainTag.make("claim/v1"),
  schema: S.Tuple([S.Json]),
  golden: {
    preimage: [
      {
        proposition: "synthetic",
        logicalKey: "synthetic",
        supportAtCreation: [],
        derivedFrom: [],
        generatedBy: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        assertedBy: { _tag: "Person", principal: "fixture" },
        valid: { _tag: "Unknown" },
        knowledgeStart: 1000,
        scope: "fixture",
      },
    ],
    hash: ContentHash.make("sha256:46578e04e3c49d614eb84edcabfef46126c96f7de4b50ee98a25a8b138106cd7"),
  },
});

const CoreView = S.Struct({
  logicalKey: S.NonEmptyString,
  scope: S.Union([S.String, S.Finite]),
  supportAtCreation: S.HashSet(OccurrenceId),
  derivedFrom: S.HashSet(ClaimId),
  supersedes: S.OptionFromOptionalKey(ClaimId),
  generatedBy: ActivityId,
  knowledgeStart: S.DateTimeUtcFromMillis,
  valid: ValidTime,
}).pipe(
  $I.annoteSchema("CoreView", {
    description: "The fields read by checked claim arrows; caller fields retain their own codecs.",
  })
);

/**
 * Bind mint, checked codecs, promotion and immutable append to actual owner schemas.
 *
 * **Details**
 * Promotion checks selected annotations and runtime verified anchors against their
 * document. Annotation generation times may be absent; the native claim generation
 * is separately explicit. A checked decode re-mints the encoded core before returning.
 *
 * **Example** (Bind checked identity arrows)
 *
 * ```ts
 * import { makeClaimArrows } from "@beep/epistemics/ClaimCore"
 * import { makeClaimCore } from "@beep/epistemics/ClaimCore.schema"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const binding = makeClaimCore({ $I: $ScratchpadId.create("Claims"), proposition: S.NonEmptyString,
 *   ids: { logicalKey: (p) => p, scope: S.NonEmptyString, principal: S.NonEmptyString,
 *     action: S.NonEmptyString, revision: S.NonEmptyString } })
 * console.log(typeof makeClaimArrows(binding).mint)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimArrows = <
  CoreCodec extends S.Top & {
    readonly Type: typeof CoreView.Type;
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
>(binding: {
  readonly $I: SchemaIdentity;
  readonly ClaimCore: CoreCodec;
}) => {
  const { ClaimRecord, ProposedClaimRecord } = makeClaimRecords({ $I: binding.$I, core: binding.ClaimCore });
  type Core = CoreCodec["Type"];
  type Record = typeof ClaimRecord.Type;
  const CoreJson = S.toCodecJson(binding.ClaimCore);
  const RecordJson = S.toCodecJson(ClaimRecord);
  const invalidCore = () => ClaimCoreInvalid.make({ reason: "invalid-core" });
  const invalidRecord = () => ClaimCoreInvalid.make({ reason: "invalid-record" });
  const encodeCore = S.encodeEffect(CoreJson);
  const decodeRecord = S.decodeUnknownEffect(RecordJson);
  const encodeRecord = S.encodeEffect(RecordJson);
  const mint = Effect.fn("ClaimCore.mint")(function* (core: Core) {
    const encoded = yield* encodeCore(core).pipe(Effect.mapError(invalidCore));
    const hash = yield* ClaimPreimage.mint([encoded]);
    yield* Effect.annotateCurrentSpan({
      "claim.id": hash,
      "claim.support_count": HashSet.size(core.supportAtCreation),
      "claim.parent_count": HashSet.size(core.derivedFrom),
    });
    return ClaimId.make(hash);
  });
  const decodeClaimRecord = Effect.fn("ClaimCore.decodeChecked")(function* (input: unknown) {
    const record = yield* decodeRecord(input).pipe(Effect.mapError(invalidRecord));
    yield* Effect.annotateCurrentSpan("claim.id", record.claim);
    const claim = yield* mint(record.core);
    if (!Eq.equals(claim, record.claim)) return yield* ClaimCoreInvalid.make({ reason: "key-mismatch" });
    return record;
  });
  const encodeClaimRecord = Effect.fn("ClaimCore.encodeChecked")(function* (record: Record) {
    const claim = yield* mint(record.core);
    if (!Eq.equals(claim, record.claim)) return yield* ClaimCoreInvalid.make({ reason: "key-mismatch" });
    return yield* encodeRecord(record).pipe(Effect.mapError(invalidRecord));
  });
  const appendClaim = Effect.fn("ClaimCore.append")(function* (
    log: ReadonlyArray<ClaimLogEntry>,
    record: Record,
    generation: { readonly activity: ActivityId; readonly at: DateTime.Utc }
  ) {
    const violations = checkClaimLog(log);
    if (A.isReadonlyArrayNonEmpty(violations)) return { _tag: "Refused", log, violations } satisfies AppendResult;
    const claim = yield* mint(record.core);
    if (!Eq.equals(claim, record.claim))
      return {
        _tag: "Refused",
        log,
        violations: [ClaimLogViolation.cases.CoreKeyMismatch.make({ claim: record.claim })],
      } satisfies AppendResult;
    if (!Eq.equals(record.core.generatedBy, generation.activity))
      return yield* ClaimCoreInvalid.make({ reason: "generation-mismatch" });
    return appendProjection(log, ClaimLogEntry.make({ ...record.core, claim, generatedAt: generation.at }));
  });
  const promote = Effect.fn("ClaimCore.promote")(function* (options: {
    readonly core: Core;
    readonly document: AnnotationDocumentView;
    readonly candidates: HashSet.HashSet<AnnotationId>;
    readonly verified: ReadonlyArray<VerifiedTextAnchor>;
    readonly generation: { readonly activity: ActivityId; readonly at: DateTime.Utc };
  }) {
    const { core, document, candidates, verified, generation } = options;
    yield* Effect.annotateCurrentSpan({
      "claim.support_count": HashSet.size(core.supportAtCreation),
      "claim.candidate_count": HashSet.size(candidates),
      "claim.verified_anchor_count": verified.length,
    });
    if (
      !Eq.equals(core.generatedBy, generation.activity) ||
      DateTime.isGreaterThan(generation.at, core.knowledgeStart)
    ) {
      return yield* ClaimCoreInvalid.make({ reason: "generation-mismatch" });
    }
    let targets = HashSet.empty<import("@beep/text/Occurrence").OccurrenceId>();
    for (const candidate of candidates) {
      const annotation = HashMap.get(document.annotations, candidate);
      if (O.isNone(annotation)) return yield* ClaimCoreInvalid.make({ reason: "invalid-creation-support" });
      targets = HashSet.union(targets, annotation.value.targets);
    }
    const receipts = yield* Effect.forEach(
      verified,
      (proof) =>
        Effect.gen(function* () {
          const receipt = toTextAnchorVerificationReceipt(proof);
          const occurrence = yield* mintOccurrenceId(Anchored.make({ receipt }));
          const stored = HashMap.get(document.anchors, occurrence);
          if (
            !sameSource(receipt.source, document.text) ||
            !O.exists(stored, (stored) => sameReceipt(stored.receipt, receipt))
          ) {
            return yield* ClaimCoreInvalid.make({ reason: "invalid-creation-support" });
          }
          return occurrence;
        }),
      { concurrency: 1 }
    );
    const occurrences = HashSet.fromIterable(receipts);
    if (!HashSet.isSubset(core.supportAtCreation, targets) || !HashSet.isSubset(core.supportAtCreation, occurrences)) {
      return yield* ClaimCoreInvalid.make({ reason: "invalid-creation-support" });
    }
    const claim = yield* mint(core);
    return { claim, core, stance: "proposed" } satisfies typeof ProposedClaimRecord.Type;
  });
  return { mint, decodeClaimRecord, encodeClaimRecord, appendClaim, promote };
};

/**
 * Immutable claim schema ingredients.
 *
 * **Example** (Read stance variants)
 *
 * ```ts
 * import { Stance } from "@beep/epistemics/ClaimCore"
 * console.log(Stance.literals)
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./ClaimCore.schema.ts";
