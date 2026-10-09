// PeerCheck, including the differential oracle against `pnpm peers check --json`.
//
// The oracle is COMMITTED, not shelled out to. This package forbids new local
// subprocess seams, and a test needing a live pnpm on PATH is neither hermetic
// nor reproducible in CI — so the check is run at fixture-generation time and
// its verdict lands beside the lockfile it describes. Provenance, including the
// pnpm version, is in `__test__/fixtures/peers/README.md`.
//
// The lockfiles are real pnpm output; no `FileSystem` service is involved, since
// PeerCheck is a pure value over an already-parsed Lockfile.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Lockfile } from "../../effected/lockfiles/index.ts";
import { Effect } from "effect";
import { NoPeerDependencyRules } from "../../effected/workspaces/ConfigDependencyHooks.ts";
import { peerNameMatcher } from "../../effected/workspaces/internal/peerPatterns.ts";
import type { UnsatisfiedPeer } from "../../effected/workspaces/PeerCheck.ts";
import { PeerCheck } from "../../effected/workspaces/PeerCheck.ts";
import { CatalogSet } from "../../effected/workspaces/WorkspaceCatalogs.ts";
import { PublishConfig, WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";

const fixture = (relative: string): string => readFileSync(join(import.meta.dirname, "fixtures", relative), "utf8");

const parse = (dir: string) => Lockfile.parse(fixture(`peers/${dir}/pnpm-lock.yaml`), { format: "pnpm" });

/**
 * A discovery-shaped {@link WorkspacePackage} for the `linkdeep*` probes:
 * `probe-a` at `packages/a`, declaring the `react: ^18.0.0` peer nothing in
 * that workspace satisfies.
 *
 * @remarks
 * The join reads only `relativePath`, `name`, `version`, `peerDependencies`
 * and (for optional flags) `manifestRecord`; the rest is what discovery always
 * carries, spelled minimally here because the model requires it.
 */
const probeA = (overrides?: {
	readonly name?: string;
	readonly version?: string;
	readonly relativePath?: string;
	readonly peerDependencies?: Record<string, string>;
	readonly publishConfig?: PublishConfig;
}): WorkspacePackage =>
	WorkspacePackage.make({
		name: overrides?.name ?? "probe-a",
		version: overrides?.version ?? "1.0.0",
		path: "C:/ws/packages/a",
		packageJsonPath: "C:/ws/packages/a/package.json",
		relativePath: overrides?.relativePath ?? "packages/a",
		workspaceRoot: "C:/ws",
		peerDependencies: overrides?.peerDependencies ?? { react: "^18.0.0" },
		...(overrides?.publishConfig === undefined ? {} : { publishConfig: overrides.publishConfig }),
	});

/** One normalized row, comparable across both sides of the oracle. */
interface Row {
	readonly importer: string;
	readonly dependency: string;
	readonly wanted: string;
	readonly found: string | null;
	readonly optional: boolean;
	readonly parents: ReadonlyArray<string>;
}

const order = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
	[...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

const ours = (rows: ReadonlyArray<UnsatisfiedPeer>): ReadonlyArray<Row> =>
	order(
		rows.map((row) => ({
			importer: row.importer,
			dependency: row.dependency,
			wanted: row.wanted,
			found: row.found,
			optional: row.optional,
			parents: row.parents.map((p) => `${p.name}@${p.version}`),
		})),
	);

/** pnpm's own shape, narrowed to the fields the comparison uses. */
interface OracleEntry {
	readonly parents: ReadonlyArray<{ readonly name: string; readonly version: string }>;
	readonly optional: boolean;
	readonly wantedRange: string;
	readonly foundVersion?: string;
}
type Oracle = Readonly<
	Record<
		string,
		{
			readonly bad: Record<string, ReadonlyArray<OracleEntry>>;
			readonly missing: Record<string, ReadonlyArray<OracleEntry>>;
		}
	>
>;

const theirs = (dir: string, file = "peers-check.json"): ReadonlyArray<Row> => {
	const oracle = JSON.parse(fixture(`peers/${dir}/${file}`)) as Oracle;
	const rows: Array<Row> = [];
	for (const [importer, report] of Object.entries(oracle)) {
		// A clean importer still emits its key with empty objects, so emptiness
		// here is a verdict, not an absence.
		for (const section of [report.bad, report.missing]) {
			for (const [dependency, entries] of Object.entries(section ?? {})) {
				for (const entry of entries) {
					rows.push({
						importer,
						dependency,
						wanted: entry.wantedRange,
						// `missing` entries carry no foundVersion — the same distinction
						// our `found: null` makes, which is why no extra discriminant is
						// needed on either side.
						found: entry.foundVersion ?? null,
						optional: entry.optional,
						parents: entry.parents.map((p) => `${p.name}@${p.version}`),
					});
				}
			}
		}
	}
	return order(rows);
};

describe("PeerCheck.run", () => {
	it.effect("agrees with pnpm peers check on a workspace mixing all four verdicts", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("mixed"));
			assert.isTrue(report.supported);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("mixed"));
		}),
	);

	it.effect("agrees with pnpm peers check on unresolvable peers, transitive ones included", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("missing"));
			assert.isTrue(report.supported);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("missing"));
		}),
	);

	it.effect("reports an unmet required peer with the version that actually resolved", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("mixed"));
			const row = report.unsatisfied.find((r) => r.importer === "packages/unmet" && r.dependency === "react");

			assert.isDefined(row);
			assert.strictEqual(row?.wanted, "^18.3.1");
			assert.strictEqual(row?.found, "17.0.2");
			assert.isFalse(row?.optional);
			assert.deepStrictEqual(
				row?.parents.map((p) => `${p.name}@${p.version}`),
				["react-dom@18.3.1"],
			);
		}),
	);

	it.effect("distinguishes an unmet OPTIONAL peer, and keeps it out of `required`", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("mixed"));
			const row = report.unsatisfied.find((r) => r.importer === "packages/optional" && r.dependency === "redux");

			assert.isDefined(row);
			assert.isTrue(row?.optional);
			assert.strictEqual(row?.found, "4.2.1");
			// The consumer's gate fires on required peers only, so an optional row
			// must never reach it.
			assert.isTrue(report.required.every((r) => !r.optional));
			assert.isUndefined(report.required.find((r) => r.dependency === "redux"));
		}),
	);

	it.effect("collapses a DIAMOND to one row per package, as pnpm does", () =>
		Effect.gen(function* () {
			// `use-sync-external-store@1.2.2` is reached twice from one importer —
			// via react-redux and via zustand (an override pins both to one version,
			// which is what makes it a diamond rather than two instances) — and it
			// declares an unsatisfied `react` peer.
			//
			// pnpm reports that peer ONCE, carrying the react-redux chain, and says
			// nothing about the zustand chain: it collapses per (importer, peer,
			// package) rather than emitting one row per parent chain. The oracle is
			// the decision here, not our preference, and this fixture exists because
			// no other one has two chains to a single peer-declaring package.
			const report = PeerCheck.run(yield* parse("diamond"));
			assert.isTrue(report.supported);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("diamond"));

			// Stated directly as well, because the oracle comparison above would
			// also pass if BOTH sides grew the second chain.
			const rows = report.unsatisfied.filter(
				(r) => r.dependency === "react" && r.parents.some((p) => p.name === "use-sync-external-store"),
			);
			assert.strictEqual(rows.length, 1);
			assert.deepStrictEqual(
				rows[0]?.parents.map((p) => p.name),
				["react-redux", "use-sync-external-store"],
			);
			// The other chain really is reachable — without this the assertion above
			// could pass because zustand never reaches the package at all.
			// Compare against the provider's own instanceId rather than spelling one:
			// the id is opaque, and hardcoding its shape would couple this test to a
			// spelling @effected/lockfiles is free to change while PeerCheck stays correct.
			const lockfile = yield* parse("diamond");
			const zustand = lockfile.packagesNamed("zustand")[0];
			const provider = lockfile.packagesNamed("use-sync-external-store").find((p) => p.version === "1.2.2");
			assert.isDefined(provider);
			assert.strictEqual(zustand?.resolved["use-sync-external-store"], provider?.instanceId);
		}),
	);

	it.effect("reports `found: null` for a peer nothing resolved, with no extra discriminant", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("missing"));
			const rows = report.unsatisfied.filter((r) => r.dependency === "react");

			assert.strictEqual(rows.length, 3);
			assert.isTrue(rows.every((r) => r.found === null));
			// One of the three is TRANSITIVE — declared by a dependency of a
			// dependency — which is why `parents` is a path, not one package.
			const transitive = rows.find((r) => r.parents.length === 2);
			assert.isDefined(transitive);
			assert.deepStrictEqual(
				transitive?.parents.map((p) => p.name),
				["react-redux", "use-sync-external-store"],
			);
		}),
	);

	it.effect("finds nothing for a satisfied importer, and says so as a verdict", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("mixed"));
			assert.isUndefined(report.unsatisfied.find((r) => r.importer === "packages/ok"));
			// pnpm resolves peers from the workspace root, so this importer's
			// react-dom is satisfied by a SIBLING's react. A checker reasoning over
			// importer manifests rather than resolved instances would report a false
			// positive here; the oracle agrees it is clean.
			assert.isUndefined(report.unsatisfied.find((r) => r.importer === "packages/missing"));
		}),
	);

	it.effect("agrees with pnpm peers check on a ROOT importer with real dependencies", () =>
		Effect.gen(function* () {
			// The root importer has no package row under any format, so it is
			// answered by joining its recorded per-dependency version to an
			// instance. Both earlier oracle fixtures declare `.: {}`, so this is
			// the only fixture that exercises that join productively — and it is
			// the common case, not an edge case: this repository's own lockfile has
			// a root importer with real dependencies.
			const report = PeerCheck.run(yield* parse("rootimporter"));
			assert.isTrue(report.supported);
			assert.deepStrictEqual(report.unresolvedImporters, []);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("rootimporter"));

			const row = report.required.find((r) => r.importer === ".");
			assert.isDefined(row);
			assert.strictEqual(row?.dependency, "react");
			assert.strictEqual(row?.found, "17.0.2");
		}),
	);

	it.effect("disambiguates two peer variants of one name@version by the recorded suffix", () =>
		Effect.gen(function* () {
			// react-dom@18.3.1 exists twice, resolved against react@17.0.2 and
			// react@18.3.1. The root took the 17.0.2 variant and the importer entry
			// says so through its peer suffix. Joining on name+version alone cannot
			// tell them apart, and skipping would silently drop a real unmet peer —
			// which is what the oracle comparison above would then catch.
			const report = PeerCheck.run(yield* parse("rootimporter"));
			const row = report.unsatisfied.find((r) => r.importer === "." && r.dependency === "react");

			assert.isDefined(row);
			// The 17.0.2 variant's peer, not the 18.3.1 variant's (which is satisfied).
			assert.strictEqual(row?.found, "17.0.2");
			assert.strictEqual(row?.wanted, "^18.3.1");
			// The sibling importer resolved the OTHER variant and is clean.
			assert.isUndefined(report.unsatisfied.find((r) => r.importer === "packages/other"));
		}),
	);

	it.effect("skips an ambiguous join rather than guessing a variant", () =>
		Effect.gen(function* () {
			// Hand-authored: the importer entry records a version with NO suffix
			// while two variants of that name@version exist, so nothing says which
			// was taken. Guessing the first would attribute one variant's unmet peer
			// to an importer that may have resolved the other — a fabricated finding,
			// which is worse than a missing one.
			const report = PeerCheck.run(yield* parse("ambiguous"));

			assert.isUndefined(report.unsatisfied.find((r) => r.importer === "."));
			// The importer still counts as resolvable — its react joined fine — so
			// it is not reported as unresolvable either.
			assert.deepStrictEqual(report.unresolvedImporters, []);
			// The sibling, whose entry does carry a suffix, is unaffected.
			assert.isUndefined(report.unsatisfied.find((r) => r.importer === "packages/other"));
		}),
	);

	it.effect("answers identically for npm and bun, with no per-format branch", () =>
		Effect.gen(function* () {
			// The same workspace shape written by three managers. If any per-format
			// knowledge had leaked into PeerCheck, these two would not agree with
			// the pnpm verdict on the equivalent tree.
			const npm = PeerCheck.run(yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" }));
			const bun = PeerCheck.run(yield* Lockfile.parse(fixture("peers/bun/bun.lock"), { format: "bun" }));

			for (const [name, report] of [
				["npm", npm],
				["bun", bun],
			] as const) {
				assert.isTrue(report.supported, name);
				const row = report.required.find(
					(r) => r.dependency === "react" && r.parents.some((pp) => pp.name === "react-dom"),
				);
				assert.isDefined(row, `${name}: react-dom's unmet peer`);
				assert.strictEqual(row?.wanted, "^18.3.1", name);
				assert.strictEqual(row?.found, "17.0.2", name);
				assert.deepStrictEqual(
					row?.parents.map((pp) => pp.name),
					["react-dom"],
					name,
				);
			}
		}),
	);

	it.effect("names the importers it could not resolve rather than passing them silently", () =>
		Effect.gen(function* () {
			// Neither npm nor bun records a resolved version per importer
			// dependency, and neither emits a package row for the root — so the root
			// importer cannot be joined to instances. It is REPORTED, because a gate
			// that sees no rows for an importer is entitled to know whether that
			// means "clean" or "not looked at".
			const npm = PeerCheck.run(yield* Lockfile.parse(fixture("peers/npm-root/package-lock.json"), { format: "npm" }));
			assert.include(npm.unresolvedImporters, ".");
			// pnpm records the version, so it has no unresolvable importers.
			const pnpm = PeerCheck.run(yield* parse("mixed"));
			assert.deepStrictEqual(pnpm.unresolvedImporters, []);
			// A root with NO dependencies is legitimately clean, not unresolvable —
			// there is nothing to fail to resolve.
			const rootless = PeerCheck.run(yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" }));
			assert.deepStrictEqual(rootless.unresolvedImporters, []);
		}),
	);

	it.effect("sees a workspace package's OWN unmet peer, which pnpm structurally cannot", () =>
		Effect.gen(function* () {
			// npm and bun record a workspace package's peer declarations; pnpm does
			// not record them at all, and `pnpm peers check` does not report them
			// either. So this row exists under npm and has no pnpm counterpart —
			// a capability difference, not a disagreement.
			const npm = PeerCheck.run(yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" }));
			const own = npm.required.find((r) => r.importer === "packages/lib" && r.dependency === "react");

			assert.isDefined(own);
			assert.strictEqual(own?.wanted, "^18.0.0");
			assert.strictEqual(own?.found, "17.0.2");
			assert.deepStrictEqual(own?.parents, []); // declared by the importer itself
		}),
	);

	it.effect("cannot answer for yarn, and says so rather than returning an empty pass", () =>
		Effect.gen(function* () {
			// yarn resolves peers virtually and records no peer edges, so a bare
			// empty array would be indistinguishable from a clean workspace.
			const lockfile = yield* Lockfile.parse(["__metadata:", "  version: 8", "  cacheKey: 10c0"].join("\n"), {
				format: "yarn",
			});
			const report = PeerCheck.run(lockfile);

			assert.isFalse(report.supported);
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.required, []);
		}),
	);
});

// pnpm's suppression policy, and the fail-closed states. pnpm computes the same
// violations we do and then hides the ones `peerDependencyRules.allowedVersions`
// permits, so a checker without the rules reports findings pnpm calls clean.
describe("PeerCheck.run — peerDependencyRules and the unverified states", () => {
	const rules = (allowedVersions: Record<string, string>) => ({
		allowedVersions,
		ignoreMissing: [],
		allowAny: [],
	});

	it.effect("omitting the option always reports peerRulesNotApplied", () =>
		Effect.gen(function* () {
			// "Nobody looked" — the report may contain rows pnpm would suppress.
			const report = PeerCheck.run(yield* parse("mixed"));
			assert.include(report.unverified, "peerRulesNotApplied");
		}),
	);

	it.effect("supplying empty rules asserts there are none, and is verified", () =>
		Effect.gen(function* () {
			// "I looked, and this workspace has none" — a different fact from the
			// test above, and it must produce a different result or a gate cannot
			// tell clean from unchecked.
			const report = PeerCheck.run(yield* parse("mixed"), { peerDependencyRules: NoPeerDependencyRules });
			assert.notInclude(report.unverified, "peerRulesNotApplied");
			// The rows themselves are unchanged; only the verification state moves.
			assert.strictEqual(report.required.length, PeerCheck.run(yield* parse("mixed")).required.length);
		}),
	);

	it.effect("rules with only allowedVersions populated stay verified", () =>
		Effect.gen(function* () {
			// The overwhelmingly common shape — real `allowedVersions`, both list
			// axes empty — is fully applied and verified.
			const report = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "react-dom>react": "17.0.2" }),
			});
			assert.notInclude(report.unverified, "peerRulesNotApplied");
		}),
	);

	it.effect("a rule suppresses the row pnpm suppresses", () =>
		Effect.gen(function* () {
			const before = PeerCheck.run(yield* parse("mixed"), { peerDependencyRules: NoPeerDependencyRules });
			assert.isDefined(before.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));

			const after = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "react-dom@18.3.1>react": "17.0.2" }),
			});
			assert.isUndefined(after.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));
		}),
	);

	it.effect("a rule whose PARENT VERSION is wrong still suppresses — pnpm ignores it", () =>
		Effect.gen(function* () {
			// The quirk, wrong in exactly one way: the key names react-dom@99.0.0
			// while the instance is 18.3.1. pnpm ignores the parent version, so
			// matching on it would suppress a strictly smaller set than pnpm does
			// and every row in the difference is a false positive.
			const report = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "react-dom@99.0.0>react": "17.0.2" }),
			});
			assert.isUndefined(report.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));
		}),
	);

	it.effect("an UNVERSIONED rule key suppresses too — the spelling a plugin injects", () =>
		Effect.gen(function* () {
			// The other path through the same rule: `pnpm:export` materializes
			// versioned keys into pnpm-workspace.yaml, a config-dependency plugin
			// injects unversioned ones. A matcher that only ever strips a version
			// passes the versioned test and fails this one.
			const report = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "react-dom>react": "17.0.2" }),
			});
			assert.isUndefined(report.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));
		}),
	);

	it.effect("a rule for a DIFFERENT parent leaves the row alone", () =>
		Effect.gen(function* () {
			// Wrong in exactly one way against the suppressing case: same peer, same
			// permitted version, different parent. Ignoring the parent version must
			// not become ignoring the parent.
			const report = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "something-else@1.0.0>react": "17.0.2" }),
			});
			assert.isDefined(report.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));
		}),
	);

	it.effect("a rule permitting a DIFFERENT version leaves the row alone", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("mixed"), {
				peerDependencyRules: rules({ "react-dom>react": "16.0.0" }),
			});
			assert.isDefined(report.required.find((r) => r.importer === "packages/unmet" && r.dependency === "react"));
		}),
	);

	it.effect("a BARE rule key suppresses too — pnpm applies it to every parent", () =>
		Effect.gen(function* () {
			// The third spelling. `pnpm-workspace.yaml` writes `parent@version>peer`,
			// a plugin injects `parent>peer`, and pnpm's own documented form is a
			// parentless `peer` that applies project-wide. Measured against pnpm
			// 11.22.0 on the fixture's own workspace: with `{ react: "17" }` and
			// nothing else, `pnpm peers check --json` reports it clean — the oracle
			// beside the lockfile IS that run. Skipping bare keys reports a row pnpm
			// suppresses while `rulesApplied` claims the policy was applied.
			const report = PeerCheck.run(yield* parse("barerule"), {
				peerDependencyRules: rules({ react: "17" }),
			});
			assert.isUndefined(report.required.find((r) => r.dependency === "react"));
			assert.deepStrictEqual(report.unverified, []);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("barerule"));
		}),
	);

	it.effect("a bare rule permitting a DIFFERENT version leaves the row alone", () =>
		Effect.gen(function* () {
			// Wrong in exactly one way against the test above: same bare key, same
			// lockfile, a range that does not cover the version that resolved. Its
			// oracle is a SECOND pnpm run over the same workspace with `react: "16"`,
			// and pnpm reports the row — so "bare keys suppress unconditionally"
			// fails here while passing above.
			const report = PeerCheck.run(yield* parse("barerule"), {
				peerDependencyRules: rules({ react: "16" }),
			});
			assert.isDefined(report.required.find((r) => r.dependency === "react"));
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("barerule", "peers-check-nonmatching.json"));
		}),
	);

	it.effect("a bare rule naming a DIFFERENT peer leaves the row alone", () =>
		Effect.gen(function* () {
			// Wrong in the other single way: a permitting range, but the key names a
			// peer this row is not about. Matching bare keys must not become
			// matching every bare key.
			const report = PeerCheck.run(yield* parse("barerule"), {
				peerDependencyRules: rules({ redux: "17" }),
			});
			assert.isDefined(report.required.find((r) => r.dependency === "react"));
		}),
	);

	it.effect("a rule key that names no parent at all suppresses nothing", () =>
		Effect.gen(function* () {
			// `">react"` is neither spelling: a separator with an empty parent. It
			// is malformed, and a malformed rule must not degrade into the bare-key
			// case, which would silently widen suppression past what pnpm does.
			const report = PeerCheck.run(yield* parse("barerule"), {
				peerDependencyRules: rules({ ">react": "17" }),
			});
			assert.isDefined(report.required.find((r) => r.dependency === "react"));
		}),
	);

	it.effect("declines a peer whose edge the model could not name", () =>
		Effect.gen(function* () {
			// react-redux's peer `react` is satisfied by `link:vendor/react-stub`,
			// a directory that is no importer. Reporting it unsatisfied is the false
			// positive; reporting nothing silently would be the other failure. This
			// test pins the declining half ONLY — the name deliberately stops there,
			// because a name that also claimed the `unverified` half would outlive
			// the test below and go on advertising coverage nothing checks.
			const report = PeerCheck.run(yield* parse("unnameable"), {
				peerDependencyRules: NoPeerDependencyRules,
			});
			assert.isUndefined(report.required.find((r) => r.dependency === "react"));
			// pnpm's own verdict on the workspace that produced this lockfile: clean.
			// Declining is therefore agreement, not a gap — the `unverified` marker
			// the next test pins is what keeps the agreement honest.
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("unnameable"));
		}),
	);

	it.effect("and says the report is unverified rather than declining silently", () =>
		Effect.gen(function* () {
			// The other half of the same behaviour, as its OWN test: declining the
			// row without saying why would turn a false positive into a false
			// negative. Two rules, two assertions — a single test asserting both
			// would go red for either, pinning neither.
			const report = PeerCheck.run(yield* parse("unnameable"), {
				peerDependencyRules: NoPeerDependencyRules,
			});
			assert.include(report.unverified, "unresolvedEdge");
		}),
	);

	it.effect("fails closed on a link:-resolved parent whose peers the lockfile never records", () =>
		Effect.gen(function* () {
			// effected#800, the probe fixture from the issue: packages/b depends on
			// probe-a via workspace:*, which pnpm records as `version: link:../a`,
			// and probe-a declares a `react` peer nothing satisfies. `pnpm peers
			// check` reads the LINKED MANIFEST on disk and reports the row — the
			// committed oracle carries it. This model sees only a workspace row
			// whose peers are empty by design, so it declines to fabricate the row
			// and fails the report closed instead of presenting the silence as a
			// clean, verified bill of health.
			const report = PeerCheck.run(yield* parse("linkdeep"), {
				peerDependencyRules: NoPeerDependencyRules,
			});
			assert.isTrue(report.supported);
			// No fabricated finding: the linked parent's peer declarations are
			// invisible in the lockfile, and a guessed row would be a false answer.
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unresolvedImporters, []);
			// Fail closed: the marker is the whole fix. Rules were supplied, so
			// peerRulesNotApplied must NOT ride along.
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
			// And the divergence is KNOWN, not missed: pnpm does report the row,
			// committed verbatim beside the lockfile. If the join-from-disk route
			// (the issue's option 1) ever lands, these assertions are what turn
			// the oracle into a full agreement test.
			const oracle = theirs("linkdeep");
			assert.strictEqual(oracle.length, 1);
			assert.strictEqual(oracle[0]?.importer, "packages/b");
			assert.strictEqual(oracle[0]?.dependency, "react");
			assert.strictEqual(oracle[0]?.wanted, "^18.0.0");
			assert.strictEqual(oracle[0]?.found, null);
			assert.deepStrictEqual(oracle[0]?.parents, ["probe-a@1.0.0"]);
		}),
	);

	it.effect("a link: edge fails the report closed even when the rules are absent from the picture", () =>
		Effect.gen(function* () {
			// Omitting the rules yields peerRulesNotApplied on every lockfile; the
			// link: marker must STILL be there too, or a gate that supplies rules
			// later would read the same tree as verified. Both reasons, one report.
			const report = PeerCheck.run(yield* parse("linkdeep"));
			assert.include(report.unverified, "peerRulesNotApplied");
			assert.include(report.unverified, "unresolvedEdge");
		}),
	);

	// The join (effected#800's option 1): the caller supplies the discovered
	// manifests, and a `link:`-resolved parent's peers are read from the one
	// place they exist. Every oracle below is a real `pnpm peers check --json`
	// run over the probe workspace, committed verbatim beside its lockfile.
	it.effect("joins a supplied linked parent's manifest peers, clearing the marker it replaced", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});

			// Agreement, row for row, with the verdict pnpm read off the linked
			// manifest on disk — and the fail-closed marker gone, which is the
			// half that says the join happened rather than the row merely
			// agreeing by silence.
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("fails closed for a link: target the supplied set does not cover", () =>
		Effect.gen(function* () {
			// A set that covers a DIFFERENT directory says nothing about this
			// edge: the target's manifest is still invisible, so the report
			// keeps saying so. Supplying the key is the assertion — its
			// CONTENTS are what decides which edges it answers for.
			const report = PeerCheck.run(yield* parse("linkdeep"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ relativePath: "packages/elsewhere" })],
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
		}),
	);

	it.effect("judges a joined parent's peers against the importer's OWN dependency set", () =>
		Effect.gen(function* () {
			// Measured one variable at a time against pnpm 12.5.1 and 12.6.0,
			// because the obvious rule — look the peer name up among the
			// workspace's instances — is wrong in both directions:
			//
			// - `linkdeep-provided/`: react@18.3.1 as the CONSUMER's own
			//   dependency satisfies the linked parent's `^18.0.0` peer. pnpm
			//   reports the importer clean, and so must we.
			const provided = PeerCheck.run(yield* parse("linkdeep-provided"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.deepStrictEqual(ours(provided.unsatisfied), theirs("linkdeep-provided"));
			assert.deepStrictEqual(provided.unverified, []);

			// - `linkdeep-sibling/`: the SAME version installed only by a
			//   sibling importer does not. pnpm reports the peer missing, so a
			//   workspace-wide name lookup would have manufactured a clean
			//   report here — the false-negative shape this check exists to
			//   avoid.
			const sibling = PeerCheck.run(yield* parse("linkdeep-sibling"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.deepStrictEqual(ours(sibling.unsatisfied), theirs("linkdeep-sibling"));
			assert.deepStrictEqual(sibling.unverified, []);

			// - `linkdeep-bad/`: the consumer's own react@17.0.2 is outside the
			//   range, which is a `bad` row carrying the version that resolved.
			const bad = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.deepStrictEqual(ours(bad.unsatisfied), theirs("linkdeep-bad"));
			assert.deepStrictEqual(bad.unverified, []);
		}),
	);

	it.effect("clears the marker for a supplied target without inventing rows from it", () =>
		Effect.gen(function* () {
			// `workspacepeer/`'s satisfying edge is a `link:` into
			// `packages/fakereact`, which declares no peers of its own. Supply
			// it and the report becomes verified — pnpm calls this workspace
			// clean, and now so do we, for a reason (the manifest was read)
			// rather than by declining to look.
			const report = PeerCheck.run(yield* parse("workspacepeer"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [
					probeA({ name: "react", version: "18.3.1", relativePath: "packages/fakereact", peerDependencies: {} }),
				],
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("workspacepeer"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	// The ROOT importer has no workspace row under pnpm, so the shared join
	// composes `probe-a@link:packages/a`, matches nothing, and never reaches
	// the linked target. Before the walk learned to seed it, a covered target
	// there cleared the marker WITHOUT being judged — `unverified: []` and no
	// rows, while pnpm reported the peer. Both oracles are pnpm 12.6.0 over a
	// root depending on `probe-a: workspace:*` (README, `linkdeep-root/`).
	it.effect("walks a ROOT importer's covered link: target and agrees with pnpm", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-root"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.strictEqual(theirs("linkdeep-root").length, 1);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-root"));
			assert.deepStrictEqual(report.unresolvedImporters, []);
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("judges a ROOT importer's linked peer against the root's own dependency set", () =>
		Effect.gen(function* () {
			// The root's own react@17.0.2 is the provider pnpm judges against, so
			// the row is `bad` with that version rather than `missing`.
			const report = PeerCheck.run(yield* parse("linkdeep-root-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-root-bad"));
			assert.strictEqual(report.unsatisfied[0]?.found, "17.0.2");
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("keeps the marker for a ROOT importer's link: target the supplied set does not cover", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-root"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ relativePath: "packages/elsewhere" })],
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
		}),
	);

	it.effect("keeps the marker for a covered link: target with no lockfile row to walk", () =>
		Effect.gen(function* () {
			// A supplied manifest whose directory the lockfile records no importer
			// for cannot be walked, so its peers were never judged: covering the
			// path is not the same as judging it.
			const lockfile = yield* Lockfile.parse(
				[
					"lockfileVersion: '9.0'",
					"",
					"importers:",
					"",
					"  .:",
					"    dependencies:",
					"      probe-a:",
					"        specifier: link:vendor/a",
					"        version: link:vendor/a",
					"",
				].join("\n"),
				{ format: "pnpm" },
			);
			const report = PeerCheck.run(lockfile, {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ relativePath: "vendor/a" })],
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.include(report.unverified, "unresolvedEdge");
		}),
	);

	// `publishConfig.directory` moves the link: pnpm records a workspace
	// dependency as `link:../a/dist`, INTO the publish directory, unless
	// `linkDirectory: false` (pnpm 12.6.0: `linkdeep-directory/` sets no
	// `linkDirectory` and still links into `dist`; `linkdeep-directory-false/`
	// links the package root). Every savvy-web monorepo links this way.
	it.effect("covers a link: into a publish directory, and agrees with pnpm", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-directory"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist" }) })],
			});
			assert.strictEqual(theirs("linkdeep-directory").length, 1);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("normalizes the publish directory spelling, and honours an explicit linkDirectory: true", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-directory"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [
					probeA({ publishConfig: PublishConfig.make({ directory: "./dist/", linkDirectory: true }) }),
				],
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("keeps the marker for a publish-directory link: when the manifests are omitted", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-directory"), {
				peerDependencyRules: NoPeerDependencyRules,
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
		}),
	);

	it.effect("does not cover a publish-directory link: for a manifest that says linkDirectory: false", () =>
		Effect.gen(function* () {
			// The manifest disagrees with the lockfile about where the link
			// lands, so the supplied manifest does not describe this edge.
			const report = PeerCheck.run(yield* parse("linkdeep-directory"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist", linkDirectory: false }) })],
			});
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
		}),
	);

	it.effect("with linkDirectory: false, pnpm links the package root and the root spelling is covered", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-directory-false"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist", linkDirectory: false }) })],
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory-false"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	// Attribution stops at a linked workspace package. Measured against pnpm
	// 12.6.0 on a chain `b` links `a`, `a` links `c`, `c` peers on react:
	// pnpm judges `c`'s manifest peers for its DIRECT consumer `a` only, and
	// reports nothing through `b` — whoever provides react. The same holds for
	// a linked package's REGISTRY dependencies: `linkchain-registry/`'s
	// react-dom peer is reported on `c`'s own importer, never on `b`.
	const chainA = (peerDependencies: Record<string, string> = {}): WorkspacePackage => probeA({ peerDependencies });
	const chainC = (): WorkspacePackage => probeA({ name: "probe-c", relativePath: "packages/c" });
	const chainPackages = (): ReadonlyArray<WorkspacePackage> => [chainA(), chainC()];

	it.effect("judges a linked package's peers for its DIRECT consumer only (consumer's parent provides)", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkchain-parent-provides"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: chainPackages(),
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkchain-parent-provides"));
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("never surfaces a transitively linked package's peers on the outer consumer", () =>
		Effect.gen(function* () {
			// Only `b` has react: pnpm still reports the peer on `a`, whose own
			// dependencies lack it, and calls `b` clean.
			const provided = PeerCheck.run(yield* parse("linkchain-importer-provides"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: chainPackages(),
			});
			assert.strictEqual(theirs("linkchain-importer-provides").length, 1);
			assert.deepStrictEqual(ours(provided.unsatisfied), theirs("linkchain-importer-provides"));
			assert.deepStrictEqual(provided.unverified, []);

			// Nobody has react: still one row, on `a`, not a second one on `b`.
			const none = PeerCheck.run(yield* parse("linkchain-none"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: chainPackages(),
			});
			assert.deepStrictEqual(ours(none.unsatisfied), theirs("linkchain-none"));
			assert.deepStrictEqual(none.unverified, []);
		}),
	);

	it.effect("attributes a linked package's registry dependency peers to its own importer only", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkchain-registry"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ name: "probe-c", relativePath: "packages/c", peerDependencies: {} })],
			});
			assert.strictEqual(theirs("linkchain-registry").length, 1);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkchain-registry"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("a deeper link edge is judged by its own consumer's walk: uncovered, it keeps the marker", () =>
		Effect.gen(function* () {
			// `a` links `c`; supplying only `a` leaves that edge unjudged even
			// though `b`'s edge to `a` is covered — the outer walk no longer
			// reaches `c`, so nothing else can clear it.
			const onlyA = PeerCheck.run(yield* parse("linkchain-none"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [chainA()],
			});
			assert.deepStrictEqual(onlyA.unverified, ["unresolvedEdge"]);
			// And supplying only `c` leaves `b`'s edge to `a` unjudged, while `a`'s
			// own walk still reports `c`'s peer.
			const onlyC = PeerCheck.run(yield* parse("linkchain-none"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [chainC()],
			});
			assert.deepStrictEqual(ours(onlyC.unsatisfied), theirs("linkchain-none"));
			assert.deepStrictEqual(onlyC.unverified, ["unresolvedEdge"]);
		}),
	);

	// A joined manifest's peer range may be a protocol specifier rather than a
	// range — `catalog:peers` here, `catalog:build:peers` in the workspace that
	// reported effected#800. pnpm resolves it through the workspace's catalogs
	// and reports the RESOLVED range as `wantedRange`; so do we, when the
	// caller supplies the catalogs. Anything still unresolvable fails closed.
	const catalogPeer = probeA({ peerDependencies: { react: "catalog:peers" } });
	const peersCatalog = CatalogSet.make({ entries: { peers: { react: "^18.0.0" } } });

	it.effect("resolves a catalog peer range that the provider satisfies", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-provided"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
				catalogs: peersCatalog,
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-provided"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("resolves the DEFAULT catalog for a bare `catalog:` peer range", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ peerDependencies: { react: "catalog:" } })],
				catalogs: CatalogSet.make({ entries: { default: { react: "^18.0.0" } } }),
			});
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-bad"));
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("reports a catalog peer range the provider misses, with the RESOLVED range as wanted", () =>
		Effect.gen(function* () {
			// `linkdeep-bad/`: react@17.0.2 against the catalog's `^18.0.0` — the
			// oracle's `bad` row, `wantedRange` included, agrees row for row.
			const bad = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
				catalogs: peersCatalog,
			});
			assert.deepStrictEqual(ours(bad.unsatisfied), theirs("linkdeep-bad"));
			assert.strictEqual(bad.unsatisfied[0]?.wanted, "^18.0.0");
			assert.deepStrictEqual(bad.unverified, []);

			// With no provider at all the row needs no range arithmetic, but its
			// `wanted` is still the resolved range, as pnpm's is.
			const missing = PeerCheck.run(yield* parse("linkdeep"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
				catalogs: peersCatalog,
			});
			assert.deepStrictEqual(ours(missing.unsatisfied), theirs("linkdeep"));
			assert.deepStrictEqual(missing.unverified, []);
		}),
	);

	it.effect("fails closed on a catalog peer range the supplied catalogs do not name", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
				catalogs: CatalogSet.make({ entries: { build: { react: "^18.0.0" } } }),
			});
			// Never judged, so neither a row nor a clean report.
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);
		}),
	);

	it.effect("fails closed on a catalog peer range when the catalogs key is omitted", () =>
		Effect.gen(function* () {
			// Presence is the assertion: with no catalogs supplied, nothing was
			// looked up, so a provider present cannot be judged against the peer.
			const report = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);

			// A MISSING provider is still a fact about the graph, reportable
			// without the range: the row stands, echoing the raw specifier, and
			// the report is not marked because that peer WAS judged.
			const missing = PeerCheck.run(yield* parse("linkdeep"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
			});
			assert.strictEqual(missing.unsatisfied.length, 1);
			assert.strictEqual(missing.unsatisfied[0]?.wanted, "catalog:peers");
			assert.strictEqual(missing.unsatisfied[0]?.found, null);
			assert.deepStrictEqual(missing.unverified, []);
		}),
	);

	it.effect("fails closed on a non-catalog protocol peer range such as `workspace:*`", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ peerDependencies: { react: "workspace:*" } })],
				catalogs: peersCatalog,
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);
		}),
	);

	it.effect("fails closed when a catalog entry itself resolves to a protocol specifier", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [catalogPeer],
				catalogs: CatalogSet.make({ entries: { peers: { react: "workspace:^" } } }),
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);
		}),
	);

	it.effect("accepts a peer satisfied by a WORKSPACE package without version-comparing it", () =>
		Effect.gen(function* () {
			// react-redux wants react `^18.0 || ^19` and pnpm resolved it to the
			// workspace package `packages/fakereact` — which pnpm calls clean.
			//
			// A workspace row carries the placeholder version "0.0.0", because pnpm
			// records no version for an importer. Comparing against it would report
			// `found: "0.0.0"` against a real range — a false answer dressed as a
			// finding. An edge exists and a provider exists, so nothing indicates
			// dissatisfaction; the check declines rather than inventing a verdict.
			//
			// The report is NOT verified, though (effected#800): the satisfying edge
			// is a `link:`, and a linked package's own manifest peers are invisible
			// to this model while `pnpm peers check` reads them from disk. Declining
			// the false row and failing closed on completeness are the two halves of
			// the honest answer, and this test pins both.
			const report = PeerCheck.run(yield* parse("workspacepeer"), {
				peerDependencyRules: NoPeerDependencyRules,
			});

			assert.isUndefined(report.required.find((r) => r.dependency === "react"));
			assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
			// pnpm calls this workspace clean, and we emit no row either. Agreement
			// on the rows is agreement by silence — that both sides emit nothing —
			// which is why the `unverified` assertion above sits next to it: the
			// interesting claim is that we are silent for a reason, not merely
			// silent.
			assert.deepStrictEqual(ours(report.unsatisfied), theirs("workspacepeer"));
			// The edge really does point at a workspace row at the placeholder
			// version — without that, the assertion above could pass for the wrong
			// reason.
			const lockfile = yield* parse("workspacepeer");
			const stub = lockfile.packagesNamed("packages/fakereact")[0];
			assert.isTrue(stub?.isWorkspace);
			assert.strictEqual(stub?.version, "0.0.0");
		}),
	);

	it.effect("npm and bun need no rules input to be fully answerable", () =>
		Effect.gen(function* () {
			// `peerDependencyRules` is pnpm-only; npm and bun have no equivalent
			// suppression, so their computation is already complete. Supplying empty
			// rules must leave them verified.
			const npm = PeerCheck.run(yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" }), {
				peerDependencyRules: NoPeerDependencyRules,
			});
			assert.deepStrictEqual(npm.unverified, []);
		}),
	);
});

// The two list axes, `ignoreMissing` and `allowAny`, measured against pnpm
// 12.5.1 (effected#430). Every oracle file under `allowany/` and
// `ignoremissing/` is one `pnpm peers check --json` run over the SAME lockfile
// under a different rule configuration, so the rule is the variable and the
// committed verdict is the decision. Provenance in `fixtures/peers/README.md`.
describe("PeerCheck.run — ignoreMissing and allowAny", () => {
	const withAllowAny = (allowAny: ReadonlyArray<string>) => ({
		peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny },
	});
	const withIgnoreMissing = (ignoreMissing: ReadonlyArray<string>) => ({
		peerDependencyRules: { allowedVersions: {}, ignoreMissing, allowAny: [] },
	});

	/** Runs the fixture under one rule configuration and pins it to its oracle file. */
	const agrees = (dir: string, options: Parameters<typeof PeerCheck.run>[1], file: string) =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse(dir), options);
			assert.isTrue(report.supported);
			// Supplied rules with these axes populated are FULLY applied, so the
			// report is verified. This is the claim the whole block earns.
			assert.deepStrictEqual(report.unverified, []);
			assert.deepStrictEqual(ours(report.unsatisfied), theirs(dir, file));
		});

	// allowany/: a bad required `react` (packages/unmet) and a bad optional
	// `redux` (packages/optional).
	it.effect("allowany control: with no rules both bad rows fire", () =>
		agrees("allowany", { peerDependencyRules: NoPeerDependencyRules }, "peers-check.json"),
	);
	it.effect("allowAny by bare name clears the bad required react and leaves redux", () =>
		agrees("allowany", withAllowAny(["react"]), "peers-check-bare-react.json"),
	);
	it.effect("allowAny by bare name clears the bad OPTIONAL redux and leaves react", () =>
		agrees("allowany", withAllowAny(["redux"]), "peers-check-bare-redux.json"),
	);
	it.effect("allowAny glob `re*` clears both bad rows", () =>
		agrees("allowany", withAllowAny(["re*"]), "peers-check-glob.json"),
	);
	it.effect("allowAny `*` then `!redux` clears react and keeps redux", () =>
		agrees("allowany", withAllowAny(["*", "!redux"]), "peers-check-star-negation.json"),
	);
	it.effect("allowAny with a parent>peer key suppresses nothing — the grammar has no parent", () =>
		agrees("allowany", withAllowAny(["react-dom>react"]), "peers-check-parent-key.json"),
	);
	it.effect("allowAny `!redux` then `*`: the later `*` re-includes redux, so both rows clear", () =>
		agrees("allowany", withAllowAny(["!redux", "*"]), "peers-check-negation-then-star.json"),
	);
	it.effect("allowAny with a lone `!` (negating the empty name) matches every peer and clears both rows", () =>
		agrees("allowany", withAllowAny(["!"]), "peers-check-lone-negation.json"),
	);
	it.effect("ignoreMissing never rescues a row where something resolved at the wrong version", () =>
		agrees("allowany", withIgnoreMissing(["react", "redux"]), "peers-check-ignoremissing-react-redux.json"),
	);

	// ignoremissing/: three missing `react` rows for packages/lone, one of them
	// transitive (react-redux > use-sync-external-store).
	it.effect("ignoremissing control: with no rules all three missing rows fire", () =>
		agrees("ignoremissing", { peerDependencyRules: NoPeerDependencyRules }, "peers-check.json"),
	);
	it.effect("ignoreMissing by bare name clears every missing react, the transitive one included", () =>
		agrees("ignoremissing", withIgnoreMissing(["react"]), "peers-check-bare.json"),
	);
	it.effect("ignoreMissing glob `rea*` clears every missing react", () =>
		agrees("ignoremissing", withIgnoreMissing(["rea*"]), "peers-check-glob.json"),
	);
	it.effect("ignoreMissing `*` then `!react` keeps every missing react", () =>
		agrees("ignoremissing", withIgnoreMissing(["*", "!react"]), "peers-check-star-negation.json"),
	);
	it.effect("ignoreMissing holding ONLY a negation clears everything not excluded", () =>
		agrees("ignoremissing", withIgnoreMissing(["!redux"]), "peers-check-negation-only.json"),
	);
	it.effect("ignoreMissing with a parent>peer key suppresses nothing", () =>
		agrees("ignoremissing", withIgnoreMissing(["react-dom>react"]), "peers-check-parent-key.json"),
	);
	it.effect("ignoreMissing with a parent@version>peer key suppresses nothing either", () =>
		agrees("ignoremissing", withIgnoreMissing(["react-dom@18.3.1>react"]), "peers-check-parent-versioned-key.json"),
	);
	it.effect("allowAny never rescues a missing peer", () =>
		agrees("ignoremissing", withAllowAny(["react"]), "peers-check-allowany-react.json"),
	);

	// Mutation discriminators, stated directly. The oracle comparisons above
	// would also pass for an implementation that suppressed on the wrong axis
	// only if pnpm did too — which the cross-axis files rule out — but these
	// name each single-mutation failure so it fails one test, not a batch.
	it.effect("a pattern that matches no peer name leaves every row in place", () =>
		Effect.gen(function* () {
			const before = PeerCheck.run(yield* parse("allowany"), { peerDependencyRules: NoPeerDependencyRules });
			const after = PeerCheck.run(yield* parse("allowany"), withAllowAny(["reactx", "!*"]));
			assert.strictEqual(after.unsatisfied.length, before.unsatisfied.length);
			assert.isTrue(before.unsatisfied.length > 0);
			const missing = PeerCheck.run(yield* parse("ignoremissing"), withIgnoreMissing(["redux"]));
			assert.strictEqual(missing.unsatisfied.length, 3);
		}),
	);

	it.effect("the axes do not cross, stated on the row rather than the oracle", () =>
		Effect.gen(function* () {
			// `ignoreMissing` reads only rows with `found === null`; `allowAny` reads
			// only rows with a version. Swapping the two predicates inside
			// `suppressedByRule` passes every single-axis oracle test whose other
			// axis is empty; this is what turns red.
			const bad = PeerCheck.run(yield* parse("allowany"), withIgnoreMissing(["*"]));
			assert.strictEqual(bad.unsatisfied.length, 2);
			assert.isTrue(bad.unsatisfied.every((r) => r.found !== null));
			const missing = PeerCheck.run(yield* parse("ignoremissing"), withAllowAny(["*"]));
			assert.strictEqual(missing.unsatisfied.length, 3);
			assert.isTrue(missing.unsatisfied.every((r) => r.found === null));
		}),
	);

	it.effect("both axes populated at once compose: each hides only its own kind of row", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("allowany"), {
				peerDependencyRules: { allowedVersions: {}, ignoreMissing: ["*"], allowAny: ["redux"] },
			});
			assert.deepStrictEqual(report.unverified, []);
			assert.deepStrictEqual(
				report.unsatisfied.map((r) => r.dependency),
				["react"],
			);
		}),
	);

	it.effect("omitting the key still reports peerRulesNotApplied, whatever the lockfile", () =>
		Effect.gen(function* () {
			// Applying the list axes must not have loosened the presence rule.
			const report = PeerCheck.run(yield* parse("allowany"));
			assert.deepStrictEqual(report.unverified, ["peerRulesNotApplied"]);
			assert.strictEqual(report.unsatisfied.length, 2);
		}),
	);
});

// The pattern grammar, tested on the helper directly: the fixtures carry only
// `react`/`redux`-shaped names, so the scoped-name and order-sensitivity
// cases have no oracle row to fire on and are pinned here against the
// `@pnpm/matcher@1000.1.0` source they restate.
describe("peerNameMatcher — @pnpm/matcher semantics", () => {
	it("an empty list matches nothing", () => {
		assert.isFalse(peerNameMatcher([])("react"));
	});

	it("a lone `*` matches everything", () => {
		const m = peerNameMatcher(["*"]);
		assert.isTrue(m("react"));
		assert.isTrue(m("@types/react"));
		assert.isTrue(m(""));
	});

	it("a pattern without `*` is plain equality, not a prefix", () => {
		const m = peerNameMatcher(["react"]);
		assert.isTrue(m("react"));
		assert.isFalse(m("react-dom"));
		assert.isFalse(m("preact"));
	});

	it("`re*` is an anchored wildcard", () => {
		const m = peerNameMatcher(["re*"]);
		assert.isTrue(m("react"));
		assert.isTrue(m("redux"));
		assert.isTrue(m("re"));
		assert.isFalse(m("preact"));
		assert.isFalse(m("@re/x"));
	});

	it("a scoped pattern keeps regex-special characters literal", () => {
		const m = peerNameMatcher(["@types/*"]);
		assert.isTrue(m("@types/react"));
		assert.isTrue(m("@types/node"));
		assert.isFalse(m("@typesXreact"));
		assert.isFalse(m("types/react"));
		// `.` in a name must not become "any character".
		assert.isFalse(peerNameMatcher(["lodash.*"])("lodashXmerge"));
		assert.isTrue(peerNameMatcher(["lodash.*"])("lodash.merge"));
		assert.isTrue(peerNameMatcher(["@types/react"])("@types/react"));
	});

	it("a single negation matches everything except", () => {
		const m = peerNameMatcher(["!redux"]);
		assert.isTrue(m("react"));
		assert.isFalse(m("redux"));
	});

	it("a list of only negations matches everything none of them excludes", () => {
		const m = peerNameMatcher(["!redux", "!re*"]);
		assert.isTrue(m("zustand"));
		assert.isFalse(m("redux"));
		assert.isFalse(m("react"));
	});

	it("a list of only includes matches when any does", () => {
		const m = peerNameMatcher(["react", "redux"]);
		assert.isTrue(m("react"));
		assert.isTrue(m("redux"));
		assert.isFalse(m("zustand"));
	});

	it("a mixed list is walked in order: a later negation resets an earlier include", () => {
		assert.isFalse(peerNameMatcher(["*", "!redux"])("redux"));
		assert.isTrue(peerNameMatcher(["*", "!redux"])("react"));
		// The other order: the negation runs first, then `*` includes redux again
		// (oracle: allowany/peers-check-negation-then-star.json).
		assert.isTrue(peerNameMatcher(["!redux", "*"])("redux"));
	});

	it("a lone `!` negates the empty name, which nothing has, so it matches everything", () => {
		// Oracle: allowany/peers-check-lone-negation.json clears both bad rows.
		const m = peerNameMatcher(["!"]);
		assert.isTrue(m("react"));
		assert.isTrue(m("redux"));
	});
});

// A peer whose PROVIDER resolved through a protocol rather than to a version.
// The four `filedep*` oracles are pnpm 12.6.0 over purpose-built workspaces
// (README, `filedep*`): a `file:` dependency, directly or through a `file:`
// override, and for a `file:` directory the lockfile records no version at
// all. `@effected/lockfiles` passes the specifier through as the provider's
// version, which semver cannot parse — and skipping it as "unparseable" is
// what once reported these workspaces proven clean while pnpm called them bad.
describe("PeerCheck.run — protocol-specifier provider versions", () => {
	/** The provider `react` instance in a `filedep*` lockfile. */
	const reactProvider = (lockfile: Lockfile) => lockfile.packagesNamed("react")[0];

	it.effect("fails closed on a registry parent's peer provided by a `file:` directory", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse("filedep");
			// Precondition: the provider really is a protocol-specifier version,
			// or the assertions below could pass for the wrong reason.
			assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react");
			assert.isFalse(reactProvider(lockfile)?.isWorkspace);

			const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			// No fabricated row: the comparison never ran, so "unsatisfied" would
			// be as false as "satisfied".
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);

			// And the divergence is KNOWN: pnpm reports a bad row carrying the
			// specifier as its found version — although the directory's manifest
			// says 18.3.1, which satisfies `^18.3.1`.
			const oracle = theirs("filedep");
			assert.strictEqual(oracle.length, 1);
			assert.strictEqual(oracle[0]?.importer, "packages/host");
			assert.strictEqual(oracle[0]?.dependency, "react");
			assert.strictEqual(oracle[0]?.found, "file:vendor/react");
		}),
	);

	it.effect("fails closed on a `file:` provider whose own peers give it a suffixed key", () =>
		Effect.gen(function* () {
			// The real-tree shape: the linked package declares peers, so pnpm keys
			// it `react@file:vendor/react(js-tokens@4.0.0)`. The model must split
			// that suffix like a registry one — pnpm's own found version is
			// `file:vendor/react`, suffix-free — or the provider reads as a garbled
			// non-protocol version and is skipped as merely unparseable.
			const lockfile = yield* parse("filedep-suffixed");
			const provider = lockfile.packages.find((p) => p.instanceId === "react@file:vendor/react(js-tokens@4.0.0)");
			assert.strictEqual(provider?.name, "react");
			assert.strictEqual(provider?.version, "file:vendor/react");
			assert.strictEqual(theirs("filedep-suffixed")[0]?.found, provider?.version);

			const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
		}),
	);

	it.effect("fails closed on a peer provided through a `file:` override", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse("filedep-override");
			assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react");
			const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
			assert.strictEqual(theirs("filedep-override")[0]?.found, "file:vendor/react");
		}),
	);

	it.effect("fails closed on a `file:` tarball, which pnpm itself judges two ways", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse("filedep-tarball");
			assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react-18.3.1.tgz");
			const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
			// Same lockfile, two verdicts: pnpm 12.6.0 reports the specifier as the
			// found version, 12.7.0 reads the tarball's real 18.3.1 and calls it
			// clean. Declining with a marker is the answer consistent with both.
			assert.strictEqual(theirs("filedep-tarball")[0]?.found, "file:vendor/react-18.3.1.tgz");
			assert.deepStrictEqual(theirs("filedep-tarball", "peers-check-pnpm-12.7.0.json"), []);
		}),
	);

	it.effect("fails closed on a joined link: manifest's peer provided by a `file:` directory", () =>
		Effect.gen(function* () {
			const lockfile = yield* parse("filedep-joined");
			assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react");
			const report = PeerCheck.run(lockfile, {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			// pnpm reads the directory's real version off disk for a joined parent
			// and reports 17.0.2 bad. The lockfile does not carry it, so the row
			// is declined — and the report says so, instead of passing a peer pnpm
			// rejects.
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
			const oracle = theirs("filedep-joined");
			assert.strictEqual(oracle.length, 1);
			assert.strictEqual(oracle[0]?.found, "17.0.2");
			assert.deepStrictEqual(oracle[0]?.parents, ["probe-a@1.0.0"]);

			// Control: without the join the manifest peer is never judged, so only
			// the link: marker applies. The version reason comes from the
			// judgement, not from the file: instance merely being in the lockfile.
			const unjoined = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(unjoined.unverified, ["unresolvedEdge"]);
		}),
	);

	it.effect("gives the one answer consistent with pnpm 11 and pnpm 12, which disagree", () =>
		Effect.gen(function* () {
			// pnpm 11.28.0 writes byte-identical lockfiles for every `filedep*`
			// workspace but judges them leniently: it reports each `file:`
			// directory provider clean — even the joined case whose directory is
			// 17.0.2 against `^18.0.0` — where pnpm 12 reports a bad row. With the
			// lockfile unable to tell the two apart, neither "clean" nor a row is
			// provable, so the report is the same for every fixture: no row, and
			// the marker.
			for (const dir of ["filedep", "filedep-override", "filedep-tarball", "filedep-joined", "filedep-suffixed"]) {
				assert.deepStrictEqual(theirs(dir, "peers-check-pnpm-11.json"), [], dir);
				assert.isAbove(theirs(dir).length, 0, dir);
				const report = PeerCheck.run(yield* parse(dir), {
					peerDependencyRules: NoPeerDependencyRules,
					workspacePackages: [probeA()],
				});
				assert.deepStrictEqual(report.unsatisfied, [], dir);
				assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"], dir);
			}
		}),
	);

	it.effect("raises both reasons when neither the joined range nor the provider version can be named", () =>
		Effect.gen(function* () {
			const report = PeerCheck.run(yield* parse("filedep-joined"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA({ peerDependencies: { react: "workspace:*" } })],
			});
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved", "peerVersionUnresolved"]);
		}),
	);

	it.effect("still skips a plain unparseable, non-protocol provider version", () =>
		Effect.gen(function* () {
			// The existing decision, unchanged: junk that is NOT a protocol
			// specifier is skipped without a marker.
			const text = fixture("peers/filedep/pnpm-lock.yaml").replaceAll("file:vendor/react", "not-a-version");
			const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
			assert.strictEqual(reactProvider(lockfile)?.version, "not-a-version");
			const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(report.unsatisfied, []);
			assert.deepStrictEqual(report.unverified, []);
		}),
	);

	it.effect("still accepts a workspace-row provider and still judges a semver provider", () =>
		Effect.gen(function* () {
			// A workspace row (placeholder 0.0.0) stays accepted on name alone.
			const workspace = PeerCheck.run(yield* parse("workspacepeer"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [
					probeA({ name: "react", version: "18.3.1", relativePath: "packages/fakereact", peerDependencies: {} }),
				],
			});
			assert.deepStrictEqual(workspace.unsatisfied, []);
			assert.deepStrictEqual(workspace.unverified, []);

			// A semver provider is compared as before, on both the lockfile-row
			// path (`mixed/`) and the joined path (`linkdeep-bad/`).
			const rows = PeerCheck.run(yield* parse("mixed"), { peerDependencyRules: NoPeerDependencyRules });
			assert.deepStrictEqual(ours(rows.unsatisfied), theirs("mixed"));
			assert.deepStrictEqual(rows.unverified, []);
			const joined = PeerCheck.run(yield* parse("linkdeep-bad"), {
				peerDependencyRules: NoPeerDependencyRules,
				workspacePackages: [probeA()],
			});
			assert.deepStrictEqual(ours(joined.unsatisfied), theirs("linkdeep-bad"));
			assert.deepStrictEqual(joined.unverified, []);
		}),
	);
});
