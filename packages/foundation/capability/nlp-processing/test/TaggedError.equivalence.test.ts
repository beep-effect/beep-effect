import { NLPBackend } from "@beep/nlp-processing/Backend";
import { TokenizationError } from "@beep/nlp-processing/Core";
import { NodeId, NodeNotFoundError } from "@beep/nlp-processing/Graph/EffectGraph";
import {
  ExecutionError,
  GraphError,
  OperationError,
  StorageError,
  TimeoutError,
  ValidationError,
} from "@beep/nlp-processing/Graph/GraphOperations/Errors";
import { GraphCycleError } from "@beep/nlp-processing/Graph/TextGraph";
import { ExportedToolError } from "@beep/nlp-processing/Tools/ToolExport";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("NLP processing tagged-error declared equivalence", () => {
  it("compares BackendNotSupported by declared fields", () => {
    const same = S.toEquivalence(NLPBackend.BackendNotSupported);
    const first = NLPBackend.BackendNotSupported.make({
      backend: "minimal",
      message: "Operation is unsupported.",
      operation: "parseDependencies",
    });
    const second = NLPBackend.BackendNotSupported.make({
      backend: "minimal",
      message: "Operation is unsupported.",
      operation: "parseDependencies",
    });
    const different = NLPBackend.BackendNotSupported.make({
      backend: "minimal",
      message: "Operation is unavailable.",
      operation: "parseDependencies",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores BackendInitError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(NLPBackend.BackendInitError);
    const first = NLPBackend.BackendInitError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "first" },
      message: "Backend initialization failed.",
    });
    const second = NLPBackend.BackendInitError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "second" },
      message: "Backend initialization failed.",
    });
    const different = NLPBackend.BackendInitError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "first" },
      message: "Backend initialization timed out.",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores BackendOperationError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(NLPBackend.BackendOperationError);
    const first = NLPBackend.BackendOperationError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "first" },
      message: "Backend operation failed.",
      operation: "posTag",
    });
    const second = NLPBackend.BackendOperationError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "second" },
      message: "Backend operation failed.",
      operation: "posTag",
    });
    const different = NLPBackend.BackendOperationError.make({
      backend: "wink-nlp",
      cause: { diagnostic: "first" },
      message: "Backend operation timed out.",
      operation: "posTag",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores TokenizationError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(TokenizationError);
    const first = TokenizationError.make({ cause: { diagnostic: "first" }, operation: "tokenize" });
    const second = TokenizationError.make({ cause: { diagnostic: "second" }, operation: "tokenize" });
    const different = TokenizationError.make({ cause: { diagnostic: "first" }, operation: "sentences" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares NodeNotFoundError by declared fields", () => {
    const same = S.toEquivalence(NodeNotFoundError);
    const first = NodeNotFoundError.make({ nodeId: NodeId.make("node-1") });
    const second = NodeNotFoundError.make({ nodeId: NodeId.make("node-1") });
    const different = NodeNotFoundError.make({ nodeId: NodeId.make("node-2") });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ValidationError by declared fields", () => {
    const same = S.toEquivalence(ValidationError);
    const nodeId = NodeId.make("node-1");
    const first = ValidationError.make({ errors: ["invalid input"], nodeId, operationName: "validate" });
    const second = ValidationError.make({ errors: ["invalid input"], nodeId, operationName: "validate" });
    const different = ValidationError.make({ errors: ["missing input"], nodeId, operationName: "validate" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares TimeoutError by declared fields", () => {
    const same = S.toEquivalence(TimeoutError);
    const nodeId = NodeId.make("node-1");
    const first = TimeoutError.make({ nodeId, operationName: "summarize", timeoutMs: 1_000 });
    const second = TimeoutError.make({ nodeId, operationName: "summarize", timeoutMs: 1_000 });
    const different = TimeoutError.make({ nodeId, operationName: "summarize", timeoutMs: 2_000 });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores OperationError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(OperationError);
    const nodeId = NodeId.make("node-1");
    const first = OperationError.make({ cause: { diagnostic: "first" }, nodeId, operationName: "summarize" });
    const second = OperationError.make({ cause: { diagnostic: "second" }, nodeId, operationName: "summarize" });
    const different = OperationError.make({ cause: { diagnostic: "first" }, nodeId, operationName: "rank" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares GraphError by declared fields", () => {
    const same = S.toEquivalence(GraphError);
    const first = GraphError.make({ message: "Graph is invalid.", nodeId: O.none() });
    const second = GraphError.make({ message: "Graph is invalid.", nodeId: O.none() });
    const different = GraphError.make({ message: "Graph contains a cycle.", nodeId: O.none() });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores StorageError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(StorageError);
    const first = StorageError.make({ cause: { diagnostic: "first" }, operation: "store" });
    const second = StorageError.make({ cause: { diagnostic: "second" }, operation: "store" });
    const different = StorageError.make({ cause: { diagnostic: "first" }, operation: "retrieve" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores ExecutionError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(ExecutionError);
    const first = ExecutionError.make({ cause: O.some({ diagnostic: "first" }), message: "Execution failed." });
    const second = ExecutionError.make({ cause: O.some({ diagnostic: "second" }), message: "Execution failed." });
    const different = ExecutionError.make({ cause: O.some({ diagnostic: "first" }), message: "Execution timed out." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares GraphCycleError by declared fields", () => {
    const same = S.toEquivalence(GraphCycleError);
    const first = GraphCycleError.make({ parentIndex: 1 });
    const second = GraphCycleError.make({ parentIndex: 1 });
    const different = GraphCycleError.make({ parentIndex: 2 });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores ExportedToolError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(ExportedToolError);
    const first = ExportedToolError.make({
      cause: O.some({ diagnostic: "first" }),
      message: "Tool export failed.",
      toolName: "analyze",
    });
    const second = ExportedToolError.make({
      cause: O.some({ diagnostic: "second" }),
      message: "Tool export failed.",
      toolName: "analyze",
    });
    const different = ExportedToolError.make({
      cause: O.some({ diagnostic: "first" }),
      message: "Tool export timed out.",
      toolName: "analyze",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });
});
