#!/usr/bin/env bun
/**
 * Dedicated bounded Bun entrypoint; avoids loading the entire command tree.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import { ObservationProcessError, runObservationWorkerProcess } from "./internal/ObservationWorker.ts";

const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.String]));

const program = Effect.gen(function* () {
  const [directory] = yield* decodeArguments(A.drop(process.argv, 2)).pipe(
    Effect.mapError(() => ObservationProcessError.make({ reason: "configuration" }))
  );
  return yield* runObservationWorkerProcess(directory);
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, NodeHttpClient.layerNodeHttp, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped,
    Effect.tapError((error) => Console.error(`Observation worker refused: ${error.reason}`))
  ),
  { disableErrorReporting: true }
);
