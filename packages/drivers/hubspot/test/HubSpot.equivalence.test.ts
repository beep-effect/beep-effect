import { HubSpotError } from "@beep/hubspot";
import { HubSpotErrorOptions } from "@beep/hubspot/HubSpot.errors";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const sameHubSpotError = S.toEquivalence(HubSpotError);

describe("HubSpot declared-field equivalence", () => {
  it("treats field-equal HubSpotError instances as equivalent and field-different ones as distinct", () => {
    const a = HubSpotError.fromReason("transport", HubSpotErrorOptions.make({ formGuid: "form-guid" }));
    const b = HubSpotError.fromReason("transport", HubSpotErrorOptions.make({ formGuid: "form-guid" }));
    const c = HubSpotError.fromReason("response status", HubSpotErrorOptions.make({ formGuid: "form-guid" }));

    expect(sameHubSpotError(a, b)).toBe(true);
    expect(sameHubSpotError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = HubSpotError.fromReason(
      "transport",
      HubSpotErrorOptions.make({ cause: new Error("first failure"), formGuid: "form-guid" })
    );
    const b = HubSpotError.fromReason(
      "transport",
      HubSpotErrorOptions.make({ cause: new Error("second failure"), formGuid: "form-guid" })
    );

    expect(sameHubSpotError(a, b), "the defect cause is payload, never identity").toBe(true);
  });
});
