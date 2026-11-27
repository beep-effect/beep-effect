/**
 * Browser worker for ontology graph projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ApplyOntologyGraphProjectionDeltaInput,
  applyOntologyGraphProjectionDelta,
  buildOntologyGraphProjection,
  decodeWorkerCommand,
  encodeWorkerResult,
  OntologyWorkerUndecodableCommand,
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session/worker";
import * as Result from "effect/Result";

const postResult = (result: WorkerResult): void => {
  const encoded = encodeWorkerResult(result);
  if (!Result.isSuccess(encoded)) {
    throw encoded.failure;
  }
  globalThis.postMessage(encoded.success);
};

const handleCommand = (command: WorkerCommand): void => {
  WorkerCommand.match(command, {
    parseTurtle: () => undefined,
    diffDatasets: () => undefined,
    computeSnapshot: () => undefined,
    projectGraph: ({ snapshot, options }) =>
      postResult(
        WorkerResult.make({
          kind: "projectGraphSucceeded",
          result: buildOntologyGraphProjection(snapshot, options),
        })
      ),
    applyGraphDelta: ({ snapshot, previous, delta, options }) =>
      postResult(
        WorkerResult.make({
          kind: "applyGraphDeltaSucceeded",
          result: applyOntologyGraphProjectionDelta(
            ApplyOntologyGraphProjectionDeltaInput.make({ previous, snapshot, delta, options })
          ),
        })
      ),
  });
};

const pipeDecode = (data: unknown): void => {
  const decoded = decodeWorkerCommand(data);

  if (Result.isSuccess(decoded)) {
    handleCommand(decoded.success);
    return;
  }

  throw OntologyWorkerUndecodableCommand.make({ reason: String(decoded.failure) });
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  pipeDecode(event.data);
});
