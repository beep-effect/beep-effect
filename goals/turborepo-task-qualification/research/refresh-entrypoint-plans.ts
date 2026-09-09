// Pure planner projection. Run under the clean environment documented in the report.
import {
  CI_LANE_DESCRIPTORS,
  CI_LANE_PARTITIONS,
  CiLaneDescriptor,
  CiLaneId,
  CiLanePartition,
  CiLanePartitionArgs,
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLanePartitionArgsForTesting,
  ciLaneStepsForTesting,
  ciLocalStepsForTesting,
  DocgenLaneMode,
  docgenLaneModeForChangedPaths,
  doctestStepForTesting,
} from "@beep/repo-cli/commands/Ci";
import { GithubCheckLaneSpec, githubCheckLanesForModeForTesting, QualityTaskStep } from "@beep/repo-cli/test/Quality";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const Step = QualityTaskStep;
const Variant = S.Struct({ label: S.String, options: CiLaneRunOptions });
const Report = S.Struct({
  schemaVersion: S.Literal("cache-entrypoint-plans/v2"),
  authority: S.String,
  context: S.Struct({ ci: S.Boolean, githubActions: S.Boolean }),
  variants: S.Array(Variant),
  ciDescriptors: S.Array(CiLaneDescriptor),
  ci: S.Array(S.Struct({ variant: S.String, lane: CiLaneId, steps: S.Array(Step) })),
  quality: S.Array(S.Struct({ mode: S.String, lanes: S.Array(GithubCheckLaneSpec) })),
  partitions: S.Array(S.Struct({ variant: S.String, definition: CiLanePartition, args: CiLanePartitionArgs })),
  localDispatch: S.Array(S.Struct({ shape: CiLocalStepPlan, steps: S.Array(Step) })),
  docgenSelection: S.Array(S.Struct({ changedPaths: S.Array(S.String), mode: DocgenLaneMode })),
  doctestSelection: S.Array(S.Struct({ kind: S.String, steps: S.Array(Step) })),
});
const variants = [
  {
    label: "full",
    options: CiLaneRunOptions.make({
      affected: false,
      base: "origin/main",
      head: "HEAD",
      summarize: false,
      mode: "full",
      to: "HEAD",
      last: false,
      changesetStatus: false,
      validateEnvelopes: false,
    }),
  },
  {
    label: "affected-summary",
    options: CiLaneRunOptions.make({
      affected: true,
      base: "origin/main",
      head: "HEAD",
      summarize: true,
      mode: "affected",
      to: "HEAD",
      last: false,
      changesetStatus: true,
      validateEnvelopes: true,
      runs: "250",
      seed: "12345",
    }),
  },
  {
    label: "none-last",
    options: CiLaneRunOptions.make({
      affected: false,
      base: "origin/main",
      head: "HEAD",
      summarize: true,
      mode: "none",
      to: "HEAD",
      last: true,
      changesetStatus: false,
      validateEnvelopes: false,
    }),
  },
];
const report = {
  schemaVersion: "cache-entrypoint-plans/v2",
  authority:
    "Source planner projection with explicit environment maps. No commands executed, runtime partition intersection proved, or cache/hosted qualification granted.",
  context: { ci: Bun.env.CI === "true", githubActions: Bun.env.GITHUB_ACTIONS === "true" },
  variants,
  ciDescriptors: CI_LANE_DESCRIPTORS,
  ci: A.flatMap(variants, (variant) =>
    A.map(CiLaneId.Options, (lane) => ({
      variant: variant.label,
      lane,
      steps: ciLaneStepsForTesting("/repo", lane, variant.options),
    }))
  ),
  quality: A.map(
    ["cheap-gates", "quality", "repo-sanity", "secrets", "security", "sast", "nix", "pre-push", "review-fix"] as const,
    (mode) => ({ mode, lanes: githubCheckLanesForModeForTesting("/repo", mode) })
  ),
  partitions: A.flatMap(variants, (variant) =>
    A.map(CI_LANE_PARTITIONS, (definition) => ({
      variant: variant.label,
      definition,
      args: ciLanePartitionArgsForTesting(definition.lane, definition.packages, variant.options),
    }))
  ),
  localDispatch: A.flatMap([false, true], (affected) =>
    A.map([false, true], (onMainBranch) => {
      const shape = CiLocalStepPlan.make({ affected, base: "origin/main", onMainBranch });
      return { shape, steps: ciLocalStepsForTesting("/repo", CiLaneId.Options, shape) };
    })
  ),
  docgenSelection: A.map(
    [[], ["LICENSE"], ["packages/foundation/modeling/identity/src/index.ts"], ["bun.lock"]],
    (changedPaths) => ({ changedPaths, mode: docgenLaneModeForChangedPaths(changedPaths) })
  ),
  doctestSelection: [
    { kind: "full", steps: doctestStepForTesting("/repo", undefined) },
    { kind: "empty-marked-selection", steps: doctestStepForTesting("/repo", []) },
    {
      kind: "illustrative-marked-selection",
      steps: doctestStepForTesting("/repo", ["packages/foundation/modeling/identity/src/index.ts"]),
    },
  ],
};
const encoded = await Effect.runPromise(S.encodeUnknownEffect(S.fromJsonString(Report))(report));
const output = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(
    Bun.argv[2] ?? (report.context.githubActions ? "entrypoint-plans-hosted.json" : "entrypoint-plans.json")
  )
);
await Bun.write(`goals/turborepo-task-qualification/research/${output}`, `${encoded}\n`);
console.log(
  `Captured ${report.ci.length} CI plans, ${report.quality.length} Quality modes, ${report.partitions.length} partition plans and ${report.localDispatch.length} local dispatch shapes without executing lane commands.`
);
