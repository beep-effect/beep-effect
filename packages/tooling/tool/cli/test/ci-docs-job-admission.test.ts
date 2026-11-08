import { CiCommandError, decideHeavyAdmission, HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
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

it.effect(
  "pins label classification and preserves normal fork admission when the docs shortcut is unavailable",
  Effect.fnUntraced(function* () {
    for (const caller of [
      {
        file: "check.yml",
        docsIndex: 0,
        setupIndex: 3,
        decideIndex: 4,
        profile: "needs.change-profile.outputs.docs_only",
      },
      {
        file: "heavy-admit.yml",
        docsIndex: 4,
        setupIndex: 5,
        decideIndex: 6,
        profile: "steps.profile.outputs.docs_only",
      },
    ]) {
      const source = yield* Effect.tryPromise({
        try: () => Bun.file(new URL(`../../../../../.github/workflows/${caller.file}`, import.meta.url)).text(),
        catch: CiCommandError.new("Unable to read the checked-in admission caller."),
      });
      const workflow = parseWorkflowYaml(source);
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_BASE_SHA"]), "${{ github.event.pull_request.base.sha }}");
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_HEAD_SHA"]), "${{ github.event.pull_request.head.sha }}");
      const shortcut = yield* S.decodeUnknownEffect(S.String)(
        yamlAt(workflow, ["jobs", "admission", "steps", caller.docsIndex, "if"])
      );
      assert.strictEqual(
        shortcut,
        `${caller.profile} == 'true' && github.event.pull_request.head.repo.full_name == github.repository`
      );
      for (const index of [caller.setupIndex, caller.decideIndex]) {
        assert.strictEqual(
          yamlAt(workflow, ["jobs", "admission", "steps", index, "if"]),
          "steps.docs.outputs.verdict != 'skip-satisfied'"
        );
      }
      for (const row of [
        { docs: "true", head: "beep-effect/beep-effect", labels: [], paths: ["README.md"], verdict: "skip-satisfied" },
        { docs: "true", head: "contributor/fork", labels: [], paths: ["README.md"], verdict: "hold" },
        { docs: "true", head: "contributor/fork", labels: ["ready-for-heavy"], paths: ["README.md"], verdict: "hold" },
        {
          docs: "true",
          head: "contributor/fork",
          labels: ["ready-for-heavy", "ready-for-heavy-fork"],
          paths: ["README.md"],
          verdict: "run",
        },
        { docs: "false", head: "beep-effect/beep-effect", labels: [], paths: [], verdict: "hold" },
        { docs: "false", head: "beep-effect/beep-effect", labels: ["ready-for-heavy"], paths: [], verdict: "run" },
      ]) {
        const rendered = pipe(
          shortcut,
          Str.replaceAll(caller.profile, `'${row.docs}'`),
          Str.replaceAll("github.event.pull_request.head.repo.full_name", `'${row.head}'`),
          Str.replaceAll("github.repository", "'beep-effect/beep-effect'")
        );
        const taken = Bun.spawnSync(["bash", "-c", `[[ ${rendered} ]]`], { stdout: "pipe", stderr: "pipe" });
        const admission = decideHeavyAdmission(
          HeavyAdmissionEvent.make({
            eventName: "pull_request",
            headRepository: row.head,
            labels: row.labels,
            changedPaths: row.paths,
          })
        );
        assert.strictEqual(taken.exitCode === 0 ? "skip-satisfied" : admission.verdict, row.verdict);
      }
    }
  })
);

it.effect(
  "keeps trusted summary artifact names stable when verification jobs split",
  Effect.fnUntraced(function* () {
    for (const file of ["check.yml", "heavy.yml"]) {
      const source = yield* Effect.tryPromise({
        try: () => Bun.file(new URL(`../../../../../.github/workflows/${file}`, import.meta.url)).text(),
        catch: CiCommandError.new("Unable to read the trusted artifact naming contract."),
      });
      const workflow = parseWorkflowYaml(source);
      const steps = yield* S.decodeUnknownEffect(S.Array(S.Unknown))(yamlAt(workflow, ["jobs", "verify", "steps"]));
      const uploads = A.filter(steps, (step) => yamlAt(step, ["name"]) === "Upload trusted Turbo summaries");
      assert.strictEqual(uploads.length, 1);
      assert.strictEqual(
        yamlAt(A.head(uploads).pipe(O.getOrThrow), ["with", "name"]),
        "turbo-summary-verify-${{ matrix.id || matrix.partition || 'single' }}"
      );
    }
  })
);
