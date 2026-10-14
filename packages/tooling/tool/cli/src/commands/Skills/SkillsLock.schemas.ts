/**
 * `skills-lock/v2` document and lock-migration plan schemas.
 *
 * **Details**
 *
 * The v2 lock keeps one file with one entry per installed skill, as a tagged
 * union:
 *
 * - `vendored`: a skill with a ratified upstream. It carries the full
 *   immutable-origin, snapshot, license, provenance, patch, and effective-tree
 *   record (`SkillLockV2Entry`'s fields).
 * - `local`: a repo-authored skill. It carries only its installed targets and
 *   their mode-aware tree hash, which is the same drift oracle the v1
 *   `computedHash` provided.
 *
 * Migration from v1 is plan-first: {@link SkillsLockMigrationPlan} reports,
 * per skill, the disposition, the computed v2 entry, a pin proposal, and every
 * drifted path classified against the skill's upstream path history (the
 * newest revision whose bytes equal the installed file, or none of the
 * examined revisions). The plan records the path-history head it classified
 * against and seals everything into `planDigest`, without writing anything.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  SkillEffective,
  SkillGitRevision,
  SkillLicense,
  SkillPatches,
  SkillProvenance,
  SkillSnapshot,
  SkillSourceType,
  SkillUpstream,
} from "./Skills.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Skills/SkillsLock.schemas");

/**
 * A skill with a ratified upstream: the full warehouse record.
 *
 * **Example** (Inspect the tag)
 *
 * ```ts
 * import { VendoredSkillLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * console.log(typeof VendoredSkillLockEntry.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendoredSkillLockEntry extends S.TaggedClass<VendoredSkillLockEntry>($I`VendoredSkillLockEntry`)(
  "vendored",
  {
    sourceType: SkillSourceType,
    upstream: SkillUpstream,
    snapshot: SkillSnapshot,
    license: SkillLicense,
    provenance: SkillProvenance,
    patches: SkillPatches,
    effective: SkillEffective,
  },
  $I.annote("VendoredSkillLockEntry", {
    description: "A ratified-upstream skill with snapshot, license, provenance, patch, and effective-tree identity.",
  })
) {}

/**
 * A repo-authored skill: installed targets and their tree hash.
 *
 * **Example** (Record a local skill)
 *
 * ```ts
 * import { LocalSkillLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const entry = LocalSkillLockEntry.make({
 *   installedTargets: [".claude/skills/yeet", ".agents/skills/yeet"],
 *   installedTreeHash: Sha256Hex.make("0".repeat(64)),
 * })
 * console.log(entry._tag) // "local"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalSkillLockEntry extends S.TaggedClass<LocalSkillLockEntry>($I`LocalSkillLockEntry`)(
  "local",
  {
    installedTargets: S.Array(S.String),
    installedTreeHash: Sha256Hex,
  },
  $I.annote("LocalSkillLockEntry", {
    description: "A repo-authored skill identified by its installed targets' mode-aware tree hash.",
  })
) {}

/**
 * One `skills-lock/v2` entry: vendored or local.
 *
 * **Example** (Narrow an entry)
 *
 * ```ts
 * import { SkillsLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(SkillsLockEntry)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillsLockEntry = S.Union([VendoredSkillLockEntry, LocalSkillLockEntry]).pipe(
  $I.annoteSchema("SkillsLockEntry", {
    description: "A skills-lock/v2 entry, tagged vendored or local.",
  })
);

/**
 * One `skills-lock/v2` entry: vendored or local.
 *
 * **Example** (Annotate an entry)
 *
 * ```ts
 * import type { SkillsLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const describe = (entry: SkillsLockEntry): string => entry._tag
 * console.log(typeof describe) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillsLockEntry = typeof SkillsLockEntry.Type;

/**
 * The canonical `skills-lock/v2` document, keyed by installed skill name.
 *
 * **Example** (Construct an empty document)
 *
 * ```ts
 * import { SkillsLockDocument } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const lock = SkillsLockDocument.make({ version: 2, skills: {} })
 * console.log(lock.version) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillsLockDocument extends S.Class<SkillsLockDocument>($I`SkillsLockDocument`)(
  {
    version: S.Literal(2),
    skills: S.Record(S.String, SkillsLockEntry),
  },
  $I.annote("SkillsLockDocument", {
    description: "The one canonical skills-lock/v2 document, with vendored and local entries.",
  })
) {}

/**
 * How a skill moves from the v1 lock to v2.
 *
 * **Details**
 *
 * `vendored` has a ratified seed and becomes a full warehouse entry; `local`
 * stays repo-authored; `unresolved` is a v1 `github` entry without a ratified
 * seed (it stays local and is reported, never guessed), or any skill whose
 * installed targets are missing or have diverged (no entry is computed; the
 * row's note names the install-state problem).
 *
 * **Example** (Check a disposition)
 *
 * ```ts
 * import { SkillMigrationDisposition } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * console.log(SkillMigrationDisposition.is.unresolved("unresolved")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillMigrationDisposition = LiteralKit(["vendored", "local", "unresolved"]).pipe(
  $I.annoteSchema("SkillMigrationDisposition", {
    description: "Whether a skill migrates as vendored, local, or an unresolved upstream.",
  })
);

/**
 * How a skill moves from the v1 lock to v2.
 *
 * **Example** (Annotate a disposition)
 *
 * ```ts
 * import type { SkillMigrationDisposition } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const disposition: SkillMigrationDisposition = "vendored"
 * console.log(disposition)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMigrationDisposition = typeof SkillMigrationDisposition.Type;

/**
 * How a drifted installed file compares with the skill's upstream path history.
 *
 * **Details**
 *
 * Names only what the plan proves. `matches-upstream-revision`: the installed
 * bytes and mode (or absence) equal the same path at a named revision of the
 * tracking ref's path history, so the floating updater pulled that upstream
 * content. `matches-no-examined-revision`: no examined revision carries these
 * bytes, so the file is a patch candidate for the HITL hunk review (B8). When
 * the row's path history is truncated, older revisions were not examined.
 *
 * **Example** (Check a drift class)
 *
 * ```ts
 * import { SkillDriftClass } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * console.log(SkillDriftClass.is["matches-upstream-revision"]("matches-upstream-revision")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillDriftClass = LiteralKit(["matches-upstream-revision", "matches-no-examined-revision"]).pipe(
  $I.annoteSchema("SkillDriftClass", {
    description: "Whether a drifted installed file equals the same path at some examined upstream path revision.",
  })
);

/**
 * How a drifted installed file compares with the skill's upstream path history.
 *
 * **Example** (Annotate a drift class)
 *
 * ```ts
 * import type { SkillDriftClass } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const drift: SkillDriftClass = "matches-no-examined-revision"
 * console.log(drift)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillDriftClass = typeof SkillDriftClass.Type;

/**
 * A drifted path whose installed bytes equal an upstream path revision.
 *
 * **Example** (Record a file pulled from an older upstream revision)
 *
 * ```ts
 * import { MatchesUpstreamRevisionDrift } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(MatchesUpstreamRevisionDrift)({
 *   path: "SKILL.md",
 *   driftClass: "matches-upstream-revision",
 *   revision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
 * })
 * console.log(row.revision.length) // 40
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatchesUpstreamRevisionDrift extends S.Class<MatchesUpstreamRevisionDrift>(
  $I`MatchesUpstreamRevisionDrift`
)(
  {
    driftClass: S.tag("matches-upstream-revision"),
    path: S.String,
    revision: SkillGitRevision,
  },
  $I.annote("MatchesUpstreamRevisionDrift", {
    description: "A drifted path equal to the same path at the newest such upstream path revision.",
  })
) {}

/**
 * A drifted path whose installed bytes match no examined upstream path revision.
 *
 * **Example** (Record a repo-local file)
 *
 * ```ts
 * import { MatchesNoExaminedRevisionDrift } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const row = MatchesNoExaminedRevisionDrift.make({ path: "SKILL.md" })
 * console.log(row.driftClass) // "matches-no-examined-revision"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatchesNoExaminedRevisionDrift extends S.Class<MatchesNoExaminedRevisionDrift>(
  $I`MatchesNoExaminedRevisionDrift`
)(
  {
    driftClass: S.tag("matches-no-examined-revision"),
    path: S.String,
  },
  $I.annote("MatchesNoExaminedRevisionDrift", {
    description: "A drifted path that equals the same path at no examined upstream path revision.",
  })
) {}

/**
 * One drifted path of a vendored skill, classified against its path history.
 *
 * **Example** (Narrow a drift row)
 *
 * ```ts
 * import { SkillDriftRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(SkillDriftRow)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillDriftRow = S.Union([MatchesUpstreamRevisionDrift, MatchesNoExaminedRevisionDrift]).pipe(
  $I.annoteSchema("SkillDriftRow", {
    description: "One installed path that differs from the seed pin, classified against the upstream path history.",
  })
);

/**
 * One drifted path of a vendored skill, classified against its path history.
 *
 * **Example** (Annotate a drift row)
 *
 * ```ts
 * import type { SkillDriftRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const pathOf = (row: SkillDriftRow): string => row.path
 * console.log(typeof pathOf) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillDriftRow = typeof SkillDriftRow.Type;

/**
 * The upstream path history a vendored row was classified against.
 *
 * **Details**
 *
 * `head` is the newest commit touching the skill's tree path at
 * `trackingRef`; it is sealed into the plan digest, so a reviewed plan stops
 * matching once upstream changes the skill. `revisionCount` revisions were
 * listed; `truncated` says older history exists that was not examined.
 *
 * **Example** (Record a complete history window)
 *
 * ```ts
 * import { SkillPathHistoryWindow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * const window = S.decodeUnknownSync(SkillPathHistoryWindow)({
 *   trackingRef: "main",
 *   head: "91f21dfe1328585670275781b4525fff2507f917",
 *   revisionCount: 3,
 *   truncated: false,
 * })
 * console.log(window.revisionCount) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPathHistoryWindow extends S.Class<SkillPathHistoryWindow>($I`SkillPathHistoryWindow`)(
  {
    trackingRef: S.String,
    head: SkillGitRevision,
    revisionCount: S.Natural,
    truncated: S.Boolean,
  },
  $I.annote("SkillPathHistoryWindow", {
    description:
      "The path-history head, listed revision count, and truncation flag a vendored row was classified against.",
  })
) {}

/**
 * The installed tree equals the upstream tree at `revision`: pin it there.
 *
 * **Details**
 *
 * `revision` is the newest examined path revision whose complete mode-aware
 * tree hash equals the installed tree's, or the seed pin itself when nothing
 * drifted from it.
 *
 * **Example** (Propose a pristine pin)
 *
 * ```ts
 * import { PristineAtRevisionPin } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * const pin = S.decodeUnknownSync(PristineAtRevisionPin)({
 *   proposal: "pristine-at-revision",
 *   revision: "91f21dfe1328585670275781b4525fff2507f917",
 * })
 * console.log(pin.proposal) // "pristine-at-revision"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PristineAtRevisionPin extends S.Class<PristineAtRevisionPin>($I`PristineAtRevisionPin`)(
  {
    proposal: S.tag("pristine-at-revision"),
    revision: SkillGitRevision,
  },
  $I.annote("PristineAtRevisionPin", {
    description: "The newest upstream revision whose whole skill tree equals the installed tree.",
  })
) {}

/**
 * No examined revision makes the installed tree pristine: keep the seed pin.
 *
 * **Details**
 *
 * The drift rows against the seed pin then carry the patch candidates: every
 * `matches-no-examined-revision` file.
 *
 * **Example** (Keep the seed pin)
 *
 * ```ts
 * import { KeepSeedPin } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * const pin = S.decodeUnknownSync(KeepSeedPin)({
 *   proposal: "keep-seed-pin",
 *   revision: "d6e773a562dc85c2a81b7c571f40ca2d81896679",
 * })
 * console.log(pin.proposal) // "keep-seed-pin"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KeepSeedPin extends S.Class<KeepSeedPin>($I`KeepSeedPin`)(
  {
    proposal: S.tag("keep-seed-pin"),
    revision: SkillGitRevision,
  },
  $I.annote("KeepSeedPin", {
    description: "The seed pin, kept because no examined upstream revision equals the installed tree.",
  })
) {}

/**
 * The pin a vendored skill should carry after migration.
 *
 * **Example** (Narrow a pin proposal)
 *
 * ```ts
 * import { SkillPinProposal } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(SkillPinProposal)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPinProposal = S.Union([PristineAtRevisionPin, KeepSeedPin]).pipe(
  $I.annoteSchema("SkillPinProposal", {
    description: "A pristine upstream revision to pin, or the kept seed pin.",
  })
);

/**
 * The pin a vendored skill should carry after migration.
 *
 * **Example** (Annotate a pin proposal)
 *
 * ```ts
 * import type { SkillPinProposal } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const revisionOf = (pin: SkillPinProposal): string => pin.revision
 * console.log(typeof revisionOf) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPinProposal = typeof SkillPinProposal.Type;

/**
 * A skill with a ratified seed: its warehouse entry, pin proposal, and classified drift.
 *
 * **Details**
 *
 * `entry` and `drift` are computed against the seed pin. `pin` proposes the
 * newest pristine upstream revision when one exists; the lock write recomputes
 * the entry at that pin. `pathHistory` is the history the drift was
 * classified against.
 *
 * **Example** (Inspect the disposition tag)
 *
 * ```ts
 * import { VendoredMigrationRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * console.log(typeof VendoredMigrationRow.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendoredMigrationRow extends S.Class<VendoredMigrationRow>($I`VendoredMigrationRow`)(
  {
    disposition: S.tag("vendored"),
    skill: S.String,
    entry: VendoredSkillLockEntry,
    pin: SkillPinProposal,
    drift: S.Array(SkillDriftRow),
    pathHistory: SkillPathHistoryWindow,
  },
  $I.annote("VendoredMigrationRow", {
    description:
      "A seeded skill's computed warehouse entry, pin proposal, drift classified against the upstream path history, and that history's head.",
  })
) {}

/**
 * A repo-authored skill: its installed-tree identity, nothing upstream.
 *
 * **Example** (Record a local skill row)
 *
 * ```ts
 * import { LocalMigrationRow, LocalSkillLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const row = LocalMigrationRow.make({
 *   skill: "yeet",
 *   entry: LocalSkillLockEntry.make({ installedTargets: [], installedTreeHash: Sha256Hex.make("0".repeat(64)) }),
 * })
 * console.log(row.disposition) // "local"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalMigrationRow extends S.Class<LocalMigrationRow>($I`LocalMigrationRow`)(
  {
    disposition: S.tag("local"),
    skill: S.String,
    entry: LocalSkillLockEntry,
  },
  $I.annote("LocalMigrationRow", {
    description: "A repo-authored skill identified by its installed-tree hash.",
  })
) {}

/**
 * A skill the plan cannot vendor: why, and its local identity when one exists.
 *
 * **Details**
 *
 * Covers a v1 `github` entry without a ratified seed (it keeps a local entry),
 * a missing or divergent install (no entry is computed), and a seeded skill
 * whose provenance or upstream cannot be read at the pin or along its path
 * history (it keeps a local entry). The note names the cause.
 *
 * **Example** (Record an unresolved row)
 *
 * ```ts
 * import { UnresolvedMigrationRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const row = UnresolvedMigrationRow.make({ skill: "adhd", note: "no ratified resolution seed" })
 * console.log(row.disposition) // "unresolved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnresolvedMigrationRow extends S.Class<UnresolvedMigrationRow>($I`UnresolvedMigrationRow`)(
  {
    disposition: S.tag("unresolved"),
    skill: S.String,
    note: S.String,
    entry: S.optionalKey(LocalSkillLockEntry),
  },
  $I.annote("UnresolvedMigrationRow", {
    description: "A skill that cannot be vendored yet, with the cause and any local identity.",
  })
) {}

/**
 * The migration outcome for one installed skill, keyed by disposition.
 *
 * **Example** (Narrow a row)
 *
 * ```ts
 * import { SkillMigrationRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.isSchema(SkillMigrationRow)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillMigrationRow = S.Union([VendoredMigrationRow, LocalMigrationRow, UnresolvedMigrationRow]).pipe(
  $I.annoteSchema("SkillMigrationRow", {
    description: "One skill's v1-to-v2 migration outcome; the fields present follow its disposition.",
  })
);

/**
 * The migration outcome for one installed skill, keyed by disposition.
 *
 * **Example** (Annotate a row)
 *
 * ```ts
 * import type { SkillMigrationRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const skillOf = (row: SkillMigrationRow): string => row.skill
 * console.log(typeof skillOf) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMigrationRow = typeof SkillMigrationRow.Type;

/**
 * `skills-lock-migration-plan/v2`: the read-only v1-to-v2 lock migration report.
 *
 * **Details**
 *
 * `planDigest` is the SHA-256 of the compact canonical JSON of the encoded
 * `schemaVersion` and `rows`. Each vendored row carries the path-history head
 * it was classified against, so the digest moves whenever upstream changes a
 * skill, and a reviewed plan cannot be replayed against a moved upstream.
 *
 * **Example** (Construct an empty plan)
 *
 * ```ts
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const plan = SkillsLockMigrationPlan.make({ planDigest: Sha256Hex.make("0".repeat(64)), rows: [] })
 * console.log(plan.schemaVersion) // "skills-lock-migration-plan/v2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillsLockMigrationPlan extends S.Class<SkillsLockMigrationPlan>($I`SkillsLockMigrationPlan`)(
  {
    schemaVersion: S.tag("skills-lock-migration-plan/v2"),
    planDigest: Sha256Hex,
    rows: S.Array(SkillMigrationRow),
  },
  $I.annote("SkillsLockMigrationPlan", {
    description: "Read-only per-skill v1-to-v2 lock migration report, sorted by skill name and sealed by its digest.",
  })
) {}

const SkillsLockDocumentJson = S.fromJsonString(SkillsLockDocument);

/**
 * Decodes a `skills-lock/v2` document from its JSON text.
 *
 * **Example** (Build the decode effect)
 *
 * ```ts
 * import { decodeSkillsLockDocumentJson } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeSkillsLockDocumentJson('{"version": 2, "skills": {}}'))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSkillsLockDocumentJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillsLockDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillsLockDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillsLockDocumentJson));

/**
 * Encodes a `skills-lock/v2` document to its JSON text.
 *
 * **Example** (Build the encode effect)
 *
 * ```ts
 * import { encodeSkillsLockDocumentJson, SkillsLockDocument } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(encodeSkillsLockDocumentJson(SkillsLockDocument.make({ version: 2, skills: {} })))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeSkillsLockDocumentJson: {
  (options?: AST.ParseOptions): (input: SkillsLockDocument) => Effect.Effect<string, S.SchemaError>;
  (input: SkillsLockDocument, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeEffect(SkillsLockDocumentJson));
