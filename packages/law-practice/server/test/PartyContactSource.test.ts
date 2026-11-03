import {
  adaptPracticeContact,
  LegacyContactKgRow,
  PartyContactSourceLive,
  PracticeContactInput,
  PracticeContactRecords,
} from "@beep/law-practice-server/PartyContactSource";
import { Contact, IdentificationError } from "@beep/law-practice-use-cases/DocumentIdentification";
import { ContactSource } from "@beep/party-use-cases/ContactSource";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const legacyRow = {
  contactId: "legacy-1",
  displayName: "Example Services",
  organization: "Example Services",
  emails: [{ address: "info@example.test", role: true }],
  sources: ["csv"],
  links: [
    { clientNumber: "12345", familyKey: null, source: "attorney-filed-email", evidence: "Synthetic attorney source" },
    { clientNumber: "12345", familyKey: null, source: "org-name-match", evidence: "Synthetic name match" },
  ],
};
const legacy = S.decodeUnknownEffect(LegacyContactKgRow)(legacyRow);
const current = S.decodeUnknownEffect(Contact)({
  ...legacyRow,
  contactId: Str.repeat(64)("a"),
  displayName: "Dana Example",
  organization: "Example Services",
  sources: ["outlook-csv"],
  titles: [],
  domains: ["example.test"],
  phones: [{ e164: "+12015550123", areaCode: "201" }],
  addresses: [],
});
const recordsLayer = Layer.effect(
  PracticeContactRecords,
  Effect.gen(function* () {
    const contact = yield* current;
    const old = yield* legacy;
    return PracticeContactRecords.of({
      sourceNamespace: "urn:synthetic:practice",
      records: Stream.fromIterable([contact, old]),
    });
  })
);
const sourceLayer = PartyContactSourceLive.pipe(Layer.provide(recordsLayer));

describe("practice contact translation", () => {
  it.effect("preserves source-specific contextual anchors and shared addresses", () =>
    Effect.gen(function* () {
      const contact = yield* legacy;
      const translated = adaptPracticeContact(
        PracticeContactInput.make({ contact, sourceNamespace: "urn:synthetic:practice" })
      );
      expect(translated.kind).toBe("Organization");
      expect(translated.emails[0]?.represents).toBe(true);
      expect(translated.phones).toEqual([]);
      expect(A.map(translated.roles, (role) => role.context)).toEqual([
        "party-ctx:client:12345",
        "party-ctx:client:12345",
      ]);
      expect(A.map(translated.roles, (role) => role.anchor)).toEqual([
        "legacy-1#link:attorney-filed-email",
        "legacy-1#link:org-name-match",
      ]);
    })
  );
  it.effect("preserves current E.164 phones without guessing a country", () =>
    Effect.gen(function* () {
      const contact = yield* current;
      const translated = adaptPracticeContact(
        PracticeContactInput.make({ contact, sourceNamespace: "urn:synthetic:practice" })
      );
      expect(translated.kind).toBe("Person");
      expect(translated.phones[0]?.raw).toBe("+12015550123");
      expect(translated.phones[0]?.country._tag).toBe("None");
    })
  );
});
it.layer(sourceLayer, { timeout: "30 seconds" })("contact port implementation", (it) => {
  it.effect("exposes current and legacy records through the public party port and replays", () =>
    Effect.gen(function* () {
      const source = yield* ContactSource;
      const first = yield* Stream.runCollect(source.cards);
      const second = yield* Stream.runCollect(source.cards);
      expect(first).toHaveLength(2);
      expect(second).toEqual(first);
    })
  );
});
const failingLayer = PartyContactSourceLive.pipe(
  Layer.provide(
    Layer.succeed(PracticeContactRecords, {
      sourceNamespace: "urn:synthetic:practice",
      records: Stream.fail(IdentificationError.make({ reason: "unavailable", operation: "test" })),
    })
  )
);
it.layer(failingLayer)("contact failure boundary", (it) => {
  it.effect("maps source failures to a log-safe party error", () =>
    Effect.gen(function* () {
      const source = yield* ContactSource;
      const error = yield* Stream.runCollect(source.cards).pipe(Effect.flip);
      expect(error.reason).toBe("practice-contact-source-failed");
    })
  );
});
