import { $ScratchpadId } from "@beep/identity/packages";
import { GlobSet } from "../glob/index.ts";
import { DependencyField } from "../npm/index.ts";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ALL_DEPENDENCY_FIELDS } from "./internal/dependencyFields.ts";
import type { LayerPolicy } from "./LayerPolicy.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $ScratchpadId.create("effected/workspaces/WorkspaceLayering");

/**
 * One dependency edge between two workspace packages, in one field.
 *
 * @public
 */
export class LayerEdge extends S.Class<LayerEdge>($I`LayerEdge`)({
	/** The dependent package. */
	from: S.String.annotateKey({ description: "The dependent package." }),
	/** The package depended on. */
	to: S.String.annotateKey({ description: "The package depended on." }),
	/** The manifest map that declares it. */
	field: DependencyField.annotateKey({ description: "The manifest map that declares it." }),
}, $I.annote("LayerEdge", { description: "One dependency edge between two workspace packages, in one field." })) {
	/** `from -> to (field)`. */
	get label(): string {
		return `${this.from} -> ${this.to} (${this.field})`;
	}
}

/**
 * The input to {@link WorkspaceLayering.check}: package names, and per-field edges between them.
 *
 * @public
 */
export interface LayeringGraph {
	/** Every workspace package name, the root included. */
	readonly names: ReadonlyArray<string>;
	/** One edge per declaring field. */
	readonly edges: ReadonlyArray<LayerEdge>;
}

type OffenceReason = "upward" | "sameLayer" | "toolingReachesLayer" | "intoUnconstrained" | "intoUnclassified";

/**
 * What a layering check found.
 *
 * @public
 */
export class LayeringReport extends S.Class<LayeringReport>($I`LayeringReport`)({
	/** Packages the policy declares more than once, or declares and also matches with an unconstrained glob. */
	duplicates: S.Array(S.String).annotateKey({ description: "Packages the policy declares more than once, or declares and also matches with an unconstrained glob." }),
	/** Workspace packages the policy does not classify. */
	unclassified: S.Array(S.String).annotateKey({ description: "Workspace packages the policy does not classify." }),
	/** Edges that break the policy, each with why. */
	offenders: S.Array(
		S.Struct({
			edge: LayerEdge,
			reason: S.Literals(["upward", "sameLayer", "toolingReachesLayer", "intoUnconstrained", "intoUnclassified"]),
		}),
	).annotateKey({ description: "Edges that break the policy, each with why." }),
	/** The members of every dependency cycle in the checked fields, or none. */
	cycle: S.String.pipe(S.Array, S.Option).annotateKey({ description: "The members of every dependency cycle in the checked fields, or none." }),
	/** Packages the policy names that the workspace does not contain. */
	missingDeclared: S.Array(S.String).annotateKey({ description: "Packages the policy names that the workspace does not contain." }),
	/** Required edges absent from the checked fields. */
	missingRequiredEdges: S.Array(S.String).annotateKey({ description: "Required edges absent from the checked fields." }),
	/** Edges in the checked fields; `0` is itself a violation. */
	edgeCount: S.Finite.annotateKey({ description: "Edges in the checked fields; `0` is itself a violation." }),
}, $I.annote("LayeringReport", { description: "What a layering check found." })) {
	/** One line per violation: `[]` means the graph honours the policy and the check was not vacuous. */
	get violations(): ReadonlyArray<string> {
		return [
			...this.duplicates.map((name) => `classified more than once: ${name}`),
			...this.unclassified.map((name) => `not classified by the policy: ${name}`),
			...this.offenders.map(({ edge, reason }) => `${reason}: ${edge.label}`),
			...O.match(this.cycle, {
				onNone: () => [],
				onSome: (members) => [`dependency cycle among: ${members.join(", ")}`],
			}),
			...this.missingDeclared.map((name) => `declared but not in the workspace: ${name}`),
			...this.missingRequiredEdges.map((edge) => `required edge missing: ${edge}`),
			...(this.edgeCount === 0 ? ["no workspace edges in the checked fields: the check is vacuous"] : []),
		];
	}
}

type Place =
	| { readonly kind: "layer"; readonly index: number }
	| { readonly kind: "tooling" }
	| { readonly kind: "unconstrained" }
	| { readonly kind: "unclassified" };

const offence = (from: Place, to: Place): OffenceReason | undefined => {
	if (from.kind === "unconstrained" || from.kind === "unclassified") return undefined;
	if (to.kind === "unconstrained") return "intoUnconstrained";
	if (to.kind === "unclassified") return "intoUnclassified";
	if (from.kind === "tooling") return to.kind === "layer" ? "toolingReachesLayer" : undefined;
	if (to.kind === "tooling") return undefined;
	return to.index > from.index ? undefined : to.index === from.index ? "sameLayer" : "upward";
};

/** The sorted members of every strongly connected component larger than one (cf. `DependencyGraph.ts` `cycleMembers`). */
const cycleOf = (
	names: ReadonlyArray<string>,
	edges: ReadonlyArray<LayerEdge>,
): O.Option<ReadonlyArray<string>> => {
	const sorted = [...new Set([...names, ...edges.flatMap((e) => [e.from, e.to])])].sort();
	const graph = Graph.directed<string, string>((mutable) => {
		const index = new Map<string, Graph.NodeIndex>();
		for (const name of sorted) index.set(name, Graph.addNode(mutable, name));
		for (const e of edges) {
			const from = index.get(e.from);
			const to = index.get(e.to);
			if (from !== undefined && to !== undefined && from !== to) Graph.addEdge(mutable, from, to, e.field);
		}
	});
	const members = new Set<string>();
	for (const component of Graph.stronglyConnectedComponents(graph)) {
		if (component.length < 2) continue;
		for (const index of component) {
			const name = sorted[index];
			if (name !== undefined) members.add(name);
		}
	}
	return members.size === 0 ? O.none() : O.some([...members].sort());
};

/**
 * Holds a workspace's package graph to a committed {@link LayerPolicy}.
 *
 * @remarks
 * `check` is pure, so positive-control fixture graphs need no filesystem.
 * `edgesOf` recomputes one edge per declaring field, because
 * `DependencyGraph` merges the four fields into one adjacency and a policy
 * may check only some of them. An edge exists wherever a dependency NAME is
 * a workspace package, whatever its specifier protocol.
 *
 * @example
 * ```ts
 * import { NodeServices } from "@effect/platform-node";
 * import { Workspaces } from "./index.ts";
 * import { LayerPolicy, WorkspaceLayering } from "./testing.ts";
 * import { Effect, Layer } from "effect";
 *
 * const Live = Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(NodeServices.layer));
 *
 * const violations = Effect.gen(function* () {
 *   const policy = yield* LayerPolicy.load("/repo/layers.json");
 *   const report = yield* WorkspaceLayering.checkWorkspace(policy);
 *   return report.violations;
 * }).pipe(Effect.provide(Live));
 * ```
 *
 * @public
 */
export class WorkspaceLayering {
	private constructor() {}

	/** Check `graph` against `policy`, reading only the policy's fields. Pure. */
	static readonly check = (graph: LayeringGraph, policy: LayerPolicy): LayeringReport => {
		const fields = new Set<DependencyField>(policy.effectiveFields);
		const edges = graph.edges.filter((e) => fields.has(e.field));
		const unconstrained = GlobSet.make({ patterns: policy.unconstrained });
		const layerOf = new Map<string, number>();
		const declared = new Map<string, number>();
		const count = (name: string): void => {
			declared.set(name, (declared.get(name) ?? 0) + 1);
		};
		policy.layers.forEach((members, index) => {
			for (const name of members) {
				count(name);
				if (!layerOf.has(name)) layerOf.set(name, index);
			}
		});
		for (const name of policy.tooling) count(name);
		const tooling = new Set(policy.tooling);
		const place = (name: string): Place => {
			const index = layerOf.get(name);
			if (index !== undefined) return { kind: "layer", index };
			if (tooling.has(name)) return { kind: "tooling" };
			return unconstrained.matches(name) ? { kind: "unconstrained" } : { kind: "unclassified" };
		};
		const offenders: Array<{ readonly edge: LayerEdge; readonly reason: OffenceReason }> = [];
		for (const e of edges) {
			const reason = offence(place(e.from), place(e.to));
			if (reason !== undefined) offenders.push({ edge: e, reason });
		}
		const names = new Set(graph.names);
		const present = new Set(edges.map((e) => `${e.from} -> ${e.to}`));
		return LayeringReport.make({
			duplicates: [...declared]
				.filter(([name, times]) => times > 1 || unconstrained.matches(name))
				.map(([name]) => name)
				.sort(),
			unclassified: graph.names.filter((name) => place(name).kind === "unclassified").sort(),
			offenders,
			cycle: cycleOf(graph.names, edges),
			missingDeclared: [...declared.keys()].filter((name) => !names.has(name)).sort(),
			missingRequiredEdges: (policy.requiredEdges ?? []).filter((required) => !present.has(required)),
			edgeCount: edges.length,
		});
	};

	/** One edge per declaring field between workspace packages; self-edges dropped. */
	static readonly edgesOf = (packages: ReadonlyArray<WorkspacePackage>): ReadonlyArray<LayerEdge> => {
		const names = new Set(packages.map((pkg) => pkg.name));
		return packages.flatMap((pkg) =>
			ALL_DEPENDENCY_FIELDS.flatMap((field) =>
				Object.keys(pkg[field])
					.filter((name) => names.has(name) && name !== pkg.name)
					.sort()
					.map((to) => LayerEdge.make({ from: pkg.name, to, field })),
			),
		);
	};

	/** Discover the workspace and check it against `policy`. */
	static readonly checkWorkspace = Effect.fn("WorkspaceLayering.checkWorkspace")(function* (policy: LayerPolicy) {
		const discovery = yield* WorkspaceDiscovery;
		const packages = yield* discovery.listPackages;
		return WorkspaceLayering.check(
			{ names: packages.map((pkg) => pkg.name), edges: WorkspaceLayering.edgesOf(packages) },
			policy,
		);
	});
}
