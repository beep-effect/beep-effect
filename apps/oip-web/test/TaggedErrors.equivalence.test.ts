import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
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

    pipe(sameContactRoutePayloadError(a, b), assertTrue);
    pipe(sameContactRoutePayloadError(a, c), assertFalse);
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

    pipe(sameContactSubmissionError(a, b), assertTrue);
    pipe(sameContactSubmissionError(a, c), assertFalse);
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

    pipe(sameOipContentLoadError(a, b), assertTrue);
    pipe(sameOipContentLoadError(a, c), assertFalse);
  });
});
