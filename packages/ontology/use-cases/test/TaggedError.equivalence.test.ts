import {
  OntologyActionError,
  OntologyFilePath,
  OntologyFileStoreError,
  OntologySparqlError,
  OntologyValidationError,
  OntologyWorkerUndecodableCommand,
  TurtleCodecError,
} from "@beep/ontology-use-cases/aggregates/Session";
import {
  OntologyActorIdentityRefusal,
  OntologyBudgetRefusal,
  OntologyCasConflict,
  OntologyFingerprint,
  OntologyNoOpRefusal,
  OntologyReasonerDriftRefusal,
  OntologyTierGateRefusal,
  OntologyToolExecutionError,
} from "@beep/ontology-use-cases/tools";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("ontology use-case tagged-error declared equivalence", () => {
  it("compares TurtleCodecError by declared fields", () => {
    const same = S.toEquivalence(TurtleCodecError);
    const first = TurtleCodecError.make({ reason: "parseFailed", message: "Turtle parse failed." });
    const second = TurtleCodecError.make({ reason: "parseFailed", message: "Turtle parse failed." });
    const different = TurtleCodecError.make({ reason: "parseFailed", message: "Turtle parse was rejected." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyFileStoreError by declared fields", () => {
    const same = S.toEquivalence(OntologyFileStoreError);
    const path = OntologyFilePath.make("fixtures/demo.ttl");
    const first = OntologyFileStoreError.make({ reason: "readFailed", path, message: "File read failed." });
    const second = OntologyFileStoreError.make({ reason: "readFailed", path, message: "File read failed." });
    const different = OntologyFileStoreError.make({ reason: "readFailed", path, message: "File read timed out." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyActionError by declared fields", () => {
    const same = S.toEquivalence(OntologyActionError);
    const first = OntologyActionError.new("Ontology action failed.");
    const second = OntologyActionError.new("Ontology action failed.");
    const different = OntologyActionError.new("Ontology action was rejected.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologySparqlError by declared fields", () => {
    const same = S.toEquivalence(OntologySparqlError);
    const first = OntologySparqlError.make({ reason: "profileMismatch", message: "SPARQL profile mismatch." });
    const second = OntologySparqlError.make({ reason: "profileMismatch", message: "SPARQL profile mismatch." });
    const different = OntologySparqlError.make({ reason: "engineFailed", message: "SPARQL profile mismatch." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyValidationError by declared fields", () => {
    const same = S.toEquivalence(OntologyValidationError);
    const first = OntologyValidationError.make({ reason: "shaclFailed", message: "SHACL validation failed." });
    const second = OntologyValidationError.make({ reason: "shaclFailed", message: "SHACL validation failed." });
    const different = OntologyValidationError.make({
      reason: "repairVerificationFailed",
      message: "SHACL validation failed.",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyWorkerUndecodableCommand by declared fields", () => {
    const same = S.toEquivalence(OntologyWorkerUndecodableCommand);
    const first = OntologyWorkerUndecodableCommand.make({ reason: "Invalid graph command." });
    const second = OntologyWorkerUndecodableCommand.make({ reason: "Invalid graph command." });
    const different = OntologyWorkerUndecodableCommand.make({ reason: "Unknown graph command." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyCasConflict by declared fields", () => {
    const same = S.toEquivalence(OntologyCasConflict);
    const expectedFingerprint = OntologyFingerprint.make("0".repeat(64));
    const currentFingerprint = OntologyFingerprint.make("1".repeat(64));
    const first = OntologyCasConflict.make({
      expectedFingerprint,
      currentFingerprint,
      guidance: "Refetch and retry.",
      recoverable: true,
    });
    const second = OntologyCasConflict.make({
      expectedFingerprint,
      currentFingerprint,
      guidance: "Refetch and retry.",
      recoverable: true,
    });
    const different = OntologyCasConflict.make({
      expectedFingerprint,
      currentFingerprint: OntologyFingerprint.make("2".repeat(64)),
      guidance: "Refetch and retry.",
      recoverable: true,
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyBudgetRefusal by declared fields", () => {
    const same = S.toEquivalence(OntologyBudgetRefusal);
    const first = OntologyBudgetRefusal.make({
      kind: "changeOperations",
      actual: NonNegativeInt.make(12),
      limit: NonNegativeInt.make(10),
      guidance: "Reduce the change batch.",
      recoverable: true,
    });
    const second = OntologyBudgetRefusal.make({
      kind: "changeOperations",
      actual: NonNegativeInt.make(12),
      limit: NonNegativeInt.make(10),
      guidance: "Reduce the change batch.",
      recoverable: true,
    });
    const different = OntologyBudgetRefusal.make({
      kind: "changeOperations",
      actual: NonNegativeInt.make(13),
      limit: NonNegativeInt.make(10),
      guidance: "Reduce the change batch.",
      recoverable: true,
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyReasonerDriftRefusal by declared fields", () => {
    const same = S.toEquivalence(OntologyReasonerDriftRefusal);
    const first = OntologyReasonerDriftRefusal.make({
      actual: NonNegativeInt.make(12),
      cap: NonNegativeInt.make(10),
      guidance: "Reduce inferred drift.",
      recoverable: true,
    });
    const second = OntologyReasonerDriftRefusal.make({
      actual: NonNegativeInt.make(12),
      cap: NonNegativeInt.make(10),
      guidance: "Reduce inferred drift.",
      recoverable: true,
    });
    const different = OntologyReasonerDriftRefusal.make({
      actual: NonNegativeInt.make(12),
      cap: NonNegativeInt.make(11),
      guidance: "Reduce inferred drift.",
      recoverable: true,
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyNoOpRefusal by declared fields", () => {
    const same = S.toEquivalence(OntologyNoOpRefusal);
    const first = OntologyNoOpRefusal.make({ guidance: "Propose a real delta.", recoverable: true });
    const second = OntologyNoOpRefusal.make({ guidance: "Propose a real delta.", recoverable: true });
    const different = OntologyNoOpRefusal.make({ guidance: "Refetch before retrying.", recoverable: true });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyActorIdentityRefusal by declared fields", () => {
    const same = S.toEquivalence(OntologyActorIdentityRefusal);
    const first = OntologyActorIdentityRefusal.make({ guidance: "Authenticate and retry.", recoverable: true });
    const second = OntologyActorIdentityRefusal.make({ guidance: "Authenticate and retry.", recoverable: true });
    const different = OntologyActorIdentityRefusal.make({ guidance: "Restart the session.", recoverable: true });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyTierGateRefusal by declared fields", () => {
    const same = S.toEquivalence(OntologyTierGateRefusal);
    const first = OntologyTierGateRefusal.make({ guidance: "Resolve the mutation tier.", recoverable: true });
    const second = OntologyTierGateRefusal.make({ guidance: "Resolve the mutation tier.", recoverable: true });
    const different = OntologyTierGateRefusal.make({ guidance: "Request tier approval.", recoverable: true });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares OntologyToolExecutionError by declared fields", () => {
    const same = S.toEquivalence(OntologyToolExecutionError);
    const first = OntologyToolExecutionError.make({
      operation: "open-inspect",
      message: "The file could not be opened.",
      recoverable: false,
    });
    const second = OntologyToolExecutionError.make({
      operation: "open-inspect",
      message: "The file could not be opened.",
      recoverable: false,
    });
    const different = OntologyToolExecutionError.make({
      operation: "open-inspect",
      message: "The file could not be read.",
      recoverable: false,
    });

    expectDeclaredEquivalence(same, first, second, different);
  });
});
