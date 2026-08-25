import { HubSpotError } from "@beep/hubspot";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameHubSpotError = S.toEquivalence(HubSpotError);

describe("HubSpot declared-field equivalence", () => {
  it("treats field-equal HubSpotError instances as equivalent and field-different ones as distinct", () => {
    const a = HubSpotError.fromReason("transport", { formGuid: "form-guid" });
    const b = HubSpotError.fromReason("transport", { formGuid: "form-guid" });
    const c = HubSpotError.fromReason("response status", { formGuid: "form-guid" });

    expect(sameHubSpotError(a, b)).toBe(true);
    expect(sameHubSpotError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = HubSpotError.fromReason("transport", { cause: new Error("first failure"), formGuid: "form-guid" });
    const b = HubSpotError.fromReason("transport", { cause: new Error("second failure"), formGuid: "form-guid" });

    // the defect cause is payload, never identity
    expect(sameHubSpotError(a, b)).toBe(true);
  });
});
