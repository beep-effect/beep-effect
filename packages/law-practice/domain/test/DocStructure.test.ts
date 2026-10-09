import {
  DocStructureAbstentionCode,
  DocStructureDocument,
  DocStructureRuleFamily,
  OfficeActionFinalityCandidate,
  OfficeActionRecognizedPair,
  officeActionRuleV1,
  recognizeOfficeActionPair,
  ShortenedStatutoryPeriodCandidate,
} from "@beep/law-practice-domain";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixtureSource, TestCrypto } from "./officeActionFixtures.ts";

const finality = "THIS ACTION IS MADE FINAL";
const period =
  "A shortened statutory period for reply to this final action is set to expire THREE MONTHS from the mailing date of this action.";
const positive = `${finality}\n${period}`;
describe("office-action pure raw rule v1", () => {
  it("preserves UTF-16 coordinates through supplementary Unicode, whitespace and page straddle", () => {
    const text = `😀Header\n${finality}\f${period}`;
    const outcome = recognizeOfficeActionPair(text, "direct-text");
    expect(outcome.status).toBe("recognized");
    if (outcome.status === "recognized") {
      expect(outcome.finality).toBe("FINAL");
      for (const anchor of [outcome.finalityAnchor, outcome.periodAnchor])
        expect(Str.slice(anchor.startChar, anchor.endChar)(text)).toBe(anchor.quote);
      expect(outcome.finalityAnchor.startChar).toBe(9);
    }
    expect(recognizeOfficeActionPair("direct-text")(text)).toEqual(outcome);
    expect(
      recognizeOfficeActionPair(
        "direct-text",
        DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 2 })
      )(text)
    ).toMatchObject({ code: "rule-not-covered" });
  });
  it("keeps all five typed closed outcomes free of candidate payloads", () => {
    const cases = [
      { text: period, modality: "direct-text", code: "absent" },
      { text: `${positive}\n${finality}`, modality: "direct-text", code: "ambiguous" },
      { text: `Advisory Action\n${positive}`, modality: "direct-text", code: "unsupported" },
      { text: positive, modality: "ocr-derived", code: "low-quality-source" },
      { text: "Unknown procedural form", modality: "direct-text", code: "rule-not-covered" },
    ];
    for (const row of cases) {
      const outcome = recognizeOfficeActionPair(
        row.text,
        row.modality === "ocr-derived" ? "ocr-derived" : "direct-text"
      );
      expect(outcome).toMatchObject({ status: "abstained", code: row.code });
      expect("candidates" in outcome).toBe(false);
      expect(S.is(DocStructureAbstentionCode)(row.code)).toBe(true);
    }
  });
  it("never recovers selection from an empty checkbox or historical attachment", () => {
    expect(recognizeOfficeActionPair(`[ ] FINAL [ ] NON-FINAL\n${period}`, "direct-text")).toMatchObject({
      code: "ambiguous",
    });
    expect(recognizeOfficeActionPair(`Attachment: prior action\n${positive}`, "direct-text")).toMatchObject({
      code: "absent",
    });
    expect(recognizeOfficeActionPair(positive, "layout-derived")).toMatchObject({ code: "low-quality-source" });
    expect(recognizeOfficeActionPair(positive, "embedded-pdf-text").status).toBe("recognized");
    expect(recognizeOfficeActionPair(`This action is NON-FINAL.\n${period}`, "direct-text")).toMatchObject({
      finality: "NON-FINAL",
    });
  });
});

it.layer(TestCrypto)("candidate metadata coherence", (it) => {
  it.effect("rejects mismatched source, document and rule metadata atomically", () =>
    Effect.gen(function* () {
      const original = yield* fixtureSource(positive);
      const changed = yield* fixtureSource(`prefix ${positive}`);
      const raw = recognizeOfficeActionPair(positive, "direct-text");
      if (raw.status !== "recognized") return yield* Effect.die("Expected pair");
      const firstProof = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: raw.finalityAnchor,
          verifiedSource: original.verifiedSource,
        })
      );
      const periodProof = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: raw.periodAnchor,
          verifiedSource: original.verifiedSource,
        })
      );
      const common = {
        schemaVersion: "1",
        source: original.source,
        document: DocStructureDocument.make({ documentId: "fixture", sourceVersion: "1", modality: "direct-text" }),
        rule: officeActionRuleV1,
        confidence: UnitInterval.make(0.95),
      };
      const first = OfficeActionFinalityCandidate.make({
        ...common,
        schemaVersion: "1",
        anchor: firstProof,
        finality: "FINAL",
      });
      const period = (overrides: Partial<typeof common> = {}) =>
        ShortenedStatutoryPeriodCandidate.make({
          ...common,
          ...overrides,
          schemaVersion: "1",
          anchor: periodProof,
          months: 3,
        });
      expect(OfficeActionRecognizedPair.make({ candidates: [first, period()] }).candidates).toHaveLength(2);
      expect(() =>
        OfficeActionFinalityCandidate.make({
          ...common,
          schemaVersion: "1",
          source: changed.source,
          anchor: firstProof,
          finality: "FINAL",
        })
      ).toThrow();
      expect(() => period({ source: changed.source })).toThrow();
      for (const second of [
        period({ document: DocStructureDocument.make({ ...common.document, documentId: "other" }) }),
        period({ rule: DocStructureRuleFamily.make({ ...officeActionRuleV1, version: 2 }) }),
      ])
        expect(() => OfficeActionRecognizedPair.make({ candidates: [first, second] })).toThrow();
      const otherProof = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(6), quote: "prefix" }),
          verifiedSource: changed.verifiedSource,
        })
      );
      const otherPeriod = ShortenedStatutoryPeriodCandidate.make({
        ...common,
        schemaVersion: "1",
        source: changed.source,
        anchor: otherProof,
        months: 3,
      });
      expect(() => OfficeActionRecognizedPair.make({ candidates: [first, otherPeriod] })).toThrow();
    })
  );
});
