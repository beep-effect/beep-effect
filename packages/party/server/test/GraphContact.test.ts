import { GraphContact, GraphEmailAddress } from "@beep/m365/M365.schemas";
import { ActivityId } from "@beep/party-domain/Ids";
import {
  adaptGraphContact,
  ContactIngestInput,
  GraphContactInput,
  ingestContact,
} from "@beep/party-server/ContactEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { ContactCard, ContactEmailInput } from "@beep/party-use-cases/ContactSource";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const at = DateTime.makeUnsafe(1);
it.layer(PartyLedgerMemory)("Graph contact adapter", (it) => {
  it.effect("shares canonical keys with generic cards and preserves explicit phone context", () =>
    Effect.gen(function* () {
      const graph = GraphContact.make({
        id: "graph-1",
        givenName: O.some("Dana"),
        companyName: O.some("Example"),
        displayName: O.some("Dana Example"),
        emailAddresses: O.some([GraphEmailAddress.make({ address: O.some("Dana@EXAMPLE.test") })]),
        businessPhones: O.some(["(201) 555-0123"]),
      });
      const mapped = adaptGraphContact(
        GraphContactInput.make({ contact: graph, sourceNamespace: "urn:synthetic:graph", country: O.some("US") })
      );
      const generic = ContactCard.make({
        sourceNamespace: "urn:synthetic:generic",
        sourceRecordId: "card-2",
        label: "Different metadata",
        kind: "Person",
        emails: [ContactEmailInput.make({ raw: " dana@example.test ", represents: false })],
        phones: [],
        identifiers: [],
        roles: [],
      });
      const left = yield* ingestContact(
        ContactIngestInput.make({ card: mapped, activity: ActivityId.make("party-act:graph"), recordedAt: at })
      );
      const right = yield* ingestContact(
        ContactIngestInput.make({ card: generic, activity: ActivityId.make("party-act:generic"), recordedAt: at })
      );
      expect(mapped.kind).toBe("Person");
      expect(left.identifiers[0]?.key).toBe(right.identifiers[0]?.key);
      expect(
        A.some(left.identifiers, (row) => row.value._tag === "PhoneNumber" && row.value.e164 === "+12015550123")
      ).toBe(true);
      expect(left.issues).toEqual([]);
    })
  );
  it.effect("keeps company-only cards organizations and rejects ambiguous national phones", () =>
    Effect.gen(function* () {
      const graph = GraphContact.make({
        id: "graph-company",
        companyName: O.some("Example Services"),
        mobilePhone: O.some("2015550123"),
      });
      const mapped = adaptGraphContact(
        GraphContactInput.make({ contact: graph, sourceNamespace: "urn:synthetic:graph", country: O.none() })
      );
      expect(mapped.kind).toBe("Organization");
      expect(mapped.label).toBe("Example Services");
      const result = yield* ingestContact(
        ContactIngestInput.make({ card: mapped, activity: ActivityId.make("party-act:company"), recordedAt: at })
      );
      expect(result.issues[0]?.reason).toBe("ambiguous-phone");
      expect(O.getOrThrow(result.party).keys).toHaveLength(1);
    })
  );
});
