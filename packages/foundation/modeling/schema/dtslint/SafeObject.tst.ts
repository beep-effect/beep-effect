import { SafeObject, SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type {
  SafeObject as RootSafeObject,
  SafeObjectFromObjectKeyword as RootSafeObjectFromObjectKeyword,
  SafeObjectFromObjectKeyword as RootSafeObjectFromObjectKeywordType,
  SafeObject as RootSafeObjectType,
} from "@beep/schema";
import type {
  SafeObjectFromObjectKeyword as SafeObjectFromObjectKeywordType,
  SafeObject as SafeObjectType,
  Schema,
} from "@beep/schema/SafeObject";
import type { Effect } from "effect";
import type * as Brand from "effect/Brand";
import type * as R from "effect/Record";

describe("SafeObject", () => {
  it("preserves the branded record schema surface", () => {
    expect<SafeObject>().type.toBe<R.ReadonlyRecord<string, unknown> & Brand.Brand<"SafeObject">>();
    expect<typeof SafeObject.Encoded>().type.toBe<R.ReadonlyRecord<string, unknown>>();
    expect<SafeObjectType>().type.toBe<SafeObject>();
  });

  it("keeps the brand nominal", () => {
    expect<R.ReadonlyRecord<string, unknown>>().type.not.toBeAssignableTo<SafeObject>();
    expect<SafeObject>().type.toBeAssignableTo<R.ReadonlyRecord<string, unknown>>();
    expect(SafeObject.make({ enabled: true })).type.toBe<SafeObject>();
  });

  it("exposes decode and encode helpers with expected effect types", () => {
    const value = SafeObject.make({ enabled: true });
    const decode = S.decodeUnknownEffect(SafeObject);
    const encode = S.encodeEffect(SafeObject);

    expect(decode({ enabled: true })).type.toBe<Effect.Effect<SafeObject, S.SchemaError, never>>();
    expect(encode(value)).type.toBe<Effect.Effect<R.ReadonlyRecord<string, unknown>, S.SchemaError, never>>();
  });

  it("exports matching root and namespace-first surfaces", () => {
    expect<typeof Schema>().type.toBe<typeof SafeObject>();
    expect<typeof RootSafeObject>().type.toBe<typeof SafeObject>();
    expect<RootSafeObjectType>().type.toBe<SafeObjectType>();
  });
});

describe("SafeObjectFromObjectKeyword", () => {
  it("exposes a branded SafeObject from ObjectKeyword transformation", () => {
    expect<SafeObjectFromObjectKeyword>().type.toBe<SafeObject>();
    expect<typeof SafeObjectFromObjectKeyword.Encoded>().type.toBe<object>();
    expect<(typeof SafeObjectFromObjectKeyword)["DecodingServices"]>().type.toBe<never>();
    expect<(typeof SafeObjectFromObjectKeyword)["EncodingServices"]>().type.toBe<never>();
    expect<typeof SafeObjectFromObjectKeyword.from>().type.toBe<S.ObjectKeyword>();
    expect<typeof SafeObjectFromObjectKeyword.to>().type.toBe<typeof SafeObject>();
    expect<SafeObjectFromObjectKeywordType>().type.toBe<SafeObject>();
  });

  it("exposes decode and encode helpers with expected effect types", () => {
    const value = SafeObjectFromObjectKeyword.make({ enabled: true });
    const decode = S.decodeUnknownEffect(SafeObjectFromObjectKeyword);
    const encode = S.encodeEffect(SafeObjectFromObjectKeyword);

    expect(decode([])).type.toBe<Effect.Effect<SafeObject, S.SchemaError, never>>();
    expect(encode(value)).type.toBe<Effect.Effect<object, S.SchemaError, never>>();
  });

  it("exports matching root and namespace-first surfaces", () => {
    expect<typeof RootSafeObjectFromObjectKeyword>().type.toBe<typeof SafeObjectFromObjectKeyword>();
    expect<RootSafeObjectFromObjectKeywordType>().type.toBe<SafeObjectFromObjectKeywordType>();
  });
});
