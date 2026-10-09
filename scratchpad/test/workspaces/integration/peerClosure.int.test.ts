// @effect-diagnostics nodeBuiltinImport:skip-file
// Every published @effected package declares its full @effected peer closure: never left to be satisfied by whatever
// a consumer's tree happens to contain. The kit's own packages are each other's dependencies, so a package that peers
// on X must also peer on everything X requires, or X's peers escape to the consumer's importer and are satisfied only
// transitively (or bound wrongly by `autoInstallPeers`). See okf/conventions/peer-dependency-discipline.md.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import { WorkspaceDiscovery, Workspaces } from "../../../effected/workspaces/index.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const Live = Workspaces.layer({ cwd: REPO }).pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

/** What the closure rule reads of a package. */
interface Manifest {
	readonly name: string;
	readonly published: boolean;
	/** Regular dependencies, by name. */
	readonly dependencies: ReadonlyArray<string>;
	/** Required peers, by name. */
	readonly peers: ReadonlyArray<string>;
	/** Optional peers, by name. */
	readonly optionalPeers: ReadonlyArray<string>;
}

interface Gap {
	readonly name: string;
	/** The peer that is missing. */
	readonly missing: string;
	/** The chain that requires it, from a declared dependency or peer of `name`. */
	readonly via: ReadonlyArray<string>;
}

/**
 * The @effected peers a published package needs and does not declare.
 *
 * A package's REQUIRED surface is its required peers and its regular dependencies. Each of those that is a workspace
 * package brings its own required peers, and those theirs, recursively; every one of them must be declared by the
 * package, as a peer or a regular dependency. An OPTIONAL peer, and anything only it requires, is optional: its closure
 * is the consumer's to satisfy when they take it.
 */
const closureGaps = (manifests: ReadonlyArray<Manifest>): ReadonlyArray<Gap> => {
	const byName = new Map(manifests.map((m) => [m.name, m]));
	const gaps: Array<Gap> = [];
	for (const pkg of manifests.filter((m) => m.published)) {
		// Only a regular dependency or a REQUIRED peer closes a required chain: an optional peer says a consumer may skip it,
		// which is exactly what a required chain cannot allow.
		const declared = new Set([...pkg.dependencies, ...pkg.peers]);
		const seen = new Set<string>([pkg.name]);
		const queue: Array<readonly [string, ReadonlyArray<string>]> = [...pkg.dependencies, ...pkg.peers]
			.filter((name) => byName.has(name))
			.map((name) => [name, [name]] as const);
		while (queue.length > 0) {
			const next = queue.shift();
			if (next === undefined) return assert.fail("expected a queued peer");
			const [name, via] = next;
			if (seen.has(name)) continue;
			seen.add(name);
			const manifest = byName.get(name);
			if (manifest === undefined) return assert.fail("expected a manifest for the queued peer");
			for (const required of manifest.peers.filter((peer) => byName.has(peer))) {
				if (
					required !== pkg.name &&
					!declared.has(required) &&
					!gaps.some((g) => g.name === pkg.name && g.missing === required)
				) {
					gaps.push({ name: pkg.name, missing: required, via });
				}
				queue.push([required, [...via, required]]);
			}
		}
	}
	return gaps;
};

const describeGaps = (gaps: ReadonlyArray<Gap>): ReadonlyArray<string> =>
	gaps.map((g) => `${g.name} is missing peer ${g.missing} (required through ${g.via.join(" -> ")})`).sort();

const kit = (record: Partial<Manifest> & Pick<Manifest, "name">): Manifest => ({
	published: true,
	dependencies: [],
	peers: [],
	optionalPeers: [],
	...record,
});

describe("the closure rule, on a toy graph (positive controls)", () => {
	const walker = kit({ name: "@effected/walker", peers: ["@effected/glob"] });
	const glob = kit({ name: "@effected/glob" });

	it("a package that peers on X but not on X's own required peer is a gap, naming both", () => {
		const cli = kit({ name: "@effected/cli", peers: ["@effected/walker"] });
		assert.deepStrictEqual(describeGaps(closureGaps([cli, walker, glob])), [
			"@effected/cli is missing peer @effected/glob (required through @effected/walker)",
		]);
	});

	it("declaring it, as a required peer or as a regular dependency, closes the gap", () => {
		assert.deepStrictEqual(
			closureGaps([kit({ name: "a", peers: ["@effected/walker", "@effected/glob"] }), walker, glob]),
			[],
		);
		assert.deepStrictEqual(
			closureGaps([kit({ name: "a", dependencies: ["@effected/walker", "@effected/glob"] }), walker, glob]),
			[],
		);
	});

	it("an OPTIONAL peer declaration does not close a required chain: the consumer may skip it and the chain still needs it", () => {
		assert.deepStrictEqual(
			describeGaps(
				closureGaps([kit({ name: "a", peers: ["@effected/walker"], optionalPeers: ["@effected/glob"] }), walker, glob]),
			),
			["a is missing peer @effected/glob (required through @effected/walker)"],
		);
	});

	it("the closure is transitive: a peer's peer's peer is required too", () => {
		const a = kit({ name: "a", peers: ["b"] });
		// Only `a` is published, so only its gaps are reported.
		const b = kit({ name: "b", published: false, peers: ["c"] });
		const c = kit({ name: "c", published: false, peers: ["d"] });
		const d = kit({ name: "d", published: false });
		assert.deepStrictEqual(describeGaps(closureGaps([a, b, c, d])), [
			"a is missing peer c (required through b)",
			"a is missing peer d (required through b -> c)",
		]);
	});

	it("a regular dependency brings its required peers too", () => {
		const consumer = kit({ name: "app", dependencies: ["@effected/walker"] });
		assert.deepStrictEqual(describeGaps(closureGaps([consumer, walker, glob])), [
			"app is missing peer @effected/glob (required through @effected/walker)",
		]);
	});

	it("an optional peer's closure is optional: nothing it requires is demanded", () => {
		const cli = kit({ name: "@effected/cli", optionalPeers: ["@effected/walker"] });
		assert.deepStrictEqual(closureGaps([cli, walker, glob]), []);
		// And a peer another package marks optional is not required of its dependents.
		const soft = kit({ name: "soft", peers: ["@effected/glob"], optionalPeers: ["@effected/walker"] });
		const user = kit({ name: "user", peers: ["soft"] });
		assert.deepStrictEqual(describeGaps(closureGaps([user, soft, walker, glob])), [
			"user is missing peer @effected/glob (required through soft)",
		]);
	});

	it("a private package owes nothing, and a name that is not in the workspace is ignored", () => {
		assert.deepStrictEqual(
			closureGaps([kit({ name: "p", published: false, peers: ["@effected/walker"] }), walker, glob]),
			[],
		);
		assert.deepStrictEqual(
			closureGaps([kit({ name: "p", peers: ["effect", "@effect/platform-node"] }), walker, glob]),
			[],
		);
	});

	it("a cycle terminates", () => {
		const x = kit({ name: "x", peers: ["y"] });
		const y = kit({ name: "y", peers: ["x"] });
		assert.deepStrictEqual(closureGaps([x, y]), []);
	});
});

describe("every published @effected package declares its full peer closure", () => {
	layer(Live)((it) => {
		it.effect("none is missing a peer that a dependency or peer of it requires", () =>
			Effect.gen(function* () {
				const packages = yield* (yield* WorkspaceDiscovery).listPackages;
				const manifests: ReadonlyArray<Manifest> = packages
					.filter((pkg) => pkg.name.startsWith("@effected/"))
					.map((pkg) => {
						const meta = pkg.manifestRecord.peerDependenciesMeta;
						const isOptional = (name: string): boolean => {
							if (!P.isObject(meta)) return false;
							const entry = meta[name];
							return P.isObject(entry) && entry.optional === true;
						};
						const peerNames = Object.keys(pkg.peerDependencies);
						return {
							name: pkg.name,
							published: pkg.publishConfig?.access === "public",
							dependencies: Object.keys(pkg.dependencies),
							peers: peerNames.filter((name) => !isOptional(name)),
							optionalPeers: peerNames.filter(isOptional),
						};
					});
				assert.isAbove(manifests.filter((m) => m.published).length, 25, "the published packages were found");
				assert.deepStrictEqual(describeGaps(closureGaps(manifests)), []);
			}),
		);
	});
});
