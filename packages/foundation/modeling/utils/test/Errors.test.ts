import { it } from "@beep/test-runner";
import { Err } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";

class CauseMappedError {
  readonly _tag = "CauseMappedError";
  readonly cause: unknown;
  readonly message: string;
  readonly operation: string;

  constructor(cause: unknown, message: string, operation: string) {
    this.cause = cause;
    this.message = message;
    this.operation = operation;
  }
}

class StaticMappedError {
  readonly _tag = "StaticMappedError";
  readonly message: string;
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    this.message = message;
    this.exitCode = exitCode;
  }
}

class DualInputMappedError {
  readonly _tag = "DualInputMappedError";
  readonly source: string;
  readonly label: string;

  constructor(source: string, label: string) {
    this.source = source;
    this.label = label;
  }

  static readonly new: {
    (source: string, label: string): DualInputMappedError;
    (label: string): (source: string) => DualInputMappedError;
  } = dual(2, (source: string, label: string): DualInputMappedError => new DualInputMappedError(source, label));
}

type OptionalDualInputMappedErrorOptions =
  | undefined
  | {
      readonly exitCode?: undefined | number;
    };

class OptionalDualInputMappedError {
  readonly _tag = "OptionalDualInputMappedError";
  readonly source: string;
  readonly message: string;
  readonly exitCode: number | undefined;

  constructor(source: string, message: string, exitCode: number | undefined) {
    this.source = source;
    this.message = message;
    this.exitCode = exitCode;
  }

  static readonly new: {
    (source: string, message: string, options?: OptionalDualInputMappedErrorOptions): OptionalDualInputMappedError;
    (message: string, options?: OptionalDualInputMappedErrorOptions): (source: string) => OptionalDualInputMappedError;
  } = dual(
    3,
    (source: string, message: string, { exitCode } = {}): OptionalDualInputMappedError =>
      new OptionalDualInputMappedError(source, message, exitCode)
  );
}

const mapCauseMappedError = Err.mapCauseError(
  (cause: unknown, message: string, operation: string) => new CauseMappedError(cause, message, operation)
);

const mapStaticError = Err.mapToError((message: string, exitCode: number) => new StaticMappedError(message, exitCode));
const mapDualInputError = Err.mapToError(DualInputMappedError.new);
const mapOptionalDualInputError = Err.mapToError(OptionalDualInputMappedError.new);

describe("Err.mapCauseError", () => {
  it.effect(
    "maps failures in data-first form",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(mapCauseMappedError(Effect.fail("raw failure"), "Command failed.", "spawn"));

      expect(error).toBeInstanceOf(CauseMappedError);
      expect(error.cause).toBe("raw failure");
      expect(error.message).toBe("Command failed.");
      expect(error.operation).toBe("spawn");
    })
  );

  it.effect(
    "maps failures in pipe-friendly form",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(
        Effect.fail("raw failure"),
        mapCauseMappedError("Command failed.", "spawn"),
        Effect.flip
      );

      expect(error).toBeInstanceOf(CauseMappedError);
      expect(error.cause).toBe("raw failure");
      expect(error.message).toBe("Command failed.");
      expect(error.operation).toBe("spawn");
    })
  );

  it.effect(
    "does not call the builder on success",
    Effect.fnUntraced(function* () {
      let buildCalls = 0;
      const program = pipe(
        Effect.succeed(42),
        Err.mapCauseError((cause: unknown, message: string) => {
          buildCalls += 1;
          return new CauseMappedError(cause, message, "unused");
        })("Command failed.")
      );

      const value = yield* program;

      expect(value).toBe(42);
      expect(buildCalls).toBe(0);
    })
  );
});

describe("Err.mapToError", () => {
  it.effect(
    "maps failures in data-first form",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(mapStaticError(Effect.fail("raw failure"), "Command exited.", 1));

      expect(error).toBeInstanceOf(StaticMappedError);
      expect(error.message).toBe("Command exited.");
      expect(error.exitCode).toBe(1);
    })
  );

  it.effect(
    "maps failures in pipe-friendly form",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(Effect.fail("raw failure"), mapStaticError("Command exited.", 1), Effect.flip);

      expect(error).toBeInstanceOf(StaticMappedError);
      expect(error.message).toBe("Command exited.");
      expect(error.exitCode).toBe(1);
    })
  );

  it.effect(
    "maps failures through a dual constructor in data-first form",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(mapDualInputError(Effect.fail("raw failure"), "spawn"));

      expect(error).toBeInstanceOf(DualInputMappedError);
      expect(error.source).toBe("raw failure");
      expect(error.label).toBe("spawn");
    })
  );

  it.effect(
    "maps failures through a dual constructor in pipe-friendly form",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(Effect.fail("raw failure"), mapDualInputError("spawn"), Effect.flip);

      expect(error).toBeInstanceOf(DualInputMappedError);
      expect(error.source).toBe("raw failure");
      expect(error.label).toBe("spawn");
    })
  );

  it.effect(
    "maps failures through an optional-argument dual constructor",
    Effect.fnUntraced(function* () {
      const error = yield* pipe(
        Effect.fail("raw failure"),
        mapOptionalDualInputError("Command failed.", { exitCode: 1 }),
        Effect.flip
      );

      expect(error).toBeInstanceOf(OptionalDualInputMappedError);
      expect(error.source).toBe("raw failure");
      expect(error.message).toBe("Command failed.");
      expect(error.exitCode).toBe(1);
    })
  );
});
