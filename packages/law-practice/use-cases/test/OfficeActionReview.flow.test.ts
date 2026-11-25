import {
  ArchiveExportProcessFileResult,
  ArchiveExportResult,
  ExtractedProcessFileResult,
  ExtractionResult,
  ProcessFileResult,
  SkippedProcessFileResult,
} from "@beep/file-processing/Extraction";
import { FileProcessingService } from "@beep/file-processing/Service";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { verifyActivityRecord } from "@beep/jsonc/ActivityRecord";
import { decodeExtractionHandoff, encodeExtractionHandoff } from "@beep/langextract/Handoff";
import { LangExtractService } from "@beep/langextract/Service";
import {
  LawClaimArrows,
  mintDistinctionId,
  OfficeActionDistinctionGate,
} from "@beep/law-practice-domain/values/LawClaim";
import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { distinctionPropositionOf, makeOfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview";
import { it } from "@beep/test-runner";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  missingOutput,
  modelOutput,
  overCapOutput,
  text,
  unalignedOutput,
} from "./fixtures/office-action-review/fixture.ts";
import {
  authorityStaffing,
  fixtureInput,
  fixturePrincipal,
  fixtureRevision,
  issueToken,
  makeLayer,
  makeMemoryClaimStore,
  reviewScenario,
  secondRevision,
  unstaffedPrincipal,
} from "./fixtures/office-action-review/support.ts";
import type { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import type { ContentHash } from "@beep/schema/ContentHash";

const ExtractTerm = TermIri.make(iri("operation:Extract"));
const MapToLawTerm = TermIri.make(iri("operation:MapToLaw"));
const ProposeClaimTerm = TermIri.make(iri("operation:ProposeClaim"));

const backwardClock = (script: A.NonEmptyReadonlyArray<number>): Clock.Clock => {
  const cursor = MutableRef.make(0);
  const next = (): number => {
    const position = MutableRef.get(cursor);
    MutableRef.set(cursor, position + 1);
    return O.getOrElse(A.get(script, position % A.length(script)), () => A.headNonEmpty(script));
  };
  const nanos = (): bigint => BigInt(next()) * 1_000_000n;
  return {
    currentTimeMillisUnsafe: next,
    currentTimeMillis: Effect.sync(next),
    currentTimeNanosUnsafe: nanos,
    currentTimeNanos: Effect.sync(nanos),
    monotonicTimeNanosUnsafe: nanos,
    monotonicTimeNanos: Effect.sync(nanos),
    sleep: () => Effect.void,
  };
};

const sortedIds = (ids: HashSet.HashSet<ContentHash>): ReadonlyArray<string> =>
  A.sort(A.fromIterable(ids), Order.String);

const recordOf = (activities: HashSet.HashSet<ActivityRecord>, operation: TermIri): ActivityRecord =>
  activities.pipe(
    A.fromIterable,
    A.findFirst((record) => record.start.operation === operation),
    O.getOrThrow
  );

const endsNoEarlierThanItStarts = (record: ActivityRecord): boolean =>
  DateTime.isLessThanOrEqualTo(record.start.started, record.ended);

const feeds = (producer: ActivityRecord, consumer: ActivityRecord): boolean =>
  HashSet.size(HashSet.intersection(producer.generated, consumer.start.used)) > 0;

const startsAfterTheProducersOfItsInputs = (log: ReadonlyArray<ActivityRecord>): boolean =>
  A.every(log, (consumer) =>
    A.every(
      A.filter(log, (producer) => feeds(producer, consumer)),
      (producer) => DateTime.isLessThanOrEqualTo(producer.ended, consumer.start.started)
    )
  );

const generatedByAnotherStep = (log: ReadonlyArray<ActivityRecord>, record: ActivityRecord, id: ContentHash) =>
  A.some(log, (other) => other.id !== record.id && HashSet.has(other.generated, id));

const usesOnlyWhatAnotherStepGenerated = (log: ReadonlyArray<ActivityRecord>, extractId: ActivityRecord["id"]) =>
  A.every(
    A.filter(log, (record) => record.id !== extractId),
    (record) => A.every(A.fromIterable(record.start.used), (used) => generatedByAnotherStep(log, record, used))
  );

const proposedScenario = Effect.fn("OfficeActionFlow.proposedScenario")(function* (current: string) {
  const scenario = yield* reviewScenario({ principal: fixturePrincipal, current });
  const result = yield* scenario.review.review(scenario.input);
  const handoff = scenario.handoff();
  const occurrence = result.proposed.core.supportAtCreation.pipe(A.fromIterable, A.head, O.getOrThrow);
  const grounding = [
    TextAnchorVerificationReceipt.make(HashMap.getUnsafe(handoff.document.anchors, occurrence).receipt),
  ];
  return { ...scenario, result, handoff, occurrence, grounding };
});

const skipped = (processed: ProcessFileResult): ProcessFileResult =>
  SkippedProcessFileResult.make({
    engine: processed.engine,
    format: processed.format,
    operationId: processed.operationId,
    resultKind: "skipped",
    skipReason: "format-out-of-scope",
    sourceArtifactId: processed.sourceArtifactId,
    warnings: [],
  });
const archived = (processed: ProcessFileResult): ProcessFileResult =>
  ArchiveExportProcessFileResult.make({
    archiveExport: ArchiveExportResult.make({
      children: [],
      engine: processed.engine,
      operationId: processed.operationId,
      sourceArtifactId: processed.sourceArtifactId,
      warnings: [],
    }),
    engine: processed.engine,
    format: processed.format,
    operationId: processed.operationId,
    resultKind: "archive-exported",
    sourceArtifactId: processed.sourceArtifactId,
    warnings: [],
  });
const extractedWith =
  (fields: { readonly engineVersion?: string; readonly text?: string }) =>
  (processed: ProcessFileResult): ProcessFileResult =>
    ProcessFileResult.match(processed, {
      "archive-exported": (archive): ProcessFileResult => archive,
      extracted: (extracted) =>
        ExtractedProcessFileResult.make({
          ...extracted,
          extraction: ExtractionResult.make({
            engine: extracted.extraction.engine,
            format: extracted.extraction.format,
            metadata: extracted.extraction.metadata,
            operationId: extracted.extraction.operationId,
            sourceArtifactId: extracted.extraction.sourceArtifactId,
            warnings: extracted.extraction.warnings,
            ...fields,
          }),
        }),
      skipped: (skip): ProcessFileResult => skip,
    });
const refusedBy = Effect.fn("OfficeActionFlow.refusedBy")(function* (
  reshape: (processed: ProcessFileResult) => ProcessFileResult
) {
  const digest = yield* Digest.Digest;
  const fileProcessing = yield* FileProcessingService;
  const langExtract = yield* LangExtractService;
  const store = yield* makeMemoryClaimStore();
  const review = makeOfficeActionReview({
    authority: authorityStaffing(fixturePrincipal),
    digest,
    fileProcessing: { ...fileProcessing, process: flow(fileProcessing.process, Effect.map(reshape)) },
    irToLaw: makeIrToLaw(),
    principal: fixturePrincipal,
    proposals: store.proposals,
    langExtract,
  });
  const input = yield* fixtureInput();
  return yield* review.review(input).pipe(Effect.flip);
});

describe("office-action annotation flow", () => {
  it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("real extraction service and pure mapping", (it) => {
    it.effect(
      "office-action flow runs the handoff into the review on an annotation document",
      Effect.fnUntraced(function* () {
        const { result } = yield* proposedScenario(text);
        expect(result.proposed.stance).toBe("proposed");
        expect(R.keys(result.law)).toHaveLength(5);
      })
    );
    it.effect(
      "office-action flow anchors every target on the fixture capture",
      Effect.fnUntraced(function* () {
        const { handoff, input, result } = yield* proposedScenario(text);
        const encoded = yield* encodeExtractionHandoff(handoff);
        const decoded = yield* decodeExtractionHandoff(encoded);
        expect(decoded).toEqual(handoff);
        expect(handoff.document.text.scopeRef).toBe(input.matterFixtureKey);
        expect(handoff.document.text.sourceRef).toBe(input.sourceArtifact.id);
        for (const anchored of HashMap.values(handoff.document.anchors))
          expect(anchored.receipt.source).toEqual(handoff.document.text);
        const anchor = result.law.distinction.anchor;
        expect(Str.slice(anchor.startChar, anchor.endChar)(text)).toBe(anchor.quote);
      })
    );
    it.effect(
      "office-action flow keeps every candidate",
      Effect.fnUntraced(function* () {
        const { handoff } = yield* proposedScenario(text);
        const indices = A.appendAll(
          handoff.readings.pipe(
            HashMap.toValues,
            A.flatten,
            A.map((reading) => reading.candidate)
          ),
          A.map(handoff.residual, (candidate) => candidate.candidate)
        );
        expect(A.sort(indices, Order.Number)).toEqual([0, 1, 2, 3]);
        expect(indices.length).toBe(handoff.candidateCount);
        expect(handoff.candidateCount).toBe(4);
      })
    );
    it.effect(
      "office-action flow proposes a record that round-trips, supported by the distinction occurrence",
      Effect.fnUntraced(function* () {
        const { result, occurrence } = yield* proposedScenario(text);
        const encoded = yield* LawClaimArrows.encodeClaimRecord(result.proposed);
        const decoded = yield* LawClaimArrows.decodeClaimRecord(encoded);
        expect(decoded.claim).toBe(result.proposed.claim);
        expect(A.fromIterable(result.proposed.core.supportAtCreation)).toEqual([occurrence]);
        expect(result.proposed.core.generatedBy).toBe(recordOf(result.activities, ProposeClaimTerm).id);
      })
    );
    it.effect(
      "L5-3 office-action flow attributes every step in order under a clock that steps backwards",
      Effect.fnUntraced(function* () {
        const { result, handoff } = yield* proposedScenario(text).pipe(
          Effect.provideService(Clock.Clock, backwardClock([5_000, 9_000, 1_000, 7_000, 3_000]))
        );
        const log = A.fromIterable(result.activities);
        expect(log).toHaveLength(3);
        const verified = yield* Effect.forEach(log, verifyActivityRecord, { concurrency: 1 });
        expect(verified).toHaveLength(3);
        expect(A.every(log, endsNoEarlierThanItStarts)).toBe(true);
        expect(startsAfterTheProducersOfItsInputs(log)).toBe(true);
        const extract = recordOf(result.activities, ExtractTerm);
        expect(usesOnlyWhatAnotherStepGenerated(log, extract.id)).toBe(true);
        expect(HashSet.has(recordOf(result.activities, ProposeClaimTerm).generated, result.proposed.claim)).toBe(true);
        const annotationAndOccurrenceIds = HashSet.union(
          HashSet.fromIterable<ContentHash>(handoff.document.annotations.pipe(HashMap.keys)),
          HashSet.fromIterable<ContentHash>(handoff.document.anchors.pipe(HashMap.keys))
        );
        const distinction = yield* mintDistinctionId(distinctionPropositionOf(result.law));
        expect(sortedIds(extract.generated)).toEqual(sortedIds(annotationAndOccurrenceIds));
        expect(sortedIds(recordOf(result.activities, MapToLawTerm).generated)).toEqual([distinction]);
        expect(sortedIds(recordOf(result.activities, ProposeClaimTerm).generated)).toEqual([result.proposed.claim]);
      })
    );
    it.effect(
      "office-action flow proposes again in a partition no earlier than its latest knowledge start",
      Effect.fnUntraced(function* () {
        const scenario = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        const first = yield* scenario.review.review(scenario.input);
        const second = yield* scenario.review.review(scenario.input);
        expect(
          DateTime.isLessThanOrEqualTo(first.proposed.core.knowledgeStart, second.proposed.core.knowledgeStart)
        ).toBe(true);
      })
    );
    it.effect(
      "office-action flow passes the gate on the full fixture and refuses admission while support is unassessed",
      Effect.fnUntraced(function* () {
        const { admission, grounding, result } = yield* proposedScenario(text);
        expect(OfficeActionDistinctionGate.passes(result.assessments)).toBe(true);
        const refused = yield* admission.admit({
          claim: result.proposed.claim,
          token: issueToken({ revision: fixtureRevision, scope: result.proposed.core.scope }),
          grounding,
          revision: fixtureRevision,
          assessments: { ...result.assessments, support: { _tag: "Unassessed", reason: "not-assessed" } },
        });
        expect(refused).toMatchObject({ _tag: "Refused", refusal: { _tag: "GateNotPassed" } });
      })
    );
    it.effect(
      "office-action flow admits an attorney-attested claim at the opened revision",
      Effect.fnUntraced(function* () {
        const { admission, grounding, result } = yield* proposedScenario(text);
        yield* admission.open({ claim: result.proposed.claim, revision: fixtureRevision });
        const admitted = yield* admission.admit({
          claim: result.proposed.claim,
          token: issueToken({ revision: fixtureRevision, scope: result.proposed.core.scope }),
          grounding,
          revision: fixtureRevision,
          assessments: result.assessments,
        });
        expect(admitted._tag).toBe("Admitted");
      })
    );
    it.effect(
      "office-action flow refuses an unstaffed principal, a token for another revision and stale current text",
      Effect.fnUntraced(function* () {
        const unstaffed = yield* reviewScenario({ principal: unstaffedPrincipal, current: text });
        const denied = yield* unstaffed.review.review(unstaffed.input).pipe(Effect.flip);
        expect(denied._tag).toBe("DeniedScope");
        const { admission, grounding, result } = yield* proposedScenario(text);
        yield* admission.open({ claim: result.proposed.claim, revision: fixtureRevision });
        const otherRevision = yield* admission.admit({
          claim: result.proposed.claim,
          token: issueToken({ revision: secondRevision, scope: result.proposed.core.scope }),
          grounding,
          revision: fixtureRevision,
          assessments: result.assessments,
        });
        expect(otherRevision).toMatchObject({
          _tag: "Refused",
          refusal: { _tag: "Admission", refusal: { _tag: "InvalidToken", reason: "binding" } },
        });
        const stale = yield* proposedScenario(`${text}Amended.\n`);
        yield* stale.admission.open({ claim: stale.result.proposed.claim, revision: fixtureRevision });
        const staleText = yield* stale.admission.admit({
          claim: stale.result.proposed.claim,
          token: issueToken({ revision: fixtureRevision, scope: stale.result.proposed.core.scope }),
          grounding: stale.grounding,
          revision: fixtureRevision,
          assessments: stale.result.assessments,
        });
        expect(staleText).toMatchObject({
          _tag: "Refused",
          refusal: { _tag: "Admission", refusal: { _tag: "GroundingStale" } },
        });
      })
    );
  });

  it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("unusable extraction results", (it) => {
    it.effect(
      "office-action review refuses a skipped, archived, textless or unversioned extraction before the model",
      Effect.fnUntraced(function* () {
        const refusals = yield* Effect.forEach(
          [skipped, archived, extractedWith({ engineVersion: "1" }), extractedWith({ text })],
          refusedBy,
          { concurrency: 1 }
        );
        expect(A.map(refusals, (refusal) => refusal._tag)).toStrictEqual(
          A.replicate("FileProcessingOperationError", 4)
        );
        expect(
          A.map(refusals, (refusal) =>
            refusal._tag === "FileProcessingOperationError" ? refusal.message : refusal._tag
          )
        ).toStrictEqual([
          "Office-action review requires extracted text, received skipped.",
          "Office-action review requires extracted text, received archive-exported.",
          "Office-action review requires text extraction output.",
          "Office-action review requires a versioned extractor.",
        ]);
      })
    );
  });

  it.layer(makeLayer(missingOutput), { timeout: "10 seconds" })("missing label", (it) => {
    it.effect(
      "office-action flow refuses a missing or unaligned label before the gate",
      Effect.fnUntraced(function* () {
        const { review, input } = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        const missing = yield* review.review(input).pipe(Effect.flip);
        expect(missing._tag).toBe("IrToLawExtractionError");
        if (missing._tag === "IrToLawExtractionError") expect(missing.reason).toBe("required-extraction-missing");
      })
    );
  });
  it.layer(makeLayer(unalignedOutput), { timeout: "10 seconds" })("unaligned label", (it) => {
    it.effect(
      "office-action flow refuses a missing or unaligned label before the gate",
      Effect.fnUntraced(function* () {
        const { review, input } = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        const unaligned = yield* review.review(input).pipe(Effect.flip);
        expect(unaligned._tag).toBe("IrToLawExtractionError");
        if (unaligned._tag === "IrToLawExtractionError") {
          expect(unaligned.reason).toBe("required-extraction-unaligned");
          assertSome(unaligned.alignmentStatus, "unaligned");
          assertSome(unaligned.residualReason, "unaligned");
        }
      })
    );
  });
  it.layer(makeLayer(overCapOutput), { timeout: "10 seconds" })("over-cap label", (it) => {
    it.effect(
      "office-action flow reports a required label past the extraction cap as residual, not unaligned",
      Effect.fnUntraced(function* () {
        const { review, input } = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        const capped = yield* review.review(input).pipe(Effect.flip);
        expect(capped._tag).toBe("IrToLawExtractionError");
        if (capped._tag === "IrToLawExtractionError") {
          expect(capped.reason).toBe("required-extraction-residual");
          expect(capped.label).toBe("distinction");
          assertSome(capped.residualReason, "over-extraction-cap");
        }
      })
    );
  });
});
