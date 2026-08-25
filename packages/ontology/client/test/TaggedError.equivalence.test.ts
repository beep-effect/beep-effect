import { OntologyGraphWorkerTimeoutError } from "@beep/ontology-client/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("ontology client tagged-error declared equivalence", () => {
  it("compares OntologyGraphWorkerTimeoutError by declared fields", () => {
    const same = S.toEquivalence(OntologyGraphWorkerTimeoutError);
    const first = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker timed out." });
    const second = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker timed out." });
    const different = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker stopped." });

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});
