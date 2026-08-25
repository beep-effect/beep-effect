import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { ContactRoutePayloadError } from "@/app/api/contact/ContactRouteResponse";
import { ContactSubmissionError } from "@/contact/ContactSubmission.service";
import { OipContentLoadError } from "@/content/OipContent.runtime";

const sameContactRoutePayloadError = S.toEquivalence(ContactRoutePayloadError);
const sameContactSubmissionError = S.toEquivalence(ContactSubmissionError);
const sameOipContentLoadError = S.toEquivalence(OipContentLoadError);

describe("OIP tagged-error declared equivalence", () => {
  it("compares ContactRoutePayloadError by declared fields", () => {
    const a = ContactRoutePayloadError.fromReason("schema");
    const b = ContactRoutePayloadError.fromReason("schema");
    const c = ContactRoutePayloadError.fromReason("form-data");

    expect(sameContactRoutePayloadError(a, b)).toBe(true);
    expect(sameContactRoutePayloadError(a, c)).toBe(false);
  });

  it("compares ContactSubmissionError by declared fields", () => {
    const a = ContactSubmissionError.fromReason("provider", {
      provider: "hubspot",
      providerReason: "unavailable",
      status: 503,
    });
    const b = ContactSubmissionError.fromReason("provider", {
      provider: "hubspot",
      providerReason: "unavailable",
      status: 503,
    });
    const c = ContactSubmissionError.fromReason("provider", {
      provider: "hubspot",
      providerReason: "unavailable",
      status: 502,
    });

    expect(sameContactSubmissionError(a, b)).toBe(true);
    expect(sameContactSubmissionError(a, c)).toBe(false);
  });

  it("compares OipContentLoadError by declared fields", () => {
    const a = OipContentLoadError.fromReason("provider", {
      provider: "sanity",
      providerReason: "unavailable",
      status: 503,
    });
    const b = OipContentLoadError.fromReason("provider", {
      provider: "sanity",
      providerReason: "unavailable",
      status: 503,
    });
    const c = OipContentLoadError.fromReason("provider", {
      provider: "sanity",
      providerReason: "unavailable",
      status: 502,
    });

    expect(sameOipContentLoadError(a, b)).toBe(true);
    expect(sameOipContentLoadError(a, c)).toBe(false);
  });
});
