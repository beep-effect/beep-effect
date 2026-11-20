/**
 * Specification sources and references used by conformance metadata.
 *
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { $SchemaId } from "../internal/SchemaId.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import { LocalDateFromString } from "../LocalDate/index.ts";
import { Sha256Hex } from "../Sha256.ts";
import { URLStr } from "../URL.ts";

const $I = $SchemaId.create("Conformance/source");

/**
 * Full immutable Git object identifier using the widely deployed SHA-1 or SHA-256 widths.
 *
 * **Example** (Decode a Git object identifier)
 *
 * ```ts import.meta.vitest name="Decode a Git object identifier"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { GitObjectId } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(GitObjectId)("1ed08f66df016a18c6d7d56bd97aa778912cb37b")
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Decoded object identifiers use lowercase hexadecimal text so one Git object has one encoded identity.
 * @category specifications
 * @since 0.0.0
 */
export const GitObjectId = S.String.check(
  S.isPattern(
    /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/,
    $I.annote("GitObjectIdPattern", {
      title: "Canonical Git object identifier",
      description: "A full lowercase hexadecimal Git object identifier with SHA-1 or SHA-256 width.",
    })
  )
).pipe(
  $I.annoteSchema("GitObjectId", {
    description: "Canonical lowercase full 40- or 64-hexadecimal Git object identifier.",
  })
);

/**
 * String value accepted by {@link GitObjectId}.
 *
 * @category specifications
 * @since 0.0.0
 */
export type GitObjectId = typeof GitObjectId.Type;

const decodeLocalDate = S.decodeUnknownResult(LocalDateFromString);
const ValidCalendarDate = S.makeFilter(
  (value: string) => Result.isSuccess(decodeLocalDate(value)),
  $I.annote("ValidCalendarDate", {
    title: "Valid ISO calendar date",
    description: "The YYYY-MM-DD value denotes a possible Gregorian calendar date.",
    message: "Expected a valid ISO calendar date in YYYY-MM-DD form",
  })
);

/**
 * Valid ISO calendar date retained as its canonical `YYYY-MM-DD` string.
 *
 * **Example** (Reject an impossible calendar date)
 *
 * ```ts import.meta.vitest name="Reject an impossible calendar date"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { SpecificationDate } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(SpecificationDate)("2026-02-30")
 * Result.isFailure(result) // => true
 * ```
 *
 * @category specifications
 * @since 0.0.0
 */
export const SpecificationDate = S.String.check(
  S.makeFilterGroup([S.isPattern(/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/), ValidCalendarDate])
).pipe(
  $I.annoteSchema("SpecificationDate", {
    description: "Valid ISO Gregorian calendar date retained as a canonical YYYY-MM-DD string.",
  })
);

/**
 * String value accepted by {@link SpecificationDate}.
 *
 * @category specifications
 * @since 0.0.0
 */
export type SpecificationDate = typeof SpecificationDate.Type;

/**
 * Semantic role an authority plays in a conformance profile.
 *
 * **Example** (Recognize a normative source role)
 *
 * ```ts import.meta.vitest name="Recognize a normative source role"
 * import { SpecificationSourceRole } from "@beep/schema/Conformance"
 *
 * SpecificationSourceRole.is.primarySpecification("primarySpecification") // => true
 * SpecificationSourceRole.is.primarySpecification("blogPost") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpecificationSourceRole = LiteralKit([
  "primarySpecification",
  "normativeDependency",
  "conformanceCorpus",
  "bestPractice",
  "implementationReference",
  "registry",
]).pipe(
  $I.annoteSchema("SpecificationSourceRole", {
    description: "Semantic role an authority plays in a conformance profile.",
  })
);

/**
 * Runtime value accepted by {@link SpecificationSourceRole}.
 *
 * @see {@link SpecificationSourceRole} for membership helpers and decoding.
 * @category models
 * @since 0.0.0
 */
export type SpecificationSourceRole = typeof SpecificationSourceRole.Type;

const SpecificationRevisionKind = LiteralKit([
  "gitCommit",
  "release",
  "datedSnapshot",
  "registryVersion",
  "retrievedSnapshot",
  "packageRevision",
]);

/**
 * Specification revision pinned to an immutable source-control commit.
 *
 * **Example** (Pin a specification to a Git commit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GitCommitRevision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = S.decodeUnknownSync(GitCommitRevision)({
 *   kind: "gitCommit",
 *   repository: "https://github.com/commonmark/commonmark-spec",
 *   commit: "0123456789abcdef0123456789abcdef01234567"
 * })
 *
 * console.log(revisionLabel(revision).startsWith("gitCommit:https%3A%2F%2Fgithub.com")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GitCommitRevision extends S.Opaque<GitCommitRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("gitCommit"),
    repository: URLStr,
    commit: GitObjectId,
  }).pipe(
    $I.annoteSchema("GitCommitRevision", {
      description: "Specification revision pinned to an immutable source-control commit.",
    })
  )
) {}

/**
 * Specification revision identified by a published release label.
 *
 * **Example** (Pin a specification to a tagged release)
 *
 * ```ts
 * import { ReleaseRevision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = ReleaseRevision.make({ version: "0.31.2" })
 *
 * console.log(revisionLabel(revision)) // => "release:0.31.2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReleaseRevision extends S.Opaque<ReleaseRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("release"),
    version: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ReleaseRevision", {
      description: "Specification revision identified by a published release label.",
    })
  )
) {}

/**
 * Specification revision identified by the authority's snapshot date.
 *
 * **Example** (Pin a living standard to its dated snapshot)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DatedSnapshotRevision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = S.decodeUnknownSync(DatedSnapshotRevision)({ kind: "datedSnapshot", date: "2026-09-30" })
 *
 * console.log(revisionLabel(revision)) // => "datedSnapshot:2026-09-30"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DatedSnapshotRevision extends S.Opaque<DatedSnapshotRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("datedSnapshot"),
    date: SpecificationDate,
  }).pipe(
    $I.annoteSchema("DatedSnapshotRevision", {
      description: "Specification revision identified by the authority's snapshot date.",
    })
  )
) {}

/**
 * Specification revision identified by a named registry and registry version.
 *
 * **Example** (Pin a registry entry such as an IANA table)
 *
 * ```ts
 * import { RegistryVersionRevision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = RegistryVersionRevision.make({ registry: "iana-media-types", version: "2026-08-12" })
 *
 * console.log(revisionLabel(revision)) // => "registryVersion:iana-media-types@2026-08-12"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryVersionRevision extends S.Opaque<RegistryVersionRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("registryVersion"),
    registry: S.NonEmptyString,
    version: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RegistryVersionRevision", {
      description: "Specification revision identified by a named registry and registry version.",
    })
  )
) {}

/**
 * Unversioned specification snapshot identified by its retrieval date.
 *
 * **Example** (Pin an unversioned page to the day it was fetched)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RetrievedSnapshotRevision } from "@beep/schema/Conformance"
 *
 * const revision = S.decodeUnknownSync(RetrievedSnapshotRevision)({ kind: "retrievedSnapshot", retrievedOn: "2026-10-01" })
 *
 * console.log(revision.retrievedOn) // => "2026-10-01"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetrievedSnapshotRevision extends S.Opaque<RetrievedSnapshotRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("retrievedSnapshot"),
    retrievedOn: SpecificationDate,
  }).pipe(
    $I.annoteSchema("RetrievedSnapshotRevision", {
      description: "Unversioned specification snapshot identified by its retrieval date.",
    })
  )
) {}

/**
 * Implementation reference pinned to a package name and package version.
 *
 * **Example** (Pin a reference implementation package)
 *
 * ```ts
 * import { PackageRevision, Revision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = PackageRevision.make({ packageName: "@effect/platform", version: "4.0.0" })
 *
 * console.log(Revision.guards.packageRevision(revision)) // => true
 * console.log(revisionLabel(revision)) // => "packageRevision:%40effect%2Fplatform@4.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageRevision extends S.Opaque<PackageRevision, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("packageRevision"),
    packageName: S.NonEmptyString,
    version: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("PackageRevision", {
      description: "Implementation reference pinned to a package name and package version.",
    })
  )
) {}

/**
 * Discriminated revision identity for an authoritative source.
 *
 * **Details**
 *
 * Each revision kind requires the fields that make that pin reproducible. A
 * release cannot accidentally masquerade as a commit, registry version, or
 * retrieval-only snapshot.
 *
 * **Example** (Decode a release revision)
 *
 * ```ts import.meta.vitest name="Decode a release revision"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { Revision } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Revision)({
 *   kind: "release",
 *   version: "0.31.2"
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpecificationRevision = SpecificationRevisionKind.mapMembers(
  Tuple.evolve([
    () => GitCommitRevision,
    () => ReleaseRevision,
    () => DatedSnapshotRevision,
    () => RegistryVersionRevision,
    () => RetrievedSnapshotRevision,
    () => PackageRevision,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("SpecificationRevision", {
    description: "Discriminated revision identity for an authoritative source.",
  })
);

/**
 * Runtime revision represented by {@link SpecificationRevision}.
 *
 * @see {@link SpecificationRevision} for case constructors and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type SpecificationRevision = typeof SpecificationRevision.Type;

/**
 * Immutable authority record used to ground conformance claims.
 *
 * **Example** (Decode a pinned specification source)
 *
 * ```ts import.meta.vitest name="Decode a pinned specification source"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { Source } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Source)({
 *   id: "commonmark-0.31.2",
 *   title: "CommonMark 0.31.2",
 *   role: "primarySpecification",
 *   canonicalUrl: "https://spec.commonmark.org/0.31.2/",
 *   revision: { kind: "release", version: "0.31.2" },
 *   contentSha256: "bfef4ddc97276b6ab6c2a28ace48478e35b1c50e60cde9f517ab8ab030aa3b82"
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpecificationSource extends S.Opaque<SpecificationSource, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    title: S.NonEmptyString,
    role: SpecificationSourceRole,
    canonicalUrl: URLStr,
    revision: SpecificationRevision,
    contentSha256: Sha256Hex,
    license: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    scope: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("SpecificationSource", {
      description: "Immutable authority record used to ground conformance claims.",
    })
  )
) {}

/**
 * Locator from an invariant to a section of a registered authority.
 *
 * **Example** (Decode a section reference)
 *
 * ```ts import.meta.vitest name="Decode a section reference"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { Reference } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Reference)({
 *   sourceId: "whatwg-html",
 *   section: "The h1, h2, h3, h4, h5, and h6 elements",
 *   url: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements"
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpecificationReference extends S.Opaque<SpecificationReference, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceId: S.NonEmptyString,
    section: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    url: S.OptionFromOptionalKey(URLStr).pipe(S.withConstructorDefault(Effect.succeedNone)),
    localRef: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("SpecificationReference", {
      description: "Locator from an invariant to a section of a registered authority.",
    })
  )
) {}

/**
 * Produce a stable human-readable revision label for RDF and documentation adapters.
 *
 * **Example** (Format a release label)
 *
 * ```ts import.meta.vitest name="Format a release label"
 * import { Revision, revisionLabel } from "@beep/schema/Conformance"
 *
 * const revision = Revision.cases.release.make({
 *   version: "0.31.2"
 * })
 *
 * revisionLabel(revision) // => "release:0.31.2"
 * ```
 *
 * @param revision - Typed source revision to format.
 * @returns Collision-resistant label retaining the revision discriminator and all identity fields.
 * @invariant Distinct revision variants cannot collapse to the same label through discriminator loss.
 * @category formatting
 * @since 0.0.0
 */
export const revisionLabel = (revision: SpecificationRevision): string =>
  SpecificationRevision.match(revision, {
    gitCommit: ({ commit, repository }) =>
      `gitCommit:${globalThis.encodeURIComponent(repository)}#${globalThis.encodeURIComponent(commit)}`,
    release: ({ version }) => `release:${globalThis.encodeURIComponent(version)}`,
    datedSnapshot: ({ date }) => `datedSnapshot:${globalThis.encodeURIComponent(date)}`,
    registryVersion: ({ registry, version }) =>
      `registryVersion:${globalThis.encodeURIComponent(registry)}@${globalThis.encodeURIComponent(version)}`,
    retrievedSnapshot: ({ retrievedOn }) => `retrievedSnapshot:${globalThis.encodeURIComponent(retrievedOn)}`,
    packageRevision: ({ packageName, version }) =>
      `packageRevision:${globalThis.encodeURIComponent(packageName)}@${globalThis.encodeURIComponent(version)}`,
  });
