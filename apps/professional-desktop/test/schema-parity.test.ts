import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { IntakeDroppedFilePayload } from "@beep/documents-use-cases/public";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { DerivedThreadTitle } from "@/chat/DerivedThreadTitle";
import { configureSelectedWorkspaceVault } from "@/intake/DocumentIntakeTarget";
import {
  ConfigureWorkspaceVaultInput,
  DEFAULT_WORKSPACE_ID,
  DroppedDocumentInput,
  intakeDroppedFilePayload,
} from "@/intake/Intake.atoms";
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

  it.effect("preserves document intake onboarding and drop wire shapes", () =>
    Effect.gen(function* () {
      const configure = ConfigureWorkspaceVaultInput.make({
        vaultRootPath: "/tmp/beep-documents-vault",
        workspaceId: DEFAULT_WORKSPACE_ID,
      });
      expect(yield* S.encodeUnknownEffect(ConfigureWorkspaceVaultInput)(configure)).toStrictEqual({
        vaultRootPath: "/tmp/beep-documents-vault",
        workspaceId: 1,
      });

      const dropped = DroppedDocumentInput.make({
        content: new Uint8Array([1, 2, 3]),
        intakeBatchId: yield* S.decodeUnknownEffect(IntakeBatchId)("batch-1"),
        originalFileName: "Complaint.pdf",
        workspaceId: DEFAULT_WORKSPACE_ID,
      });
      expect(yield* S.encodeUnknownEffect(DroppedDocumentInput)(dropped)).toStrictEqual({
        content: "AQID",
        intakeBatchId: "batch-1",
        originalFileName: "Complaint.pdf",
        workspaceId: 1,
      });
    })
  );

  it.effect("constructs dropped-file RPC payloads from raw Uint8Array inputs", () =>
    Effect.gen(function* () {
      const payload = intakeDroppedFilePayload(
        DroppedDocumentInput.make({
          content: new Uint8Array([1, 2, 3]),
          intakeBatchId: yield* S.decodeUnknownEffect(IntakeBatchId)("batch-raw"),
          originalFileName: "Raw.pdf",
          workspaceId: DEFAULT_WORKSPACE_ID,
        })
      );

      expect(payload.content).toEqual(new Uint8Array([1, 2, 3]));
      expect(yield* S.encodeUnknownEffect(IntakeDroppedFilePayload)(payload)).toMatchObject({
        content: "AQID",
        originalFileName: "Raw.pdf",
      });
    })
  );

  it.effect("surfaces workspace vault configuration failures and allows retry status", () =>
    Effect.gen(function* () {
      const statuses: Array<string | null> = [];

      yield* configureSelectedWorkspaceVault(
        "/tmp/rejected-vault",
        () => Promise.reject({ message: "vault path rejected" }),
        (status) => statuses.push(status)
      );

      expect(statuses).toEqual(["Saving workspace vault", "vault path rejected"]);
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
