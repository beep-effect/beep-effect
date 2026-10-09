// Codec round-trips: the model is API for serialization consumers (workspaces
// snapshots), so encode∘decode identity is contract, not incidental.
//
// The `integrity` and `specifier` leaves are NOT schema-derivable as
// arbitraries (re-probed against effect@4.0.0-rc.115's native
// `effect/Arbitrary`, which replaced the fast-check bridge):
//   - `ResolvedPackage.integrity` is the `@effected/npm` `IntegrityHash` brand,
//     a `makeFilter` predicate over three grammars. The filter carries no
//     `arbitraryConstraint` pattern, so the native compiler cannot generate it
//     constructively and falls back to rejecting random printable-ASCII strings
//     — none of which is ever an SRI/corepack/yarn hash. That no longer hangs
//     (discards are budgeted): `Arbitrary.sampleEffect(Arbitrary.schema(
//     IntegrityHash))` fails with `SampleError { generated: 0, discards: 2001 }`
//     in ~4ms, and inside `ResolvedPackage` the optional key is simply never
//     populated, so a schema-derived arbitrary would never exercise it.
//   - `ImporterDependency.specifier` is the `DependencySpecifier.FromString`
//     codec. Its Type is a union of tagged classes carrying a free-form `raw`,
//     so a schema-derived arbitrary generates tag/raw mismatches (probed:
//     `{ _tag: "range", raw: "0" }`) whose encode∘decode does *not* round-trip
//     (the codec re-classifies `raw`).
// So these leaves are `Schema.Literals` of real values, the same pattern
// `@effected/npm`'s own DependencySpecifier round-trip suite uses. The
// plain-union fields (`WorkspaceDependency`, `LockfileIntegrity`) stay
// schema-derived, which works.
//
// Dictionaries over a small key set are generated as a struct of optional
// keys: `Schema.Record` over a literal key union always emits every key, and
// `isUniqueKey` over tuples collapses to the empty array, so neither samples
// the "some keys present" shapes a lockfile actually carries.

import { assert, describe, it } from "@effect/vitest";
import type { IntegrityHashBrand } from "../../effected/npm/index.ts";
import { DependencySpecifier } from "../../effected/npm/index.ts";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { ImporterDependency } from "../../effected/lockfiles/ImporterDependency.ts";
import { Lockfile } from "../../effected/lockfiles/Lockfile.ts";
import { LockfileImporter } from "../../effected/lockfiles/LockfileImporter.ts";
import { LockfileIntegrity } from "../../effected/lockfiles/LockfileIntegrity.ts";
import { ResolvedPackage } from "../../effected/lockfiles/ResolvedPackage.ts";
import { WorkspaceDependency } from "../../effected/lockfiles/WorkspaceDependency.ts";

const roundTrip = Effect.fn("roundTrip")(function*<T, S extends Schema.Codec<T, unknown>>(schema: S, value: T) {
	const encoded = yield* Schema.encodeUnknownEffect(schema)(value);
	const decoded = yield* Schema.decodeUnknownEffect(schema)(encoded);
	assert.deepStrictEqual(decoded, value);
});

// ── Explicit arbitraries for the non-schema-derivable leaves ─────────────────

/**
 * A dictionary over a fixed key set, each key independently present or absent,
 * so the empty, partial and full maps all get sampled.
 */
const dictionary = <V extends Schema.Top>(
	keys: ReadonlyArray<string>,
	value: V,
): Arbitrary.Arbitrary<Record<string, V["Type"]>> =>
	Arbitrary.schema(Schema.Struct(Object.fromEntries(keys.map((key) => [key, Schema.optionalKey(value)])))).pipe(
		Arbitrary.map((entries) => ({ ...entries }) as Record<string, V["Type"]>),
	);

/** Present or absent with equal odds — an optional key read back as a value. */
const optional = <S extends Schema.Top>(schema: S): Arbitrary.Arbitrary<S["Type"] | undefined> =>
	Arbitrary.schema(Schema.Struct({ value: Schema.optionalKey(schema) })).pipe(
		Arbitrary.map((entries: { readonly value?: S["Type"] }) => entries.value),
	);

/** Up to `maxLength` draws from an Arbitrary — `Schema.Array` only composes Schemas. */
const arrayOf = <A>(item: Arbitrary.Arbitrary<A>, maxLength: number): Arbitrary.Arbitrary<Array<A>> =>
	Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: maxLength }))).pipe(
		Arbitrary.flatMap((length) => Arbitrary.all(Array.from({ length }, () => item))),
	);

const Integrity = Schema.Literals([
	"sha512-LgVTMpQtIopCi79SJeDiP0TfWi5CNEc/L/aRdTh3yIvmZXTnheWpKjSZhnvMl8iXbC1tFg9gdHHDMLoV7CnG+w==",
	"sha1-Zm9vYmFy",
	"sha256-YWJjZGVmZ2g=",
	"sha512.deadbeefcafe",
	"10c0/99a4b0f0e7991796b1e7e3f52dceb9137cae2a9dfc8fc0784a550dc4c558e15a",
]);

const specifierArb = Arbitrary.schema(
	Schema.Literals([
		"catalog:",
		"catalog:react18",
		"workspace:*",
		"workspace:^1.2.3",
		"^1.0.0",
		"1.2.3",
		"latest",
		"file:../local",
		"npm:lodash@^4.0.0",
	]),
).pipe(Arbitrary.map((s) => Result.getOrThrowWith(Schema.decodeResult(DependencySpecifier.FromString)(s), (error) => error)));

const DepField = Schema.Literals(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]);

const importerDependencyArb: Arbitrary.Arbitrary<ImporterDependency> = Arbitrary.all({
	name: Arbitrary.schema(Schema.Literals(["lodash", "chalk", "@scope/x", "typescript"])),
	specifier: specifierArb,
	depType: Arbitrary.schema(DepField),
	// A suffix only ever splits off a concrete version, so it is generated as part
	// of the version rather than beside it: an entry with a peerSuffix and no
	// version is a state the parser cannot emit, and sampling it would spend cases
	// on unreachable shapes.
	resolution: optional(
		Schema.Struct({
			version: Schema.Literals(["1.0.0", "5.9.3"]),
			peerSuffix: Schema.optionalKey(
				Schema.Literals(["(effect@4.0.0-beta.101)", "(ioredis@5.11.1(supports-color@8.1.1))"]),
			),
		}),
	),
}).pipe(
	Arbitrary.map(({ name, specifier, depType, resolution }) =>
		ImporterDependency.make({
			name,
			specifier,
			depType,
			...(resolution !== undefined ? { version: resolution.version } : {}),
			...(resolution?.peerSuffix !== undefined ? { peerSuffix: resolution.peerSuffix } : {}),
		}),
	),
);

const lockfileImporterArb: Arbitrary.Arbitrary<LockfileImporter> = Arbitrary.all({
	path: Arbitrary.schema(Schema.Literals([".", "packages/core", "packages/utils"])),
	dependencies: arrayOf(importerDependencyArb, 3),
}).pipe(Arbitrary.map((r) => LockfileImporter.make(r)));

const resolvedPackageArb: Arbitrary.Arbitrary<ResolvedPackage> = Arbitrary.all({
	name: Arbitrary.schema(Schema.Literals(["lodash", "chalk", "packages/core", "@scope/x"])),
	version: Arbitrary.schema(Schema.Literals(["1.0.0", "0.0.0", "5.6.2"])),
	integrity: optional(Integrity).pipe(Arbitrary.map((s) => s as IntegrityHashBrand | undefined)),
	isWorkspace: Arbitrary.schema(Schema.Boolean),
	relativePath: optional(Schema.Literals(["packages/core", "packages/utils"])),
	dependencies: dictionary(["a", "b"], Schema.Literals(["^1.0.0", "2.x"])),
	peerDependencies: dictionary(["react", "b"], Schema.Literals(["^18.0.0", "2.x"])),
	peerDependenciesMeta: dictionary(["react", "b"], Schema.Struct({ optional: Schema.Boolean })),
	resolved: dictionary(["a", "b"], Schema.Literals(["a@1.0.0", "b@2.0.0"])),
	unresolvedEdges: Arbitrary.schema(Schema.Array(Schema.Literals(["c", "d"])).check(Schema.isMaxLength(2))),
}).pipe(
	Arbitrary.map((r) =>
		ResolvedPackage.make({
			name: r.name,
			version: r.version,
			instanceId: `${r.name}@${r.version}`,
			isWorkspace: r.isWorkspace,
			dependencies: r.dependencies,
			peerDependencies: r.peerDependencies,
			peerDependenciesMeta: r.peerDependenciesMeta,
			resolved: r.resolved,
			unresolvedEdges: r.unresolvedEdges,
			...(r.integrity !== undefined ? { integrity: r.integrity } : {}),
			...(r.relativePath !== undefined ? { relativePath: r.relativePath } : {}),
		}),
	),
);

const lockfileArb: Arbitrary.Arbitrary<Lockfile> = Arbitrary.all({
	format: Arbitrary.schema(Schema.Literals(["bun", "npm", "pnpm", "yarn"])),
	lockfileVersion: Arbitrary.schema(Schema.Literals(["9.0", "6.0", "3"])),
	packages: arrayOf(resolvedPackageArb, 4),
	workspaceDependencies: Arbitrary.schema(Schema.Array(WorkspaceDependency).check(Schema.isMaxLength(3))),
	importers: arrayOf(lockfileImporterArb, 3),
}).pipe(Arbitrary.map((r) => Lockfile.make(r)));

describe("codec round-trips", () => {
	it.effect.prop("ResolvedPackage: decode ∘ encode is identity", [resolvedPackageArb], ([pkg]) =>
		roundTrip(ResolvedPackage, pkg),
	);

	it.effect.prop("WorkspaceDependency: decode ∘ encode is identity", [WorkspaceDependency], ([dep]) =>
		roundTrip(WorkspaceDependency, dep),
	);

	it.effect.prop("ImporterDependency: decode ∘ encode is identity", [importerDependencyArb], ([dep]) =>
		roundTrip(ImporterDependency, dep),
	);

	it.effect.prop("LockfileImporter: decode ∘ encode is identity", [lockfileImporterArb], ([importer]) =>
		roundTrip(LockfileImporter, importer),
	);

	it.effect.prop("Lockfile (with importers): decode ∘ encode is identity", [lockfileArb], ([lockfile]) =>
		roundTrip(Lockfile, lockfile),
	);

	it.effect.prop("LockfileIntegrity: decode ∘ encode is identity", [LockfileIntegrity], ([report]) =>
		roundTrip(LockfileIntegrity, report),
	);

	it.effect("a parsed fixture-shaped lockfile survives encode ∘ decode", () =>
		Effect.gen(function* () {
			const lockfile = Lockfile.make({
				format: "pnpm",
				lockfileVersion: "9.0",
				packages: [
					ResolvedPackage.make({
						name: "packages/core",
						version: "0.0.0",
						instanceId: "packages/core",
						isWorkspace: true,
						relativePath: "packages/core",
					}),
					ResolvedPackage.make({
						name: "chalk",
						version: "5.6.2",
						instanceId: "chalk@5.6.2",
						integrity: "sha512-abc" as IntegrityHashBrand,
						isWorkspace: false,
						dependencies: { "supports-color": "^9.0.0" },
						peerDependencies: { "supports-color": "^9.0.0" },
						peerDependenciesMeta: { "supports-color": { optional: true } },
						resolved: { "supports-color": "supports-color@9.0.0" },
						unresolvedEdges: ["ghost-dep"],
					}),
				],
				workspaceDependencies: [
					WorkspaceDependency.make({
						from: "packages/core",
						to: "@acme/utils",
						depType: "dependencies",
						constraint: "workspace:*",
					}),
				],
				importers: [
					LockfileImporter.make({
						path: "packages/core",
						dependencies: [
							ImporterDependency.make({
								name: "lodash",
								specifier: yield* Schema.decodeEffect(DependencySpecifier.FromString)("catalog:"),
								version: "4.17.23",
								depType: "dependencies",
							}),
						],
					}),
				],
			});
			yield* roundTrip(Lockfile, lockfile);
		}),
	);
});
