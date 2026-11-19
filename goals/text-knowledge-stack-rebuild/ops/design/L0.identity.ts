/**
 * L0 identity: one digest format with a brand per domain, the one minting
 * function, declared terms, namespaces, term bindings and the stability
 * snapshot.
 *
 * Target homes (decision 2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc):
 * `@beep/identity` owns terms, namespaces, the registry, `TermBinding` and the
 * snapshot; `@beep/schema` owns the digest primitive; `@beep/jsonc` owns
 * canonical JSON and `mintContentHash`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SafePnLocal, SafePnPrefix } from "@beep/identity/PnLocal";
import { $RepoCliId } from "@beep/identity/packages";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
// P1 moves the RFC 3987 schemas into @beep/identity; the design module reads them from their current home.
import { IRI } from "@beep/rdf/Iri";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type { JsoncCanonicalizeError, JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type * as Digest from "effect/crypto/Digest";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L0.identity");

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

/** A published term IRI, declared in the registry under `https://beep-effect.com/ns/` and never derived from a code path. */
export const TermIri = IRI.pipe(
  S.brand("TermIri"),
  $I.annoteSchema("TermIri", { description: "A registry-declared term IRI." })
);

/** Decoded type of {@link TermIri}. */
export type TermIri = typeof TermIri.Type;

/** The compile-checked code identity of a kind, `@beep/<package>/<path>`, as an `$I` composer prints it. */
export const CodeId = S.String.check(
  S.isPattern(
    /^@beep\/[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)+$/,
    $I.annote("CodeIdPattern", {
      title: "Code Identity",
      description: "A @beep package name followed by at least one module path segment.",
      message: "Expected a code identity of the form @beep/<package>/<path>.",
    })
  )
).pipe(S.brand("CodeId"), $I.annoteSchema("CodeId", { description: "A code-path identity for a kind." }));

/** Decoded type of {@link CodeId}. */
export type CodeId = typeof CodeId.Type;

/** A row of the binding table that pins a code identity to its published term; a module rename edits `code`, never `term`. */
export class TermBinding extends S.Opaque<TermBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    code: CodeId.annotateKey({ description: "Code identity of the kind today." }),
    term: TermIri.annotateKey({ description: "Published term the code identity is bound to." }),
    since: SemanticVersion.annotateKey({ description: "Package version that first published the binding." }),
  }).pipe(
    $I.annoteSchema("TermBinding", {
      description: "Data-table binding from a code identity to a published term IRI.",
    })
  )
) {}

/**
 * A structural SPDX short-license-id brand for a pinned external vocabulary.
 *
 * **Gotchas**
 *
 * Known gap: `@beep/identity` depends on effect only and cannot import
 * `@beep/spdx`, so this brand checks the identifier grammar, not the SPDX list.
 * The L0 registry test validates every namespace license against `@beep/spdx`
 * as a test dependency.
 */
export const SpdxLicenseId = S.String.check(
  S.isPattern(
    /^[A-Za-z0-9][A-Za-z0-9.+-]*$/,
    $I.annote("SpdxLicenseIdPattern", {
      title: "SPDX License Identifier",
      description: "An SPDX short license identifier such as CC-BY-4.0 or W3C-20150513.",
      message: "Expected an SPDX short license identifier.",
    })
  )
).pipe(S.brand("SpdxLicenseId"), $I.annoteSchema("SpdxLicenseId", { description: "An SPDX license id." }));

/** Decoded type of {@link SpdxLicenseId}. */
export type SpdxLicenseId = typeof SpdxLicenseId.Type;

/** Where a pinned vocabulary was fetched from and at which revision. */
export class PinnedSource extends S.Opaque<PinnedSource, { readonly brand: unique symbol }>()(
  S.Struct({
    location: IRI.annotateKey({ description: "Retrieval IRI of the vocabulary artifact." }),
    revision: S.NonEmptyString.annotateKey({ description: "Upstream revision, tag or edition the pin names." }),
  }).pipe($I.annoteSchema("PinnedSource", { description: "Retrieval location and revision of a pinned vocabulary." }))
) {}

/** One registry namespace: every prefix the repo speaks is declared here with its pin, license, version and digest. */
export class Namespace extends S.Opaque<Namespace, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: SafePnPrefix.annotateKey({ description: "CURIE prefix, for example prov or oa." }),
    iri: IRI.annotateKey({ description: "Namespace IRI the prefix expands to." }),
    source: PinnedSource,
    license: SpdxLicenseId.annotateKey({ description: "License of the vocabulary artifact." }),
    version: S.NonEmptyString.annotateKey({ description: "Vocabulary version as published upstream." }),
    digest: Sha256PrefixedDigest.annotateKey({ description: "Digest of the pinned vocabulary artifact bytes." }),
  }).pipe($I.annoteSchema("Namespace", { description: "A pinned registry namespace." }))
) {}

/** gUFO type-of-type a class term is declared as (ruling 3). */
export const GufoClassType = LiteralKit([
  "Kind",
  "SubKind",
  "Role",
  "Phase",
  "Category",
  "Mixin",
  "RoleMixin",
  "PhaseMixin",
]).pipe(
  $I.annoteSchema("GufoClassType", {
    description: "The gUFO type-of-type a class term is declared as, used only by the L3 audit.",
  })
);

/** Decoded type of {@link GufoClassType}. */
export type GufoClassType = typeof GufoClassType.Type;

/** gUFO category of the instances of a class term (ruling 3). */
export const GufoInstanceCategory = LiteralKit(["Object", "Relator", "Mode", "Quality", "Event"]).pipe(
  $I.annoteSchema("GufoInstanceCategory", {
    description: "Whether the instances of a class are objects, relators, modes, qualities or events.",
  })
);

/** Decoded type of {@link GufoInstanceCategory}. */
export type GufoInstanceCategory = typeof GufoInstanceCategory.Type;

/** The optional gUFO typing of a class term: type of type, instance category, and for a Relator the roles it mediates. */
export class GufoTyping extends S.Opaque<GufoTyping, { readonly brand: unique symbol }>()(
  S.Struct({
    typeOfType: GufoClassType,
    instanceCategory: GufoInstanceCategory,
    mediates: TermIri.pipe(CanonicalHashSet, S.OptionFromOptionalKey).annotateKey({
      description: "Role terms a Relator class mediates; present only for Relator.",
    }),
  })
    .check(
      S.makeFilter(
        (typing: { readonly instanceCategory: GufoInstanceCategory; readonly mediates: O.Option<unknown> }) =>
          (typing.instanceCategory === "Relator") === O.isSome(typing.mediates),
        $I.annote("GufoMediatesCheck", {
          title: "Relator Mediation",
          description: "mediates is present exactly when the instance category is Relator.",
          message: "Expected mediates for a Relator class and only for one.",
        })
      )
    )
    .pipe($I.annoteSchema("GufoTyping", { description: "gUFO class typing read by the L3 audit." }))
) {}

/** The record that alone may change a published term. */
export class Deprecation extends S.Opaque<Deprecation, { readonly brand: unique symbol }>()(
  S.Struct({
    since: SemanticVersion.annotateKey({ description: "Version that deprecated the term." }),
    reason: S.NonEmptyString.annotateKey({ description: "Why the term was deprecated." }),
    replacedBy: S.OptionFromOptionalKey(TermIri).annotateKey({ description: "Successor term, when one exists." }),
  }).pipe($I.annoteSchema("Deprecation", { description: "A dated term deprecation with its optional successor." }))
) {}

/** One declared term of a registry namespace. */
export class Term extends S.Opaque<Term, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: TermIri,
    namespace: SafePnPrefix.annotateKey({ description: "Prefix of the namespace that declares the term." }),
    local: SafePnLocal.annotateKey({ description: "Local name inside the namespace." }),
    gufo: S.OptionFromOptionalKey(GufoTyping).annotateKey({
      description: "gUFO typing for class terms; absent for untyped terms and properties (the audit skips them).",
    }),
    deprecated: S.OptionFromOptionalKey(Deprecation).annotateKey({
      description: "Deprecation record, when the term is deprecated.",
    }),
  }).pipe($I.annoteSchema("Term", { description: "A registry term with optional gUFO typing and deprecation." }))
) {}

/** The term-stability snapshot: the published term set (module-derived IRIs included) and the deprecations that explain removals. */
export class TermSnapshot extends S.Opaque<TermSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("term-snapshot/v1"),
    terms: CanonicalHashSet(TermIri).annotateKey({ description: "Every published term IRI." }),
    deprecations: S.HashMap(TermIri, Deprecation).annotateKey({ description: "Deprecation record per retired term." }),
  }).pipe($I.annoteSchema("TermSnapshot", { description: "Snapshot of the published term set (L0-3)." }))
) {}

/** L0-3: the terms of `previous` that `next` no longer publishes and that no deprecation record in `next` explains. */
export const unexplainedRemovals: {
  (next: TermSnapshot): (previous: TermSnapshot) => HashSet.HashSet<TermIri>;
  (previous: TermSnapshot, next: TermSnapshot): HashSet.HashSet<TermIri>;
} = dual(
  2,
  (previous: TermSnapshot, next: TermSnapshot): HashSet.HashSet<TermIri> =>
    HashSet.filter(HashSet.difference(previous.terms, next.terms), (term) =>
      O.isNone(HashMap.get(next.deprecations, term))
    )
);

/** The agent or engine pin a run was associated with: a model pin, or an engine edition. */
export const ActivityPin = S.TaggedUnion({
  Engine: { engine: WellFormedText, edition: WellFormedText },
  Model: { model: WellFormedText, version: WellFormedText },
}).pipe($I.annoteSchema("ActivityPin", { description: "Model pin or engine edition of an activity run." }));

/** Decoded type of {@link ActivityPin}. */
export type ActivityPin = typeof ActivityPin.Type;

/** The fields of an activity known when it starts; the ActivityId hashes exactly these (ruling 1). */
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
