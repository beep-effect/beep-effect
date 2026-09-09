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
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeParseTurtleResultResult = S.decodeResult(ParseTurtleResult);
const decodeSerializeTurtleRequestResult = S.decodeResult(SerializeTurtleRequest);
const decodeTurtleCodecErrorResult = S.decodeResult(TurtleCodecError);
const decodeWorkerResultResult = S.decodeResult(WorkerResult);
const encodeOpenOntologyFileCommandResult = S.encodeResult(OpenOntologyFileCommand);
const encodeParseTurtleResultResult = S.encodeResult(ParseTurtleResult);
const encodeSerializeTurtleRequestResult = S.encodeResult(SerializeTurtleRequest);
const encodeTurtleCodecErrorResult = S.encodeResult(TurtleCodecError);
const encodeWorkerCommandResult = S.encodeResult(WorkerCommand);
const encodeWorkerResultResult = S.encodeResult(WorkerResult);

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

// The batch protocols multiply Quad-heavy components (session × delta ×
// operations with the partition coherence filter), so native generation
// discards far more aggressively there than on the flat protocols. Budgets
// sit well above the observed exhaustion thresholds under rotating seeds;
// runs are never reduced.
const deepDiscardBudgets: Partial<Record<string, number>> = {
  ApplyOntologyBatchCommand: 10_000,
  ApplyOntologyBatchResult: 50_000,
};

const assertRoundTrips = <Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>>(
  schema: Schema,
  discardsPerRun: number
): void => {
  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(schema)]),
        ([value]) => {
          const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
          const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));
          expect(Equal.equals(decoded, value)).toBe(true);

          return true;
        },
        // Preserve the run count while allowing native partition/quad rejection.
        { ...fcRuns(25), maxDiscards: fcRuns(25).runs * discardsPerRun }
      )
    )._tag
  ).toBe("Passed");
};

describe("@beep/ontology-use-cases schema parity", () => {
  it.each(schemaRoundTripCases)("round-trips schema-derived %s samples", (name, schema) => {
    assertRoundTrips(schema, deepDiscardBudgets[name] ?? 100);
  });

  it("preserves command and worker protocol encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        encodeOpenOntologyFileCommandResult(
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
        encodeWorkerCommandResult(
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
      Result.getOrThrow(decodeTurtleCodecErrorResult(Result.getOrThrow(encodeTurtleCodecErrorResult(error))))
    ).toEqual(error);
    expect(
      Result.getOrThrow(
        decodeSerializeTurtleRequestResult(Result.getOrThrow(encodeSerializeTurtleRequestResult(command)))
      )
    ).toEqual(command);
    expect(
      Result.getOrThrow(decodeParseTurtleResultResult(Result.getOrThrow(encodeParseTurtleResultResult(parsed))))
    ).toEqual(parsed);
    expect(Result.getOrThrow(decodeWorkerResultResult(Result.getOrThrow(encodeWorkerResultResult(result))))).toEqual(
      result
    );
  });
});
