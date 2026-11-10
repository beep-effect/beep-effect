/**
 * Schemas for the github-headroom parcel: the host ledger view it reduces
 * from, and the per-bucket item it serves.
 *
 * **Details**
 *
 * This library depends on neither the GitHub driver nor the repo CLI, so it
 * owns its input contract and checks names by pattern. The CLI maps its
 * GitHub budget ledger's readings, reserve signals and summary into
 * {@link GithubHeadroomInput}. Identity names are bucket-owner labels such as
 * `user:octocat` or `app:1/2`, never tokens.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Freshness } from "./Freshness.ts";
import { ParcelSource } from "./Parcel.models.ts";

const $I = $PalantiriId.create("GithubHeadroom.models");

/**
 * The owner of a GitHub rate-limit bucket as the ledger labels it, such as
 * `user:octocat`, `app:1/2`, `anonymous`, or `token:` and a 12-hex token hash.
 *
 * **Example** (Guard an identity name)
 *
 * ```ts
 * import { GithubIdentityName } from "@beep/palantiri/GithubHeadroom.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubIdentityName)("user:octocat")) // true
 * console.log(S.is(GithubIdentityName)("ghp token")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubIdentityName = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9:/._-]{0,79}$/i,
    $I.annote("GithubIdentityNamePattern", {
      title: "GitHub identity name",
      description: "A bucket-owner label: letters, digits, colon, slash, dot, underscore or hyphen.",
      message: "a GitHub identity name is a bucket-owner label such as user:octocat",
    })
  )
).pipe($I.annoteSchema("GithubIdentityName", { description: "Owner label of one GitHub rate-limit bucket." }));

/**
 * Runtime type for {@link GithubIdentityName}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubIdentityName = typeof GithubIdentityName.Type;

/**
 * A GitHub rate-limit resource name, such as `core`, `graphql` or `search`.
 *
 * **Example** (Guard a bucket name)
 *
 * ```ts
 * import { GithubBucketName } from "@beep/palantiri/GithubHeadroom.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubBucketName)("code_search")) // true
 * console.log(S.is(GithubBucketName)("Core")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubBucketName = S.String.check(
  S.isPattern(
    /^[a-z][a-z_]{0,39}$/,
    $I.annote("GithubBucketNamePattern", {
      title: "GitHub bucket name",
      description: "Lowercase letters and underscores, starting with a letter.",
      message: "a GitHub bucket name uses lowercase letters and underscores",
    })
  )
).pipe($I.annoteSchema("GithubBucketName", { description: "GitHub rate-limit resource name." }));

/**
 * Runtime type for {@link GithubBucketName}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubBucketName = typeof GithubBucketName.Type;

/**
 * The reserve state as the ledger's reserve signal computed it: above the
 * floor, below it, or unknown.
 *
 * **Details**
 *
 * The parcel prints a reserve verdict only from this value, never from its
 * own arithmetic, so it never shows a verdict the reserve signal does not
 * hold.
 *
 * **Example** (Narrow a reserve state)
 *
 * ```ts
 * import { GithubReserveName } from "@beep/palantiri/GithubHeadroom.models"
 *
 * console.log(GithubReserveName.is.below("below")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubReserveName = LiteralKit(["clear", "below", "unknown"]).pipe(
  $I.annoteSchema("GithubReserveName", {
    description: "A bucket's reserve state as the ledger's reserve signal computed it.",
  })
);

/**
 * Runtime type for {@link GithubReserveName}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubReserveName = typeof GithubReserveName.Type;

/**
 * Where a bucket reading came from: a response header the transport saw, or
 * a `/rate_limit` sample.
 *
 * **Example** (Narrow a reading basis)
 *
 * ```ts
 * import { GithubReadingBasis } from "@beep/palantiri/GithubHeadroom.models"
 *
 * console.log(GithubReadingBasis.Enum.sample) // "sample"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubReadingBasis = LiteralKit(["transport", "sample"]).pipe(
  $I.annoteSchema("GithubReadingBasis", {
    description: "Whether a bucket reading came from a response header or a /rate_limit sample.",
  })
);

/**
 * Runtime type for {@link GithubReadingBasis}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubReadingBasis = typeof GithubReadingBasis.Type;

/**
 * What one beep command spent on GitHub in the summary's last hour.
 *
 * **Example** (Make a spender)
 *
 * ```ts
 * import { GithubSpender } from "@beep/palantiri/GithubHeadroom.models"
 *
 * const spender = GithubSpender.make({ command: "yeet monitor", requests: 40, estimatedPoints: 812, ghSpawns: 0 })
 * console.log(spender.estimatedPoints) // 812
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubSpender extends S.Opaque<GithubSpender, { readonly brand: unique symbol }>()(
  S.Struct({ command: S.NonEmptyString, requests: S.Int, estimatedPoints: S.Int, ghSpawns: S.Int }).pipe(
    $I.annoteSchema("GithubSpender", {
      description: "One beep command's GitHub requests, estimated points and gh spawns in the last hour.",
    })
  )
) {}

/**
 * The newest reading of one identity × resource bucket, with the reserve
 * state the ledger computed for it.
 *
 * **Details**
 *
 * `used` is GitHub's `used` header, or `limit − remaining` when absent.
 * `unattributedLastHour` is the bucket's usage in the last complete hour that
 * no recorded request explains, or `None` when that hour was not measurable.
 *
 * **Example** (Make a bucket input)
 *
 * ```ts
 * import { GithubHeadroomBucketInput } from "@beep/palantiri/GithubHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const bucket = GithubHeadroomBucketInput.make({
 *   identity: "user:octocat",
 *   resource: "core",
 *   limit: 5000,
 *   remaining: 3120,
 *   used: 1880,
 *   resetsAt: DateTime.makeUnsafe("2026-11-10T21:31:00Z"),
 *   asOf: DateTime.makeUnsafe("2026-11-10T21:00:00Z"),
 *   basis: "transport",
 *   reserve: "clear",
 *   reserveFloor: 750,
 *   unattributedLastHour: O.none()
 * })
 * console.log(bucket.remaining) // 3120
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubHeadroomBucketInput extends S.Opaque<GithubHeadroomBucketInput, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: GithubIdentityName,
    resource: GithubBucketName,
    limit: S.Int,
    remaining: S.Int,
    used: S.Int,
    resetsAt: S.DateTimeUtcFromString,
    asOf: S.DateTimeUtcFromString,
    basis: GithubReadingBasis,
    reserve: GithubReserveName,
    reserveFloor: S.Int,
    unattributedLastHour: S.OptionFromNullOr(S.Int),
  }).pipe(
    $I.annoteSchema("GithubHeadroomBucketInput", {
      description: "The newest reading of one GitHub bucket and the reserve state the ledger computed for it.",
    })
  )
) {}

/**
 * What the github-headroom parcel reduces: this host's GitHub budget ledger,
 * or its absence.
 *
 * **Details**
 *
 * `Missing` means the host has no ledger to read (no ledger directory, or
 * nothing recorded yet). `Present` carries the newest reading of every
 * bucket the ledger knows, and the spenders of the precomputed summary with
 * that summary's time; `summaryAsOf` is `None` when no summary exists.
 *
 * **Example** (Make a missing input)
 *
 * ```ts
 * import { GithubHeadroomInput } from "@beep/palantiri/GithubHeadroom.models"
 *
 * console.log(GithubHeadroomInput.cases.Missing.make({ detail: "no ledger on this host" })._tag) // "Missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubHeadroomInput = S.TaggedUnion({
  Missing: { detail: S.String },
  Present: {
    generatedAt: S.DateTimeUtcFromString,
    buckets: S.Array(GithubHeadroomBucketInput),
    spenders: S.Array(GithubSpender),
    summaryAsOf: S.OptionFromNullOr(S.DateTimeUtcFromString),
    lastRowAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  },
}).pipe(
  $I.annoteSchema("GithubHeadroomInput", {
    description: "This host's GitHub budget ledger as the github-headroom parcel reads it, or its absence.",
  })
);

/**
 * Runtime type for {@link GithubHeadroomInput}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubHeadroomInput = typeof GithubHeadroomInput.Type;

/**
 * Github-headroom parcel item: one identity × resource bucket, with its own
 * freshness and the reserve state the ledger computed.
 *
 * **Details**
 *
 * `freshness` is `Fresh` when the reading is within the parcel's 15-minute
 * bound and `Unknown{stale}` when older. A stale item keeps its numbers, but
 * the parcel summary never presents them as current headroom.
 *
 * **Example** (Make a headroom item)
 *
 * ```ts
 * import { GithubHeadroom } from "@beep/palantiri/GithubHeadroom.models"
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const asOf = DateTime.makeUnsafe("2026-11-10T21:00:00Z")
 * const item = GithubHeadroom.make({
 *   identity: "user:octocat",
 *   resource: "graphql",
 *   limit: 5000,
 *   remaining: 412,
 *   resetsAt: DateTime.makeUnsafe("2026-11-10T21:40:00Z"),
 *   reserve: "below",
 *   reserveFloor: 750,
 *   asOf: O.some(asOf),
 *   freshness: Freshness.cases.Fresh.make({ asOf }),
 *   sources: ["github-ledger"],
 *   unattributedLastHour: O.none()
 * })
 * console.log(item._tag) // "GithubHeadroom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubHeadroom extends S.Opaque<GithubHeadroom, { readonly brand: unique symbol }>()(
  S.TaggedStruct("GithubHeadroom", {
    identity: GithubIdentityName,
    resource: GithubBucketName,
    limit: S.Int,
    remaining: S.Int,
    resetsAt: S.DateTimeUtcFromString,
    reserve: GithubReserveName,
    reserveFloor: S.Int,
    asOf: S.OptionFromNullOr(S.DateTimeUtcFromString),
    freshness: Freshness,
    sources: S.NonEmptyArray(ParcelSource),
    unattributedLastHour: S.OptionFromNullOr(S.Int),
  }).pipe(
    $I.annoteSchema("GithubHeadroom", {
      description: "One GitHub rate-limit bucket's remaining requests, reset time and reserve state.",
    })
  )
) {}
