/**
 * Proof for the three candor row converters.
 *
 * Each entity is proved through one closed loop: a valid row decodes into the
 * entity, the entity encodes into an insert that omits the database-assigned
 * `id`, and putting an id back onto that insert decodes into an equivalent
 * entity. The loop is what makes the converters trustworthy as a pair — a
 * dropped column or an asymmetric codec breaks the return leg even when each
 * direction looks fine on its own.
 *
 * The fixtures are the ones proved against the real migration in
 * `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`,
 * so a row shape accepted here is a row shape Postgres accepted there.
 */

import { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import {
  fromCandorDispositionRow,
  toCandorDispositionInsert,
} from "@beep/law-practice-tables/entities/CandorDisposition";
import {
  fromIdsSubmissionFactRow,
  toIdsSubmissionFactInsert,
} from "@beep/law-practice-tables/entities/IdsSubmissionFact";
import {
  fromPatentCitationEventRow,
  toPatentCitationEventInsert,
} from "@beep/law-practice-tables/entities/PatentCitationEvent";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Order, Result } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const digest = `sha256:${"a".repeat(64)}`;
const citingApplication = { applicationNumber: "16138242", kind: "UsptoNormalized" } as const;

const sourceIdentity = {
  extractor: { name: "utf8", version: "1" },
  locator: "office-action.txt",
  normalizationVersion: "1",
  scopeRef: "matter:candor",
  sourceDigest: digest,
  sourceRef: "source:office-action",
  textDigest: digest,
};

const eventInput = {
  ...baseEntityFixtureInput("LawPracticePatentCitationEvent", 1),
  actor: "Applicant",
  citingApplication,
  discovery: { kind: "AiDiscovered", model: { name: "reference-extractor", version: "3" } },
  grounding: {
    anchor: { endChar: 4, quote: "fact", startChar: 0 },
    source: sourceIdentity,
  },
  observedAt: 1,
  possibleDuplicateOf: null,
  quarantine: null,
  reference: { number: "7654321" },
  supersedes: null,
};

const dispositionInput = {
  ...baseEntityFixtureInput("LawPracticeCandorDisposition", 1),
  citingApplication,
  decidedAt: 2,
  disposes: { eventId: 1, textDigest: digest },
  lifecycle: "active",
  litigationFrameJudgment: null,
  rule56Judgment: "Submit",
  supersedes: null,
};

const submissionFactInput = {
  ...baseEntityFixtureInput("LawPracticeIdsSubmissionFact", 1),
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
  modeledFrom: { cfrCapture: "law.cornell.edu 37 CFR 1.97/1.98, captured 2026-08-04", mpepRevision: "R-01.2024" },
  officeTreatment: null,
  operativeDate: 3,
  statement: { sizeFeeAssertionPresent: true, statementPresent: true, statementType: "e2-no-prior-knowledge" },
  submissionKind: "initial",
};

// The id the fixtures carry. Reattaching exactly this one to an insert is what
// lets the return leg be compared to the entity the loop started from.
const ROW_ID = 1;

// The audit envelope every candor entity carries, with `id` deliberately
// absent: the insert defers to the table sequence, so the database assigns it.
const BASE_INSERT_KEYS: ReadonlyArray<string> = [
  "createdAt",
  "createdByPrincipal",
  "entityType",
  "orgId",
  "publicId",
  "rowVersion",
  "schemaVersion",
  "source",
  "updatedAt",
  "updatedByPrincipal",
];

const sortedKeys = (row: Readonly<Record<string, unknown>>): ReadonlyArray<string> => A.sort(R.keys(row), Order.String);

const expectedInsertKeys = (own: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(A.appendAll(BASE_INSERT_KEYS, own), Order.String);

// Schema equivalence rather than a structural compare: the entities carry
// `Option` and branded fields whose identity is the schema's to decide.
const sameEvent = S.toEquivalence(PatentCitationEvent);
const sameDisposition = S.toEquivalence(CandorDisposition);
const sameSubmissionFact = S.toEquivalence(IdsSubmissionFact);

describe("PatentCitationEvent converters", () => {
  it.effect(
    "encodes a decoded observation into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const event = yield* Effect.fromResult(fromPatentCitationEventRow(eventInput));
      const insert = yield* Effect.fromResult(toPatentCitationEventInsert(event));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "actor",
          "citingApplication",
          "discovery",
          "grounding",
          "observedAt",
          "possibleDuplicateOf",
          "quarantine",
          "reference",
          "supersedes",
        ])
      );
    })
  );

  it.effect(
    "round-trips the recorded observation back out of the row shape",
    Effect.fnUntraced(function* () {
      const event = yield* Effect.fromResult(fromPatentCitationEventRow(eventInput));
      const insert = yield* Effect.fromResult(toPatentCitationEventInsert(event));
      const returned = yield* Effect.fromResult(fromPatentCitationEventRow({ ...insert, id: ROW_ID }));

      // The load-bearing surface first, so a drift reads as the field that
      // moved rather than as one opaque inequality.
      expect(returned.reference.number).toEqual(O.some("7654321"));
      expect(DateTime.toEpochMillis(returned.observedAt)).toBe(1);
      expect(returned.actor).toBe("Applicant");
      expect(returned.discovery.kind).toBe("AiDiscovered");
      expect(returned.grounding.source.textDigest).toBe(digest);
      expect(returned.citingApplication.applicationNumber).toBe("16138242");
      expect(sameEvent(returned, event)).toBe(true);
    })
  );

  it("rejects a row carrying no recorded observation, and one missing its grounding", () => {
    const { grounding: _grounding, ...ungrounded } = eventInput;

    expect(Result.isFailure(fromPatentCitationEventRow({}))).toBe(true);
    // An event without grounding is the dangerous near-miss: every audit column
    // is present, so only the entity schema can refuse it.
    expect(Result.isFailure(fromPatentCitationEventRow(ungrounded))).toBe(true);
  });
});

describe("CandorDisposition converters", () => {
  it.effect(
    "encodes a decoded judgment into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const disposition = yield* Effect.fromResult(fromCandorDispositionRow(dispositionInput));
      const insert = yield* Effect.fromResult(toCandorDispositionInsert(disposition));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "citingApplication",
          "decidedAt",
          "disposes",
          "lifecycle",
          "litigationFrameJudgment",
          "rule56Judgment",
          "supersedes",
        ])
      );
    })
  );

  it.effect(
    "round-trips the recorded judgment back out of the row shape",
    Effect.fnUntraced(function* () {
      const disposition = yield* Effect.fromResult(fromCandorDispositionRow(dispositionInput));
      const insert = yield* Effect.fromResult(toCandorDispositionInsert(disposition));
      const returned = yield* Effect.fromResult(fromCandorDispositionRow({ ...insert, id: ROW_ID }));

      // The judgment must still name the exact observation version it answers;
      // a disposition that lost its digest would cover the wrong event.
      expect(returned.disposes.eventId).toBe(1);
      expect(returned.disposes.textDigest).toBe(digest);
      expect(returned.rule56Judgment).toEqual(O.some("Submit"));
      expect(DateTime.toEpochMillis(returned.decidedAt)).toBe(2);
      expect(returned.lifecycle).toBe("active");
      expect(sameDisposition(returned, disposition)).toBe(true);
    })
  );

  it("rejects a row carrying no recorded judgment, and one missing what it disposes", () => {
    const { disposes: _disposes, ...undisposing } = dispositionInput;

    expect(Result.isFailure(fromCandorDispositionRow({}))).toBe(true);
    expect(Result.isFailure(fromCandorDispositionRow(undisposing))).toBe(true);
  });
});

describe("IdsSubmissionFact converters", () => {
  it.effect(
    "encodes a decoded submission fact into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const fact = yield* Effect.fromResult(fromIdsSubmissionFactRow(submissionFactInput));
      const insert = yield* Effect.fromResult(toIdsSubmissionFactInsert(fact));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "candidateWindow",
          "citingApplication",
          "content",
          "fees",
          "modeledFrom",
          "officeTreatment",
          "operativeDate",
          "statement",
          "submissionKind",
        ])
      );
    })
  );

  it.effect(
    "round-trips the recorded submission fact back out of the row shape",
    Effect.fnUntraced(function* () {
      const fact = yield* Effect.fromResult(fromIdsSubmissionFactRow(submissionFactInput));
      const insert = yield* Effect.fromResult(toIdsSubmissionFactInsert(fact));
      const returned = yield* Effect.fromResult(fromIdsSubmissionFactRow({ ...insert, id: ROW_ID }));

      expect(returned.submissionKind).toBe("initial");
      expect(DateTime.toEpochMillis(returned.operativeDate)).toBe(3);
      expect(returned.statement.statementType).toEqual(O.some("e2-no-prior-knowledge"));
      expect(returned.fees.timingFeePresent).toBe(true);
      expect(returned.candidateWindow.candidateWindow).toBe("indeterminate");
      expect(sameSubmissionFact(returned, fact)).toBe(true);
    })
  );

  it("rejects a row carrying no recorded submission facts, and one missing its timing window", () => {
    const { candidateWindow: _candidateWindow, ...untimed } = submissionFactInput;

    expect(Result.isFailure(fromIdsSubmissionFactRow({}))).toBe(true);
    expect(Result.isFailure(fromIdsSubmissionFactRow(untimed))).toBe(true);
  });
});
