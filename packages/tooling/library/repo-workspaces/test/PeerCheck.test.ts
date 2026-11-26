import { Lockfile } from "@beep/lockfiles";
import { NoPeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { peerNameMatcher } from "@beep/repo-workspaces/internal/peerPatterns";
import { PeerCheck } from "@beep/repo-workspaces/PeerCheck";
import { CatalogSet } from "@beep/repo-workspaces/WorkspaceCatalogs";
import { PublishConfig, WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixture } from "./support/fixtureText.ts";
import type { PeerCheckOptions, UnsatisfiedPeer } from "@beep/repo-workspaces/PeerCheck";

const UnknownJson = S.fromJsonString(S.Unknown);

const parse = (dir: string) => Lockfile.parse(fixture(`peers/${dir}/pnpm-lock.yaml`), { format: "pnpm" });

const probeA = (
  overrides: {
    readonly name?: string;
    readonly version?: string;
    readonly relativePath?: string;
    readonly peerDependencies?: Record<string, string>;
    readonly publishConfig?: PublishConfig;
  } = {}
): WorkspacePackage =>
  WorkspacePackage.make({
    name: "probe-a",
    version: "1.0.0",
    path: "C:/ws/packages/a",
    packageJsonPath: "C:/ws/packages/a/package.json",
    relativePath: "packages/a",
    workspaceRoot: "C:/ws",
    peerDependencies: { react: "^18.0.0" },
    ...overrides,
  });

interface Row {
  readonly dependency: string;
  readonly found: string | null;
  readonly importer: string;
  readonly optional: boolean;
  readonly parents: ReadonlyArray<string>;
  readonly wanted: string;
}

const order = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  [...rows].sort((a, b) =>
    Str.localeCompare(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(b), identity))(
      Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(a), identity)
    )
  );

const ours = (rows: ReadonlyArray<UnsatisfiedPeer>): ReadonlyArray<Row> =>
  order(
    A.map(rows, (row) => ({
      importer: row.importer,
      dependency: row.dependency,
      wanted: row.wanted,
      found: row.found,
      optional: row.optional,
      parents: A.map(row.parents, (p) => `${p.name}@${p.version}`),
    }))
  );

const OracleEntry = S.Struct({
  parents: S.Array(S.Struct({ name: S.String, version: S.String })),
  optional: S.Boolean,
  wantedRange: S.String,
  foundVersion: S.optionalKey(S.String),
});
const Oracle = S.fromJsonString(
  S.Record(
    S.String,
    S.Struct({
      bad: S.optionalKey(S.Record(S.String, S.Array(OracleEntry))),
      missing: S.optionalKey(S.Record(S.String, S.Array(OracleEntry))),
    })
  )
);

const oracleRow =
  (importer: string, dependency: string) =>
  (entry: typeof OracleEntry.Type): Row => ({
    importer,
    dependency,
    wanted: entry.wantedRange,
    found: entry.foundVersion ?? null,
    optional: entry.optional,
    parents: A.map(entry.parents, (p) => `${p.name}@${p.version}`),
  });

const theirs = (dir: string, file = "peers-check.json"): ReadonlyArray<Row> => {
  const everyImporterKeyedSoEmptinessIsAVerdict = Result.getOrThrow(
    S.decodeResult(Oracle)(fixture(`peers/${dir}/${file}`))
  );
  return order(
    A.flatMap(R.toEntries(everyImporterKeyedSoEmptinessIsAVerdict), ([importer, report]) =>
      A.flatMap([report.bad ?? {}, report.missing ?? {}], (section) =>
        A.flatMap(R.toEntries(section), ([dependency, entries]) => A.map(entries, oracleRow(importer, dependency)))
      )
    )
  );
};

describe("PeerCheck.run, a pure value over real pnpm lockfiles, checked against a committed pnpm peers check --json oracle (provenance: fixtures/peers/README.md)", () => {
  it.effect("agrees with pnpm peers check on a workspace mixing all four verdicts", () =>
    Effect.gen(function* () {
      const parsed1 = yield* parse("mixed");
      const report = PeerCheck.run(parsed1);
      assert.isTrue(report.supported);
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("mixed"));
    })
  );

  it.effect("agrees with pnpm peers check on unresolvable peers, transitive ones included", () =>
    Effect.gen(function* () {
      const parsed2 = yield* parse("missing");
      const report = PeerCheck.run(parsed2);
      assert.isTrue(report.supported);
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("missing"));
    })
  );

  it.effect("reports an unmet required peer with the version that actually resolved", () =>
    Effect.gen(function* () {
      const parsed3 = yield* parse("mixed");
      const report = PeerCheck.run(parsed3);
      const row = O.getOrUndefined(
        A.findFirst(report.unsatisfied, (r) => r.importer === "packages/unmet" && r.dependency === "react")
      );

      assert.isDefined(row);
      assert.strictEqual(row?.wanted, "^18.3.1");
      assert.strictEqual(row?.found, "17.0.2");
      assert.isFalse(row?.optional);
      assert.deepStrictEqual(
        A.map(row?.parents ?? [], (p) => `${p.name}@${p.version}`),
        ["react-dom@18.3.1"]
      );
    })
  );

  it.effect("distinguishes an unmet OPTIONAL peer, and keeps it out of `required`", () =>
    Effect.gen(function* () {
      const parsed4 = yield* parse("mixed");
      const report = PeerCheck.run(parsed4);
      const row = O.getOrUndefined(
        A.findFirst(report.unsatisfied, (r) => r.importer === "packages/optional" && r.dependency === "redux")
      );

      assert.isDefined(row);
      assert.isTrue(row?.optional);
      assert.strictEqual(row?.found, "4.2.1");
      assert.isTrue(
        A.every(report.required, (r) => !r.optional),
        "the consumer's gate fires on required peers only, so an optional row must never reach it"
      );
      assert.isUndefined(O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "redux")));
    })
  );

  it.effect("collapses a DIAMOND to one row per package, as pnpm does", () =>
    Effect.gen(function* () {
      const useSyncExternalStoreReachedViaReactReduxAndZustand = yield* parse("diamond");
      const report = PeerCheck.run(useSyncExternalStoreReachedViaReactReduxAndZustand);
      assert.isTrue(report.supported);
      assert.deepStrictEqual(
        ours(report.unsatisfied),
        theirs("diamond"),
        "pnpm collapses per (importer, peer, package), reporting the react-redux chain once and nothing about zustand's"
      );

      const rows = A.filter(
        report.unsatisfied,
        (r) => r.dependency === "react" && A.some(r.parents, (p) => p.name === "use-sync-external-store")
      );
      assert.strictEqual(
        rows.length,
        1,
        "stated directly: the oracle comparison would also pass if both sides grew the second chain"
      );
      assert.deepStrictEqual(
        A.map(rows[0]?.parents ?? [], (p) => p.name),
        ["react-redux", "use-sync-external-store"]
      );
      const lockfile = yield* parse("diamond");
      const zustand = lockfile.packagesNamed("zustand")[0];
      const provider = O.getOrUndefined(
        A.findFirst(lockfile.packagesNamed("use-sync-external-store"), (p) => p.version === "1.2.2")
      );
      assert.isDefined(provider);
      assert.strictEqual(
        zustand?.resolved["use-sync-external-store"],
        provider?.instanceId,
        "the zustand chain really reaches the package, compared by the provider's opaque instanceId rather than a spelled one"
      );
    })
  );

  it.effect("reports `found: null` for a peer nothing resolved, with no extra discriminant", () =>
    Effect.gen(function* () {
      const parsed6 = yield* parse("missing");
      const report = PeerCheck.run(parsed6);
      const rows = A.filter(report.unsatisfied, (r) => r.dependency === "react");

      assert.strictEqual(rows.length, 3);
      assert.isTrue(A.every(rows, (r) => r.found === null));
      const transitive = O.getOrUndefined(A.findFirst(rows, (r) => r.parents.length === 2));
      assert.isDefined(transitive);
      assert.deepStrictEqual(
        A.map(transitive?.parents ?? [], (p) => p.name),
        ["react-redux", "use-sync-external-store"],
        "a peer declared by a dependency of a dependency is why parents is a path, not one package"
      );
    })
  );

  it.effect("finds nothing for a satisfied importer, and says so as a verdict", () =>
    Effect.gen(function* () {
      const parsed7 = yield* parse("mixed");
      const report = PeerCheck.run(parsed7);
      assert.isUndefined(O.getOrUndefined(A.findFirst(report.unsatisfied, (r) => r.importer === "packages/ok")));
      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.unsatisfied, (r) => r.importer === "packages/missing")),
        "pnpm resolves peers from the workspace root, so a sibling's react satisfies this react-dom; reading importer manifests would be a false positive"
      );
    })
  );

  it.effect(
    "agrees with pnpm peers check on a ROOT importer with real dependencies, the common case and the only fixture joining a root to instances productively",
    () =>
      Effect.gen(function* () {
        const parsed8 = yield* parse("rootimporter");
        const report = PeerCheck.run(parsed8);
        assert.isTrue(report.supported);
        assert.deepStrictEqual(report.unresolvedImporters, []);
        assert.deepStrictEqual(ours(report.unsatisfied), theirs("rootimporter"));

        const row = O.getOrUndefined(A.findFirst(report.required, (r) => r.importer === "."));
        assert.isDefined(row);
        assert.strictEqual(row?.dependency, "react");
        assert.strictEqual(row?.found, "17.0.2");
      })
  );

  it.effect("disambiguates two peer variants of one name@version by the recorded suffix", () =>
    Effect.gen(function* () {
      const parsed9 = yield* parse("rootimporter");
      const report = PeerCheck.run(parsed9);
      const row = O.getOrUndefined(
        A.findFirst(report.unsatisfied, (r) => r.importer === "." && r.dependency === "react")
      );

      assert.isDefined(row);
      assert.strictEqual(
        row?.found,
        "17.0.2",
        "react-dom@18.3.1 exists twice; the root's peer suffix picks the 17.0.2 variant, not the satisfied 18.3.1 one"
      );
      assert.strictEqual(row?.wanted, "^18.3.1");
      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.unsatisfied, (r) => r.importer === "packages/other")),
        "the sibling importer resolved the other variant and is clean"
      );
    })
  );

  it.effect("skips an ambiguous join rather than guessing a variant", () =>
    Effect.gen(function* () {
      const handAuthoredSuffixlessEntryOverTwoVariants = yield* parse("ambiguous");
      const report = PeerCheck.run(handAuthoredSuffixlessEntryOverTwoVariants);

      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.unsatisfied, (r) => r.importer === ".")),
        "guessing a variant would fabricate a finding, which is worse than a missing one"
      );
      assert.deepStrictEqual(
        report.unresolvedImporters,
        [],
        "the importer still counts as resolvable, since its react joined fine"
      );
      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.unsatisfied, (r) => r.importer === "packages/other")),
        "the sibling, whose entry carries a suffix, is unaffected"
      );
    })
  );

  it.effect(
    "answers identically for npm and bun, with no per-format branch, matching pnpm's verdict on the same workspace shape",
    () =>
      Effect.gen(function* () {
        const parsed11 = yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" });
        const npm = PeerCheck.run(parsed11);
        const parsed12 = yield* Lockfile.parse(fixture("peers/bun/bun.lock"), { format: "bun" });
        const bun = PeerCheck.run(parsed12);

        for (const [name, report] of [
          ["npm", npm],
          ["bun", bun],
        ] as const) {
          assert.isTrue(report.supported, name);
          const row = O.getOrUndefined(
            A.findFirst(
              report.required,
              (r) => r.dependency === "react" && A.some(r.parents, (pp) => pp.name === "react-dom")
            )
          );
          assert.isDefined(row, `${name}: react-dom's unmet peer`);
          assert.strictEqual(row?.wanted, "^18.3.1", name);
          assert.strictEqual(row?.found, "17.0.2", name);
          assert.deepStrictEqual(
            A.map(row?.parents ?? [], (pp) => pp.name),
            ["react-dom"],
            name
          );
        }
      })
  );

  it.effect("names the importers it could not resolve rather than passing them silently", () =>
    Effect.gen(function* () {
      const parsed13 = yield* Lockfile.parse(fixture("peers/npm-root/package-lock.json"), { format: "npm" });
      const npm = PeerCheck.run(parsed13);
      assert.include(
        npm.unresolvedImporters,
        ".",
        "an npm root cannot be joined to instances, and a gate seeing no rows is entitled to know clean from not looked at"
      );
      const parsed14 = yield* parse("mixed");
      const pnpm = PeerCheck.run(parsed14);
      assert.deepStrictEqual(
        pnpm.unresolvedImporters,
        [],
        "pnpm records the version, so it has no unresolvable importers"
      );
      const parsed15 = yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" });
      const rootless = PeerCheck.run(parsed15);
      assert.deepStrictEqual(
        rootless.unresolvedImporters,
        [],
        "a root with no dependencies is clean, not unresolvable: there is nothing to fail to resolve"
      );
    })
  );

  it.effect("sees a workspace package's OWN unmet peer, which pnpm structurally cannot", () =>
    Effect.gen(function* () {
      const parsed16 = yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" });
      const npm = PeerCheck.run(parsed16);
      const own = O.getOrUndefined(
        A.findFirst(npm.required, (r) => r.importer === "packages/lib" && r.dependency === "react")
      );

      assert.isDefined(own);
      assert.strictEqual(own?.wanted, "^18.0.0");
      assert.strictEqual(own?.found, "17.0.2");
      assert.deepStrictEqual(own?.parents, [], "declared by the importer itself");
    })
  );

  it.effect("cannot answer for yarn, and says so rather than returning an empty pass", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(A.join(["__metadata:", "  version: 8", "  cacheKey: 10c0"], "\n"), {
        format: "yarn",
      });
      const report = PeerCheck.run(lockfile);

      assert.isFalse(
        report.supported,
        "yarn resolves peers virtually and records no peer edges, so an empty array alone would read as clean"
      );
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.required, []);
    })
  );
});

describe("PeerCheck.run — peerDependencyRules and the unverified states: without pnpm's suppression policy a checker reports rows pnpm calls clean", () => {
  const rules = (allowedVersions: Record<string, string>) => ({
    allowedVersions,
    ignoreMissing: [],
    allowAny: [],
  });

  it.effect("omitting the option always reports peerRulesNotApplied", () =>
    Effect.gen(function* () {
      const parsed17 = yield* parse("mixed");
      const report = PeerCheck.run(parsed17);
      assert.include(
        report.unverified,
        "peerRulesNotApplied",
        "nobody looked: the report may contain rows pnpm would suppress"
      );
    })
  );

  it.effect("supplying empty rules asserts there are none, and is verified", () =>
    Effect.gen(function* () {
      const parsed18 = yield* parse("mixed");
      const report = PeerCheck.run(parsed18, { peerDependencyRules: NoPeerDependencyRules });
      assert.notInclude(
        report.unverified,
        "peerRulesNotApplied",
        "I looked and there are none is a different fact from nobody looked, or a gate cannot tell clean from unchecked"
      );
      const parsed19 = yield* parse("mixed");
      assert.strictEqual(
        report.required.length,
        PeerCheck.run(parsed19).required.length,
        "the rows are unchanged; only the verification state moves"
      );
    })
  );

  it.effect("rules with only allowedVersions populated, the overwhelmingly common shape, stay verified", () =>
    Effect.gen(function* () {
      const parsed20 = yield* parse("mixed");
      const report = PeerCheck.run(parsed20, {
        peerDependencyRules: rules({ "react-dom>react": "17.0.2" }),
      });
      assert.notInclude(report.unverified, "peerRulesNotApplied");
    })
  );

  it.effect("a rule suppresses the row pnpm suppresses", () =>
    Effect.gen(function* () {
      const parsed21 = yield* parse("mixed");
      const before = PeerCheck.run(parsed21, { peerDependencyRules: NoPeerDependencyRules });
      assert.isDefined(
        O.getOrUndefined(
          A.findFirst(before.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        )
      );

      const parsed22 = yield* parse("mixed");
      const after = PeerCheck.run(parsed22, {
        peerDependencyRules: rules({ "react-dom@18.3.1>react": "17.0.2" }),
      });
      assert.isUndefined(
        O.getOrUndefined(
          A.findFirst(after.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        )
      );
    })
  );

  it.effect("a rule whose PARENT VERSION is wrong still suppresses — pnpm ignores it", () =>
    Effect.gen(function* () {
      const parsed23 = yield* parse("mixed");
      const report = PeerCheck.run(parsed23, {
        peerDependencyRules: rules({ "react-dom@99.0.0>react": "17.0.2" }),
      });
      assert.isUndefined(
        O.getOrUndefined(
          A.findFirst(report.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        ),
        "the key names react-dom@99.0.0 over an 18.3.1 instance; matching the parent version would leave false positives pnpm hides"
      );
    })
  );

  it.effect("an UNVERSIONED rule key suppresses too — the spelling a plugin injects", () =>
    Effect.gen(function* () {
      const parsed24 = yield* parse("mixed");
      const report = PeerCheck.run(parsed24, {
        peerDependencyRules: rules({ "react-dom>react": "17.0.2" }),
      });
      assert.isUndefined(
        O.getOrUndefined(
          A.findFirst(report.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        ),
        "pnpm:export writes versioned keys, a plugin injects unversioned ones; a matcher that only strips a version fails here"
      );
    })
  );

  it.effect("a rule for a DIFFERENT parent leaves the row alone", () =>
    Effect.gen(function* () {
      const parsed25 = yield* parse("mixed");
      const report = PeerCheck.run(parsed25, {
        peerDependencyRules: rules({ "something-else@1.0.0>react": "17.0.2" }),
      });
      assert.isDefined(
        O.getOrUndefined(
          A.findFirst(report.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        ),
        "same peer and version, different parent: ignoring the parent version must not become ignoring the parent"
      );
    })
  );

  it.effect("a rule permitting a DIFFERENT version leaves the row alone", () =>
    Effect.gen(function* () {
      const parsed26 = yield* parse("mixed");
      const report = PeerCheck.run(parsed26, {
        peerDependencyRules: rules({ "react-dom>react": "16.0.0" }),
      });
      assert.isDefined(
        O.getOrUndefined(
          A.findFirst(report.required, (r) => r.importer === "packages/unmet" && r.dependency === "react")
        )
      );
    })
  );

  it.effect("a BARE rule key, pnpm's documented third spelling, suppresses too — pnpm applies it to every parent", () =>
    Effect.gen(function* () {
      const parsed27 = yield* parse("barerule");
      const report = PeerCheck.run(parsed27, {
        peerDependencyRules: rules({ react: "17" }),
      });
      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "skipping bare keys would report a row pnpm suppresses while claiming the policy was applied"
      );
      assert.deepStrictEqual(report.unverified, []);
      assert.deepStrictEqual(
        ours(report.unsatisfied),
        theirs("barerule"),
        'the committed oracle is pnpm 11.22.0\'s run with only { react: "17" }, which reports it clean'
      );
    })
  );

  it.effect("a bare rule permitting a DIFFERENT version leaves the row alone", () =>
    Effect.gen(function* () {
      const parsed28 = yield* parse("barerule");
      const report = PeerCheck.run(parsed28, {
        peerDependencyRules: rules({ react: "16" }),
      });
      assert.isDefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "a range that misses the resolved version keeps the row, so bare keys cannot suppress unconditionally"
      );
      assert.deepStrictEqual(
        ours(report.unsatisfied),
        theirs("barerule", "peers-check-nonmatching.json"),
        'the oracle is a second pnpm run over the same workspace with react: "16"'
      );
    })
  );

  it.effect("a bare rule naming a DIFFERENT peer leaves the row alone", () =>
    Effect.gen(function* () {
      const parsed29 = yield* parse("barerule");
      const report = PeerCheck.run(parsed29, {
        peerDependencyRules: rules({ redux: "17" }),
      });
      assert.isDefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "a permitting range under another peer's bare key: matching bare keys must not become matching every bare key"
      );
    })
  );

  it.effect("a rule key that names no parent at all suppresses nothing", () =>
    Effect.gen(function* () {
      const parsed30 = yield* parse("barerule");
      const report = PeerCheck.run(parsed30, {
        peerDependencyRules: rules({ ">react": "17" }),
      });
      assert.isDefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "an empty parent is malformed and must not degrade into a bare key, which would widen suppression past pnpm's"
      );
    })
  );

  it.effect("declines a peer whose edge the model could not name", () =>
    Effect.gen(function* () {
      const reactSatisfiedByLinkToANonImporterDirectory = yield* parse("unnameable");
      const report = PeerCheck.run(reactSatisfiedByLinkToANonImporterDirectory, {
        peerDependencyRules: NoPeerDependencyRules,
      });
      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "reporting it unsatisfied is the false positive; this test pins the declining half only"
      );
      assert.deepStrictEqual(
        ours(report.unsatisfied),
        theirs("unnameable"),
        "pnpm calls this workspace clean, so declining is agreement; the unverified marker pinned next keeps it honest"
      );
    })
  );

  it.effect("and says the report is unverified rather than declining silently", () =>
    Effect.gen(function* () {
      const parsed32 = yield* parse("unnameable");
      const report = PeerCheck.run(parsed32, {
        peerDependencyRules: NoPeerDependencyRules,
      });
      assert.include(
        report.unverified,
        "unresolvedEdge",
        "declining without saying why would turn a false positive into a false negative; its own test so each rule pins alone"
      );
    })
  );

  it.effect("fails closed on a link:-resolved parent whose peers the lockfile never records", () =>
    Effect.gen(function* () {
      const effected800ProbeWherePnpmReadsTheLinkedManifestOnDisk = yield* parse("linkdeep");
      const report = PeerCheck.run(effected800ProbeWherePnpmReadsTheLinkedManifestOnDisk, {
        peerDependencyRules: NoPeerDependencyRules,
      });
      assert.isTrue(report.supported);
      assert.deepStrictEqual(
        report.unsatisfied,
        [],
        "no fabricated finding: the linked parent's peers are invisible in the lockfile, so a guessed row would be false"
      );
      assert.deepStrictEqual(report.unresolvedImporters, []);
      assert.deepStrictEqual(
        report.unverified,
        ["unresolvedEdge"],
        "fail closed: the marker is the whole fix, and supplied rules keep peerRulesNotApplied out"
      );
      const knownDivergencePnpmReportsTheRow = theirs("linkdeep");
      assert.strictEqual(knownDivergencePnpmReportsTheRow.length, 1);
      assert.strictEqual(knownDivergencePnpmReportsTheRow[0]?.importer, "packages/b");
      assert.strictEqual(knownDivergencePnpmReportsTheRow[0]?.dependency, "react");
      assert.strictEqual(knownDivergencePnpmReportsTheRow[0]?.wanted, "^18.0.0");
      assert.strictEqual(knownDivergencePnpmReportsTheRow[0]?.found, null);
      assert.deepStrictEqual(knownDivergencePnpmReportsTheRow[0]?.parents, ["probe-a@1.0.0"]);
    })
  );

  it.effect("a link: edge fails the report closed even when the rules are absent from the picture", () =>
    Effect.gen(function* () {
      const parsed34 = yield* parse("linkdeep");
      const report = PeerCheck.run(parsed34);
      assert.include(report.unverified, "peerRulesNotApplied");
      assert.include(
        report.unverified,
        "unresolvedEdge",
        "both reasons in one report, or a gate supplying rules later would read the same tree as verified"
      );
    })
  );

  it.effect(
    "joins a supplied linked parent's manifest peers (effected#800's option 1), clearing the marker it replaced",
    () =>
      Effect.gen(function* () {
        const parsed35 = yield* parse("linkdeep");
        const report = PeerCheck.run(parsed35, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });

        assert.deepStrictEqual(
          ours(report.unsatisfied),
          theirs("linkdeep"),
          "row for row with the verdict pnpm read off the linked manifest on disk"
        );
        assert.deepStrictEqual(
          report.unverified,
          [],
          "the marker gone is the half that says the join happened rather than agreeing by silence"
        );
      })
  );

  it.effect("fails closed for a link: target the supplied set does not cover", () =>
    Effect.gen(function* () {
      const parsed36 = yield* parse("linkdeep");
      const report = PeerCheck.run(parsed36, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ relativePath: "packages/elsewhere" })],
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(
        report.unverified,
        ["unresolvedEdge"],
        "a set covering a different directory says nothing about this edge: the key's contents decide which edges it answers for"
      );
    })
  );

  it.effect(
    "judges a joined parent's peers against the importer's OWN dependency set, since a workspace-wide name lookup is wrong both ways (pnpm 12.5.1 and 12.6.0)",
    () =>
      Effect.gen(function* () {
        const parsed37 = yield* parse("linkdeep-provided");
        const provided = PeerCheck.run(parsed37, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(
          ours(provided.unsatisfied),
          theirs("linkdeep-provided"),
          "the consumer's own react@18.3.1 satisfies the linked parent's ^18.0.0 peer"
        );
        assert.deepStrictEqual(provided.unverified, []);

        const parsed38 = yield* parse("linkdeep-sibling");
        const sibling = PeerCheck.run(parsed38, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(
          ours(sibling.unsatisfied),
          theirs("linkdeep-sibling"),
          "the same version installed only by a sibling does not; a workspace-wide lookup would manufacture a clean report"
        );
        assert.deepStrictEqual(sibling.unverified, []);

        const parsed39 = yield* parse("linkdeep-bad");
        const bad = PeerCheck.run(parsed39, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(
          ours(bad.unsatisfied),
          theirs("linkdeep-bad"),
          "the consumer's own react@17.0.2 is outside the range: a bad row carrying the version that resolved"
        );
        assert.deepStrictEqual(bad.unverified, []);
      })
  );

  it.effect("clears the marker for a supplied target without inventing rows from it", () =>
    Effect.gen(function* () {
      const parsed40 = yield* parse("workspacepeer");
      const report = PeerCheck.run(parsed40, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [
          probeA({ name: "react", version: "18.3.1", relativePath: "packages/fakereact", peerDependencies: {} }),
        ],
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("workspacepeer"));
      assert.deepStrictEqual(
        report.unverified,
        [],
        "the link: into packages/fakereact declares no peers; verified because the manifest was read, not by declining to look"
      );
    })
  );

  it.effect(
    "walks a ROOT importer's covered link: target, which has no workspace row to join through, and agrees with pnpm 12.6.0",
    () =>
      Effect.gen(function* () {
        const parsed41 = yield* parse("linkdeep-root");
        const report = PeerCheck.run(parsed41, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.strictEqual(theirs("linkdeep-root").length, 1);
        assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-root"));
        assert.deepStrictEqual(report.unresolvedImporters, []);
        assert.deepStrictEqual(report.unverified, []);
      })
  );

  it.effect("judges a ROOT importer's linked peer against the root's own dependency set", () =>
    Effect.gen(function* () {
      const parsed42 = yield* parse("linkdeep-root-bad");
      const report = PeerCheck.run(parsed42, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA()],
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-root-bad"));
      assert.strictEqual(
        report.unsatisfied[0]?.found,
        "17.0.2",
        "the root's own react@17.0.2 is the provider pnpm judges against, so the row is bad, not missing"
      );
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("keeps the marker for a ROOT importer's link: target the supplied set does not cover", () =>
    Effect.gen(function* () {
      const parsed43 = yield* parse("linkdeep-root");
      const report = PeerCheck.run(parsed43, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ relativePath: "packages/elsewhere" })],
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
    })
  );

  it.effect("keeps escaping ROOT links distinct from an unrelated internal package", () =>
    Effect.gen(function* () {
      for (const target of ["../packages/a", "../../packages/a", "../outside/../packages/a"]) {
        const lockfile = yield* Lockfile.parse(
          Str.replace(
            "version: link:packages/a",
            `version: link:${target}`
          )(fixture("peers/linkdeep-root/pnpm-lock.yaml")),
          { format: "pnpm" }
        );
        const report = PeerCheck.run(lockfile, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(report.unsatisfied, []);
        assert.deepStrictEqual(report.unresolvedImporters, []);
        assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
      }
    })
  );

  it.effect("keeps absolute ROOT links distinct from an unrelated internal package", () =>
    Effect.gen(function* () {
      for (const target of ["/packages/a", "/packages/./a", "/outside/../packages/a"]) {
        const lockfile = yield* Lockfile.parse(
          Str.replace(
            "version: link:packages/a",
            `version: link:${target}`
          )(fixture("peers/linkdeep-root/pnpm-lock.yaml")),
          { format: "pnpm" }
        );
        const report = PeerCheck.run(lockfile, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(report.unsatisfied, []);
        assert.deepStrictEqual(report.unresolvedImporters, []);
        assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
      }
    })
  );

  it.effect(
    "keeps the marker for a covered link: target with no lockfile row to walk, since covering a path is not judging it",
    () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(
          A.join(
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
            ],
            "\n"
          ),
          { format: "pnpm" }
        );
        const report = PeerCheck.run(lockfile, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA({ relativePath: "vendor/a" })],
        });
        assert.deepStrictEqual(report.unsatisfied, []);
        assert.include(report.unverified, "unresolvedEdge");
      })
  );

  it.effect(
    "covers a link: into a publish directory, pnpm 12.6.0's default without linkDirectory: false and every savvy-web monorepo's shape, and agrees with pnpm",
    () =>
      Effect.gen(function* () {
        const parsed44 = yield* parse("linkdeep-directory");
        const report = PeerCheck.run(parsed44, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist" }) })],
        });
        assert.strictEqual(theirs("linkdeep-directory").length, 1);
        assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory"));
        assert.deepStrictEqual(report.unverified, []);
      })
  );

  it.effect("normalizes the publish directory spelling, and honours an explicit linkDirectory: true", () =>
    Effect.gen(function* () {
      const parsed45 = yield* parse("linkdeep-directory");
      const report = PeerCheck.run(parsed45, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [
          probeA({ publishConfig: PublishConfig.make({ directory: "./dist/", linkDirectory: true }) }),
        ],
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory"));
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("keeps the marker for a publish-directory link: when the manifests are omitted", () =>
    Effect.gen(function* () {
      const parsed46 = yield* parse("linkdeep-directory");
      const report = PeerCheck.run(parsed46, {
        peerDependencyRules: NoPeerDependencyRules,
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
    })
  );

  it.effect("does not cover a publish-directory link: for a manifest that says linkDirectory: false", () =>
    Effect.gen(function* () {
      const parsed47 = yield* parse("linkdeep-directory");
      const report = PeerCheck.run(parsed47, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist", linkDirectory: false }) })],
      });
      assert.deepStrictEqual(
        report.unverified,
        ["unresolvedEdge"],
        "the manifest disagrees with the lockfile about where the link lands, so it does not describe this edge"
      );
    })
  );

  it.effect("with linkDirectory: false, pnpm links the package root and the root spelling is covered", () =>
    Effect.gen(function* () {
      const parsed48 = yield* parse("linkdeep-directory-false");
      const report = PeerCheck.run(parsed48, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ publishConfig: PublishConfig.make({ directory: "dist", linkDirectory: false }) })],
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-directory-false"));
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  const chainA = (peerDependencies: Record<string, string> = {}): WorkspacePackage => probeA({ peerDependencies });
  const chainC = (): WorkspacePackage => probeA({ name: "probe-c", relativePath: "packages/c" });
  const chainPackages = (): ReadonlyArray<WorkspacePackage> => [chainA(), chainC()];

  it.effect("judges a linked package's peers for its DIRECT consumer only (consumer's parent provides)", () =>
    Effect.gen(function* () {
      const parsed49 = yield* parse("linkchain-parent-provides");
      const report = PeerCheck.run(parsed49, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: chainPackages(),
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkchain-parent-provides"));
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("never surfaces a transitively linked package's peers on the outer consumer", () =>
    Effect.gen(function* () {
      const parsed50 = yield* parse("linkchain-importer-provides");
      const provided = PeerCheck.run(parsed50, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: chainPackages(),
      });
      assert.strictEqual(theirs("linkchain-importer-provides").length, 1);
      assert.deepStrictEqual(
        ours(provided.unsatisfied),
        theirs("linkchain-importer-provides"),
        "only b has react: pnpm still reports the peer on a, whose own dependencies lack it, and calls b clean"
      );
      assert.deepStrictEqual(provided.unverified, []);

      const parsed51 = yield* parse("linkchain-none");
      const none = PeerCheck.run(parsed51, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: chainPackages(),
      });
      assert.deepStrictEqual(
        ours(none.unsatisfied),
        theirs("linkchain-none"),
        "nobody has react: still one row, on a, not a second one on b"
      );
      assert.deepStrictEqual(none.unverified, []);
    })
  );

  it.effect("attributes a linked package's registry dependency peers to its own importer only", () =>
    Effect.gen(function* () {
      const parsed52 = yield* parse("linkchain-registry");
      const report = PeerCheck.run(parsed52, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ name: "probe-c", relativePath: "packages/c", peerDependencies: {} })],
      });
      assert.strictEqual(theirs("linkchain-registry").length, 1);
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkchain-registry"));
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("a deeper link edge is judged by its own consumer's walk: uncovered, it keeps the marker", () =>
    Effect.gen(function* () {
      const parsed53 = yield* parse("linkchain-none");
      const onlyA = PeerCheck.run(parsed53, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [chainA()],
      });
      assert.deepStrictEqual(
        onlyA.unverified,
        ["unresolvedEdge"],
        "supplying only a leaves a's edge to c unjudged: the outer walk no longer reaches c, so nothing else clears it"
      );
      const parsed54 = yield* parse("linkchain-none");
      const onlyC = PeerCheck.run(parsed54, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [chainC()],
      });
      assert.deepStrictEqual(ours(onlyC.unsatisfied), theirs("linkchain-none"), "a's own walk still reports c's peer");
      assert.deepStrictEqual(onlyC.unverified, ["unresolvedEdge"], "supplying only c leaves b's edge to a unjudged");
    })
  );

  const catalogPeer = probeA({ peerDependencies: { react: "catalog:peers" } });
  const peersCatalog = CatalogSet.make({ entries: { peers: { react: "^18.0.0" } } });

  it.effect("resolves a catalog peer range that the provider satisfies", () =>
    Effect.gen(function* () {
      const parsed55 = yield* parse("linkdeep-provided");
      const report = PeerCheck.run(parsed55, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
        catalogs: peersCatalog,
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-provided"));
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("resolves the DEFAULT catalog for a bare `catalog:` peer range", () =>
    Effect.gen(function* () {
      const parsed56 = yield* parse("linkdeep-bad");
      const report = PeerCheck.run(parsed56, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ peerDependencies: { react: "catalog:" } })],
        catalogs: CatalogSet.make({ entries: { default: { react: "^18.0.0" } } }),
      });
      assert.deepStrictEqual(ours(report.unsatisfied), theirs("linkdeep-bad"));
      assert.deepStrictEqual(report.unverified, []);
    })
  );

  it.effect("reports a catalog peer range the provider misses, with the RESOLVED range as wanted", () =>
    Effect.gen(function* () {
      const parsed57 = yield* parse("linkdeep-bad");
      const bad = PeerCheck.run(parsed57, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
        catalogs: peersCatalog,
      });
      assert.deepStrictEqual(
        ours(bad.unsatisfied),
        theirs("linkdeep-bad"),
        "react@17.0.2 against the catalog's ^18.0.0 agrees with the oracle's bad row, wantedRange included"
      );
      assert.strictEqual(bad.unsatisfied[0]?.wanted, "^18.0.0");
      assert.deepStrictEqual(bad.unverified, []);

      const parsed58 = yield* parse("linkdeep");
      const missing = PeerCheck.run(parsed58, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
        catalogs: peersCatalog,
      });
      assert.deepStrictEqual(
        ours(missing.unsatisfied),
        theirs("linkdeep"),
        "with no provider the row needs no range arithmetic, but wanted is still the resolved range, as pnpm's is"
      );
      assert.deepStrictEqual(missing.unverified, []);
    })
  );

  it.effect("fails closed on a catalog peer range the supplied catalogs do not name", () =>
    Effect.gen(function* () {
      const parsed59 = yield* parse("linkdeep-bad");
      const report = PeerCheck.run(parsed59, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
        catalogs: CatalogSet.make({ entries: { build: { react: "^18.0.0" } } }),
      });
      assert.deepStrictEqual(report.unsatisfied, [], "never judged, so no row");
      assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"], "never judged, so no clean report either");
    })
  );

  it.effect("fails closed on a catalog peer range when the catalogs key is omitted", () =>
    Effect.gen(function* () {
      const parsed60 = yield* parse("linkdeep-bad");
      const report = PeerCheck.run(parsed60, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(
        report.unverified,
        ["peerRangeUnresolved"],
        "presence is the assertion: with no catalogs nothing was looked up, so a present provider cannot be judged"
      );

      const parsed61 = yield* parse("linkdeep");
      const missing = PeerCheck.run(parsed61, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
      });
      assert.strictEqual(
        missing.unsatisfied.length,
        1,
        "a missing provider is a fact about the graph, reportable without the range"
      );
      assert.strictEqual(missing.unsatisfied[0]?.wanted, "catalog:peers", "the row echoes the raw specifier");
      assert.strictEqual(missing.unsatisfied[0]?.found, null);
      assert.deepStrictEqual(missing.unverified, [], "not marked, because that peer was judged");
    })
  );

  it.effect("fails closed on a non-catalog protocol peer range such as `workspace:*`", () =>
    Effect.gen(function* () {
      const parsed62 = yield* parse("linkdeep-bad");
      const report = PeerCheck.run(parsed62, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ peerDependencies: { react: "workspace:*" } })],
        catalogs: peersCatalog,
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);
    })
  );

  it.effect("fails closed when a catalog entry itself resolves to a protocol specifier", () =>
    Effect.gen(function* () {
      const parsed63 = yield* parse("linkdeep-bad");
      const report = PeerCheck.run(parsed63, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [catalogPeer],
        catalogs: CatalogSet.make({ entries: { peers: { react: "workspace:^" } } }),
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved"]);
    })
  );

  it.effect("accepts a peer satisfied by a WORKSPACE package without version-comparing it", () =>
    Effect.gen(function* () {
      const reactReduxResolvedToTheWorkspacePackageFakereact = yield* parse("workspacepeer");
      const report = PeerCheck.run(reactReduxResolvedToTheWorkspacePackageFakereact, {
        peerDependencyRules: NoPeerDependencyRules,
      });

      assert.isUndefined(
        O.getOrUndefined(A.findFirst(report.required, (r) => r.dependency === "react")),
        "comparing against the 0.0.0 placeholder would be a false answer dressed as a finding; an edge and a provider exist"
      );
      assert.deepStrictEqual(
        report.unverified,
        ["unresolvedEdge"],
        "the satisfying edge is a link: whose manifest peers this model cannot see (effected#800), so completeness fails closed"
      );
      assert.deepStrictEqual(
        ours(report.unsatisfied),
        theirs("workspacepeer"),
        "agreement by silence with pnpm's clean verdict, which is why the unverified assertion sits beside it"
      );
      const lockfile = yield* parse("workspacepeer");
      const stub = lockfile.packagesNamed("packages/fakereact")[0];
      assert.isTrue(
        stub?.isWorkspace,
        "the edge really points at a workspace row, or the assertions above pass for the wrong reason"
      );
      assert.strictEqual(stub?.version, "0.0.0");
    })
  );

  it.effect("npm and bun need no rules input to be fully answerable", () =>
    Effect.gen(function* () {
      const parsed65 = yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" });
      const npm = PeerCheck.run(parsed65, {
        peerDependencyRules: NoPeerDependencyRules,
      });
      assert.deepStrictEqual(
        npm.unverified,
        [],
        "peerDependencyRules is pnpm-only: npm has no equivalent suppression, so its computation is already complete"
      );
    })
  );
});

describe("PeerCheck.run — ignoreMissing and allowAny, each oracle one pnpm 12.5.1 run over the same lockfile so the rule is the variable (effected#430, provenance: fixtures/peers/README.md)", () => {
  const withAllowAny = (allowAny: ReadonlyArray<string>) => ({
    peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny },
  });
  const withIgnoreMissing = (ignoreMissing: ReadonlyArray<string>) => ({
    peerDependencyRules: { allowedVersions: {}, ignoreMissing, allowAny: [] },
  });

  const agrees = Effect.fn("agrees")(function* (
    dir: string,
    options: PeerCheckOptions.Input | undefined,
    file: string
  ) {
    const parsed66 = yield* parse(dir);
    const report = PeerCheck.run(parsed66, options);
    assert.isTrue(report.supported);
    assert.deepStrictEqual(
      report.unverified,
      [],
      "supplied rules with these axes populated are fully applied, so the report is verified"
    );
    assert.deepStrictEqual(
      ours(report.unsatisfied),
      theirs(dir, file),
      "the fixture under this rule configuration agrees with its oracle file"
    );
  });

  it.effect(
    "allowany control: with no rules both bad rows fire, required react (packages/unmet) and optional redux (packages/optional)",
    () => agrees("allowany", { peerDependencyRules: NoPeerDependencyRules }, "peers-check.json")
  );
  it.effect("allowAny by bare name clears the bad required react and leaves redux", () =>
    agrees("allowany", withAllowAny(["react"]), "peers-check-bare-react.json")
  );
  it.effect("allowAny by bare name clears the bad OPTIONAL redux and leaves react", () =>
    agrees("allowany", withAllowAny(["redux"]), "peers-check-bare-redux.json")
  );
  it.effect("allowAny glob `re*` clears both bad rows", () =>
    agrees("allowany", withAllowAny(["re*"]), "peers-check-glob.json")
  );
  it.effect("allowAny `*` then `!redux` clears react and keeps redux", () =>
    agrees("allowany", withAllowAny(["*", "!redux"]), "peers-check-star-negation.json")
  );
  it.effect("allowAny with a parent>peer key suppresses nothing — the grammar has no parent", () =>
    agrees("allowany", withAllowAny(["react-dom>react"]), "peers-check-parent-key.json")
  );
  it.effect("allowAny `!redux` then `*`: the later `*` re-includes redux, so both rows clear", () =>
    agrees("allowany", withAllowAny(["!redux", "*"]), "peers-check-negation-then-star.json")
  );
  it.effect("allowAny with a lone `!` (negating the empty name) matches every peer and clears both rows", () =>
    agrees("allowany", withAllowAny(["!"]), "peers-check-lone-negation.json")
  );
  it.effect("ignoreMissing never rescues a row where something resolved at the wrong version", () =>
    agrees("allowany", withIgnoreMissing(["react", "redux"]), "peers-check-ignoremissing-react-redux.json")
  );

  it.effect(
    "ignoremissing control: with no rules all three missing react rows for packages/lone fire, one transitive via react-redux > use-sync-external-store",
    () => agrees("ignoremissing", { peerDependencyRules: NoPeerDependencyRules }, "peers-check.json")
  );
  it.effect("ignoreMissing by bare name clears every missing react, the transitive one included", () =>
    agrees("ignoremissing", withIgnoreMissing(["react"]), "peers-check-bare.json")
  );
  it.effect("ignoreMissing glob `rea*` clears every missing react", () =>
    agrees("ignoremissing", withIgnoreMissing(["rea*"]), "peers-check-glob.json")
  );
  it.effect("ignoreMissing `*` then `!react` keeps every missing react", () =>
    agrees("ignoremissing", withIgnoreMissing(["*", "!react"]), "peers-check-star-negation.json")
  );
  it.effect("ignoreMissing holding ONLY a negation clears everything not excluded", () =>
    agrees("ignoremissing", withIgnoreMissing(["!redux"]), "peers-check-negation-only.json")
  );
  it.effect("ignoreMissing with a parent>peer key suppresses nothing", () =>
    agrees("ignoremissing", withIgnoreMissing(["react-dom>react"]), "peers-check-parent-key.json")
  );
  it.effect("ignoreMissing with a parent@version>peer key suppresses nothing either", () =>
    agrees("ignoremissing", withIgnoreMissing(["react-dom@18.3.1>react"]), "peers-check-parent-versioned-key.json")
  );
  it.effect("allowAny never rescues a missing peer", () =>
    agrees("ignoremissing", withAllowAny(["react"]), "peers-check-allowany-react.json")
  );

  it.effect(
    "a pattern that matches no peer name leaves every row in place, a mutation discriminator that fails one test rather than an oracle batch",
    () =>
      Effect.gen(function* () {
        const parsed67 = yield* parse("allowany");
        const before = PeerCheck.run(parsed67, { peerDependencyRules: NoPeerDependencyRules });
        const parsed68 = yield* parse("allowany");
        const after = PeerCheck.run(parsed68, withAllowAny(["reactx", "!*"]));
        assert.strictEqual(after.unsatisfied.length, before.unsatisfied.length);
        assert.isTrue(before.unsatisfied.length > 0);
        const parsed69 = yield* parse("ignoremissing");
        const missing = PeerCheck.run(parsed69, withIgnoreMissing(["redux"]));
        assert.strictEqual(missing.unsatisfied.length, 3);
      })
  );

  it.effect("the axes do not cross, stated on the row rather than the oracle", () =>
    Effect.gen(function* () {
      const parsed70 = yield* parse("allowany");
      const bad = PeerCheck.run(parsed70, withIgnoreMissing(["*"]));
      assert.strictEqual(bad.unsatisfied.length, 2);
      assert.isTrue(
        A.every(bad.unsatisfied, (r) => r.found !== null),
        "ignoreMissing reads only rows with found === null; swapping the predicates in suppressedByRule turns this red"
      );
      const parsed71 = yield* parse("ignoremissing");
      const missing = PeerCheck.run(parsed71, withAllowAny(["*"]));
      assert.strictEqual(missing.unsatisfied.length, 3);
      assert.isTrue(
        A.every(missing.unsatisfied, (r) => r.found === null),
        "allowAny reads only rows with a version"
      );
    })
  );

  it.effect("both axes populated at once compose: each hides only its own kind of row", () =>
    Effect.gen(function* () {
      const parsed72 = yield* parse("allowany");
      const report = PeerCheck.run(parsed72, {
        peerDependencyRules: { allowedVersions: {}, ignoreMissing: ["*"], allowAny: ["redux"] },
      });
      assert.deepStrictEqual(report.unverified, []);
      assert.deepStrictEqual(
        A.map(report.unsatisfied, (r) => r.dependency),
        ["react"]
      );
    })
  );

  it.effect("omitting the key still reports peerRulesNotApplied, whatever the lockfile", () =>
    Effect.gen(function* () {
      const parsed73 = yield* parse("allowany");
      const report = PeerCheck.run(parsed73);
      assert.deepStrictEqual(
        report.unverified,
        ["peerRulesNotApplied"],
        "applying the list axes must not loosen the presence rule"
      );
      assert.strictEqual(report.unsatisfied.length, 2);
    })
  );
});

describe("peerNameMatcher — @pnpm/matcher@1000.1.0 semantics, pinned on the helper because the react/redux-shaped fixtures give scoped-name and order cases no oracle row", () => {
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
    assert.isFalse(peerNameMatcher(["lodash.*"])("lodashXmerge"), "a . in a name must not become any character");
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
    assert.isTrue(
      peerNameMatcher(["!redux", "*"])("redux"),
      "the other order: the negation runs first, then * includes redux again (oracle: allowany/peers-check-negation-then-star.json)"
    );
  });

  it("a lone `!` negates the empty name, which nothing has, so it matches everything", () => {
    const m = peerNameMatcher(["!"]);
    assert.isTrue(m("react"));
    assert.isTrue(m("redux"), "oracle: allowany/peers-check-lone-negation.json clears both bad rows");
  });
});

describe("PeerCheck.run — protocol-specifier provider versions, which semver cannot parse and which fail closed rather than skip as unparseable (pnpm 12.6.0 filedep* oracles)", () => {
  const reactProvider = (lockfile: Lockfile) => lockfile.packagesNamed("react")[0];

  it.effect("fails closed on a registry parent's peer provided by a `file:` directory", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse("filedep");
      assert.strictEqual(
        reactProvider(lockfile)?.version,
        "file:vendor/react",
        "precondition: the provider really is a protocol-specifier version, or the assertions below pass for the wrong reason"
      );
      assert.isFalse(reactProvider(lockfile)?.isWorkspace);

      const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(
        report.unsatisfied,
        [],
        "no fabricated row: the comparison never ran, so unsatisfied would be as false as satisfied"
      );
      assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);

      const oracle = theirs("filedep");
      assert.strictEqual(oracle.length, 1);
      assert.strictEqual(oracle[0]?.importer, "packages/host");
      assert.strictEqual(oracle[0]?.dependency, "react");
      assert.strictEqual(
        oracle[0]?.found,
        "file:vendor/react",
        "known divergence: pnpm reports the specifier as found although the directory's manifest says 18.3.1, which satisfies ^18.3.1"
      );
    })
  );

  it.effect("fails closed on a `file:` provider whose own peers give it a suffixed key", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse("filedep-suffixed");
      const provider = O.getOrUndefined(
        A.findFirst(lockfile.packages, (p) => p.instanceId === "react@file:vendor/react(js-tokens@4.0.0)")
      );
      assert.strictEqual(
        provider?.name,
        "react",
        "the real-tree shape: a linked package that declares peers is keyed with its peer suffix"
      );
      assert.strictEqual(
        provider?.version,
        "file:vendor/react",
        "the suffix splits like a registry one, matching pnpm's suffix-free found version, or the provider reads as garbled and is skipped"
      );
      assert.strictEqual(theirs("filedep-suffixed")[0]?.found, provider?.version);

      const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
    })
  );

  it.effect("fails closed on a peer provided through a `file:` override", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse("filedep-override");
      assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react");
      const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
      assert.strictEqual(theirs("filedep-override")[0]?.found, "file:vendor/react");
    })
  );

  it.effect("fails closed on a `file:` tarball, which pnpm itself judges two ways", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse("filedep-tarball");
      assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react-18.3.1.tgz");
      const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"]);
      assert.strictEqual(
        theirs("filedep-tarball")[0]?.found,
        "file:vendor/react-18.3.1.tgz",
        "pnpm 12.6.0 reports the specifier as the found version"
      );
      assert.deepStrictEqual(
        theirs("filedep-tarball", "peers-check-pnpm-12.7.0.json"),
        [],
        "12.7.0 reads the tarball's real 18.3.1 over the same lockfile, so declining with a marker is consistent with both"
      );
    })
  );

  it.effect("fails closed on a joined link: manifest's peer provided by a `file:` directory", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse("filedep-joined");
      assert.strictEqual(reactProvider(lockfile)?.version, "file:vendor/react");
      const report = PeerCheck.run(lockfile, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA()],
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(
        report.unverified,
        ["peerVersionUnresolved"],
        "pnpm reads 17.0.2 off disk for a joined parent; the lockfile does not carry it, so the row is declined and the report says so"
      );
      const oracle = theirs("filedep-joined");
      assert.strictEqual(oracle.length, 1);
      assert.strictEqual(oracle[0]?.found, "17.0.2");
      assert.deepStrictEqual(oracle[0]?.parents, ["probe-a@1.0.0"]);

      const unjoined = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(
        unjoined.unverified,
        ["unresolvedEdge"],
        "control: unjoined, the manifest peer is never judged, so the version reason comes from the judgement, not the file: instance"
      );
    })
  );

  it.effect("gives the one answer consistent with pnpm 11 and pnpm 12, which disagree", () =>
    Effect.gen(function* () {
      for (const dir of ["filedep", "filedep-override", "filedep-tarball", "filedep-joined", "filedep-suffixed"]) {
        assert.deepStrictEqual(theirs(dir, "peers-check-pnpm-11.json"), [], dir);
        assert.isAbove(theirs(dir).length, 0, dir);
        const parsed74 = yield* parse(dir);
        const report = PeerCheck.run(parsed74, {
          peerDependencyRules: NoPeerDependencyRules,
          workspacePackages: [probeA()],
        });
        assert.deepStrictEqual(report.unsatisfied, [], dir);
        assert.deepStrictEqual(report.unverified, ["peerVersionUnresolved"], dir);
      }
    })
  );

  it.effect("raises both reasons when neither the joined range nor the provider version can be named", () =>
    Effect.gen(function* () {
      const parsed75 = yield* parse("filedep-joined");
      const report = PeerCheck.run(parsed75, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA({ peerDependencies: { react: "workspace:*" } })],
      });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(report.unverified, ["peerRangeUnresolved", "peerVersionUnresolved"]);
    })
  );

  it.effect("still skips a plain unparseable, non-protocol provider version", () =>
    Effect.gen(function* () {
      const text = Str.replaceAll("file:vendor/react", "not-a-version")(fixture("peers/filedep/pnpm-lock.yaml"));
      const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
      assert.strictEqual(reactProvider(lockfile)?.version, "not-a-version");
      const report = PeerCheck.run(lockfile, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(report.unsatisfied, []);
      assert.deepStrictEqual(
        report.unverified,
        [],
        "junk that is not a protocol specifier is skipped without a marker"
      );
    })
  );

  it.effect("still accepts a workspace-row provider and still judges a semver provider", () =>
    Effect.gen(function* () {
      const parsed76 = yield* parse("workspacepeer");
      const workspace = PeerCheck.run(parsed76, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [
          probeA({ name: "react", version: "18.3.1", relativePath: "packages/fakereact", peerDependencies: {} }),
        ],
      });
      assert.deepStrictEqual(
        workspace.unsatisfied,
        [],
        "a workspace row (placeholder 0.0.0) stays accepted on name alone"
      );
      assert.deepStrictEqual(workspace.unverified, []);

      const parsed77 = yield* parse("mixed");
      const rows = PeerCheck.run(parsed77, { peerDependencyRules: NoPeerDependencyRules });
      assert.deepStrictEqual(
        ours(rows.unsatisfied),
        theirs("mixed"),
        "a semver provider is compared as before on the lockfile-row path"
      );
      assert.deepStrictEqual(rows.unverified, []);
      const parsed78 = yield* parse("linkdeep-bad");
      const joined = PeerCheck.run(parsed78, {
        peerDependencyRules: NoPeerDependencyRules,
        workspacePackages: [probeA()],
      });
      assert.deepStrictEqual(ours(joined.unsatisfied), theirs("linkdeep-bad"), "and on the joined path");
      assert.deepStrictEqual(joined.unverified, []);
    })
  );
});
