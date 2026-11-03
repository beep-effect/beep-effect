import { parseExportTime, parseMailbox } from "@beep/party-server/MailIndex";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("mail ingestion parsing", () => {
  it.effect("retains header names and shares canonical identifier keys", () =>
    Effect.gen(function* () {
      const header = yield* parseMailbox('"Doe, Dana" <Dana@EXAMPLE.test>');
      const bare = yield* parseMailbox(" dana@example.test ");
      expect(O.getOrThrow(header.displayName)).toBe("Doe, Dana");
      expect(O.getOrThrow(header.identifier).key).toBe(O.getOrThrow(bare.identifier).key);
      expect(O.getOrThrow(header.identifier).id).toBe(O.getOrThrow(bare.identifier).id);
      expect(O.isNone((yield* parseMailbox("not an address")).identifier)).toBe(true);
    })
  );
  it.effect("normalizes DN case without equating it to an SMTP identity", () =>
    Effect.gen(function* () {
      const lower = yield* parseMailbox("/o=Example/cn=Dana");
      const upper = yield* parseMailbox("/O=EXAMPLE/CN=DANA");
      const smtp = yield* parseMailbox("dana@example.test");
      expect(O.getOrThrow(lower.identifier).key).toBe(O.getOrThrow(upper.identifier).key);
      expect(O.getOrThrow(lower.identifier).key).not.toBe(O.getOrThrow(smtp.identifier).key);
    })
  );
  it("preserves millisecond precision and refuses rollover dates or missing zones", () => {
    const pff = O.getOrThrow(parseExportTime("Mar 12, 2025 16:42:08.123456789 UTC"));
    const iso = O.getOrThrow(parseExportTime("2025-03-12T16:42:08.123Z"));
    expect(DateTime.toEpochMillis(pff)).toBe(DateTime.toEpochMillis(iso));
    expect(O.isNone(parseExportTime("Feb 31, 2025 16:42:08 UTC"))).toBe(true);
    expect(O.isNone(parseExportTime("2025-02-31T16:42:08Z"))).toBe(true);
    expect(O.isNone(parseExportTime("2025-03-12T16:42:08"))).toBe(true);
    expect(DateTime.formatIso(O.getOrThrow(parseExportTime("2024-02-29T00:00:00Z")))).toBe("2024-02-29T00:00:00.000Z");
  });
});
