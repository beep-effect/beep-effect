import * as NodeOS from "node:os";
import * as NodeURL from "node:url";
import * as NodePath from "@effect/platform-node/NodePath";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { defineConfig, mergeConfig } from "vitest/config";
import { BaseSequencer } from "vitest/node";
import shared, { fcDeepSweepActive, packageTestTimeout, vitestDoctestActive } from "../../../../vitest.shared.ts";
import shardPlan from "./vitest.shards.json" with { type: "json" };
import type { TestSpecification } from "vitest/node";

// A committed plan keeps all six runners on the same assignment. New files use Vitest's
// hash partition over the unknown set; removed files simply disappear from collection.
// Other shard counts retain Vitest's default behavior. The plan changes scheduling only.
class MeasuredSequencer extends BaseSequencer {
  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (shard === undefined || shard.count !== shardPlan.shards.length) return super.shard(files);
    const path = Effect.runSync(Effect.provide(Path.Path, NodePath.layer));
    const assignment = (file: TestSpecification) => {
      const relative = Str.replaceAll(path.sep, "/")(path.relative(this.ctx.config.root, file.moduleId));
      return A.findFirstIndex(shardPlan.shards, (entries) => A.contains(entries, relative));
    };
    return Effect.promise(() => super.shard(A.filter(files, (file) => O.isNone(assignment(file))))).pipe(
      Effect.map((unknown) =>
        A.appendAll(
          A.filter(files, (file) => O.contains(assignment(file), shard.index - 1)),
          unknown
        )
      ),
      Effect.runPromise
    );
  }
}

/**
 * Suites that leak process-wide state into whatever runs next in the same worker, so they keep
 * one fresh worker per file. Everything else shares workers (`isolate: false`).
 *
 * The list is a census, not a guess: `test/vitest-isolation-census.test.ts` scans every test file
 * for the hazards below and fails when a match is missing here or an entry no longer matches.
 * - process state: `process.chdir`, directly or through `temporaryWorkingDirectory` /
 *   `withTempWorkingDirectory` from `test/support/CommandTest.ts`; any `process.<name> =`
 *   reassignment (`cwd`, `argv`, ...); `vi.spyOn(process, ...)`;
 *   `Object.defineProperty(process | globalThis, ...)`
 * - module mocks: `vi.mock`, `vi.doMock`
 * - global and env stubs: `vi.stubGlobal`, `vi.stubEnv`, `globalThis.<name> =`
 * - env writes: `process.env.<NAME> =`, `delete process.env.<NAME>`
 */
const isolatedSuites = [
  "test/bun-runtime-version.test.ts",
  "test/cache-acceptance.test.ts",
  "test/cache-conformance-command.test.ts",
  "test/cache-operational-acceptance.test.ts",
  "test/cache-pilot-orchestration.test.ts",
  "test/cache-private-socket-controls.test.ts",
  "test/cache-runtime.test.ts",
  "test/catalog-shard-scope.test.ts",
  "test/catalog-usage.test.ts",
  "test/check-census-command.test.ts",
  "test/ci-command.test.ts",
  "test/ci-coverage-config.test.ts",
  "test/ci-coverage-reporter.test.ts",
  "test/ci-coverage.test.ts",
  "test/ci-lane.test.ts",
  "test/codex-findings-bundle-ingest.test.ts",
  "test/codex-findings-refresh.test.ts",
  "test/codex-findings-write.test.ts",
  "test/codex-security-dispatch.test.ts",
  "test/coverage-artifacts.test.ts",
  "test/create-package-lab.test.ts",
  "test/create-package.test.ts",
  "test/delete-package-labs.test.ts",
  "test/delete-package.test.ts",
  "test/docgen.test.ts",
  "test/ecosystem-polarity.test.ts",
  "test/effect-fn.test.ts",
  "test/effect-imports.test.ts",
  "test/effect-vitest-contract.test.ts",
  "test/effect-vitest-detectors.test.ts",
  "test/explore-check.test.ts",
  "test/explore-graduate-plan.test.ts",
  "test/explore-graduate-write.test.ts",
  "test/files-command.test.ts",
  "test/frozen-grant-set.test.ts",
  "test/goals-bootstrap-plan.test.ts",
  "test/goals-completion-evidence.test.ts",
  "test/goals-completion-observation.test.ts",
  "test/goals-decisions.test.ts",
  "test/goals-doctor-git-advisories.test.ts",
  "test/goals-doctor-path-security.test.ts",
  "test/goals-doctor.test.ts",
  "test/goals-graph.test.ts",
  "test/goals-manifest-capabilities.test.ts",
  "test/goals-manifest-projection.test.ts",
  "test/goals-materialize.test.ts",
  "test/goals-set-risk-tier.test.ts",
  "test/goals-set-status-stream.test.ts",
  "test/identity-registration-removal.test.ts",
  "test/knowledge-doctor-baseline.test.ts",
  "test/knowledge-doctor.test.ts",
  "test/knowledge-mint-bootstrap.test.ts",
  "test/lab-identity-segment.test.ts",
  "test/labs-list.test.ts",
  "test/laws-markdown-fences-command.test.ts",
  "test/laws-schema-tag-idioms-command.test.ts",
  "test/lint-command.test.ts",
  "test/lint-identity-registry.test.ts",
  "test/lint-program-assignment.test.ts",
  "test/lint-tsconfig-overlay.test.ts",
  "test/lint-workers.test.ts",
  "test/native-runtime.test.ts",
  "test/observability-catalog.test.ts",
  "test/package-verify.test.ts",
  "test/process-identity.test.ts",
  "test/proof-job.test.ts",
  "test/qa-doctor.test.ts",
  "test/quality-command-dispatch.test.ts",
  "test/quality-tasks.test.ts",
  "test/reflection-lint.test.ts",
  "test/research-library-acquisition.test.ts",
  "test/research-library-views.test.ts",
  "test/reviewer-bootstrap.test.ts",
  "test/schema-catalog.test.ts",
  "test/schema-first-parity.test.ts",
  "test/schema-topology.test.ts",
  "test/session-ledger.test.ts",
  "test/skills-command.test.ts",
  "test/skills-publication-recovery.test.ts",
  "test/sync-data-to-ts.test.ts",
  "test/terse-effect.test.ts",
  "test/tsconfig-sync.test.ts",
  "test/worktree-command.test.ts",
  "test/worktree-remove-fence.test.ts",
  "test/xdg-adoption.test.ts",
  "test/yeet-command-wiring.test.ts",
  "test/yeet-inbox-porcelain.test.ts",
  "test/yeet-sweep-retire.test.ts",
];

// Doctest mode collects `src/**` through `includeSource` and the property sweep resolves its own
// include list, so both keep the single isolated project; splitting would run doctests twice.
const splitProjects = !vitestDoctestActive && !fcDeepSweepActive;

const config = mergeConfig(
  shared,
  defineConfig({
    test: {
      // Fixtures own cache enrollment. A root `bun run` also loads its dotenv into the parent,
      // so disable host defaults and clear the inherited cache tuple before fixture setup.
      env: {
        BEEP_TURBO_HOST_CACHE_DISABLED: "true",
        TURBO_API: "",
        TURBO_TOKEN: "",
        TURBO_TEAM: "",
        TURBO_CACHE: "",
        TURBO_REMOTE_CACHE_SIGNATURE_KEY: "",
      },
      exclude: ["test/fixtures/**"],
      globalSetup: [NodeURL.fileURLToPath(new URL("./test/global-cleanup.ts", import.meta.url))],
      // Files run in parallel workers; the tests inside one file stay sequential because several
      // suites share fixtures or the working directory between their tests.
      sequence: {
        concurrent: false,
        sequencer: MeasuredSequencer,
      },
      testTimeout: packageTestTimeout(30_000),
      // Each worker loads most of the repo-cli module graph (12.8 GB peak at 8 workers). Vitest's
      // default of one worker per core minus one was OOM-killed on a 64-core workstation inside a
      // 32 GB cap, so cap it; 4-vCPU hosted runners keep their default of 3.
      maxWorkers: Math.max(1, Math.min(fcDeepSweepActive ? 3 : 8, NodeOS.availableParallelism() - 1)),
    },
  })
);

// Projects that extend the root concatenate `include`, so the root include is cleared and each
// project names its own files.
export default splitProjects
  ? {
      ...config,
      test: {
        ...config.test,
        include: [],
        projects: [
          {
            extends: true,
            test: {
              name: "shared",
              include: ["test/**/*.test.{ts,tsx}"],
              exclude: isolatedSuites,
              isolate: false,
            },
          },
          {
            extends: true,
            test: {
              name: "isolated",
              include: isolatedSuites,
              // Even under coverage (vitest.shared.ts shares the graph there by default).
              isolate: true,
            },
          },
        ],
      },
    }
  : mergeConfig(config, {
      // Preserve the property sweep's exact include list and fresh worker per file. These
      // suites already run concurrently in the unit lane; serializing the deep sweep used
      // only one hosted core for nearly twenty minutes. Keep a three-worker ceiling above.
      // Doctests retain their serial execution and are never collected twice.
      test: { isolate: true, fileParallelism: fcDeepSweepActive && !vitestDoctestActive },
    });
