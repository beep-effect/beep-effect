/**
 * Read codecs for citation receipts held outside the process: the live
 * `citation-document-receipt/v4` and `citation-mention-receipt/v2`, and the
 * frozen v3 and v1 forms converted to them on read.
 *
 * **Details**
 *
 * The frozen schemas type only what the conversion reads or rewrites, with
 * their own `cm1`, `ca1`, `cl1` and `cg1` templates, and pass every other
 * encoded field through. The conversion recomputes every stored `cm1` with the
 * pinned v1 encoder and refuses a mismatch, mints the `cm2` id over the
 * mention's `OccurrenceId`, re-keys the case-occurrence authorities it finds by
 * their v1 key, follows the default group and list ids of those authorities,
 * rewrites every reference and refuses a dangling one. The live schema then
 * decodes the result, so its coherence filter runs. Encoding a frozen form is
 * forbidden: writes are always the live versions.
 *
 * A converted receipt grants no proof. Restoration re-verifies the source text
 * and every anchor and re-mints every id.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocumentReceipt, CitationMentionReceipt } from "@beep/law-practice-domain/values";
import { Sha256Hex } from "@beep/schema";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeCaseOccurrenceAuthorityId } from "./AuthorityIdentity.ts";
import { mintCitationMentionId } from "./MentionIdentity.ts";
import {
  CitationAuthorityIdV1,
  CitationMentionIdV1,
  caseOccurrenceKeyV1,
  citationMentionIdV1,
} from "./MentionIdentityV1.ts";
import type { CitationMentionId } from "@beep/law-practice-domain/values";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/ReceiptRead");

const Rest = [S.Record(S.String, S.Unknown)] as const;
const CitationMemberListIdV1 = S.TemplateLiteral(["cl1:", Sha256Hex]);
const CitationResourceGroupIdV1 = S.TemplateLiteral(["cg1:", Sha256Hex]);

const MemberV3 = S.Union([
  S.StructWithRest(S.TaggedStruct("Mention", { mentionId: CitationMentionIdV1 }), Rest),
  S.StructWithRest(S.TaggedStruct("Detached", {}), Rest),
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MemberV3", { description: "Frozen group member of a v3 receipt; detached members pass through." })
);

const WarningV3 = S.StructWithRest(S.Struct({ previousMentionId: CitationMentionIdV1 }), Rest);

const MentionReceiptV1 = S.StructWithRest(
  S.Struct({
    schemaVersion: S.tag("citation-mention-receipt/v1"),
    id: CitationMentionIdV1,
    engineArtifact: Sha256Hex,
    citation: S.StructWithRest(S.Struct({ type: S.NonEmptyString }), Rest),
    anchor: TextAnchorVerificationReceipt,
    warnings: S.Array(WarningV3),
  }),
  Rest
).pipe(
  $I.annoteSchema("MentionReceiptV1", {
    description:
      "Frozen citation-mention-receipt/v1: the fields the cm1 check and the v2 id read, the rest passed through.",
  })
);

const DocumentReceiptV3 = S.StructWithRest(
  S.Struct({
    schemaVersion: S.tag("citation-document-receipt/v3"),
    authorities: S.Array(
      S.StructWithRest(S.Struct({ id: CitationAuthorityIdV1, representative: S.NullOr(MemberV3) }), Rest)
    ),
    resolutions: S.Array(
      S.StructWithRest(
        S.Struct({
          mentionId: CitationMentionIdV1,
          authorityId: S.optionalKey(CitationAuthorityIdV1),
          candidateAuthorityIds: CitationAuthorityIdV1.pipe(S.Array, S.optionalKey),
        }),
        Rest
      )
    ),
    groups: S.Array(
      S.StructWithRest(
        S.Struct({
          id: CitationResourceGroupIdV1,
          authorityId: CitationAuthorityIdV1,
          memberListId: CitationMemberListIdV1,
        }),
        Rest
      )
    ),
    memberLists: S.Array(S.StructWithRest(S.Struct({ id: CitationMemberListIdV1, members: S.Array(MemberV3) }), Rest)),
    mentions: S.Array(MentionReceiptV1),
  }),
  Rest
).pipe(
  $I.annoteSchema("DocumentReceiptV3", {
    description:
      "Frozen citation-document-receipt/v3: version tags and every id position under frozen templates, the rest passed through.",
  })
);

type MentionReceiptV1 = typeof MentionReceiptV1.Type;
type MemberV3 = typeof MemberV3.Type;

const issue = (message: string) => new SchemaIssue.InvalidValue({ message });
const unmintable = () => issue("A v1 citation mention could not be recomputed or minted under citation-mention/v2.");

// Steps 1 and 2 for one mention: the stored cm1 must be its own recomputation, then the cm2 id is minted.
const convertMentionId = Effect.fnUntraced(function* (
  mention: MentionReceiptV1
): Effect.fn.Return<readonly [typeof CitationMentionIdV1.Type, CitationMentionId], SchemaIssue.Issue, Digest.Digest> {
  const recomputed = yield* citationMentionIdV1(mention.anchor, mention.engineArtifact, mention.citation.type).pipe(
    Effect.mapError(unmintable)
  );
  if (recomputed !== mention.id)
    return yield* Effect.fail(issue("A stored cm1 mention id is not the recomputation of its own receipt."));
  const id = yield* mintCitationMentionId(mention.anchor, mention.engineArtifact, mention.citation.type).pipe(
    Effect.mapError(unmintable)
  );
  return Tuple.make(mention.id, id);
});

const liveDocument = S.decodeUnknownEffect(CitationDocumentReceipt);
const liveMention = S.decodeUnknownEffect(CitationMentionReceipt);
const issueOf = (error: S.SchemaError) => error.issue;
const suffix = Str.slice(4);

const convertDocumentV3 = Effect.fnUntraced(function* (
  v3: typeof DocumentReceiptV3.Type
): Effect.fn.Return<CitationDocumentReceipt, SchemaIssue.Issue, Digest.Digest> {
  const pairs = yield* Effect.forEach(v3.mentions, convertMentionId, { concurrency: 1 });
  const mentionIds = HashMap.fromIterable(pairs);
  const stored = HashSet.fromIterable(A.map(v3.authorities, (authority) => authority.id));
  // Step 3: an authority whose id is the v1 case-occurrence key of a mention takes the v2 key over its new id.
  const rekeyed = yield* Effect.forEach(
    pairs,
    Effect.fnUntraced(function* ([previous, next]) {
      const key = yield* caseOccurrenceKeyV1(previous);
      if (!HashSet.has(stored, key)) return O.none<readonly [string, string]>();
      const authority = yield* makeCaseOccurrenceAuthorityId(next);
      return O.some(Tuple.make(key, authority));
    }, Effect.mapError(unmintable)),
    { concurrency: 1 }
  );
  const authorityIds = HashMap.fromIterable(A.getSomes(rekeyed));
  // Step 4: a default group or list id is its authority's digest under another prefix; it follows that digest.
  const digests = HashMap.fromIterable(
    authorityIds.pipe(
      HashMap.toEntries,
      A.map(([previous, next]) => Tuple.make(suffix(previous), suffix(next)))
    )
  );
  const nodeId = (id: string) =>
    O.match(HashMap.get(digests, suffix(id)), {
      onNone: () => id,
      onSome: (digest) => `${Str.slice(0, 4)(id)}${digest}`,
    });
  const authorityId = (id: string) => O.getOrElse(HashMap.get(authorityIds, id), () => id);
  // Step 5: every reference goes through the maps; a mention reference that names no mention is refused.
  const mentionId = (id: typeof CitationMentionIdV1.Type) =>
    Effect.fromOption(HashMap.get(mentionIds, id)).pipe(
      Effect.mapError(() => issue("A v3 receipt references a mention it does not hold."))
    );
  const member = (value: MemberV3) =>
    MemberV3.match(value, {
      Mention: (mention) => Effect.map(mentionId(mention.mentionId), (id) => ({ ...mention, mentionId: id })),
      Detached: Effect.succeed,
    });
  const authorities = yield* Effect.forEach(
    v3.authorities,
    Effect.fnUntraced(function* (authority) {
      const representative = authority.representative === null ? null : yield* member(authority.representative);
      return { ...authority, id: authorityId(authority.id), representative };
    }),
    { concurrency: 1 }
  );
  const resolutions = yield* Effect.forEach(
    v3.resolutions,
    Effect.fnUntraced(function* (resolution) {
      const rewritten = { ...resolution, mentionId: yield* mentionId(resolution.mentionId) };
      return {
        ...rewritten,
        ...O.match(O.fromUndefinedOr(resolution.authorityId), {
          onNone: () => ({}),
          onSome: (id) => ({ authorityId: authorityId(id) }),
        }),
        ...O.match(O.fromUndefinedOr(resolution.candidateAuthorityIds), {
          onNone: () => ({}),
          onSome: (ids) => ({ candidateAuthorityIds: A.map(ids, authorityId) }),
        }),
      };
    }),
    { concurrency: 1 }
  );
  const groups = A.map(v3.groups, (group) => ({
    ...group,
    id: nodeId(group.id),
    authorityId: authorityId(group.authorityId),
    memberListId: nodeId(group.memberListId),
  }));
  const memberLists = yield* Effect.forEach(
    v3.memberLists,
    Effect.fnUntraced(function* (list) {
      const members = yield* Effect.forEach(list.members, member, { concurrency: 1 });
      return { ...list, id: nodeId(list.id), members };
    }),
    { concurrency: 1 }
  );
  const mentions = yield* Effect.forEach(
    v3.mentions,
    Effect.fnUntraced(function* (mention) {
      const warnings = yield* Effect.forEach(
        mention.warnings,
        Effect.fnUntraced(function* (warning) {
          return { ...warning, previousMentionId: yield* mentionId(warning.previousMentionId) };
        }),
        { concurrency: 1 }
      );
      return {
        ...mention,
        schemaVersion: "citation-mention-receipt/v2",
        id: yield* mentionId(mention.id),
        warnings,
      };
    }),
    { concurrency: 1 }
  );
  // Step 6 sets the tags; the live schema then runs its coherence filter over the result.
  return yield* liveDocument({
    ...v3,
    schemaVersion: "citation-document-receipt/v4",
    authorities,
    resolutions,
    groups,
    memberLists,
    mentions,
  }).pipe(Effect.mapError(issueOf));
});

// Steps 1, 2 and 6 for a standalone mention receipt. A warning would name a mention this receipt cannot map.
const convertMentionV1 = Effect.fnUntraced(function* (
  v1: MentionReceiptV1
): Effect.fn.Return<CitationMentionReceipt, SchemaIssue.Issue, Digest.Digest> {
  if (A.isReadonlyArrayNonEmpty(v1.warnings))
    return yield* Effect.fail(issue("A standalone v1 mention receipt references other mentions."));
  const [, id] = yield* convertMentionId(v1);
  return yield* liveMention({ ...v1, schemaVersion: "citation-mention-receipt/v2", id }).pipe(Effect.mapError(issueOf));
});

const DocumentFromV3 = DocumentReceiptV3.pipe(
  S.decodeTo(S.toType(CitationDocumentReceipt), {
    decode: SchemaGetter.transformEffect(convertDocumentV3),
    encode: SchemaGetter.forbidden(constant("citation-document-receipt/v3 is read only")),
  })
);

const MentionFromV1 = MentionReceiptV1.pipe(
  S.decodeTo(S.toType(CitationMentionReceipt), {
    decode: SchemaGetter.transformEffect(convertMentionV1),
    encode: SchemaGetter.forbidden(constant("citation-mention-receipt/v1 is read only")),
  })
);

/**
 * Read codec of a stored citation document receipt: v4 as is, v3 converted.
 * Decoding requires `Digest.Digest`; encoding always writes v4.
 *
 * @internal
 * @category codecs
 * @since 0.0.0
 */
export const CitationDocumentReceiptRead = S.Union([CitationDocumentReceipt, DocumentFromV3]).pipe(
  $I.annoteSchema("CitationDocumentReceiptRead", {
    description: "Live v4 document receipt, or a frozen v3 receipt converted to v4 on read; never encodes v3.",
  })
);

/**
 * Read codec of a stored standalone mention receipt: v2 as is, v1 converted.
 * A v1 receipt with warnings is refused. Encoding always writes v2.
 *
 * @internal
 * @category codecs
 * @since 0.0.0
 */
export const CitationMentionReceiptRead = S.Union([CitationMentionReceipt, MentionFromV1]).pipe(
  $I.annoteSchema("CitationMentionReceiptRead", {
    description: "Live v2 mention receipt, or a frozen v1 receipt converted to v2 on read; never encodes v1.",
  })
);

/**
 * Sanitized failure of a receipt read: the input is not a readable receipt.
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationReceiptReadFailure extends S.TaggedError<
  CitationReceiptReadFailure,
  { readonly brand: unique symbol }
>($I`CitationReceiptReadFailure`)(
  "CitationReceiptReadFailure",
  {},
  $I.annoteError<CitationReceiptReadFailure>("CitationReceiptReadFailure", {
    description: "A stored receipt did not decode or convert; no source text, schema issue or cause is retained.",
  })
) {}

const readFailure = () => CitationReceiptReadFailure.make({});

/**
 * Read a citation document receipt that comes from outside the process.
 * The result is structural; restore it against the source text before use.
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const readCitationDocumentReceipt = Effect.fn("Citation.readDocumentReceipt")(function* (
  input: unknown
): Effect.fn.Return<CitationDocumentReceipt, CitationReceiptReadFailure, Digest.Digest> {
  return yield* S.decodeUnknownEffect(CitationDocumentReceiptRead)(input).pipe(Effect.mapError(readFailure));
});

/**
 * Read a standalone citation mention receipt that comes from outside the
 * process. The result is structural; restore it before use.
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const readCitationMentionReceipt = Effect.fn("Citation.readMentionReceipt")(function* (
  input: unknown
): Effect.fn.Return<CitationMentionReceipt, CitationReceiptReadFailure, Digest.Digest> {
  return yield* S.decodeUnknownEffect(CitationMentionReceiptRead)(input).pipe(Effect.mapError(readFailure));
});
