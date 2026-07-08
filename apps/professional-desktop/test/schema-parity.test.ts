import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { DerivedThreadTitle } from "@/chat/DerivedThreadTitle";
import { ProfessionalDesktopMigrationOptions } from "@/runtime/Migrations";
import { SidecarTransport } from "@/transport/SidecarTransport";
import { InboundEvent, InboundFrame, SidecarClosedPayload } from "@/transport/TauriIpcSocket";

const assertSchemaEncodeDecodeRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeUnknownEffect(schema);
  const decode = S.decodeUnknownEffect(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) =>
      Effect.runSync(
        Effect.gen(function* () {
          const encoded = yield* encode(value);
          const decoded = yield* decode(encoded);
          return equivalent(decoded, value);
        })
      )
    ),
    fcRuns(options?.numRuns ?? 50)
  );
};

describe("@beep/professional-desktop schema parity", () => {
  it.effect("preserves transport boundary encoded shapes", () =>
    Effect.gen(function* () {
      const sidecarTransportWire = { ipc: true };
      const sidecarTransport = yield* S.decodeUnknownEffect(SidecarTransport)(sidecarTransportWire);
      expect(yield* S.encodeUnknownEffect(SidecarTransport)(sidecarTransport)).toStrictEqual(sidecarTransportWire);

      const inboundFrameWire = '{"jsonrpc":"2.0"}\n';
      const inboundFrame = yield* InboundFrame.decodeUnknownEffect(inboundFrameWire);
      expect(yield* S.encodeUnknownEffect(InboundFrame)(inboundFrame)).toStrictEqual(inboundFrameWire);

      const inboundEventWire = { _tag: "Rx", payload: inboundFrameWire };
      const inboundEvent = yield* S.decodeUnknownEffect(InboundEvent)(inboundEventWire);
      expect(yield* S.encodeUnknownEffect(InboundEvent)(inboundEvent)).toStrictEqual(inboundEventWire);

      const closedPayloadWire = {
        code: 0,
        kind: "terminated",
        message: null,
        signal: null,
      };
      const closedPayload = yield* SidecarClosedPayload.decodeUnknownEffect(closedPayloadWire);
      expect(yield* S.encodeUnknownEffect(SidecarClosedPayload)(closedPayload)).toStrictEqual(closedPayloadWire);
    })
  );

  it.effect("preserves migration option wire shape and schema-owned default", () =>
    Effect.gen(function* () {
      const customWire = { migrationsSchema: "chat_runtime" };
      const custom = yield* S.decodeUnknownEffect(ProfessionalDesktopMigrationOptions)(customWire);
      expect(yield* S.encodeUnknownEffect(ProfessionalDesktopMigrationOptions)(custom)).toStrictEqual(customWire);

      const withDefault = ProfessionalDesktopMigrationOptions.make({});
      expect(withDefault.migrationsSchema).toBe("drizzle");
    })
  );

  it("normalizes derived titles through the schema", () => {
    const decodeTitle = S.decodeUnknownOption(DerivedThreadTitle);
    const longTitle = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-title";

    expect(O.getOrUndefined(decodeTitle("  Draft memo  "))).toBe("Draft memo");
    expect(O.getOrUndefined(decodeTitle(longTitle))).toBe(
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-t"
    );
    expect(O.isNone(decodeTitle("   "))).toBe(true);
  });

  it("round-trips schema-derived arbitraries through the absorbed invariants", () => {
    assertSchemaEncodeDecodeRoundTrip(SidecarTransport, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(InboundFrame, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(InboundEvent, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(SidecarClosedPayload, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(ProfessionalDesktopMigrationOptions, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(DerivedThreadTitle, { numRuns: 25 });
  });
});
