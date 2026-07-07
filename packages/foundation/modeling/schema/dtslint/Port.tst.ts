import { Port, PortFromString } from "@beep/schema/Port";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type {
  Port as RootPort,
  PortFromString as RootPortFromString,
  PortFromString as RootPortFromStringType,
  Port as RootPortType,
} from "@beep/schema";
import type { PortFromString as PortFromStringType, Port as PortType } from "@beep/schema/Port";
import type { Effect } from "effect";
import type * as Brand from "effect/Brand";

describe("Port", () => {
  it("preserves the branded port schema surface", () => {
    expect<Port>().type.toBe<number & Brand.Brand<"Port">>();
    expect<typeof Port.Encoded>().type.toBe<number>();
    expect<PortType>().type.toBe<number & Brand.Brand<"Port">>();
  });

  it("tracks the port string codec types", () => {
    expect<PortFromString>().type.toBe<PortType>();
    expect<typeof PortFromString.Encoded>().type.toBe<string>();
    expect<PortFromStringType>().type.toBe<PortType>();
  });

  it("exposes decode and encode helpers with expected effect types", () => {
    const decode = S.decodeUnknownEffect(Port);
    const decodeString = S.decodeUnknownEffect(PortFromString);
    const encodeString = S.encodeEffect(PortFromString);
    const value = S.decodeSync(Port)(443);

    expect(value).type.toBe<PortType>();
    expect(decode(443)).type.toBe<Effect.Effect<PortType, S.SchemaError, never>>();
    expect(decodeString("443")).type.toBe<Effect.Effect<PortType, S.SchemaError, never>>();
    expect(encodeString(value)).type.toBe<Effect.Effect<string, S.SchemaError, never>>();
  });

  it("exports port helpers from the package root barrel", () => {
    expect<typeof RootPort>().type.toBe<typeof Port>();
    expect<typeof RootPortFromString>().type.toBe<typeof PortFromString>();
    expect<RootPortType>().type.toBe<PortType>();
    expect<RootPortFromStringType>().type.toBe<PortFromStringType>();
  });
});
