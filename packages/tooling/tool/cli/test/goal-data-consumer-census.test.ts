import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GlobSet } from "@beep/glob";
import {
  ciBinaryCommand,
  ciGoalDataConsumers,
  ciOperationalPatterns,
  isHeavyDocsOnlyPath,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";

// ROUT-03 slice 1 (goals/route-soundness-repair): the goal-data consumer census. It regenerates,
// from the tracked tree, every goals/ path a test reads, spawns or imports, or a package turbo.json
// declares, and proves each one stays on the code route under the committed CI patterns. The
// `ciGoalDataConsumers` rows in CiOperational.schemas.ts are the registry it checks; a new consumer
// that is not registered there fails the first test with its path and the file that reaches it.
//
// Root turbo.json `//#` tasks (knowledge, goals doctor, roadmap refs, reflection artifacts) declare
// goals/** as policy inputs; running that policy on docs-only and goals-only PRs is ROUT-02's
// docs-policy job, not this census.

// A test source or a package turbo.json: the two places a goal-data consumer is declared.
const TEST_SOURCE = /^(?:packages|apps|infra)\/.+\/test\/.+\.(?:[cm]?[jt]sx?|jsonc?|py)$/u;
const PACKAGE_TURBO = /^(?:packages|apps|infra)\/.+\/turbo\.json$/u;
// The syntactic shapes that reach a real repository file: a path relative to the test file
// (`new URL("../../../../goals/...")`, `import.meta.glob`), a path joined under an interpolated
// root (`${root}/goals/...`), and a Turbo input anchored at the repository root.
const READ_SHAPES: ReadonlyArray<RegExp> = [
  /(?:\.\.\/)+(goals\/[^"'`\s),]*)/gu,
  /\$\{[\w.()]+\}\/(goals\/[^"'`\s),]*)/gu,
  /\$TURBO_ROOT\$\/(goals\/[^"'`\s),]*)/gu,
];
const NAMED_PACKET = /^goals\/[^/]+\//u;
const GLOB_CHARACTER = /[*?[{]/u;

// Census entries every scan finds but that belong to the packet-document route, not this one.
class CensusExclusion extends S.Opaque<CensusExclusion, { readonly brand: unique symbol }>()(
  S.Struct({ reference: S.NonEmptyString, source: S.NonEmptyString, reason: S.NonEmptyString })
) {}
const exclusions: ReadonlyArray<CensusExclusion> = [
  CensusExclusion.make({
    reference: "goals/*/ops/manifest.json",
    source: "packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts",
    reason:
      "packet manifests are goal documents (CiGoalDocument); packet policy on goals-only PRs is ROUT-02's docs-policy job",
  }),
];

// One census finding: a consumed tracked path and the source file whose reference reaches it.
class CensusEntry extends S.Opaque<CensusEntry, { readonly brand: unique symbol }>()(
  S.Struct({ path: S.NonEmptyString, reference: S.NonEmptyString, source: S.NonEmptyString })
) {}

// A `${...}` placeholder ends the literal: what precedes it is a directory the consumer reads under.
const literalPrefix = (reference: string): string => Str.replace(/[^/]*\$\{.*$/u, "")(reference);

const resolveReference = Effect.fnUntraced(function* (reference: string, goalPaths: ReadonlyArray<string>) {
  const literal = literalPrefix(reference);
  // A placeholder before the packet segment names no packet: a synthetic fixture, not a read.
  if (!NAMED_PACKET.test(literal)) return A.empty<string>();
  if (GLOB_CHARACTER.test(literal)) {
    const globs = yield* GlobSet.compile([literal]);
    return A.filter(goalPaths, (path) => globs.matches(path));
  }
  return Str.endsWith("/")(literal)
    ? A.filter(goalPaths, Str.startsWith(literal))
    : A.filter(goalPaths, (path) => path === literal);
});

const scanSource = (text: string): ReadonlyArray<string> =>
  A.dedupe(
    A.flatMap(READ_SHAPES, (shape) => A.map(A.fromIterable(Str.matchAll(shape)(text)), (match) => match[1] ?? ""))
  );

const isExcluded = (entry: CensusEntry): boolean =>
  A.some(exclusions, (exclusion) => exclusion.reference === entry.reference && exclusion.source === entry.source);

const trackedFiles = Effect.gen(function* () {
  const root = yield* findRepoRoot();
  const git = yield* Git;
  const entries = yield* git.lsFiles(root);
  return { root, paths: A.dedupe(A.map(entries, (entry) => entry.path)) };
});

const census = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { root, paths } = yield* trackedFiles;
  const goalPaths = A.filter(paths, Str.startsWith("goals/"));
  const sources = A.filter(paths, (file) => TEST_SOURCE.test(file) || PACKAGE_TURBO.test(file));
  const perSource = yield* Effect.forEach(
    sources,
    (source) =>
      fs.readFileString(path.join(root, source)).pipe(
        Effect.flatMap((text) =>
          Effect.forEach(scanSource(text), (reference) =>
            Effect.map(resolveReference(reference, goalPaths), (resolved) =>
              A.map(resolved, (consumed) => CensusEntry.make({ path: consumed, reference, source }))
            )
          )
        ),
        Effect.map(A.flatten)
      ),
    { concurrency: 32 }
  );
  return { root, paths, entries: A.flatten(perSource) };
});

const pathPattern = (pattern: string): RegExp => new RegExp(pattern, "u");

// The mutations the packet names: malform the frozen citation fixture, a citation ops `.py` probe
// and a ciops research JSON; the fourth, a `.ts` ops script, is the first tracked one the census
// finds. Each is a one-path pull request diff.
const mutations: ReadonlyArray<readonly [string, string]> = [
  [
    "frozen citation profile fixture",
    "goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
  ],
  ["citation ops .py probe", "goals/citation-extraction-engine/ops/probe-html-bytes.py"],
  ["ciops research JSON", "goals/time-to-certainty/research/gate-order-handoff.json"],
];

// Before ROUT-03 the code route was the product roots alone; every goal-packet path was docs-only.
const preRepairDocsOnly = new RegExp(
  `^(?!^(packages|apps|infra)/)(?:${ciOperationalPatterns.goals}|.*(?:${ciOperationalPatterns.docs}))`,
  "u"
);

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

it.layer(Layer.provideMerge(Git.layer, NodeServices.layer), { timeout: "120 seconds" })(
  "goal-data consumer census (ROUT-03)",
  (it) => {
    it.effect(
      "keeps every goals/ path a test reads, spawns or imports, or a package turbo.json declares, off docs-only",
      Effect.fnUntraced(function* () {
        const { entries } = yield* census;
        const consumed = A.filter(entries, (entry) => !isExcluded(entry));
        const docsOnly = A.map(
          A.filter(consumed, (entry) => isHeavyDocsOnlyPath(entry.path)),
          (entry) => `${entry.path} <- ${entry.source} (${entry.reference}); register it in ciGoalDataConsumers`
        );
        expect(docsOnly).toEqual([]);
        // The census reaches every consumer family the packet names.
        const consumedPaths = HashSet.fromIterable(A.map(consumed, (entry) => entry.path));
        for (const [, mutated] of mutations) {
          expect(HashSet.has(consumedPaths, mutated), mutated).toBe(true);
        }
        expect(A.some(consumed, (entry) => /^goals\/[^/]+\/ops\/.+\.ts$/u.test(entry.path))).toBe(true);
        // Every exclusion is still found by the scan, and covers only goal documents.
        for (const exclusion of exclusions) {
          const excluded = A.filter(entries, isExcluded);
          expect(
            A.some(excluded, (entry) => entry.reference === exclusion.reference),
            exclusion.reference
          ).toBe(true);
          expect(
            A.filter(excluded, (entry) => !pathPattern(ciOperationalPatterns.goals).test(entry.path)),
            exclusion.reference
          ).toEqual([]);
        }
      })
    );

    it.effect(
      "keeps each consumer row live: it matches census paths and its evidence still reaches them",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, paths, entries } = yield* census;
        const tracked = HashSet.fromIterable(paths);
        const consumedPaths = A.map(
          A.filter(entries, (entry) => !isExcluded(entry)),
          (entry) => entry.path
        );
        for (const row of ciGoalDataConsumers) {
          const pattern = pathPattern(row.pattern);
          expect(
            A.some(consumedPaths, (consumed) => pattern.test(consumed)),
            row.pattern
          ).toBe(true);
          for (const evidence of row.evidence) {
            expect(HashSet.has(tracked, evidence), evidence).toBe(true);
            const text = yield* fs.readFileString(path.join(root, evidence));
            expect(Str.includes(row.reference)(text), `${evidence} reaches ${row.reference}`).toBe(true);
          }
        }
        // The projection joins every row into codeRoots, and none of them was docs-only by accident.
        for (const row of ciGoalDataConsumers) {
          expect(Str.includes(row.pattern)(ciOperationalPatterns.codeRoots), row.pattern).toBe(true);
        }
      })
    );

    it.effect(
      "selects the code route through change-profile for each mutated consumer that was docs-only before",
      Effect.fnUntraced(function* () {
        const { paths } = yield* census;
        const opsScript = A.findFirst(paths, (file) => /^goals\/[^/]+\/ops\/.+\.ts$/u.test(file));
        assertTrue(opsScript.pipe(O.isSome));
        const named = A.append(mutations, ["`.ts` ops script", O.getOrElse(opsScript, () => "")] as const);
        for (const [label, mutated] of named) {
          expect(A.contains(paths, mutated), `${label}: ${mutated} is tracked`).toBe(true);
          expect(preRepairDocsOnly.test(mutated), `${label} was docs-only before ROUT-03`).toBe(true);
          const profile = yield* changeProfileFor(mutated);
          expect(profile, label).toBe("goals_only=false\ndocs_only=false\ndesktop_rust_relevant=false");
        }
        // Control: prose beside a consumed path keeps the docs-only skip.
        const control = yield* changeProfileFor("goals/citation-extraction-engine/history/evidence/README.md");
        expect(control).toBe("goals_only=false\ndocs_only=true\ndesktop_rust_relevant=false");
      })
    );
  }
);
