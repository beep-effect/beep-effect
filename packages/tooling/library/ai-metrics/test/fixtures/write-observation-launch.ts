// Synthetic configuration writer only. No real source paths or credentials.

import { ObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch";
import { ObservationLaunchHttpPolicy } from "@beep/repo-ai-metrics/observation-launch-http";
import { ObservationRuntimePolicy } from "@beep/repo-ai-metrics/observation-runtime";
import { TranscriptDiscoveryReadPolicy } from "@beep/repo-ai-metrics/transcript-discovery";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { launchFixture } from "./observation-launch-config.ts";

const program = Effect.gen(function* () {
  const [directory, origin, sourceDirectory] = yield* S.decodeUnknownEffect(S.Tuple([S.String, S.String, S.String]))(
    A.drop(process.argv, 2)
  );
  const fs = yield* FileSystem.FileSystem;
  const base = yield* launchFixture(origin);
  const config = ObservationLaunchConfig.make({
    ...base,
    launchHttp: O.some(
      ObservationLaunchHttpPolicy.make({
        routes: [
          { routeId: Sha256Hex.make(Str.repeat(64)("c")), harness: "codex-cli", surface: "cli" },
          { routeId: Sha256Hex.make(Str.repeat(64)("d")), harness: "chatgpt-desktop", surface: "desktop" },
        ],
        bodyTimeoutMillis: 1000,
      })
    ),
    discovery:
      sourceDirectory === "-"
        ? O.none()
        : O.some({
            roots: [
              { path: sourceDirectory, source: "codex", retired: false },
              { path: `${sourceDirectory}-retired`, source: "claude", retired: true },
            ],
            maxDepth: 2,
            maxEntries: 3,
            maxFiles: 1,
            maxCycleEntries: 128,
            read: TranscriptDiscoveryReadPolicy.make({ maxBytes: 1024, maxLineBytes: 512, maxFrames: 2 }),
            runtime: ObservationRuntimePolicy.make({
              intervalMillis: 100,
              cycleTimeoutMillis: 2000,
              staleAfterMillis: 3000,
            }),
          }),
  });
  yield* fs.writeFileString(
    `${directory}/worker.json`,
    yield* S.encodeEffect(S.fromJsonString(ObservationLaunchConfig))(config),
    { mode: 0o600 }
  );
});
NodeRuntime.runMain(
  Layer.merge(NodeServices.layer, NodeCrypto.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
