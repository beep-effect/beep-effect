/**
 * Target-filesystem atomic-exchange capability for native configuration writes.
 *
 * **Details**
 *
 * Exchange support is a property of the mount that holds the target, not of
 * the host. The writer identifies that mount by the mount id and device id of
 * the target's parent directory, together with the filesystem type when the
 * host reports one, and caches one probe result per identity.
 *
 * Every publication the writer makes is a durable state machine in its journal:
 * the forward steps, the recovery states and the paths, hashes and filesystem
 * identity that restart recovery reconciles from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Models/Models.exchange.schemas");

const ModelsExchangeUnsupportedReasonKit = LiteralKit(["exdev", "einval", "eperm", "enosys", "unknown"]);

/**
 * **Details**
 *
 * The first four reasons are the errno values `renameat2(RENAME_EXCHANGE)`
 * returns: `exdev` (the pathnames are on different mounts, including a target
 * that is itself a mount point), `einval` (the filesystem does not implement
 * the flag), `eperm` (the filesystem or a security module forbids it) and
 * `enosys` (the kernel has no `renameat2`). Every other refusal, such as an
 * `mv` without `--exchange` or a probe whose files were not swapped, is
 * `unknown`.
 *
 * **Example** (Guard a reason)
 *
 * ```ts
 * import { ModelsExchangeUnsupportedReason } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsExchangeUnsupportedReason)("exdev")) // true
 * console.log(S.is(ModelsExchangeUnsupportedReason)("enoent")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsExchangeUnsupportedReason = ModelsExchangeUnsupportedReasonKit.pipe(
  $I.annoteSchema("ModelsExchangeUnsupportedReason", {
    description: "Typed errno-derived reason a target filesystem cannot exchange two pathnames atomically.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsExchangeUnsupportedReason = typeof ModelsExchangeUnsupportedReason.Type;

/**
 * One entry of the host mount table: the mount id and where it is mounted.
 *
 * **Details**
 *
 * On Linux this is a `/proc/self/mountinfo` line. Two paths are on the same
 * mount only when their mount ids are equal. An equal `stat` device id is not
 * enough, because a bind mount of a file or directory from the same filesystem
 * keeps the device id but is a separate mount, and `rename` across it fails
 * with `EXDEV`.
 *
 * **Example** (Describe a mount)
 *
 * ```ts
 * import { ModelsExchangeMount } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const mount = ModelsExchangeMount.make({ id: 29n, point: "/srv/config" })
 * console.log(mount.point) // "/srv/config"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsExchangeMount extends S.Opaque<ModelsExchangeMount, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.BigInt,
    point: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ModelsExchangeMount", {
      description: "Mount id and mount point of the mount that contains a path.",
    })
  )
) {}

/**
 * Mount identity of the filesystem that holds a native target.
 *
 * **Details**
 *
 * `mount` is the mount id of the target's parent directory and `device` its
 * `stat` device id. `filesystemType` is the type name the host reports for that
 * directory, when it reports one. Two targets share a cached capability only
 * when all three fields are equal, so a remount, a bind mount, a different
 * device or a newly reported type forces a fresh probe.
 *
 * **Example** (Describe a filesystem)
 *
 * ```ts
 * import { ModelsExchangeFilesystemIdentity } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as O from "effect/Option"
 *
 * const identity = ModelsExchangeFilesystemIdentity.make({
 *   mount: 29n,
 *   device: 64769n,
 *   filesystemType: O.some("ext2/ext3")
 * })
 * console.log(identity.device) // 64769n
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsExchangeFilesystemIdentity extends S.Opaque<
  ModelsExchangeFilesystemIdentity,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mount: S.BigInt,
    device: S.BigInt,
    filesystemType: S.OptionFromOptionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("ModelsExchangeFilesystemIdentity", {
      description:
        "Parent-directory mount id, device id and reported filesystem type that key the exchange capability cache.",
    })
  )
) {}

/**
 * The cache key for one filesystem identity.
 *
 * **Example** (Key an identity)
 *
 * ```ts
 * import {
 *   ModelsExchangeFilesystemIdentity,
 *   modelsExchangeIdentityKey
 * } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as O from "effect/Option"
 *
 * const identity = ModelsExchangeFilesystemIdentity.make({ mount: 29n, device: 7n, filesystemType: O.some("tmpfs") })
 * console.log(modelsExchangeIdentityKey(identity)) // "29:7:tmpfs"
 * ```
 *
 * @param identity - Parent-directory identity observed for the exchange capability cache.
 * @returns A mount/device/filesystem key with an empty final component when the filesystem type is absent.
 * @category utilities
 * @since 0.0.0
 */
export const modelsExchangeIdentityKey = (identity: ModelsExchangeFilesystemIdentity): string =>
  `${identity.mount}:${identity.device}:${O.getOrElse(identity.filesystemType, () => "")}`;

/**
 * Whether a target filesystem supports atomic pathname exchange.
 *
 * **Details**
 *
 * `unsupported` carries the typed reason and the host's explanation, which the
 * writer repeats in its refusal.
 *
 * **Example** (Record an unsupported filesystem)
 *
 * ```ts
 * import { ModelsExchangeCapability } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const capability = ModelsExchangeCapability.cases.unsupported.make({
 *   reason: "exdev",
 *   detail: "Invalid cross-device link"
 * })
 * console.log(capability._tag) // "unsupported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsExchangeCapability = S.TaggedUnion({
  supported: {},
  unsupported: { reason: ModelsExchangeUnsupportedReason, detail: S.String },
}).pipe(
  $I.annoteSchema("ModelsExchangeCapability", {
    description: "Supported, or unsupported with a typed errno-derived reason, for one target filesystem.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsExchangeCapability = typeof ModelsExchangeCapability.Type;

/**
 * The capability verdict for one native target and the filesystem it names.
 *
 * **Details**
 *
 * `directory` is the target's parent directory, where the probe created and
 * removed its disposable files.
 *
 * **Example** (Read a qualification)
 *
 * ```ts
 * import {
 *   ModelsExchangeCapability,
 *   ModelsExchangeFilesystemIdentity,
 *   ModelsExchangeQualification
 * } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as O from "effect/Option"
 *
 * const qualification = ModelsExchangeQualification.make({
 *   directory: "/srv/config",
 *   identity: ModelsExchangeFilesystemIdentity.make({ mount: 29n, device: 7n, filesystemType: O.none() }),
 *   capability: ModelsExchangeCapability.cases.supported.make({})
 * })
 * console.log(qualification.capability._tag) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsExchangeQualification extends S.Opaque<
  ModelsExchangeQualification,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    directory: S.NonEmptyString,
    identity: ModelsExchangeFilesystemIdentity,
    capability: ModelsExchangeCapability,
  }).pipe(
    $I.annoteSchema("ModelsExchangeQualification", {
      description: "Exchange capability of a native target's filesystem, with the identity that keyed it.",
    })
  )
) {}

/**
 * One forward step of a durable native publication, in order.
 *
 * **Details**
 *
 * The writer records each step in the journal, with an atomic journal write,
 * before it performs the step that follows. `intent` precedes the backup,
 * `backed-up` precedes the preimage link and the staged file, `staged` precedes
 * the exchange, `exchanged` precedes verification, `verified` precedes the
 * cleanup of the stage and preimage link, and `completed` closes the
 * publication. A restoration has no backup of its own, so it moves from
 * `intent` straight to `staged`.
 *
 * **Example** (Guard a step)
 *
 * ```ts
 * import { ModelsPublicationStep } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsPublicationStep)("staged")) // true
 * console.log(S.is(ModelsPublicationStep)("recovered")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsPublicationStep = LiteralKit([
  "intent",
  "backed-up",
  "staged",
  "exchanged",
  "verified",
  "completed",
]).pipe(
  $I.annoteSchema("ModelsPublicationStep", {
    description: "Forward step of a durable native publication, recorded before the step that follows it.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsPublicationStep = typeof ModelsPublicationStep.Type;

/**
 * Which bytes a reconciled publication left on the live path.
 *
 * **Details**
 *
 * `preimage` means the publication never landed, or landed and was rolled
 * back, so the target holds the bytes it had at intent. `intended` means the
 * staged content is live and the publication was finished.
 *
 * **Example** (Guard an outcome)
 *
 * ```ts
 * import { ModelsRecoveryOutcome } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsRecoveryOutcome)("intended")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsRecoveryOutcome = LiteralKit(["preimage", "intended"]).pipe(
  $I.annoteSchema("ModelsRecoveryOutcome", {
    description: "Whether a reconciled publication left the preimage or the intended content live.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsRecoveryOutcome = typeof ModelsRecoveryOutcome.Type;

/**
 * Why recovery refused to reconcile an interrupted publication.
 *
 * **Details**
 *
 * `competing-writer` means the target's bytes match neither the preimage nor
 * the staged content, or a foreign file was displaced into the stage and has
 * been returned to the live path. `foreign-artifact` means a stage, preimage
 * link or recorded path is not one the writer made. `target-missing` means the
 * live path is gone. `filesystem-changed` means the target's filesystem
 * identity differs from the one recorded at intent, so no exchange is
 * attempted. A refusal keeps every artifact.
 *
 * **Example** (Guard a refusal)
 *
 * ```ts
 * import { ModelsRecoveryRefusal } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsRecoveryRefusal)("competing-writer")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsRecoveryRefusal = LiteralKit([
  "competing-writer",
  "foreign-artifact",
  "target-missing",
  "filesystem-changed",
]).pipe(
  $I.annoteSchema("ModelsRecoveryRefusal", {
    description: "Durable reason recovery refused an interrupted publication and kept every artifact.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsRecoveryRefusal = typeof ModelsRecoveryRefusal.Type;

/**
 * **Details**
 *
 * The six forward steps are listed under {@link ModelsPublicationStep}.
 * `recovering` is written before recovery changes anything and names the step
 * it found. `recovered` closes a reconciled publication with its outcome.
 * `refused` closes a publication that recovery would not touch, with its
 * reason. `abandoned` closes a publication its own writer gave up before the
 * exchange: the target was never touched, and the stage, preimage link and
 * backup are dropped. `completed`, `recovered`, `refused` and `abandoned` are
 * terminal. Automatic recovery skips them, and only an explicit restore
 * revisits a refusal.
 *
 * **Gotchas**
 *
 * `abandoned` is newer than the other states. A decoder that predates it does
 * not accept the journal, so recovery skips it as undecodable and restore
 * refuses it as an invalid journal; neither touches the target.
 *
 * **Example** (Record a recovery)
 *
 * ```ts
 * import { ModelsPublicationState } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const state = ModelsPublicationState.cases.recovered.make({ from: "staged", outcome: "preimage" })
 * console.log(state._tag) // "recovered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsPublicationState = S.TaggedUnion({
  intent: {},
  "backed-up": {},
  staged: {},
  exchanged: {},
  verified: {},
  completed: {},
  recovering: { from: ModelsPublicationStep },
  recovered: { from: ModelsPublicationStep, outcome: ModelsRecoveryOutcome },
  refused: { from: ModelsPublicationStep, reason: ModelsRecoveryRefusal, detail: S.String },
  abandoned: { from: ModelsPublicationStep, detail: S.String },
}).pipe(
  $I.annoteSchema("ModelsPublicationState", {
    description: "Durable forward, recovering, recovered, refused or abandoned state of one native publication.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsPublicationState = typeof ModelsPublicationState.Type;

/**
 * **Details**
 *
 * `bootId` is the kernel boot id, `pid` the process id and `startTicks` the
 * process start time from its `stat` record. The three together name one
 * process for the life of the host, so a reused pid or a reboot reads as a dead
 * owner. Recovery leaves a publication alone while its owner is alive.
 *
 * **Example** (Name an owner)
 *
 * ```ts
 * import { ModelsPublicationOwner } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const owner = ModelsPublicationOwner.make({ bootId: "boot-a", pid: 4242, startTicks: "981723" })
 * console.log(owner.pid) // 4242
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsPublicationOwner extends S.Opaque<ModelsPublicationOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    bootId: S.NonEmptyString,
    pid: S.Int,
    startTicks: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ModelsPublicationOwner", {
      description: "Boot id, pid and start time of the process that last wrote a publication state.",
    })
  )
) {}

/**
 * A publication whose every step is durable in the journal.
 *
 * **Details**
 *
 * Everything recovery needs is fixed at intent: the canonical `target`, the
 * `staging` file and `retained` preimage hard link beside it, the `backup` when
 * the publication takes one, the SHA-256 of the preimage, of the staged content
 * and of the target as read at intent, and the target filesystem's identity key
 * (see {@link modelsExchangeIdentityKey}). Only `state` and `owner` change.
 *
 * **Example** (Record intent)
 *
 * ```ts
 * import {
 *   ModelsPublicationState,
 *   ModelsTrackedPublication
 * } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as O from "effect/Option"
 *
 * const publication = ModelsTrackedPublication.make({
 *   state: ModelsPublicationState.cases.intent.make({}),
 *   owner: O.none(),
 *   target: "/srv/config/app.toml",
 *   staging: "/srv/config/app.toml.models-1-2.tmp",
 *   retained: "/srv/config/app.toml.models-1-2.preimage",
 *   backup: O.some("/srv/backups/models-1.backup"),
 *   preimageHash: "aa",
 *   stagedHash: "bb",
 *   targetAtIntentHash: "aa",
 *   filesystem: "64769:ext2/ext3"
 * })
 * console.log(publication.state._tag) // "intent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsTrackedPublication extends S.Opaque<ModelsTrackedPublication, { readonly brand: unique symbol }>()(
  S.TaggedStruct("tracked", {
    state: ModelsPublicationState,
    owner: S.OptionFromOptionalKey(ModelsPublicationOwner),
    target: S.NonEmptyString,
    staging: S.NonEmptyString,
    retained: S.NonEmptyString,
    backup: S.OptionFromOptionalKey(S.NonEmptyString),
    preimageHash: S.NonEmptyString,
    stagedHash: S.NonEmptyString,
    targetAtIntentHash: S.NonEmptyString,
    filesystem: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ModelsTrackedPublication", {
      description: "Durable publication state with the paths, hashes and filesystem identity recovery needs.",
    })
  )
) {}

/**
 * The state of a journal written before publications were tracked.
 *
 * **Details**
 *
 * A journal without a `publication` key decodes to this state. Its stage and
 * artifact names are unknown, so recovery never changes the target or any file
 * for it: automatic recovery reports it as skipped, and restore keeps the
 * fingerprint-fenced undo it always had.
 *
 * **Example** (Mark a legacy journal)
 *
 * ```ts
 * import { ModelsLegacyPublication } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * console.log(ModelsLegacyPublication.make({})._tag) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsLegacyPublication extends S.Opaque<ModelsLegacyPublication, { readonly brand: unique symbol }>()(
  S.TaggedStruct("legacy", {}).pipe(
    $I.annoteSchema("ModelsLegacyPublication", {
      description: "Untracked publication state of a journal written before durable publication states.",
    })
  )
) {}

/**
 * **Example** (Guard a publication)
 *
 * ```ts
 * import { ModelsLegacyPublication, ModelsPublication } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsPublication)(ModelsLegacyPublication.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsPublication = S.Union([ModelsLegacyPublication, ModelsTrackedPublication]).pipe(
  $I.annoteSchema("ModelsPublication", {
    description: "Tracked publication state, or the legacy state of a journal that predates tracking.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsPublication = typeof ModelsPublication.Type;

/**
 * **Details**
 *
 * `publication` is the apply that wrote the journal. `restoration` is the undo
 * that restore publishes from the journal's backup.
 *
 * **Example** (Guard a role)
 *
 * ```ts
 * import { ModelsPublicationRole } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsPublicationRole)("restoration")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsPublicationRole = LiteralKit(["publication", "restoration"]).pipe(
  $I.annoteSchema("ModelsPublicationRole", {
    description: "Whether a report is about a journal's apply publication or its restoration.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsPublicationRole = typeof ModelsPublicationRole.Type;

/**
 * Why automatic recovery left a journal alone.
 *
 * **Details**
 *
 * `legacy` journals predate tracked publications. `owner-alive` publications
 * still belong to a running process. `lock-held` means another live process
 * holds the journal's exclusive recovery lock. `settled` means the publication
 * was already terminal when this recoverer re-read it under the lock.
 *
 * **Example** (Guard a skip reason)
 *
 * ```ts
 * import { ModelsRecoverySkip } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsRecoverySkip)("lock-held")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsRecoverySkip = LiteralKit(["legacy", "owner-alive", "lock-held", "settled"]).pipe(
  $I.annoteSchema("ModelsRecoverySkip", {
    description: "Why recovery left a journal untouched.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsRecoverySkip = typeof ModelsRecoverySkip.Type;

/**
 * What recovery did with one interrupted publication.
 *
 * **Example** (Report a refusal)
 *
 * ```ts
 * import { ModelsRecoveryResult } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const result = ModelsRecoveryResult.cases.refused.make({ reason: "competing-writer", detail: "Target changed." })
 * console.log(result._tag) // "refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsRecoveryResult = S.TaggedUnion({
  recovered: { outcome: ModelsRecoveryOutcome },
  refused: { reason: ModelsRecoveryRefusal, detail: S.String },
  skipped: { reason: ModelsRecoverySkip },
}).pipe(
  $I.annoteSchema("ModelsRecoveryResult", {
    description: "Recovered with an outcome, refused with a reason, or skipped with a reason.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ModelsRecoveryResult = typeof ModelsRecoveryResult.Type;

/**
 * One journal publication that a recovery sweep reconciled, refused or skipped.
 *
 * **Example** (Read a report)
 *
 * ```ts
 * import {
 *   ModelsRecoveryReport,
 *   ModelsRecoveryResult
 * } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 *
 * const report = ModelsRecoveryReport.make({
 *   journal: "models-20261021T000000000Z-1",
 *   role: "publication",
 *   result: ModelsRecoveryResult.cases.recovered.make({ outcome: "intended" })
 * })
 * console.log(report.result._tag) // "recovered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsRecoveryReport extends S.Opaque<ModelsRecoveryReport, { readonly brand: unique symbol }>()(
  S.Struct({
    journal: S.NonEmptyString,
    role: ModelsPublicationRole,
    result: ModelsRecoveryResult,
  }).pipe(
    $I.annoteSchema("ModelsRecoveryReport", {
      description: "Journal id, publication role and result of one recovery decision.",
    })
  )
) {}
