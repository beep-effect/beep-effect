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
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";

const isProjection = S.is(OntologyGraphProjection);

import * as O from "effect/Option";
import * as S from "effect/Schema";

// The worker boundary is a structured clone: it copies own enumerable properties
// and drops prototypes. Anything the two ends exchange has to survive that, which
// is why both sides speak the ENCODED form. `structuredClone` here IS the boundary
// — it is exactly what `postMessage` does to the value.
const session = createSession(
  CreateSessionInput.make({
    id: S.decodeSync(SessionId)("session-1"),
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

// `focusIri: none` is the whole bug: Effect's `Option.none()` keeps `_tag`/`_id` on
// its PROTOTYPE, so a clone of the decoded value delivers a bare `{}` — a key that
// is present but is not the `string | absent` the wire expects.
const options = OntologyGraphProjectionOptions.make({
  ...defaultOntologyGraphProjectionOptions(),
  focusIri: O.none(),
});

describe("ontology graph worker wire", () => {
  it("a command survives the structured clone the worker boundary performs", () => {
    // The parent used to post the DECODED command. The worker decoded it against the
    // encoded schema, the decode failed on `focusIri`, and the worker dropped it in
    // silence: no reply, no throw, no error event. The graph sat on "pending"
    // forever, and nothing anywhere said why.
    const command = WorkerCommand.make({ kind: "projectGraph", snapshot, options });

    const onTheWire = structuredClone(encodeWorkerCommand(command));
    const received = decodeWorkerCommand(onTheWire);

    expect(Result.isSuccess(received)).toBe(true);
  });

  it("a result comes back as a domain value, not a de-prototyped shape of one", () => {
    // The return path had the same defect mirrored: the worker posted the decoded
    // result and the parent never decoded it at all, so what the parent held was a
    // plain object wearing the shape of a domain value — every method and branded
    // field gone. It only *looked* fine because `kind` is a bare string that
    // survives cloning.
    const result = WorkerResult.make({
      kind: "projectGraphSucceeded",
      result: buildOntologyGraphProjection(snapshot, options),
    });

    // What the parent used to consume: the clone, used directly.
    const usedDirectly = structuredClone(result);
    expect(isProjection(usedDirectly.result)).toBe(false);

    // What it consumes now: decoded back into the domain.
    const received = decodeWorkerResult(structuredClone(encodeWorkerResult(result)));
    expect(Result.isSuccess(received)).toBe(true);
    expect(
      Result.isSuccess(received) && received.success.kind === "projectGraphSucceeded"
        ? isProjection(received.success.result)
        : false
    ).toBe(true);
  });
});
