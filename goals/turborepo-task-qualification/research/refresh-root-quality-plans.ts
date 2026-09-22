import {
  parseQualityTaskInvocation,
  parseTestLaneSelectionForTesting,
  rootQualityStepsForTesting,
} from "@beep/repo-cli/commands/Quality/Tasks";
import * as O from "effect/Option";

const cases = [
  ["audit"],
  ["audit", "packages"],
  ["audit", "packages", "--force"],
  ["audit", "github", "quality"],
  ["audit", "github"],
  ["build"],
  ["check"],
  ["test"],
  ["coverage", "--", "--write-baseline", "--concurrency=3"],
  ["lint"],
  ["lint", "--fix"],
];
const rows = cases.map((argv) => {
  const invocation = O.getOrThrow(parseQualityTaskInvocation(argv));
  return { argv, invocation, steps: rootQualityStepsForTesting("/repo", invocation) };
});
await Bun.write(
  ".beep/qualification-local-preflight/root-quality-downstream-plans.json",
  JSON.stringify(
    {
      authority:
        "Pure static planner observations; no subprocesses executed. Empty test/coverage plans defer to runtime runners.",
      rows,
      testLaneSelections: [
        [],
        ["--unit"],
        ["--integration"],
        ["--unit", "--integration"],
        ["--", "--unit", "--concurrency=2"],
      ].map((args) => ({ args, selection: parseTestLaneSelectionForTesting(args) })),
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify(
    rows.map(({ argv, steps }) => ({ argv, labels: steps.map((step) => step.label) })),
    null,
    2
  )
);
