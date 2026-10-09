// DuplicateCheck: which names resolve at more than one version, and who pulls
// each copy.
//
// The lockfiles under `fixtures/duplicates/` are HAND-AUTHORED (see that
// directory's README): there is no oracle to agree with, because no package
// manager ships the aggregated question this module answers (issue #603). Each
// fixture differs from its neighbour in exactly one way, so a test cannot pass
// by accident. `fixtures/peers/` is reused where PeerCheck already measured the
// same limitation. No `FileSystem` service is involved: DuplicateCheck is a
// pure value over an already-parsed Lockfile.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Lockfile } from "../../effected/lockfiles/index.ts";
import { Effect } from "effect";
import type { Dependent, DuplicatedPackage } from "../../effected/workspaces/DuplicateCheck.ts";
import { DuplicateCheck } from "../../effected/workspaces/DuplicateCheck.ts";

const fixture = (relative: string): string => readFileSync(join(import.meta.dirname, "fixtures", relative), "utf8");

const parse = (dir: string) => Lockfile.parse(fixture(`duplicates/${dir}/pnpm-lock.yaml`), { format: "pnpm" });

/** A dependent rendered as one comparable string. */
const render = (dependent: Dependent): string =>
	dependent._tag === "importer" ? `importer:${dependent.path}` : `package:${dependent.name}@${dependent.version}`;

/** One duplicated package flattened to `version → instanceId → dependents`. */
const flatten = (row: DuplicatedPackage): Record<string, Record<string, ReadonlyArray<string>>> =>
	Object.fromEntries(
		row.versions.map((version) => [
			version.version,
			Object.fromEntries(version.instances.map((instance) => [instance.instanceId, instance.dependents.map(render)])),
		]),
	);

const byName = (report: DuplicateCheck, name: string): DuplicatedPackage | undefined =>
	report.duplicates.find((row) => row.name === name);

describe("DuplicateCheck.run", () => {
	it.effect("reproduces issue #298: two copies of @effected/commands, each naming the package that pulls it", () =>
		Effect.gen(function* () {
			const report = DuplicateCheck.run(yield* parse("kit-skew"));

			assert.isFalse(report.isClean);
			assert.deepStrictEqual(report.unresolvedImporters, []);
			assert.deepStrictEqual(
				report.duplicates.map((row) => row.name),
				["@effected/commands"],
			);

			const commands = byName(report, "@effected/commands");
			assert.isDefined(commands);
			// The question the issue could not answer from the type error: WHICH
			// versions, and WHO holds each one. `@effected/npm` was never bumped,
			// which is exactly why nobody suspected it.
			assert.deepStrictEqual(flatten(commands as DuplicatedPackage), {
				"0.2.1": { "@effected/commands@0.2.1": ["package:@effected/npm@0.8.2"] },
				"0.3.1": { "@effected/commands@0.3.1": ["package:@effected/workspaces@0.10.1"] },
			});
		}),
	);

	it.effect("is clean once the same graph deduplicates to one version", () =>
		Effect.gen(function* () {
			// `kit-skew` after `pnpm update @effected/npm`: the ONE edit the issue's
			// fix needed. The other copy is simply gone, and so is the finding.
			const report = DuplicateCheck.run(yield* parse("kit-deduped"));

			assert.deepStrictEqual(report.duplicates, []);
			assert.isTrue(report.isClean);
			assert.deepStrictEqual(report.unresolvedImporters, []);
		}),
	);

	it.effect("does not call two peer-suffix instances of ONE version a duplicate", () =>
		Effect.gen(function* () {
			// foo@1.0.0 exists twice — resolved with and without its optional peer.
			// Two instances, one version: the code that loads is identical, so
			// nothing here can produce the type-identity skew the check exists to
			// catch. Counting instances instead of versions would report this.
			const report = DuplicateCheck.run(yield* parse("peer-variants"));

			assert.deepStrictEqual(report.duplicates, []);
			assert.isTrue(report.isClean);
		}),
	);

	it.effect("lists both instances under their version once a second version makes the name a duplicate", () =>
		Effect.gen(function* () {
			// The same graph plus a third importer taking foo@2.0.0. Now the
			// version list has two entries, and the 1.0.0 entry carries BOTH
			// instances — with the peer variant attributed to the importer that
			// took it, not merged into the other.
			const report = DuplicateCheck.run(yield* parse("peer-variants-skew"));

			assert.isFalse(report.isClean);
			assert.deepStrictEqual(
				report.duplicates.map((row) => row.name),
				["foo"],
			);
			const foo = byName(report, "foo");
			assert.isDefined(foo);
			assert.strictEqual(foo?.versions.length, 2);
			assert.deepStrictEqual(flatten(foo as DuplicatedPackage), {
				"1.0.0": {
					"foo@1.0.0": ["importer:packages/other"],
					"foo@1.0.0(bar@1.0.0)": ["importer:."],
				},
				"2.0.0": { "foo@2.0.0": ["importer:packages/third"] },
			});
		}),
	);

	it.effect("`names` narrows what is REPORTED, never what is walked", () =>
		Effect.gen(function* () {
			// Two skews: the kit's `@effected/commands` and a non-kit `semver`. The
			// non-kit `@savvy-web/silk-effects` is what pulls the stale commands
			// copy — the second incident in issue #603. Filtering it out of the
			// report must leave it standing as a dependent, or the report names
			// the skew without naming the culprit.
			const unfiltered = DuplicateCheck.run(yield* parse("filtered"));
			assert.deepStrictEqual(
				unfiltered.duplicates.map((row) => row.name),
				["@effected/commands", "semver"],
			);

			const kit = DuplicateCheck.run(yield* parse("filtered"), { names: DuplicateCheck.kit });
			assert.deepStrictEqual(
				kit.duplicates.map((row) => row.name),
				["@effected/commands"],
			);
			assert.isFalse(kit.isClean);
			const commands = byName(kit, "@effected/commands");
			assert.deepStrictEqual(flatten(commands as DuplicatedPackage), {
				"0.2.1": { "@effected/commands@0.2.1": ["package:@savvy-web/silk-effects@6.0.4"] },
				"0.3.1": { "@effected/commands@0.3.1": ["package:@effected/workspaces@0.10.1"] },
			});

			// A filter matching nothing duplicated is a clean report — `isClean`
			// answers for the names asked about, not for the whole graph.
			const nothing = DuplicateCheck.run(yield* parse("filtered"), { names: (name) => name === "left-pad" });
			assert.deepStrictEqual(nothing.duplicates, []);
			assert.isTrue(nothing.isClean);
		}),
	);

	it("`kit` names effect and every @effected/* package, and nothing else", () => {
		assert.isTrue(DuplicateCheck.kit("effect"));
		assert.isTrue(DuplicateCheck.kit("@effected/commands"));
		assert.isTrue(DuplicateCheck.kit("@effected/git"));
		// `effect` exactly — not everything with the prefix, which would drag in
		// `@effect/vitest` and `effect-*` lookalikes a consumer never asked about.
		assert.isFalse(DuplicateCheck.kit("@effect/vitest"));
		assert.isFalse(DuplicateCheck.kit("effect-utils"));
		assert.isFalse(DuplicateCheck.kit("@effected"));
		assert.isFalse(DuplicateCheck.kit("@savvy-web/silk-effects"));
		assert.isFalse(DuplicateCheck.kit("semver"));
	});

	it.effect("attributes a copy taken by a non-root importer to that importer's path", () =>
		Effect.gen(function* () {
			// The root importer is empty; `packages/app` takes commands 0.3.1
			// directly while its @effected/npm holds 0.2.1. Under pnpm that importer
			// has its own workspace row, and the row's edges are the importer's own
			// dependencies — so the dependent is the importer, by path, never a
			// `package` row named after a directory with a "0.0.0" placeholder.
			const report = DuplicateCheck.run(yield* parse("other-importer"));

			assert.isFalse(report.isClean);
			const commands = byName(report, "@effected/commands");
			assert.deepStrictEqual(flatten(commands as DuplicatedPackage), {
				"0.2.1": { "@effected/commands@0.2.1": ["package:@effected/npm@0.8.2"] },
				"0.3.1": { "@effected/commands@0.3.1": ["importer:packages/app"] },
			});
		}),
	);

	it.effect("names the importers it could not resolve, exactly as PeerCheck does", () =>
		Effect.gen(function* () {
			// The same limitation, the same fixtures: npm and bun record no resolved
			// version per root-importer dependency and no root package row, so the
			// root cannot be joined to instances and is reported rather than passed
			// silently. pnpm records the version and is unaffected.
			const npm = DuplicateCheck.run(
				yield* Lockfile.parse(fixture("peers/npm-root/package-lock.json"), { format: "npm" }),
			);
			assert.include(npm.unresolvedImporters, ".");

			const pnpm = DuplicateCheck.run(yield* Lockfile.parse(fixture("peers/mixed/pnpm-lock.yaml"), { format: "pnpm" }));
			assert.deepStrictEqual(pnpm.unresolvedImporters, []);

			// A root with NO dependencies has nothing to fail to resolve.
			const rootless = DuplicateCheck.run(
				yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" }),
			);
			assert.deepStrictEqual(rootless.unresolvedImporters, []);
		}),
	);

	it.effect("finds the skew PeerCheck's own root-importer fixture carries", () =>
		Effect.gen(function* () {
			// `peers/rootimporter` is real pnpm output: react at 17.0.2 (root) and
			// 18.3.1 (packages/other), with react-dom@18.3.1 present twice by peer
			// suffix. react is a duplicate; react-dom is not.
			const report = DuplicateCheck.run(
				yield* Lockfile.parse(fixture("peers/rootimporter/pnpm-lock.yaml"), { format: "pnpm" }),
			);

			assert.deepStrictEqual(
				report.duplicates.map((row) => row.name),
				["react"],
			);
			const react = byName(report, "react");
			assert.deepStrictEqual(flatten(react as DuplicatedPackage), {
				"17.0.2": { "react@17.0.2": ["importer:.", "package:react-dom@18.3.1"] },
				"18.3.1": { "react@18.3.1": ["importer:packages/other", "package:react-dom@18.3.1"] },
			});
		}),
	);
});
