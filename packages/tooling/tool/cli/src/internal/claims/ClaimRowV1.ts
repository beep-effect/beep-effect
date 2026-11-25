/**
 * The frozen untagged claim-row/v1 wire format written by the CLI ledgers before P4.
 *
 * **Details**
 * Every schema here is a private persistence reader. It reproduces the stored codec field for
 * field, including the review payload and the five-signal carrier whose extractor reading was a
 * measurement only. Nothing outside the Kb and Holds stores may decode or encode it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BasisDigest, ValidTime } from "@beep/epistemics/Claim";
import { KnowledgeInterval } from "@beep/epistemics/KnowledgeInterval";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Measurement, makeSignal } from "@beep/schema/Signal";
import * as S from "effect/Schema";
import type { FieldSchema, SchemaIdentity } from "@beep/epistemics/Factory";

/**
 * Build the frozen claim-row/v1 codec for one owner's proposition and identifier namespaces.
 *
 * @category schemas
 * @since 0.0.0
 */
export const makeClaimsV1Row = <
  P extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
  Row extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
  Evidence extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
  Principal extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
>(config: {
  readonly $I: SchemaIdentity;
  readonly proposition: P;
  readonly logicalKey: (proposition: P["Type"]) => string;
  readonly ids: { readonly row: Row; readonly evidence: Evidence; readonly principal: Principal };
}) => {
  const { $I } = config;
  const proposition: FieldSchema<P["Type"], P["Encoded"]> = config.proposition;
  const ids: {
    readonly row: FieldSchema<Row["Type"], Row["Encoded"]>;
    readonly evidence: FieldSchema<Evidence["Type"], Evidence["Encoded"]>;
    readonly principal: FieldSchema<Principal["Type"], Principal["Encoded"]>;
  } = config.ids;
  const dispositionStruct = <D extends S.Top>(disposition: D) =>
    S.Struct({
      disposition,
      reviewer: ids.principal,
      basis: BasisDigest,
      reviewedAt: S.DateTimeUtcFromMillis,
      reason: S.NonEmptyString,
    });
  const ReviewerDispositionV1 = LiteralKit(["accepted", "rejected", "abstained"]).pipe(
    dispositionStruct,
    $I.annoteSchema("ReviewerDispositionV1", { description: "Frozen v1 reviewer disposition payload." })
  );
  const EvidenceSignalsV1 = S.Struct({
    sourceTrust: makeSignal(LiteralKit(["low", "moderate", "high"])),
    sourceAssertedConfidence: makeSignal(Measurement),
    extractorConfidence: makeSignal(Measurement),
    validator: makeSignal(S.TaggedUnion({ Conforms: {}, Violations: { messages: S.NonEmptyArray(S.String) } })),
    reviewer: makeSignal(ReviewerDispositionV1),
  }).pipe($I.annoteSchema("EvidenceSignalsV1", { description: "Frozen evidence-signals/v1 carrier." }));
  const ReviewStateV1 = S.TaggedUnion({
    Proposed: {},
    Accepted: { disposition: S.Literal("accepted").pipe(dispositionStruct) },
    Rejected: { disposition: S.Literal("rejected").pipe(dispositionStruct) },
    Disputed: { challengedBy: S.NonEmptyArray(ids.evidence), openedAt: S.DateTimeUtcFromMillis },
    Retracted: { reason: S.NonEmptyString, at: S.DateTimeUtcFromMillis },
  }).pipe($I.annoteSchema("ReviewStateV1", { description: "Frozen v1 review payload." }));
  const ClaimsV1Fields = S.Struct({
    id: ids.row,
    logicalKey: S.NonEmptyString,
    proposition,
    supportedBy: S.NonEmptyArray(ids.evidence),
    challengedBy: S.Array(ids.evidence),
    validTime: ValidTime,
    knowledge: KnowledgeInterval,
    supersedes: S.OptionFromNullOr(ids.row),
    review: ReviewStateV1,
    signals: EvidenceSignalsV1,
  });
  const ClaimsV1Row = ClaimsV1Fields.check(
    S.makeFilter(
      (claim: typeof ClaimsV1Fields.Type) => claim.logicalKey === config.logicalKey(claim.proposition),
      $I.annote("ClaimsV1RowLogicalKey", {
        description: "The stored logical key matches the owner key function.",
        message: "Expected logicalKey to match the proposition key.",
      })
    )
  ).pipe($I.annoteSchema("ClaimsV1Row", { description: "One frozen untagged claim-row/v1 line." }));
  return { ClaimsV1Row, ReviewStateV1, EvidenceSignalsV1 };
};
