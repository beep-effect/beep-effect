/**
 * Generic contact ingestion using shared normalizers and the memory-ledger port.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidTime } from "@beep/epistemics/Claim";
import { ClaimVersion, EvidenceSignals, SourceAssertion } from "@beep/party-domain/Claim";
import { DirectoryRow } from "@beep/party-domain/Communication";
import { emailAddress, phoneNumber } from "@beep/party-domain/Identifier";
import { AssertionId, ClaimVersionId, IdentifierId, ObservationId, OccurrenceId } from "@beep/party-domain/Ids";
import { Organization, Person } from "@beep/party-domain/Party";
import { partyKeyOf, SourceRecordInput, sourceRecordPartyKey } from "@beep/party-domain/PartyKey";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { RecordRow } from "@beep/party-domain/Provenance";
import { ContactCard, ContactEmailInput, ContactSource, PhoneNumberInput } from "@beep/party-use-cases/ContactSource";
import { LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ContactIngest, ContactIngestInput, IngestIdentifier, IngestIssue } from "./ContactEvidence.model.ts";
import type { Identifier, IdentifierIssue } from "@beep/party-domain/Identifier";
import type { ContactSourceIngestInput, GraphContactInput } from "./ContactEvidence.model.ts";

const absent = EvidenceSignals.fields.sourceTrust.cases.Absent.make({ reason: "not-assessed" });
const signals = EvidenceSignals.make({
  sourceTrust: absent,
  sourceAssertedConfidence: absent,
  extractorConfidence: absent,
  validator: absent,
  reviewer: absent,
});
const issueOf = (issue: IdentifierIssue) => IngestIssue.make({ field: issue.field ?? "value", reason: issue.reason });

/**
 * Produce and append contact observations, source assertions and proposed claims.
 * **Details**
 * Keys identify ingestion anchors, never authorize identity merges. Every claim
 * starts Proposed with unknown valid time. Separate cards allocate separate
 * integer parties even when a key agrees; acceptance and identity resolution
 * remain review operations. Invalid identifiers become issues, never guesses.
 * **Example** (Compose contact ingestion)
 * ```ts
 * import { ingestContact } from "@beep/party-server/ContactEvidence"
 * const ingest = ingestContact
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const ingestContact = Effect.fn("PartyContact.ingestContact")(function* (input: ContactIngestInput) {
  const ledger = yield* PartyLedger;
  const card = input.card;
  const issues: Array<IngestIssue> = [];
  const identifiers: Array<IngestIdentifier> = [];
  const source = yield* Effect.result(
    sourceRecordPartyKey(SourceRecordInput.make({ namespace: card.sourceNamespace, recordId: card.sourceRecordId }))
  );
  if (Result.isFailure(source))
    return ContactIngest.make({
      party: O.none(),
      identifiers: [],
      observations: [],
      assertions: [],
      versions: [],
      issues: [issueOf(source.failure)],
    });
  const collect = Effect.fn("PartyContact.collect")(function* (
    value: Effect.Effect<Identifier, IdentifierIssue>,
    represents: boolean
  ) {
    const normalized = yield* Effect.result(value);
    if (Result.isFailure(normalized)) {
      issues.push(issueOf(normalized.failure));
      return;
    }
    const key = yield* partyKeyOf(normalized.success);
    identifiers.push(
      IngestIdentifier.make({ id: IdentifierId.make(`party-ident:${key}`), value: normalized.success, key, represents })
    );
  });
  yield* Effect.forEach(card.emails, (email) => collect(emailAddress(email.raw), email.represents));
  yield* Effect.forEach(card.phones, (phone) => collect(phoneNumber(phone), false));
  yield* Effect.forEach(card.identifiers, (identifier) => collect(Effect.succeed(identifier), false));
  const unique = A.dedupeWith(
    identifiers,
    (left, right) => left.key === right.key && left.represents === right.represents
  );
  const keys = A.isArrayNonEmpty(unique) ? A.dedupe(A.map(unique, (row) => row.key)) : [source.success];
  const id = yield* ledger.allocatePartyId;
  const label = Str.isNonEmpty(Str.trim(card.label)) ? card.label : card.sourceRecordId;
  const party =
    card.kind === "Organization"
      ? Organization.make({ id, keys, label, orgKind: O.none() })
      : Person.make({ id, keys, label });
  const occurrence = OccurrenceId.make(`party-occ:${source.success}`);
  const anchor = RecordRow.make({ occurrence, rowKey: card.sourceRecordId });
  const stem = `${source.success}:${encodeURIComponent(input.activity)}`;
  const observation = DirectoryRow.make({
    id: ObservationId.make(`party-obs:${stem}`),
    producedBy: input.activity,
    observedAt: input.recordedAt,
    occurrence,
    anchor,
    fields: { sourceNamespace: card.sourceNamespace, sourceRecordId: card.sourceRecordId, label: card.label },
  });
  const assertions: Array<SourceAssertion> = [];
  const add = (proposition: Proposition, evidence: RecordRow) =>
    assertions.push(
      SourceAssertion.make({
        id: AssertionId.make(`party-asrt:${stem}:${A.length(assertions)}`),
        proposition,
        stance: "asserts",
        anchors: [evidence],
        producedBy: input.activity,
        validTime: ValidTime.cases.Unknown.make({}),
        recordedAt: input.recordedAt,
      })
    );
  A.forEach(keys, (key) => add(Proposition.cases.KeyAssignment.make({ key, party: id }), anchor));
  A.forEach(unique, (row) =>
    add(
      Proposition.cases.IdentifierOf.make({
        identifier: row.id,
        party: id,
        relation: row.represents ? "represents" : "used-by",
      }),
      anchor
    )
  );
  A.forEach(card.roles, (role) =>
    add(
      Proposition.cases.ContextRole.make({ party: id, context: role.context, role: role.role }),
      RecordRow.make({ occurrence, rowKey: role.anchor })
    )
  );
  const versions = A.map(assertions, (assertion) =>
    ClaimVersion.make({
      id: ClaimVersionId.make(`party-cv:${assertion.id}`),
      proposition: assertion.proposition,
      logicalKey: logicalKey(assertion.proposition),
      supportedBy: [assertion.id],
      challengedBy: [],
      supersedes: O.none(),
      knowledge: { recordedAt: input.recordedAt, expiredAt: O.none() },
      validTime: assertion.validTime,
      review: { _tag: "Proposed" },
      signals,
    })
  );
  yield* ledger.appendEvidence(LedgerSnapshot.make({ observations: [observation], assertions, versions }));
  return ContactIngest.make({
    party: O.some(party),
    identifiers: unique,
    observations: [observation],
    assertions,
    versions,
    issues,
  });
});

/**
 * Consume the supplied contact port and append each card's provisional evidence.
 * **Details**
 * The caller supplies the source Layer. Party never opens a source-specific
 * database or imports its owning slice. Reads are sequential to keep evidence
 * allocation deterministic for the source order; keys are order-independent.
 * **Example** (Use a source ingestion workflow)
 * ```ts
 * import { ingestContactSource } from "@beep/party-server/ContactEvidence"
 * const ingest = ingestContactSource
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const ingestContactSource = Effect.fn("PartyContact.ingestContactSource")(function* (
  input: ContactSourceIngestInput
) {
  const source = yield* ContactSource;
  return yield* source.cards.pipe(
    Stream.mapEffect((card) => ingestContact(ContactIngestInput.make({ ...input, card }))),
    Stream.runCollect
  );
});

const nonEmpty = (value: O.Option<string>) => O.filter(O.map(value, Str.trim), Str.isNonEmpty);

/**
 * Map a Graph contact to the common card boundary without normalizing identifiers twice.
 * **Details**
 * A company-only card is an organization. Given name or surname is positive
 * source evidence for a person; display-name spelling never supplies identity.
 * Phone parsing uses only the caller's explicit country context. Provider raw
 * JSON, sync metadata and timestamps cannot influence identifier keys.
 * **Example** (Use the Graph adapter)
 * ```ts
 * import { adaptGraphContact } from "@beep/party-server/ContactEvidence"
 * const adapt = adaptGraphContact
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const adaptGraphContact = (input: GraphContactInput): ContactCard => {
  const contact = input.contact;
  const company = nonEmpty(contact.companyName);
  const personal = contact.givenName.pipe(nonEmpty, O.isSome) || contact.surname.pipe(nonEmpty, O.isSome);
  const label = O.getOrElse(
    O.orElse(nonEmpty(contact.displayName), () => company),
    () => contact.id
  );
  const phones = A.appendAll(
    A.appendAll(O.getOrElse(contact.businessPhones, A.empty<string>), O.getOrElse(contact.homePhones, A.empty<string>)),
    O.toArray(contact.mobilePhone)
  );
  return ContactCard.make({
    sourceNamespace: input.sourceNamespace,
    sourceRecordId: contact.id,
    label,
    kind: !personal && O.isSome(company) ? "Organization" : "Person",
    emails: A.flatMap(O.getOrElse(contact.emailAddresses, A.empty), (email) =>
      A.map(O.toArray(email.address), (raw) => ContactEmailInput.make({ raw, represents: false }))
    ),
    phones: A.map(phones, (raw) => PhoneNumberInput.make({ raw, country: input.country })),
    identifiers: [],
    roles: [],
  });
};
