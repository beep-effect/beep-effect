import { GovinfoError, GovinfoErrorOptions, Search } from "@beep/govinfo";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameError = S.toEquivalence(GovinfoError);
const sameBadRequest = S.toEquivalence(Search.FailureBadRequest);
const sameNotFound = S.toEquivalence(Search.FailureNotFound);
const sameInternalServerError = S.toEquivalence(Search.FailureInternalServerError);

describe("Govinfo declared-field equivalence", () => {
  it("treats field-equal GovinfoError instances as equivalent and field-different ones as distinct", () => {
    const a = GovinfoError.of("response status", GovinfoErrorOptions.make({ status: O.some(404) }));
    const b = GovinfoError.of("response status", GovinfoErrorOptions.make({ status: O.some(404) }));
    const c = GovinfoError.of("response status", GovinfoErrorOptions.make({ status: O.some(500) }));

    expect(sameError(a, b)).toBe(true);
    expect(sameError(a, c)).toBe(false);
  });

  it("derives declared-field equivalence for each Search failure member", () => {
    const badRequest = Search.FailureBadRequest.make({ cause: O.none() });
    const badRequestTwin = Search.FailureBadRequest.make({ cause: O.none() });
    const badRequestWithCause = Search.FailureBadRequest.make({ cause: O.some(new Error("query rejected")) });

    expect(sameBadRequest(badRequest, badRequestTwin)).toBe(true);
    expect(sameBadRequest(badRequest, badRequestWithCause)).toBe(false);

    const notFound = Search.FailureNotFound.make({ cause: O.none() });
    const notFoundTwin = Search.FailureNotFound.make({ cause: O.none() });
    expect(sameNotFound(notFound, notFoundTwin)).toBe(true);

    const internal = Search.FailureInternalServerError.make({ cause: O.none() });
    const internalTwin = Search.FailureInternalServerError.make({ cause: O.none() });
    expect(sameInternalServerError(internal, internalTwin)).toBe(true);
  });
});
