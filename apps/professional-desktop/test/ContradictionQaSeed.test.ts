import { SOURCE_TEXT_PAGE_CODE_UNITS } from "@beep/file-processing/SourceText";
import * as Str from "@beep/utils/Str";
import { describe, expect, it } from "@effect/vitest";
import {
  CONTRADICTION_QA_ANCHOR_START,
  CONTRADICTION_QA_SEED_ENV,
  CONTRADICTION_QA_SOURCE_LOCATOR,
  CONTRADICTION_QA_SOURCE_TEXT,
  CONTRADICTION_QA_VAULT_ROOT_ENV,
} from "@/contradiction/ContradictionQaSeed";

describe("Professional Desktop contradiction QA seed contract", () => {
  it("keeps the opt-in names and shifted source anchor deterministic", () => {
    expect(CONTRADICTION_QA_SEED_ENV).toBe("BEEP_CONTRADICTION_QA_SEED");
    expect(CONTRADICTION_QA_VAULT_ROOT_ENV).toBe("BEEP_CONTRADICTION_QA_VAULT_ROOT");
    expect(CONTRADICTION_QA_SOURCE_LOCATOR).toBe("qa/contradiction-triage/surrogate-boundary.txt");
    expect(CONTRADICTION_QA_ANCHOR_START).toBe(SOURCE_TEXT_PAGE_CODE_UNITS - 1);
    expect(Str.length(CONTRADICTION_QA_SOURCE_TEXT)).toBeGreaterThan(SOURCE_TEXT_PAGE_CODE_UNITS);
    expect(Str.slice(CONTRADICTION_QA_ANCHOR_START)(CONTRADICTION_QA_SOURCE_TEXT)).toMatch(
      /^🧭 The executed amendment/
    );
  });
});
