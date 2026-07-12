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
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session/worker";
import { Result } from "effect";

// The boundary is a structured clone, not a channel that carries types, so both
// ends speak the ENCODED form. See the codecs in Session.worker-protocol.ts for
// what posting a decoded value did to this worker.
const postResult = (result: WorkerResult): void => {
  globalThis.postMessage(encodeWorkerResult(result));
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

  // A command this worker cannot read is not something to shrug at. Dropping it
  // is what made the graph inexplicable: the worker was alive and being messaged,
  // and it answered nothing, so the workbench sat on "pending" with no error to
  // show and no way to find out why. Throwing surfaces it as an `error` event on
  // the parent, which fails the graph out loud.
  throw new Error(`Ontology graph worker received a command it could not decode: ${decoded.failure}`);
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  pipeDecode(event.data);
});
