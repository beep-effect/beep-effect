import { CiCommandError } from "@beep/repo-cli/commands/Ci";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

const aggregateCases = A.flatMap(["success", "failure", "skipped", "cancelled"], (classification) =>
  A.flatMap(["true", "false", "", "invalid"], (docs) =>
    A.map(["success", "failure", "skipped", "cancelled"], (result) => ({ classification, docs, result }))
  )
);
const passingStates = ["success:true:skipped", "success:false:success"];

it.effect(
  "executes the real aggregate scripts across classification and shard outcomes",
  Effect.fnUntraced(function* () {
    const source = yield* Effect.tryPromise({
      try: () => Bun.file(new URL("../../../../../.github/workflows/check.yml", import.meta.url)).text(),
      catch: CiCommandError.new("Unable to read the checked-in workflow for the admission regression."),
    });
    const workflow = parseWorkflowYaml(source);
    for (const { job, shard } of [
      { job: "lint", shard: "lint-shard" },
      { job: "test-unit", shard: "test-unit-shard" },
    ]) {
      const script = yield* S.decodeUnknownEffect(S.String)(yamlAt(workflow, ["jobs", job, "steps", 0, "run"]));
      for (const { classification, docs, result } of aggregateCases) {
        const command = pipe(
          script,
          Str.replaceAll("${{ needs.change-profile.result }}", classification),
          Str.replaceAll("${{ needs.change-profile.outputs.docs_only }}", docs),
          Str.replaceAll(`\${{ needs.${shard}.result }}`, result)
        );
        const executed = Bun.spawnSync(["bash", "-c", command], { stdout: "pipe", stderr: "pipe" });
        assert.strictEqual(
          executed.exitCode === 0,
          A.contains(passingStates, `${classification}:${docs}:${result}`),
          `${job}: ${classification}/${docs}/${result}`
        );
      }
      assert.deepEqual(yamlAt(workflow, ["jobs", job, "needs"]), ["change-profile", shard]);
    }
    for (const job of ["lint-shard", "test-unit-shard", "labs", "property-laws", "fallow-advisory"]) {
      assert.deepEqual(yamlAt(workflow, ["jobs", job, "needs"]), ["change-profile"]);
      assert.strictEqual(yamlAt(workflow, ["jobs", job, "if"]), "needs.change-profile.outputs.docs_only != 'true'");
    }
    assert.isUndefined(yamlAt(workflow, ["jobs", "security", "if"]));
    assert.isUndefined(yamlAt(workflow, ["jobs", "secrets", "if"]));
    assert.isUndefined(yamlAt(workflow, ["jobs", "sast", "if"]));
  })
);
