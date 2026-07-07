import { Drizzle, DrizzleError, DrizzleErrorContext, DrizzleOperation, DrizzleRows } from "@beep/drizzle";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type {
  DrizzleClient,
  DrizzleOperation as DrizzleOperationType,
  DrizzleRows as DrizzleRowsType,
  DrizzleShape,
} from "@beep/drizzle";
import type { Effect, Layer } from "effect";

declare const client: DrizzleClient;
declare const service: DrizzleShape;

describe("@beep/drizzle", () => {
  it("exports the single public DrizzleError shape", () => {
    expect(
      DrizzleError.make({ operation: "execute", cause: O.none(), query: O.none(), params: O.none() })
    ).type.toBe<DrizzleError>();
    expect(DrizzleError.make({ operation: DrizzleOperation.Enum.execute })).type.toBe<DrizzleError>();
    expect(
      DrizzleErrorContext.make({ query: O.some("select 1"), params: O.some([]) })
    ).type.toBe<DrizzleErrorContext>();
    expect(DrizzleError.fromUnknown("execute")).type.toBe<DrizzleError>();
    expect(DrizzleError.fromUnknown("execute", new Error("boom"))).type.toBe<DrizzleError>();
    expect(
      DrizzleError.fromUnknown("execute", new Error("boom"), DrizzleErrorContext.make())
    ).type.toBe<DrizzleError>();
    expect<DrizzleError["_tag"]>().type.toBe<"DrizzleError">();
    expect<DrizzleError["operation"]>().type.toBe<DrizzleOperationType>();
    expect<DrizzleError["cause"]>().type.toBe<O.Option<unknown>>();
    expect<DrizzleError["query"]>().type.toBe<O.Option<string>>();
    expect<DrizzleError["params"]>().type.toBe<O.Option<ReadonlyArray<"<redacted>">>>();

    // @ts-expect-error!
    DrizzleError.make({ cause: O.none() });

    // @ts-expect-error!
    DrizzleError.make({ operation: "execute", cause: new Error("boom"), query: O.none(), params: O.none() });

    // @ts-expect-error!
    DrizzleError.fromUnknown("connect");
  });

  it("exports the product-neutral service and adapter types", () => {
    expect(S.decodeUnknownSync(DrizzleRows)([])).type.toBe<DrizzleRowsType>();
    expect(DrizzleRows.fromUnknown([])).type.toBe<DrizzleRowsType>();
    expect<DrizzleRows>().type.toBe<DrizzleRowsType>();
    expect(Drizzle.makeLayer(client)).type.toBe<Layer.Layer<Drizzle>>();
    expect(service.execute("select 1", [])).type.toBe<Effect.Effect<DrizzleRowsType, DrizzleError>>();
    expect(service.withTransaction((transaction) => transaction.execute("select 1", []))).type.toBe<
      Effect.Effect<DrizzleRowsType, DrizzleError>
    >();
  });
});
