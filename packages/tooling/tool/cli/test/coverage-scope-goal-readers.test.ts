import { CiGoalDocument, ciGoalDataConsumers } from "@beep/repo-cli/commands/Ci";
import {
  CoverageScopeOwner,
  planCoverageAffectedScope,
  workspaceCoverageScopeOwners,
} from "@beep/repo-cli/test/Quality";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// D-cov (goals/goal-closeout-hosted-verification): a goal or exploration path selects coverage
// owners only through the ROUT-03 registry `ciGoalDataConsumers`, and a packet document
// (`CiGoalDocument`) selects nothing even under a registry prefix. Every path literal below is a
// planner input, never a read; the census lists this file in CLASSIFIER_TABLES.

const isGoalDocument = S.is(CiGoalDocument);

const owner = (packageName: string, packagePath: string) =>
  CoverageScopeOwner.make({ packageName, packagePath, hasCoverage: true });

// The six registry consumers at their real package paths, plus one ordinary package.
const owners = [
  owner("@beep/law-practice-server", "packages/law-practice/server"),
  owner("@beep/eyecite", "packages/drivers/eyecite"),
  owner("@beep/semantica", "apps/labs/semantica"),
  owner("@beep/ciops", "apps/labs/ciops"),
  owner("@beep/ontology", "packages/foundation/modeling/ontology"),
  owner("@beep/repo-cli", "packages/tooling/tool/cli"),
  owner("@beep/b", "packages/b"),
];

// #3101 (cbc647e52e8): five goals-only paths that ran repo-cli coverage for 46 minutes.
const PR_3101 = [
  "goals/alchemy-vault-sync-slice/README.md",
  "goals/alchemy-vault-sync-slice/SPEC.md",
  "goals/alchemy-vault-sync-slice/decisions/2026-11-10-third-goals-only-re-final-after-2962-merged-before-readiness.md",
  "goals/alchemy-vault-sync-slice/ops/manifest.json",
  "goals/alchemy-vault-sync-slice/research/OPPORTUNITIES.md",
];

const CITATION_MANIFEST = "goals/citation-extraction-engine/ops/manifest.json";

// One sample path per registry row, keyed by the row's pattern. The citation ops sample is an
// `.mjs` file so it does not also match the ops `.ts` row.
const SAMPLES: Readonly<Record<string, string>> = {
  "^goals/citation-extraction-engine/ops/": "goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs",
  "^goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile\\.frozen\\.json\\.txt$":
    "goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
  "^goals/semantica-canary/history/c2/full-w1\\.replay\\.eval-report\\.json$":
    "goals/semantica-canary/history/c2/full-w1.replay.eval-report.json",
  "^goals/time-to-certainty/research/economics\\.json$": "goals/time-to-certainty/research/economics.json",
  "^goals/time-to-certainty/research/gate-order-handoff\\.json$":
    "goals/time-to-certainty/research/gate-order-handoff.json",
  "^goals/speed-loop/ops/runner-burst/": "goals/speed-loop/ops/runner-burst/teardown-burst-runners.sh",
  "^explorations/beep-ci-operational-ontology/ontology/extraction/s6/(graphs/abox\\.ttl|snapshot/raw/journal\\.ndjson)$":
    "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
  "^explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/":
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/MANIFEST.yaml",
  "^explorations/beep-ci-operational-ontology/research/(control-interventions\\.yaml|evidence/journal-snapshot-2026-10-01/journal\\.redacted\\.ndjson)$":
    "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
  "^explorations/beep-ci-operational-ontology/ontology/docs/competency-questions\\.yaml$":
    "explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml",
  "^explorations/legal-ontology-landscape/assets/manifest\\.jsonl$":
    "explorations/legal-ontology-landscape/assets/manifest.jsonl",
  "^goals/[^/]+/ops/.+\\.ts$": "goals/demo-packet/ops/check-scope.ts",
};

// The planner's own expectation for one sample: every row whose pattern matches it contributes
// its consumers, deduplicated and sorted (CoverageScope.ts sorts selected owners by name).
const expectedReaders = (sample: string): ReadonlyArray<string> =>
  pipe(
    ciGoalDataConsumers,
    A.filter((row) => new RegExp(row.pattern, "u").test(sample)),
    A.flatMap((row) => row.consumers),
    A.dedupe,
    A.sort(Order.String)
  );

const NOOP = { _tag: "noop" };

describe("coverage owners for goal and exploration readers", () => {
  it("plans #3101's goals-only diff as noop", () => {
    expect(planCoverageAffectedScope(owners, PR_3101)).toEqual(NOOP);
  });

  it("plans a packet manifest alone as noop", () => {
    expect(planCoverageAffectedScope(owners, ["goals/demo-packet/ops/manifest.json"])).toEqual(NOOP);
  });

  it("plans a packet document under a registry prefix as noop", () => {
    expect(isGoalDocument(CITATION_MANIFEST)).toBe(true);
    expect(planCoverageAffectedScope(owners, [CITATION_MANIFEST])).toEqual(NOOP);
    expect(planCoverageAffectedScope(owners, ["goals/citation-extraction-engine/README.md"])).toEqual(NOOP);
  });

  it.each([
    "goals/demo-packet/ops/data.json",
    "goals/demo-packet/research/x.json",
    "goals/demo-packet/history/evidence/y.json",
    "goals/demo-packet/ops/run.sh",
  ])("plans unregistered packet data %s as noop", (file) => {
    expect(planCoverageAffectedScope(owners, [file])).toEqual(NOOP);
  });

  it("has exactly one sample per registry row, none of them a packet document", () => {
    expect(A.sort(R.keys(SAMPLES), Order.String)).toEqual(
      A.sort(
        A.map(ciGoalDataConsumers, (row) => row.pattern),
        Order.String
      )
    );
    expect(A.filter(R.values(SAMPLES), isGoalDocument)).toEqual([]);
  });

  it.each(R.toEntries(SAMPLES))("selects exactly the readers of %s", (_pattern, sample) => {
    const packageNames = expectedReaders(sample);
    expect(A.isReadonlyArrayNonEmpty(packageNames)).toBe(true);
    expect(planCoverageAffectedScope(owners, [sample])).toEqual({
      _tag: "selected",
      packageNames,
      dependentPackageNames: [],
    });
  });

  it("keeps Markdown that a test reads as data selecting its reader", () => {
    expect(planCoverageAffectedScope(owners, ["goals/speed-loop/ops/runner-burst/README.md"])).toEqual({
      _tag: "selected",
      packageNames: ["@beep/repo-cli"],
      dependentPackageNames: [],
    });
  });

  it("selects only the code owner of a diff that mixes code with a packet manifest", () => {
    expect(planCoverageAffectedScope(owners, ["packages/b/src/B.ts", "goals/demo-packet/ops/manifest.json"])).toEqual({
      _tag: "selected",
      packageNames: ["@beep/b"],
      dependentPackageNames: [],
    });
  });
});

it.layer(NodeServices.layer, { timeout: "60 seconds" })("live workspace goal readers", (it) => {
  it.effect("plans #3101 and the citation manifest as noop against the live workspace", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const workspace = yield* workspaceCoverageScopeOwners(repoRoot);
      expect(planCoverageAffectedScope(workspace, PR_3101)).toEqual(NOOP);
      expect(planCoverageAffectedScope(workspace, [CITATION_MANIFEST])).toEqual(NOOP);
    })
  );

  it.effect("finds every registry consumer as a live owner with a coverage script", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const workspace = yield* workspaceCoverageScopeOwners(repoRoot);
      const consumers = pipe(
        ciGoalDataConsumers,
        A.flatMap((row) => row.consumers),
        A.dedupe,
        A.sort(Order.String)
      );
      const measurable = A.filter(consumers, (name) =>
        A.some(workspace, (entry) => entry.packageName === name && entry.hasCoverage)
      );
      expect(measurable).toEqual(consumers);
    })
  );

  it.effect("places every synthetic owner above at a live package directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // Canonical, as workspace discovery resolves member containment against the real root.
      const found = yield* findRepoRoot();
      const repoRoot = yield* fs.realPath(found);
      const workspace = yield* workspaceCoverageScopeOwners(repoRoot);
      const registryOwners = A.filter(owners, (entry) => entry.packageName !== "@beep/b");
      for (const entry of registryOwners) {
        const manifest = yield* fs.exists(path.join(repoRoot, entry.packagePath, "package.json"));
        expect(manifest, entry.packagePath).toBe(true);
        expect(
          A.some(workspace, (live) => live.packageName === entry.packageName && live.packagePath === entry.packagePath),
          entry.packageName
        ).toBe(true);
      }
    })
  );
});
