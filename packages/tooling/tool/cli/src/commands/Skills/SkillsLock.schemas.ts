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
 * per skill, the disposition, the computed v2 entry, and every drifted path
 * classified as `matches-upstream-head` or `differs-from-upstream-head` against
 * the tracking ref's current upstream head (recorded as `upstreamHead`, the pin-bump target),
 * without writing anything.
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
 * How a drifted installed file compares with the tracking ref's current upstream head.
 *
 * **Details**
 *
 * Names only what the plan proves. `matches-upstream-head`: the installed bytes
 * (or absence) equal the same path at the tracking ref's current head, so the
 * floating updater pulled newer upstream content and the remedy is a pin bump.
 * `differs-from-upstream-head`: the file matches neither the pin nor the
 * current head. It may be a repo customization or a pull of an intermediate
 * upstream revision, so it becomes a conservatively labelled patch candidate
 * that the HITL hunk review classifies (B8), never an asserted local edit.
 *
 * **Example** (Check a drift class)
 *
 * ```ts
 * import { SkillDriftClass } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * console.log(SkillDriftClass.is["matches-upstream-head"]("matches-upstream-head")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillDriftClass = LiteralKit(["matches-upstream-head", "differs-from-upstream-head"]).pipe(
  $I.annoteSchema("SkillDriftClass", {
    description: "Whether a drifted installed file equals the tracking ref's current upstream head.",
  })
);

/**
 * How a drifted installed file compares with the tracking ref's current upstream head.
 *
 * **Example** (Annotate a drift class)
 *
 * ```ts
 * import type { SkillDriftClass } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const drift: SkillDriftClass = "matches-upstream-head"
 * console.log(drift)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillDriftClass = typeof SkillDriftClass.Type;

/**
 * One drifted path of a vendored skill, classified.
 *
 * **Example** (Record a file that differs from the upstream head)
 *
 * ```ts
 * import { SkillDriftRow } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const row = SkillDriftRow.make({ path: "SKILL.md", driftClass: "differs-from-upstream-head" })
 * console.log(row.driftClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillDriftRow extends S.Class<SkillDriftRow>($I`SkillDriftRow`)(
  {
    path: S.String,
    driftClass: SkillDriftClass,
  },
  $I.annote("SkillDriftRow", {
    description: "One installed path that differs from the pinned upstream snapshot, with its drift class.",
  })
) {}

/**
 * A skill with a ratified seed: a full warehouse entry plus its classified drift.
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
    drift: S.Array(SkillDriftRow),
    upstreamHead: SkillGitRevision,
  },
  $I.annote("VendoredMigrationRow", {
    description:
      "A seeded skill's computed warehouse entry, classified drift, and the upstream head it was compared with.",
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
 * a missing or divergent install, and an upstream that cannot be read at the
 * pin or the head (no entry is computed). The note names the cause.
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
 * `skills-lock-migration-plan/v1`: the read-only v1-to-v2 lock migration report.
 *
 * **Example** (Construct an empty plan)
 *
 * ```ts
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 *
 * const plan = SkillsLockMigrationPlan.make({ rows: [] })
 * console.log(plan.schemaVersion) // "skills-lock-migration-plan/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillsLockMigrationPlan extends S.Class<SkillsLockMigrationPlan>($I`SkillsLockMigrationPlan`)(
  {
    schemaVersion: S.tag("skills-lock-migration-plan/v1"),
    rows: S.Array(SkillMigrationRow),
  },
  $I.annote("SkillsLockMigrationPlan", {
    description: "Read-only per-skill v1-to-v2 lock migration report, sorted by skill name.",
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
