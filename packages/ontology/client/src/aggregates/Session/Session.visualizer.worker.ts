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
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session/worker";
import { Result } from "effect";
import * as S from "effect/Schema";

const decodeWorkerCommand = S.decodeUnknownResult(WorkerCommand);

const postResult = (result: WorkerResult): void => {
  globalThis.postMessage(result);
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

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  pipeDecode(event.data);
});

const pipeDecode = (data: unknown): void => {
  const decoded = decodeWorkerCommand(data);

  if (Result.isSuccess(decoded)) {
    handleCommand(decoded.success);
  }
};
