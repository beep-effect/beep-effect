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
import { CandorRecordRepository } from "@beep/law-practice-use-cases/CandorRecord";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord";

// The two filings are deliberately different representations, not just
// different numbers: scoping a read to one of them also proves the port's rule
// that nothing matches across representations.
const FILING_A: CitingApplicationIdentity.Encoded = { applicationNumber: "16138242", kind: "UsptoNormalized" };
const FILING_B: CitingApplicationIdentity.Encoded = { applicationNumber: "102014000345678", kind: "WipoSt13" };

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

const decodeFiling = S.decodeUnknownEffect(CitingApplicationIdentity);

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

const eventFixture = (id: number, citingApplication: CitingApplicationIdentity.Encoded, source: Source) =>
  S.decodeUnknownEffect(PatentCitationEvent)({
    ...baseEntityFixtureInput(LawPractice.PatentCitationEventId.entityType, id),
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
  source: Source
) =>
  S.decodeUnknownEffect(CandorDisposition)({
    ...baseEntityFixtureInput(LawPractice.CandorDispositionId.entityType, id),
    citingApplication,
    decidedAt: id,
    disposes: { eventId, textDigest: source.digest },
    lifecycle: "active",
    litigationFrameJudgment: null,
    rule56Judgment: "Submit",
    supersedes: null,
  });

const submissionFactFixture = (id: number, citingApplication: CitingApplicationIdentity.Encoded) =>
  S.decodeUnknownEffect(IdsSubmissionFact)({
    ...baseEntityFixtureInput(LawPractice.IdsSubmissionFactId.entityType, id),
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
  source: Source
) {
  yield* repository.recordEvent(yield* eventFixture(seed, citingApplication, source));
  yield* repository.recordDisposition(yield* dispositionFixture(seed + 100, citingApplication, seed, source));
  yield* repository.recordSubmissionFact(yield* submissionFactFixture(seed + 200, citingApplication));
});

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

describe("@beep/law-practice-server candor record repository", () => {
  layer(Layer.fresh(CandorRecordRepositoryInMemory))("appending each record kind", (it) => {
    it.effect(
      "reads every appended kind back scoped to the filing it was recorded for",
      Effect.fnUntraced(function* () {
        const repository = yield* CandorRecordRepository;
        yield* appendFiling(repository, FILING_A, 1, SOURCE_A);

        const filing = yield* decodeFiling(FILING_A);
        const events = yield* repository.listEvents(filing);
        const dispositions = yield* repository.listDispositions(filing);
        const submissionFacts = yield* repository.listSubmissionFacts(filing);

        expect(ids(events)).toEqual([1]);
        expect(ids(dispositions)).toEqual([101]);
        expect(ids(submissionFacts)).toEqual([201]);

        // Round-tripping the recorded surface, not just the row count: the
        // disposition must still name the exact observation it answers.
        expect(A.map(dispositions, (disposition) => disposition.disposes.eventId)).toEqual([1]);
        expect(A.map(events, (event) => event.grounding.source.textDigest)).toEqual([SOURCE_A.digest]);
      })
    );
  });

  layer(Layer.fresh(CandorRecordRepositoryInMemory))("scoping reads by citing application", (it) => {
    it.effect(
      "never returns a second filing's records",
      Effect.fnUntraced(function* () {
        const repository = yield* CandorRecordRepository;
        yield* appendFiling(repository, FILING_A, 1, SOURCE_A);
        yield* appendFiling(repository, FILING_B, 2, SOURCE_B);

        const filingA = yield* decodeFiling(FILING_A);
        const filingB = yield* decodeFiling(FILING_B);

        expect(ids(yield* repository.listEvents(filingA))).toEqual([1]);
        expect(ids(yield* repository.listDispositions(filingA))).toEqual([101]);
        expect(ids(yield* repository.listSubmissionFacts(filingA))).toEqual([201]);

        expect(ids(yield* repository.listEvents(filingB))).toEqual([2]);
        expect(ids(yield* repository.listDispositions(filingB))).toEqual([102]);
        expect(ids(yield* repository.listSubmissionFacts(filingB))).toEqual([202]);
      })
    );
  });

  layer(Layer.fresh(CandorRecordRepositoryInMemory))("ordering reads of one filing", (it) => {
    it.effect(
      "returns each kind by id ascending whatever order it was appended in",
      Effect.fnUntraced(function* () {
        const repository = yield* CandorRecordRepository;

        // Appended highest id first, so append order and id order disagree and
        // a store that simply replayed insertions would fail here.
        yield* appendFiling(repository, FILING_A, 3, SOURCE_B);
        yield* appendFiling(repository, FILING_A, 1, SOURCE_A);

        const filing = yield* decodeFiling(FILING_A);

        expect(ids(yield* repository.listEvents(filing))).toEqual([1, 3]);
        expect(ids(yield* repository.listDispositions(filing))).toEqual([101, 103]);
        expect(ids(yield* repository.listSubmissionFacts(filing))).toEqual([201, 203]);
      })
    );
  });
});
