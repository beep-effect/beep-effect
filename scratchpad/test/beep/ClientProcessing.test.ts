import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  AwareInstant,
  CLIENT_PROCESSING_SCHEMA_VERSION,
  ClientActionItem,
  ClientEvent,
  ClientMemory,
  ClientProcessing,
  ClientProcessingChecked,
  ClientSection,
  ClientSummary,
  IanaTimezone,
  clientProcessingContentIssue,
  strippedText,
} from "../../beep/ClientProcessing.ts";

describe("ClientProcessing", () => {
  it("strips in-cap text and rejects over-cap and blank required text", () => {
    const Title = strippedText(10, 1);
    expect(Effect.runSync(S.decodeUnknownEffect(Title)("  hi  "))).toBe("hi");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(Title)("           x"))._tag).toBe("Failure");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(Title)("   "))._tag).toBe("Failure");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(AwareInstant)("2020-01-02T03:04:05"))._tag).toBe("Failure");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(AwareInstant)(0))._tag).toBe("Failure");
    expect(Date.parse(Effect.runSync(S.decodeUnknownEffect(S.DateTimeUtc)("2020-01-02T03:04:05Z")).toString())).not.toBeNaN();
    expect(Effect.runSync(S.decodeUnknownEffect(IanaTimezone)(" UTC "))).toBe("UTC");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(IanaTimezone)("Not/AZone"))._tag).toBe("Failure");
    expect(CLIENT_PROCESSING_SCHEMA_VERSION).toBe(1);
  });

  it("accepts content and rejects an empty projection", () => {
    const decoded = Effect.runSync(
      S.decodeUnknownEffect(ClientProcessingChecked)({
        schemaVersion: 1,
        durationSeconds: 15,
        projectionFamily: " phone ",
        summaryText: "  Talked  ",
        clientDeviceId: null,
        sections: [],
        actionItems: [],
        events: [],
        memories: [],
      }),
    );
    expect(decoded.projectionFamily).toBe("phone");
    expect(O.getOrElse(decoded.summaryText, () => "")).toBe("Talked");
    expect(O.isNone(decoded.clientDeviceId)).toBe(true);
    expect(O.isNone(decoded.summary)).toBe(true);
    const empty = ClientProcessing.make({ durationSeconds: 1, projectionFamily: "phone" });
    expect(O.isSome(clientProcessingContentIssue(empty))).toBe(true);
    expect(
      Effect.runSyncExit(
        S.decodeUnknownEffect(ClientProcessingChecked)({
          schemaVersion: 1,
          durationSeconds: 1,
          projectionFamily: "phone",
          sections: [],
          actionItems: [],
          events: [],
          memories: [],
        }),
      )._tag,
    ).toBe("Failure");
    expect(ClientSection.make({ title: "Notes" }).overview).toBe("");
    expect(ClientActionItem.make({ description: "Ship" }).completed).toBe(false);
    expect(ClientMemory.make({ content: "Seattle" }).category).toBe("other");
    expect(
      Effect.runSync(
        S.decodeUnknownEffect(ClientEvent)({ title: "Standup", start: "2020-01-02T03:04:05Z", duration: 30 }),
      ).duration,
    ).toBe(30);
    expect(ClientSummary.make({ title: "Day" }).overview).toBe("");
    for (const schema of [ClientSection, ClientActionItem, ClientEvent, ClientMemory, ClientSummary, ClientProcessing]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});
