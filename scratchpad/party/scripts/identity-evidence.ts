/**
 * Identity evidence workflow over graduated party packages and source-owned adapters.
 * Usage: bun scratchpad/party/scripts/identity-evidence.ts <out-dir> <graph-contacts.jsonl>
 *   <practice-contacts.jsonl> <practice-links.jsonl> <filter-regex|-> <enriched-mail.jsonl>...
 * Page-exported decisions require --review-valid-from <epoch-millis>; an omitted
 * --review-valid-to means an open endpoint. Native CollisionDecision exports carry
 * their own validity. Output contains private evidence except identity-evidence.json.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidInterval } from "@beep/epistemics/ValidInterval";
import { $ScratchpadId } from "@beep/identity";
import {
  adaptPracticeContact,
  LegacyContactKgRow,
  PracticeContactInput,
} from "@beep/law-practice-server/PartyContactSource";
import { Contact } from "@beep/law-practice-use-cases/DocumentIdentification";
import { GraphContact } from "@beep/m365/M365.schemas";
import { ClaimVersion, EvidenceSignals, SourceAssertion } from "@beep/party-domain/Claim";
import { EmailAddress } from "@beep/party-domain/Identifier";
import { ActivityId, AssertionId, ClaimVersionId, IdentifierId, OccurrenceId } from "@beep/party-domain/Ids";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { RecordRow } from "@beep/party-domain/Provenance";
import { ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import {
  adaptGraphContact,
  ContactIngestInput,
  GraphContactInput,
  ingestContact,
  IngestIdentifier,
} from "@beep/party-server/ContactEvidence";
import {
  CardIdentifier,
  cardMergeProposals,
  classifyDrift,
  CollisionInput,
  MailboxClusterInput,
  mailboxClusters,
  observedSpan,
  PairingClaimsInput,
  pairingClaims,
  resolveCollisions,
} from "@beep/party-server/IdentityEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import {
  emptyCensus,
  identifiersByName,
  observe,
  pairingSupport,
  recordDecodeFailure,
  summarize,
} from "@beep/party-server/MailCensus";
import { adaptMailRecord, MailIndexInput, MailIndexRecord } from "@beep/party-server/MailIndex";
import {
  classifyByOrganization,
  MailboxEvidence,
  nameShape,
  ObservedSpan,
  organizationDomain,
} from "@beep/party-server/OrgEvidence";
import {
  applyReviews,
  CaseEvidence,
  CaseMailbox,
  CollisionCase,
  CollisionDecision,
  isSettled,
  MailboxAnchorInput,
  mailboxParty,
  ReviewInput,
  sealCase,
} from "@beep/party-server/ReviewLoop";
import { PhoneNumberInput } from "@beep/party-use-cases/ContactSource";
import { PartyLedger } from "@beep/party-use-cases/Ledger";
import { jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ContentBoundMailRecord } from "./MailInput.ts";
import { renderReviewPage } from "./ReviewPage.ts";
import {
  adaptPageDecision,
  encodeReviewPageCases,
  PageDecision,
  PageDecisionInput,
  ReviewPageInput,
} from "./ReviewPageAdapter.ts";

const $I = $ScratchpadId.create("party/scripts/identity-evidence");
const WorkflowInput = S.Struct({
  outDir: S.String,
  graphContacts: S.String,
  practiceContacts: S.String,
  practiceLinks: S.String,
  filter: S.String,
  inputs: S.Array(S.String),
  country: S.Option(S.String),
  reviewValidFrom: S.Option(S.Finite),
  reviewValidTo: S.Option(S.Finite),
}).pipe(
  $I.annoteSchema("WorkflowInput", {
    description: "Explicit files and review validity for the local identity workflow.",
  })
);
type WorkflowInput = typeof WorkflowInput.Type;
class WorkflowError extends S.TaggedError<WorkflowError, { readonly brand: unique symbol }>($I`WorkflowError`)(
  "WorkflowError",
  { reason: S.NonEmptyString },
  $I.annoteError<WorkflowError>("WorkflowError", { description: "Invalid workflow options without source payload." })
) {}
const countBy = <Value>(values: ReadonlyArray<Value>, key: (value: Value) => string) =>
  R.map(A.groupBy(values, key), A.length);
const readJsonl = Effect.fn("identity-evidence.readJsonl")(function* <Value>(
  fs: FileSystem.FileSystem,
  path: string,
  decode: (line: string) => Effect.Effect<Value, S.SchemaError>
) {
  const text = yield* fs.readFileString(path);
  return yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) => Effect.option(decode(line)));
});

const program = Effect.fn("identity-evidence")(function* (args: WorkflowInput) {
  const fs = yield* FileSystem.FileSystem;
  const ledger = yield* PartyLedger;
  const now = yield* DateTime.now;
  const scope = ResolutionScope.make({ asOf: now, validAt: now });
  const country = yield* S.decodeUnknownEffect(S.toType(PhoneNumberInput.fields.country))(args.country);
  const filter = args.filter === "-" ? O.none() : O.some(yield* Effect.try(() => new RegExp(args.filter, "i")));
  if (O.isSome(args.reviewValidTo) && O.isNone(args.reviewValidFrom))
    return yield* WorkflowError.make({ reason: "review-valid-to requires review-valid-from" });
  const pageValidity = yield* O.match(args.reviewValidFrom, {
    onNone: () => Effect.succeedNone,
    onSome: (from) =>
      S.decodeEffect(ValidInterval)({ validFrom: from, validTo: O.getOrNull(args.reviewValidTo) }).pipe(Effect.asSome),
  });
  const mailActivity = ActivityId.make(`party-act:mail-index-adapter@0.0.0:${DateTime.toEpochMillis(now)}`);
  const contactActivity = ActivityId.make(`party-act:contact-card-adapter@0.0.0:${DateTime.toEpochMillis(now)}`);
  let census = emptyCensus();
  let mailValues = HashMap.empty<IdentifierId, IngestIdentifier>();
  let mailAssertions = HashMap.empty<AssertionId, SourceAssertion>();
  const decodeMail = S.decodeUnknownEffect(S.fromJsonString(ContentBoundMailRecord));
  for (const input of args.inputs) {
    yield* fs.stream(input).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.filter(
        (line) =>
          Str.isNonEmpty(line) && O.match(filter, { onNone: () => true, onSome: (pattern) => pattern.test(line) })
      ),
      Stream.runForEach((line) =>
        decodeMail(line).pipe(
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                census = recordDecodeFailure(census);
              }),
            onSuccess: Effect.fn("identity-evidence.mail")(function* (row) {
              const ingest = yield* adaptMailRecord(
                MailIndexInput.make({
                  record: MailIndexRecord.make(row),
                  content: row.content,
                  side: "client-file",
                  producedBy: mailActivity,
                  observedAt: now,
                })
              );
              census = observe(census, ingest);
              A.forEach(ingest.identifiers, (value) => {
                mailValues = HashMap.set(mailValues, value.id, value);
              });
              A.forEach(ingest.assertions, (value) => {
                mailAssertions = HashMap.set(mailAssertions, value.id, value);
              });
            }),
          })
        )
      )
    );
  }
  const supports = pairingSupport(census);
  const graphCards = yield* readJsonl(fs, args.graphContacts, S.decodeUnknownEffect(S.fromJsonString(GraphContact)));
  const practiceCards = yield* readJsonl(fs, args.practiceContacts, S.decodeUnknownEffect(S.fromJsonString(Contact)));
  const linkCards = yield* readJsonl(
    fs,
    args.practiceLinks,
    S.decodeUnknownEffect(S.fromJsonString(LegacyContactKgRow))
  );
  const cards = [
    ...A.map(A.getSomes(graphCards), (contact) =>
      adaptGraphContact(GraphContactInput.make({ contact, sourceNamespace: "graph-export", country }))
    ),
    ...A.map(A.getSomes(practiceCards), (contact) =>
      adaptPracticeContact(PracticeContactInput.make({ contact, sourceNamespace: "practice-contacts" }))
    ),
    ...A.map(A.getSomes(linkCards), (contact) =>
      adaptPracticeContact(PracticeContactInput.make({ contact, sourceNamespace: "contacts-kg-legacy" }))
    ),
  ];
  const sourced = yield* Effect.forEach(
    cards,
    Effect.fn("identity-evidence.contact")(function* (card) {
      return {
        source: card.sourceNamespace,
        ingest: yield* ingestContact(ContactIngestInput.make({ card, activity: contactActivity, recordedAt: now })),
      };
    })
  );
  const ingests = A.map(sourced, (row) => row.ingest);
  const assertions = A.flatMap(ingests, (ingest) => ingest.assertions);
  const cardRows = A.flatMap(sourced, ({ source, ingest }) =>
    A.flatMap(ingest.assertions, ({ proposition }) => {
      if (!Proposition.guards.IdentifierOf(proposition) || proposition.relation === "represents") return [];
      const kind: CardIdentifier["kind"] = O.match(
        A.findFirst(ingest.identifiers, (row) => row.id === proposition.identifier),
        {
          onNone: (): CardIdentifier["kind"] => "other",
          onSome: (row): CardIdentifier["kind"] =>
            row.value._tag === "EmailAddress" || row.value._tag === "PhoneNumber" ? row.value._tag : "other",
        }
      );
      return [CardIdentifier.make({ identifier: proposition.identifier, card: proposition.party, source, kind })];
    })
  );
  const sharedIdentifiers = HashSet.fromIterable(
    A.flatMap(ingests, (ingest) =>
      A.map(
        A.filter(ingest.identifiers, (row) => row.represents),
        (row) => row.id
      )
    )
  );
  const proposals = cardMergeProposals(A.filter(cardRows, (row) => !HashSet.has(sharedIdentifiers, row.identifier)));
  const absent = EvidenceSignals.fields.sourceTrust.cases.Absent.make({ reason: "not-assessed" });
  const signals = EvidenceSignals.make({
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: absent,
  });
  const sameCardProposals = A.flatMap(proposals, ({ identifier, left, right }) => {
    const supportedBy = A.map(
      A.filter(
        assertions,
        (assertion) =>
          Proposition.guards.IdentifierOf(assertion.proposition) &&
          assertion.proposition.identifier === identifier &&
          (assertion.proposition.party === left || assertion.proposition.party === right)
      ),
      (assertion) => assertion.id
    );
    if (!A.isArrayNonEmpty(supportedBy)) return [];
    const proposition = Proposition.cases.SameParty.make({ left, right });
    const key = logicalKey(proposition);
    return [
      ClaimVersion.make({
        id: ClaimVersionId.make(
          `party-cv:same-card:${encodeURIComponent(identifier)}:${encodeURIComponent(key)}:${DateTime.toEpochMillis(now)}`
        ),
        proposition,
        logicalKey: key,
        supportedBy,
        challengedBy: [],
        validTime: { _tag: "Unknown" },
        knowledge: { recordedAt: now, expiredAt: O.none() },
        supersedes: O.none(),
        review: { _tag: "Proposed" },
        signals,
      }),
    ];
  });
  const snapshot = yield* ledger.snapshot;
  const resolvedCards = resolveParties(snapshot.versions, scope);
  const representative = (party: PartyId) =>
    O.match(
      A.findFirst(resolvedCards.representatives, (row) => row.party === party),
      {
        onNone: () => party,
        onSome: (row) => row.survivor,
      }
    );
  const contactsOf = A.reduce(cardRows, HashMap.empty<IdentifierId, HashSet.HashSet<PartyId>>(), (map, row) =>
    HashMap.set(
      map,
      row.identifier,
      HashSet.add(O.getOrElse(HashMap.get(map, row.identifier), HashSet.empty<PartyId>), representative(row.card))
    )
  );
  const mailIdentifiers = pipe(census.identifierKinds, HashMap.keys, A.fromIterable);
  const clusters = mailboxClusters(MailboxClusterInput.make({ identifiers: mailIdentifiers, supports }));
  const collisions = resolveCollisions(
    CollisionInput.make({ identifiersByName: identifiersByName(census), clusters, contactsOf })
  );
  const queue = A.filter(
    collisions,
    (row) =>
      row.outcome === "unresolved" || row.outcome === "partially-resolved" || row.outcome === "conflicting-contacts"
  );
  const mailboxEvidence = Effect.fn("identity-evidence.mailboxEvidence")(function* (ids: ReadonlyArray<IdentifierId>) {
    const domains = yield* Effect.forEach(
      ids,
      Effect.fn("identity-evidence.orgDomain")(function* (id) {
        const row = HashMap.get(mailValues, id);
        return O.isSome(row) && S.is(EmailAddress)(row.value.value)
          ? yield* organizationDomain(row.value.value.normalized)
          : O.none();
      })
    );
    const spans = A.flatMap(ids, (id) => O.toArray(HashMap.get(census.identifierSpans, id)));
    const bounds = A.sort(
      A.flatMap(spans, (span) => [DateTime.toEpochMillis(span.first), DateTime.toEpochMillis(span.last)]),
      Order.Number
    );
    const span = O.map(O.all([A.head(bounds), A.last(bounds)]), ([first, last]) =>
      ObservedSpan.make({ first: DateTime.makeUnsafe(first), last: DateTime.makeUnsafe(last) })
    );
    return MailboxEvidence.make({ domains: HashSet.fromIterable(A.getSomes(domains)), span });
  });
  const leads = yield* Effect.forEach(
    queue,
    Effect.fn("identity-evidence.lead")(function* (collision) {
      const evidence = yield* Effect.forEach(collision.mailboxes, mailboxEvidence);
      return { collision, shape: nameShape(collision.name), orgLead: classifyByOrganization(evidence) };
    })
  );
  const cases = yield* Effect.forEach(
    A.filter(leads, (lead) => lead.shape === "full-name"),
    Effect.fn("identity-evidence.case")(function* (lead: (typeof leads)[number]) {
      const mailboxes = yield* Effect.forEach(
        lead.collision.mailboxes,
        Effect.fn("identity-evidence.caseMailbox")(function* (identifiers: A.NonEmptyReadonlyArray<IdentifierId>) {
          const evidence = yield* mailboxEvidence(identifiers);
          return CaseMailbox.make({
            party: yield* mailboxParty(MailboxAnchorInput.make({ identifiers })),
            identifiers,
            domains: A.sort(A.fromIterable(evidence.domains), Order.String),
            span: evidence.span,
          });
        })
      );
      const evidence = yield* S.decodeUnknownEffect(S.toType(CaseEvidence))({
        name: lead.collision.name,
        shape: lead.shape,
        outcome: lead.collision.outcome,
        orgLead: lead.orgLead,
        mailboxes,
      });
      return yield* sealCase(evidence);
    })
  );
  const decisionsPath = `${args.outDir}/review-decisions.jsonl`;
  const rawDecisions = (yield* fs.exists(decisionsPath))
    ? yield* readJsonl(fs, decisionsPath, S.decodeUnknownEffect(S.fromJsonString(S.Unknown)))
    : [];
  const decisionOptions = yield* Effect.forEach(
    rawDecisions,
    Effect.fn("identity-evidence.decision")(function* (raw, index) {
      if (O.isNone(raw)) return O.none<CollisionDecision>();
      const native = yield* Effect.option(S.decodeUnknownEffect(CollisionDecision)(raw.value));
      if (O.isSome(native)) return native;
      const page = yield* Effect.option(S.decodeUnknownEffect(PageDecision)(raw.value));
      if (O.isNone(page)) return O.none<CollisionDecision>();
      if (O.isNone(pageValidity))
        return yield* WorkflowError.make({
          reason: "Page decisions require explicit --review-valid-from (and optional --review-valid-to).",
        });
      return O.some(
        adaptPageDecision(
          PageDecisionInput.make({
            decision: page.value,
            validity: pageValidity.value,
            producedBy: ActivityId.make("party-act:review-page-import@0.0.0"),
            anchor: RecordRow.make({
              occurrence: OccurrenceId.make(`party-occ:review-export:${encodeURIComponent(decisionsPath)}`),
              rowKey: `record:${index + 1}`,
            }),
          })
        )
      );
    })
  );
  const decisions = A.getSomes(decisionOptions);
  const reviewed = yield* applyReviews(ReviewInput.make({ cases, decisions, scope }));
  const open = A.filter(reviewed, (row) => !isSettled(row.status) && row.status !== "skipped");
  const claims = pairingClaims(PairingClaimsInput.make({ supports, recordedAt: now }));
  const reviewClaims = A.flatMap(reviewed, (row) => row.evidence.versions);
  const reviewAssertions = A.flatMap(reviewed, (row) => row.evidence.assertions);
  const allAssertions = A.dedupeWith(
    A.appendAll(A.appendAll(pipe(mailAssertions, HashMap.values, A.fromIterable), assertions), reviewAssertions),
    (left: SourceAssertion, right: SourceAssertion) => left.id === right.id
  );
  const writeClaims = Effect.fn("identity-evidence.writeClaims")(function* (
    name: string,
    values: ReadonlyArray<ClaimVersion>
  ) {
    const lines = yield* Effect.forEach(values, (value) => S.encodeEffect(S.fromJsonString(ClaimVersion))(value));
    yield* fs.writeFileString(
      `${args.outDir}/${name}`,
      A.isReadonlyArrayEmpty(lines) ? "" : `${A.join(lines, "\n")}\n`
    );
  });
  yield* fs.makeDirectory(args.outDir, { recursive: true });
  yield* writeClaims("pairing-claims.jsonl", claims);
  yield* writeClaims("contact-claims.jsonl", snapshot.versions);
  yield* writeClaims("card-merge-proposals.jsonl", sameCardProposals);
  yield* writeClaims("review-claims.jsonl", reviewClaims);
  const assertionLines = yield* Effect.forEach(allAssertions, (value) =>
    S.encodeEffect(S.fromJsonString(SourceAssertion))(value)
  );
  yield* fs.writeFileString(
    `${args.outDir}/source-assertions.jsonl`,
    A.isReadonlyArrayEmpty(assertionLines) ? "" : `${A.join(assertionLines, "\n")}\n`
  );
  const caseLines = yield* Effect.forEach(cases, (value) => S.encodeEffect(S.fromJsonString(CollisionCase))(value));
  yield* fs.writeFileString(
    `${args.outDir}/review-cases.jsonl`,
    A.isReadonlyArrayEmpty(caseLines) ? "" : `${A.join(caseLines, "\n")}\n`
  );
  const pageJson = yield* encodeReviewPageCases(
    ReviewPageInput.make({
      cases: A.map(open, (row) => row.case),
      identifiers: pipe(mailValues, HashMap.values, A.fromIterable),
    })
  );
  yield* fs.writeFileString(`${args.outDir}/review.html`, renderReviewPage(pageJson));
  const mailIdentifierSet = HashSet.fromIterable(mailIdentifiers);
  const contactIdentifiers = A.dedupe(A.map(cardRows, (row) => row.identifier));
  const parties = A.flatMap(ingests, (ingest) => O.toArray(ingest.party));
  const summary = {
    mail: summarize(census),
    pairingClaims: {
      claims: A.length(claims),
      messagesPerPair: countBy(supports, (support) =>
        support.messages === 1 ? "1" : support.messages < 5 ? "2-4" : support.messages < 20 ? "5-19" : "20+"
      ),
      observedSpan: countBy(supports, (support) => observedSpan(support)._tag),
    },
    drift: countBy(classifyDrift(supports), (row) => row.kind),
    contacts: {
      graphCards: A.length(A.getSomes(graphCards)),
      graphDecodeFailures: A.length(A.filter(graphCards, O.isNone)),
      practiceCards: A.length(A.getSomes(practiceCards)),
      practiceDecodeFailures: A.length(A.filter(practiceCards, O.isNone)),
      linkCards: A.length(A.getSomes(linkCards)),
      linkDecodeFailures: A.length(A.filter(linkCards, O.isNone)),
      cardsPerCluster: pipe(
        A.groupBy(parties, (party): string => `${representative(party.id)}`),
        R.values,
        A.map(A.length),
        (sizes) => countBy(sizes, (size) => (size === 1 ? "1" : size === 2 ? "2" : size === 3 ? "3" : "4+"))
      ),
      clientContactRoles: countBy(
        A.flatMap(assertions, (assertion) =>
          Proposition.guards.ContextRole(assertion.proposition)
            ? A.flatMap(assertion.anchors, (anchor) =>
                S.is(RecordRow)(anchor) ? [Str.split(anchor.rowKey, "#link:")[1] ?? "unknown"] : []
              )
            : []
        ),
        (value) => value
      ),
      partiesByKind: countBy(parties, (party) => party._tag),
      assertions: countBy(assertions, (assertion) =>
        Proposition.guards.IdentifierOf(assertion.proposition)
          ? `IdentifierOf:${assertion.proposition.relation}`
          : assertion.proposition._tag
      ),
      sameCardProposals: A.length(sameCardProposals),
      cardClustersAfterReconciliation: A.length(A.dedupe(A.map(parties, (party) => representative(party.id)))),
      personalContactIdentifiers: A.length(contactIdentifiers),
      contactIdentifiersSeenInMail: A.length(A.filter(contactIdentifiers, (id) => HashSet.has(mailIdentifierSet, id))),
    },
    collisions: {
      total: A.length(collisions),
      byOutcome: countBy(collisions, (row) => row.outcome),
      singleTokenNamesSetAside: A.length(A.filter(leads, (lead) => lead.shape === "single-token")),
      review: {
        cases: A.length(cases),
        decisionsLoaded: A.length(decisions),
        decisionDecodeFailures: A.length(rawDecisions) - A.length(decisions),
        byStatus: countBy(reviewed, (row) => row.status),
        acceptedReviewClaims: A.length(reviewClaims),
      },
      orgLeadsForUnsettledFullNames: countBy(open, (row) => row.case.evidence.orgLead),
    },
  };
  yield* fs.writeFileString(`${args.outDir}/identity-evidence.json`, `${yield* jsonStringifyPretty(summary)}\n`);
  yield* Effect.log(`identity evidence written to ${args.outDir}`);
});

const command = Command.make(
  "identity-evidence",
  {
    outDir: Argument.String("out-dir"),
    graphContacts: Argument.String("graph-contacts.jsonl"),
    practiceContacts: Argument.String("practice-contacts.jsonl"),
    practiceLinks: Argument.String("practice-links.jsonl"),
    filter: Argument.String("filter-regex"),
    inputs: Argument.String("enriched-mail.jsonl").pipe(Argument.atLeast(1)),
    country: Flag.String("phone-country").pipe(Flag.optional),
    reviewValidFrom: Flag.Int("review-valid-from").pipe(Flag.optional),
    reviewValidTo: Flag.Int("review-valid-to").pipe(Flag.optional),
  },
  (args) => program(args)
);
Command.run(command, { version: "0.0.0" }).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off -- platform and memory ledger are provided once at the script entry point. Owner: @beep/scratchpad. Exit: never while this is a Bun entry script.
  Effect.provide(Layer.mergeAll(BunServices.layer, PartyLedgerMemory)),
  BunRuntime.runMain
);
