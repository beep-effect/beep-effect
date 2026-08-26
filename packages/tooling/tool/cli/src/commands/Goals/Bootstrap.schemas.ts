/**
 * Materialization-plan schemas for `beep goals bootstrap|adopt --plan`.
 *
 * **Details**
 *
 * Workstream E phase 0 of the knowledge-surface-automation initiative ships
 * plan-only commands: a pure compiler maps a decoded {@link BootstrapInput}
 * (or a read-only {@link PacketSnapshot}) to a content-addressed
 * {@link MaterializationPlan} that fully describes the intended change —
 * payload bytes included — without any writer existing. These schemas are the
 * shared dry-run contract for bootstrap, graduation, adoption, and future
 * editor tooling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CapabilitySlug, GoalManifest, GoalStatus } from "./Goals.schemas.ts";
import type { GoalDoctorFindingKind } from "./Doctor.ts";

const $I = $RepoCliId.create("commands/Goals/Bootstrap.schemas");

/**
 * Constrained goal-packet slug grammar.
 *
 * **Details**
 *
 * Reuses the lowercase-segment grammar ratified for capability-slug segments
 * (decision D1) with the packet-slug length budget: lowercase ASCII segments
 * joined by single hyphens, at most 64 characters. Path separators, traversal
 * (`..`), uppercase, whitespace, and the reserved `_template` slug are all
 * rejected at decode rather than by a downstream guard.
 *
 * **Example** (Accept a packet slug and reject traversal)
 *
 * ```ts
 * import { GoalSlug } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalSlug)("knowledge-surface-automation")) // true
 * console.log(S.is(GoalSlug)("../escape")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalSlug = S.String.check(
  S.isPattern(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
    identifier: $I`GoalSlugPatternCheck`,
    title: "Goal Slug Pattern",
    description: "Lowercase ASCII slug segments joined by single hyphens.",
    message: "Expected a lowercase goal slug with internal single hyphens only",
  }),
  S.isMaxLength(64, {
    identifier: $I`GoalSlugLengthCheck`,
    title: "Goal Slug Length",
    description: "A goal slug is at most 64 characters.",
    message: "Expected a goal slug with at most 64 characters",
  })
).pipe(
  $I.annoteSchema("GoalSlug", {
    description: "Constrained lowercase goal-packet slug; traversal and the template slug fail the grammar.",
  })
);

/**
 * Constrained goal-packet slug.
 *
 * **Example** (Annotate a slug value)
 *
 * ```ts
 * import type { GoalSlug } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const slug: GoalSlug = "goals-graph"
 * console.log(slug)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalSlug = typeof GoalSlug.Type;

/**
 * Which compiler produced a plan.
 *
 * **Example** (Narrow a plan mode)
 *
 * ```ts
 * import { PlanMode } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(PlanMode.is.bootstrap("bootstrap")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanMode = LiteralKit(["bootstrap", "adopt"]).pipe(
  $I.annoteSchema("PlanMode", { description: "Which compiler produced this plan." })
);

/**
 * Which compiler produced a plan.
 *
 * **Example** (Annotate a mode value)
 *
 * ```ts
 * import type { PlanMode } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const mode: PlanMode = "adopt"
 * console.log(mode)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PlanMode = typeof PlanMode.Type;

/**
 * Who owns a path's bytes after materialization.
 *
 * **Details**
 *
 * `generated` bytes derive entirely from machine inputs and may be
 * rematerialized; `generated-seed` bytes are written once and human-owned
 * immediately after; `authored` bytes are human-owned from the start;
 * `preserved` bytes must survive byte-for-byte (the manifest byte-preserving
 * rule).
 *
 * **Example** (Narrow an ownership value)
 *
 * ```ts
 * import { PlanOwnership } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(PlanOwnership.is["generated-seed"]("generated-seed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanOwnership = LiteralKit(["generated", "generated-seed", "authored", "preserved"]).pipe(
  $I.annoteSchema("PlanOwnership", { description: "Who owns a path's bytes after materialization." })
);

/**
 * Who owns a path's bytes after materialization.
 *
 * **Example** (Annotate an ownership value)
 *
 * ```ts
 * import type { PlanOwnership } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const ownership: PlanOwnership = "authored"
 * console.log(ownership)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PlanOwnership = typeof PlanOwnership.Type;

/**
 * What a later executor would do to one path.
 *
 * **Details**
 *
 * `create` writes new bytes; `retain` leaves a conforming file untouched;
 * `preserve` keeps existing bytes byte-for-byte while enumerating what must
 * not be lost; `report` names a gap a human resolves — diagnosis never
 * mutates, and it never invents prose.
 *
 * **Example** (Narrow an action value)
 *
 * ```ts
 * import { PlanAction } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(PlanAction.is.report("report")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanAction = LiteralKit(["create", "retain", "preserve", "report"]).pipe(
  $I.annoteSchema("PlanAction", { description: "What the executor would do to one path." })
);

/**
 * What a later executor would do to one path.
 *
 * **Example** (Annotate an action value)
 *
 * ```ts
 * import type { PlanAction } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const action: PlanAction = "retain"
 * console.log(action)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PlanAction = typeof PlanAction.Type;

/**
 * A check the executor must pass against the prospective overlay before publish.
 *
 * **Example** (Narrow a validation requirement)
 *
 * ```ts
 * import { ValidationRequirement } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(ValidationRequirement.is["manifest-decodes"]("manifest-decodes")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValidationRequirement = LiteralKit([
  "manifest-decodes",
  "doctor-clean",
  "index-regenerates",
  "links-resolve",
  "reflection-frontmatter-valid",
  "goal-md-within-budget",
  "readme-lifecycle-line",
]).pipe(
  $I.annoteSchema("ValidationRequirement", {
    description: "A check the executor must pass against the prospective overlay before publish.",
  })
);

/**
 * A check the executor must pass before publish.
 *
 * **Example** (Annotate a validation value)
 *
 * ```ts
 * import type { ValidationRequirement } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const validation: ValidationRequirement = "doctor-clean"
 * console.log(validation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ValidationRequirement = typeof ValidationRequirement.Type;

/**
 * Why plan compilation failed closed.
 *
 * **Example** (Narrow a conflict reason)
 *
 * ```ts
 * import { PlanConflictReason } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(PlanConflictReason.is["slug-exists"]("slug-exists")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanConflictReason = LiteralKit(["slug-exists", "packet-not-found", "manifest-unparseable"]).pipe(
  $I.annoteSchema("PlanConflictReason", {
    description: "Why plan compilation failed closed instead of emitting entries.",
  })
);

/**
 * Why plan compilation failed closed.
 *
 * **Example** (Annotate a conflict reason)
 *
 * ```ts
 * import type { PlanConflictReason } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const reason: PlanConflictReason = "slug-exists"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PlanConflictReason = typeof PlanConflictReason.Type;

/**
 * Ordered goal-phase archetypes the bootstrap compiler expands.
 *
 * **Details**
 *
 * `standard-delivery` expands to the five `goals/_template` phases (Research,
 * Implement, Verify, Yeet, Close); `report-first` expands to the phase-0
 * report shape the knowledge-surface-automation packet itself uses (read-only
 * report, FP eyeball, gated mutation, Yeet, Close). Archetypes are defaults,
 * not a closed set — explicit phase lists stay expressible in later slices.
 *
 * **Example** (Narrow an archetype)
 *
 * ```ts
 * import { PhaseArchetype } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(PhaseArchetype.is["standard-delivery"]("standard-delivery")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhaseArchetype = LiteralKit(["standard-delivery", "report-first"]).pipe(
  $I.annoteSchema("PhaseArchetype", {
    description: "Named ordered phase shape a bootstrap plan expands into stable-ID phases.",
  })
);

/**
 * Ordered goal-phase archetype.
 *
 * **Example** (Annotate an archetype value)
 *
 * ```ts
 * import type { PhaseArchetype } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const archetype: PhaseArchetype = "report-first"
 * console.log(archetype)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PhaseArchetype = typeof PhaseArchetype.Type;

/**
 * Lowercase SHA-256 hex digest carried by plan rows and snapshots.
 *
 * **Example** (Validate a digest string)
 *
 * ```ts
 * import { PlanDigest } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PlanDigest)("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PlanDigest = S.String.check(
  S.isPattern(/^[0-9a-f]{64}$/, {
    identifier: $I`PlanDigestPatternCheck`,
    title: "Plan Digest Pattern",
    description: "A lowercase 64-character SHA-256 hex digest.",
    message: "Expected a lowercase 64-character SHA-256 hex digest",
  })
).pipe(
  $I.annoteSchema("PlanDigest", {
    description: "Lowercase SHA-256 hex digest of exact file bytes.",
  })
);

/**
 * Lowercase SHA-256 hex digest.
 *
 * **Example** (Annotate a digest value)
 *
 * ```ts
 * import type { PlanDigest } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const digest: PlanDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * console.log(digest.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PlanDigest = typeof PlanDigest.Type;

/**
 * Content address of one compiled plan.
 *
 * **Details**
 *
 * The digest half is the SHA-256 of the compact canonical JSON encoding of
 * every plan field except `planId` itself, so an adoption patch is hash-pinned
 * and a later executor refuses to apply a plan whose tree moved.
 *
 * **Example** (Validate a plan id)
 *
 * ```ts
 * import { MaterializationPlanId } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(MaterializationPlanId)(
 *     "goal-plan/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   )
 * ) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MaterializationPlanId = S.String.check(
  S.isPattern(/^goal-plan\/v1:[0-9a-f]{64}$/, {
    identifier: $I`MaterializationPlanIdPatternCheck`,
    title: "Materialization Plan Id Pattern",
    description: "goal-plan/v1: followed by a lowercase SHA-256 hex digest.",
    message: "Expected goal-plan/v1: followed by a lowercase SHA-256 hex digest",
  })
).pipe(
  $I.annoteSchema("MaterializationPlanId", {
    description: "Content address of one compiled plan.",
  })
);

/**
 * Content address of one compiled plan.
 *
 * **Example** (Annotate a plan id value)
 *
 * ```ts
 * import type { MaterializationPlanId } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const planId: MaterializationPlanId =
 *   "goal-plan/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * console.log(planId.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MaterializationPlanId = typeof MaterializationPlanId.Type;

/**
 * One reason plan compilation failed closed.
 *
 * **Example** (Construct a slug-exists conflict)
 *
 * ```ts
 * import { PlanConflict } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const conflict = PlanConflict.make({
 *   reason: "slug-exists",
 *   message: 'Packet "goals/x" already exists.',
 * })
 * console.log(conflict.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanConflict extends S.Class<PlanConflict>($I`PlanConflict`)(
  {
    reason: PlanConflictReason,
    message: S.String,
  },
  $I.annote("PlanConflict", {
    description: "One reason plan compilation failed closed; a conflicted plan emits no entries.",
  })
) {}

/**
 * One path the plan would create, retain, preserve, or report.
 *
 * **Details**
 *
 * `payload` carries the complete bytes a `create` entry would write, which is
 * what makes plans golden-testable and lets a later executor replay a
 * reviewed, hash-pinned artifact. `existingDigest` pins the current bytes of
 * `retain`/`preserve` entries so a stale plan refuses rather than clobbering.
 *
 * **Example** (Construct a retain entry)
 *
 * ```ts
 * import { PlanEntry } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const entry = PlanEntry.make({
 *   path: "goals/x/SPEC.md",
 *   action: "retain",
 *   ownership: "authored",
 *   reason: "Tracked packet file conforms to the standard.",
 * })
 * console.log(entry.action)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanEntry extends S.Class<PlanEntry>($I`PlanEntry`)(
  {
    path: S.String,
    action: PlanAction,
    ownership: PlanOwnership,
    reason: S.String,
    payload: S.optionalKey(S.String),
    payloadDigest: S.optionalKey(PlanDigest),
    existingDigest: S.optionalKey(PlanDigest),
  },
  $I.annote("PlanEntry", { description: "One path the plan would create, retain, preserve, or report." })
) {}

/**
 * Bytes and unmodeled keys adoption must not lose.
 *
 * **Details**
 *
 * The canonical manifest decoder accepts unknown top-level keys and strips
 * them from decoded output; re-encoding a decoded manifest would silently
 * delete them. A preservation row enumerates every unmodeled key with a digest
 * of the pre-image so a later hash-pinned adoption patch binds to the exact
 * bytes reviewed.
 *
 * **Example** (Construct a preservation row)
 *
 * ```ts
 * import { PlanPreservation } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const preservation = PlanPreservation.make({
 *   path: "goals/x/ops/manifest.json",
 *   unmodeledKeys: ["researchReports"],
 *   preImageDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   reason: "Unmodeled manifest keys survive only through byte-preserving JSONC edits.",
 * })
 * console.log(preservation.unmodeledKeys.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanPreservation extends S.Class<PlanPreservation>($I`PlanPreservation`)(
  {
    path: S.String,
    unmodeledKeys: S.Array(S.String),
    preImageDigest: PlanDigest,
    reason: S.String,
  },
  $I.annote("PlanPreservation", { description: "Bytes and unmodeled keys adoption must not lose." })
) {}

/**
 * Deterministic, content-addressed materialization intent.
 *
 * **Details**
 *
 * The plan is the complete description of the intended change: every path with
 * its action, ownership, and payload bytes; every preservation obligation; the
 * validation set a later executor must satisfy; and any conflicts that made
 * compilation fail closed (a conflicted plan carries no entries). Adoption
 * plans additionally record the archetype they measured against and the
 * `goals/_template` snapshot hash, making the measurement basis explicit under
 * template drift.
 *
 * **Example** (Inspect the schema identifier)
 *
 * ```ts
 * import { MaterializationPlan } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(typeof MaterializationPlan.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MaterializationPlan extends S.Class<MaterializationPlan>($I`MaterializationPlan`)(
  {
    schemaVersion: S.tag("goal-materialization-plan/v1"),
    compilerVersion: S.tag("goal-materialization-compiler/v1"),
    planId: MaterializationPlanId,
    mode: PlanMode,
    slug: S.String,
    packetPath: S.String,
    entries: S.Array(PlanEntry),
    preservations: S.Array(PlanPreservation),
    validations: S.Array(ValidationRequirement),
    conflicts: S.Array(PlanConflict),
    towardArchetype: S.optionalKey(PhaseArchetype),
    templateSnapshotHash: S.optionalKey(PlanDigest),
  },
  $I.annote("MaterializationPlan", { description: "Deterministic, content-addressed materialization intent." })
) {}

/**
 * Everything the pure bootstrap compiler needs; no ambient state.
 *
 * **Details**
 *
 * `today` is an explicit input, not a clock read — a compiler that reads the
 * clock is not a pure function and its golden fixtures rot daily. Defaults
 * mirror the packet standard: `active` status, the `standard-delivery`
 * archetype, execution-capable, reflection-required, and empty capability
 * edges.
 *
 * **Example** (Construct a minimal input)
 *
 * ```ts
 * import { BootstrapInput } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const input = BootstrapInput.make({
 *   slug: "example-goal",
 *   title: "Example Goal",
 *   mission: "Prove the plan compiler.",
 *   today: "2026-08-17",
 * })
 * console.log(input.archetype) // "standard-delivery"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BootstrapInput extends S.Class<BootstrapInput>($I`BootstrapInput`)(
  {
    slug: GoalSlug,
    title: S.String,
    mission: S.String,
    status: GoalStatus.pipe(S.withConstructorDefault(Effect.succeed(GoalStatus.Enum.active))),
    archetype: PhaseArchetype.pipe(S.withConstructorDefault(Effect.succeed(PhaseArchetype.Enum["standard-delivery"]))),
    executionCapable: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    reflectionRequired: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    provides: S.Array(CapabilitySlug).pipe(S.withConstructorDefault(Effect.succeed(A.empty<CapabilitySlug>()))),
    requires: S.Array(CapabilitySlug).pipe(S.withConstructorDefault(Effect.succeed(A.empty<CapabilitySlug>()))),
    provenanceExploration: S.optionalKey(S.String),
    today: S.String.check(
      S.isPattern(/^\d{4}-\d{2}-\d{2}$/, {
        identifier: $I`BootstrapTodayPatternCheck`,
        title: "Bootstrap Today Pattern",
        description: "An explicit ISO date (YYYY-MM-DD) input.",
        message: "Expected an explicit ISO date (YYYY-MM-DD)",
      })
    ),
  },
  $I.annote("BootstrapInput", { description: "Everything the pure bootstrap compiler needs; no ambient state." })
) {}

/**
 * One file captured by a read-only packet snapshot.
 *
 * **Example** (Construct a snapshot file)
 *
 * ```ts
 * import { PacketSnapshotFile } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const file = PacketSnapshotFile.make({
 *   path: "README.md",
 *   text: "# Example\n",
 *   digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 * })
 * console.log(file.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketSnapshotFile extends S.Class<PacketSnapshotFile>($I`PacketSnapshotFile`)(
  {
    path: S.String,
    text: S.String,
    digest: PlanDigest,
  },
  $I.annote("PacketSnapshotFile", {
    description: "One packet-relative file with its exact text and SHA-256 digest.",
  })
) {}

/**
 * Decoded value boundary between packet reads and pure adoption compilation.
 *
 * **Details**
 *
 * `readPacketSnapshot` only ever calls read members of `FileSystem`; once this
 * value exists, adoption is a pure function of it, which is what makes the
 * adoption plan golden-testable. `templateFiles` carries the current
 * `goals/_template` tree (the standard the packet is measured against) and
 * `templateSnapshotHash` pins that measurement basis under template drift.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { PacketSnapshot } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const snapshot = PacketSnapshot.make({
 *   slug: "example-goal",
 *   packetPath: "goals/example-goal",
 *   exists: false,
 *   files: [],
 *   templateFiles: [],
 *   templateSnapshotHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 * })
 * console.log(snapshot.exists)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketSnapshot extends S.Class<PacketSnapshot>($I`PacketSnapshot`)(
  {
    slug: S.String,
    packetPath: S.String,
    exists: S.Boolean,
    files: S.Array(PacketSnapshotFile),
    templateFiles: S.Array(PacketSnapshotFile),
    templateSnapshotHash: PlanDigest,
  },
  $I.annote("PacketSnapshot", {
    description: "Read-only packet and template capture that pure adoption compilation consumes.",
  })
) {}

/**
 * Top-level manifest keys the `GoalManifest` schema models.
 *
 * **Details**
 *
 * The canonical decoder strips every other top-level key from decoded output,
 * so adoption enumerates `unmodeledKeys` as the set difference against this
 * list. The list is derived from the `GoalManifest` class fields, so it cannot
 * drift from the schema; the preservation counterfactual test proves the naive
 * decode-encode round trip loses exactly the keys outside it.
 *
 * **Example** (Check a modeled key)
 *
 * ```ts
 * import { MODELED_GOAL_MANIFEST_KEYS } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import * as A from "effect/Array"
 *
 * console.log(A.contains(MODELED_GOAL_MANIFEST_KEYS, "initiative")) // true
 * console.log(A.contains(MODELED_GOAL_MANIFEST_KEYS, "researchReports")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MODELED_GOAL_MANIFEST_KEYS: ReadonlyArray<string> = R.keys(GoalManifest.fields);

const VALIDATION_REQUIREMENTS_BY_FINDING_KIND: Readonly<
  Record<GoalDoctorFindingKind, ReadonlyArray<ValidationRequirement>>
> = {
  "manifest-missing": ["manifest-decodes"],
  "manifest-invalid": ["manifest-decodes"],
  "lifecycle-mismatch": ["readme-lifecycle-line", "doctor-clean"],
  "readme-status-line": ["readme-lifecycle-line", "doctor-clean"],
  "goal-md-oversize": ["goal-md-within-budget"],
  "phases-terminal-but-active": ["doctor-clean"],
  "reflection-frontmatter-invalid": ["reflection-frontmatter-valid"],
  "stale-active": [],
  "active-missing-goal-md": [],
  "schema-version-upgrade": [],
  "completion-gate-unsatisfied": [],
  "superseded-without-pointer": [],
  "exploration-backlink-missing": [],
  "packet-status-drift": [],
  "packet-stream-fork": [],
  "packet-stream-integrity": [],
  "packet-trace-stale": [],
  "packet-trace-missing": [],
};

/**
 * Maps one goals-doctor finding kind onto executor validation requirements.
 *
 * **Details**
 *
 * Doctor stays the diagnostic; adoption is the remediation plan. Every
 * blocking finding kind maps to at least one {@link ValidationRequirement}
 * the executor must satisfy against the prospective overlay; advisory kinds
 * map to none. The backing record is exhaustive over
 * `GoalDoctorFindingKind`, so a new doctor finding fails compilation here
 * until it is mapped.
 *
 * **Example** (Map a blocking finding)
 *
 * ```ts
 * import { validationRequirementsForGoalDoctorFinding } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * console.log(validationRequirementsForGoalDoctorFinding("goal-md-oversize")) // ["goal-md-within-budget"]
 * ```
 *
 * @param kind - The goals-doctor finding kind to map.
 * @returns The validation requirements the executor must satisfy.
 * @category mapping
 * @since 0.0.0
 */
export const validationRequirementsForGoalDoctorFinding = (
  kind: GoalDoctorFindingKind
): ReadonlyArray<ValidationRequirement> => VALIDATION_REQUIREMENTS_BY_FINDING_KIND[kind];
