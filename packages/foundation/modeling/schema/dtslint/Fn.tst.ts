import { SchemaUtils } from "@beep/schema";
import { Fn, ThunkOf } from "@beep/schema/Fn";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type { AnyFn, AnyFn as AnyFnType, FnSchema, FnSchemaStatics, FnType } from "@beep/schema/Fn";
import type * as SchemaIssue from "effect/SchemaIssue";

interface InputWithService extends S.Codec<number, string, "InputService"> {
  readonly "~rebuild.out": this;
}

const InputWithService = S.make<InputWithService>(S.FiniteFromString.ast);

describe("Fn", () => {
  it("preserves thunk inference when input is omitted", () => {
    const schema = Fn({ output: S.String });
    const impl = schema.implement(() => "hello");
    const effectImpl = schema.implementEffect(() => Effect.succeed("hello"));
    const syncImpl = schema.implementSync(() => "hello");

    expect<typeof schema.inputSchema>().type.toBe<typeof S.Never>();
    expect<typeof schema.outputSchema>().type.toBe<typeof S.String>();
    expect<typeof schema.errorSchema>().type.toBe<typeof S.Never>();
    expect<typeof schema.Type>().type.toBe<() => string>();
    expect<FnType<never, string>>().type.toBe<() => string>();
    expect(impl).type.toBe<() => Effect.Effect<string, SchemaIssue.Issue>>();
    expect(effectImpl).type.toBe<() => Effect.Effect<string, SchemaIssue.Issue>>();
    expect(syncImpl).type.toBe<() => string>();
  });

  it("preserves thunk inference for explicit undefined input", () => {
    const schema = Fn({
      input: S.Undefined,
      output: S.String,
      error: S.Finite,
    });
    const impl = schema.implementEffect(() => Effect.fail(1));

    expect<typeof schema.inputSchema>().type.toBe<typeof S.Undefined>();
    expect<typeof schema.errorSchema>().type.toBe<typeof S.Finite>();
    expect<typeof schema.Type>().type.toBe<() => string>();
    expect<FnType<undefined, string>>().type.toBe<() => string>();
    expect(impl).type.toBe<() => Effect.Effect<string, SchemaIssue.Issue | number>>();
  });

  it("preserves unary inference and validated wrapper signatures", () => {
    const schema = Fn({
      input: S.FiniteFromString,
      output: S.String,
      error: S.NonEmptyString,
    });
    const impl = schema.implement((count) => `${count}`);
    const effectImpl = schema.implementEffect((count) => Effect.fail(`${count}`));
    const syncImpl = schema.implementSync((count) => `${count}`);

    expect<typeof schema.inputSchema>().type.toBe<typeof S.FiniteFromString>();
    expect<typeof schema.outputSchema>().type.toBe<typeof S.String>();
    expect<typeof schema.errorSchema>().type.toBe<typeof S.NonEmptyString>();
    expect<typeof schema.Type>().type.toBe<(input: number) => string>();
    expect<FnType<number, string>>().type.toBe<(input: number) => string>();
    expect(impl).type.toBe<(input: unknown) => Effect.Effect<string, SchemaIssue.Issue>>();
    expect(effectImpl).type.toBe<(input: unknown) => Effect.Effect<string, SchemaIssue.Issue | string>>();
    expect(syncImpl).type.toBe<(input: unknown) => string>();
  });

  it("preserves implementEffect error and environment composition", () => {
    const schema = Fn({
      input: InputWithService,
      output: S.String,
      error: S.Finite,
    });
    const impl = schema.implementEffect((_count): Effect.Effect<string, number, "HandlerEnv"> => Effect.fail(1));

    expect(impl).type.toBe<
      (input: unknown) => Effect.Effect<string, SchemaIssue.Issue | number, "HandlerEnv" | "InputService">
    >();
  });

  it("preserves implementEffect failures when no error schema is declared", () => {
    const schema = Fn({
      input: S.Finite,
      output: S.String,
    });
    const impl = schema.implementEffect((_count): Effect.Effect<string, "boom"> => Effect.fail("boom" as const));

    expect(impl).type.toBe<(input: unknown) => Effect.Effect<string, SchemaIssue.Issue | "boom">>();
  });

  it("preserves constructor-default state and composes with key defaults", () => {
    const unary = Fn({ input: S.Finite, output: S.Finite });
    const thunk = ThunkOf(S.Finite);
    const unaryWithDefault = unary.pipe(SchemaUtils.withKeyDefaults(Math.floor));
    const thunkWithDefault = thunk.pipe(SchemaUtils.withKeyDefaults(Math.random));

    expect<(typeof unary)["~type.constructor.default"]>().type.toBe<"no-default">();
    expect<(typeof thunk)["~type.constructor.default"]>().type.toBe<"no-default">();
    expect<(typeof unaryWithDefault)["~type.constructor.default"]>().type.toBe<"with-default">();
    expect<(typeof thunkWithDefault)["~type.constructor.default"]>().type.toBe<"with-default">();
  });

  it("exposes exported helper types", () => {
    expect<FnSchema<typeof S.Never, typeof S.String>["inputSchema"]>().type.toBe<typeof S.Never>();
    expect<FnSchema<typeof S.Never, typeof S.String, typeof S.Finite>["errorSchema"]>().type.toBe<typeof S.Finite>();
    expect<FnSchemaStatics<typeof S.FiniteFromString, typeof S.String, typeof S.Finite>["outputSchema"]>().type.toBe<
      typeof S.String
    >();
    expect<FnSchemaStatics<typeof S.FiniteFromString, typeof S.String, typeof S.Finite>["errorSchema"]>().type.toBe<
      typeof S.Finite
    >();
    expect<AnyFnType>().type.toBe<Function>();
  });

  it("supports AnyFn and ThunkOf", () => {
    const schema = ThunkOf(S.FiniteFromString, S.String);
    const impl = schema.implementSync(() => 1);

    expect<AnyFn>().type.toBe<Function>();
    expect<typeof schema.Type>().type.toBe<() => number>();
    expect<typeof schema.errorSchema>().type.toBe<typeof S.String>();
    expect(impl).type.toBe<() => number>();
  });
});
