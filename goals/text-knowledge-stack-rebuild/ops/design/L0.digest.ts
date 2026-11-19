/**
 * L0 digest: one digest format with a brand per domain, the shared set codec,
 * the well-formed text and instant primitives, the one minting function, and
 * the activity id minted from start-time facts.
 *
 * Owner packages (decision 2026-11-19-p0-l0-split-by-dependency): the digest
 * brands, `CanonicalHashSet`, `WellFormedText` and `Instant` are owned by
 * `@beep/schema`; `mintContentHash` and the activity id minting by
 * `@beep/jsonc`, the one canonical-JSON owner. Both packages depend on
 * `@beep/identity`, so this file may import the identity-owned `TermIri`;
 * `L0.identity.ts` never imports from here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { TermIri } from "./L0.identity.ts";
import type { JsoncCanonicalizeError, JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type * as Digest from "effect/crypto/Digest";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L0.digest");

/** Well-formed non-empty text: no lone UTF-16 surrogate, so RFC 8785 canonicalization accepts it. */
export const WellFormedText = S.NonEmptyString.check(
  S.isPattern(
    /^(?:[\u0000-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/,
    $I.annote("WellFormedTextPattern", {
      title: "Well-Formed Text",
      description: "Text made of complete UTF-16 scalar sequences.",
      message: "Expected text without lone UTF-16 surrogates.",
    })
  )
).pipe($I.annoteSchema("WellFormedText", { description: "Non-empty text with no lone surrogate." }));

/** Decoded type of {@link WellFormedText}. */
export type WellFormedText = typeof WellFormedText.Type;

/** The one digest format of every minted identifier: `sha256:` plus 64 lowercase hex, branded over the existing prefixed digest. */
export const ContentHash = Sha256PrefixedDigest.pipe(
  S.brand("ContentHash"),
  $I.annoteSchema("ContentHash", {
    description: "A content-addressed identifier: the SHA-256 digest of a versioned, domain-tagged canonical preimage.",
  })
);

/** Decoded type of {@link ContentHash}. */
export type ContentHash = typeof ContentHash.Type;

/** A versioned domain tag such as `occurrence/v1`; it is the first element of every preimage. */
export const DomainTag = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9-]*\/v[1-9][0-9]*$/,
    $I.annote("DomainTagPattern", {
      title: "Domain Tag",
      description: "A lowercase domain name, a slash and a positive version number.",
      message: "Expected a domain tag of the form <domain>/v<n>.",
    })
  )
).pipe(
  S.brand("DomainTag"),
  $I.annoteSchema("DomainTag", {
    description: "The versioned domain separator hashed as the head of every content-hash preimage.",
  })
);

/** Decoded type of {@link DomainTag}. */
export type DomainTag = typeof DomainTag.Type;

/** The id of a `prov:Activity` run, referenced by annotation attribution, claims and operations. */
export const ActivityId = ContentHash.pipe(
  S.brand("ActivityId"),
  $I.annoteSchema("ActivityId", {
    description:
      "Content hash identifying one prov:Activity run (minted by L5, or by the OA import for imported activities).",
  })
);

/** Decoded type of {@link ActivityId}. */
export type ActivityId = typeof ActivityId.Type;

/** A point in time at millisecond precision, matching the millisecond `int8range` storage (decision item 9). */
export const Instant = S.DateTimeUtcFromMillis.pipe(
  $I.annoteSchema("Instant", {
    description: "A UTC instant encoded as epoch milliseconds.",
  })
);

/** Decoded type of {@link Instant}. */
export type Instant = typeof Instant.Type;

/**
 * A set carrier whose encoded side is the sorted array of its members, so a
 * preimage built from its encoding is independent of insertion order (L0-2).
 */
export const CanonicalHashSet = <Item extends S.Top & { readonly Type: string }>(item: Item) =>
  S.Array(item).pipe(
    S.decodeTo(
      item.pipe(S.toType, S.HashSet),
      SchemaTransformation.transform({
        decode: (values: ReadonlyArray<Item["Type"]>) => HashSet.fromIterable(values),
        encode: (set: HashSet.HashSet<Item["Type"]>): ReadonlyArray<Item["Type"]> =>
          A.sort(A.fromIterable(set), Order.String),
      })
    )
  );

/** Members of a string-valued set as a deduplicated, sorted array: the only form a set takes inside a preimage. */
export const sortedMembers = <Item extends string>(members: Iterable<Item>): ReadonlyArray<Item> =>
  A.sort(A.fromIterable(HashSet.fromIterable(members)), Order.String);

/**
 * The one minting function. The canonical bytes are the RFC 8785 form of
 * `[domainTag, ...preimage]`, produced by the single owner `JsoncFingerprint`.
 * Every set-valued field in `preimage` must already be sorted.
 */
export const mintContentHash = Effect.fn("ContentHash.mint")(function* (
  domainTag: DomainTag,
  preimage: ReadonlyArray<unknown>
): Effect.fn.Return<ContentHash, JsoncCanonicalizeError, Digest.Digest> {
  const hex = yield* JsoncFingerprint.hash(A.prepend(preimage, domainTag));
  return ContentHash.make(`sha256:${hex}`);
});

/**
 * The same minting function over a caller-supplied pure SHA-256, for property
 * generators and law tests that cannot run the `Digest` service.
 */
export const mintContentHashResult =
  (digest: JsoncDigest) =>
  (domainTag: DomainTag, preimage: ReadonlyArray<unknown>): Result.Result<ContentHash, JsoncCanonicalizeError> =>
    Result.map(JsoncFingerprint.hashResult(A.prepend(preimage, domainTag), digest), (hex) =>
      ContentHash.make(`sha256:${hex}`)
    );

/** The agent or engine pin a run was associated with: a model pin, or an engine edition. */
export const ActivityPin = S.TaggedUnion({
  Engine: { engine: WellFormedText, edition: WellFormedText },
  Model: { model: WellFormedText, version: WellFormedText },
}).pipe($I.annoteSchema("ActivityPin", { description: "Model pin or engine edition of an activity run." }));

/** Decoded type of {@link ActivityPin}. */
export type ActivityPin = typeof ActivityPin.Type;

/** The fields of an activity known when it starts; the ActivityId hashes exactly these (decision 2026-11-19-p0-activity-id-minted-at-start). */
export const ActivityStartFields = {
  operation: TermIri.annotateKey({ description: "Registry term naming the operation." }),
  pin: ActivityPin,
  promptDigest: S.OptionFromOptionalKey(Sha256PrefixedDigest).annotateKey({
    description: "Digest of the prompt, when the run is a model call.",
  }),
  used: CanonicalHashSet(ContentHash).annotateKey({ description: "Entities the run read." }),
  started: Instant,
};

/** What is known when a run starts. */
export class ActivityStart extends S.Opaque<ActivityStart, { readonly brand: unique symbol }>()(
  S.Struct(ActivityStartFields).pipe(
    $I.annoteSchema("ActivityStart", { description: "Start-time facts of one activity run." })
  )
) {}

/** The start-time fields of any record that carries them (an ActivityStart or an L5 Activity). */
export type ActivityStartView = S.Struct.Type<typeof ActivityStartFields>;

/** Domain tag of a native activity id. */
export const ActivityDomainTag = DomainTag.make("activity/v1");

/**
 * The native activity preimage after the domain tag: (operation, pin, prompt
 * digest or null, sorted used ids, start millis). What the run generated and
 * when it ended stay outside the id, so output ids can name the activity.
 */
export const activityPreimage = (start: ActivityStartView): ReadonlyArray<unknown> => [
  start.operation,
  start.pin,
  O.getOrNull(start.promptDigest),
  sortedMembers(start.used),
  DateTime.toEpochMillis(start.started),
];

/** Mint the id of a native activity run. */
export const mintActivityId = Effect.fn("Activity.mint")(function* (
  start: ActivityStartView
): Effect.fn.Return<ActivityId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(ActivityDomainTag, activityPreimage(start));
  return ActivityId.make(hash);
});
