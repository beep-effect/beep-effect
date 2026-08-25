import {
  BadGatewayError,
  BadRequestError,
  ClientHttpError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalServerErrorError,
  NotFoundError,
  RedactedCause,
  RedactedCauseError,
  ServerHttpError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@beep/observability";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(schema: S.Schema<A>, a: A, b: A, different: A, differentCause: A): void => {
  const same = S.toEquivalence(schema);

  expect(same(a, b)).toBe(true);
  expect(same(a, different)).toBe(false);
  expect(same(a, differentCause)).toBe(true);
};

describe("observability declared-field equivalence", () => {
  it("compares RedactedCauseError by its structured redacted cause", () => {
    const redacted = RedactedCause.make({
      tag: "failure",
      fingerprint: "same",
      message: "sanitized",
      detail: O.none(),
      truncated: false,
    });
    const differentRedacted = RedactedCause.make({
      tag: "failure",
      fingerprint: "different",
      message: "sanitized",
      detail: O.none(),
      truncated: false,
    });
    const a = RedactedCauseError.make({ redacted });
    const b = RedactedCauseError.make({ redacted });
    const different = RedactedCauseError.make({ redacted: differentRedacted });
    const same = S.toEquivalence(RedactedCauseError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });

  it("compares ClientHttpError by stable fields and ignores cause", () => {
    const a = ClientHttpError.make({ cause: O.some("same cause"), message: "same", status: 400 });
    const b = ClientHttpError.make({ cause: O.some("same cause"), message: "same", status: 400 });
    const different = ClientHttpError.make({ cause: O.some("same cause"), message: "different", status: 400 });
    const differentCause = ClientHttpError.make({ cause: O.some("different cause"), message: "same", status: 400 });

    expectDeclaredEquivalence(ClientHttpError, a, b, different, differentCause);
  });

  it("compares ServerHttpError by stable fields and ignores cause", () => {
    const a = ServerHttpError.make({ cause: O.some("same cause"), message: "same", status: 500 });
    const b = ServerHttpError.make({ cause: O.some("same cause"), message: "same", status: 500 });
    const different = ServerHttpError.make({ cause: O.some("same cause"), message: "different", status: 500 });
    const differentCause = ServerHttpError.make({ cause: O.some("different cause"), message: "same", status: 500 });

    expectDeclaredEquivalence(ServerHttpError, a, b, different, differentCause);
  });

  it("compares BadRequestError by stable fields and ignores cause", () => {
    const a = BadRequestError.make({ cause: O.some("same cause"), message: "same", status: 400 });
    const b = BadRequestError.make({ cause: O.some("same cause"), message: "same", status: 400 });
    const different = BadRequestError.make({ cause: O.some("same cause"), message: "different", status: 400 });
    const differentCause = BadRequestError.make({ cause: O.some("different cause"), message: "same", status: 400 });

    expectDeclaredEquivalence(BadRequestError, a, b, different, differentCause);
  });

  it("compares UnauthorizedError by stable fields and ignores cause", () => {
    const a = UnauthorizedError.make({ cause: O.some("same cause"), message: "same", status: 401 });
    const b = UnauthorizedError.make({ cause: O.some("same cause"), message: "same", status: 401 });
    const different = UnauthorizedError.make({ cause: O.some("same cause"), message: "different", status: 401 });
    const differentCause = UnauthorizedError.make({ cause: O.some("different cause"), message: "same", status: 401 });

    expectDeclaredEquivalence(UnauthorizedError, a, b, different, differentCause);
  });

  it("compares ForbiddenError by stable fields and ignores cause", () => {
    const a = ForbiddenError.make({ cause: O.some("same cause"), message: "same", status: 403 });
    const b = ForbiddenError.make({ cause: O.some("same cause"), message: "same", status: 403 });
    const different = ForbiddenError.make({ cause: O.some("same cause"), message: "different", status: 403 });
    const differentCause = ForbiddenError.make({ cause: O.some("different cause"), message: "same", status: 403 });

    expectDeclaredEquivalence(ForbiddenError, a, b, different, differentCause);
  });

  it("compares NotFoundError by stable fields and ignores cause", () => {
    const a = NotFoundError.make({ cause: O.some("same cause"), message: "same", status: 404 });
    const b = NotFoundError.make({ cause: O.some("same cause"), message: "same", status: 404 });
    const different = NotFoundError.make({ cause: O.some("same cause"), message: "different", status: 404 });
    const differentCause = NotFoundError.make({ cause: O.some("different cause"), message: "same", status: 404 });

    expectDeclaredEquivalence(NotFoundError, a, b, different, differentCause);
  });

  it("compares ConflictError by stable fields and ignores cause", () => {
    const a = ConflictError.make({ cause: O.some("same cause"), message: "same", status: 409 });
    const b = ConflictError.make({ cause: O.some("same cause"), message: "same", status: 409 });
    const different = ConflictError.make({ cause: O.some("same cause"), message: "different", status: 409 });
    const differentCause = ConflictError.make({ cause: O.some("different cause"), message: "same", status: 409 });

    expectDeclaredEquivalence(ConflictError, a, b, different, differentCause);
  });

  it("compares UnprocessableEntityError by stable fields and ignores cause", () => {
    const a = UnprocessableEntityError.make({ cause: O.some("same cause"), message: "same", status: 422 });
    const b = UnprocessableEntityError.make({ cause: O.some("same cause"), message: "same", status: 422 });
    const different = UnprocessableEntityError.make({ cause: O.some("same cause"), message: "different", status: 422 });
    const differentCause = UnprocessableEntityError.make({
      cause: O.some("different cause"),
      message: "same",
      status: 422,
    });

    expectDeclaredEquivalence(UnprocessableEntityError, a, b, different, differentCause);
  });

  it("compares TooManyRequestsError by stable fields and ignores cause", () => {
    const a = TooManyRequestsError.make({ cause: O.some("same cause"), message: "same", status: 429 });
    const b = TooManyRequestsError.make({ cause: O.some("same cause"), message: "same", status: 429 });
    const different = TooManyRequestsError.make({ cause: O.some("same cause"), message: "different", status: 429 });
    const differentCause = TooManyRequestsError.make({
      cause: O.some("different cause"),
      message: "same",
      status: 429,
    });

    expectDeclaredEquivalence(TooManyRequestsError, a, b, different, differentCause);
  });

  it("compares InternalServerErrorError by stable fields and ignores cause", () => {
    const a = InternalServerErrorError.make({ cause: O.some("same cause"), message: "same", status: 500 });
    const b = InternalServerErrorError.make({ cause: O.some("same cause"), message: "same", status: 500 });
    const different = InternalServerErrorError.make({
      cause: O.some("same cause"),
      message: "different",
      status: 500,
    });
    const differentCause = InternalServerErrorError.make({
      cause: O.some("different cause"),
      message: "same",
      status: 500,
    });

    expectDeclaredEquivalence(InternalServerErrorError, a, b, different, differentCause);
  });

  it("compares BadGatewayError by stable fields and ignores cause", () => {
    const a = BadGatewayError.make({ cause: O.some("same cause"), message: "same", status: 502 });
    const b = BadGatewayError.make({ cause: O.some("same cause"), message: "same", status: 502 });
    const different = BadGatewayError.make({ cause: O.some("same cause"), message: "different", status: 502 });
    const differentCause = BadGatewayError.make({ cause: O.some("different cause"), message: "same", status: 502 });

    expectDeclaredEquivalence(BadGatewayError, a, b, different, differentCause);
  });

  it("compares ServiceUnavailableError by stable fields and ignores cause", () => {
    const a = ServiceUnavailableError.make({ cause: O.some("same cause"), message: "same", status: 503 });
    const b = ServiceUnavailableError.make({ cause: O.some("same cause"), message: "same", status: 503 });
    const different = ServiceUnavailableError.make({
      cause: O.some("same cause"),
      message: "different",
      status: 503,
    });
    const differentCause = ServiceUnavailableError.make({
      cause: O.some("different cause"),
      message: "same",
      status: 503,
    });

    expectDeclaredEquivalence(ServiceUnavailableError, a, b, different, differentCause);
  });

  it("compares GatewayTimeoutError by stable fields and ignores cause", () => {
    const a = GatewayTimeoutError.make({ cause: O.some("same cause"), message: "same", status: 504 });
    const b = GatewayTimeoutError.make({ cause: O.some("same cause"), message: "same", status: 504 });
    const different = GatewayTimeoutError.make({ cause: O.some("same cause"), message: "different", status: 504 });
    const differentCause = GatewayTimeoutError.make({
      cause: O.some("different cause"),
      message: "same",
      status: 504,
    });

    expectDeclaredEquivalence(GatewayTimeoutError, a, b, different, differentCause);
  });
});
