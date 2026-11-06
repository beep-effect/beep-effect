import { ActivityId } from "@beep/party-domain/Ids";
import { canonicalBytes, identifierBasis } from "@beep/party-domain/PartyKey";
import { ContactIngestInput, ingestContact } from "@beep/party-server/ContactEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { adaptMailRecord, MailIndexInput } from "@beep/party-server/MailIndex";
import { ContactCard, ContactEmailInput } from "@beep/party-use-cases/ContactSource";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const pairs = [
  Tuple.make("Dana Example <Dana@EXAMPLE.test>", " dana@example.test "),
  Tuple.make("Dana@example.test", "dana@example.test"),
  Tuple.make("E\u0301lodie@example.test", "élodie@example.test"),
  Tuple.make("dana@bücher.example", "dana@xn--bcher-kva.example"),
];
it.layer(PartyLedgerMemory)("mail/contact key equality", (it) => {
  it.effect("uses identical normalized values, canonical bytes and keys across actual adapters", () =>
    Effect.gen(function* () {
      for (const [index, pair] of A.map(pairs, (pair, index) => Tuple.make(index, pair))) {
        const mailInput = yield* S.decodeEffect(MailIndexInput)({
          record: {
            tree: "synthetic-mail",
            messagePath: `Inbox/${index}`,
            sourceArtifactId: "archive-synthetic",
            outlook: {},
            internet: { from: pair[0], to: [], cc: [] },
            recipients: [],
          },
          content: `party-sha256:message-${index}`,
          side: "third-party-production",
          producedBy: "party-act:key-mail",
          observedAt: 1,
        });
        const mail = yield* adaptMailRecord(mailInput);
        const card = ContactCard.make({
          sourceNamespace: "urn:synthetic:cards",
          sourceRecordId: `card-${index}`,
          label: "Unrelated display metadata",
          kind: "Person",
          emails: [ContactEmailInput.make({ raw: pair[1], represents: false })],
          phones: [],
          identifiers: [],
          roles: [],
        });
        const contact = yield* ingestContact(
          ContactIngestInput.make({
            card,
            activity: ActivityId.make(`party-act:key-card-${index}`),
            recordedAt: DateTime.makeUnsafe(5),
          })
        );
        const mailId = O.getOrThrow(A.head(mail.identifiers));
        const cardId = O.getOrThrow(A.head(contact.identifiers));
        expect(mailId.key).toBe(cardId.key);
        expect(mailId.id).toBe(cardId.id);
        const mailBasis = yield* identifierBasis(mailId.value);
        const cardBasis = yield* identifierBasis(cardId.value);
        expect(mailBasis.value).toBe(cardBasis.value);
        const resolved1 = yield* canonicalBytes(mailBasis);
        const resolved2 = yield* canonicalBytes(cardBasis);
        expect(resolved1).toEqual(resolved2);
        const reversed = yield* adaptMailRecord(
          MailIndexInput.make({
            ...mailInput,
            observedAt: DateTime.makeUnsafe(100),
            record: { ...mailInput.record, tree: "different-tree", messagePath: "Different/path" },
          })
        );
        expect(reversed.identifiers[0]?.key).toBe(mailId.key);
      }
    })
  );
});
