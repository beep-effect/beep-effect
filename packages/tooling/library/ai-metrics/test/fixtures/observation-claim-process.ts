// Owned synthetic crash boundaries; never used by production launchers.
import { makeObservationClaims, ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { claimFileFault } from "./claim-file-fault.ts";

const program = Effect.gen(function* () {
  const [policyFile, submissionFile, mode, output, marker, operationFile] = yield* S.decodeUnknownEffect(
    S.Tuple([S.String, S.String, S.String, S.String, S.String, S.String])
  )(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const policy = yield* S.decodeEffect(S.fromJsonString(ObservationClaimPolicy))(yield* fs.readFileString(policyFile));
  const submission = yield* S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission))(
    yield* fs.readFileString(submissionFile)
  );
  const boundary = fs.writeFileString(marker, mode, { mode: 0o600 }).pipe(Effect.andThen(Effect.never));
  const injected: FileSystem.FileSystem = {
    ...fs,
    open: (file, options) =>
      fs.open(file, options).pipe(
        Effect.map((handle) => {
          if (mode === "before-write" && file === `${policy.directory}/claim-0.json` && options?.flag === "wx")
            return claimFileFault({ handle, writeAll: () => boundary });
          if (mode === "after-sync" && file === policy.directory)
            return claimFileFault({ handle, sync: handle.sync.pipe(Effect.andThen(boundary)) });
          return handle;
        })
      ),
  };
  const claims = yield* makeObservationClaims(policy, process.geteuid?.() ?? -1).pipe(
    Effect.provideService(FileSystem.FileSystem, injected)
  );
  const result = yield* claims
    .runOnce(submission, () =>
      fs.writeFileString(operationFile, "one operation", { flag: "wx", mode: 0o600 }).pipe(
        Effect.andThen(
          mode === "after-observation"
            ? claims
                .appendObservation(
                  ObservationLaunchSubmission.make({
                    ...submission,
                    fact: ObservationLaunchFact.cases.Started.make({
                      launchId: submission.fact.launchId,
                      processInstanceId: submission.hostId,
                    }),
                  })
                )
                .pipe(Effect.andThen(boundary))
            : mode === "after-operation"
              ? boundary
              : Effect.void
        ),
        Effect.as({ executed: true, reason: "none" })
      )
    )
    .pipe(
      Effect.catchTag("ObservationClaimError", (error) => Effect.succeed({ executed: false, reason: error.reason }))
    );
  yield* fs.writeFileString(
    output,
    yield* S.encodeEffect(S.fromJsonString(S.Struct({ executed: S.Boolean, reason: S.String })))(result),
    { mode: 0o600 }
  );
});
NodeRuntime.runMain(
  NodeServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  ),
  { disableErrorReporting: true }
);
