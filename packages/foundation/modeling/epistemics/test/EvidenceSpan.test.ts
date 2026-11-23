import {
  Confidence,
  EVIDENCE_SPAN_QUOTE_MAX_LENGTH,
  EvidenceSpan,
  EvidenceSpanArbitrary,
  isEvidenceSpanInternallyConsistent,
} from "@beep/epistemics/EvidenceSpan";
import { it } from "@beep/test-runner";
import { TextAnchor } from "@beep/text/TextAnchor";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const isSpan = S.is(EvidenceSpan);

describe("EvidenceSpan", () => {
  it.effect.prop("generates consistent spans that round-trip", [EvidenceSpanArbitrary], ([span]) =>
    Effect.gen(function* () {
      expect(EvidenceSpan.isInternallyConsistent(span)).toBe(true);
      expect(isEvidenceSpanInternallyConsistent(span)).toBe(true);
      const encoded = yield* S.encodeEffect(EvidenceSpan)(span);
      const decoded = yield* S.decodeEffect(EvidenceSpan)(encoded);
      expect(S.toEquivalence(EvidenceSpan)(decoded, span)).toBe(true);
    })
  );

  it("rejects inconsistent widths and bounds quotes to one source-text page", () => {
    const quote = Str.repeat(EVIDENCE_SPAN_QUOTE_MAX_LENGTH)("a");
    expect(isSpan({ confidence: 0.92, startChar: 0, endChar: quote.length, quote })).toBe(true);
    expect(isSpan({ confidence: 0.92, startChar: 0, endChar: quote.length + 1, quote: `${quote}a` })).toBe(false);
    expect(isSpan({ confidence: 0.92, startChar: 0, endChar: 1, quote: "fact" })).toBe(false);
  });

  it("matches exact provenance anchors in both call forms independently of confidence", () => {
    const anchor = TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(4), quote: "fact" });
    const span = EvidenceSpan.make({ ...anchor, confidence: Confidence.make(0.92) });
    const otherQuote = TextAnchor.make({ ...anchor, quote: "fake" });
    const otherOffsets = TextAnchor.make({ ...anchor, startChar: S.Natural.make(1), endChar: S.Natural.make(5) });
    expect(EvidenceSpan.matchesAnchor(span, anchor)).toBe(true);
    expect(EvidenceSpan.matchesAnchor(anchor)(span)).toBe(true);
    expect(EvidenceSpan.matchesAnchor(span, otherQuote)).toBe(false);
    expect(EvidenceSpan.matchesAnchor(span, otherOffsets)).toBe(false);
    expect(EvidenceSpan.matchesAnchor(EvidenceSpan.make({ ...span, confidence: Confidence.make(0.1) }), anchor)).toBe(
      true
    );
  });
});
