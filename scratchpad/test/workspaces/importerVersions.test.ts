// The hook-injected-catalog regression: a `catalog:` specifier that NO committed
// catalog source declares must still resolve to a concrete version, or a real
// dependency bump produces no diff row and no changeset.
//
// Reproduced from `spencerbeggs/type-registry-effect` (Actions run 30130459942),
// where `effect` moved 4.0.0-beta.99 → 4.0.0-beta.101 and zero changesets were
// written. The peer is declared `catalog:effect:peers`, a catalog injected by
// `@effected/pnpm-plugin-effect`'s pnpmfile hook — so it appears in neither
// `pnpm-workspace.yaml` (which declares no catalogs at all) nor the lockfile's
// `catalogs:` block (pnpm does not record a peer-only catalog). Both sides of the
// diff resolved it to the same raw string, so `from !== to` was false.

import { assert, describe, it } from "@effect/vitest";
import { Lockfile } from "../../effected/lockfiles/index.ts";
import { Effect, Option, Schema, Result } from "effect";
import { CatalogSet, WorkspaceStateSnapshot } from "../../effected/workspaces/index.ts";
import { importerVersionsOf, unanimousVersionOf } from "../../effected/workspaces/internal/importerVersions.ts";

/**
 * A pnpm lockfile whose root importer records `effect` only as a
 * devDependency — exactly what pnpm writes for the reproduction repo. The
 * `catalog:effect:peers` peer declaration has NO importer row of its own,
 * which is why the fallback must join by name across fields.
 */
const pnpmLock = (effectVersion: string, platformNodeVersion: string) => `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

catalogs:
  effect:
    effect:
      specifier: ${effectVersion}
      version: ${effectVersion}

importers:

  .:
    devDependencies:
      effect:
        specifier: catalog:effect
        version: ${effectVersion}
      '@effect/platform-node':
        specifier: catalog:effect
        version: ${platformNodeVersion}
      local-link:
        specifier: link:../local
        version: link:../local

packages: {}
`;

const parse = (text: string) => Lockfile.parse(text, { format: "pnpm" });

describe("importerVersionsOf", () => {
	it.effect("indexes an importer's recorded versions by dependency name", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse(pnpmLock("4.0.0-beta.99", "4.0.0-beta.99"));
			const index = importerVersionsOf(lockfile);
			assert.strictEqual(index["."]?.effect, "4.0.0-beta.99");
		}),
	);

	it.effect("strips pnpm's peer-disambiguation suffix", () =>
		Effect.gen(function* () {
			// What pnpm actually writes for a package with peers — the raw string is
			// stored verbatim by @effected/lockfiles, so an unstripped fallback would
			// render this entire chain as the "version" in a changeset table.
			const raw = "4.0.0-beta.101(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))";
			const lockfile = yield* parse(pnpmLock("4.0.0-beta.101", raw));
			const index = importerVersionsOf(lockfile);
			assert.strictEqual(index["."]?.["@effect/platform-node"], "4.0.0-beta.101");
		}),
	);

	it.effect("skips link: entries — a filesystem edge is not a version", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse(pnpmLock("4.0.0-beta.99", "4.0.0-beta.99"));
			const index = importerVersionsOf(lockfile);
			assert.isUndefined(index["."]?.["local-link"]);
		}),
	);
});

describe("unanimousVersionOf", () => {
	it("answers when every importer recording the dependency agrees", () => {
		const index = { ".": { effect: "1.2.3" }, "packages/a": { effect: "1.2.3" } };
		assert.strictEqual(unanimousVersionOf(index, "effect"), "1.2.3");
	});

	it("abstains when importers disagree — no single correct answer exists", () => {
		const index = { ".": { effect: "1.2.3" }, "packages/a": { effect: "4.5.6" } };
		assert.isUndefined(unanimousVersionOf(index, "effect"));
	});

	it("ignores importers that record nothing for the dependency", () => {
		const index = { ".": { effect: "1.2.3" }, "packages/a": { other: "9.9.9" } };
		assert.strictEqual(unanimousVersionOf(index, "effect"), "1.2.3");
	});

	it("answers nothing when no importer records it", () => {
		assert.isUndefined(unanimousVersionOf({ ".": { other: "1.0.0" } }, "effect"));
	});
});

// ── The snapshot resolution surface ─────────────────────────────────────────

/** A snapshot carrying no catalogs at all — the reproduction repo's shape. */
const snapshot = (importerVersions: Record<string, Record<string, string>>) =>
	WorkspaceStateSnapshot.make({
		packages: [],
		catalogs: CatalogSet.empty(),
		importerVersions,
	});

describe("WorkspaceStateSnapshot.resolve — the hook-injected catalog fallback", () => {
	it("resolves an unresolvable catalog: specifier through the importer index", () => {
		const before = snapshot({ ".": { effect: "4.0.0-beta.99" } });
		const after = snapshot({ ".": { effect: "4.0.0-beta.101" } });

		const from = before.resolve("effect", "catalog:effect:peers");
		const to = after.resolve("effect", "catalog:effect:peers");

		assert.deepStrictEqual(from, Option.some("4.0.0-beta.99"));
		assert.deepStrictEqual(to, Option.some("4.0.0-beta.101"));
		// The whole point: the two sides must now DIFFER, so a diff emits a row.
		assert.notStrictEqual(Option.getOrNull(from), Option.getOrNull(to));
	});

	it("abstains when importers disagree rather than inventing an answer", () => {
		const divergent = snapshot({ ".": { effect: "1.0.0" }, "packages/a": { effect: "2.0.0" } });
		assert.isTrue(Option.isNone(divergent.resolve("effect", "catalog:effect:peers")));
	});

	it("leaves a plain range alone — it is already its own answer", () => {
		// The consumer falls back to the raw specifier for these; a fallback here
		// would replace a declared RANGE with an installed VERSION in the table.
		const state = snapshot({ ".": { effect: "4.0.0-beta.99" } });
		assert.isTrue(Option.isNone(state.resolve("effect", "^4.0.0")));
	});

	it("prefers the catalog set when it can answer", () => {
		const state = WorkspaceStateSnapshot.make({
			packages: [],
			catalogs: CatalogSet.fromCatalogs({ default: { effect: "1.0.0" } }),
			importerVersions: { ".": { effect: "9.9.9" } },
		});
		assert.deepStrictEqual(state.resolve("effect", "catalog:"), Option.some("1.0.0"));
	});
});

describe("WorkspaceStateSnapshot.resolveIn", () => {
	it("answers precisely where resolve must abstain", () => {
		const divergent = snapshot({ ".": { effect: "1.0.0" }, "packages/a": { effect: "2.0.0" } });
		assert.deepStrictEqual(divergent.resolveIn(".", "effect", "catalog:effect:peers"), Option.some("1.0.0"));
		assert.deepStrictEqual(divergent.resolveIn("packages/a", "effect", "catalog:effect:peers"), Option.some("2.0.0"));
	});

	it("answers nothing for an unknown importer", () => {
		const state = snapshot({ ".": { effect: "1.0.0" } });
		assert.isTrue(Option.isNone(state.resolveIn("packages/nope", "effect", "catalog:effect:peers")));
	});
});

describe("WorkspaceStateSnapshot — wire compatibility", () => {
	it("decodes a value serialized before importerVersions existed", () => {
		// The field is optional precisely so older serialized snapshots survive; an
		// absent index simply makes the fallback inert, which is the behavior those
		// values were captured under.
		const decoded = Result.getOrThrow(Schema.decodeResult(WorkspaceStateSnapshot)({
			packages: [],
			catalogs: { entries: {} },
		}));
		assert.isTrue(Option.isNone(decoded.resolve("effect", "catalog:effect:peers")));
	});
});
