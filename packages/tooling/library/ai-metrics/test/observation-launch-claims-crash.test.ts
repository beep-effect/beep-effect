import { makeObservationClaims, ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Schedule from "effect/Schedule";
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
        const encodedObservationClaimPolicyJson = yield* encodeObservationClaimPolicyJson(f.policy);
        yield* f.fs.writeFileString(policyFile, encodedObservationClaimPolicyJson, { mode: 0o600 });
        const encodedObservationLaunchSubmissionJson = yield* encodeObservationLaunchSubmissionJson(claimSubmission());
        yield* f.fs.writeFileString(inputFile, encodedObservationLaunchSubmissionJson, {
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
        // Poll only the producer barrier; the crash operation and post-barrier assertions run once.
        yield* Effect.gen(function* () {
          const ready = yield* f.fs.exists(marker);
          if (!ready) {
            const isRunning1 = yield* child.isRunning;
            expect(isRunning1).toBe(true);
          }
          return ready;
        }).pipe(Effect.repeat({ while: (ready) => !ready, schedule: Schedule.spaced("10 millis") }));
        const readFileString1 = yield* f.fs.readFileString(marker);
        expect(readFileString1).toBe(mode);
        const exists2 = yield* f.fs.exists(output);
        expect(exists2).toBe(false);
        yield* child.kill({ killSignal: "SIGKILL" });
        const killed = yield* Effect.exit(child.exitCode);
        expect(killed._tag).toBe("Failure");
        const isRunning3 = yield* child.isRunning;
        expect(isRunning3).toBe(false);
        const exists4 = yield* f.fs.exists(operation);
        expect(exists4).toBe(mode === "after-operation" || mode === "after-observation");
        const retry = yield* run("retry");
        const exitCode5 = yield* retry.exitCode;
        expect(exitCode5).toBe(0);
        const readFileString6 = yield* f.fs.readFileString(output);
        const result = yield* decodeExecutedReasonRecordJson(readFileString6);
        expect(result).toEqual({ executed: false, reason: mode === "before-write" ? "integrity" : "claimed" });
        const exists7 = yield* f.fs.exists(operation);
        expect(exists7).toBe(mode === "after-operation" || mode === "after-observation");
        if (mode !== "before-write") {
          const claims = yield* makeObservationClaims(f.policy, f.uid);
          expect((yield* claims.snapshot).length).toBe(1);
          if (mode === "after-observation") {
            expect(
              A.map((yield* claims.readOutbox(claimSubmission().fact.launchId)).submissions, (entry) => entry.fact._tag)
            ).toEqual(["Prepared", "Started"]);
          }
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
      const encodedObservationClaimPolicyJson8 = yield* encodeObservationClaimPolicyJson(f.policy);
      yield* f.fs.writeFileString(policyFile, encodedObservationClaimPolicyJson8, {
        mode: 0o600,
      });
      const encodedObservationLaunchSubmissionJson9 = yield* encodeObservationLaunchSubmissionJson(claimSubmission());
      yield* f.fs.writeFileString(inputFile, encodedObservationLaunchSubmissionJson9, {
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
            const exitCode10 = yield* child.exitCode;
            expect(exitCode10).toBe(0);
            const readFileString11 = yield* f.fs.readFileString(output);
            return yield* decodeExecutedReasonRecordJson(readFileString11);
          }),
        { concurrency: 2 }
      );
      expect(A.filter(outcomes, (outcome) => outcome.executed).length).toBe(1);
      const readFileString12 = yield* f.fs.readFileString(`${f.root}/operation`);
      expect(readFileString12).toBe("one operation");
      expect((yield* (yield* makeObservationClaims(f.policy, f.uid)).snapshot).length).toBe(1);
    }).pipe(Effect.timeout("15 seconds"))
  )
);
