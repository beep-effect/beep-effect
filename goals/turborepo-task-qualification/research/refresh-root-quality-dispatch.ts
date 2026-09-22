import { parseQualityTaskInvocation } from "@beep/repo-cli/commands/Quality/Tasks";
import * as O from "effect/Option";

const cases = [
  ["audit", "packages"],
  ["audit", "packages", "--force"],
  ["audit", "github", "quality"],
  ["build"],
  ["check"],
  ["test"],
  ["coverage"],
  ["coverage", "--", "--write-baseline", "--concurrency=3"],
  ["lint"],
  ["lint", "--fix"],
  ["lint", "deprecated-apis"],
  ["lint", "jsdoc", "--root-only"],
  ["check", "--help"],
];
const rows = cases.map((argv) => ({ argv, invocation: O.getOrNull(parseQualityTaskInvocation(argv)) }));
await Bun.write(
  ".beep/qualification-local-preflight/root-quality-dispatch.json",
  JSON.stringify({ authority: "Pure parser observation only; no quality tasks executed", rows }, null, 2) + "\n"
);
console.log(JSON.stringify(rows, null, 2));
