import * as Domain from "@alchemy.run/domain";
import { CapabilityId } from "@proto/kernel/Ids";
import { carry, Provenance } from "@proto/kernel/Invocation";
import { Text } from "@proto/kernel/Measure";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import * as A from "@beep/utils/Array";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "@beep/utils/Str";
import { ClaimId } from "./Claim.id.ts";

/**
 * Why a merge did not happen: re-admission refused (for the reason the
 * authority context gave), the merge vetoed, or a missing grant on a
 * capability.
 *
 * @category models
 * @since 0.0.0
 */
export const MergeRefusal = S.TaggedUnion({
  Readmission: { reason: ReadmissionRefused.fields.reason },
  // Vetoed also holds phase 2 text that did not parse, so its reason is free text.
  Vetoed: { reason: Text },
  MissingGrant: { capability: CapabilityId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type MergeRefusal = typeof MergeRefusal.Type;

/**
 * A refusal as a line of text, the form phase 2 stored: `readmission:<r>`,
 * `vetoed:<r>` or `missing-grant:<capability>`.
 *
 * @category getters
 * @since 0.0.0
 */
export const renderMergeRefusal: (refusal: MergeRefusal) => string = MergeRefusal.match({
  Readmission: ({ reason }) => `readmission:${reason}`,
  Vetoed: ({ reason }) => `vetoed:${reason}`,
  MissingGrant: ({ capability }) => `missing-grant:${capability}`,
});

const isReadmissionReason = S.is(ReadmissionRefused.fields.reason);
const isCapabilityId = S.is(CapabilityId);

/** A line that names no known kind, or a detail its kind does not hold, reads as vetoed, the whole line its reason. */
const parseMergeRefusal = (text: string): MergeRefusal => {
  const [kind = "", ...rest] = pipe(text, Str.split(":"));
  const detail = A.join(rest, ":");
  const unparsed = () => MergeRefusal.cases.Vetoed.make({ reason: text });
  return Match.value(kind).pipe(
    Match.when("readmission", () =>
      isReadmissionReason(detail) ? MergeRefusal.cases.Readmission.make({ reason: detail }) : unparsed(),
    ),
    Match.when("missing-grant", () =>
      isCapabilityId(detail) ? MergeRefusal.cases.MissingGrant.make({ capability: detail }) : unparsed(),
    ),
    Match.when("vetoed", () => MergeRefusal.cases.Vetoed.make({ reason: detail })),
    Match.orElse(unparsed),
  );
};

/**
 * A stored reason in either form: the structured one written since phase 3,
 * or phase 2's line of text, parsed on read (D22). Writes use the structured
 * form; stored text is never rewritten.
 *
 * @category models
 * @since 0.0.0
 */
export const StoredMergeRefusal = S.Union([
  MergeRefusal,
  Text.pipe(
    S.decodeTo(S.toType(MergeRefusal), {
      decode: SchemaGetter.transform(parseMergeRefusal),
      encode: SchemaGetter.transform(renderMergeRefusal),
    }),
  ),
]);

/**
 * The fact: the merge an accepted `SameParty` claim implies did not happen,
 * and why (re-admission refused, merge vetoed, or no grant).
 *
 * @category events
 * @since 0.0.0
 */
export class MergeRefused extends Domain.Event("MergeRefused", carry({ reason: StoredMergeRefusal }), { description: "The merge an accepted same-party claim implies did not happen, and why: re-admission was refused, the merge was vetoed, or a grant was missing." }) {}

/**
 * Record a refused merge on the claim. Sent only by the model's own merge
 * policy, with the provenance it acted on; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class RecordMergeRefused extends Domain.Command(
  "RecordMergeRefused",
  { target: ClaimId, input: { reason: MergeRefusal, provenance: Provenance }, events: [MergeRefused] },
  { description: "Record that an accepted claim's merge was refused." },
) {}
