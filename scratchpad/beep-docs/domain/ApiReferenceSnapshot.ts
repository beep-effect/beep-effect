/**
 * Schemas for the API reference snapshot manifest that pins which website and
 * per-channel git revisions a generated dataset was built from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("beep-docs/domain/ApiReferenceSnapshot");

/**
 * Full 40-character lowercase hex git commit hash.
 *
 * **Example** (Decode a commit hash)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GitRevision } from "./ApiReferenceSnapshot.ts"
 *
 * console.log(S.decodeUnknownSync(GitRevision)("0".repeat(40)))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitRevision = S.String.check(
  S.isPattern(/^[a-f0-9]{40}$/, {
    identifier: $I`GitRevisionCheck`,
    title: "Git Revision",
    description: "Exactly 40 lowercase hexadecimal characters.",
    message: "Git revision must be a 40-character lowercase hex hash",
  })
).pipe(
  S.brand("GitRevision"),
  $I.annoteSchema("GitRevision", {
    description: "Full lowercase hex git commit hash.",
  })
);

/**
 * Branded git revision string extracted from {@link GitRevision}.
 *
 * @category models
 * @since 0.0.0
 */
export type GitRevision = typeof GitRevision.Type;

/**
 * Lowercase hex digest between 40 and 64 characters, covering both git hashes
 * and SHA-256 digests used as snapshot and generator identifiers.
 *
 * **Example** (Decode a snapshot digest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SnapshotDigest } from "./ApiReferenceSnapshot.ts"
 *
 * console.log(S.decodeUnknownSync(SnapshotDigest)("f".repeat(64)))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SnapshotDigest = S.String.check(
  S.isPattern(/^[a-f0-9]{40,64}$/, {
    identifier: $I`SnapshotDigestCheck`,
    title: "Snapshot Digest",
    description: "Between 40 and 64 lowercase hexadecimal characters.",
    message: "Snapshot digest must be 40 to 64 lowercase hex characters",
  })
).pipe(
  S.brand("SnapshotDigest"),
  $I.annoteSchema("SnapshotDigest", {
    description: "Lowercase hex digest identifying a snapshot or the generator that produced it.",
  })
);

/**
 * Branded digest string extracted from {@link SnapshotDigest}.
 *
 * @category models
 * @since 0.0.0
 */
export type SnapshotDigest = typeof SnapshotDigest.Type;

/**
 * The git revision one channel was generated from.
 *
 * **Example** (Construct a channel pin)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SnapshotChannel } from "./ApiReferenceSnapshot.ts"
 *
 * const pin = S.decodeUnknownSync(SnapshotChannel)({ revision: "0".repeat(40) })
 * console.log(pin.revision)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SnapshotChannel extends S.Class<SnapshotChannel>($I`SnapshotChannel`)(
  {
    revision: GitRevision,
  },
  $I.annote("SnapshotChannel", {
    description: "The git revision one API channel was generated from.",
  })
) {}

/**
 * Per-channel revision pins for the `v3` and `v4` channels.
 *
 * **Example** (Construct both channel pins)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SnapshotChannels } from "./ApiReferenceSnapshot.ts"
 *
 * const channels = S.decodeUnknownSync(SnapshotChannels)({
 *   v3: { revision: "0".repeat(40) },
 *   v4: { revision: "1".repeat(40) },
 * })
 * console.log(channels.v4.revision)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SnapshotChannels extends S.Class<SnapshotChannels>($I`SnapshotChannels`)(
  {
    v3: SnapshotChannel,
    v4: SnapshotChannel,
  },
  $I.annote("SnapshotChannels", {
    description: "Revision pins for the v3 and v4 API channels.",
  })
) {}

/**
 * Snapshot manifest written next to a generated dataset.
 *
 * **Example** (Decode a snapshot manifest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferenceSnapshotManifest } from "./ApiReferenceSnapshot.ts"
 *
 * const manifest = S.decodeUnknownSync(ApiReferenceSnapshotManifest)({
 *   schemaVersion: 1,
 *   snapshotId: "a".repeat(64),
 *   generatedAt: "2026-08-25T00:00:00.000Z",
 *   websiteRevision: "0".repeat(40),
 *   generator: "b".repeat(64),
 *   channels: { v3: { revision: "1".repeat(40) }, v4: { revision: "2".repeat(40) } },
 * })
 * console.log(manifest.snapshotId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceSnapshotManifest extends S.Class<ApiReferenceSnapshotManifest>(
  $I`ApiReferenceSnapshotManifest`
)(
  {
    schemaVersion: S.tag(1),
    snapshotId: SnapshotDigest,
    generatedAt: S.DateTimeUtcFromString,
    websiteRevision: GitRevision,
    generator: SnapshotDigest,
    channels: SnapshotChannels,
  },
  $I.annote("ApiReferenceSnapshotManifest", {
    description: "Pins the website revision, generator digest, and per-channel revisions a dataset snapshot was built from.",
  })
) {}
