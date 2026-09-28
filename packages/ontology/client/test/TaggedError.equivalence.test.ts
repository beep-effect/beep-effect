import { OntologyGraphWorkerTimeoutError } from "@beep/ontology-client/aggregates/Session";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

describe("ontology client tagged-error declared equivalence", () => {
  it("compares OntologyGraphWorkerTimeoutError by declared fields", () => {
    const same = S.toEquivalence(OntologyGraphWorkerTimeoutError);
    const first = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker timed out." });
    const second = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker timed out." });
    const different = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker stopped." });

    pipe(same(first, second), assertTrue);
    pipe(same(first, different), assertFalse);
  });
});
