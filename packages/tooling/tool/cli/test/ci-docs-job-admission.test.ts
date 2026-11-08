import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

it.layer(NodeServices.layer)("documentation job admission", (it) => {
  it.effect(
    "executes the real aggregate scripts across classification and shard outcomes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const source = yield* fs.readFileString(`${root}/.github/workflows/check.yml`);
      const workflow = parseWorkflowYaml(source);
      for (const { job, shard } of [
        { job: "lint", shard: "lint-shard" },
        { job: "test-unit", shard: "test-unit-shard" },
      ]) {
        const script = yamlAt(workflow, ["jobs", job, "steps", 0, "run"]);
        assert.isTrue(P.isString(script));
        if (!P.isString(script)) continue;
        for (const classification of ["success", "failure", "skipped", "cancelled"]) {
          for (const docs of ["true", "false", "", "invalid"]) {
            for (const result of ["success", "failure", "skipped", "cancelled"]) {
              const command = pipe(
                script,
                Str.replaceAll("${{ needs.change-profile.result }}", classification),
                Str.replaceAll("${{ needs.change-profile.outputs.docs_only }}", docs),
                Str.replaceAll(`\${{ needs.${shard}.result }}`, result)
              );
              const executed = Bun.spawnSync(["bash", "-c", command], { stdout: "pipe", stderr: "pipe" });
              const passes =
                classification === "success" &&
                ((docs === "true" && result === "skipped") || (docs === "false" && result === "success"));
              assert.strictEqual(executed.exitCode === 0, passes, `${job}: ${classification}/${docs}/${result}`);
            }
          }
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
});
