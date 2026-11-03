/** Fully synthetic Acme competency fixture. No production or corpus data. */
import { BasisDigest, ValidTime } from "@beep/epistemics/Claim";
import { ClaimVersion, EvidenceSignals, ReviewState, SourceAssertion } from "@beep/party-domain/Claim";
import { CommunicationEvent, Observation, Participant, voiceOf } from "@beep/party-domain/Communication";
import {
  ActivityId,
  AssertionId,
  ClaimVersionId,
  EventId,
  IdentifierId,
  ObservationId,
  OccurrenceId,
  PrincipalId,
} from "@beep/party-domain/Ids";
import { Party } from "@beep/party-domain/Party";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

export const at = DateTime.makeUnsafe;
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
export const signals = EvidenceSignals.make({
  sourceTrust: { _tag: "Absent", reason: "not-assessed" },
  sourceAssertedConfidence: { _tag: "Absent", reason: "not-assessed" },
  extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
  validator: { _tag: "Absent", reason: "not-assessed" },
  reviewer: { _tag: "Absent", reason: "not-assessed" },
});
const claim = (
  id: string,
  proposition: Proposition,
  recordedAt = 10,
  expiredAt: O.Option<DateTime.Utc> = O.none(),
  validFrom = 0,
  validTo: O.Option<DateTime.Utc> = O.none()
) =>
  ClaimVersion.make({
    id: ClaimVersionId.make(`party-cv:${id}`),
    proposition,
    logicalKey: logicalKey(proposition),
    supportedBy: [AssertionId.make(`party-asrt:${id}`)],
    challengedBy: [],
    supersedes: O.none(),
    validTime: ValidTime.cases.Interval.make({ validFrom: at(validFrom), validTo }),
    knowledge: { recordedAt: at(recordedAt), expiredAt },
    review: ReviewState.cases.Accepted.make({
      disposition: {
        disposition: "accepted",
        reviewer: PrincipalId.make("party-user:analyst"),
        basis: BasisDigest.make("1234567812345678123456781234567812345678123456781234567812345678"),
        reviewedAt: at(recordedAt),
        reason: "Synthetic reviewed evidence",
      },
    }),
    signals,
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
    occurrence: OccurrenceId.make(`party-occ:msg:${n}`),
    channel: "email",
    sentAt: O.some(at(100 + n)),
    messageId: O.some(`<${n}@acme.example>`),
    conversationKey: O.none(),
    participants: [O.getOrThrow(A.head(participants)), ...A.drop(participants, 1)],
  });
const makeFixture = Effect.sync(() => {
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
  const financeV1 = claim(
    "finance:1",
    Proposition.cases.IdentifierOf.make({ identifier: email("finance"), party: ids.maya, relation: "used-by" }),
    12
  );
  const financeV2 = ClaimVersion.make({
    ...claim(
      "finance:2",
      Proposition.cases.IdentifierOf.make({ identifier: email("finance"), party: ids.finance, relation: "represents" }),
      19
    ),
    supersedes: O.some(financeV1.id),
  });
  const phone = IdentifierId.make("party-ident:tel:+15155550100");
  const averyAuthorship = author(2, ids.avery);
  const ledger = [
    identifier("maya", ids.maya),
    identifier("jordan", ids.jordan),
    identifier("avery", ids.avery),
    identifier("dana", ids.dana),
    identifier("sam", ids.sam),
    identifier("riley", ids.riley),
    identifier("quinn", ids.quinn),
    identifier("pat", ids.pat),
    ClaimVersion.make({ ...financeV1, knowledge: { ...financeV1.knowledge, expiredAt: O.some(at(19)) } }),
    financeV2,
    claim(
      "phone:jordan",
      Proposition.cases.IdentifierOf.make({ identifier: phone, party: ids.jordan, relation: "used-by" }),
      10,
      O.none(),
      0,
      O.some(at(40))
    ),
    claim(
      "phone:riley",
      Proposition.cases.IdentifierOf.make({ identifier: phone, party: ids.riley, relation: "used-by" }),
      10,
      O.none(),
      60
    ),
    claim("same:chris-a-dup", Proposition.cases.SameParty.make({ left: ids.chrisA, right: ids.chrisDuplicate })),
    claim("same:chris-dup-b", Proposition.cases.SameParty.make({ left: ids.chrisDuplicate, right: ids.chrisB })),
    claim("distinct:chris-a-b", Proposition.cases.DistinctParty.make({ left: ids.chrisA, right: ids.chrisB })),
    averyAuthorship,
    author(3, ids.riley),
    author(4, ids.sam),
    author(5, ids.quinn),
    author(8, ids.dana),
    reportsTo(ids.sam, ids.dana),
    reportsTo(ids.riley, ids.dana),
    reportsTo(ids.quinn, ids.dana),
    reportsTo(ids.dana, ids.pat),
    reportsTo(ids.maya, ids.pat),
  ];
  const assertion = SourceAssertion.make({
    id: O.getOrThrow(A.head(averyAuthorship.supportedBy)),
    proposition: averyAuthorship.proposition,
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
  return { parties, events, eventNo, observations, ledger, phone, financeV1, financeV2, averyAuthorship, assertion };
});
export class AcmeFixture extends Context.Service<AcmeFixture, Effect.Success<typeof makeFixture>>()(
  "@beep/party-domain/test/fixtures/acme/AcmeFixture"
) {}
export const AcmeFixtureLive = Layer.effect(AcmeFixture, makeFixture);
