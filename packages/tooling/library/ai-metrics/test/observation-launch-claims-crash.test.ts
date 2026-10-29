import { makeObservationClaims, ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import { claimFixture, claimSubmission } from "./fixtures/observation-claims.ts";

const encodeObservationClaimPolicyJson = S.encodeEffect(S.fromJsonString(ObservationClaimPolicy));
const encodeObservationLaunchSubmissionJson = S.encodeEffect(S.fromJsonString(ObservationLaunchSubmission));
const decodeExecutedReasonRecordJson = S.decodeEffect(
  S.fromJsonString(S.Struct({ executed: S.Boolean, reason: S.String }))
);

for (const mode of ["before-write", "after-sync", "after-operation", "after-observation"] as const) {
  it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect(`never grants another attempt after its producer is killed ${mode}`, () =>
      Effect.gen(function* () {
        const f = yield* claimFixture();
        const policyFile = `${f.root}/policy.json`;
        const inputFile = `${f.root}/submission.json`;
        const marker = `${f.root}/boundary`;
        const output = `${f.root}/output.json`;
        const operation = `${f.root}/operation`;
        yield* f.fs.writeFileString(policyFile, yield* encodeObservationClaimPolicyJson(f.policy), { mode: 0o600 });
        yield* f.fs.writeFileString(inputFile, yield* encodeObservationLaunchSubmissionJson(claimSubmission()), {
          mode: 0o600,
        });
        const executablePath = yield* Config.String("PATH");
        const run = (scenario: string) =>
          ChildProcess.make(
            "bun",
            [
              "--no-env-file",
              `${import.meta.dirname}/fixtures/observation-claim-process.ts`,
              policyFile,
              inputFile,
              scenario,
              output,
              marker,
              operation,
            ],
            {
              env: { PATH: executablePath },
              extendEnv: false,
              stdin: "ignore",
              stdout: "ignore",
              stderr: "inherit",
            }
          );
        const child = yield* run(mode);
        while (!(yield* f.fs.exists(marker))) {
          expect(yield* child.isRunning).toBe(true);
          yield* Effect.sleep("10 millis");
        }
        expect(yield* f.fs.readFileString(marker)).toBe(mode);
        expect(yield* f.fs.exists(output)).toBe(false);
        yield* child.kill({ killSignal: "SIGKILL" });
        assertTrue(Exit.isFailure(yield* Effect.exit(child.exitCode)));
        expect(yield* child.isRunning).toBe(false);
        expect(yield* f.fs.exists(operation)).toBe(mode === "after-operation" || mode === "after-observation");
        const retry = yield* run("retry");
        expect(yield* retry.exitCode).toBe(0);
        const result = yield* decodeExecutedReasonRecordJson(yield* f.fs.readFileString(output));
        expect(result).toEqual({ executed: false, reason: mode === "before-write" ? "integrity" : "claimed" });
        expect(yield* f.fs.exists(operation)).toBe(mode === "after-operation" || mode === "after-observation");
        if (mode !== "before-write") {
          const claims = yield* makeObservationClaims(f.policy, f.uid);
          expect((yield* claims.snapshot).length).toBe(1);
          if (mode === "after-observation")
            expect(
              A.map((yield* claims.readOutbox(claimSubmission().fact.launchId)).submissions, (entry) => entry.fact._tag)
            ).toEqual(["Prepared", "Started"]);
        }
      }).pipe(Effect.timeout("15 seconds"))
    )
  );
}

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("two independent producer processes cannot both execute the same claimed attempt", () =>
    Effect.gen(function* () {
      const f = yield* claimFixture(1);
      const policyFile = `${f.root}/policy.json`;
      const inputFile = `${f.root}/submission.json`;
      yield* f.fs.writeFileString(policyFile, yield* encodeObservationClaimPolicyJson(f.policy), {
        mode: 0o600,
      });
      yield* f.fs.writeFileString(inputFile, yield* encodeObservationLaunchSubmissionJson(claimSubmission()), {
        mode: 0o600,
      });
      const executablePath = yield* Config.String("PATH");
      const outcomes = yield* Effect.forEach(
        ["left", "right"],
        (side) =>
          Effect.gen(function* () {
            const output = `${f.root}/${side}.json`;
            const child = yield* ChildProcess.make(
              "bun",
              [
                "--no-env-file",
                `${import.meta.dirname}/fixtures/observation-claim-process.ts`,
                policyFile,
                inputFile,
                "retry",
                output,
                `${f.root}/unused`,
                `${f.root}/operation`,
              ],
              {
                env: { PATH: executablePath },
                extendEnv: false,
                stdin: "ignore",
                stdout: "ignore",
                stderr: "inherit",
              }
            );
            expect(yield* child.exitCode).toBe(0);
            return yield* decodeExecutedReasonRecordJson(yield* f.fs.readFileString(output));
          }),
        { concurrency: 2 }
      );
      expect(A.filter(outcomes, (outcome) => outcome.executed).length).toBe(1);
      expect(yield* f.fs.readFileString(`${f.root}/operation`)).toBe("one operation");
      expect((yield* (yield* makeObservationClaims(f.policy, f.uid)).snapshot).length).toBe(1);
    }).pipe(Effect.timeout("15 seconds"))
  )
);
