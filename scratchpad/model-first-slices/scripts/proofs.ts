import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { generatedFile } from "@proto/tooling/GeneratedFile";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { uncoveredOutcomes } from "../proofs/Outcomes.allow.ts";
import { proofs, reviewQuestions } from "../proofs/Proofs.data.ts";

// `bun run proofs` writes PROOFS.md from proofs/Proofs.data.ts; `--check` fails on drift, and
// either way a checker path that does not exist fails the run.
const render = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL("../", import.meta.url));
  const missing = yield* Effect.filter(A.flatMap(proofs, (proof) => proof.checkers), (file) =>
    Effect.map(fs.exists(path.join(root, file)), (exists) => !exists),
  );
  if (missing.length > 0) return yield* Effect.fail(new Error(`checker paths not found: ${A.join(missing, ", ")}`));
  const sections = A.map(proofs, (proof) =>
    [
      `### ${proof.id}`,
      "",
      proof.invariant,
      "",
      `- **Checker:** ${A.join(A.map(proof.checkers, (file) => `\`${file}\``), ", ")}`,
      `- **Reads:** ${proof.reads}`,
      `- **Assumes:** ${proof.assumptions}`,
      `- **Gaps:** ${proof.gaps}`,
      `- **Left to a reviewer:** ${proof.reviewer}`,
      ...(proof.live === true ? ["- **Needs a live stack:** run with `bun run conformance` against a deployed stage."] : []),
    ].join("\n"),
  );
  return [
    "# Proof inventory",
    "",
    "<!-- Generated from proofs/Proofs.data.ts by scripts/proofs.ts. Do not edit: `bun run proofs`",
    "     rewrites it, and `bun run proofs --check` fails on drift. -->",
    "",
    `Every invariant this prototype enforces (D8): ${proofs.length} entries. Mechanical laws run in`,
    "`bun run check`, `bun run test` and `bun run generated:check`; semantic questions stay with a",
    "reviewer who did not write the change.",
    "",
    "## Invariants",
    "",
    A.join(sections, "\n\n"),
    "",
    "## Outcome coverage gaps",
    "",
    `\`bun run outcomes --check\` lists ${uncoveredOutcomes.length} declared outcomes no story executes, each with its reason:`,
    "",
    ...A.map(uncoveredOutcomes, (row) => `- \`${row.aggregate}.${row.command}\` ${row.outcome}: ${row.reason}`),
    "",
    "## Questions for an independent reviewer",
    "",
    ...A.map(reviewQuestions, (q) => `- **${q.topic}.** ${q.question}`),
    "",
  ].join("\n");
});

Effect.gen(function* () {
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL("../PROOFS.md", import.meta.url));
  yield* generatedFile(file, render, process.argv.slice(2));
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
