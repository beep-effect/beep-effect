// @vitest-environment node

import { Confidence } from "@beep/epistemic-domain";
import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  TextAnchor,
  TextAnchorVerificationReceipt,
  VerifiedTextAnchorError,
} from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { Effect, Encoding, Equal, HashMap, HashSet, Layer, Option, Order, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/corpus/Canonical";
import { CorpusPaperId } from "@/corpus/Manifest";
import { F1FixtureId, FixtureDegradedKind, FixtureMediaType } from "@/fixtures/F1";
import { DegradedKind } from "@/schema/Degraded";
import { contentDigest, contentDigestSync, digestOmitting, digestOmittingSync, sha256TextSync } from "@/schema/Digest";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import {
  AnchorRejected,
  DocumentUnavailable,
  GoldUnavailable,
  LedgerFailed,
  ModelRevisionUnpinned,
  ParserFailed,
  ProviderCacheCorrupt,
  ProviderUnavailable,
  ReportInvalid,
} from "@/schema/Errors";
import {
  CanaryStage,
  DocumentOutcome,
  EvalReport,
  EvalRun,
  EvalSelection,
  MetricName,
  MetricScore,
  MetricStatus,
  MetricSubset,
  RequiredMetric,
  RequiredMetrics,
} from "@/schema/Eval";
import {
  batchIdPreimage,
  ClaimBody,
  ConflictBasis,
  ConflictWitness,
  claimIdPreimage,
  DegradedClaim,
  declaredLosses,
  EvidenceBatch,
  EvidenceClaim,
  ExtractionLane,
  ExtractionMethod,
  ExtractOutcome,
  LossDeclaration,
  makeBatchId,
  makeClaimId,
  StructureRole,
} from "@/schema/Evidence";
import {
  CurrentGoldDocumentText,
  GoldEntityLabel,
  GoldFile,
  GoldFileEncoded,
  GoldRef,
  GoldRelationLabel,
  GoldStructureLabel,
  GoldSubset,
} from "@/schema/Gold";
import {
  DocumentId,
  isBatchId,
  isChunkId,
  isClaimId,
  isDocumentId,
  isProvenanceEventId,
  isRunId,
  ProvenanceEventId,
  RunId,
} from "@/schema/Ids";
import { MediaType } from "@/schema/MediaType";
import { ModelIdentity, ProviderFamily, TaskType } from "@/schema/Model";
import { EventBody, ProvenanceEvent } from "@/schema/Provenance";
import { ProviderCacheEntry, ProviderCacheKey, RequestKind } from "@/schema/ProviderCache";
import { EvalRunTelemetry } from "@/schema/Telemetry";
import { Chunk, ChunkKind, chunkIdPreimage, isCanonicalText, makeChunkId, ParseOutcome } from "@/schema/Text";
import type { DegradedKind as DegradedKindValue } from "@/schema/Degraded";
import type { Origin as OriginValue } from "@/schema/Document";
import type {
  CanaryStage as CanaryStageValue,
  MetricName as MetricNameValue,
  MetricStatus as MetricStatusValue,
  MetricSubset as MetricSubsetValue,
} from "@/schema/Eval";
import type {
  ClaimBody as ClaimBodyValue,
  ConflictBasis as ConflictBasisValue,
  ExtractionLane as ExtractionLaneValue,
  ExtractionMethod as ExtractionMethodValue,
  ExtractOutcome as ExtractOutcomeValue,
  LossDeclaration as LossDeclarationValue,
  StructureRole as StructureRoleValue,
} from "@/schema/Evidence";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";
import type {
  BatchId as BatchIdValue,
  ChunkId as ChunkIdValue,
  ClaimId as ClaimIdValue,
  DocumentId as DocumentIdValue,
  ProvenanceEventId as ProvenanceEventIdValue,
  RunId as RunIdValue,
} from "@/schema/Ids";
import type { MediaType as MediaTypeValue } from "@/schema/MediaType";
import type { ProviderFamily as ProviderFamilyValue, TaskType as TaskTypeValue } from "@/schema/Model";
import type { EventBody as EventBodyValue } from "@/schema/Provenance";
import type { RequestKind as RequestKindValue } from "@/schema/ProviderCache";
import type { CanonicalText, ChunkKind as ChunkKindValue, ParseOutcome as ParseOutcomeValue } from "@/schema/Text";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);

const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const roundTripGoldFile = (value: GoldFileValue): void => {
  const encoded = Result.getOrThrow(S.encodeResult(GoldFile)(value));
  const decoded = Effect.runSync(
    S.decodeEffect(GoldFile)(encoded).pipe(Effect.provideService(CurrentGoldDocumentText, "Effect data"))
  );

  expect(S.toEquivalence(S.toType(GoldFile))(decoded, value)).toBe(true);
};

const rejects = <Schema extends S.Codec<unknown>>(schema: Schema, value: unknown): boolean =>
  Result.isFailure(S.decodeUnknownResult(schema)(value));

const sha = (digit: string): Sha256Hex => Sha256Hex.make(Str.repeat(64)(digit));
const canonicalDigest = (value: unknown): Sha256Hex =>
  Sha256Hex.make(Encoding.encodeHex(sha256(new TextEncoder().encode(canonicalJson(value)))));

const documentId = DocumentId.make(Str.repeat(64)("1"));
const secondDocumentId = DocumentId.make(Str.repeat(64)("2"));
const acquired = ProvenanceEventId.make(Str.repeat(64)("6"));

const parsingFixtureDeclaration = FixtureDeclaration.make({
  expectation: "parses",
  degradedKind: Option.none(),
});
const fixtureOrigin = Origin.cases.Fixture.make({
  kind: "Fixture",
  fixtureId: F1FixtureId.make("md-structure"),
  relativePath: "documents/md-structure.md",
  declared: parsingFixtureDeclaration,
});
const secondFixtureOrigin = Origin.cases.Fixture.make({
  kind: "Fixture",
  fixtureId: F1FixtureId.make("md-unicode"),
  relativePath: "documents/md-unicode.md",
  declared: parsingFixtureDeclaration,
});
const w1Origin = Origin.cases.W1Paper.make({
  kind: "W1Paper",
  corpusId: "academia-2026-07",
  paperId: CorpusPaperId.make("000000000001"),
  relativePath: "000000000001.pdf",
});
const sourceDocument = SourceDocument.make({
  id: documentId,
  mediaType: "text/markdown",
  origin: fixtureOrigin,
  bytes: NonNegativeInt.make(6),
  sha256: documentId,
  acquired,
});

const extractorIdentity = SourceTextExtractor.make({ name: "identity-utf8", version: "1" });
const sourceIdentity = SourceTextIdentity.make({
  scopeRef: "semantica-canary",
  sourceRef: documentId,
  locator: PosixPath.make("documents/md-structure.md"),
  sourceDigest: SourceTextDigest.make(`sha256:${documentId}`),
  textDigest: SourceTextDigest.make(`sha256:${sha("7")}`),
  extractor: extractorIdentity,
  normalizationVersion: "raw/1",
});
const anchor = TextAnchor.make({
  startChar: NonNegativeInt.make(0),
  endChar: NonNegativeInt.make(6),
  quote: "Effect",
});
const otherAnchor = TextAnchor.make({
  startChar: NonNegativeInt.make(7),
  endChar: NonNegativeInt.make(11),
  quote: "data",
});
const receipt = TextAnchorVerificationReceipt.make({ anchor, source: sourceIdentity });
const otherReceipt = TextAnchorVerificationReceipt.make({ anchor: otherAnchor, source: sourceIdentity });
const canonicalText = ResolvedSourceText.make({ identity: sourceIdentity, text: "Effect data" });
const chunkId = Result.getOrThrow(makeChunkId({ document: documentId, anchor, receipt }));
const unlistedChunkId = Result.getOrThrow(
  makeChunkId({ document: documentId, anchor: otherAnchor, receipt: otherReceipt })
);
const chunk = Chunk.make({
  id: chunkId,
  document: documentId,
  kind: "sentence",
  ordinal: NonNegativeInt.make(0),
  anchor,
  receipt,
});

const hostedModel = ModelIdentity.make({
  provider: "anthropic",
  name: "claude-test-20260825",
  revision: "claude-test-20260825",
  artifactHash: sha("8"),
  taskType: "extraction",
});
const patternModel = ModelIdentity.make({
  provider: "wink",
  name: "wink-nlp",
  revision: "1",
  artifactHash: sha("9"),
  taskType: "extraction",
});
const proposerModel = ModelIdentity.make({
  provider: "xai",
  name: "grok-test-20260825",
  revision: "grok-test-20260825",
  artifactHash: sha("a"),
  taskType: "gold-proposal",
});

const providerKey = ProviderCacheKey.make({
  schemaVersion: "provider-cache/v1",
  model: hostedModel,
  requestKind: "generate-text",
  inputDigest: sha("b"),
});
const providerCacheKey = Result.getOrThrow(contentDigestSync(ProviderCacheKey)(providerKey));
const providerResponse = "grounded response";
const providerEntry = ProviderCacheEntry.make({
  key: providerKey,
  cacheKey: providerCacheKey,
  response: providerResponse,
  responseDigest: sha256TextSync(providerResponse),
});

const entityBody = ClaimBody.cases.Entity.make({
  cluster: Option.some("software-effect"),
  kind: "Entity",
  label: "Effect",
  entityType: "software",
  startChar: anchor.startChar,
  endChar: anchor.endChar,
  quote: anchor.quote,
});
const secondEntityBody = ClaimBody.cases.Entity.make({
  cluster: Option.some("concept-data"),
  kind: "Entity",
  label: "data",
  entityType: "concept",
  startChar: otherAnchor.startChar,
  endChar: otherAnchor.endChar,
  quote: otherAnchor.quote,
});
const claimId = Result.getOrThrow(
  makeClaimId({
    document: documentId,
    chunk: chunkId,
    body: entityBody,
    method: "hosted-langextract",
    model: hostedModel,
  })
);
const secondClaimId = Result.getOrThrow(
  makeClaimId({
    document: documentId,
    chunk: chunkId,
    body: secondEntityBody,
    method: "hosted-langextract",
    model: hostedModel,
  })
);
const relationBody = ClaimBody.cases.Relation.make({
  kind: "Relation",
  predicate: "uses",
  subject: claimId,
  object: secondClaimId,
  startChar: NonNegativeInt.make(0),
  endChar: NonNegativeInt.make(6),
  quote: "Effect",
});
const relationClaimId = Result.getOrThrow(
  makeClaimId({
    document: documentId,
    chunk: chunkId,
    body: relationBody,
    method: "hosted-langextract",
    model: hostedModel,
  })
);
const structureBody = ClaimBody.cases.Structure.make({
  kind: "Structure",
  role: "title",
  depth: NonNegativeInt.make(0),
  startChar: anchor.startChar,
  endChar: anchor.endChar,
  quote: anchor.quote,
});
const evidenceClaim = EvidenceClaim.make({
  id: claimId,
  document: documentId,
  chunk: chunkId,
  body: entityBody,
  confidence: Confidence.make(0.9),
  method: "hosted-langextract",
  model: hostedModel,
  cacheKey: Option.some(providerCacheKey),
  receipt,
});
const secondEvidenceClaim = EvidenceClaim.make({
  id: secondClaimId,
  document: documentId,
  chunk: chunkId,
  body: secondEntityBody,
  confidence: Confidence.make(0.8),
  method: "hosted-langextract",
  model: hostedModel,
  cacheKey: Option.some(providerCacheKey),
  receipt: otherReceipt,
});
const relationClaim = EvidenceClaim.make({
  id: relationClaimId,
  document: documentId,
  chunk: chunkId,
  body: relationBody,
  confidence: Confidence.make(0.7),
  method: "hosted-langextract",
  model: hostedModel,
  cacheKey: Option.some(providerCacheKey),
  receipt,
});
const degradedClaim = DegradedClaim.make({
  kind: "relation-unresolved",
  detail: "The relation object did not resolve to an entity claim.",
  chunk: chunkId,
});
const batchId = Result.getOrThrow(
  makeBatchId({ document: documentId, method: "hosted-langextract", model: hostedModel, inputs: [chunkId] })
);
const evidenceBatch = EvidenceBatch.make({
  id: batchId,
  document: documentId,
  method: "hosted-langextract",
  model: hostedModel,
  inputs: [chunkId],
  claims: [evidenceClaim],
  degraded: [degradedClaim],
  lossy: [],
});
const relationBatch = EvidenceBatch.make({
  ...evidenceBatch,
  claims: [evidenceClaim, secondEvidenceClaim, relationClaim],
  degraded: [],
});
const conflictEndpoints = A.sort(Order.String)([claimId, secondClaimId]);
const conflictLeft = A.getUnsafe(conflictEndpoints, 0);
const conflictRight = A.getUnsafe(conflictEndpoints, 1);
const conflictBasis = "same-anchor-different-label" as const;
const conflictWitness = ConflictWitness.make({
  id: canonicalDigest({ left: conflictLeft, right: conflictRight, basis: conflictBasis }),
  left: conflictLeft,
  right: conflictRight,
  basis: conflictBasis,
});

const goldPapers = A.map(
  [
    "000000000001",
    "000000000002",
    "000000000003",
    "000000000004",
    "000000000005",
    "000000000006",
    "000000000007",
    "000000000008",
    "000000000009",
    "00000000000a",
  ],
  (id) => CorpusPaperId.make(id)
);
const paper1 = A.getUnsafe(goldPapers, 0);
const paper2 = A.getUnsafe(goldPapers, 1);
const paper3 = A.getUnsafe(goldPapers, 2);
const goldSubset = GoldSubset.make({
  structure: goldPapers,
  entity: A.take(goldPapers, 5),
  relation: A.take(goldPapers, 3),
});
const goldRef = GoldRef.make({
  version: "gold/v1",
  digest: sha("c"),
  proposer: proposerModel,
  spotCheckedFraction: UnitInterval.make(0.5),
  subsets: goldSubset,
});
const runBody = {
  stage: "c0" as const,
  corpusHash: sha("d"),
  fixtureIndexDigest: sha("e"),
  gold: goldRef,
  extractor: hostedModel,
  patternLane: patternModel,
  selection: EvalSelection.make({ w1: [], f1: [fixtureOrigin.fixtureId] }),
};
const EvalRunBodySchema = S.Struct({
  stage: CanaryStage,
  corpusHash: Sha256Hex,
  fixtureIndexDigest: Sha256Hex,
  gold: GoldRef,
  extractor: ModelIdentity,
  patternLane: ModelIdentity,
  selection: EvalSelection,
});
const evalRun = EvalRun.make({
  id: RunId.make(Result.getOrThrow(contentDigestSync(EvalRunBodySchema)(runBody))),
  ...runBody,
});
const documentOutcome = DocumentOutcome.make({
  document: documentId,
  origin: fixtureOrigin,
  parse: "parsed",
  extraction: { hosted: "extracted", pattern: "extracted" },
  chunks: NonNegativeInt.make(1),
  claims: {
    hosted: {
      entity: NonNegativeInt.make(1),
      relation: NonNegativeInt.make(0),
      structure: NonNegativeInt.make(0),
    },
    pattern: {
      entity: NonNegativeInt.make(1),
      relation: NonNegativeInt.make(0),
      structure: NonNegativeInt.make(0),
    },
  },
  degradedClaims: NonNegativeInt.make(0),
  anchorsVerified: NonNegativeInt.make(2),
  anchorsFailed: NonNegativeInt.make(0),
  cacheKeys: [providerCacheKey],
});
const requiredC0 = Option.getOrThrow(HashMap.get(RequiredMetrics, "c0"));
const metricScores = A.map(requiredC0, (required) =>
  MetricScore.make({
    ...required,
    status: required.lane === "pattern" && required.subset === "relation" ? "unsupported" : "scored",
    value: UnitInterval.make(required.lane === "pattern" && required.subset === "relation" ? 0 : 1),
    support: NonNegativeInt.make(required.lane === "pattern" && required.subset === "relation" ? 0 : 1),
  })
);

const EvalReportBodySchema = S.Struct({
  schemaVersion: S.Literal("eval-report/v1"),
  run: EvalRun,
  documents: S.NonEmptyArray(DocumentOutcome),
  metrics: S.NonEmptyArray(MetricScore),
  unexpectedDegraded: NonNegativeInt,
});

const withReportDigest = (body: typeof EvalReportBodySchema.Type) => ({
  ...Result.getOrThrow(S.encodeResult(EvalReportBodySchema)(body)),
  reportDigest: Result.getOrThrow(contentDigestSync(EvalReportBodySchema)(body)),
});

const reportBody = {
  schemaVersion: "eval-report/v1" as const,
  run: evalRun,
  documents: [documentOutcome] as [DocumentOutcome],
  metrics: metricScores as [MetricScore, ...Array<MetricScore>],
  unexpectedDegraded: NonNegativeInt.make(0),
};
const evalReport = S.decodeSync(EvalReport)(withReportDigest(reportBody));

describe("C0 schema exports", () => {
  it("consumes every literal domain, branded type, guard, and type alias", () => {
    const types = {
      documentId: documentId as DocumentIdValue,
      chunkId: chunkId as ChunkIdValue,
      claimId: claimId as ClaimIdValue,
      batchId: batchId as BatchIdValue,
      eventId: acquired as ProvenanceEventIdValue,
      runId: evalRun.id as RunIdValue,
      mediaType: "text/markdown" as MediaTypeValue,
      degradedKind: "truncated" as DegradedKindValue,
      origin: fixtureOrigin as OriginValue,
      parseOutcome: ParseOutcome.cases.Parsed.make({
        outcome: "Parsed",
        document: documentId,
        text: "Effect data",
        extractor: extractorIdentity,
      }) as ParseOutcomeValue,
      canonicalText: canonicalText as CanonicalText,
      chunkKind: "sentence" as ChunkKindValue,
      providerFamily: "anthropic" as ProviderFamilyValue,
      taskType: "extraction" as TaskTypeValue,
      requestKind: "generate-text" as RequestKindValue,
      lane: "hosted" as ExtractionLaneValue,
      method: "hosted-langextract" as ExtractionMethodValue,
      structureRole: "title" as StructureRoleValue,
      loss: "relations-not-supported" as LossDeclarationValue,
      claimBody: entityBody as ClaimBodyValue,
      extractOutcome: ExtractOutcome.cases.Extracted.make({
        outcome: "Extracted",
        batch: evidenceBatch,
      }) as ExtractOutcomeValue,
      conflictBasis: "same-anchor-different-label" as ConflictBasisValue,
      eventBody: EventBody.cases.Ingested.make({ kind: "Ingested", document: documentId }) as EventBodyValue,
      goldFile: GoldFile.make({
        version: "gold/v1",
        paperId: paper1,
        subset: "entity",
        labels: [],
        proposer: proposerModel,
      }) as GoldFileValue,
      stage: "c0" as CanaryStageValue,
      metricName: "entity-span-f1" as MetricNameValue,
      metricSubset: "entity" as MetricSubsetValue,
      metricStatus: "scored" as MetricStatusValue,
    };

    expect(A.length(Object.keys(types))).toBe(28);
    expect([
      isDocumentId(documentId),
      isChunkId(chunkId),
      isClaimId(claimId),
      isBatchId(batchId),
      isProvenanceEventId(acquired),
      isRunId(evalRun.id),
      isCanonicalText(canonicalText),
    ]).toEqual([true, true, true, true, true, true, true]);
    expect(MediaType.Options).toEqual(FixtureMediaType.Options);
    expect(ProviderFamily.is.anthropic("anthropic")).toBe(true);
    expect(TaskType.is.extraction("extraction")).toBe(true);
    expect(RequestKind.is["generate-text"]("generate-text")).toBe(true);
    expect(ExtractionLane.is.hosted("hosted")).toBe(true);
    expect(ExtractionMethod.is["pattern-wink"]("pattern-wink")).toBe(true);
    expect(StructureRole.is.title("title")).toBe(true);
    expect(LossDeclaration.is["structure-not-supported"]("structure-not-supported")).toBe(true);
    expect(ConflictBasis.is["same-anchor-different-label"]("same-anchor-different-label")).toBe(true);
    expect(ChunkKind.is.sentence("sentence")).toBe(true);
    expect(MetricName.is["b-cubed"]("b-cubed")).toBe(true);
    expect(MetricSubset.is.all("all")).toBe(true);
    expect(MetricStatus.is.scored("scored")).toBe(true);
  });

  it("derives fast-check values from representative source schemas", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(DocumentId)(fc),
        S.toArbitrary(DegradedKind)(fc),
        S.toArbitrary(MetricName)(fc),
        (id, kind, metric) => isDocumentId(id) && S.is(DegradedKind)(kind) && S.is(MetricName)(metric)
      ),
      { numRuns: 25 }
    );
  });
});

describe("C0 schema round trips", () => {
  it("round-trips document, text, model, cache, evidence, gold, evaluation, and telemetry classes", () => {
    roundTrip(SourceDocument, sourceDocument);
    roundTrip(Chunk, chunk);
    roundTrip(ModelIdentity, hostedModel);
    roundTrip(ProviderCacheKey, providerKey);
    roundTrip(ProviderCacheEntry, providerEntry);
    roundTrip(EvidenceClaim, evidenceClaim);
    roundTrip(DegradedClaim, degradedClaim);
    roundTrip(EvidenceBatch, evidenceBatch);
    roundTrip(ConflictWitness, conflictWitness);
    roundTrip(GoldSubset, goldSubset);
    roundTrip(GoldRef, goldRef);
    roundTrip(
      GoldStructureLabel,
      GoldStructureLabel.make({
        role: "title",
        depth: NonNegativeInt.make(0),
        startChar: anchor.startChar,
        endChar: anchor.endChar,
        quote: anchor.quote,
        verified: true,
      })
    );
    roundTrip(
      GoldEntityLabel,
      GoldEntityLabel.make({
        cluster: "software-effect",
        label: "Effect",
        entityType: "software",
        startChar: anchor.startChar,
        endChar: anchor.endChar,
        quote: anchor.quote,
        verified: true,
      })
    );
    roundTrip(
      GoldRelationLabel,
      GoldRelationLabel.make({
        predicate: "uses",
        subject: "Effect",
        subjectStartChar: anchor.startChar,
        subjectEndChar: anchor.endChar,
        object: "Schema",
        objectStartChar: anchor.startChar,
        objectEndChar: anchor.endChar,
        startChar: anchor.startChar,
        endChar: anchor.endChar,
        quote: anchor.quote,
        verified: false,
      })
    );
    roundTrip(EvalRun, evalRun);
    roundTrip(MetricScore, A.getUnsafe(metricScores, 0));
    roundTrip(RequiredMetric, A.getUnsafe(requiredC0, 0));
    roundTrip(DocumentOutcome, documentOutcome);
    roundTrip(EvalReport, evalReport);

    const telemetry = S.decodeSync(EvalRunTelemetry)({
      schemaVersion: "eval-telemetry/v1",
      reportDigest: evalReport.reportDigest,
      runId: evalRun.id,
      mode: "live",
      startedAt: "2026-08-25T12:00:00.000Z",
      wallClockMs: 10,
      coldStartMs: 2,
      p95Ms: 4,
      rssBytes: 1_000,
      diskGrowthBytes: 100,
      dependencyBytes: 500,
      modelBytes: 250,
    });
    roundTrip(EvalRunTelemetry, telemetry);
  });

  it("encodes gold labels without corpus text and hydrates exact document slices", () => {
    const text = "Effect uses Schema";
    const structure = GoldFile.make({
      labels: [
        GoldStructureLabel.make({
          depth: NonNegativeInt.make(0),
          endChar: NonNegativeInt.make(6),
          quote: "Effect",
          role: "title",
          startChar: NonNegativeInt.make(0),
          verified: false,
        }),
      ],
      paperId: paper1,
      proposer: proposerModel,
      subset: "structure",
      version: "gold/v1",
    });
    const entity = GoldFile.make({
      labels: [
        GoldEntityLabel.make({
          cluster: "software-effect",
          endChar: NonNegativeInt.make(6),
          entityType: "software",
          label: "Effect",
          quote: "Effect",
          startChar: NonNegativeInt.make(0),
          verified: false,
        }),
      ],
      paperId: paper1,
      proposer: proposerModel,
      subset: "entity",
      version: "gold/v1",
    });
    const relation = GoldFile.make({
      labels: [
        GoldRelationLabel.make({
          endChar: NonNegativeInt.make(18),
          object: "Schema",
          objectEndChar: NonNegativeInt.make(18),
          objectStartChar: NonNegativeInt.make(12),
          predicate: "uses",
          quote: text,
          startChar: NonNegativeInt.make(0),
          subject: "Effect",
          subjectEndChar: NonNegativeInt.make(6),
          subjectStartChar: NonNegativeInt.make(0),
          verified: false,
        }),
      ],
      paperId: paper1,
      proposer: proposerModel,
      subset: "relation",
      version: "gold/v1",
    });
    const encodedStructure = Result.getOrThrow(S.encodeResult(GoldFile)(structure));
    const encodedEntity = Result.getOrThrow(S.encodeResult(GoldFile)(entity));
    const encodedRelation = Result.getOrThrow(S.encodeResult(GoldFile)(relation));

    expect(encodedStructure.labels[0]).not.toHaveProperty("quote");
    expect(encodedStructure.labels[0]).toHaveProperty("quoteSha256");
    expect(encodedEntity.labels[0]).not.toHaveProperty("label");
    expect(encodedEntity.labels[0]).not.toHaveProperty("quote");
    expect(encodedEntity.labels[0]).toHaveProperty("labelSha256");
    expect(encodedRelation.labels[0]).not.toHaveProperty("object");
    expect(encodedRelation.labels[0]).not.toHaveProperty("quote");
    expect(encodedRelation.labels[0]).not.toHaveProperty("subject");
    expect(encodedRelation.labels[0]).toHaveProperty("objectSha256");
    expect(encodedRelation.labels[0]).toHaveProperty("quoteSha256");
    expect(encodedRelation.labels[0]).toHaveProperty("subjectSha256");

    const hydrated = Effect.runSync(
      S.decodeEffect(GoldFile)(encodedRelation).pipe(Effect.provideService(CurrentGoldDocumentText, text))
    );
    expect(hydrated).toEqual(relation);
  });

  it("round-trips every tagged-union member", () => {
    const parsed = ParseOutcome.cases.Parsed.make({
      outcome: "Parsed",
      document: documentId,
      text: "Effect data",
      extractor: extractorIdentity,
    });
    const degradedParse = ParseOutcome.cases.Degraded.make({
      outcome: "Degraded",
      document: documentId,
      kind: "invalid-utf8",
      detail: "Input was not valid UTF-8.",
    });
    roundTrip(Origin, fixtureOrigin);
    roundTrip(Origin, w1Origin);
    roundTrip(ParseOutcome, parsed);
    roundTrip(ParseOutcome, degradedParse);
    roundTrip(ClaimBody, entityBody);
    roundTrip(ClaimBody, relationBody);
    roundTrip(ClaimBody, structureBody);
    roundTrip(ExtractOutcome, ExtractOutcome.cases.Extracted.make({ outcome: "Extracted", batch: evidenceBatch }));
    roundTrip(
      ExtractOutcome,
      ExtractOutcome.cases.Degraded.make({
        outcome: "Degraded",
        document: documentId,
        lane: "hosted",
        kind: "provider-unavailable",
        detail: "Provider cache miss.",
      })
    );

    const eventBodies = [
      EventBody.cases.Ingested.make({ kind: "Ingested", document: documentId }),
      EventBody.cases.Parsed.make({
        kind: "Parsed",
        document: documentId,
        outcome: "parsed",
        extractor: extractorIdentity,
      }),
      EventBody.cases.Chunked.make({ kind: "Chunked", document: documentId, chunks: [chunkId] }),
      EventBody.cases.Extracted.make({ kind: "Extracted", batch: batchId, model: hostedModel }),
      EventBody.cases.Asserted.make({ kind: "Asserted", claims: [claimId] }),
      EventBody.cases.Invalidated.make({ kind: "Invalidated", claim: claimId, reason: "superseded" }),
    ];
    A.forEach(eventBodies, (body) => roundTrip(EventBody, body));

    const structureFile = GoldFile.make({
      version: "gold/v1",
      paperId: paper1,
      subset: "structure",
      labels: [],
      proposer: proposerModel,
    });
    const entityFile = GoldFile.make({
      version: "gold/v1",
      paperId: paper1,
      subset: "entity",
      labels: [],
      proposer: proposerModel,
    });
    const relationFile = GoldFile.make({
      version: "gold/v1",
      paperId: paper1,
      subset: "relation",
      labels: [],
      proposer: proposerModel,
    });
    roundTripGoldFile(structureFile);
    roundTripGoldFile(entityFile);
    roundTripGoldFile(relationFile);
  });

  it("round-trips every typed error", () => {
    roundTrip(DocumentUnavailable, DocumentUnavailable.make({ message: "Document unavailable." }));
    roundTrip(ParserFailed, ParserFailed.make({ message: "Parser failed.", kind: "extraction-failed" }));
    roundTrip(
      AnchorRejected,
      AnchorRejected.make({
        message: "Anchor rejected.",
        cause: VerifiedTextAnchorError.fromReason("quote-mismatch"),
      })
    );
    roundTrip(
      ProviderUnavailable,
      ProviderUnavailable.make({ message: "Provider unavailable.", offline: true, cacheKey: providerCacheKey })
    );
    roundTrip(ProviderCacheCorrupt, ProviderCacheCorrupt.make({ message: "Cache corrupt." }));
    roundTrip(LedgerFailed, LedgerFailed.make({ message: "Ledger failed.", reason: "conflicting-row" }));
    roundTrip(GoldUnavailable, GoldUnavailable.make({ message: "Gold unavailable.", reason: "mixed-proposer" }));
    roundTrip(
      ModelRevisionUnpinned,
      ModelRevisionUnpinned.make({
        message: "Model revision is unpinned.",
        model: "grok-4",
        setting: "SEMANTICA_XAI_MODEL",
      })
    );
    roundTrip(ReportInvalid, ReportInvalid.make({ message: "Report invalid." }));
  });
});

describe("document and text refinements", () => {
  it("accepts matching byte identities and rejects a different sha256", () => {
    expect(S.is(SourceDocument)(sourceDocument)).toBe(true);
    expect(rejects(SourceDocument, { ...sourceDocument, sha256: sha("0") })).toBe(true);
  });

  it("accepts coherent fixture declarations and rejects mismatched degraded-kind presence", () => {
    expect(S.is(FixtureDeclaration)(parsingFixtureDeclaration)).toBe(true);
    expect(
      rejects(FixtureDeclaration, {
        expectation: "parses",
        degradedKind: "invalid-utf8",
      })
    ).toBe(true);
  });

  it("builds and verifies chunk content ids from the canonical encoded preimage", () => {
    expect(S.is(Chunk)(chunk)).toBe(true);
    expect(Result.isSuccess(chunkIdPreimage(chunk))).toBe(true);
    expect(Result.getOrThrow(makeChunkId(chunk))).toBe(chunk.id);
    expect(rejects(Chunk, { ...chunk, id: sha("0") })).toBe(true);
  });

  it("accepts matching chunk receipts and rejects another anchor or source document", () => {
    expect(rejects(Chunk, { ...chunk, receipt: otherReceipt })).toBe(true);
    const otherSource = SourceTextIdentity.make({ ...sourceIdentity, sourceRef: secondDocumentId });
    const otherSourceReceipt = TextAnchorVerificationReceipt.make({ anchor, source: otherSource });
    const otherSourceId = Result.getOrThrow(makeChunkId({ document: documentId, anchor, receipt: otherSourceReceipt }));
    expect(rejects(Chunk, { ...chunk, id: otherSourceId, receipt: otherSourceReceipt })).toBe(true);
  });

  it("accepts each claim-body width and rejects each inconsistent width", () => {
    expect([entityBody, relationBody, structureBody].every(S.is(ClaimBody))).toBe(true);
    expect(
      [
        { ...entityBody, endChar: 5 },
        { ...relationBody, endChar: 5 },
        { ...structureBody, endChar: 5 },
      ].every((body) => rejects(ClaimBody, body))
    ).toBe(true);
  });
});

describe("digest and provider-cache refinements", () => {
  it("keeps canonical digests stable across key insertion order and supports field omission", () =>
    Effect.runPromise(
      provideBunCrypto(
        Effect.gen(function* () {
          const Ordered = S.Struct({ a: S.Finite, b: S.Finite });
          const ReportShape = S.Struct({ a: S.Finite, digest: S.String });
          const left = yield* contentDigest(Ordered)({ a: 1, b: 2 });
          const right = yield* contentDigest(Ordered)({ b: 2, a: 1 });
          const omitted = yield* digestOmitting(ReportShape, "digest")({ a: 1, digest: "left" });
          const omittedOther = yield* digestOmitting(ReportShape, "digest")({ a: 1, digest: "right" });

          expect(left).toBe(right);
          expect(omitted).toBe(omittedOther);
          expect(Result.getOrThrow(contentDigestSync(Ordered)({ b: 2, a: 1 }))).toBe(left);
          expect(Result.getOrThrow(digestOmittingSync(ReportShape, "digest")({ a: 1, digest: "ignored" }))).toBe(
            omitted
          );
        })
      )
    ));

  it("accepts both cache digests and rejects either mismatched digest", () => {
    expect(S.is(ProviderCacheEntry)(providerEntry)).toBe(true);
    expect(rejects(ProviderCacheEntry, { ...providerEntry, cacheKey: sha("0") })).toBe(true);
    expect(rejects(ProviderCacheEntry, { ...providerEntry, responseDigest: sha("0") })).toBe(true);
  });
});

describe("evidence refinements", () => {
  it("builds and verifies claim ids from schema-encoded body and model preimages", () => {
    expect(S.is(EvidenceClaim)(evidenceClaim)).toBe(true);
    expect(Result.isSuccess(claimIdPreimage(evidenceClaim))).toBe(true);
    expect(Result.getOrThrow(makeClaimId(evidenceClaim))).toBe(evidenceClaim.id);
    expect(rejects(EvidenceClaim, { ...evidenceClaim, id: sha("0") })).toBe(true);
  });

  it("accepts a matching claim receipt and rejects a receipt for another anchor", () => {
    expect(rejects(EvidenceClaim, { ...evidenceClaim, receipt: otherReceipt })).toBe(true);
  });

  it("builds and verifies batch ids from the ordered input preimage", () => {
    expect(S.is(EvidenceBatch)(evidenceBatch)).toBe(true);
    expect(Result.isSuccess(batchIdPreimage(evidenceBatch))).toBe(true);
    expect(Result.getOrThrow(makeBatchId(evidenceBatch))).toBe(evidenceBatch.id);
    expect(rejects(EvidenceBatch, { ...evidenceBatch, id: sha("0") })).toBe(true);
  });

  it("binds every claim and degraded claim chunk to the batch inputs", () => {
    const unlistedClaimId = Result.getOrThrow(
      makeClaimId({
        document: documentId,
        chunk: unlistedChunkId,
        body: secondEntityBody,
        method: "hosted-langextract",
        model: hostedModel,
      })
    );
    const unlistedClaim = EvidenceClaim.make({
      ...secondEvidenceClaim,
      id: unlistedClaimId,
      chunk: unlistedChunkId,
    });

    expect(S.is(EvidenceBatch)(evidenceBatch)).toBe(true);
    expect(rejects(EvidenceBatch, { ...evidenceBatch, claims: [unlistedClaim] })).toBe(true);
    expect(
      rejects(EvidenceBatch, {
        ...evidenceBatch,
        degraded: [{ ...degradedClaim, chunk: unlistedChunkId }],
      })
    ).toBe(true);
  });

  it("requires every relation endpoint to identify a same-batch entity claim", () => {
    const externalBody = ClaimBody.cases.Entity.make({
      ...entityBody,
      label: "Schema",
      quote: "Effect",
    });
    const externalId = Result.getOrThrow(
      makeClaimId({
        document: documentId,
        chunk: chunkId,
        body: externalBody,
        method: "hosted-langextract",
        model: hostedModel,
      })
    );
    const unresolvedBody = ClaimBody.cases.Relation.make({ ...relationBody, object: externalId });
    const unresolvedId = Result.getOrThrow(
      makeClaimId({
        document: documentId,
        chunk: chunkId,
        body: unresolvedBody,
        method: "hosted-langextract",
        model: hostedModel,
      })
    );
    const unresolvedRelation = EvidenceClaim.make({ ...relationClaim, id: unresolvedId, body: unresolvedBody });

    expect(S.is(EvidenceBatch)(relationBatch)).toBe(true);
    expect(
      rejects(EvidenceBatch, {
        ...relationBatch,
        claims: [evidenceClaim, secondEvidenceClaim, unresolvedRelation],
      })
    ).toBe(true);
  });

  it("derives exact order-insensitive loss declarations from the extraction method", () => {
    const patternLosses = Option.getOrThrow(HashMap.get(declaredLosses, "pattern-wink"));
    expect(
      Equal.equals(
        patternLosses,
        HashSet.fromIterable<LossDeclarationValue>(["relations-not-supported", "structure-not-supported"])
      )
    ).toBe(true);

    const patternBatchId = Result.getOrThrow(
      makeBatchId({ document: documentId, method: "pattern-wink", model: patternModel, inputs: [chunkId] })
    );
    const patternBatch = EvidenceBatch.make({
      id: patternBatchId,
      document: documentId,
      method: "pattern-wink",
      model: patternModel,
      inputs: [chunkId],
      claims: [],
      degraded: [],
      lossy: ["structure-not-supported", "relations-not-supported"],
    });

    expect(S.is(EvidenceBatch)(patternBatch)).toBe(true);
    expect(rejects(EvidenceBatch, { ...patternBatch, lossy: ["relations-not-supported"] })).toBe(true);
    expect(rejects(EvidenceBatch, { ...evidenceBatch, lossy: ["relations-not-supported"] })).toBe(true);
  });

  it("accepts coherent unique claims and rejects duplicate ids or mismatched batch fields", () => {
    expect(S.is(EvidenceBatch)(evidenceBatch)).toBe(true);
    expect(rejects(EvidenceBatch, { ...evidenceBatch, claims: [evidenceClaim, evidenceClaim] })).toBe(true);
    expect(
      rejects(EvidenceBatch, {
        ...evidenceBatch,
        claims: [{ ...evidenceClaim, document: DocumentId.make(Str.repeat(64)("f")) }],
      })
    ).toBe(true);
    expect(
      rejects(EvidenceBatch, {
        ...evidenceBatch,
        claims: [{ ...evidenceClaim, method: "pattern-wink" }],
      })
    ).toBe(true);
    expect(
      rejects(EvidenceBatch, {
        ...evidenceBatch,
        claims: [{ ...evidenceClaim, model: patternModel }],
      })
    ).toBe(true);
  });

  it("requires conflict witnesses to use distinct ordered endpoints and their canonical digest", () => {
    expect(S.is(ConflictWitness)(conflictWitness)).toBe(true);
    expect(
      rejects(ConflictWitness, {
        id: canonicalDigest({ left: claimId, right: claimId, basis: conflictBasis }),
        left: claimId,
        right: claimId,
        basis: conflictBasis,
      })
    ).toBe(true);
    expect(
      rejects(ConflictWitness, {
        id: canonicalDigest({ left: conflictRight, right: conflictLeft, basis: conflictBasis }),
        left: conflictRight,
        right: conflictLeft,
        basis: conflictBasis,
      })
    ).toBe(true);
    expect(rejects(ConflictWitness, { ...conflictWitness, id: sha("0") })).toBe(true);
  });
});

describe("provenance refinements", () => {
  const body = EventBody.cases.Ingested.make({ kind: "Ingested", document: documentId });
  const preimage = S.Struct({ prev: S.OptionFromNullOr(ProvenanceEventId), body: EventBody });
  const prev = Option.none<ProvenanceEventIdValue>();
  const event = ProvenanceEvent.make({
    id: ProvenanceEventId.make(Result.getOrThrow(contentDigestSync(preimage)({ prev, body }))),
    prev,
    body,
  });

  it("accepts the timestamp-free hash-chain id and rejects a wrong id", () => {
    expect(S.is(ProvenanceEvent)(event)).toBe(true);
    expect(rejects(ProvenanceEvent, { ...event, id: acquired })).toBe(true);
    roundTrip(ProvenanceEvent, event);
    expect(Object.hasOwn(S.encodeSync(ProvenanceEvent)(event), "timestamp")).toBe(false);
  });
});

describe("gold refinements", () => {
  it("accepts exact 10/5/3 subsets and rejects smaller or larger protocol selections", () => {
    expect(S.is(GoldSubset)(goldSubset)).toBe(true);
    expect(
      rejects(GoldSubset, {
        structure: A.dropRight(goldPapers, 1),
        entity: A.take(goldPapers, 5),
        relation: A.take(goldPapers, 3),
      })
    ).toBe(true);
    const paper11 = CorpusPaperId.make("00000000000b");
    expect(
      rejects(GoldSubset, {
        structure: [...goldPapers, paper11],
        entity: A.take(goldPapers, 5),
        relation: A.take(goldPapers, 3),
      })
    ).toBe(true);
  });

  it("rejects duplicate ids and broken strict containment at the exact protocol sizes", () => {
    const paper4 = A.getUnsafe(goldPapers, 3);
    const paper11 = CorpusPaperId.make("00000000000b");
    expect(
      rejects(GoldSubset, {
        structure: [...A.dropRight(goldPapers, 1), paper1],
        entity: A.take(goldPapers, 5),
        relation: A.take(goldPapers, 3),
      })
    ).toBe(true);
    expect(
      rejects(GoldSubset, {
        structure: goldPapers,
        entity: [paper1, paper2, paper3, paper4, paper11],
        relation: [paper1, paper2, paper3],
      })
    ).toBe(true);
  });

  it("accepts gold-proposal identities and rejects extraction identities in refs and files", () => {
    expect(S.is(GoldRef)(goldRef)).toBe(true);
    expect(rejects(GoldRef, { ...goldRef, proposer: hostedModel })).toBe(true);
    expect(
      rejects(GoldFileEncoded, {
        version: "gold/v1",
        paperId: paper1,
        subset: "entity",
        labels: [],
        proposer: hostedModel,
      })
    ).toBe(true);
  });

  it("accepts anchored gold labels and rejects inconsistent widths in every label family", () => {
    const shared = {
      startChar: anchor.startChar,
      endChar: anchor.endChar,
      quote: anchor.quote,
      verified: true,
    };
    expect(rejects(GoldStructureLabel, { ...shared, role: "title", depth: NonNegativeInt.make(0) })).toBe(false);
    expect(
      rejects(GoldEntityLabel, { ...shared, cluster: "software-effect", label: "Effect", entityType: "software" })
    ).toBe(false);
    expect(
      rejects(GoldRelationLabel, {
        ...shared,
        object: "Schema",
        objectEndChar: anchor.endChar,
        objectStartChar: anchor.startChar,
        predicate: "uses",
        subject: "Effect",
        subjectEndChar: anchor.endChar,
        subjectStartChar: anchor.startChar,
      })
    ).toBe(false);
    expect(rejects(GoldStructureLabel, { ...shared, endChar: 5, role: "title", depth: 0 })).toBe(true);
    expect(
      rejects(GoldEntityLabel, {
        ...shared,
        cluster: "software-effect",
        endChar: 5,
        label: "Effect",
        entityType: "software",
      })
    ).toBe(true);
    expect(
      rejects(GoldRelationLabel, {
        ...shared,
        endChar: 5,
        objectEndChar: anchor.endChar,
        objectStartChar: anchor.startChar,
        predicate: "uses",
        subject: "Effect",
        subjectEndChar: anchor.endChar,
        subjectStartChar: anchor.startChar,
        object: "Schema",
      })
    ).toBe(true);
  });
});

describe("evaluation refinements", () => {
  const runWith = (overrides: Partial<typeof runBody>) => {
    const body = { ...runBody, ...overrides };
    return { id: RunId.make(Result.getOrThrow(contentDigestSync(EvalRunBodySchema)(body))), ...body };
  };

  it("accepts unique run selections and rejects duplicate W1 or F1 identities", () => {
    expect(S.is(EvalSelection)(runBody.selection)).toBe(true);
    expect(
      rejects(EvalSelection, {
        w1: [paper1, paper1],
        f1: [fixtureOrigin.fixtureId],
      })
    ).toBe(true);
    expect(
      rejects(EvalSelection, {
        w1: [paper1],
        f1: [fixtureOrigin.fixtureId, fixtureOrigin.fixtureId],
      })
    ).toBe(true);
  });

  it("accepts independent extraction and gold providers and rejects every EvalRun invariant", () => {
    expect(S.is(EvalRun)(evalRun)).toBe(true);
    const sameFamilyProposer = ModelIdentity.make({ ...proposerModel, provider: "anthropic" });
    const sameFamilyGold = GoldRef.make({ ...goldRef, proposer: sameFamilyProposer });
    expect(rejects(EvalRun, runWith({ gold: sameFamilyGold }))).toBe(true);

    const wrongTaskExtractor = ModelIdentity.make({ ...hostedModel, provider: "anthropic", taskType: "gold-proposal" });
    expect(rejects(EvalRun, runWith({ extractor: wrongTaskExtractor }))).toBe(true);

    const wrongPatternProvider = ModelIdentity.make({ ...patternModel, provider: "anthropic" });
    expect(rejects(EvalRun, runWith({ patternLane: wrongPatternProvider }))).toBe(true);

    const wrongPatternTask = ModelIdentity.make({ ...patternModel, taskType: "gold-proposal" });
    expect(rejects(EvalRun, runWith({ patternLane: wrongPatternTask }))).toBe(true);
    expect(rejects(EvalRun, { ...evalRun, id: RunId.make(Str.repeat(64)("0")) })).toBe(true);
  });

  it("requires support for scored metrics and allows zero support for unsupported relation metrics", () => {
    expect(S.is(MetricScore)(A.getUnsafe(metricScores, 0))).toBe(true);
    expect(
      rejects(MetricScore, {
        name: "entity-span-f1",
        subset: "entity",
        lane: "hosted",
        status: "scored",
        value: 0,
        support: 0,
      })
    ).toBe(true);
    expect(
      rejects(MetricScore, {
        name: "rebel-end-to-end-triple-f1",
        subset: "relation",
        lane: "pattern",
        status: "unsupported",
        value: 0,
        support: 0,
      })
    ).toBe(false);
    expect(
      rejects(MetricScore, {
        name: "rebel-end-to-end-triple-f1",
        subset: "relation",
        lane: "pattern",
        status: "unsupported",
        value: 0.5,
        support: 1,
      })
    ).toBe(true);
  });

  it("accepts unique exact document coverage and rejects duplicate ids, omissions, and extras", () => {
    const selection = EvalSelection.make({
      w1: [],
      f1: [fixtureOrigin.fixtureId, secondFixtureOrigin.fixtureId],
    });
    const run = EvalRun.make(runWith({ selection }));
    const secondOutcome = DocumentOutcome.make({
      ...documentOutcome,
      document: secondDocumentId,
      origin: secondFixtureOrigin,
    });
    const body: typeof EvalReportBodySchema.Type = {
      ...reportBody,
      run,
      documents: [documentOutcome, secondOutcome],
    };

    expect(rejects(EvalReport, withReportDigest(body))).toBe(false);
    expect(
      rejects(
        EvalReport,
        withReportDigest({
          ...body,
          documents: [documentOutcome, DocumentOutcome.make({ ...secondOutcome, document: documentId })],
        })
      )
    ).toBe(true);
    expect(rejects(EvalReport, withReportDigest({ ...body, documents: [documentOutcome] }))).toBe(true);
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, documents: [documentOutcome, secondOutcome] }))).toBe(
      true
    );
  });

  it("derives F1 degradation arithmetic from each document origin declaration", () => {
    const futureFixtureId = F1FixtureId.make("future-fixture");
    const futureOrigin = Origin.cases.Fixture.make({
      kind: "Fixture",
      fixtureId: futureFixtureId,
      relativePath: "documents/future-fixture.md",
      declared: FixtureDeclaration.make({ expectation: "parses", degradedKind: Option.none() }),
    });
    const selection = EvalSelection.make({ w1: [], f1: [futureFixtureId] });
    const run = EvalRun.make(runWith({ selection }));
    const futureOutcome = DocumentOutcome.make({
      ...documentOutcome,
      document: secondDocumentId,
      origin: futureOrigin,
    });
    const body: typeof EvalReportBodySchema.Type = { ...reportBody, run, documents: [futureOutcome] };

    expect(rejects(EvalReport, withReportDigest(body))).toBe(false);
    expect(
      rejects(
        EvalReport,
        withReportDigest({
          ...body,
          documents: [DocumentOutcome.make({ ...futureOutcome, parse: "truncated" })],
        })
      )
    ).toBe(true);
  });

  it("requires hosted relation claims for every selected relation-gold paper", () => {
    const selection = EvalSelection.make({ w1: [paper1], f1: [fixtureOrigin.fixtureId] });
    const run = EvalRun.make(runWith({ selection }));
    const relationOutcome = DocumentOutcome.make({
      ...documentOutcome,
      document: secondDocumentId,
      origin: w1Origin,
      claims: {
        ...documentOutcome.claims,
        hosted: { ...documentOutcome.claims.hosted, relation: NonNegativeInt.make(1) },
      },
    });
    const body: typeof EvalReportBodySchema.Type = {
      ...reportBody,
      run,
      documents: [relationOutcome, documentOutcome],
    };

    expect(rejects(EvalReport, withReportDigest(body))).toBe(false);
    expect(
      rejects(
        EvalReport,
        withReportDigest({
          ...body,
          documents: [
            DocumentOutcome.make({
              ...relationOutcome,
              claims: {
                ...relationOutcome.claims,
                hosted: { ...relationOutcome.claims.hosted, relation: NonNegativeInt.make(0) },
              },
            }),
            documentOutcome,
          ],
        })
      )
    ).toBe(true);
  });

  it("rejects missing or duplicate metric coordinates", () => {
    const missingMetrics = A.drop(metricScores, 1) as [MetricScore, ...Array<MetricScore>];
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, metrics: missingMetrics }))).toBe(true);

    const duplicateMetrics = Option.getOrThrow(
      A.replace(metricScores, A.length(metricScores) - 1, A.getUnsafe(metricScores, 0))
    ) as [MetricScore, ...Array<MetricScore>];
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, metrics: duplicateMetrics }))).toBe(true);
  });

  it("rejects unsupported hosted entries and unsupported undeclared pattern entries", () => {
    const hostedIndex = A.findFirstIndex(metricScores, (score) => score.lane === "hosted").pipe(Option.getOrThrow);
    const hostedUnsupported = Option.getOrThrow(
      A.replace(
        metricScores,
        hostedIndex,
        MetricScore.make({
          ...A.getUnsafe(metricScores, hostedIndex),
          status: "unsupported",
          value: UnitInterval.make(0),
          support: NonNegativeInt.make(0),
        })
      )
    ) as [MetricScore, ...Array<MetricScore>];
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, metrics: hostedUnsupported }))).toBe(true);

    const patternEntityIndex = A.findFirstIndex(
      metricScores,
      (score) => score.lane === "pattern" && score.subset === "entity"
    ).pipe(Option.getOrThrow);
    const undeclaredUnsupported = Option.getOrThrow(
      A.replace(
        metricScores,
        patternEntityIndex,
        MetricScore.make({
          ...A.getUnsafe(metricScores, patternEntityIndex),
          status: "unsupported",
          value: UnitInterval.make(0),
          support: NonNegativeInt.make(0),
        })
      )
    ) as [MetricScore, ...Array<MetricScore>];
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, metrics: undeclaredUnsupported }))).toBe(true);
  });

  it("rejects wrong degradation arithmetic, failed anchors, and a wrong report digest", () => {
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, unexpectedDegraded: NonNegativeInt.make(1) }))).toBe(
      true
    );

    const failedDocument = DocumentOutcome.make({ ...documentOutcome, anchorsFailed: NonNegativeInt.make(1) });
    expect(rejects(EvalReport, withReportDigest({ ...reportBody, documents: [failedDocument] }))).toBe(true);
    expect(rejects(EvalReport, { ...evalReport, reportDigest: sha("0") })).toBe(true);
  });
});

describe("F1 degraded-kind subset", () => {
  it("decodes every fixture degraded kind through the shared C0 DegradedKind", () => {
    expect(FixtureDegradedKind.Options).toEqual(["invalid-utf8", "truncated", "extraction-failed"]);
    expect(A.every(FixtureDegradedKind.Options, S.is(DegradedKind))).toBe(true);
  });
});
