import {
  DocStructureAbstentionCode,
  DocStructureRuleFamily,
  recognizeOfficeActionPair,
} from "@beep/law-practice-domain";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Str from "effect/String";

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
  });
});
