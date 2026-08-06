import { AnyFn, Fn, ThunkOf } from "@beep/schema/Fn";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Cause from "effect/Cause";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

const runResult = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    Effect.match(effect, {
      onFailure: (error) => ({
        _tag: "Failure" as const,
        error,
      }),
      onSuccess: (value) => ({
        _tag: "Success" as const,
        value,
      }),
    })
  );

const runCause = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(Effect.sandbox(effect)));

describe("Fn schema", () => {
  it("decodes and encodes runtime functions without wrapping them", () => {
    const schema = Fn({
      input: S.FiniteFromString,
      output: S.FiniteFromString,
    });
    const handler = (count: number) => count + 1;

    expect(S.decodeUnknownSync(schema)(handler)).toBe(handler);
    expect(S.encodeSync(schema)(handler)).toBe(handler);
  });

  it("rejects non-function inputs", () => {
    const schema = Fn({ output: S.String });

    expect(() => S.decodeUnknownSync(schema)(null)).toThrow("Expected @beep/schema/Fn/Fn");
  });

  it("defaults errorSchema to Schema.Never", () => {
    const schema = Fn({ output: S.String });

    expect(schema.errorSchema).toBe(S.Never);
  });
});

describe("Fn thunks", () => {
  it.effect("validates transformed failures against the schema type side", () =>
    Effect.gen(function* () {
      const schema = Fn({
        output: S.String,
        error: S.FiniteFromString,
      });
      const impl = schema.implementEffect(() => Effect.fail(2));
      const result = yield* Effect.promise(() => Promise.resolve(runResult(impl())));

      expect(result).toEqual({
        _tag: "Failure",
        error: 2,
      });
      expect(schema.errorSchema).toBe(S.FiniteFromString);
    })
  );

  it.effect("validates transformed outputs against the schema type side", () =>
    Effect.gen(function* () {
      const schema = Fn({ output: S.FiniteFromString });
      const impl = schema.implement(() => 2);

      expect(yield* impl()).toBe(2);
      expect(schema.inputSchema).toBe(S.Never);
      expect(schema.outputSchema).toBe(S.FiniteFromString);
    })
  );

  it.effect("preserves handler failures for implementEffect", () =>
    Effect.gen(function* () {
      const schema = Fn({
        output: S.String,
        error: S.String,
      });
      const impl = schema.implementEffect(() => Effect.fail("boom" as const));
      const result = yield* Effect.promise(() => Promise.resolve(runResult(impl())));

      expect(result).toEqual({
        _tag: "Failure",
        error: "boom",
      });
    })
  );

  it("provides a synchronous helper for service-free schemas", () => {
    const schema = Fn({ output: S.String });
    const impl = schema.implementSync(() => "hello");

    expect(impl()).toBe("hello");
  });

  it.effect("preserves defects without validating them against errorSchema", () =>
    Effect.gen(function* () {
      const schema = Fn({
        output: S.String,
        error: S.String,
      });
      const impl = schema.implementEffect(() => Effect.die("boom"));
      const cause = yield* Effect.promise(() => Promise.resolve(runCause(impl())));

      expect(Cause.hasDies(cause)).toBe(true);
      expect(Cause.hasFails(cause)).toBe(false);
    })
  );
});

describe("Fn unary functions", () => {
  it.effect("decodes transformed inputs before running the handler", () =>
    Effect.gen(function* () {
      const schema = Fn({
        input: S.FiniteFromString,
        output: S.String,
      });
      const impl = schema.implement((count) => `${count + 1}`);

      expect(yield* impl("1")).toBe("2");
    })
  );

  it.effect("validates input before calling the handler", () =>
    Effect.gen(function* () {
      const schema = Fn({
        input: S.Finite,
        output: S.String,
      });

      let called = false;
      const impl = schema.implementEffect((count) => {
        called = true;
        return Effect.succeed(`${count}`);
      });
      const result = yield* Effect.promise(() => Promise.resolve(runResult(impl("nope"))));

      expect(called).toBe(false);
      expect(result._tag).toBe("Failure");
    })
  );

  it.effect("validates output values from implement", () =>
    Effect.gen(function* () {
      const schema = Fn({
        input: S.Finite,
        output: S.NonEmptyString,
      });
      const impl = schema.implement(() => "");
      const result = yield* Effect.promise(() => Promise.resolve(runResult(impl(1))));

      expect(result._tag).toBe("Failure");
    })
  );

  it.effect("validates failure values from implementEffect", () =>
    Effect.gen(function* () {
      const schema = Fn({
        input: S.Finite,
        output: S.String,
        error: S.NonEmptyString,
      });
      const impl = schema.implementEffect(() => Effect.fail(""));
      const result = yield* Effect.promise(() => Promise.resolve(runResult(impl(1))));

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(SchemaIssue.isIssue(result.error)).toBe(true);
      }
    })
  );

  it("supports implementSync for transformed input schemas", () => {
    const schema = Fn({
      input: S.FiniteFromString,
      output: S.FiniteFromString,
    });
    const impl = schema.implementSync((count) => count + 1);

    expect(impl("1")).toBe(2);
  });

  it("supports void outputs", () => {
    const schema = Fn({
      input: S.String,
      output: S.Void,
    });
    const impl = schema.implementSync(() => undefined);

    expect(impl("beep")).toBeUndefined();
  });

  it.effect("handles structured payloads", () =>
    Effect.gen(function* () {
      const schema = Fn({
        input: S.Struct({
          name: S.String,
          age: S.FiniteFromString,
        }),
        output: S.Struct({
          id: S.String,
          label: S.NonEmptyString,
        }),
      });
      const impl = schema.implement(({ name, age }) => ({
        id: `${Str.toLowerCase(name)}-${age}`,
        label: `${name} (${age})`,
      }));

      expect(yield* impl({ name: "Ada", age: "10" })).toEqual({
        id: "ada-10",
        label: "Ada (10)",
      });
    })
  );
});

describe("Fn convenience exports", () => {
  it("preserves explicit undefined thunk semantics and statics across annotate", () => {
    const schema = Fn({
      input: S.Undefined,
      output: S.String,
      error: S.Finite,
    });
    const annotated = schema.annotate({
      description: "Annotated thunk",
    });

    expect(schema.inputSchema).toBe(S.Undefined);
    expect(annotated.inputSchema).toBe(S.Undefined);
    expect(schema.errorSchema).toBe(S.Finite);
    expect(annotated.errorSchema).toBe(S.Finite);
    expect(annotated.implementSync(() => "hello")()).toBe("hello");
  });

  it("accepts any runtime function via AnyFn", () => {
    const handler = () => "ok";

    expect(S.decodeUnknownSync(AnyFn)(handler)).toBe(handler);
  });

  it("creates thunk schemas with ThunkOf", () => {
    const schema = ThunkOf(S.FiniteFromString, S.String);
    const impl = schema.implementSync(() => 1);

    expect(impl()).toBe(1);
    expect(schema.errorSchema).toBe(S.String);
  });

  it("derives formatter and equivalence instances", () => {
    const schema = Fn({
      input: S.String,
      output: S.String,
    });
    const formatter = S.toFormatter(schema);
    const equivalence = S.toEquivalence(schema);
    const handler = () => "hello";

    expect(formatter(handler)).toBe("[Function]");
    expect(equivalence(handler, handler)).toBe(true);
    expect(equivalence(handler, () => "hello")).toBe(false);
  });
});
