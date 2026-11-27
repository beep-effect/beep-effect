import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GlobSet } from "@beep/glob";
import {
  CiGoalDataConsumer,
  CiGoalDocument,
  ciBinaryCommand,
  ciGoalDataConsumers,
  ciOperationalPatterns,
  isHeavyDocsOnlyPath,
} from "@beep/repo-cli/commands/Ci";
import {
  CheckoutInventory,
  checkoutWorkspaceOf,
  loadCheckoutInventory,
  packetRootsOf,
  packetSubjectOf,
  prunedCheckoutSubjects,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { productLeaves } from "@beep/repo-cli-kit/ProductLeaves";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { skipWhenPruned } from "./support/CheckoutSkip.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { CheckoutSubject } from "@beep/repo-cli-kit/CheckoutSubject";

// ROUT-03 (goals/route-soundness-repair): the packet-data consumer census. It regenerates, from
// the tracked tree, every goals/ and explorations/ path a test reads, spawns or imports, or a
// package turbo.json declares, and proves each one stays on the code route under the committed CI
// patterns. The `ciGoalDataConsumers` rows in CiOperational.schemas.ts are the registry it checks;
// a new consumer that is not registered there fails the first test with its path and the file that
// reaches it.
//
// Root turbo.json `//#` tasks (knowledge, goals doctor, roadmap refs, reflection artifacts) declare
// goals/** as policy inputs; running that policy on docs-only and goals-only PRs is ROUT-02's
// docs-policy job, not this census.

// A test source or a package turbo.json: the two places a packet-data consumer is declared.
const TEST_SOURCE = /^(?:packages|apps|infra)\/.+\/test\/.+\.(?:[cm]?[jt]sx?|jsonc?|py)$/u;
const TEST_CODE = /\.(?:[cm]?[jt]sx?)$/u;
const PACKAGE_TURBO = /^(?:packages|apps|infra)\/.+\/turbo\.json$/u;
// Product and lab source that names packet paths its tests then read from the real repository,
// such as @beep/ciops pinning its KPI inputs in src/kpi/Pins.ts. Repo tooling under
// packages/tooling names packet paths as the targets of its own commands (doctor, laws, harvest,
// route corpus); its tests read them from temp roots, so its src stays out of this scan.
const PINNED_SOURCE = /^(?:packages|apps|infra)\/.+\/src\/.+\.(?:[cm]?[jt]sx?)$/u;
const REPO_TOOLING = /^packages\/tooling\//u;
// JSDoc and line comments mention packet paths as prose, never as reads.
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*)/u;
const PACKET_ROOT = /^(?:goals|explorations)\//u;
// The syntactic shapes that reach a real repository file: a path relative to the test file
// (`new URL("../../../../goals/...")`, `import.meta.glob`), a path joined under an interpolated
// root (`${root}/goals/...`), and a Turbo input anchored at the repository root.
const READ_SHAPES: ReadonlyArray<RegExp> = [
  /(?:\.\.\/)+((?:goals|explorations)\/[^"'`\s),]*)/gu,
  /\$\{[\w.()]+\}\/((?:goals|explorations)\/[^"'`\s),]*)/gu,
  /(?<!!)\$TURBO_ROOT\$\/((?:goals|explorations)\/[^"'`\s),]*)/gu,
];
const NEGATED_TURBO_INPUT = /!\$TURBO_ROOT\$\/((?:goals|explorations)\/[^"'`\s),]*)/gu;
const TURBO_ROOT_INPUT = /^(!?)\$TURBO_ROOT\$\//u;
const ROUT_09_FIXTURE = "packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json";
// A bare string literal in test code, as `path.join(repoRoot, "goals/...")` passes it. Test code
// also names packet paths as data (synthetic temp trees, classifier rows), so this shape only
// counts a literal that resolves to tracked files, and never one that names a single packet
// document: prose and manifests are packet policy, which ROUT-02's docs-policy job runs.
const BARE_LITERAL = /["'`]((?:goals|explorations)\/[^"'`\s),]*)/gu;
const PACKET_DOCUMENT = /(?:\.md|\/ops\/manifest\.json|\/\.gitkeep)$/u;
const NAMED_PACKET = /^(?:goals|explorations)\/[^/]+\//u;
const GLOB_CHARACTER = /[*?[{]/u;

// Test files whose packet-path literals are classifier inputs, never reads.
const CLASSIFIER_TABLES: ReadonlyArray<string> = [
  "packages/tooling/tool/cli/test/ci-heavy-admission.test.ts",
  "packages/tooling/tool/cli/test/coverage-scope-goal-readers.test.ts",
  "packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts",
];

// Census entries a scan finds that are not code-route reads, each with the reason and the workspace
// package that owns its source.
class CensusExclusion extends S.Opaque<CensusExclusion, { readonly brand: unique symbol }>()(
  S.Struct({
    reference: S.NonEmptyString,
    source: S.NonEmptyString,
    owner: S.NonEmptyString,
    kind: S.Literals(["packet-document", "synthetic-fixture"]),
    reason: S.NonEmptyString,
  })
) {}
const exclusions: ReadonlyArray<CensusExclusion> = [
  CensusExclusion.make({
    reference: "goals/*/ops/manifest.json",
    source: "packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts",
    owner: "@beep/repo-cli",
    kind: "packet-document",
    reason:
      "packet manifests are goal documents (CiGoalDocument); packet policy on goals-only PRs is ROUT-02's docs-policy job",
  }),
  CensusExclusion.make({
    reference: "goals/_template/",
    source: "packages/tooling/tool/cli/test/commands/Goals/Harvest.test.ts",
    owner: "@beep/repo-cli",
    kind: "synthetic-fixture",
    reason: "asserts the harvester skips template rows of a temp tree it builds",
  }),
  CensusExclusion.make({
    reference: "goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json",
    source: "packages/tooling/tool/cli/test/ci-cache-pilot.test.ts",
    owner: "@beep/repo-cli",
    kind: "synthetic-fixture",
    reason: "the test writes its own copy into a temp root",
  }),
  CensusExclusion.make({
    reference: "goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json",
    source: "packages/tooling/tool/cli/test/ci-cache-pilot-in-process.test.ts",
    owner: "@beep/repo-cli",
    kind: "synthetic-fixture",
    reason: "the test writes its own copy into a temp root",
  }),
  CensusExclusion.make({
    reference: "explorations/beep-ci-operational-ontology/research",
    source: "apps/labs/ciops/test/kpi-reading.test.ts",
    owner: "@beep/ciops",
    kind: "synthetic-fixture",
    reason:
      "this hit is the directory the test creates under a temp root; its real reads go through the src/kpi/Pins.ts constants, which the pinned-source scan reports",
  }),
  CensusExclusion.make({
    reference: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
    source: "apps/labs/ciops/test/kpi-contract.test.ts",
    owner: "@beep/ciops",
    kind: "synthetic-fixture",
    reason: "contract data with a placeholder digest; the file is never read",
  }),
  CensusExclusion.make({
    reference: "explorations/stacked-pr-adoption/research/",
    source: "packages/tooling/tool/cli/test/support/YeetHeadMove.ts",
    owner: "@beep/repo-cli",
    kind: "synthetic-fixture",
    reason: "the head-move harness inits its own temp repository and writes stack-probe files under this prefix",
  }),
];

// One census finding: a consumed tracked path and the source file whose reference reaches it.
class CensusEntry extends S.Opaque<CensusEntry, { readonly brand: unique symbol }>()(
  S.Struct({ path: S.NonEmptyString, reference: S.NonEmptyString, source: S.NonEmptyString })
) {}

// A `${...}` placeholder ends the literal: what precedes it is a directory the consumer reads under.
// The route lines of a change profile: the per-lane relevance lines that follow depend on which
// consumer was mutated, while this census asserts only the docs-only route.
const routeLines = (profile: string): string => A.join(A.take(Str.split(profile, "\n"), 3), "\n");

const literalPrefix = (reference: string): string => Str.replace(/[^/]*\$\{.*$/u, "")(reference);

// A literal is a file, a directory (with or without its trailing slash) or a glob.
const resolveReference = Effect.fnUntraced(function* (reference: string, packetPaths: ReadonlyArray<string>) {
  const literal = literalPrefix(reference);
  // A placeholder before the packet segment names no packet: a synthetic fixture, not a read.
  if (!NAMED_PACKET.test(literal)) return A.empty<string>();
  if (GLOB_CHARACTER.test(literal)) {
    const globs = yield* GlobSet.compile([literal]);
    return A.filter(packetPaths, (path) => globs.matches(path));
  }
  const directory = Str.endsWith("/")(literal) ? literal : `${literal}/`;
  return A.filter(packetPaths, (path) => path === literal || Str.startsWith(directory)(path));
});

const matches = (shape: RegExp, text: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(Str.matchAll(shape)(text)), (match) => match[1] ?? "");

const isPinnedSource = (source: string): boolean => PINNED_SOURCE.test(source) && !REPO_TOOLING.test(source);

const codeLines = (text: string): string =>
  A.join(
    A.filter(Str.split(text, "\n"), (line) => !COMMENT_LINE.test(line)),
    "\n"
  );

// Source modules contribute only their bare path constants; tests and turbo.json every shape.
const scanSource = (source: string, text: string): ReadonlyArray<readonly [string, boolean]> =>
  isPinnedSource(source)
    ? A.map(A.dedupe(matches(BARE_LITERAL, codeLines(text))), (reference) => [reference, true] as const)
    : scanTestSource(source, text);

const scanTestSource = (source: string, text: string): ReadonlyArray<readonly [string, boolean]> =>
  A.dedupeWith(
    A.appendAll(
      A.map(
        A.flatMap(READ_SHAPES, (shape) => matches(shape, text)),
        (reference) => [reference, false] as const
      ),
      TEST_CODE.test(source) && !A.contains(CLASSIFIER_TABLES, source)
        ? A.map(matches(BARE_LITERAL, text), (reference) => [reference, true] as const)
        : A.empty<readonly [string, boolean]>()
    ),
    ([left], [right]) => left === right
  );

// A bare literal that names a single packet document is path data, not a code-route read.
const keepResolved = (bare: boolean, resolved: ReadonlyArray<string>): ReadonlyArray<string> =>
  bare && A.length(resolved) === 1 && A.every(resolved, (path) => PACKET_DOCUMENT.test(path))
    ? A.empty<string>()
    : resolved;

const isExcluded = (entry: CensusEntry): boolean =>
  A.some(exclusions, (exclusion) => exclusion.reference === entry.reference && exclusion.source === entry.source);

const trackedFiles = Effect.gen(function* () {
  const root = yield* findRepoRoot();
  const git = yield* Git;
  const entries = yield* git.lsFiles(root);
  return { root, paths: A.dedupe(A.map(entries, (entry) => entry.path)) };
});

const negatedTurboPaths = Effect.fnUntraced(function* (
  source: string,
  text: string,
  packetPaths: ReadonlyArray<string>
) {
  if (!PACKAGE_TURBO.test(source)) return HashSet.empty<string>();
  const negated = yield* Effect.forEach(
    matches(NEGATED_TURBO_INPUT, text),
    (reference) => resolveReference(reference, packetPaths),
    { concurrency: 1 }
  );
  return HashSet.fromIterable(A.flatten(negated));
});

const census = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { root, paths } = yield* trackedFiles;
  const packetPaths = A.filter(paths, (file) => PACKET_ROOT.test(file));
  const sources = A.filter(paths, (file) => TEST_SOURCE.test(file) || PACKAGE_TURBO.test(file) || isPinnedSource(file));
  const perSource = yield* Effect.forEach(
    sources,
    (source) =>
      fs.readFileString(path.join(root, source)).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (text) {
            const negated = yield* negatedTurboPaths(source, text, packetPaths);
            return yield* Effect.forEach(
              scanSource(source, text),
              ([reference, bare]) =>
                Effect.map(resolveReference(reference, packetPaths), (resolved) =>
                  A.map(
                    A.filter(keepResolved(bare, resolved), (consumed) => !HashSet.has(negated, consumed)),
                    (consumed) => CensusEntry.make({ path: consumed, reference, source })
                  )
                ),
              { concurrency: 1 }
            );
          })
        ),
        Effect.map(A.flatten)
      ),
    { concurrency: 32 }
  );
  return { root, paths, entries: A.flatten(perSource) };
});

const pathPattern = (pattern: string): RegExp => new RegExp(pattern, "u");

const isGoalDocument = S.is(CiGoalDocument);

// The coverage planner selects a goal or exploration path's owners from these rows
// (CoverageScope.ts `goalDataConsumerNamesForFile`), so each census reader must be listed here.
const registryRows = A.map(ciGoalDataConsumers, (row) => ({
  pattern: pathPattern(row.pattern),
  consumers: row.consumers,
}));
const registryReadersOf = (consumed: string): ReadonlyArray<string> =>
  pipe(
    registryRows,
    A.filter((row) => row.pattern.test(consumed)),
    A.flatMap((row) => row.consumers)
  );

// The nearest ancestor directory of a census source that holds a tracked package.json. A
// `src/test/*.test-kit.ts` source is owned by its package, not by the directory before `/test/`.
const owningPackageDirectory = (source: string, tracked: HashSet.HashSet<string>): O.Option<string> => {
  const segments = A.dropRight(Str.split("/")(source), 1);
  return A.findFirst(
    A.makeBy(A.length(segments), (index) => A.join(A.take(segments, A.length(segments) - index), "/")),
    (directory) => HashSet.has(tracked, `${directory}/package.json`)
  );
};

const decodePackageName = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ name: S.NonEmptyString })));

const decodePackageTurbo = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      tasks: S.Record(S.String, S.Struct({ inputs: S.Array(S.String).pipe(S.optionalKey) })),
    })
  )
);

const declaredTestInputs = Effect.fnUntraced(function* (turboPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(turboPath);
  const turbo = yield* decodePackageTurbo(text);
  return pipe(
    R.get(turbo.tasks, "test"),
    O.flatMapNullishOr((task) => task.inputs),
    O.getOrElse(A.empty<string>)
  );
});

const testInputGlobs = Effect.fnUntraced(function* (root: string, directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const turboPath = path.join(root, directory, "turbo.json");
  const present = yield* fs.exists(turboPath);
  const inputs = present ? yield* declaredTestInputs(turboPath) : A.empty<string>();
  const rootInputs = A.filterMap(inputs, (input) =>
    TURBO_ROOT_INPUT.test(input) ? Result.succeed(Str.replace(TURBO_ROOT_INPUT, "$1")(input)) : Result.failVoid
  );
  return yield* GlobSet.compile(A.isReadonlyArrayNonEmpty(rootInputs) ? rootInputs : ["!**"]);
});

// The mutations the packet names: malform the frozen citation fixture, the spawned citation
// ops child and a ciops research JSON (the `.ts` ops script is the first tracked one the census finds), plus
// the runner-burst script and the two exploration fixtures the post-merge review found. Each is a
// one-path pull request diff.
const mutations: ReadonlyArray<readonly [string, string]> = [
  [
    "frozen citation profile fixture",
    "goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
  ],
  ["citation ops spawned child", "goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs"],
  ["ciops research JSON", "goals/time-to-certainty/research/gate-order-handoff.json"],
  ["runner-burst ops script", "goals/speed-loop/ops/runner-burst/teardown-burst-runners.sh"],
  ["ciops exploration ABox", "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl"],
  ["ontology exploration manifest", "explorations/legal-ontology-landscape/assets/manifest.jsonl"],
  ["ciops KPI change-event ledger", "explorations/beep-ci-operational-ontology/research/control-interventions.yaml"],
];

// Before ROUT-03 the code route was the product roots alone; every goal-packet path was docs-only.
const preRepairDocsOnly = new RegExp(
  `^(?!^(packages|apps|infra)/)(?:${ciOperationalPatterns.goals}|.*(?:${ciOperationalPatterns.docs}))`,
  "u"
);

const CITATION_MANIFEST = "goals/citation-extraction-engine/ops/manifest.json";

const runCi = Command.runWith(ciBinaryCommand, { version: "0.0.0" });
const BASE_SHA = Str.repeat(40)("a");
const HEAD_SHA = Str.repeat(40)("b");
const pullRequest = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({
    GITHUB_EVENT_NAME: "pull_request",
    BEEP_CI_PR_BASE_SHA: BASE_SHA,
    BEEP_CI_PR_HEAD_SHA: HEAD_SHA,
  })
);

// `beep ci change-profile` over a scripted one-path diff, read against the committed patterns file.
const changeProfileFor = Effect.fnUntraced(function* (changed: string) {
  const spawner = ScriptedSpawner.make((command) => (command === "git" ? { stdout: `${changed}\n` } : { exit: 1 }));
  const earlier = yield* TestConsole.logLines;
  yield* runCi(["ci", "change-profile"]).pipe(pullRequest, provideSpawner(spawner));
  const all = yield* TestConsole.logLines;
  const logged = A.map(A.drop(all, A.length(earlier)), (line) => `${line}`);
  expect(A.map(spawner.spawns, ({ command, args }) => [command, ...args])).toEqual([
    ["git", "diff", "--name-only", "--no-renames", `${BASE_SHA}...${HEAD_SHA}`],
  ]);
  return A.join(logged, "\n");
});

// The checkout-subject rule (goals/prunable-product-leaves, seam 1). A row reads one packet's paths
// for its consumer packages, so it depends on that packet and on those workspaces. A checkout that
// pruned the packet, or every consumer, holds nothing the row could prove: the row is skipped and
// the skip names what was pruned. "Pruned" means a declared product leaf whose directory is gone
// (@beep/repo-cli-kit/ProductLeaves); an absent subject nobody declared is a typo or a rename, and
// its row is checked and fails as before. An evidence file the checkout does not track is stale
// unless it lies under the declared directory of one of the row's pruned consumers; then it
// belonged to that consumer.
const rowAbsence = (inventory: CheckoutInventory, row: CiGoalDataConsumer): ReadonlyArray<CheckoutSubject> => {
  const packet = prunedCheckoutSubjects(inventory, A.fromOption(packetSubjectOf(row.reference)));
  if (A.isReadonlyArrayNonEmpty(packet)) {
    return packet;
  }
  const consumers = A.map(row.consumers, workspaceSubject);
  const prunedConsumers = prunedCheckoutSubjects(inventory, consumers);
  return A.length(prunedConsumers) === A.length(consumers) ? prunedConsumers : A.empty();
};

const evidenceAbsence = (
  inventory: CheckoutInventory,
  tracked: HashSet.HashSet<string>,
  row: CiGoalDataConsumer,
  evidence: string
): ReadonlyArray<CheckoutSubject> =>
  HashSet.has(tracked, evidence) || O.isSome(checkoutWorkspaceOf(inventory, evidence))
    ? A.empty()
    : A.map(
        A.filter(row.consumers, (consumer) =>
          O.exists(HashMap.get(inventory.prunedWorkspaces, consumer), (directory) =>
            Str.startsWith(`${directory}/`)(evidence)
          )
        ),
        workspaceSubject
      );

// A mutated path depends on what the row that registers it depends on.
const mutationAbsence = (inventory: CheckoutInventory, mutated: string): ReadonlyArray<CheckoutSubject> =>
  pipe(
    A.findFirst(ciGoalDataConsumers, (row) => pathPattern(row.pattern).test(mutated)),
    O.map((row) => rowAbsence(inventory, row)),
    O.getOrElse(() => A.empty<CheckoutSubject>())
  );

const exclusionAbsence = (inventory: CheckoutInventory, exclusion: CensusExclusion): ReadonlyArray<CheckoutSubject> =>
  prunedCheckoutSubjects(inventory, [
    workspaceSubject(exclusion.owner),
    ...A.fromOption(packetSubjectOf(exclusion.reference)),
  ]);

// The census and the checkout inventory, read once and shared by every test below.
class CensusFacts extends Context.Service<
  CensusFacts,
  {
    readonly root: string;
    readonly paths: ReadonlyArray<string>;
    readonly tracked: HashSet.HashSet<string>;
    readonly entries: ReadonlyArray<CensusEntry>;
    readonly inventory: CheckoutInventory;
  }
>()("@beep/repo-cli/test/goal-data-consumer-census.test/CensusFacts") {}

const CensusFactsLive = Layer.effect(
  CensusFacts,
  Effect.gen(function* () {
    const scanned = yield* census;
    const inventory = yield* loadCheckoutInventory(scanned.root, productLeaves);
    return { ...scanned, tracked: HashSet.fromIterable(scanned.paths), inventory };
  })
);

const consumedPathsOf = (entries: ReadonlyArray<CensusEntry>): ReadonlyArray<string> =>
  A.map(
    A.filter(entries, (entry) => !isExcluded(entry)),
    (entry) => entry.path
  );

it.layer(Layer.provideMerge(CensusFactsLive, Layer.provideMerge(Git.layer, NodeServices.layer)), {
  timeout: "120 seconds",
})("goal-data consumer census (ROUT-03)", (it) => {
  it.effect(
    "keeps every goals/ path a test reads, spawns or imports, or a package turbo.json declares, off docs-only",
    Effect.fnUntraced(function* () {
      const { entries } = yield* CensusFacts;
      const consumed = A.filter(entries, (entry) => !isExcluded(entry));
      const docsOnly = A.map(
        A.filter(consumed, (entry) => isHeavyDocsOnlyPath(entry.path)),
        (entry) => `${entry.path} <- ${entry.source} (${entry.reference}); register it in ciGoalDataConsumers`
      );
      expect(docsOnly).toEqual([]);
      expect(A.some(consumed, (entry) => /^goals\/[^/]+\/ops\/.+\.ts$/u.test(entry.path))).toBe(true);
    })
  );

  // The census reaches every consumer family the packet names.
  for (const [label, mutated] of mutations) {
    it.effect(`tracks and consumes the ${label}`, (ctx) =>
      Effect.gen(function* () {
        const { entries, inventory, tracked } = yield* CensusFacts;
        skipWhenPruned(ctx, mutationAbsence(inventory, mutated));
        expect(HashSet.has(tracked, mutated), `${label}: ${mutated} is tracked`).toBe(true);
        expect(A.contains(consumedPathsOf(entries), mutated), mutated).toBe(true);
      })
    );
  }

  // Every exclusion is still found by the scan from its own source; a packet-document exclusion
  // covers only goal documents.
  for (const exclusion of exclusions) {
    it.effect(`still finds the ${exclusion.kind} exclusion ${exclusion.reference} in ${exclusion.source}`, (ctx) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, entries, inventory, tracked } = yield* CensusFacts;
        skipWhenPruned(ctx, exclusionAbsence(inventory, exclusion));
        // The hand-written owner must be the package that owns the source, so it cannot drift.
        const directory = owningPackageDirectory(exclusion.source, tracked);
        assertTrue(O.isSome(directory), exclusion.source);
        const text = yield* fs.readFileString(
          path.join(
            root,
            O.getOrElse(directory, () => ""),
            "package.json"
          )
        );
        const manifest = yield* decodePackageName(text);
        expect(manifest.name, exclusion.source).toBe(exclusion.owner);
        const excluded = A.filter(
          entries,
          (entry) => entry.reference === exclusion.reference && entry.source === exclusion.source
        );
        expect(A.isReadonlyArrayNonEmpty(excluded), `${exclusion.source}: ${exclusion.reference}`).toBe(true);
        if (exclusion.kind === "packet-document") {
          expect(
            A.filter(excluded, (entry) => !pathPattern(ciOperationalPatterns.goals).test(entry.path)),
            exclusion.reference
          ).toEqual([]);
        }
      })
    );
  }

  // Each consumer row stays live: it matches census paths and its evidence still reaches them.
  for (const row of ciGoalDataConsumers) {
    it.effect(`keeps the ${row.reference} row matching census paths`, (ctx) =>
      Effect.gen(function* () {
        const { entries, inventory } = yield* CensusFacts;
        skipWhenPruned(ctx, rowAbsence(inventory, row));
        const pattern = pathPattern(row.pattern);
        expect(
          A.some(consumedPathsOf(entries), (consumed) => pattern.test(consumed)),
          row.pattern
        ).toBe(true);
      })
    );
    for (const evidence of row.evidence) {
      it.effect(`keeps ${evidence} reaching the ${row.reference} row`, (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { root, inventory, tracked } = yield* CensusFacts;
          skipWhenPruned(ctx, rowAbsence(inventory, row));
          skipWhenPruned(ctx, evidenceAbsence(inventory, tracked, row, evidence));
          expect(HashSet.has(tracked, evidence), evidence).toBe(true);
          const text = yield* fs.readFileString(path.join(root, evidence));
          expect(Str.includes(row.reference)(text), `${evidence} reaches ${row.reference}`).toBe(true);
        })
      );
    }
  }

  // The projection joins every row into codeRoots, and none of them was docs-only by accident.
  it.effect("joins every consumer row into codeRoots", () =>
    Effect.sync(() => {
      for (const row of ciGoalDataConsumers) {
        expect(Str.includes(row.pattern)(ciOperationalPatterns.codeRoots), row.pattern).toBe(true);
      }
    })
  );

  it.effect(
    "lists every reader package as a consumer of the row matching its path, and no turbo.json packet document",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, tracked, entries } = yield* CensusFacts;
      const consumed = A.filter(entries, (entry) => !isExcluded(entry));
      const ownerRows = yield* Effect.forEach(
        A.dedupe(A.map(consumed, (entry) => entry.source)),
        Effect.fnUntraced(function* (source) {
          const directory = owningPackageDirectory(source, tracked);
          if (O.isNone(directory)) return [source, O.none<string>()] as const;
          const text = yield* fs.readFileString(path.join(root, directory.value, "package.json"));
          const manifest = yield* decodePackageName(text);
          return [source, O.some(manifest.name)] as const;
        }),
        { concurrency: 1 }
      );
      const owners = HashMap.fromIterable(ownerRows);
      // The coverage planner selects a registry path's readers from its row's consumers, so a
      // reader package missing from them would leave that path's tests out of coverage.
      const unlisted = A.filterMap(consumed, (entry) => {
        const owner = O.flatten(HashMap.get(owners, entry.source));
        const readers = registryReadersOf(entry.path);
        return O.exists(owner, (name) => A.contains(readers, name))
          ? Result.failVoid
          : Result.succeed(
              `${entry.path} <- ${entry.source} (${O.getOrElse(owner, () => "no package.json")}); add the package to the consumers of the ciGoalDataConsumers row matching the path (row consumers: ${A.isReadonlyArrayNonEmpty(readers) ? A.join(readers, ", ") : "none"})`
            );
      });
      expect(unlisted).toEqual([]);
      // Turbo would select a package for a packet-document edit that the planner treats as
      // noop, which makes hosted Test Unit stricter than local final-check.
      const turboPacketDocuments = A.map(
        A.filter(consumed, (entry) => PACKAGE_TURBO.test(entry.source) && isGoalDocument(entry.path)),
        (entry) => `${entry.path} <- ${entry.source} (${entry.reference}); a turbo.json input must name goal data`
      );
      expect(turboPacketDocuments).toEqual([]);
    })
  );

  it.effect(
    "declares every consumed path as a test input in its reader package's turbo.json",
    Effect.fnUntraced(function* () {
      const { root, tracked, entries } = yield* CensusFacts;
      const reads = A.filter(entries, (entry) => !isExcluded(entry) && !PACKAGE_TURBO.test(entry.source));
      const undeclared = yield* Effect.forEach(
        reads,
        Effect.fnUntraced(function* (entry) {
          const directory = owningPackageDirectory(entry.source, tracked);
          if (O.isNone(directory)) return O.some(`${entry.path} <- ${entry.source}: no owning package`);
          const globs = yield* testInputGlobs(root, directory.value);
          return globs.matches(entry.path)
            ? O.none<string>()
            : O.some(
                `${entry.path} <- ${entry.source}; add "$TURBO_ROOT$/${entry.path}" (or a glob over it) to the test inputs of ${directory.value}/turbo.json`
              );
        }),
        { concurrency: 8 }
      );
      expect(A.getSomes(undeclared)).toEqual([]);
    })
  );

  it.effect("declares the ROUT-09 use-cases fixture as a law-practice-server test input", (ctx) =>
    Effect.gen(function* () {
      const { root, inventory, tracked } = yield* CensusFacts;
      skipWhenPruned(
        ctx,
        prunedCheckoutSubjects(inventory, [
          workspaceSubject("@beep/law-practice-server"),
          workspaceSubject("@beep/law-practice-use-cases"),
        ])
      );
      expect(HashSet.has(tracked, ROUT_09_FIXTURE), ROUT_09_FIXTURE).toBe(true);
      const globs = yield* testInputGlobs(root, "packages/law-practice/server");
      expect(globs.matches(ROUT_09_FIXTURE)).toBe(true);
    })
  );

  it.effect("keeps a negated turbo input out of the consumed paths", () =>
    Effect.gen(function* () {
      const { root, entries } = yield* CensusFacts;
      const globs = yield* testInputGlobs(root, "packages/law-practice/server");
      expect(globs.matches(CITATION_MANIFEST)).toBe(false);
      expect(globs.matches("goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs")).toBe(true);
      expect(A.some(entries, (entry) => entry.path === CITATION_MANIFEST && PACKAGE_TURBO.test(entry.source))).toBe(
        false
      );
    })
  );

  // The route assertions classify a scripted one-path diff against the committed patterns, so
  // they hold whether or not the checkout still tracks the mutated path.
  it.effect(
    "selects the code route through change-profile for each mutated consumer that was docs-only before",
    Effect.fnUntraced(function* () {
      const { paths } = yield* CensusFacts;
      const opsScript = A.findFirst(paths, (file) => /^goals\/[^/]+\/ops\/.+\.ts$/u.test(file));
      assertTrue(opsScript.pipe(O.isSome));
      const named = A.append(mutations, ["`.ts` ops script", O.getOrElse(opsScript, () => "")] as const);
      for (const [label, mutated] of named) {
        expect(preRepairDocsOnly.test(mutated), `${label} was docs-only before ROUT-03`).toBe(true);
        const profile = yield* changeProfileFor(mutated);
        expect(routeLines(profile), label).toBe("goals_only=false\ndocs_only=false\ndesktop_rust_relevant=false");
      }
      // Control: prose beside a consumed path keeps the docs-only skip.
      const control = yield* changeProfileFor("goals/citation-extraction-engine/history/evidence/README.md");
      expect(routeLines(control)).toBe("goals_only=false\ndocs_only=true\ndesktop_rust_relevant=false");
    })
  );
});

// The rule itself, over a synthetic checkout that holds goals/demo and @beep/kept, pruned the
// product leaf @beep/leaf and the packet goals/leaf, and lacks @beep/typo and goals/typo, which
// nobody declared prunable. Every case that is stale while its subject exists, or whose subject is
// merely missing, must come back empty, which keeps its assertion running.
describe("the checkout-subject rule for census rows", () => {
  const inventory = CheckoutInventory.make({
    packets: packetRootsOf(["goals/demo/README.md"]),
    workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
    prunedPackets: packetRootsOf(["goals/leaf/README.md"]),
    prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
  });
  const demoRow = (reference: string, consumers: A.NonEmptyReadonlyArray<string>) =>
    CiGoalDataConsumer.make({
      pattern: `^${reference}`,
      reference,
      consumers,
      modes: ["read"],
      evidence: ["packages/kept/test/Demo.test.ts"],
    });
  const noTracked = HashSet.empty<string>();

  it("checks a row whose packet and consumers are present, or whose consumers are partly present", () => {
    expect(rowAbsence(inventory, demoRow("goals/demo/ops/", ["@beep/kept"]))).toEqual([]);
    expect(rowAbsence(inventory, demoRow("goals/demo/ops/", ["@beep/kept", "@beep/leaf"]))).toEqual([]);
    expect(rowAbsence(inventory, demoRow("goals/*/ops/**/*.ts", ["@beep/kept"]))).toEqual([]);
  });

  it("skips a row whose packet was pruned, or whose every consumer was pruned", () => {
    expect(rowAbsence(inventory, demoRow("goals/leaf/ops/", ["@beep/kept"]))).toEqual(
      A.fromOption(packetSubjectOf("goals/leaf/ops/"))
    );
    expect(rowAbsence(inventory, demoRow("goals/demo/ops/", ["@beep/leaf"]))).toEqual([workspaceSubject("@beep/leaf")]);
  });

  it("checks a row whose packet or consumer is missing without being declared prunable", () => {
    // A typo or a renamed package reads as missing, never as pruned, so the row still fails.
    expect(rowAbsence(inventory, demoRow("goals/typo/ops/", ["@beep/kept"]))).toEqual([]);
    expect(rowAbsence(inventory, demoRow("goals/demo/ops/", ["@beep/typo"]))).toEqual([]);
    expect(rowAbsence(inventory, demoRow("goals/demo/ops/", ["@beep/leaf", "@beep/typo"]))).toEqual([]);
  });

  it("keeps an untracked evidence file stale inside a present workspace or when no consumer was pruned", () => {
    const row = demoRow("goals/demo/ops/", ["@beep/kept", "@beep/leaf"]);
    expect(evidenceAbsence(inventory, noTracked, row, "packages/kept/test/Renamed.test.ts")).toEqual([]);
    // A consumer that moved directories keeps its name, so its old evidence path is stale.
    const moved = demoRow("goals/demo/ops/", ["@beep/kept"]);
    expect(evidenceAbsence(inventory, noTracked, moved, "packages/old-home/test/Demo.test.ts")).toEqual([]);
    const missing = demoRow("goals/demo/ops/", ["@beep/kept", "@beep/typo"]);
    expect(evidenceAbsence(inventory, noTracked, missing, "packages/typo/test/Demo.test.ts")).toEqual([]);
    // Another consumer being pruned does not excuse a path outside that consumer's directory.
    expect(evidenceAbsence(inventory, noTracked, row, "packages/elsewhere/test/Demo.test.ts")).toEqual([]);
  });

  it("skips an untracked evidence file that belonged to a pruned consumer, and checks a tracked one", () => {
    const row = demoRow("goals/demo/ops/", ["@beep/kept", "@beep/leaf"]);
    expect(evidenceAbsence(inventory, noTracked, row, "packages/leaf/test/Demo.test.ts")).toEqual([
      workspaceSubject("@beep/leaf"),
    ]);
    const tracked = HashSet.make("packages/leaf/test/Demo.test.ts");
    expect(evidenceAbsence(inventory, tracked, row, "packages/leaf/test/Demo.test.ts")).toEqual([]);
  });

  it("skips an exclusion whose owner or packet was pruned, and checks every other", () => {
    const exclusion = (owner: string, reference: string) =>
      CensusExclusion.make({
        reference,
        source: "packages/kept/test/X.test.ts",
        owner,
        kind: "synthetic-fixture",
        reason: "demo",
      });
    expect(exclusionAbsence(inventory, exclusion("@beep/kept", "goals/demo/research/x.json"))).toEqual([]);
    expect(exclusionAbsence(inventory, exclusion("@beep/typo", "goals/demo/research/x.json"))).toEqual([]);
    expect(exclusionAbsence(inventory, exclusion("@beep/leaf", "goals/demo/research/x.json"))).toEqual([
      workspaceSubject("@beep/leaf"),
    ]);
    expect(exclusionAbsence(inventory, exclusion("@beep/kept", "goals/leaf/research/x.json"))).toEqual(
      A.fromOption(packetSubjectOf("goals/leaf/research/x.json"))
    );
  });

  it("registers every mutated path in exactly the row whose subjects it inherits", () => {
    for (const [label, mutated] of mutations) {
      expect(A.length(A.filter(ciGoalDataConsumers, (row) => pathPattern(row.pattern).test(mutated))), label).toBe(1);
    }
  });
});
