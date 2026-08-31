/**
 * Specification sources and references used by conformance metadata.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Result } from "effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { LiteralKit } from "../LiteralKit/index.ts";
import { LocalDateFromString } from "../LocalDate/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { Sha256Hex } from "../Sha256.ts";
import { URLStr } from "../URL.ts";

const $I = $SchemaId.create("Conformance/source");

/**
 * Full immutable Git object identifier using the widely deployed SHA-1 or SHA-256 widths.
 *
 * **Example** (Decode a Git object identifier)
 *
 * ```ts import.meta.vitest name="Decode a Git object identifier"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { GitObjectId } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(GitObjectId)("1ed08f66df016a18c6d7d56bd97aa778912cb37b")
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category specifications
 * @since 0.0.0
 */
export const GitObjectId = S.String.check(S.isPattern(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i)).pipe(
  $I.annoteSchema("GitObjectId", {
    description: "Full 40- or 64-hexadecimal Git object identifier.",
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
const ValidCalendarDate = S.makeFilter((value: string) => Result.isSuccess(decodeLocalDate(value)), {
  identifier: $I`ValidCalendarDate`,
  title: "Valid ISO calendar date",
  description: "The YYYY-MM-DD value denotes a possible Gregorian calendar date.",
  message: "Expected a valid ISO calendar date in YYYY-MM-DD form",
});

/**
 * Valid ISO calendar date retained as its canonical `YYYY-MM-DD` string.
 *
 * **Example** (Reject an impossible calendar date)
 *
 * ```ts import.meta.vitest name="Reject an impossible calendar date"
 * import { Result } from "effect"
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

class GitCommitRevision extends S.Class<GitCommitRevision>($I`GitCommitRevision`)(
  {
    kind: S.tag("gitCommit"),
    repository: URLStr,
    commit: GitObjectId,
  },
  $I.annote("GitCommitRevision", {
    description: "Specification revision pinned to an immutable source-control commit.",
  })
) {}

class ReleaseRevision extends S.Class<ReleaseRevision>($I`ReleaseRevision`)(
  {
    kind: S.tag("release"),
    version: S.NonEmptyString,
  },
  $I.annote("ReleaseRevision", {
    description: "Specification revision identified by a published release label.",
  })
) {}

class DatedSnapshotRevision extends S.Class<DatedSnapshotRevision>($I`DatedSnapshotRevision`)(
  {
    kind: S.tag("datedSnapshot"),
    date: SpecificationDate,
  },
  $I.annote("DatedSnapshotRevision", {
    description: "Specification revision identified by the authority's snapshot date.",
  })
) {}

class RegistryVersionRevision extends S.Class<RegistryVersionRevision>($I`RegistryVersionRevision`)(
  {
    kind: S.tag("registryVersion"),
    registry: S.NonEmptyString,
    version: S.NonEmptyString,
  },
  $I.annote("RegistryVersionRevision", {
    description: "Specification revision identified by a named registry and registry version.",
  })
) {}

class RetrievedSnapshotRevision extends S.Class<RetrievedSnapshotRevision>($I`RetrievedSnapshotRevision`)(
  {
    kind: S.tag("retrievedSnapshot"),
    retrievedOn: SpecificationDate,
  },
  $I.annote("RetrievedSnapshotRevision", {
    description: "Unversioned specification snapshot identified by its retrieval date.",
  })
) {}

class PackageRevision extends S.Class<PackageRevision>($I`PackageRevision`)(
  {
    kind: S.tag("packageRevision"),
    packageName: S.NonEmptyString,
    version: S.NonEmptyString,
  },
  $I.annote("PackageRevision", {
    description: "Implementation reference pinned to a package name and package version.",
  })
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
 * import { Result } from "effect"
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
 * import { Result } from "effect"
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
export class SpecificationSource extends S.Class<SpecificationSource>($I`SpecificationSource`)(
  {
    id: S.NonEmptyString,
    title: S.NonEmptyString,
    role: SpecificationSourceRole,
    canonicalUrl: URLStr,
    revision: SpecificationRevision,
    contentSha256: Sha256Hex,
    license: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    scope: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SpecificationSource", {
    description: "Immutable authority record used to ground conformance claims.",
  })
) {
  static readonly toEquivalenceArray = SpecificationSource.pipe(S.Array, SchemaUtils.toEquivalence);
}

/**
 * Locator from an invariant to a section of a registered authority.
 *
 * **Example** (Decode a section reference)
 *
 * ```ts import.meta.vitest name="Decode a section reference"
 * import { Result } from "effect"
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
export class SpecificationReference extends S.Class<SpecificationReference>($I`SpecificationReference`)(
  {
    sourceId: S.NonEmptyString,
    section: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(URLStr).pipe(SchemaUtils.withNoneDefault),
    localRef: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SpecificationReference", {
    description: "Locator from an invariant to a section of a registered authority.",
  })
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
