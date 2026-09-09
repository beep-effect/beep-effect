// Snapshot existing pure planners. No plan is executed and no proof store is consulted.
import identity from "@beep/identity/package.json";
import {
  detectQualityProfileForTesting,
  QualityProfileDetection,
  QualityProfileDetectionInput,
} from "@beep/repo-cli/commands/Quality";
import {
  BuildYeetRunPlanTestOptions,
  buildYeetRunPlanForTesting,
  RepoRunContext,
  RepoRunPlan,
  TurboPlanSnapshot,
  TurboPlanTask,
} from "@beep/repo-cli/test/Yeet";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const tasks = A.map(
  R.toEntries({
    build: identity.scripts.build,
    check: identity.scripts.check,
    lint: identity.scripts.lint,
    test: identity.scripts.test,
  }),
  ([task, command]) =>
    TurboPlanTask.make({
      taskId: `${identity.name}#${task}`,
      packageName: identity.name,
      packagePath: "packages/foundation/modeling/identity",
      task,
      command,
    })
);
const contexts = A.map(["main", "codex/qualification-example"], (branch) =>
  RepoRunContext.make({
    base: "origin/main",
    branch,
    cwd: "/repo",
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: "/repo",
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks }),
  })
);
const plans = A.flatMap(contexts, (context) => {
  const input = { context, message: O.none<string>() };
  const variants = [
    { name: "repair", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "repair" }) },
    { name: "verify-full", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify" }) },
    {
      name: "verify-cheap",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify", tier: "cheap-gates" }),
    },
    {
      name: "verify-review-fix",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify", tier: "review-fix" }),
    },
    {
      name: "verify-ci-parity",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify", ciParity: true }),
    },
    {
      name: "verify-collect-all",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify", collectAll: true }),
    },
    {
      name: "verify-force-turbo",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "verify", forceTurbo: true }),
    },
    { name: "publish-standard", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "publish", pr: true }) },
    {
      name: "publish-early",
      options: BuildYeetRunPlanTestOptions.make({
        ...input,
        mode: "publish",
        startPrEarly: true,
        pr: true,
        monitor: true,
      }),
    },
    {
      name: "publish-push-only",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "publish", pushOnly: true, pr: true, monitor: true }),
    },
    {
      name: "publish-fast-monitor",
      options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "publish", fast: true, monitor: true }),
    },
    { name: "monitor", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "monitor" }) },
    { name: "status-remote", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "status", remote: true }) },
    { name: "closeout", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "closeout" }) },
    { name: "pre-push-hook", options: BuildYeetRunPlanTestOptions.make({ ...input, mode: "pre-push-hook" }) },
  ];
  return A.map(variants, (row) => ({ ...row, plan: buildYeetRunPlanForTesting(row.options) }));
});
const hardware = A.map(
  [
    QualityProfileDetectionInput.make({ ci: true, cpuCount: 64, totalMemoryBytes: 128 * 1024 ** 3 }),
    QualityProfileDetectionInput.make({ ci: false, cpuCount: 16, totalMemoryBytes: 32 * 1024 ** 3 }),
    QualityProfileDetectionInput.make({ ci: false, cpuCount: 64, totalMemoryBytes: 128 * 1024 ** 3 }),
  ],
  (input) => ({ input, detection: detectQualityProfileForTesting(input) })
);
const Report = S.Struct({
  schemaVersion: S.Literal("cache-yeet-planner-review/v1"),
  authority: S.String,
  context: S.Struct({ ci: S.Boolean, githubActions: S.Boolean }),
  plans: S.Array(S.Struct({ name: S.String, options: BuildYeetRunPlanTestOptions, plan: RepoRunPlan })),
  hardware: S.Array(S.Struct({ input: QualityProfileDetectionInput, detection: QualityProfileDetection })),
});
const report = {
  schemaVersion: "cache-yeet-planner-review/v1",
  authority:
    "Illustrative pure planner scenarios using the actual identity manifest. No steps, publication, proof lookup, Git mutation or hosted action executed. Hardware inputs are examples, not measurements.",
  context: { ci: Bun.env.CI === "true", githubActions: Bun.env.GITHUB_ACTIONS === "true" },
  plans,
  hardware,
};
const encoded = await Effect.runPromise(S.encodeUnknownEffect(S.fromJsonString(Report))(report));
const output = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(
    Bun.argv[2] ?? (report.context.githubActions ? "yeet-plans-hosted.json" : "yeet-plans.json")
  )
);
await Bun.write(`goals/turborepo-task-qualification/research/${output}`, `${encoded}\n`);
console.log(
  `Captured ${plans.length} Yeet branch/mode plans and ${hardware.length} hardware profile examples without executing steps.`
);
