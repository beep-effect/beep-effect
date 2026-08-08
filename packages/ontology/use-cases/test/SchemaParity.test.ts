import { ChangeOperation, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyBatchCommand,
  ApplyOntologyBatchResult,
  DiffWorkerResult,
  ExportOntologyProvenanceCommand,
  ExportOntologyProvenanceResult,
  OntologyActionError,
  OntologyFilePath,
  OntologyRepairProposal,
  OntologySnapshot,
  OpenOntologyDocumentResult,
  OpenOntologyFileCommand,
  ParseTurtleRequest,
  ParseTurtleResult,
  PreviewOntologyTurtleResult,
  RunOntologyValidationInput,
  RunOntologyValidationResult,
  SaveOntologyDocumentResult,
  SerializeTurtleRequest,
  TurtleCodecError,
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Equal, Option as O, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const sessionId = Result.getOrThrow(S.decodeResult(SessionId)("session-1"));
const fixturePath = Result.getOrThrow(S.decodeResult(OntologyFilePath)("fixtures/demo.ttl"));
const quad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/name"),
  makeLiteral("Alice", XSD_STRING.value)
);
const dataset = makeDataset([quad]);

const schemaRoundTripCases: ReadonlyArray<
  readonly [string, S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>]
> = [
  ["OpenOntologyFileCommand", OpenOntologyFileCommand],
  ["OpenOntologyDocumentResult", OpenOntologyDocumentResult],
  ["SaveOntologyDocumentResult", SaveOntologyDocumentResult],
  ["PreviewOntologyTurtleResult", PreviewOntologyTurtleResult],
  ["ApplyOntologyBatchCommand", ApplyOntologyBatchCommand],
  ["ApplyOntologyBatchResult", ApplyOntologyBatchResult],
  ["OntologyRepairProposal", OntologyRepairProposal],
  ["RunOntologyValidationInput", RunOntologyValidationInput],
  ["RunOntologyValidationResult", RunOntologyValidationResult],
  ["ExportOntologyProvenanceCommand", ExportOntologyProvenanceCommand],
  ["ExportOntologyProvenanceResult", ExportOntologyProvenanceResult],
  ["OntologyActionError", OntologyActionError],
  ["OntologySnapshot", OntologySnapshot],
  ["WorkerCommand", WorkerCommand],
  ["WorkerResult", WorkerResult],
  ["TurtleCodecError", TurtleCodecError],
];

const assertRoundTrips = <Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>>(
  schema: Schema
): void => {
  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
      const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));
      expect(Equal.equals(decoded, value)).toBe(true);
    }),
    fcRuns(25)
  );
};

describe("@beep/ontology-use-cases schema parity", () => {
  it.each(schemaRoundTripCases)("round-trips schema-derived %s samples", (_name, schema) => {
    assertRoundTrips(schema);
  });

  it("preserves command and worker protocol encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        S.encodeResult(OpenOntologyFileCommand)(
          OpenOntologyFileCommand.make({
            sessionId,
            path: fixturePath,
          })
        )
      )
    ).toStrictEqual({
      path: "fixtures/demo.ttl",
      sessionId: "session-1",
    });

    expect(
      Result.getOrThrow(
        S.encodeResult(WorkerCommand)(
          WorkerCommand.make({
            kind: "parseTurtle",
            request: ParseTurtleRequest.make({
              source: "@prefix ex: <https://example.test/> .",
              baseIri: O.some("https://example.test/"),
            }),
          })
        )
      )
    ).toStrictEqual({
      kind: "parseTurtle",
      request: {
        baseIri: "https://example.test/",
        source: "@prefix ex: <https://example.test/> .",
      },
    });
  });

  it("round-trips typed port errors and worker results", () => {
    const error = TurtleCodecError.make({
      reason: "parseFailed",
      message: "bad turtle",
    });
    const command = SerializeTurtleRequest.make({ dataset });
    const result = WorkerResult.make({
      kind: "diffDatasetsSucceeded",
      result: DiffWorkerResult.make({
        operations: [
          ChangeOperation.make({
            kind: "addQuad",
            partition: "asserted",
            quad,
          }),
        ],
      }),
    });
    const parsed = ParseTurtleResult.make({ dataset });

    expect(
      Result.getOrThrow(S.decodeResult(TurtleCodecError)(Result.getOrThrow(S.encodeResult(TurtleCodecError)(error))))
    ).toEqual(error);
    expect(
      Result.getOrThrow(
        S.decodeResult(SerializeTurtleRequest)(Result.getOrThrow(S.encodeResult(SerializeTurtleRequest)(command)))
      )
    ).toEqual(command);
    expect(
      Result.getOrThrow(S.decodeResult(ParseTurtleResult)(Result.getOrThrow(S.encodeResult(ParseTurtleResult)(parsed))))
    ).toEqual(parsed);
    expect(
      Result.getOrThrow(S.decodeResult(WorkerResult)(Result.getOrThrow(S.encodeResult(WorkerResult)(result))))
    ).toEqual(result);
  });
});
