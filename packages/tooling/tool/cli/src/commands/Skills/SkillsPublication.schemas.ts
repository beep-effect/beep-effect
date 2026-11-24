/**
 * Durable publication records for the skills projection writer.
 *
 * **Details**
 *
 * `beep skills update` publishes files (`skills-lock.json`,
 * `.codex/config.toml`) and directories (`.claude/skills/<name>`). Each
 * publication is the same durable state machine the `beep models` writer
 * records ({@link ModelsPublicationState}), with the content of a file
 * fingerprinted by the SHA-256 of its bytes and the content of a directory by
 * a deterministic tree hash (see {@link SkillTreeEntry}).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  ModelsPublicationOwner,
  ModelsPublicationState,
  ModelsRecoveryOutcome,
  ModelsRecoveryRefusal,
  ModelsRecoverySkip,
} from "../Models/Models.exchange.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsPublication.schemas");

/**
 * **Example** (Guard a kind)
 *
 * ```ts
 * import { SkillPublicationKind } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * console.log(SkillPublicationKind.is.directory("directory")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPublicationKind = LiteralKit(["file", "directory"]).pipe(
  $I.annoteSchema("SkillPublicationKind", {
    description: "Whether a skill publication replaces a regular file or a directory tree.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillPublicationKind = typeof SkillPublicationKind.Type;

/**
 * **Example** (Guard an entry kind)
 *
 * ```ts
 * import { SkillTreeEntryKind } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SkillTreeEntryKind)("symlink")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillTreeEntryKind = LiteralKit(["directory", "file", "symlink"]).pipe(
  $I.annoteSchema("SkillTreeEntryKind", {
    description: "Directory, regular file or symbolic link inside a skill directory tree.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillTreeEntryKind = typeof SkillTreeEntryKind.Type;

/**
 * One entry of a skill directory tree, as the tree hash covers it.
 *
 * **Details**
 *
 * `path` is relative to the tree root, with `/` separators; the root itself is
 * `.`. `mode` holds the permission bits (`mode & 0o7777`). `digest` is the
 * SHA-256 of a file's bytes or of a symlink's target text, and empty for a
 * directory. The tree hash is the SHA-256 of every entry, sorted by path, each
 * rendered as `kind NUL octal-mode NUL path NUL digest LF`. A symlink is never
 * followed, so its target's content is not part of the hash.
 *
 * **Example** (Describe a file entry)
 *
 * ```ts
 * import { SkillTreeEntry } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const entry = SkillTreeEntry.make({ path: "SKILL.md", kind: "file", mode: 0o644, digest: "ab" })
 * console.log(entry.mode.toString(8)) // "644"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillTreeEntry extends S.Opaque<SkillTreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    kind: SkillTreeEntryKind,
    mode: S.Int,
    digest: S.String,
  }).pipe(
    $I.annoteSchema("SkillTreeEntry", {
      description: "Relative path, kind, permission bits and content digest of one skill tree entry.",
    })
  )
) {}

/**
 * The fingerprint of a published file or directory.
 *
 * **Details**
 *
 * A file is the SHA-256 of its bytes. A directory is its tree hash plus the
 * sorted entries the hash covers, so recovery can say which entries differ.
 *
 * **Example** (Fingerprint a file)
 *
 * ```ts
 * import { SkillContentDigest } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const digest = SkillContentDigest.cases.file.make({ hash: "ab" })
 * console.log(digest._tag) // "file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillContentDigest = S.TaggedUnion({
  file: { hash: S.NonEmptyString },
  directory: { hash: S.NonEmptyString, entries: S.Array(SkillTreeEntry) },
}).pipe(
  $I.annoteSchema("SkillContentDigest", {
    description: "SHA-256 of a file's bytes, or the tree hash and entries of a directory.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillContentDigest = typeof SkillContentDigest.Type;

/**
 * A skill publication whose every step is durable in its journal.
 *
 * **Details**
 *
 * Everything recovery needs is fixed at intent: the canonical `target`, the
 * `staging` entry beside it (`<file>.tmp-<suffix>` or
 * `.<directory>.stage-<suffix>`), the `partial` directory a stage is assembled
 * in, the `backup` when the target existed, the `preimage` fingerprint (none
 * when the target was absent), the `staged` fingerprint, and the target
 * filesystem identity key when the publication exchanges. Only `state` and
 * `owner` change.
 *
 * **Example** (Record intent)
 *
 * ```ts
 * import { ModelsPublicationState } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import {
 *   SkillContentDigest,
 *   SkillTrackedPublication
 * } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 * import * as O from "effect/Option"
 *
 * const publication = SkillTrackedPublication.make({
 *   kind: "file",
 *   state: ModelsPublicationState.cases.intent.make({}),
 *   owner: O.none(),
 *   target: "/repo/skills-lock.json",
 *   staging: "/repo/skills-lock.json.tmp-1",
 *   partial: O.none(),
 *   backup: O.some("/repo/.beep/skills-backups/skills-lock.json.1"),
 *   preimage: SkillContentDigest.cases.file.makeOption({ hash: "aa" }),
 *   staged: SkillContentDigest.cases.file.make({ hash: "bb" }),
 *   filesystem: O.some("1:7:ext4")
 * })
 * console.log(publication.state._tag) // "intent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillTrackedPublication extends S.Opaque<SkillTrackedPublication, { readonly brand: unique symbol }>()(
  S.TaggedStruct("tracked", {
    kind: SkillPublicationKind,
    state: ModelsPublicationState,
    owner: S.OptionFromOptionalKey(ModelsPublicationOwner),
    target: S.NonEmptyString,
    staging: S.NonEmptyString,
    partial: S.OptionFromOptionalKey(S.NonEmptyString),
    backup: S.OptionFromOptionalKey(S.NonEmptyString),
    preimage: S.OptionFromOptionalKey(SkillContentDigest),
    staged: SkillContentDigest,
    filesystem: S.OptionFromOptionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("SkillTrackedPublication", {
      description: "Durable skill publication state with the paths, fingerprints and identity recovery needs.",
    })
  )
) {}

/**
 * The publication of a skill journal that carries no tracked state.
 *
 * **Details**
 *
 * A journal without a `publication` key decodes to this state. Recovery never
 * changes a target or a file for it and reports it as skipped.
 *
 * **Example** (Mark a legacy journal)
 *
 * ```ts
 * import { SkillLegacyPublication } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * console.log(SkillLegacyPublication.make({})._tag) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLegacyPublication extends S.Opaque<SkillLegacyPublication, { readonly brand: unique symbol }>()(
  S.TaggedStruct("legacy", {}).pipe(
    $I.annoteSchema("SkillLegacyPublication", {
      description: "Untracked publication of a skill journal that predates durable publication states.",
    })
  )
) {}

/**
 * **Example** (Guard a publication)
 *
 * ```ts
 * import { SkillLegacyPublication, SkillPublication } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SkillPublication)(SkillLegacyPublication.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPublication = S.Union([SkillLegacyPublication, SkillTrackedPublication]).pipe(
  $I.annoteSchema("SkillPublication", {
    description: "Tracked skill publication, or the legacy state of a journal without one.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillPublication = typeof SkillPublication.Type;

/**
 * The journal of one skill publication, kept under `.beep/skills-backups/journals`.
 *
 * **Details**
 *
 * The file is named `<id>.json`. A journal without a `publication` key decodes
 * to {@link SkillLegacyPublication} by schema default.
 *
 * **Example** (Decode a legacy journal)
 *
 * ```ts
 * import { SkillPublicationJournal } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 * import * as S from "effect/Schema"
 *
 * const journal = S.decodeUnknownSync(SkillPublicationJournal)({ id: "skills-1" })
 * console.log(journal.publication._tag) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPublicationJournal extends S.Opaque<SkillPublicationJournal, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    publication: SkillPublication.pipe(
      S.withConstructorDefault(Effect.succeed(SkillLegacyPublication.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({ _tag: "legacy" as const }))
    ),
  }).pipe(
    $I.annoteSchema("SkillPublicationJournal", {
      description: "Journal id and durable publication state of one skill projection write.",
    })
  )
) {}

/**
 * **Details**
 *
 * `pending` reconciles interrupted publications only; it is what
 * `skills update` runs before it writes. `retry` also revisits publications an
 * earlier recovery refused; it is what `skills recover` runs. Neither touches
 * a completed, recovered or legacy journal.
 *
 * **Example** (Guard a scope)
 *
 * ```ts
 * import { SkillRecoveryScope } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * console.log(SkillRecoveryScope.is.retry("retry")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillRecoveryScope = LiteralKit(["pending", "retry"]).pipe(
  $I.annoteSchema("SkillRecoveryScope", {
    description: "Whether a skills recovery sweep reconciles pending publications only, or also retries refusals.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillRecoveryScope = typeof SkillRecoveryScope.Type;

/**
 * What skills recovery did with one interrupted publication.
 *
 * **Details**
 *
 * The `recovered`, `refused` and `skipped` cases are the shared recovery
 * results. `abandoned` settles a publication that was creating a target that
 * did not exist and never moved its stage into place, when another writer has
 * created the target since: there is no preimage to protect, so recovery drops
 * its own stage, keeps the other writer's entry, and closes the journal as
 * `abandoned`, just as the writer does when its own create finds the target
 * taken.
 *
 * **Example** (Report an abandoned create)
 *
 * ```ts
 * import { SkillRecoveryResult } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const result = SkillRecoveryResult.cases.abandoned.make({ detail: "Another writer created the target." })
 * console.log(result._tag) // "abandoned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillRecoveryResult = S.TaggedUnion({
  recovered: { outcome: ModelsRecoveryOutcome },
  refused: { reason: ModelsRecoveryRefusal, detail: S.String },
  skipped: { reason: ModelsRecoverySkip },
  abandoned: { detail: S.String },
}).pipe(
  $I.annoteSchema("SkillRecoveryResult", {
    description: "Recovered, refused, skipped, or an abandoned create whose target another writer took.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillRecoveryResult = typeof SkillRecoveryResult.Type;

/**
 * One skill journal that a recovery sweep reconciled, refused or skipped.
 *
 * **Example** (Read a report)
 *
 * ```ts
 * import { SkillRecoveryReport, SkillRecoveryResult } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const report = SkillRecoveryReport.make({
 *   journal: "skills-20261021T000000000Z-1",
 *   result: SkillRecoveryResult.cases.recovered.make({ outcome: "preimage" })
 * })
 * console.log(report.result._tag) // "recovered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillRecoveryReport extends S.Opaque<SkillRecoveryReport, { readonly brand: unique symbol }>()(
  S.Struct({
    journal: S.NonEmptyString,
    result: SkillRecoveryResult,
  }).pipe(
    $I.annoteSchema("SkillRecoveryReport", {
      description: "Journal id and result of one skills recovery decision.",
    })
  )
) {}

/**
 * **Details**
 *
 * `exchange-unsupported` and `exchange-probe-failed` refuse an existing target
 * whose filesystem cannot exchange atomically, before any backup or journal.
 * `drift` means the target changed between planning and publication, before
 * the exchange. `owner-alive` means another running process owns the
 * publication. `lock-unavailable` means the journal's exclusive recovery lock
 * could not be created for a reason other than an existing lock. The {@link ModelsRecoveryRefusal} reasons come from the shared
 * recovery rule and keep every artifact.
 *
 * **Example** (Guard a refusal)
 *
 * ```ts
 * import { SkillPublicationRefusal } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SkillPublicationRefusal)("competing-writer")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPublicationRefusal = LiteralKit([
  "exchange-unsupported",
  "exchange-probe-failed",
  "drift",
  "owner-alive",
  "lock-unavailable",
  ...ModelsRecoveryRefusal.literals,
]).pipe(
  $I.annoteSchema("SkillPublicationRefusal", {
    description: "Typed reason a skill publication or its recovery refused without overwriting the target.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SkillPublicationRefusal = typeof SkillPublicationRefusal.Type;

/**
 * **Example** (Describe a file)
 *
 * ```ts
 * import { SkillPublicationFile } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas"
 *
 * const file = SkillPublicationFile.make({ path: "SKILL.md", bytes: new TextEncoder().encode("# Skill\n") })
 * console.log(file.bytes.byteLength) // 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPublicationFile extends S.Opaque<SkillPublicationFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    bytes: S.Uint8Array,
  }).pipe(
    $I.annoteSchema("SkillPublicationFile", {
      description: "Relative path and bytes of one file a skill directory publication writes.",
    })
  )
) {}
