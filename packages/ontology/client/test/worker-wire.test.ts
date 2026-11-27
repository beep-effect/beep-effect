import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologyGraphProjection,
  buildOntologySnapshot,
  decodeWorkerCommand,
  decodeWorkerResult,
  defaultOntologyGraphProjectionOptions,
  encodeWorkerCommand,
  encodeWorkerResult,
  OntologyGraphProjection,
  OntologyGraphProjectionOptions,
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { describe } from "@effect/vitest";
import * as Result from "effect/Result";

const isProjection = S.is(OntologyGraphProjection);

import { it } from "@beep/test-runner";
import { assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const session = createSession(
  CreateSessionInput.make({
    id: SessionId.make("session-1"),
    baseDataset: makeDataset([
      makeQuad(
        makeNamedNode("https://example.test/alice"),
        makeNamedNode("https://example.test/knows"),
        makeNamedNode("https://example.test/bob")
      ),
    ]),
  })
);

const snapshot = buildOntologySnapshot(session);

const optionsWithNoneFocusIri = OntologyGraphProjectionOptions.make({
  ...defaultOntologyGraphProjectionOptions(),
  focusIri: O.none(),
});

describe("ontology graph worker wire", () => {
  it("a command survives the structured clone the worker boundary performs", () => {
    const command = WorkerCommand.make({ kind: "projectGraph", snapshot, options: optionsWithNoneFocusIri });

    const encoded = encodeWorkerCommand(command);
    pipe(encoded, Result.isSuccess, assertTrue);
    if (!Result.isSuccess(encoded)) {
      return;
    }
    const onTheWire = structuredClone(encoded.success);
    const received = decodeWorkerCommand(onTheWire);

    pipe(received, Result.isSuccess, assertTrue);
    if (Result.isSuccess(received)) {
      pipe(S.toEquivalence(WorkerCommand)(received.success, command), assertTrue);
    }
  });

  it("a result comes back as a domain value, not a de-prototyped shape of one", () => {
    const result = WorkerResult.make({
      kind: "projectGraphSucceeded",
      result: buildOntologyGraphProjection(snapshot, optionsWithNoneFocusIri),
    });

    const usedDirectly = structuredClone(result);
    pipe(isProjection(usedDirectly.result), assertTrue);

    const encoded = encodeWorkerResult(result);
    pipe(encoded, Result.isSuccess, assertTrue);
    if (!Result.isSuccess(encoded)) {
      return;
    }
    const received = decodeWorkerResult(structuredClone(encoded.success));
    pipe(received, Result.isSuccess, assertTrue);
    if (Result.isSuccess(received)) {
      pipe(S.toEquivalence(WorkerResult)(received.success, result), assertTrue);
    }
    pipe(
      Result.isSuccess(received) && received.success.kind === "projectGraphSucceeded"
        ? isProjection(received.success.result)
        : false,
      assertTrue
    );
  });
});
