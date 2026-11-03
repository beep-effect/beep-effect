import { ActivityId } from "@beep/party-domain/Ids";
import { ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import {
  ContactIngestInput,
  ContactSourceIngestInput,
  ingestContact,
  ingestContactSource,
} from "@beep/party-server/ContactEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { ContactCard, ContactEmailInput, ContactSource, PhoneNumberInput } from "@beep/party-use-cases/ContactSource";
import { PartyLedger } from "@beep/party-use-cases/Ledger";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";

const at = DateTime.makeUnsafe(1);
const card = (sourceRecordId: string, emails: ReadonlyArray<string>) =>
  ContactCard.make({
    sourceNamespace: "urn:synthetic:cards",
    sourceRecordId,
    label: "Dana Example",
    kind: "Person",
    emails: A.map(emails, (raw) => ContactEmailInput.make({ raw, represents: false })),
    phones: [],
    identifiers: [],
    roles: [],
  });
const request = (card: ContactCard, name: string) =>
  ContactIngestInput.make({ card, activity: ActivityId.make(`party-act:${name}`), recordedAt: at });

it.layer(PartyLedgerMemory)("contact evidence", (it) => {
  it.effect("normalizes identifiers into shared keys while keeping cards and claims provisional", () =>
    Effect.gen(function* () {
      const left = yield* ingestContact(request(card("one", ["Dana Example <Dana@EXAMPLE.test>"]), "one"));
      const right = yield* ingestContact(request(card("two", [" dana@example.test "]), "two"));
      expect(left.identifiers[0]?.key).toEqual(right.identifiers[0]?.key);
      expect(left.identifiers[0]?.id).toEqual(right.identifiers[0]?.id);
      expect(O.getOrThrow(left.party).id).not.toBe(O.getOrThrow(right.party).id);
      expect(A.every(left.versions, (version) => version.review._tag === "Proposed")).toBe(true);
      expect(A.some(left.versions, (version) => version.proposition._tag === "SameParty")).toBe(false);
      const ledger = yield* PartyLedger;
      const snapshot = yield* ledger.snapshot;
      expect(snapshot.observations).toHaveLength(2);
      expect(snapshot.assertions).toHaveLength(4);
      expect(snapshot.versions).toHaveLength(4);
      expect(resolveParties(snapshot.versions, ResolutionScope.make({ asOf: at, validAt: at })).keys).toEqual([]);
    })
  );
});
it.layer(PartyLedgerMemory)("contact data quality", (it) => {
  it.effect("reports invalid inputs and uses a stable source-record fallback", () =>
    Effect.gen(function* () {
      const input = ContactCard.make({
        ...card("fallback", ["not-an-email"]),
        phones: [PhoneNumberInput.make({ raw: "2015550123", country: O.none() })],
      });
      const result = yield* ingestContact(request(input, "fallback"));
      expect(result.identifiers).toEqual([]);
      expect(A.map(result.issues, (issue) => issue.reason)).toEqual(["unparseable-mailbox", "ambiguous-phone"]);
      expect(O.getOrThrow(result.party).keys).toHaveLength(1);
      const changedLabel = yield* ingestContact(
        request(ContactCard.make({ ...input, label: "Changed label" }), "fallback-repeat")
      );
      expect(O.getOrThrow(changedLabel.party).keys).toEqual(O.getOrThrow(result.party).keys);
      const ledger = yield* PartyLedger;
      const before = yield* ledger.snapshot;
      const rejected = yield* ingestContact(
        request(ContactCard.make({ ...card("", []), sourceNamespace: "" }), "missing")
      );
      expect(O.isNone(rejected.party)).toBe(true);
      expect(rejected.issues[0]?.reason).toBe("missing-source-record-identity");
      expect(yield* ledger.snapshot).toEqual(before);
    })
  );
});
it.layer(PartyLedgerMemory)("contact replay", (it) => {
  it.effect("keeps keys independent of input ordering and rejects repeated extraction without duplicate evidence", () =>
    Effect.gen(function* () {
      const input = card("ordered", ["dana@example.test", "dana+team@example.test"]);
      const original = yield* ingestContact(request(input, "ordered"));
      const reordered = yield* ingestContact(
        request(ContactCard.make({ ...input, emails: A.reverse(input.emails) }), "reordered")
      );
      expect(A.map(original.identifiers, (row) => row.key)).toEqual(
        A.reverse(A.map(reordered.identifiers, (row) => row.key))
      );
      expect(A.dedupe(A.map(original.identifiers, (row) => row.key))).toHaveLength(2);
      const ledger = yield* PartyLedger;
      const before = yield* ledger.snapshot;
      const failure = yield* ingestContact(request(input, "ordered")).pipe(Effect.flip);
      expect(failure._tag).toBe("LedgerConflict");
      expect(yield* ledger.snapshot).toEqual(before);
    })
  );
});
it.layer(PartyLedgerMemory)("contact shared mailbox", (it) => {
  it.effect("retains represents without converting it into personal attribution", () =>
    Effect.gen(function* () {
      const input = ContactCard.make({
        ...card("shared", []),
        emails: [ContactEmailInput.make({ raw: "info@example.test", represents: true })],
      });
      const result = yield* ingestContact(request(input, "shared"));
      expect(A.filter(result.assertions, (assertion) => assertion.proposition._tag === "IdentifierOf")).toHaveLength(1);
      expect(
        A.some(
          result.assertions,
          (assertion) =>
            assertion.proposition._tag === "IdentifierOf" && assertion.proposition.relation === "represents"
        )
      ).toBe(true);
    })
  );
});

const sourceLayer = Layer.merge(
  PartyLedgerMemory,
  Layer.succeed(
    ContactSource,
    ContactSource.of({
      cards: Stream.fromIterable([card("port-one", ["dana@example.test"]), card("port-two", ["sam@example.test"])]),
    })
  )
);
it.layer(sourceLayer)("generic contact source workflow", (it) => {
  it.effect("consumes the source port and records all provisional evidence", () =>
    Effect.gen(function* () {
      const results = yield* ingestContactSource(
        ContactSourceIngestInput.make({ activity: ActivityId.make("party-act:source"), recordedAt: at })
      );
      expect(results).toHaveLength(2);
      const ledger = yield* PartyLedger;
      const snapshot = yield* ledger.snapshot;
      expect(snapshot.observations).toHaveLength(2);
      expect(snapshot.assertions).toHaveLength(4);
      expect(snapshot.versions).toHaveLength(4);
    })
  );
});
