/**
 * Capability-graph schemas for `beep goals next|explain|catalog`.
 *
 * **Details**
 *
 * Three layers, each a schema value:
 *
 * 1. {@link CapabilityProjection} — the four normalized row families compiled
 *    from decoded manifests (packets, capabilities, provides edges, requires
 *    edges) plus the duplicate declarations the compiler collapsed.
 * 2. {@link CapabilityGraphAnswers} — the engine-neutral answers to the four
 *    graph questions (availability, fog, frontier, cycles, unlock walks). The
 *    `bun:sqlite` engine and the pure-TypeScript reference evaluator both
 *    produce this value; the differential test compares their canonical JSON.
 * 3. The versioned reports (`goal-frontier/v1`, `goal-explain/v1`,
 *    `capability-catalog/v1`) built from a projection plus its answers.
 *
 * Readiness is nominal in v1: only manifest status counts. Evidence-backed
 * readiness (D9/D10) lands beside it later as an additive field.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { CapabilitySlug, GoalCloseoutView, GoalStatus } from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Graph.schemas");

/**
 * Readiness basis of a graph report.
 *
 * **Details**
 *
 * v1 has one member: `nominal`, readiness derived from manifest status alone.
 * Evidence-backed readiness joins as a second member once the
 * `goal-evidence/v1` ledger exists, so renderers written now need no breaking
 * change.
 *
 * **Example** (Check the readiness basis)
 *
 * ```ts
 * import { CapabilityReadiness } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * console.log(CapabilityReadiness.is.nominal("nominal")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapabilityReadiness = LiteralKit(["nominal"]).pipe(
  $I.annoteSchema("CapabilityReadiness", {
    description: "Readiness basis of a capability-graph report; nominal means manifest status only.",
  })
);

/**
 * Readiness basis of a graph report.
 *
 * **Example** (Annotate a readiness value)
 *
 * ```ts
 * import type { CapabilityReadiness } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const readiness: CapabilityReadiness = "nominal"
 * console.log(readiness)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CapabilityReadiness = typeof CapabilityReadiness.Type;

/**
 * Which manifest array a duplicate capability declaration came from.
 *
 * **Example** (Narrow an edge kind)
 *
 * ```ts
 * import { CapabilityEdgeKind } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * console.log(CapabilityEdgeKind.is.provides("provides")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapabilityEdgeKind = LiteralKit(["provides", "requires"]).pipe(
  $I.annoteSchema("CapabilityEdgeKind", {
    description: "Manifest array a capability declaration came from.",
  })
);

/**
 * Which manifest array a duplicate capability declaration came from.
 *
 * **Example** (Annotate an edge kind)
 *
 * ```ts
 * import type { CapabilityEdgeKind } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const kind: CapabilityEdgeKind = "requires"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CapabilityEdgeKind = typeof CapabilityEdgeKind.Type;

/**
 * One packet row in the capability projection.
 *
 * **Details**
 *
 * `packetId` is the manifest's `initiative.id`. A missing `executionCapable`
 * compiles to `false`: the frontier is fail-closed, so an undeclared packet is
 * never offered as agent work.
 *
 * **Example** (Construct a packet row)
 *
 * ```ts
 * import { GraphPacketRow } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const row = GraphPacketRow.make({
 *   packetId: "goals-doctor",
 *   status: "active",
 *   executionCapable: true,
 *   title: "Goals doctor",
 * })
 * console.log(row.packetId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphPacketRow extends S.Opaque<GraphPacketRow, { readonly brand: unique symbol }>()(
  S.Struct({
    packetId: S.String,
    status: GoalStatus,
    executionCapable: S.Boolean,
    title: S.String,
    mission: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GraphPacketRow", {
      description: "One packet in the capability projection with its status and execution capability.",
    })
  )
) {}

/**
 * One deduplicated capability edge between a packet and a capability.
 *
 * **Example** (Construct a provides edge)
 *
 * ```ts
 * import { GraphCapabilityEdge } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const edge = GraphCapabilityEdge.make({ packetId: "goals-doctor", capability: "goals/graph" })
 * console.log(edge.capability)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphCapabilityEdge extends S.Opaque<GraphCapabilityEdge, { readonly brand: unique symbol }>()(
  S.Struct({
    packetId: S.String,
    capability: CapabilitySlug,
  }).pipe(
    $I.annoteSchema("GraphCapabilityEdge", {
      description: "One deduplicated provides or requires edge between a packet and a capability.",
    })
  )
) {}

/**
 * A capability a packet listed more than once in one manifest array (D5).
 *
 * **Details**
 *
 * The projection keeps one edge per pair; the repeat is recorded here so the
 * catalog can report it.
 *
 * **Example** (Record a repeated requirement)
 *
 * ```ts
 * import { DuplicateCapabilityDeclaration } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const duplicate = DuplicateCapabilityDeclaration.make({
 *   packetId: "lane-bootstrap",
 *   capability: "fleet/registry",
 *   edge: "requires",
 * })
 * console.log(duplicate.edge)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuplicateCapabilityDeclaration extends S.Opaque<
  DuplicateCapabilityDeclaration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    packetId: S.String,
    capability: CapabilitySlug,
    edge: CapabilityEdgeKind,
  }).pipe(
    $I.annoteSchema("DuplicateCapabilityDeclaration", {
      description: "A capability listed more than once in one manifest provides or requires array.",
    })
  )
) {}

const UniquePacketIdsCheck = S.makeFilter(
  (projection: { readonly packets: ReadonlyArray<GraphPacketRow> }) =>
    A.length(A.dedupe(A.map(projection.packets, (packet) => packet.packetId))) === A.length(projection.packets),
  $I.annote("CapabilityProjectionUniquePacketIdsCheck", {
    title: "Capability Projection Unique Packet Ids",
    description: "Every packet row in a capability projection has a distinct packet id.",
    message: "A capability projection cannot contain a duplicate packet id",
  })
);

/**
 * The normalized capability projection compiled from decoded manifests.
 *
 * **Details**
 *
 * Every array is sorted and duplicate-free: `packets` by id, `capabilities`
 * lexically, `provides` by capability then packet, `requires` by packet then
 * capability, `duplicates` by packet, edge kind, then capability. Discovery
 * order never changes the value. Packet ids must be unique; a projection with
 * a repeated id is rejected at construction, because "last status wins" would
 * make the answers depend on input order.
 *
 * **Example** (Construct an empty projection)
 *
 * ```ts
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const projection = CapabilityProjection.make({
 *   packets: [],
 *   capabilities: [],
 *   provides: [],
 *   requires: [],
 *   duplicates: [],
 * })
 * console.log(projection.packets.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityProjection extends S.Opaque<CapabilityProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    packets: S.Array(GraphPacketRow),
    capabilities: S.Array(CapabilitySlug),
    provides: S.Array(GraphCapabilityEdge),
    requires: S.Array(GraphCapabilityEdge),
    duplicates: S.Array(DuplicateCapabilityDeclaration),
  })
    .check(UniquePacketIdsCheck)
    .pipe(
      $I.annoteSchema("CapabilityProjection", {
        description: "Sorted, duplicate-free packet and capability rows compiled from decoded goal manifests.",
      })
    )
) {}

/**
 * One packet reached by an unlock walk, at its minimum depth.
 *
 * **Example** (Construct an unlock depth)
 *
 * ```ts
 * import { UnlockDepth } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const step = UnlockDepth.make({ slug: "fleet-root-registry", depth: 1 })
 * console.log(step.depth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnlockDepth extends S.Opaque<UnlockDepth, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    depth: S.Int,
  }).pipe(
    $I.annoteSchema("UnlockDepth", {
      description: "A packet reached by an unlock walk, at the minimum depth it was reached.",
    })
  )
) {}

/**
 * The unlock walk computed for one target packet.
 *
 * **Example** (Construct an empty walk)
 *
 * ```ts
 * import { PacketUnlockWalk } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const walk = PacketUnlockWalk.make({ slug: "lane-bootstrap", steps: [] })
 * console.log(walk.steps.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketUnlockWalk extends S.Opaque<PacketUnlockWalk, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    steps: S.Array(UnlockDepth),
  }).pipe(
    $I.annoteSchema("PacketUnlockWalk", {
      description: "Every packet reachable from a target through unavailable-requirement provider edges.",
    })
  )
) {}

/**
 * Engine-neutral answers to the capability-graph questions.
 *
 * **Details**
 *
 * - `available`: capabilities with at least one `completed-retained` provider.
 * - `fog`: required capabilities with no buildable provider (`active`,
 *   `paused`, or `completed-retained`), per D8.
 * - `frontier`: `active`, execution-capable packets whose requirements are all
 *   available.
 * - `cycles`: strongly connected components (two or more packets) of the
 *   "unavailable requirement → candidate provider" graph, members sorted.
 * - `unlock`: per packet, every packet reachable through those edges at its
 *   minimum depth, ordered by depth then slug.
 *
 * A candidate provider has status `active` or `paused`. The SQL engine and the
 * reference evaluator must produce byte-identical canonical JSON for this value.
 *
 * **Example** (Construct empty answers)
 *
 * ```ts
 * import { CapabilityGraphAnswers } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const answers = CapabilityGraphAnswers.make({
 *   available: [],
 *   fog: [],
 *   frontier: [],
 *   cycles: [],
 *   unlock: [],
 * })
 * console.log(answers.frontier.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityGraphAnswers extends S.Opaque<CapabilityGraphAnswers, { readonly brand: unique symbol }>()(
  S.Struct({
    available: S.Array(CapabilitySlug),
    fog: S.Array(CapabilitySlug),
    frontier: S.Array(S.String),
    cycles: S.String.pipe(S.Array, S.Array),
    unlock: S.Array(PacketUnlockWalk),
  }).pipe(
    $I.annoteSchema("CapabilityGraphAnswers", {
      description: "Engine-neutral availability, fog, frontier, cycle, and unlock answers over one projection.",
    })
  )
) {}

/**
 * One provider of a capability with the status that decides whether it counts.
 *
 * **Example** (Construct a provider row)
 *
 * ```ts
 * import { CapabilityProviderRow } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const provider = CapabilityProviderRow.make({
 *   capability: "tooling/harness-ledger",
 *   provider: "harness-evidence-ledger",
 *   providerStatus: "completed-retained",
 *   satisfies: true,
 * })
 * console.log(provider.satisfies)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityProviderRow extends S.Opaque<CapabilityProviderRow, { readonly brand: unique symbol }>()(
  S.Struct({
    capability: CapabilitySlug,
    provider: S.String,
    providerStatus: GoalStatus,
    satisfies: S.Boolean,
  }).pipe(
    $I.annoteSchema("CapabilityProviderRow", {
      description: "One provider of a capability; satisfies is true only for completed-retained providers.",
    })
  )
) {}

/**
 * One requirement of a packet, with every provider that could satisfy it.
 *
 * **Example** (Construct a fog requirement)
 *
 * ```ts
 * import { GoalRequirementRow } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const requirement = GoalRequirementRow.make({
 *   capability: "box/driver",
 *   satisfied: false,
 *   providers: [],
 *   fog: true,
 * })
 * console.log(requirement.fog)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalRequirementRow extends S.Opaque<GoalRequirementRow, { readonly brand: unique symbol }>()(
  S.Struct({
    capability: CapabilitySlug,
    satisfied: S.Boolean,
    providers: S.Array(CapabilityProviderRow),
    fog: S.Boolean,
  }).pipe(
    $I.annoteSchema("GoalRequirementRow", {
      description: "A packet requirement with its OR-alternative providers and fog flag.",
    })
  )
) {}

/**
 * One packet on the actionable frontier.
 *
 * **Example** (Construct a frontier entry)
 *
 * ```ts
 * import { GoalFrontierEntry } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const entry = GoalFrontierEntry.make({ slug: "m365-agent-outbox", title: "M365 outbox", requirements: [] })
 * console.log(entry.slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalFrontierEntry extends S.Opaque<GoalFrontierEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    title: S.String,
    mission: S.optionalKey(S.String),
    requirements: S.Array(GoalRequirementRow),
  }).pipe(
    $I.annoteSchema("GoalFrontierEntry", {
      description: "An active, execution-capable packet whose requirements are all nominally satisfied.",
    })
  )
) {}

/**
 * `goal-frontier/v1` — the worklist report printed by `beep goals next`.
 *
 * **Example** (Construct an empty frontier report)
 *
 * ```ts
 * import { GoalFrontierReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const report = GoalFrontierReport.make({ readiness: "nominal", frontier: [], fog: [], cycles: [] })
 * console.log(report.schemaVersion) // "goal-frontier/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalFrontierReport extends S.Opaque<GoalFrontierReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("goal-frontier/v1"),
    readiness: CapabilityReadiness,
    frontier: S.Array(GoalFrontierEntry),
    fog: S.Array(CapabilitySlug),
    cycles: S.String.pipe(S.Array, S.Array),
  }).pipe(
    $I.annoteSchema("GoalFrontierReport", {
      description: "Actionable goal frontier with fog capabilities and requirement cycles.",
    })
  )
) {}

/**
 * One packet on a target's unlock walk.
 *
 * **Details**
 *
 * `executionCapable: false` steps stay in the walk, annotated (D7): the honest
 * answer is "this step needs non-agent work", not "no path".
 *
 * **Example** (Construct an unlock step)
 *
 * ```ts
 * import { GoalUnlockStep } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const step = GoalUnlockStep.make({
 *   slug: "fleet-root-registry",
 *   depth: 1,
 *   status: "active",
 *   executionCapable: true,
 *   ready: true,
 *   provides: ["fleet/registry", "fleet/root-config"],
 * })
 * console.log(step.depth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalUnlockStep extends S.Opaque<GoalUnlockStep, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    depth: S.Int,
    status: GoalStatus,
    executionCapable: S.Boolean,
    ready: S.Boolean,
    provides: S.Array(CapabilitySlug),
  }).pipe(
    $I.annoteSchema("GoalUnlockStep", {
      description: "A packet on an unlock walk with its depth, status, and execution annotation.",
    })
  )
) {}

/**
 * `goal-explain/v1` — why one packet is or is not ready, printed by `beep goals explain`.
 *
 * **Details**
 *
 * `unlockPath` is empty when the packet is ready or sits in a cycle; a cyclic
 * packet reports its sorted strongly connected component in `cycle` instead.
 *
 * **Example** (Construct a ready explanation)
 *
 * ```ts
 * import { GoalExplainReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const report = GoalExplainReport.make({
 *   readiness: "nominal",
 *   slug: "m365-agent-outbox",
 *   status: "active",
 *   executionCapable: true,
 *   ready: true,
 *   frontier: true,
 *   requirements: [],
 *   unlockPath: [],
 * })
 * console.log(report.schemaVersion) // "goal-explain/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalExplainReport extends S.Opaque<GoalExplainReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("goal-explain/v1"),
    readiness: CapabilityReadiness,
    slug: S.String,
    status: GoalStatus,
    executionCapable: S.Boolean,
    ready: S.Boolean,
    frontier: S.Boolean,
    requirements: S.Array(GoalRequirementRow),
    unlockPath: S.Array(GoalUnlockStep),
    cycle: S.String.pipe(S.Array, S.optionalKey),
    closeout: S.optionalKey(GoalCloseoutView),
  }).pipe(
    $I.annoteSchema("GoalExplainReport", {
      description: "Readiness explanation for one packet: requirements, unlock walk, and cycle membership.",
    })
  )
) {}

/**
 * One capability in the generated catalog.
 *
 * **Details**
 *
 * - `collision`: more than one provider (informational, D4).
 * - `orphan`: consumers exist but no packet provides it at all.
 * - `fog`: consumers exist and no buildable provider remains (D8).
 * - `stranded`: provider rows exist and every one is superseded (D8 advisory).
 * - `referenceProviders`: reference packets that declare it (D8 ratchet class).
 * - `duplicates`: packets that list it twice in one array (D5).
 *
 * **Example** (Construct a catalog entry)
 *
 * ```ts
 * import { CapabilityCatalogEntry } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const entry = CapabilityCatalogEntry.make({
 *   capability: "goals/graph",
 *   providers: [],
 *   consumers: [],
 *   collision: false,
 *   orphan: false,
 *   fog: false,
 *   stranded: false,
 *   referenceProviders: [],
 *   duplicates: [],
 * })
 * console.log(entry.capability)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityCatalogEntry extends S.Opaque<CapabilityCatalogEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    capability: CapabilitySlug,
    providers: S.Array(CapabilityProviderRow),
    consumers: S.Array(S.String),
    collision: S.Boolean,
    orphan: S.Boolean,
    fog: S.Boolean,
    stranded: S.Boolean,
    referenceProviders: S.Array(S.String),
    duplicates: S.Array(DuplicateCapabilityDeclaration),
  }).pipe(
    $I.annoteSchema("CapabilityCatalogEntry", {
      description: "One generated catalog row: providers, consumers, and D4/D5/D8 finding signals.",
    })
  )
) {}

/**
 * `capability-catalog/v1` — the generated capability catalog printed by `beep goals catalog`.
 *
 * **Example** (Construct an empty catalog)
 *
 * ```ts
 * import { CapabilityCatalogReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const report = CapabilityCatalogReport.make({ entries: [] })
 * console.log(report.schemaVersion) // "capability-catalog/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityCatalogReport extends S.Opaque<CapabilityCatalogReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("capability-catalog/v1"),
    entries: S.Array(CapabilityCatalogEntry),
  }).pipe(
    $I.annoteSchema("CapabilityCatalogReport", {
      description: "Generated capability catalog derived from goal manifests, sorted by capability.",
    })
  )
) {}
