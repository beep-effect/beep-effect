import { isDelegated, voiceOf } from "@beep/party-domain/Communication";
import { ActivityId, ContentId } from "@beep/party-domain/Ids";
import {
  aggregatePairings,
  PairingAggregationInput,
  PairingClaimsInput,
  PairingObservation,
  pairingClaims,
} from "@beep/party-server/IdentityEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { adaptMailRecord, ingestMailRecord, MailIndexInput } from "@beep/party-server/MailIndex";
import { PartyLedger } from "@beep/party-use-cases/Ledger";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const dn = (name: string) => `/O=ACME/OU=EXCHANGE/CN=RECIPIENTS/CN=${name}`;
const base = { tree: "synthetic", sourceArtifactId: "artifact:synthetic-pst", messagePath: "Inbox/Message1" };
const request = (record: unknown) =>
  S.decodeUnknownEffect(MailIndexInput)({
    record,
    content: "party-sha256:synthetic-message",
    side: "third-party-production",
    producedBy: "party-act:mail",
    observedAt: 1,
  });
const adapt = (record: unknown) => request(record).pipe(Effect.flatMap(adaptMailRecord));
const delegated = {
  ...base,
  outlook: {
    senderEmailAddress: dn("AVERY"),
    senderName: "Avery Chen",
    sentRepresentingEmailAddress: dn("DANA"),
    sentRepresentingName: "Dana Brooks",
    clientSubmitTime: "2025-04-01T09:00:00Z",
  },
  internet: { from: "Dana Brooks <dana@acme.example>", to: ["Riley Ng <riley@acme.example>"], cc: [] },
  recipients: [{ kind: "to", addressType: "EX", displayName: "Riley Ng", emailAddress: dn("RILEY") }],
};

describe("mail record adaptation", () => {
  it.effect("keeps delegate, represented mailbox and From apart while proposing only matching aliases", () =>
    Effect.gen(function* () {
      const result = yield* adapt(delegated);
      expect(isDelegated(voiceOf(O.getOrThrow(result.event)))).toBe(true);
      expect(
        A.sort(
          A.map(result.identifiers, (row) => row.value._tag),
          Order.String
        )
      ).toEqual(["EmailAddress", "EmailAddress", "ExchangeDn", "ExchangeDn", "ExchangeDn"]);
      expect(
        A.sort(
          A.map(result.pairings, (pairing) => pairing.displayName),
          Order.String
        )
      ).toEqual(["Dana Brooks", "Riley Ng"]);
      expect(result.issues).toEqual([]);
    })
  );
  it.effect("records address-type hazards even when no swap is needed", () =>
    Effect.gen(function* () {
      const result = yield* adapt({
        ...base,
        outlook: { senderEmailAddress: "jordan@acme.example" },
        recipients: [
          { kind: "to", addressType: "maya@acme.example", emailAddress: "maya@acme.example" },
          { kind: "cc", emailAddress: "Undisclosed recipients" },
        ],
      });
      expect(
        A.sort(
          A.map(result.issues, (issue) => issue._tag),
          Order.String
        )
      ).toEqual(["AddressTypeHoldsAddress", "UnparsedAddress"]);
      pipe(result.event, O.isSome, TestUtils.assertTrue);
    })
  );
  it.effect("recovers the explicit swapped export fields", () =>
    Effect.gen(function* () {
      const result = yield* adapt({
        ...base,
        outlook: { senderEmailAddress: "jordan@acme.example" },
        recipients: [{ kind: "to", addressType: "maya@acme.example", emailAddress: "SMTP" }],
      });
      expect(A.map(result.issues, (issue) => issue._tag)).toEqual(["AddressTypeHoldsAddress"]);
      expect(
        A.some(
          result.identifiers,
          (row) => row.value._tag === "EmailAddress" && row.value.normalized === "maya@acme.example"
        )
      ).toBe(true);
    })
  );
  it.effect("anchors sender-only fallback to the actual MAPI field", () =>
    Effect.gen(function* () {
      const result = yield* adapt({ ...base, outlook: { senderEmailAddress: "jordan@acme.example" }, recipients: [] });
      const from = A.findFirst(result.observations, (row) => row._tag === "HeaderParticipant" && row.role === "from");
      TestUtils.assertSome(
        O.map(from, (row) =>
          row._tag === "HeaderParticipant" && row.anchor._tag === "HeaderField" ? row.anchor.field : ""
        ),
        "PR_SENDER_EMAIL_ADDRESS"
      );
    })
  );
  it.effect("does not manufacture an event from absent or malformed From evidence", () =>
    Effect.gen(function* () {
      const missing = yield* adapt({
        ...base,
        outlook: {},
        recipients: [{ kind: "to", emailAddress: "riley@acme.example" }],
      });
      TestUtils.assertNone(missing.event);
      expect(A.map(missing.issues, (issue) => issue._tag)).toEqual(["NoFromParticipant"]);
      const malformed = yield* adapt({
        ...base,
        outlook: { senderEmailAddress: "sender@acme.example" },
        internet: { from: "malformed", to: [], cc: [] },
        recipients: [],
      });
      TestUtils.assertNone(malformed.event);
      expect(A.map(malformed.issues, (issue) => issue._tag)).toEqual(["UnparsedAddress", "NoFromParticipant"]);
    })
  );
  it.effect("deduplicates recipient participants while retaining every source observation", () =>
    Effect.gen(function* () {
      const result = yield* adapt({
        ...base,
        outlook: { senderEmailAddress: "sender@acme.example" },
        internet: { to: ["Dana <dana@acme.example>"], cc: [] },
        recipients: [{ kind: "to", emailAddress: "Dana@ACME.example" }],
      });
      expect(A.filter(O.getOrThrow(result.event).participants, (row) => row.role === "to")).toHaveLength(1);
      expect(
        A.filter(result.observations, (row) => row._tag === "HeaderParticipant" && row.role === "to")
      ).toHaveLength(2);
    })
  );
});
it.layer(PartyLedgerMemory)("mail ledger ingestion", (it) => {
  it.effect("appends anchored observations and rejects replay without duplicate rows", () =>
    Effect.gen(function* () {
      const input = yield* request(delegated);
      const result = yield* ingestMailRecord(input);
      const ledger = yield* PartyLedger;
      const before = yield* ledger.snapshot;
      expect(before.observations).toEqual(result.observations);
      expect(before.assertions).toEqual(result.assertions);
      expect(before.assertions).toHaveLength(2);
      expect(before.versions).toEqual([]);
      const failure = yield* ingestMailRecord(input).pipe(Effect.flip);
      expect(failure._tag).toBe("LedgerConflict");
      expect(yield* ledger.snapshot).toEqual(before);
    })
  );
});

it.effect("keeps parent archive identity separate from child message content", () =>
  Effect.gen(function* () {
    const input = yield* request(delegated);
    const first = yield* adaptMailRecord(input);
    const changed = yield* adaptMailRecord(
      MailIndexInput.make({ ...input, content: ContentId.make("party-sha256:changed-message") })
    );
    expect(first.occurrence.content).toBe(input.content);
    expect(changed.occurrence.content).not.toBe(first.occurrence.content);
    expect(changed.occurrence.id).not.toBe(first.occurrence.id);
    expect(changed.occurrence.locator).toEqual(first.occurrence.locator);
  })
);

it.effect("binds every pairing to a real assertion anchored in both source header fields", () =>
  Effect.gen(function* () {
    const input = yield* request(delegated);
    const result = yield* adaptMailRecord(input);
    expect(result.assertions).toHaveLength(result.pairings.length);
    A.forEach(result.pairings, (pairing) => {
      const assertion = O.getOrThrow(A.findFirst(result.assertions, (row) => row.id === pairing.assertion));
      expect(assertion.proposition).toMatchObject({
        _tag: "AccountIdentifier",
        account: pairing.mailbox,
        identifier: pairing.smtp,
      });
      expect(assertion.anchors).toHaveLength(2);
      expect(assertion.validTime._tag).toBe("Unknown");
      expect(assertion.producedBy).toBe(input.producedBy);
      A.forEach(assertion.anchors, (anchor) =>
        expect(
          A.some(
            result.observations,
            (row) =>
              row._tag === "HeaderParticipant" &&
              row.anchor._tag === "HeaderField" &&
              anchor._tag === "HeaderField" &&
              row.anchor.occurrence === anchor.occurrence &&
              row.anchor.namespace === anchor.namespace &&
              row.anchor.field === anchor.field
          )
        ).toBe(true)
      );
    });
    const reextracted = yield* adaptMailRecord(
      MailIndexInput.make({ ...input, producedBy: ActivityId.make("party-act:reextract") })
    );
    expect(A.some(reextracted.assertions, (row) => A.some(result.assertions, (old) => old.id === row.id))).toBe(false);
    expect((yield* adaptMailRecord(input)).assertions).toEqual(result.assertions);
  })
);

it.effect("builds pairing proposals whose support resolves to the extracted assertions", () =>
  Effect.gen(function* () {
    const input = yield* request(delegated);
    const mail = yield* adaptMailRecord(input);
    const supports = aggregatePairings(
      PairingAggregationInput.make({
        observations: A.map(mail.pairings, (pairing) =>
          PairingObservation.make({ pairing, sentAt: O.flatMap(mail.event, (event) => event.sentAt) })
        ),
        sampleSize: 5,
      })
    );
    const claims = pairingClaims(PairingClaimsInput.make({ supports, recordedAt: input.observedAt }));
    expect(claims).toHaveLength(2);
    A.forEach(claims, (claim) => {
      expect(claim.review._tag).toBe("Proposed");
      A.forEach(claim.supportedBy, (id) => {
        const assertion = O.getOrThrow(A.findFirst(mail.assertions, (row) => row.id === id));
        expect(assertion.proposition).toEqual(claim.proposition);
      });
    });
  })
);
