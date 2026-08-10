import { CauseTaggedError } from "@beep/schema/CauseTaggedError";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

class DomainError extends CauseTaggedError<DomainError>("DomainError")("DomainError") {}

class OperationError extends CauseTaggedError<OperationError>("OperationError")("OperationError", {
  operation: S.String,
}) {}

class ExtendedOperationError extends OperationError.extend<ExtendedOperationError>("ExtendedOperationError")({
  resource: S.String,
}) {}

describe("CauseTaggedError", () => {
  it("constructs no-extra errors in data-first form", () => {
    const cause = new Error("kapow");
    const error = DomainError.new(cause, "boom");

    expect(error).toBeInstanceOf(DomainError);
    expect(S.is(DomainError)(error)).toBe(true);
    expect(error._tag).toBe("DomainError");
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
  });

  it("constructs no-extra errors in cause-last form", () => {
    const cause = new Error("kapow");
    const error = DomainError.new("boom")(cause);

    expect(error).toBeInstanceOf(DomainError);
    expect(S.is(DomainError)(error)).toBe(true);
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
  });

  it("constructs extra-field errors in data-first form", () => {
    const cause = new Error("kapow");
    const error = OperationError.new(cause, "boom", {
      operation: "load-profile",
    });

    expect(error).toBeInstanceOf(OperationError);
    expect(S.is(OperationError)(error)).toBe(true);
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.operation).toBe("load-profile");
  });

  it("constructs extra-field errors in cause-last form", () => {
    const cause = new Error("kapow");
    const error = OperationError.new("boom", { operation: "load-profile" })(cause);

    expect(error).toBeInstanceOf(OperationError);
    expect(S.is(OperationError)(error)).toBe(true);
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.operation).toBe("load-profile");
  });

  it.effect(
    "maps errors in data-first form",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(DomainError.mapError(Effect.fail("raw failure"), "boom"));

      expect(error).toBeInstanceOf(DomainError);
      expect(error.message).toBe("boom");
      expect(error.cause).toBe("raw failure");
    })
  );

  it.effect(
    "maps errors in pipe-friendly form",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(Effect.fail("raw failure"), DomainError.mapError("boom"), Effect.flip);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.message).toBe("boom");
      expect(error.cause).toBe("raw failure");
    })
  );

  it.effect(
    "keeps static helpers callable after destructuring",
    Effect.fnUntraced(function* () {
      const { mapError, new: makeDomainError } = DomainError;
      const cause = new Error("kapow");
      const constructed = makeDomainError(cause, "boom");
      const mapped = yield* pipe(Effect.fail("raw failure"), mapError("mapped"), Effect.flip);

      expect(constructed).toBeInstanceOf(DomainError);
      expect(constructed.cause).toBe(cause);
      expect(mapped).toBeInstanceOf(DomainError);
      expect(mapped.message).toBe("mapped");
    })
  );

  it.effect(
    "maps extra-field errors in data-first form",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        OperationError.mapError(Effect.fail("raw failure"), "boom", {
          operation: "load-profile",
        })
      );

      expect(error).toBeInstanceOf(OperationError);
      expect(error.message).toBe("boom");
      expect(error.cause).toBe("raw failure");
      expect(error.operation).toBe("load-profile");
    })
  );

  it.effect(
    "maps extra-field errors in pipe-friendly form",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(
        Effect.fail("raw failure"),
        OperationError.mapError("boom", { operation: "load-profile" }),
        Effect.flip
      );

      expect(error).toBeInstanceOf(OperationError);
      expect(error.message).toBe("boom");
      expect(error.cause).toBe("raw failure");
      expect(error.operation).toBe("load-profile");
    })
  );

  it("validates extras through the generated schema", () => {
    expect(() =>
      S.decodeUnknownSync(OperationError)({
        _tag: "OperationError",
        cause: new Error("kapow"),
        message: "boom",
        operation: 1,
      })
    ).toThrow();
  });

  it("validates helper extras through the generated schema", () => {
    const cause = new Error("kapow");

    expect(() => Reflect.apply(OperationError.new, OperationError, ["boom", { operation: 1 }])(cause)).toThrow();
  });

  it("reattaches helpers when extending cause tagged errors", () => {
    const cause = new Error("kapow");
    const error = ExtendedOperationError.new(cause, "boom", {
      operation: "load-profile",
      resource: "profile",
    });

    expect(error).toBeInstanceOf(OperationError);
    expect(error).toBeInstanceOf(ExtendedOperationError);
    expect(error.name).toBe("ExtendedOperationError");
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.operation).toBe("load-profile");
    expect(error.resource).toBe("profile");
  });

  it("round-trips arbitrary extras through the class-backed extras shape check unchanged", () => {
    const cause = new Error("kapow");

    fc.assert(
      fc.property(S.toArbitrary(S.String)(fc), (operation) => {
        const error = OperationError.new(cause, "boom", { operation });
        expect(error.operation).toBe(operation);
      }),
      { numRuns: 25 }
    );
  });
});
