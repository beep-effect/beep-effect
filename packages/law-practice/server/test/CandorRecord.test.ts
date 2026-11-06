/**
 * Proof for the in-memory candor record repository.
 *
 * Three properties are under test and nothing else: an appended record of each
 * of the three kinds reads back, a read scoped to one filing never returns
 * another filing's records, and reads of a kind come back by `id` ascending
 * whatever order they were appended in. The durable-row behaviour of the
 * Drizzle variant is a separate proof against a real database; nothing here
 * stands in for it.
 *
 * The entity inputs mirror the fixtures proved against a real migration in
 * `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`,
 * with the entity-type strings taken from the identity registry rather than
 * retyped, so a renamed entity type breaks the build instead of the fixture.
 *
 * Each block builds its own `Layer.fresh` repository, because the in-memory
 * store is a process-local `Ref` and a shared build would let one block's
 * appends leak into the next block's reads.
 */

import {
  CandorDisposition,
  CitingApplicationIdentity,
  IdsSubmissionFact,
  PatentCitationEvent,
} from "@beep/law-practice-domain";
import { CandorRecordRepositoryInMemory } from "@beep/law-practice-server/CandorRecord";
import { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy";
import { CandorRecordRepository } from "@beep/law-practice-use-cases/CandorRecord";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord";

const decodeUnknownCandorDisposition = S.decodeUnknownEffect(CandorDisposition);
const decodeUnknownIdsSubmissionFact = S.decodeUnknownEffect(IdsSubmissionFact);
const decodeUnknownPatentCitationEvent = S.decodeUnknownEffect(PatentCitationEvent);

// The two filings are deliberately different representations, not just
// different numbers: scoping a read to one of them also proves the port's rule
// that nothing matches across representations.
const FILING_A: CitingApplicationIdentity.Encoded = { applicationNumber: "16138242", kind: "UsptoNormalized" };
const FILING_B: CitingApplicationIdentity.Encoded = {
  applicationNumber: "102014000345678",
  kind: "WipoSt13",
  officeCode: "EP",
};

type Source = {
  readonly digest: string;
  readonly name: string;
  readonly text: string;
};

// Real digests of the fixture text, so the recorded observation is a plausible
// one even though nothing in this proof re-verifies an anchor.
const SOURCE_A: Source = {
  digest: "sha256:a04772355ef288ca617fbb35bf5e6f8987c38321cff61151b20e8a52ff95281c",
  name: "smith",
  text: "Smith discloses a hinge assembly.",
};
const SOURCE_B: Source = {
  digest: "sha256:7ea8c349c033bd438ca72b7bf6b7bfa17d58db85b7b5d08c5814af9c100e3da2",
  name: "jones",
  text: "Jones discloses a latch.",
};

const decodeCitingApplication = S.decodeUnknownEffect(CitingApplicationIdentity);

/** Scope a filing to a tenant; `productEntityFixtureInput` writes every row under org 1. */
const decodeFiling = Effect.fnUntraced(function* (encoded: CitingApplicationIdentity.Encoded, org = 1) {
  const citingApplication = yield* decodeCitingApplication(encoded);
  return CandorFilingScope.make({ citingApplication, orgId: Shared.OrganizationId.make(org) });
});

const groundingOf = (source: Source) => ({
  anchor: { endChar: Str.length(source.text), quote: source.text, startChar: 0 },
  source: {
    extractor: { name: "utf8", version: "1" },
    locator: `${source.name}.txt`,
    normalizationVersion: "1",
    scopeRef: "matter:candor",
    sourceDigest: source.digest,
    sourceRef: `source:${source.name}`,
    textDigest: source.digest,
  },
});

const eventFixture = (id: number, citingApplication: CitingApplicationIdentity.Encoded, source: Source, org = 1) =>
  decodeUnknownPatentCitationEvent({
    ...productEntityFixtureInput(LawPractice.PatentCitationEventId.entityType, id),
    orgId: org,
    actor: "Applicant",
    citingApplication,
    discovery: { kind: "AiDiscovered", model: { name: "reference-extractor", version: "3" } },
    grounding: groundingOf(source),
    observedAt: id,
    possibleDuplicateOf: null,
    quarantine: null,
    reference: { number: "7654321" },
    supersedes: null,
  });

const dispositionFixture = (
  id: number,
  citingApplication: CitingApplicationIdentity.Encoded,
  eventId: number,
  source: Source,
  org = 1
) =>
  decodeUnknownCandorDisposition({
    ...productEntityFixtureInput(LawPractice.CandorDispositionId.entityType, id),
    orgId: org,
    citingApplication,
    decidedAt: id,
    disposes: { eventId, textDigest: source.digest },
    lifecycle: "active",
    litigationFrameJudgment: null,
    rule56Judgment: "Submit",
    supersedes: null,
  });

const submissionFactFixture = (id: number, citingApplication: CitingApplicationIdentity.Encoded, org = 1) =>
  decodeUnknownIdsSubmissionFact({
    ...productEntityFixtureInput(LawPractice.IdsSubmissionFactId.entityType, id),
    orgId: org,
    candidateWindow: {
      applicationFilingDate: null,
      candidateWindow: "indeterminate",
      certificateOfMailingClaimed: false,
      closingActionMailingDate: null,
      closingActionWithdrawn: false,
      filedSameDayAsClosingAction: false,
      firstActionOnMeritsMailingDate: null,
      haguePublicationDate: null,
      issueFeePaymentDate: null,
      nationalStageEntryDate: null,
      priorityMailExpressClaimed: false,
      weekendOrDcHolidayShiftApplies: false,
    },
    citingApplication,
    content: {
      conciseExplanationPresent: false,
      legibleCopiesPresent: true,
      listPresent: true,
      separateUsDocumentSectionPresent: true,
      translationPresent: false,
    },
    fees: { sizeFeePresent: false, timingFeePresent: true },
    modeledFrom: {
      cfrCapture: "law.cornell.edu 37 CFR 1.56/1.97/1.98, captured 2026-08-04",
      mpepRevision: "R-01.2024",
    },
    officeTreatment: null,
    operativeDate: id,
    statement: {
      sizeFeeAssertionPresent: true,
      statementPresent: true,
      statementType: "e2-no-prior-knowledge",
    },
    submissionKind: "initial",
  });

/**
 * Append one record of each kind for a filing, seeded so the three ids are
 * distinguishable in the assertions: `seed`, `seed + 100`, `seed + 200`.
 */
const appendFiling = Effect.fnUntraced(function* (
  repository: CandorRecordRepositoryShape,
  citingApplication: CitingApplicationIdentity.Encoded,
  seed: number,
  source: Source,
  org = 1
) {
  const eventFixture1 = yield* eventFixture(seed, citingApplication, source, org);
  yield* repository.recordEvent(eventFixture1);
  const dispositionFixture2 = yield* dispositionFixture(seed + 100, citingApplication, seed, source, org);
  yield* repository.recordDisposition(dispositionFixture2);
  const submissionFactFixture3 = yield* submissionFactFixture(seed + 200, citingApplication, org);
  yield* repository.recordSubmissionFact(submissionFactFixture3);
});

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

describe("@beep/law-practice-server candor record repository", () => {
  it.layer(Layer.fresh(CandorRecordRepositoryInMemory), { timeout: "10 seconds" })("tenant isolation", (it) => {
    it.effect("never returns another organization's records for the same filing", () =>
      Effect.gen(function* () {
        const repository = yield* CandorRecordRepository;
        // Same application number, two tenants — the case a filing-only filter
        // silently merges, letting a foreign disposition release the gate.
        yield* appendFiling(repository, FILING_A, 1, SOURCE_A, 1);
        yield* appendFiling(repository, FILING_A, 2, SOURCE_B, 2);

        const tenantOne = yield* decodeFiling(FILING_A, 1);
        const tenantTwo = yield* decodeFiling(FILING_A, 2);

        const listEvents4 = yield* repository.listEvents(tenantOne);
        expect(ids(listEvents4)).toEqual([1]);
        const listDispositions5 = yield* repository.listDispositions(tenantOne);
        expect(ids(listDispositions5)).toEqual([101]);
        const listSubmissionFacts6 = yield* repository.listSubmissionFacts(tenantOne);
        expect(ids(listSubmissionFacts6)).toEqual([201]);

        const listEvents7 = yield* repository.listEvents(tenantTwo);
        expect(ids(listEvents7)).toEqual([2]);
        const listDispositions8 = yield* repository.listDispositions(tenantTwo);
        expect(ids(listDispositions8)).toEqual([102]);
        const listSubmissionFacts9 = yield* repository.listSubmissionFacts(tenantTwo);
        expect(ids(listSubmissionFacts9)).toEqual([202]);
      })
    );
  });

  it.layer(Layer.fresh(CandorRecordRepositoryInMemory), { timeout: "10 seconds" })(
    "appending each record kind",
    (it) => {
      it.effect(
        "reads every appended kind back scoped to the filing it was recorded for",
        Effect.fnUntraced(function* () {
          const repository = yield* CandorRecordRepository;
          yield* appendFiling(repository, FILING_A, 1, SOURCE_A);

          const filing = yield* decodeFiling(FILING_A);
          const events = yield* repository.listEvents(filing);
          const dispositions = yield* repository.listDispositions(filing);
          const submissionFacts = yield* repository.listSubmissionFacts(filing);
          const snapshot = yield* repository.readSnapshot(filing);

          expect(ids(events)).toEqual([1]);
          expect(ids(dispositions)).toEqual([101]);
          expect(ids(submissionFacts)).toEqual([201]);
          expect(ids(snapshot.events)).toEqual([1]);
          expect(ids(snapshot.dispositions)).toEqual([101]);

          // Round-tripping the recorded surface, not just the row count: the
          // disposition must still name the exact observation it answers.
          expect(A.map(dispositions, (disposition) => disposition.disposes.eventId)).toEqual([1]);
          expect(A.map(events, (event) => event.grounding.source.textDigest)).toEqual([SOURCE_A.digest]);
        })
      );
    }
  );

  it.layer(Layer.fresh(CandorRecordRepositoryInMemory), { timeout: "10 seconds" })(
    "scoping reads by citing application",
    (it) => {
      it.effect(
        "never returns a second filing's records",
        Effect.fnUntraced(function* () {
          const repository = yield* CandorRecordRepository;
          yield* appendFiling(repository, FILING_A, 1, SOURCE_A);
          yield* appendFiling(repository, FILING_B, 2, SOURCE_B);

          const filingA = yield* decodeFiling(FILING_A);
          const filingB = yield* decodeFiling(FILING_B);

          const listEvents10 = yield* repository.listEvents(filingA);
          expect(ids(listEvents10)).toEqual([1]);
          const listDispositions11 = yield* repository.listDispositions(filingA);
          expect(ids(listDispositions11)).toEqual([101]);
          const listSubmissionFacts12 = yield* repository.listSubmissionFacts(filingA);
          expect(ids(listSubmissionFacts12)).toEqual([201]);

          const listEvents13 = yield* repository.listEvents(filingB);
          expect(ids(listEvents13)).toEqual([2]);
          const listDispositions14 = yield* repository.listDispositions(filingB);
          expect(ids(listDispositions14)).toEqual([102]);
          const listSubmissionFacts15 = yield* repository.listSubmissionFacts(filingB);
          expect(ids(listSubmissionFacts15)).toEqual([202]);
        })
      );
    }
  );

  it.layer(Layer.fresh(CandorRecordRepositoryInMemory), { timeout: "10 seconds" })(
    "ordering reads of one filing",
    (it) => {
      it.effect(
        "returns each kind by id ascending whatever order it was appended in",
        Effect.fnUntraced(function* () {
          const repository = yield* CandorRecordRepository;

          // Appended highest id first, so append order and id order disagree and
          // a store that simply replayed insertions would fail here.
          yield* appendFiling(repository, FILING_A, 3, SOURCE_B);
          yield* appendFiling(repository, FILING_A, 1, SOURCE_A);

          const filing = yield* decodeFiling(FILING_A);

          const listEvents16 = yield* repository.listEvents(filing);
          expect(ids(listEvents16)).toEqual([1, 3]);
          const listDispositions17 = yield* repository.listDispositions(filing);
          expect(ids(listDispositions17)).toEqual([101, 103]);
          const listSubmissionFacts18 = yield* repository.listSubmissionFacts(filing);
          expect(ids(listSubmissionFacts18)).toEqual([201, 203]);
        })
      );
    }
  );
});
