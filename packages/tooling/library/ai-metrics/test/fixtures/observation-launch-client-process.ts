// Synthetic client process only: bounded fixture metadata, no harness launches.
import {
  makeObservationLaunchClient,
  ObservationLaunchClientPolicy,
} from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const program = Effect.gen(function* () {
  const [directory, hostId, namespaceId, input] = yield* S.decodeUnknownEffect(
    S.Tuple([S.String, Sha256Hex, Sha256Hex, S.String])
  )(A.drop(process.argv, 2));
  const client = yield* makeObservationLaunchClient(
    ObservationLaunchClientPolicy.make({ directory, hostId, namespaceId, timeoutMillis: 2000 }),
    process.geteuid?.() ?? -1
  );
  const context = yield* client.context;
  const fs = yield* FileSystem.FileSystem;
  let submissions: ReadonlyArray<ObservationLaunchSubmission> = [];
  if (input !== "-") {
    const stat = yield* fs.stat(input);
    if (stat.size > 65536) return yield* Effect.die("Synthetic client input exceeded its bound");
    submissions = yield* S.decodeEffect(
      S.fromJsonString(S.Array(ObservationLaunchSubmission).check(S.isMaxLength(12))),
      {
        onExcessProperty: "error",
      }
    )(yield* fs.readFileString(input));
  }
  const receipts = yield* Effect.forEach(submissions, client.submit, { concurrency: 1 });
  const encode = S.encodeEffect(
    S.fromJsonString(S.Struct({ context: ObservationLaunchContext, receipts: S.Array(ObservationLaunchReceipt) }))
  );
  yield* Console.log(yield* encode({ context, receipts }));
});
NodeRuntime.runMain(
  NodeServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  ),
  { disableErrorReporting: true }
);
