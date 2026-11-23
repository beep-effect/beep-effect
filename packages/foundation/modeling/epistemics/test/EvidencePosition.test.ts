import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { EvidencePosition, ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { it } from "@beep/test-runner";
import { TextAnchor } from "@beep/text/TextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodePosition = S.decodeUnknownResult(EvidencePosition);
const positionArbitrary = Arbitrary.schema(EvidencePosition);
const positionEquivalent = S.toEquivalence(EvidencePosition);
const anchorEquivalent = S.toEquivalence(TextAnchor);
const json = S.fromJsonString(EvidencePosition);
const anchor = TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(4), quote: "fact" });

describe("independent evidence position and extraction observation", () => {
  it.effect.prop("round-trips coherent positions and total confidence carriers", [positionArbitrary], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(json)(value);
      const decoded = yield* S.decodeEffect(json)(encoded);
      expect(positionEquivalent(value, decoded)).toBe(true);
      expect(TextAnchor.isInternallyConsistent(decoded.position)).toBe(true);
    })
  );

  it("bounds evidence pages and refuses inconsistent widths and unknown versions", () => {
    const wire = (quote: string, endChar = Str.length(quote)) => ({
      version: "evidence-position/v2",
      position: { startChar: 0, endChar, quote },
      extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
    });
    pipe(decodePosition(wire(Str.repeat(65_536)("a"))), Result.isSuccess, assertTrue);
    pipe(decodePosition(wire(Str.repeat(65_537)("a"))), Result.isFailure, assertTrue);
    pipe(decodePosition(wire("fact", 1)), Result.isFailure, assertTrue);
    pipe(decodePosition({ ...wire("fact"), version: "evidence-position/v3" }), Result.isFailure, assertTrue);
    pipe(decodePosition(wire("")), Result.isFailure, assertTrue);
  });

  it("preserves explicit zero and one independently of an unchanged anchor", () => {
    const absent = EvidencePosition.make({
      position: anchor,
      extractorConfidence: ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" }),
    });
    for (const value of [0, 1]) {
      const present = EvidencePosition.make({
        position: anchor,
        extractorConfidence: ExtractorConfidence.cases.Present.make({
          value: ReportedConfidence.make({
            value: Confidence.make(value),
            method: "synthetic-fixture",
            producer: O.none(),
          }),
        }),
      });
      expect(anchorEquivalent(absent.position, present.position)).toBe(true);
      expect(present.extractorConfidence).toMatchObject({ _tag: "Present", value: { value } });
    }
    expect(absent.extractorConfidence).toEqual({ _tag: "Absent", reason: "not-assessed" });
  });
});
