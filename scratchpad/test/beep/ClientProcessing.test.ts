import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
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

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.ConstraintDecoder<unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("ClientProcessing", () => {
  it("strips in-cap text and rejects over-cap and blank required text", () => {
    const Title = strippedText(10, 1);
    expect(decode(Title, "  hi  ")).toBe("hi");
    expect(decodeFails(Title, "           x")).toBe(true);
    expect(decodeFails(Title, "   ")).toBe(true);
    expect(decodeFails(AwareInstant, "2020-01-02T03:04:05")).toBe(true);
    expect(decodeFails(AwareInstant, 0)).toBe(true);
    expect(DateTime.formatIso(decode(S.DateTimeUtcFromString, "2020-01-02T03:04:05Z"))).toBe("2020-01-02T03:04:05.000Z");
    expect(decode(IanaTimezone, " UTC ")).toBe("UTC");
    expect(decodeFails(IanaTimezone, "Not/AZone")).toBe(true);
    expect(CLIENT_PROCESSING_SCHEMA_VERSION).toBe(1);
  });

  it("accepts content and rejects an empty projection", () => {
    const decoded = decode(ClientProcessingChecked, {
      schemaVersion: 1,
      durationSeconds: 15,
      projectionFamily: " phone ",
      summaryText: "  Talked  ",
      clientDeviceId: null,
      sections: [],
      actionItems: [],
      events: [],
      memories: [],
    });
    expect(decoded.projectionFamily).toBe("phone");
    expect(O.getOrElse(decoded.summaryText, () => "")).toBe("Talked");
    expect(O.isNone(decoded.clientDeviceId)).toBe(true);
    expect(O.isNone(decoded.summary)).toBe(true);
    const empty = ClientProcessing.make({ durationSeconds: 1, projectionFamily: "phone" });
    expect(O.isSome(clientProcessingContentIssue(empty))).toBe(true);
    expect(
      decodeFails(ClientProcessingChecked, {
        schemaVersion: 1,
        durationSeconds: 1,
        projectionFamily: "phone",
        sections: [],
        actionItems: [],
        events: [],
        memories: [],
      }),
    ).toBe(true);
    expect(ClientSection.make({ title: "Notes" }).overview).toBe("");
    expect(ClientActionItem.make({ description: "Ship" }).completed).toBe(false);
    expect(ClientMemory.make({ content: "Seattle" }).category).toBe("other");
    expect(decode(ClientEvent, {
        title: "Standup",
        description: "",
        start: "2020-01-02T03:04:05Z",
        duration: 30,
        created: false,
      }).duration).toBe(30);
    expect(ClientSummary.make({ title: "Day" }).overview).toBe("");
    for (const schema of [ClientSection, ClientActionItem, ClientEvent, ClientMemory, ClientSummary, ClientProcessing]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});
