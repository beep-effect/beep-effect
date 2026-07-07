import { SchemaUtils } from "@beep/schema";
import { isMutableHashSet, MutableHashSet, MutableHashSetFromSelf } from "@beep/schema/MutableHashSet";
import { Effect } from "effect";
import * as MutableHashSet_ from "effect/MutableHashSet";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";

describe("MutableHashSet", () => {
  it("preserves the schema surface for existing mutable hash sets", () => {
    const schema = MutableHashSetFromSelf(S.FiniteFromString);

    expect(schema.value).type.toBe<typeof S.FiniteFromString>();
    expect<typeof schema.Type>().type.toBe<MutableHashSet_.MutableHashSet<number>>();
    expect<typeof schema.Encoded>().type.toBe<MutableHashSet_.MutableHashSet<string>>();
  });

  it("preserves the array-backed transform surface", () => {
    const schema = MutableHashSet(S.FiniteFromString);
    const decode = S.decodeUnknownSync(schema);
    const decoded = decode(["1", "2"]);

    expect(schema.value).type.toBe<typeof S.FiniteFromString>();
    expect<typeof schema.Type>().type.toBe<MutableHashSet_.MutableHashSet<number>>();
    expect<typeof schema.Encoded>().type.toBe<ReadonlyArray<string>>();
    expect(decoded).type.toBe<MutableHashSet_.MutableHashSet<number>>();
  });

  it("accepts decoded mutable hash sets as missing-value defaults", () => {
    const schema = MutableHashSet(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(MutableHashSet_.empty<string>())),
      S.withDecodingDefaultType(Effect.succeed(MutableHashSet_.empty<string>()))
    );

    expect<typeof schema.Type>().type.toBe<MutableHashSet_.MutableHashSet<string>>();
    expect<typeof schema.Encoded>().type.toBe<ReadonlyArray<string> | undefined>();
  });

  it("accepts decoded mutable hash sets through the key-default helper", () => {
    const schema = MutableHashSet(S.String).pipe(SchemaUtils.withKeyDefaults(MutableHashSet_.empty<string>()));
    const model = S.Struct({ values: schema });

    expect<typeof schema.Type>().type.toBe<MutableHashSet_.MutableHashSet<string>>();
    expect<typeof schema.Encoded>().type.toBe<ReadonlyArray<string>>();
    expect<typeof model.Encoded>().type.toBe<{ readonly values?: ReadonlyArray<string> }>();
  });

  it("exposes a guard that narrows to MutableHashSet runtime values", () => {
    const value: unknown = MutableHashSet_.make(1, 2);

    if (isMutableHashSet<number>(value)) {
      expect(value).type.toBe<MutableHashSet_.MutableHashSet<number>>();
    }
  });
});
