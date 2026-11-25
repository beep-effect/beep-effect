/** Fully synthetic Acme competency fixture. No production or corpus data. */
import { ValidTime } from "@beep/epistemics/Claim";
import { mergeClaimLedgers, SourceAssertion } from "@beep/party-domain/Claim";
import { CommunicationEvent, Observation, Participant, voiceOf } from "@beep/party-domain/Communication";
import {
  ActivityId,
  ArtifactOccurrenceId,
  AssertionId,
  EventId,
  IdentifierId,
  ObservationId,
} from "@beep/party-domain/Ids";
import { Party } from "@beep/party-domain/Party";
import { Proposition } from "@beep/party-domain/Proposition";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { at, interval, partyClaim, retraction, signals } from "./claims.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type * as DateTime from "effect/DateTime";

export { at, signals };

export const ids = {
  maya: PartyId.make(1),
  jordan: PartyId.make(2),
  avery: PartyId.make(3),
  dana: PartyId.make(4),
  sam: PartyId.make(5),
  riley: PartyId.make(6),
  quinn: PartyId.make(7),
  pat: PartyId.make(8),
  chrisA: PartyId.make(9),
  chrisB: PartyId.make(10),
  chrisDuplicate: PartyId.make(11),
  acme: PartyId.make(12),
  finance: PartyId.make(13),
};
export const email = (name: string) => IdentifierId.make(`party-ident:email:${name}@acme.example`);
const claim = (
  operation: string,
  proposition: Proposition,
  knowledgeStart = 10,
  validFrom = 0,
  validTo: O.Option<DateTime.Utc> = O.none(),
  supersedes?: ClaimId
) =>
  partyClaim({
    proposition,
    knowledgeStart,
    validTime: interval({ from: validFrom, to: validTo }),
    operation,
    supersedes,
    supportedBy: [AssertionId.make(`party-asrt:${operation}`)],
  });
const header = (n: number, role: Participant["role"], name: string) =>
  Participant.make({
    role,
    identifier: email(name),
    observation: ObservationId.make(`party-obs:header:${n}:${role}:${name}`),
  });
const event = (n: number, participants: ReadonlyArray<Participant>) =>
  CommunicationEvent.make({
    id: EventId.make(`party-evt:${n}`),
    occurrence: ArtifactOccurrenceId.make(`party-occ:msg:${n}`),
    channel: "email",
    sentAt: O.some(at(100 + n)),
    messageId: O.some(`<${n}@acme.example>`),
    conversationKey: O.none(),
    participants: [O.getOrThrow(A.head(participants)), ...A.drop(participants, 1)],
  });
const makeFixture = Effect.gen(function* () {
  const parties = [
    Party.cases.Person.make({ id: ids.maya, keys: [], label: "Maya Patel" }),
    Party.cases.Person.make({ id: ids.chrisA, keys: [], label: "Chris Morgan" }),
    Party.cases.Person.make({ id: ids.chrisB, keys: [], label: "Chris Morgan" }),
    Party.cases.Organization.make({ id: ids.acme, keys: [], label: "Acme Implement Co.", orgKind: O.none() }),
  ];
  const events = [
    event(1, [header(1, "from", "finance"), header(1, "to", "jordan")]),
    event(2, [
      header(2, "from", "dana"),
      header(2, "sender", "avery"),
      header(2, "sent-representing", "dana"),
      header(2, "to", "riley"),
    ]),
    event(3, [header(3, "from", "riley"), header(3, "to", "sam"), header(3, "cc", "dana")]),
    event(4, [header(4, "from", "sam"), header(4, "to", "riley"), header(4, "cc", "dana")]),
    event(5, [header(5, "from", "quinn"), header(5, "to", "sam")]),
    event(6, [header(6, "from", "sam"), header(6, "to", "quinn")]),
    event(7, [header(7, "from", "sam"), header(7, "to", "dana")]),
    event(8, [header(8, "from", "dana"), header(8, "to", "pat")]),
  ];
  const eventNo = (n: number) => O.getOrThrow(A.findFirst(events, (row) => row.id === `party-evt:${n}`));
  const speech = (n: number, act: (typeof Observation.cases.SpeechActLabel.Type)["act"]) =>
    Observation.cases.SpeechActLabel.make({
      id: ObservationId.make(`party-obs:speech:${n}`),
      producedBy: ActivityId.make("party-act:classifier"),
      observedAt: at(10),
      event: eventNo(n).id,
      act,
      anchor: EvidenceAnchor.cases.HeaderField.make({
        occurrence: eventNo(n).occurrence,
        namespace: "load-file",
        field: "body",
      }),
    });
  const observations = [
    speech(3, "requests-approval"),
    speech(4, "grants-approval"),
    speech(5, "requests-approval"),
    speech(6, "grants-approval"),
    speech(7, "grants-approval"),
    speech(8, "escalates"),
  ];
  const identifier = (name: string, party: PartyId) =>
    claim(
      `ident:${name}`,
      Proposition.cases.IdentifierOf.make({ identifier: email(name), party, relation: "used-by" })
    );
  const author = (n: number, party: PartyId) =>
    claim(`voice:${n}`, Proposition.cases.VoiceAuthor.make({ voice: voiceOf(eventNo(n)).id, author: party }));
  const reportsTo = (subordinate: PartyId, superior: PartyId) =>
    claim(
      `reports:${subordinate}`,
      Proposition.cases.ReportsTo.make({ subordinate, superior, organization: O.some(ids.acme) })
    );
  const financeV1 = yield* claim(
    "finance:1",
    Proposition.cases.IdentifierOf.make({ identifier: email("finance"), party: ids.maya, relation: "used-by" }),
    12
  );
  const financeV2 = yield* claim(
    "finance:2",
    Proposition.cases.IdentifierOf.make({ identifier: email("finance"), party: ids.finance, relation: "represents" }),
    19
  );
  const phone = IdentifierId.make("party-ident:tel:+15155550100");
  const averyAuthorship = yield* author(2, ids.avery);
  const rows = yield* Effect.all(
    [
      identifier("maya", ids.maya),
      identifier("jordan", ids.jordan),
      identifier("avery", ids.avery),
      identifier("dana", ids.dana),
      identifier("sam", ids.sam),
      identifier("riley", ids.riley),
      identifier("quinn", ids.quinn),
      identifier("pat", ids.pat),
      claim(
        "phone:jordan",
        Proposition.cases.IdentifierOf.make({ identifier: phone, party: ids.jordan, relation: "used-by" }),
        10,
        0,
        O.some(at(40))
      ),
      claim(
        "phone:riley",
        Proposition.cases.IdentifierOf.make({ identifier: phone, party: ids.riley, relation: "used-by" }),
        10,
        60
      ),
      claim("same:chris-a-dup", Proposition.cases.SameParty.make({ left: ids.chrisA, right: ids.chrisDuplicate })),
      claim("same:chris-dup-b", Proposition.cases.SameParty.make({ left: ids.chrisDuplicate, right: ids.chrisB }), 11),
      claim("distinct:chris-a-b", Proposition.cases.DistinctParty.make({ left: ids.chrisA, right: ids.chrisB })),
      author(3, ids.riley),
      author(4, ids.sam),
      author(5, ids.quinn),
      author(8, ids.dana),
      reportsTo(ids.sam, ids.dana),
      reportsTo(ids.riley, ids.dana),
      reportsTo(ids.quinn, ids.dana),
      reportsTo(ids.dana, ids.pat),
      reportsTo(ids.maya, ids.pat),
    ],
    { concurrency: 1 }
  );
  const vetoChris = O.getOrThrow(A.findFirst(rows, (row) => row.record.core.proposition._tag === "DistinctParty"));
  const ledger = mergeClaimLedgers([
    ...A.map(rows, (row) => row.ledger),
    averyAuthorship.ledger,
    financeV1.ledger,
    retraction({ claim: financeV1.claim, at: 19 }),
    financeV2.ledger,
  ]);
  const assertion = SourceAssertion.make({
    id: AssertionId.make("party-asrt:voice:2"),
    proposition: averyAuthorship.record.core.proposition,
    stance: "asserts",
    anchors: [
      EvidenceAnchor.cases.HeaderField.make({
        occurrence: eventNo(2).occurrence,
        namespace: "mapi",
        field: "PR_SENDER_EMAIL_ADDRESS",
      }),
    ],
    producedBy: ActivityId.make("party-act:resolver"),
    validTime: ValidTime.cases.Unknown.make({}),
    recordedAt: at(10),
  });
  return {
    parties,
    events,
    eventNo,
    observations,
    ledger,
    phone,
    financeV1,
    financeV2,
    averyAuthorship,
    vetoChris,
    assertion,
  };
});
export class AcmeFixture extends Context.Service<AcmeFixture, Effect.Success<typeof makeFixture>>()(
  "@beep/party-domain/test/fixtures/acme/AcmeFixture"
) {}
export const AcmeFixtureLive = Layer.effect(AcmeFixture, makeFixture).pipe(Layer.provideMerge(Digest.layerWebCrypto));
