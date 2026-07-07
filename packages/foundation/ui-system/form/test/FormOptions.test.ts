import { formOptionsWithDefaults, makeFormOptions, ValidateOn } from "@beep/form/core/FormOptions";
import { withKeyDefaults } from "@beep/schema/SchemaUtils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const schema = S.Struct({ name: withKeyDefaults(S.String, "") });
const ValidateOnArbitrary = S.toArbitrary(ValidateOn);

describe("@beep/form FormOptions", () => {
  it("makeFormOptions wires explicit defaults and a sync submit validator", () => {
    const options = makeFormOptions({ schema, defaultValues: { name: "x" } });
    expect(options.defaultValues).toEqual({ name: "x" });
    expect(options.validators && "onSubmit" in options.validators).toBe(true);
  });

  it("formOptionsWithDefaults derives defaults from the schema", () => {
    const options = formOptionsWithDefaults({ schema });
    expect(options.defaultValues).toEqual({ name: "" });
  });

  it("encodes schema defaults for transform schemas", () => {
    const transformedSchema = S.Struct({
      count: S.FiniteFromString.pipe(S.withConstructorDefault(Effect.succeed(1))),
    });

    const options = formOptionsWithDefaults({ schema: transformedSchema });

    expect(options.defaultValues).toEqual({ count: "1" });
  });

  it("routes to the async slot when async is requested", () => {
    const options = makeFormOptions({
      schema,
      defaultValues: { name: "x" },
      validateOn: "change",
      async: true,
    });
    expect(options.validators && "onChangeAsync" in options.validators).toBe(true);
  });

  it("routes validators through the ValidateOn literal kit", () => {
    expect(ValidateOn.Options).toEqual(["change", "blur", "submit"]);
    expect(ValidateOn.is.blur("blur")).toBe(true);
    expect(ValidateOn.is.blur("change")).toBe(false);

    const options = makeFormOptions({
      schema,
      defaultValues: { name: "x" },
      validateOn: ValidateOn.Enum.blur,
    });

    expect(options.validators && "onBlur" in options.validators).toBe(true);
  });

  it("round-trips ValidateOn without changing its encoded shape", () =>
    fc.assert(
      fc.property(ValidateOnArbitrary, (value) => {
        const encoded = Result.getOrThrow(S.encodeResult(ValidateOn)(value));
        const decoded = Result.getOrThrow(S.decodeUnknownResult(ValidateOn)(encoded));

        expect(encoded).toBe(value);
        expect(decoded).toBe(value);
      }),
      { numRuns: 20 }
    ));
});
