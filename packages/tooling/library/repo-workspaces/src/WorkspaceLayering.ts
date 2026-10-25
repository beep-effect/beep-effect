/**
 * Holds a workspace's package graph to a committed `LayerPolicy`.
 *
 * **Details**
 *
 * `check` is pure over package names and per-field edges, so positive
 * controls need no filesystem; `edgesOf` draws one edge per declaring field
 * wherever a dependency name is a workspace package; `checkWorkspace` reads
 * the graph through `WorkspaceDiscovery`. A check that reads no edges is
 * itself a violation. Part of the `./testing` subpath.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GlobSet } from "@beep/glob";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { DependencyField } from "@beep/npm-spec/DependencySection";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ALL_DEPENDENCY_FIELDS } from "./internal/dependencyFields.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { LayerPolicy } from "./LayerPolicy.ts";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $RepoWorkspacesId.create("WorkspaceLayering");

/**
 * One dependency edge between two workspace packages, in one field.
 *
 * **Example** (Describe a workspace dependency edge)
 *
 * ```ts
 * import { LayerEdge } from "@beep/repo-workspaces/WorkspaceLayering";
 *
 * const edge = LayerEdge.make({ from: "@app/web", to: "@app/core", field: "dependencies" });
 * console.log(edge.label) // @app/web -> @app/core (dependencies)
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LayerEdge extends S.Class<LayerEdge, { readonly brand: unique symbol }>($I`LayerEdge`)(
  {
    /** The dependent package. */
    from: S.String.pipe($I.annoteKey("LayerEdge.from", { description: "The dependent package." })),
    /** The package depended on. */
    to: S.String.pipe($I.annoteKey("LayerEdge.to", { description: "The package depended on." })),
    /** The manifest map that declares it. */
    field: DependencyField.pipe($I.annoteKey("LayerEdge.field", { description: "The manifest map that declares it." })),
  },
  $I.annote("LayerEdge", { description: "One dependency edge between two workspace packages, in one field." })
) {
  /**
   * Renders the dependent, dependency and declaring field as `from -> to (field)`.
   *
   * **Example** (Render the declaring field of an edge)
   *
   * ```ts
   * import { LayerEdge } from "@beep/repo-workspaces/WorkspaceLayering";
   *
   * const edge = LayerEdge.make({ from: "@app/web", to: "@app/core", field: "dependencies" });
   * console.log(edge.label) // @app/web -> @app/core (dependencies)
   * ```
   *
   * @returns The edge as `from -> to (field)`.
   * @category formatting
   * @since 0.0.0
   */
  get label(): string {
    return `${this.from} -> ${this.to} (${this.field})`;
  }
}

/**
 * The input to {@link WorkspaceLayering.check}: package names, and per-field edges between them.
 *
 * **Example** (Read an empty layering graph)
 *
 * ```ts
 * import { LayeringGraph } from "@beep/repo-workspaces/WorkspaceLayering";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(LayeringGraph)({ names: [], edges: [] })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class LayeringGraph extends S.Opaque<LayeringGraph, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Every workspace package name, the root included. */
    names: S.Array(S.String).pipe(
      $I.annoteKey("LayeringGraph.names", {
        description: "Workspace package names in input order, including the root.",
      })
    ),
    /** One edge per declaring field. */
    edges: S.Array(LayerEdge).pipe(
      $I.annoteKey("LayeringGraph.edges", { description: "Dependency edges in input order, one per declaring field." })
    ),
  }).pipe(
    $I.annoteSchema("LayeringGraph", {
      description: "The package names and dependency edges a layering check reads.",
    })
  )
) {}

/**
 * Companion types for {@link LayeringGraph}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LayeringGraph {
  /**
   * The plain, unbranded encoded shape of a {@link LayeringGraph}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LayeringGraph.Encoded;
  /**
   * The constructor input of a {@link LayeringGraph}: package names and live {@link LayerEdge}
   * values, without the brand, which {@link WorkspaceLayering.check} takes.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Input = (typeof LayeringGraph)["~type.make.in"];
}

const OffenceReason = LiteralKit([
  "upward",
  "sameLayer",
  "toolingReachesLayer",
  "intoUnconstrained",
  "intoUnclassified",
]);
type OffenceReason = typeof OffenceReason.Type;

/**
 * What a layering check found.
 *
 * **Example** (Detect a vacuous layering check)
 *
 * ```ts
 * import { LayeringReport } from "@beep/repo-workspaces/WorkspaceLayering";
 * import * as O from "effect/Option";
 *
 * const report = LayeringReport.make({
 *   duplicates: [], unclassified: [], offenders: [], cycle: O.none(),
 *   missingDeclared: [], missingRequiredEdges: [], edgeCount: 0,
 * });
 * console.log(report.violations.join("\n")) // no workspace edges in the checked fields: the check is vacuous
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LayeringReport extends S.Class<LayeringReport, { readonly brand: unique symbol }>($I`LayeringReport`)(
  {
    /** Packages the policy declares more than once, or declares and also matches with an unconstrained glob. */
    duplicates: S.Array(S.String).pipe(
      $I.annoteKey("LayeringReport.duplicates", {
        description:
          "Packages the policy declares more than once, or declares and also matches with an unconstrained glob.",
      })
    ),
    /** Workspace packages the policy does not classify. */
    unclassified: S.Array(S.String).pipe(
      $I.annoteKey("LayeringReport.unclassified", { description: "Workspace packages the policy does not classify." })
    ),
    /** Edges that break the policy, each with why. */
    offenders: S.Array(
      S.Struct({
        edge: LayerEdge,
        reason: OffenceReason,
      })
    ).pipe($I.annoteKey("LayeringReport.offenders", { description: "Edges that break the policy, each with why." })),
    /** The members of every dependency cycle in the checked fields, or none. */
    cycle: S.String.pipe(
      S.Array,
      S.Option,
      $I.annoteKey("LayeringReport.cycle", {
        description: "The members of every dependency cycle in the checked fields, or none.",
      })
    ),
    /** Packages the policy names that the workspace does not contain. */
    missingDeclared: S.Array(S.String).pipe(
      $I.annoteKey("LayeringReport.missingDeclared", {
        description: "Packages the policy names that the workspace does not contain.",
      })
    ),
    /** Required edges absent from the checked fields. */
    missingRequiredEdges: S.Array(S.String).pipe(
      $I.annoteKey("LayeringReport.missingRequiredEdges", {
        description: "Required edges absent from the checked fields.",
      })
    ),
    /** Edges in the checked fields; `0` is itself a violation. */
    edgeCount: S.Finite.pipe(
      $I.annoteKey("LayeringReport.edgeCount", {
        description: "Edges in the checked fields; `0` is itself a violation.",
      })
    ),
  },
  $I.annote("LayeringReport", { description: "What a layering check found." })
) {
  /**
   * One line per violation: `[]` means the graph honours the policy and the check was not vacuous.
   *
   * **Example** (Render the vacuity violation)
   *
   * ```ts
   * import { LayeringReport } from "@beep/repo-workspaces/WorkspaceLayering";
   * import * as O from "effect/Option";
   *
   * const report = LayeringReport.make({
   *   duplicates: [], unclassified: [], offenders: [], cycle: O.none(),
   *   missingDeclared: [], missingRequiredEdges: [], edgeCount: 0,
   * });
   * console.log(report.violations.join("\n")) // no workspace edges in the checked fields: the check is vacuous
   * ```
   *
   * @returns One line per violation, in report order.
   * @category getters
   * @since 0.0.0
   */
  get violations(): ReadonlyArray<string> {
    return [
      ...A.map(this.duplicates, (name) => `classified more than once: ${name}`),
      ...A.map(this.unclassified, (name) => `not classified by the policy: ${name}`),
      ...A.map(this.offenders, ({ edge, reason }) => `${reason}: ${edge.label}`),
      ...O.match(this.cycle, {
        onNone: () => [],
        onSome: (members) => [`dependency cycle among: ${A.join(members, ", ")}`],
      }),
      ...A.map(this.missingDeclared, (name) => `declared but not in the workspace: ${name}`),
      ...A.map(this.missingRequiredEdges, (edge) => `required edge missing: ${edge}`),
      ...(this.edgeCount === 0 ? ["no workspace edges in the checked fields: the check is vacuous"] : []),
    ];
  }
}

const PlaceKind = LiteralKit(["layer", "tooling", "unconstrained", "unclassified"]).pipe(
  $I.annoteSchema("PlaceKind", { description: "A package classification under a layering policy." })
);
const Place = PlaceKind.toTaggedUnion("kind")({
  layer: {
    index: S.declare(P.isNumber).pipe($I.annoteKey("Place.layer.index", { description: "The declared layer index." })),
  },
  tooling: {},
  unconstrained: {},
  unclassified: {},
}).pipe(
  $I.annoteSchema("Place", { description: "A plain-object policy classification retaining its kind discriminator." })
);
type Place = typeof Place.Type;

const offence: {
  (from: Place, to: Place): OffenceReason | undefined;
  (to: Place): (from: Place) => OffenceReason | undefined;
} = dual(2, (from: Place, to: Place): OffenceReason | undefined => {
  if (from.kind === "unconstrained" || from.kind === "unclassified") return undefined;
  const into = intoOffence(to);
  if (into !== undefined) return into;
  if (from.kind === "tooling") return to.kind === "layer" ? "toolingReachesLayer" : undefined;
  return fromLayerOffence(from.index, to);
});

// An edge into a package the policy leaves unconstrained or does not classify.
const intoOffence = (to: Place): OffenceReason | undefined => {
  if (to.kind === "unconstrained") return "intoUnconstrained";
  return to.kind === "unclassified" ? "intoUnclassified" : undefined;
};

// An edge from layer `index` into a layer at or above it; one into tooling or a lower layer is allowed.
const fromLayerOffence = (index: number, to: Place): OffenceReason | undefined => {
  if (to.kind !== "layer" || to.index > index) return undefined;
  return to.index === index ? "sameLayer" : "upward";
};

/** The sorted members of every strongly connected component larger than one (cf. `DependencyGraph.ts` `cycleMembers`). */
const cycleOf: {
  (names: ReadonlyArray<string>, edges: ReadonlyArray<LayerEdge>): O.Option<ReadonlyArray<string>>;
  (edges: ReadonlyArray<LayerEdge>): (names: ReadonlyArray<string>) => O.Option<ReadonlyArray<string>>;
} = dual(2, (names: ReadonlyArray<string>, edges: ReadonlyArray<LayerEdge>): O.Option<ReadonlyArray<string>> => {
  const sorted = A.sort(
    A.fromIterable(MutableHashSet.fromIterable([...names, ...A.flatMap(edges, (e) => [e.from, e.to])])),
    Order.String
  );
  const graph = Graph.directed<string, string>((mutable) => {
    const index = MutableHashMap.empty<string, Graph.NodeIndex>();
    for (const name of sorted) MutableHashMap.set(index, name, Graph.addNode(mutable, name));
    for (const e of edges) {
      const from = O.getOrThrow(MutableHashMap.get(index, e.from));
      const to = O.getOrThrow(MutableHashMap.get(index, e.to));
      if (from !== to) Graph.addEdge(mutable, from, to, e.field);
    }
  });
  const members = MutableHashSet.empty<string>();
  for (const component of Graph.stronglyConnectedComponents(graph)) {
    if (component.length < 2) continue;
    for (const index of component) {
      MutableHashSet.add(members, A.getUnsafe(sorted, index));
    }
  }
  return MutableHashSet.size(members) === 0 ? O.none() : O.some(A.sort(A.fromIterable(members), Order.String));
});

/**
 * Holds a workspace's package graph to a committed {@link LayerPolicy}.
 *
 * **Details**
 *
 * `check` is pure, so positive-control fixture graphs need no filesystem.
 * `edgesOf` recomputes one edge per declaring field, because
 * `DependencyGraph` merges the four fields into one adjacency and a policy
 * may check only some of them. An edge exists wherever a dependency NAME is
 * a workspace package, whatever its specifier protocol.
 *
 * **Example** (Check workspace dependencies against a layer policy)
 *
 * ```ts
 * import { WorkspaceLayering } from "@beep/repo-workspaces/WorkspaceLayering";
 * import { LayerPolicy } from "@beep/repo-workspaces/LayerPolicy";
 * import * as Effect from "effect/Effect";
 *
 * const violations = Effect.gen(function* () {
 *   const policy = yield* LayerPolicy.load("/repo/layers.json");
 *   const report = yield* WorkspaceLayering.checkWorkspace(policy);
 *   return report.violations;
 * });
 * console.log(Effect.isEffect(violations)) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class WorkspaceLayering {
  /**
   * Check `graph` against `policy`, reading only the policy's fields. Pure.
   *
   * **Example** (Check a downward dependency)
   *
   * ```ts
   * import { LayerEdge, WorkspaceLayering } from "@beep/repo-workspaces/WorkspaceLayering";
   * import { LayerPolicy } from "@beep/repo-workspaces/LayerPolicy";
   *
   * const policy = LayerPolicy.make({
   *   layers: [["@app/web"], ["@app/core"]], tooling: [], unconstrained: [],
   * });
   * const report = WorkspaceLayering.check({
   *   names: ["@app/web", "@app/core"],
   *   edges: [LayerEdge.make({ from: "@app/web", to: "@app/core", field: "dependencies" })],
   * }, policy);
   * console.log(report.violations.length) // 0
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly check: {
    (graph: LayeringGraph.Input, policy: LayerPolicy): LayeringReport;
    (policy: LayerPolicy): (graph: LayeringGraph.Input) => LayeringReport;
  } = dual(2, (graph: LayeringGraph.Input, policy: LayerPolicy): LayeringReport => {
    const fields = MutableHashSet.fromIterable<DependencyField>(policy.effectiveFields);
    const edges = A.filter(graph.edges, (e) => MutableHashSet.has(fields, e.field));
    const unconstrained = GlobSet.make({ patterns: policy.unconstrained });
    const layerOf = MutableHashMap.empty<string, number>();
    const declared = MutableHashMap.empty<string, number>();
    const count = (name: string): void => {
      MutableHashMap.set(declared, name, O.getOrElse(MutableHashMap.get(declared, name), () => 0) + 1);
    };
    A.forEach(policy.layers, (members, index) => {
      for (const name of members) {
        count(name);
        if (!MutableHashMap.has(layerOf, name)) MutableHashMap.set(layerOf, name, index);
      }
    });
    for (const name of policy.tooling) count(name);
    const tooling = MutableHashSet.fromIterable(policy.tooling);
    const place = (name: string): Place => {
      const index = O.getOrUndefined(MutableHashMap.get(layerOf, name));
      if (index !== undefined) return { kind: "layer", index };
      if (MutableHashSet.has(tooling, name)) return { kind: "tooling" };
      return unconstrained.matches(name) ? { kind: "unconstrained" } : { kind: "unclassified" };
    };
    const offenders: Array<{ readonly edge: LayerEdge; readonly reason: OffenceReason }> = [];
    for (const e of edges) {
      const reason = offence(place(e.from), place(e.to));
      if (reason !== undefined) offenders.push({ edge: e, reason });
    }
    const names = MutableHashSet.fromIterable(graph.names);
    const present = MutableHashSet.fromIterable(A.map(edges, (e) => `${e.from} -> ${e.to}`));
    return LayeringReport.make({
      duplicates: pipe(
        A.fromIterable(declared),
        A.filter(([name, times]) => times > 1 || unconstrained.matches(name)),
        A.map(([name]) => name),
        A.sort(Order.String)
      ),
      unclassified: A.sort(
        A.filter(graph.names, (name) => place(name).kind === "unclassified"),
        Order.String
      ),
      offenders,
      cycle: cycleOf(graph.names, edges),
      missingDeclared: declared.pipe(
        MutableHashMap.keys,
        A.fromIterable,
        A.filter((name) => !MutableHashSet.has(names, name)),
        A.sort(Order.String)
      ),
      missingRequiredEdges: A.filter(policy.requiredEdges ?? [], (required) => !MutableHashSet.has(present, required)),
      edgeCount: edges.length,
    });
  });

  /**
   * One edge per declaring field between workspace packages; self-edges dropped.
   *
   * **Example** (Enumerate a dependency between workspace members)
   *
   * ```ts
   * import { WorkspaceLayering } from "@beep/repo-workspaces/WorkspaceLayering";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   *
   * const web = WorkspacePackage.make({
   *   name: "@app/web", path: "/repo/packages/web", relativePath: "packages/web",
   *   packageJsonPath: "/repo/packages/web/package.json", workspaceRoot: "/repo",
   *   dependencies: { "@app/core": "workspace:*" },
   * });
   * const core = WorkspacePackage.make({
   *   name: "@app/core", path: "/repo/packages/core", relativePath: "packages/core",
   *   packageJsonPath: "/repo/packages/core/package.json", workspaceRoot: "/repo",
   * });
   * console.log(WorkspaceLayering.edgesOf([web, core]).map((edge) => edge.label).join(", ")) // @app/web -> @app/core (dependencies)
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly edgesOf = (packages: ReadonlyArray<WorkspacePackage>): ReadonlyArray<LayerEdge> => {
    const names = MutableHashSet.fromIterable(A.map(packages, (pkg) => pkg.name));
    return A.flatMap(packages, (pkg) =>
      A.flatMap(ALL_DEPENDENCY_FIELDS, (field) =>
        A.map(
          A.sort(
            A.filter(R.keys(pkg[field]), (name) => MutableHashSet.has(names, name) && name !== pkg.name),
            Order.String
          ),
          (to) => LayerEdge.make({ from: pkg.name, to, field })
        )
      )
    );
  };

  /**
   * Discover the workspace and check it against `policy`.
   *
   * **Example** (Construct a workspace policy check)
   *
   * ```ts
   * import { WorkspaceLayering } from "@beep/repo-workspaces/WorkspaceLayering";
   * import { LayerPolicy } from "@beep/repo-workspaces/LayerPolicy";
   * import * as Effect from "effect/Effect";
   *
   * const policy = LayerPolicy.make({ layers: [], tooling: [], unconstrained: ["*"] });
   * const program = WorkspaceLayering.checkWorkspace(policy);
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly checkWorkspace = Effect.fn("WorkspaceLayering.checkWorkspace")(function* (policy: LayerPolicy) {
    const discovery = yield* WorkspaceDiscovery;
    const packages = yield* discovery.listPackages;
    return WorkspaceLayering.check(
      { names: A.map(packages, (pkg) => pkg.name), edges: WorkspaceLayering.edgesOf(packages) },
      policy
    );
  });
}
