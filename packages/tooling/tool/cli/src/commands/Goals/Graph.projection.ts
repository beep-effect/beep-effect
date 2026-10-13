/**
 * Pure capability-graph projection: compiler, reference evaluator, and reports.
 *
 * **Details**
 *
 * Everything here is a plain function over schema values. Nothing reads files
 * or touches SQLite:
 *
 * - {@link compileCapabilityProjection} maps decoded manifests, in any
 *   discovery order, to the sorted, duplicate-free {@link CapabilityProjection}.
 * - {@link evaluateCapabilityGraph} is the pure-TypeScript reference evaluator.
 *   It is small enough to review as obviously correct, which is its whole job:
 *   the `bun:sqlite` engine must reproduce its answers byte-for-byte.
 * - The `build*Report` functions turn a projection plus its answers into the
 *   versioned reports, so every renderer reads one set of semantics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import {
  CapabilityCatalogEntry,
  CapabilityCatalogReport,
  CapabilityGraphAnswers,
  CapabilityProjection,
  CapabilityProviderRow,
  DuplicateCapabilityDeclaration,
  GoalExplainReport,
  GoalFrontierEntry,
  GoalFrontierReport,
  GoalRequirementRow,
  GoalUnlockStep,
  GraphCapabilityEdge,
  GraphPacketRow,
  PacketUnlockWalk,
  UnlockDepth,
} from "./Graph.schemas.ts";
import type { CapabilitySlug, GoalManifest, GoalStatus } from "./Goals.schemas.ts";
import type { CapabilityEdgeKind } from "./Graph.schemas.ts";

/**
 * Statuses whose `provides` can still be built: anything else is fog (D8).
 *
 * **Example** (Check whether a provider status can still build)
 *
 * ```ts
 * import { BUILDABLE_PROVIDER_STATUSES } from "@beep/repo-cli/commands/Goals/Graph.projection"
 *
 * console.log(BUILDABLE_PROVIDER_STATUSES.includes("paused")) // true
 * console.log(BUILDABLE_PROVIDER_STATUSES.includes("superseded")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BUILDABLE_PROVIDER_STATUSES: ReadonlyArray<GoalStatus> = ["active", "paused", "completed-retained"];

/**
 * Statuses an unlock walk may route through: unfinished but buildable.
 *
 * **Example** (Check whether an unlock walk may route through a status)
 *
 * ```ts
 * import { CANDIDATE_PROVIDER_STATUSES } from "@beep/repo-cli/commands/Goals/Graph.projection"
 *
 * console.log(CANDIDATE_PROVIDER_STATUSES.includes("active")) // true
 * console.log(CANDIDATE_PROVIDER_STATUSES.includes("completed-retained")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CANDIDATE_PROVIDER_STATUSES: ReadonlyArray<GoalStatus> = ["active", "paused"];

const byPacketThenCapability = Order.combine(
  Order.mapInput(Order.String, (edge: GraphCapabilityEdge) => edge.packetId),
  Order.mapInput(Order.String, (edge: GraphCapabilityEdge) => edge.capability)
);

const byCapabilityThenPacket = Order.combine(
  Order.mapInput(Order.String, (edge: GraphCapabilityEdge) => edge.capability),
  Order.mapInput(Order.String, (edge: GraphCapabilityEdge) => edge.packetId)
);

const duplicateOrder = Order.combine(
  Order.combine(
    Order.mapInput(Order.String, (duplicate: DuplicateCapabilityDeclaration) => duplicate.packetId),
    Order.mapInput(Order.String, (duplicate: DuplicateCapabilityDeclaration) => duplicate.edge)
  ),
  Order.mapInput(Order.String, (duplicate: DuplicateCapabilityDeclaration) => duplicate.capability)
);

const byPacketId = Order.mapInput(Order.String, (row: GraphPacketRow) => row.packetId);

const cycleOrder = Order.mapInput(Order.String, A.join("\u0000"));

const unlockOrder = Order.combine(
  Order.mapInput(Order.Number, (step: UnlockDepth) => step.depth),
  Order.mapInput(Order.String, (step: UnlockDepth) => step.slug)
);

const edgesFor = (packetId: string, capabilities: ReadonlyArray<CapabilitySlug>): ReadonlyArray<GraphCapabilityEdge> =>
  A.map(A.dedupe(capabilities), (capability) => GraphCapabilityEdge.make({ packetId, capability }));

const duplicatesFor = (
  packetId: string,
  edge: CapabilityEdgeKind,
  capabilities: ReadonlyArray<CapabilitySlug>
): ReadonlyArray<DuplicateCapabilityDeclaration> =>
  pipe(
    A.dedupe(capabilities),
    A.filter((capability) => A.length(A.filter(capabilities, (candidate) => candidate === capability)) > 1),
    A.map((capability) => DuplicateCapabilityDeclaration.make({ packetId, capability, edge }))
  );

const packetRow = (manifest: GoalManifest): GraphPacketRow =>
  GraphPacketRow.make({
    packetId: manifest.initiative.id,
    status: manifest.initiative.status,
    executionCapable: manifest.executionCapable === true,
    title: manifest.initiative.title ?? manifest.initiative.id,
    ...(manifest.mission === undefined || manifest.mission === null ? {} : { mission: manifest.mission }),
  });

/**
 * Compiles decoded manifests into the normalized capability projection.
 *
 * **Details**
 *
 * Pure and order-independent: any permutation of the same manifests yields an
 * equal value. A capability repeated inside one array becomes one edge plus a
 * {@link DuplicateCapabilityDeclaration}; two packets providing one capability
 * stay two edges (a collision, never last-write-wins).
 *
 * **Gotchas**
 *
 * Packet ids must be unique. Two manifests with the same `initiative.id`
 * throw a `SchemaError` from the projection's construction check in every
 * input order. The census loader prevents this upstream by requiring each
 * id to match its directory.
 *
 * **Example** (Compile one provider and one consumer)
 *
 * ```ts
 * import { compileCapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const gate = { operator: "yeet", requiresPullRequest: true, requiresMergeable: true, statement: "s", grandfathered: false }
 * const projection = compileCapabilityProjection([
 *   GoalManifest.make({ initiative: { id: "b", status: "active" }, completionGate: gate, requires: ["cap/a"] }),
 *   GoalManifest.make({ initiative: { id: "a", status: "completed-retained" }, completionGate: gate, provides: ["cap/a"] }),
 * ])
 * console.log(projection.packets.map((packet) => packet.packetId)) // ["a", "b"]
 * ```
 *
 * @param manifests - Decoded manifests in any discovery order.
 * @returns The sorted, duplicate-free projection.
 * @category projections
 * @since 0.0.0
 */
export const compileCapabilityProjection = (manifests: ReadonlyArray<GoalManifest>): CapabilityProjection => {
  const provides = pipe(
    manifests,
    A.flatMap((manifest) => edgesFor(manifest.initiative.id, manifest.provides)),
    A.sort(byCapabilityThenPacket)
  );
  const requires = pipe(
    manifests,
    A.flatMap((manifest) => edgesFor(manifest.initiative.id, manifest.requires)),
    A.sort(byPacketThenCapability)
  );
  return CapabilityProjection.make({
    packets: pipe(manifests, A.map(packetRow), A.sort(byPacketId)),
    capabilities: pipe(
      A.appendAll(provides, requires),
      A.map((edge) => edge.capability),
      A.dedupe,
      A.sort(Order.String)
    ),
    provides,
    requires,
    duplicates: pipe(
      manifests,
      A.flatMap((manifest) =>
        A.appendAll(
          duplicatesFor(manifest.initiative.id, "provides", manifest.provides),
          duplicatesFor(manifest.initiative.id, "requires", manifest.requires)
        )
      ),
      A.sort(duplicateOrder)
    ),
  });
};

/**
 * Groups SCC membership pairs into sorted cycles.
 *
 * **Details**
 *
 * Shared by both engines: each pair says "`member` sits in the cycle whose
 * least slug is `root`". Membership itself is decided by the engine; this only
 * groups and orders it.
 *
 * **Example** (Group two members of one cycle)
 *
 * ```ts
 * import { groupCycles } from "@beep/repo-cli/commands/Goals/Graph.projection"
 *
 * console.log(groupCycles([{ member: "b", root: "a" }, { member: "a", root: "a" }])) // [["a", "b"]]
 * ```
 *
 * @param pairs - Member-to-root SCC membership pairs.
 * @returns Sorted cycles with sorted members.
 * @category utilities
 * @since 0.0.0
 */
export const groupCycles = (
  pairs: ReadonlyArray<{ readonly member: string; readonly root: string }>
): ReadonlyArray<ReadonlyArray<string>> =>
  pipe(
    A.groupBy(pairs, (pair) => pair.root),
    R.values,
    A.map((group) =>
      pipe(
        group,
        A.map((pair) => pair.member),
        A.dedupe,
        A.sort(Order.String)
      )
    ),
    A.sort(cycleOrder)
  );

const statusOf = (projection: CapabilityProjection) => {
  const statuses = R.fromEntries(A.map(projection.packets, (packet) => [packet.packetId, packet.status] as const));
  return (packetId: string): O.Option<GoalStatus> => R.get(statuses, packetId);
};

const providerHasStatus =
  (status: (packetId: string) => O.Option<GoalStatus>, allowed: ReadonlyArray<GoalStatus>) =>
  (edge: GraphCapabilityEdge): boolean =>
    O.exists(status(edge.packetId), (value) => A.contains(allowed, value));

const breadthFirstDepths = (
  start: string,
  next: (slug: string) => ReadonlyArray<string>
): ReadonlyArray<UnlockDepth> => {
  const depths = MutableHashMap.empty<string, number>();
  let frontier: ReadonlyArray<string> = A.dedupe(next(start));
  let depth = 1;
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    const fresh = A.filter(frontier, (slug) => !MutableHashMap.has(depths, slug));
    for (const slug of fresh) MutableHashMap.set(depths, slug, depth);
    frontier = pipe(fresh, A.flatMap(next), A.dedupe);
    depth += 1;
  }
  return pipe(
    A.fromIterable(depths),
    A.map(([slug, value]) => UnlockDepth.make({ slug, depth: value })),
    A.sort(unlockOrder)
  );
};

/**
 * Pure-TypeScript reference evaluator for the capability graph.
 *
 * **Details**
 *
 * Implements the same questions as the `bun:sqlite` engine with set algebra
 * and explicit breadth-first search. See {@link CapabilityGraphAnswers} for
 * the exact semantics of each answer.
 *
 * **Example** (Evaluate an empty projection)
 *
 * ```ts
 * import { evaluateCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const answers = evaluateCapabilityGraph(
 *   CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * )
 * console.log(answers.frontier) // []
 * ```
 *
 * @param projection - Compiled capability projection.
 * @returns The reference answers.
 * @category queries
 * @since 0.0.0
 */
export const evaluateCapabilityGraph = (projection: CapabilityProjection): CapabilityGraphAnswers => {
  const status = statusOf(projection);
  const packets = A.sort(projection.packets, byPacketId);
  const available = pipe(
    projection.provides,
    A.filter(providerHasStatus(status, ["completed-retained"])),
    A.map((edge) => edge.capability),
    HashSet.fromIterable
  );
  const buildable = pipe(
    projection.provides,
    A.filter(providerHasStatus(status, BUILDABLE_PROVIDER_STATUSES)),
    A.map((edge) => edge.capability),
    HashSet.fromIterable
  );
  const unavailableRequirements = (packetId: string): ReadonlyArray<CapabilitySlug> =>
    pipe(
      projection.requires,
      A.filter((edge) => edge.packetId === packetId && !HashSet.has(available, edge.capability)),
      A.map((edge) => edge.capability)
    );
  const candidateProviders = (packetId: string): ReadonlyArray<string> =>
    pipe(
      unavailableRequirements(packetId),
      A.flatMap((capability) =>
        A.filter(
          projection.provides,
          (edge) => edge.capability === capability && providerHasStatus(status, CANDIDATE_PROVIDER_STATUSES)(edge)
        )
      ),
      A.map((edge) => edge.packetId),
      A.dedupe
    );
  const walks = A.map(packets, (packet) =>
    PacketUnlockWalk.make({ slug: packet.packetId, steps: breadthFirstDepths(packet.packetId, candidateProviders) })
  );
  const reaches = (from: string, to: string): boolean =>
    pipe(
      A.findFirst(walks, (walk) => walk.slug === from),
      O.exists((walk) => A.some(walk.steps, (step) => step.slug === to))
    );
  const cyclic = A.filter(packets, (packet) => reaches(packet.packetId, packet.packetId));
  const cyclePairs = A.flatMap(cyclic, (packet) => {
    const members = A.filter(
      cyclic,
      (other) => reaches(packet.packetId, other.packetId) && reaches(other.packetId, packet.packetId)
    );
    const root = A.reduce(members, packet.packetId, (least, member) => Order.min(Order.String)(least, member.packetId));
    return [{ member: packet.packetId, root }];
  });

  return CapabilityGraphAnswers.make({
    available: A.sort(A.fromIterable(available), Order.String),
    fog: pipe(
      projection.requires,
      A.map((edge) => edge.capability),
      A.filter((capability) => !HashSet.has(buildable, capability)),
      A.dedupe,
      A.sort(Order.String)
    ),
    frontier: pipe(
      packets,
      A.filter(
        (packet) =>
          packet.status === "active" &&
          packet.executionCapable &&
          A.isReadonlyArrayEmpty(unavailableRequirements(packet.packetId))
      ),
      A.map((packet) => packet.packetId)
    ),
    cycles: groupCycles(cyclePairs),
    unlock: walks,
  });
};

const providerRows = (
  projection: CapabilityProjection,
  capability: CapabilitySlug
): ReadonlyArray<CapabilityProviderRow> => {
  const status = statusOf(projection);
  return pipe(
    projection.provides,
    A.filter((edge) => edge.capability === capability),
    A.flatMap((edge) =>
      pipe(
        status(edge.packetId),
        O.map((providerStatus) =>
          CapabilityProviderRow.make({
            capability,
            provider: edge.packetId,
            providerStatus,
            satisfies: providerStatus === "completed-retained",
          })
        ),
        O.toArray
      )
    ),
    A.sort(Order.mapInput(Order.String, (row: CapabilityProviderRow) => row.provider))
  );
};

const requirementRows = (
  projection: CapabilityProjection,
  answers: CapabilityGraphAnswers,
  packetId: string
): ReadonlyArray<GoalRequirementRow> =>
  pipe(
    projection.requires,
    A.filter((edge) => edge.packetId === packetId),
    A.map((edge) =>
      GoalRequirementRow.make({
        capability: edge.capability,
        satisfied: A.contains(answers.available, edge.capability),
        providers: providerRows(projection, edge.capability),
        fog: A.contains(answers.fog, edge.capability),
      })
    )
  );

const findPacket = (projection: CapabilityProjection, slug: string): O.Option<GraphPacketRow> =>
  A.findFirst(projection.packets, (packet) => packet.packetId === slug);

const isReady = (projection: CapabilityProjection, answers: CapabilityGraphAnswers, packetId: string): boolean =>
  A.every(requirementRows(projection, answers, packetId), (row) => row.satisfied);

/**
 * Builds the `goal-frontier/v1` worklist report.
 *
 * **Example** (Build a frontier over an empty graph)
 *
 * ```ts
 * import { buildFrontierReport, evaluateCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(buildFrontierReport(projection, evaluateCapabilityGraph(projection)).frontier) // []
 * ```
 *
 * @param projection - Compiled capability projection.
 * @param answers - Engine answers over the same projection.
 * @returns Actionable packets with their requirement rows, plus fog capabilities and cycles.
 * @category read-models
 * @since 0.0.0
 */
export const buildFrontierReport: {
  (answers: CapabilityGraphAnswers): (projection: CapabilityProjection) => GoalFrontierReport;
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers): GoalFrontierReport;
} = dual(
  2,
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers): GoalFrontierReport =>
    GoalFrontierReport.make({
      readiness: "nominal",
      frontier: pipe(
        answers.frontier,
        A.flatMap((slug) => O.toArray(findPacket(projection, slug))),
        A.map((packet) =>
          GoalFrontierEntry.make({
            slug: packet.packetId,
            title: packet.title,
            ...(packet.mission === undefined ? {} : { mission: packet.mission }),
            requirements: requirementRows(projection, answers, packet.packetId),
          })
        )
      ),
      fog: answers.fog,
      cycles: answers.cycles,
    })
);

/**
 * Builds the `goal-explain/v1` report for one packet slug.
 *
 * **Details**
 *
 * Returns `Option.none()` for a slug that names no packet; the command turns
 * that into the typed input error that points at `goals bootstrap`.
 *
 * **Example** (Explain an unknown slug)
 *
 * ```ts
 * import { buildExplainReport, evaluateCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 * import * as O from "effect/Option"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(O.isNone(buildExplainReport(projection, evaluateCapabilityGraph(projection), "missing"))) // true
 * ```
 *
 * @param projection - Compiled capability projection.
 * @param answers - Engine answers over the same projection.
 * @param slug - Packet slug to explain.
 * @returns The explanation, or none for an unknown slug.
 * @category read-models
 * @since 0.0.0
 */
export const buildExplainReport: {
  (answers: CapabilityGraphAnswers, slug: string): (projection: CapabilityProjection) => O.Option<GoalExplainReport>;
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers, slug: string): O.Option<GoalExplainReport>;
} = dual(
  3,
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers, slug: string): O.Option<GoalExplainReport> =>
    O.map(findPacket(projection, slug), (packet) => {
      const ready = isReady(projection, answers, packet.packetId);
      const cycle = A.findFirst(answers.cycles, A.contains(packet.packetId));
      const steps = pipe(
        A.findFirst(answers.unlock, (walk) => walk.slug === packet.packetId),
        O.map((walk) => walk.steps),
        O.getOrElse(A.empty<UnlockDepth>)
      );
      const unlockPath =
        ready || O.isSome(cycle)
          ? A.empty<GoalUnlockStep>()
          : A.flatMap(steps, (step) =>
              pipe(
                findPacket(projection, step.slug),
                O.map((stepPacket) =>
                  GoalUnlockStep.make({
                    slug: stepPacket.packetId,
                    depth: step.depth,
                    status: stepPacket.status,
                    executionCapable: stepPacket.executionCapable,
                    ready: isReady(projection, answers, stepPacket.packetId),
                    provides: pipe(
                      projection.provides,
                      A.filter((edge) => edge.packetId === stepPacket.packetId),
                      A.map((edge) => edge.capability),
                      A.sort(Order.String)
                    ),
                  })
                ),
                O.toArray
              )
            );
      return GoalExplainReport.make({
        readiness: "nominal",
        slug: packet.packetId,
        status: packet.status,
        executionCapable: packet.executionCapable,
        ready,
        frontier: A.contains(answers.frontier, packet.packetId),
        requirements: requirementRows(projection, answers, packet.packetId),
        unlockPath,
        ...O.match(cycle, { onNone: () => ({}), onSome: (members) => ({ cycle: members }) }),
      });
    })
);

/**
 * Builds the `capability-catalog/v1` report.
 *
 * **Details**
 *
 * The catalog is the phase-0 report for the D5/D8 finding classes:
 * duplicates, stranded capabilities, and reference-provided capabilities are
 * explicit fields here before any doctor gate exists.
 *
 * **Example** (Build an empty catalog)
 *
 * ```ts
 * import { buildCatalogReport, evaluateCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(buildCatalogReport(projection, evaluateCapabilityGraph(projection)).entries) // []
 * ```
 *
 * @param projection - Compiled capability projection.
 * @param answers - Engine answers over the same projection.
 * @returns One entry per capability with providers, consumers, and D4/D5/D8 signals.
 * @category read-models
 * @since 0.0.0
 */
export const buildCatalogReport: {
  (answers: CapabilityGraphAnswers): (projection: CapabilityProjection) => CapabilityCatalogReport;
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers): CapabilityCatalogReport;
} = dual(
  2,
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers): CapabilityCatalogReport =>
    CapabilityCatalogReport.make({
      entries: A.map(projection.capabilities, (capability) => {
        const providers = providerRows(projection, capability);
        const consumers = pipe(
          projection.requires,
          A.filter((edge) => edge.capability === capability),
          A.map((edge) => edge.packetId),
          A.sort(Order.String)
        );
        return CapabilityCatalogEntry.make({
          capability,
          providers,
          consumers,
          collision: A.length(providers) > 1,
          orphan: A.isReadonlyArrayNonEmpty(consumers) && A.isReadonlyArrayEmpty(providers),
          fog: A.contains(answers.fog, capability),
          stranded:
            A.isReadonlyArrayNonEmpty(providers) && A.every(providers, (row) => row.providerStatus === "superseded"),
          referenceProviders: pipe(
            providers,
            A.filter((row) => row.providerStatus === "reference"),
            A.map((row) => row.provider)
          ),
          duplicates: A.filter(projection.duplicates, (duplicate) => duplicate.capability === capability),
        });
      }),
    })
);

const requirementLine = (row: GoalRequirementRow): string => {
  const state = row.satisfied ? "ok" : row.fog ? "fog" : "blocked";
  const providers = A.isReadonlyArrayEmpty(row.providers)
    ? "no providers"
    : A.join(
        A.map(row.providers, (provider) => `${provider.provider} (${provider.providerStatus})`),
        ", "
      );
  return `    ${state} ${row.capability} <- ${providers}`;
};

const cycleLines = (cycles: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(cycles) ? [] : ["cycles:", ...A.map(cycles, (cycle) => `  ${A.join(cycle, " <-> ")}`)];

/**
 * Renders a frontier report for human reading.
 *
 * **Example** (Render an empty frontier)
 *
 * ```ts
 * import { renderFrontierHuman } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { GoalFrontierReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * console.log(renderFrontierHuman(GoalFrontierReport.make({ readiness: "nominal", frontier: [], fog: [], cycles: [] })))
 * ```
 *
 * @param report - Frontier report to render.
 * @returns Multi-line human text.
 * @category formatting
 * @since 0.0.0
 */
export const renderFrontierHuman = (report: GoalFrontierReport): string =>
  A.join(
    [
      `goals next (${report.readiness}): ${A.length(report.frontier)} actionable, ${A.length(report.fog)} fog, ${A.length(report.cycles)} cycle(s)`,
      ...A.flatMap(report.frontier, (entry) => [
        `  ${entry.slug} — ${entry.title}`,
        ...A.map(entry.requirements, requirementLine),
      ]),
      ...(A.isReadonlyArrayEmpty(report.fog)
        ? []
        : ["fog:", ...A.map(report.fog, (capability) => `  fog:${capability}`)]),
      ...cycleLines(report.cycles),
    ],
    "\n"
  );

/**
 * Renders an explain report for human reading.
 *
 * **Example** (Render a ready packet)
 *
 * ```ts
 * import { renderExplainHuman } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { GoalExplainReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * console.log(
 *   renderExplainHuman(
 *     GoalExplainReport.make({
 *       readiness: "nominal",
 *       slug: "a",
 *       status: "active",
 *       executionCapable: true,
 *       ready: true,
 *       frontier: true,
 *       requirements: [],
 *       unlockPath: [],
 *     })
 *   )
 * )
 * ```
 *
 * @param report - Explain report to render.
 * @returns Multi-line human text.
 * @category formatting
 * @since 0.0.0
 */
export const renderExplainHuman = (report: GoalExplainReport): string => {
  const verdict = report.frontier
    ? "on the frontier"
    : report.ready
      ? `ready but not actionable (status ${report.status}, executionCapable ${report.executionCapable})`
      : "blocked";
  return A.join(
    [
      `goals explain ${report.slug} (${report.readiness}): ${verdict}`,
      ...(A.isReadonlyArrayEmpty(report.requirements) ? ["  requirements: none"] : ["  requirements:"]),
      ...A.map(report.requirements, requirementLine),
      ...(report.cycle === undefined ? [] : [`  cycle: ${A.join(report.cycle, " <-> ")}`]),
      ...(A.isReadonlyArrayEmpty(report.unlockPath) ? [] : ["  unlock path (shallowest first):"]),
      ...A.map(
        report.unlockPath,
        (step) =>
          `    ${step.depth}. ${step.slug} (${step.status}${step.executionCapable ? "" : ", not execution-capable"}${step.ready ? ", ready" : ""}) provides ${A.join(step.provides, ", ")}`
      ),
    ],
    "\n"
  );
};

const CATALOG_FLAGS: ReadonlyArray<readonly [string, (entry: CapabilityCatalogEntry) => boolean]> = [
  ["collision", (entry) => entry.collision],
  ["orphan", (entry) => entry.orphan],
  ["fog", (entry) => entry.fog],
  ["stranded", (entry) => entry.stranded],
  ["reference-provides", (entry) => A.isReadonlyArrayNonEmpty(entry.referenceProviders)],
  ["duplicate", (entry) => A.isReadonlyArrayNonEmpty(entry.duplicates)],
];

const listOrNone = (items: ReadonlyArray<string>): string =>
  A.isReadonlyArrayEmpty(items) ? "none" : A.join(items, ", ");

const catalogLine = (entry: CapabilityCatalogEntry): string => {
  const flags = pipe(
    CATALOG_FLAGS,
    A.filter(([, applies]) => applies(entry)),
    A.map(([label]) => label)
  );
  const flagText = A.isReadonlyArrayEmpty(flags) ? "" : ` [${A.join(flags, ", ")}]`;
  const providers = listOrNone(A.map(entry.providers, (row) => `${row.provider} (${row.providerStatus})`));
  return `  ${entry.capability}${flagText} providers: ${providers}; consumers: ${listOrNone(entry.consumers)}`;
};

/**
 * Renders a catalog report for human reading.
 *
 * **Example** (Render an empty catalog)
 *
 * ```ts
 * import { renderCatalogHuman } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityCatalogReport } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * console.log(renderCatalogHuman(CapabilityCatalogReport.make({ entries: [] })))
 * ```
 *
 * @param report - Catalog report to render.
 * @returns Multi-line human text.
 * @category formatting
 * @since 0.0.0
 */
export const renderCatalogHuman = (report: CapabilityCatalogReport): string =>
  A.join([`goals catalog: ${A.length(report.entries)} capabilities`, ...A.map(report.entries, catalogLine)], "\n");
