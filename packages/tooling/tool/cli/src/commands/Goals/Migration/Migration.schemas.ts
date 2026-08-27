/**
 * Typed packet-convention migration reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Migration/Migration.schemas");

/**
 * Finding severity used by migration and fleet-lint reports.
 *
 * **Example** (Distinguish blocking findings)
 *
 * ```ts
 * import { MigrationSeverity } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * console.log(MigrationSeverity.is.violation("violation")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MigrationSeverity = LiteralKit(["violation", "warning"]).pipe(
  $I.annoteSchema("MigrationSeverity", {
    description: "Packet migration finding severity: violations block apply; warnings do not.",
  })
);

/**
 * Migration finding severity.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MigrationSeverity = typeof MigrationSeverity.Type;

/**
 * Classification of one manifest-wire change.
 *
 * **Example** (Recognize additive drift)
 *
 * ```ts
 * import { DriftClassification } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * console.log(DriftClassification.is.additive("additive")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DriftClassification = LiteralKit(["breaking", "additive", "cosmetic"]).pipe(
  $I.annoteSchema("DriftClassification", {
    description: "Compatibility classification for one translated manifest change.",
  })
);

/**
 * Manifest drift classification.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DriftClassification = typeof DriftClassification.Type;

/**
 * Actual manifest shape observed before translation.
 *
 * **Example** (Record a half-migrated shape)
 *
 * ```ts
 * import { ManifestShapeProbe } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const probe = ManifestShapeProbe.make({
 *   slug: "demo",
 *   hasInitiative: true,
 *   hasLifecycle: false,
 *   hasPacketPath: true,
 *   hasCompletionGate: true,
 *   phaseShape: "array",
 * })
 * console.log(probe.hasLifecycle) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestShapeProbe extends S.Class<ManifestShapeProbe>($I`ManifestShapeProbe`)(
  {
    slug: S.String,
    declaredVersion: S.optionalKey(S.String),
    hasInitiative: S.Boolean,
    hasLifecycle: S.Boolean,
    hasPacketPath: S.Boolean,
    hasCompletionGate: S.Boolean,
    phaseShape: LiteralKit(["array", "record", "absent", "invalid"]),
  },
  $I.annote("ManifestShapeProbe", {
    description: "Observed goal-manifest field shape; declared version is evidence rather than dispatch authority.",
  })
) {}

/**
 * Explicit assumption made by one safe translation.
 *
 * **Example** (Record an assumption)
 *
 * ```ts
 * import { TranslationAssumption } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const item = TranslationAssumption.make({ slug: "demo", message: "lifecycle mirrors initiative.status" })
 * console.log(item.slug) // "demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranslationAssumption extends S.Class<TranslationAssumption>($I`TranslationAssumption`)(
  { slug: S.String, message: S.String },
  $I.annote("TranslationAssumption", { description: "One named assumption used by manifest translation." })
) {}

/**
 * One issue discovered by translation.
 *
 * **Example** (Record a blocking issue)
 *
 * ```ts
 * import { TranslationIssue } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const item = TranslationIssue.make({ slug: "demo", severity: "violation", message: "missing status" })
 * console.log(item.severity) // "violation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranslationIssue extends S.Class<TranslationIssue>($I`TranslationIssue`)(
  { slug: S.String, severity: MigrationSeverity, message: S.String },
  $I.annote("TranslationIssue", { description: "Manifest-translation issue with blocking severity." })
) {}

/**
 * Planned translation of one goal manifest.
 *
 * **Example** (Record an additive translation)
 *
 * ```ts
 * import { ManifestTranslation } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const item = ManifestTranslation.make({
 *   slug: "demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   afterVersion: "initiative-manifest/v2",
 *   drift: ["additive"],
 *   edits: ["add lifecycle"],
 *   content: "{}\n",
 * })
 * console.log(item.edits.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestTranslation extends S.Class<ManifestTranslation>($I`ManifestTranslation`)(
  {
    slug: S.String,
    manifestPath: S.String,
    beforeVersion: S.optionalKey(S.String),
    afterVersion: S.Literal("initiative-manifest/v2"),
    drift: S.Array(DriftClassification),
    edits: S.Array(S.String),
    content: S.String,
  },
  $I.annote("ManifestTranslation", { description: "One surgical v2 goal-manifest translation plan." })
) {}

/**
 * Result of probing and planning one manifest translation.
 *
 * **Example** (Represent a manifest that needs no translation)
 *
 * ```ts
 * import {
 *   ManifestShapeProbe,
 *   ManifestTranslationPlan,
 * } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 * import * as O from "effect/Option"
 *
 * const plan = ManifestTranslationPlan.make({
 *   probe: ManifestShapeProbe.make({
 *     slug: "demo",
 *     hasInitiative: true,
 *     hasLifecycle: true,
 *     hasPacketPath: true,
 *     hasCompletionGate: true,
 *     phaseShape: "array",
 *   }),
 *   translation: O.none(),
 *   issues: [],
 *   assumptions: [],
 * })
 * console.log(O.isNone(plan.translation)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestTranslationPlan extends S.Class<ManifestTranslationPlan>($I`ManifestTranslationPlan`)(
  {
    probe: ManifestShapeProbe,
    translation: S.Option(ManifestTranslation),
    issues: S.Array(TranslationIssue),
    assumptions: S.Array(TranslationAssumption),
  },
  $I.annote("ManifestTranslationPlan", {
    description: "Actual-shape probe, optional surgical translation, and explicit issues and assumptions.",
  })
) {}

/**
 * Fleet graph finding kinds.
 *
 * **Example** (Recognize a dependency cycle)
 *
 * ```ts
 * import { FleetLintFindingKind } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * console.log(FleetLintFindingKind.is["dependency-cycle"]("dependency-cycle")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetLintFindingKind = LiteralKit([
  "duplicate-slug",
  "dependency-cycle",
  "unreachable-packet",
  "unmigrated-reference",
]).pipe($I.annoteSchema("FleetLintFindingKind", { description: "Cross-packet graph integrity finding kinds." }));

/**
 * Cross-packet fleet-lint finding kind.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetLintFindingKind = typeof FleetLintFindingKind.Type;

/**
 * One cross-packet fleet-lint finding.
 *
 * **Example** (Record a dangling packet reference)
 *
 * ```ts
 * import { FleetLintFinding } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const item = FleetLintFinding.make({
 *   slug: "demo",
 *   kind: "unreachable-packet",
 *   severity: "violation",
 *   related: ["missing"],
 *   message: "blockedBy names a missing packet",
 * })
 * console.log(item.kind) // "unreachable-packet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLintFinding extends S.Class<FleetLintFinding>($I`FleetLintFinding`)(
  {
    slug: S.String,
    kind: FleetLintFindingKind,
    severity: MigrationSeverity,
    related: S.Array(S.String),
    message: S.String,
  },
  $I.annote("FleetLintFinding", { description: "One sorted cross-packet graph integrity finding." })
) {}

/**
 * Planned honest genesis event for one newly adopted stream.
 *
 * **Example** (Record a seed plan)
 *
 * ```ts
 * import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const seed = PacketGenesisSeed.make({
 *   slug: "demo",
 *   eventsDirectory: "goals/demo/ops/events",
 *   eventFileName: "00001-packet-created-deadbeef.json",
 *   eventText: "{}\n",
 *   tracePath: "goals/demo/ops/trace.json",
 *   traceText: "{}\n",
 * })
 * console.log(seed.slug) // "demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketGenesisSeed extends S.Class<PacketGenesisSeed>($I`PacketGenesisSeed`)(
  {
    slug: S.String,
    eventsDirectory: S.String,
    eventFileName: S.String,
    eventText: S.String,
    tracePath: S.String,
    traceText: S.String,
  },
  $I.annote("PacketGenesisSeed", { description: "One honest current-snapshot genesis event and trace plan." })
) {}

/**
 * Deterministic report from one fleet migration preview or apply.
 *
 * **Example** (Construct an empty preview report)
 *
 * ```ts
 * import { TranslationReport } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const report = TranslationReport.make({
 *   schemaVersion: "packet-convention-report/v1",
 *   mode: "preview",
 *   probes: [],
 *   translations: [],
 *   issues: [],
 *   assumptions: [],
 *   fleetFindings: [],
 *   seeds: [],
 * })
 * console.log(report.translations.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranslationReport extends S.Class<TranslationReport>($I`TranslationReport`)(
  {
    schemaVersion: S.Literal("packet-convention-report/v1"),
    mode: LiteralKit(["preview", "apply"]),
    probes: S.Array(ManifestShapeProbe),
    translations: S.Array(ManifestTranslation),
    issues: S.Array(TranslationIssue),
    assumptions: S.Array(TranslationAssumption),
    fleetFindings: S.Array(FleetLintFinding),
    seeds: S.Array(PacketGenesisSeed),
  },
  $I.annote("TranslationReport", {
    description: "Deterministic packet-convention migration report with explicit issues and assumptions.",
  })
) {}
