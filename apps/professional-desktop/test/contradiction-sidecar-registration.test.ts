import { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification";
import { ContradictionHandlersLive, ContradictionTriageServiceLive } from "@beep/epistemic-server/layer";
import {
  ContradictionActionError,
  ContradictionListPayload,
  ContradictionReviewDecision,
  ContradictionRpcs,
  EvidenceSourceHighlight,
  EvidenceSourcePagePayload,
  EvidenceSourcePageSelector,
  ReviewContradictionCandidate,
} from "@beep/epistemic-use-cases/public";
import {
  ContradictionBeliefDetail,
  ContradictionCandidateExpandedDetail,
  ContradictionCandidatePage,
  ContradictionEvidenceDetail,
  ContradictionReviewConflict,
  ContradictionReviewer,
  ContradictionReviewScope,
  ContradictionTriageRepository,
} from "@beep/epistemic-use-cases/server";
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { NonNegativeInt } from "@beep/schema/Number";
import { PosixPath } from "@beep/schema/PosixPath";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { RpcTest } from "effect/rpc";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";
import type * as DateTime from "effect/DateTime";

const PosInt = S.Int.check(S.isGreaterThan(0));

const leftLogicalKey = Str.repeat(64)("a");
const rightLogicalKey = Str.repeat(64)("b");
const candidateKey = Str.repeat(64)("c");
const candidateDigest = Str.repeat(64)("d");
const evidenceDigest = Str.repeat(64)("e");
const proposalId = Str.repeat(64)("f");
const proposalDigest = Str.repeat(64)("1");
const manifestationKey = Str.repeat(64)("2");
const sourceDigest = SourceTextDigest.make(`sha256:${Str.repeat(64)("3")}`);
const instant = flow(S.decodeUnknownResult(S.DateTimeUtcFromMillis), Result.getOrThrow);
const decodeCandidate = flow(S.decodeUnknownResult(ContradictionCandidate), Result.getOrThrow);
const decodeEdgeVersion = flow(S.decodeUnknownResult(EdgeVersion), Result.getOrThrow);
const decodeEvidence = flow(S.decodeUnknownResult(Evidence), Result.getOrThrow);
const decodeVerification = flow(S.decodeUnknownResult(EvidenceVerification), Result.getOrThrow);
const encodeActionError = flow(S.encodeResult(S.toCodecJson(ContradictionActionError)), Result.getOrThrow);
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const cryptoLayerTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds";
const utf8Encoder = new TextEncoder();

const leftBeliefRef = {
  edgeVersionId: 1,
  logicalKey: leftLogicalKey,
  version: 1,
} as const;

const candidate = decodeCandidate({
  ...productEntityFixtureInput("EpistemicContradictionCandidate", 1),
  assessment: {
    confidence: 0.95,
    proposals: [
      {
        fact: { amount: "125" },
        losingBelief: leftBeliefRef,
        proposalDigest,
        proposalId,
        rationale: "The signed amendment controls.",
        validFrom: 1_000,
        validTo: null,
      },
    ],
  },
  candidateDigest,
  candidateKey,
  matchBasis: {
    detector: "fixture",
    detectorVersion: "0.0.0",
    evidenceDigest,
    kind: "independent-evidence",
    leftEvidenceIds: [1],
    rightEvidenceIds: [2],
  },
  pair: {
    left: leftBeliefRef,
    right: {
      edgeVersionId: 2,
      logicalKey: rightLogicalKey,
      version: 1,
    },
  },
  recordedAt: 2_000,
  validFrom: 1_000,
  validTo: null,
});

const makeBelief = (id: number, logicalKey: string) =>
  decodeEdgeVersion({
    ...productEntityFixtureInput("EpistemicEdgeVersion", id),
    evidenceScope: null,
    expiredAt: null,
    fact: { amount: id === 1 ? "100" : "150" },
    logicalKey,
    matterScope: null,
    qualifiers: {},
    recordedAt: 1_000,
    relation: "supports",
    sourceClaimId: null,
    sourceEntityRef: null,
    sourceEvidenceId: null,
    sourceKind: "observation",
    sourceObservationRef: `observation:source-${id}`,
    supersedesId: null,
    targetClaimId: null,
    targetEntityRef: null,
    targetEvidenceId: null,
    targetKind: "observation",
    targetObservationRef: `observation:target-${id}`,
    validFrom: 1_000,
    validTo: null,
    version: 1,
  });

const makeEvidence = (id: number) =>
  decodeEvidence({
    ...productEntityFixtureInput("EpistemicEvidence", id),
    artifactFixtureKey: `artifact:source-${id}`,
    span: {
      confidence: 0.95,
      endChar: 4,
      quote: "fact",
      startChar: 0,
    },
    spanFixtureKey: `span:source-${id}`,
  });

const leftBelief = makeBelief(1, leftLogicalKey);
const rightBelief = makeBelief(2, rightLogicalKey);
const leftEvidence = makeEvidence(1);
const rightEvidence = makeEvidence(2);

const makeSourceIdentity = Effect.fn("test.makeSourceIdentity")(function* (
  scopeRef: string,
  locator: string,
  sourceText: string
) {
  const digest = yield* decodeSha256HexFromBytes(Uint8Array.from(utf8Encoder.encode(sourceText)));
  return SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    locator: PosixPath.make(locator),
    normalizationVersion: "1",
    scopeRef,
    sourceDigest,
    sourceRef: "source:sensitive-fixture",
    textDigest: SourceTextDigest.make(`sha256:${digest}`),
  });
});

const makeExpanded = (verifiedAnchor: TextAnchorVerificationReceipt): ContradictionCandidateExpandedDetail => {
  const verification = decodeVerification({
    ...productEntityFixtureInput("EpistemicEvidenceVerification", 1),
    evidenceId: leftEvidence.id,
    manifestationKey,
    verifiedAnchor,
  });
  return ContradictionCandidateExpandedDetail.make({
    candidate,
    disposition: O.none(),
    left: ContradictionBeliefDetail.make({
      belief: leftBelief,
      evidence: [
        ContradictionEvidenceDetail.make({
          evidence: leftEvidence,
          latestVerification: O.some(verification),
        }),
      ],
    }),
    right: ContradictionBeliefDetail.make({
      belief: rightBelief,
      evidence: [
        ContradictionEvidenceDetail.make({
          evidence: rightEvidence,
          latestVerification: O.none(),
        }),
      ],
    }),
  });
};

type Captures = {
  expandedKnownAt?: DateTime.Utc;
  expandedOrgId?: number;
  expandedValidAt?: DateTime.Utc;
  listOrgId?: number;
  resolverCalls: number;
  reviewer?: ContradictionReviewer["Service"];
  reviewOrgId?: number;
};

const makeHandlersLayer = (expanded: ContradictionCandidateExpandedDetail, sourceText: string, captures: Captures) => {
  const repository = ContradictionTriageRepository.of({
    get: Effect.fn("test.ContradictionTriageRepository.get")(() => Effect.die("get is not used")),
    getExpanded: Effect.fn("test.ContradictionTriageRepository.getExpanded")((query) =>
      Effect.sync(() => {
        captures.expandedKnownAt = query.knownAt;
        captures.expandedOrgId = query.orgId;
        captures.expandedValidAt = query.validAt;
        return O.some(expanded);
      })
    ),
    list: Effect.fn("test.ContradictionTriageRepository.list")((query) =>
      Effect.sync(() => {
        captures.listOrgId = query.orgId;
        return ContradictionCandidatePage.make({
          items: [],
          total: NonNegativeInt.make(0),
        });
      })
    ),
    review: Effect.fn("test.ContradictionTriageRepository.review")(function* (command, reviewer, scope) {
      captures.reviewer = reviewer;
      captures.reviewOrgId = scope.orgId;
      return yield* ContradictionReviewConflict.make({
        candidateId: command.candidateId,
        reason: "already-resolved",
      });
    }),
    submit: Effect.fn("test.ContradictionTriageRepository.submit")(() => Effect.die("submit is not used")),
  });
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("test.SourceTextResolver.resolve")((request) =>
      Effect.sync(() => {
        captures.resolverCalls += 1;
        return ResolvedSourceText.make({
          identity: request.identity,
          text: sourceText,
        });
      })
    ),
  });
  const reviewer = UserPrincipal.make({ userId: SharedIdentity.UserId.make(1) });
  const scope = ContradictionReviewScope.of({
    orgId: SharedIdentity.OrganizationId.make(1),
    sourceScopeRef: "workspace:1",
  });
  const service = ContradictionTriageServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ContradictionReviewer, ContradictionReviewer.of(reviewer)),
        Layer.succeed(ContradictionReviewScope, scope),
        Layer.succeed(ContradictionTriageRepository, repository),
        Layer.succeed(SourceTextResolver, resolver)
      )
    )
  );
  return ContradictionHandlersLive.pipe(Layer.provide(service));
};

const sourcePayload = (selector: EvidenceSourcePageSelector) =>
  EvidenceSourcePagePayload.make({
    candidateId: candidate.id,
    evidenceId: leftEvidence.id,
    knownAt: instant(2_000),
    selector,
    validAt: instant(2_000),
  });

const makeRegistrationFixture = Effect.fn("test.makeRegistrationFixture")(function* (
  sourceText: string,
  anchor: TextAnchor,
  locator: string,
  workspace: string
) {
  const identity = yield* makeSourceIdentity(workspace, locator, sourceText);
  const verifiedAnchor = TextAnchorVerificationReceipt.make({ anchor, source: identity });
  const captures: Captures = { resolverCalls: 0 };
  return {
    identity,
    verifiedAnchor,
    captures,
    handlers: makeHandlersLayer(makeExpanded(verifiedAnchor), sourceText, captures),
  };
});

class RegistrationFixture extends Context.Service<
  RegistrationFixture,
  Effect.Success<ReturnType<typeof makeRegistrationFixture>>
>()("@beep/professional-desktop/test/contradiction-sidecar-registration.test/RegistrationFixture") {}

const registrationLayer = (sourceText: string, anchor: TextAnchor, locator: string, workspace: string) =>
  Layer.unwrap(
    Effect.map(makeRegistrationFixture(sourceText, anchor, locator, workspace), (fixture) =>
      Layer.merge(fixture.handlers, Layer.succeed(RegistrationFixture, fixture))
    )
  ).pipe(Layer.provide(BunCrypto.layer));

const sourceError = Effect.fn("test.source_error")(function* () {
  const { captures, identity } = yield* RegistrationFixture;
  const client = yield* RpcTest.makeClient(ContradictionRpcs);
  const error = yield* Effect.flip(
    client.GetEvidenceSourcePage(sourcePayload(EvidenceSourcePageSelector.cases.anchor.make({})))
  );
  return { captures, error, identity };
});

describe("@beep/professional-desktop contradiction sidecar registration", () => {
  it.layer(
    registrationLayer(
      `${Str.repeat(65_535)("a")}😀fact`,
      TextAnchor.make({ endChar: NonNegativeInt.make(65_541), quote: "fact", startChar: NonNegativeInt.make(65_537) }),
      "private/surrogate-source.txt",
      "workspace:1"
    ),
    { timeout: cryptoLayerTimeout }
  )("derives trusted scopes and opens the authoritative surrogate-safe anchor page", (it) => {
    it.effect(
      "derives trusted scopes and opens the authoritative surrogate-safe anchor page",
      Effect.fnUntraced(function* () {
        const { verifiedAnchor, captures } = yield* RegistrationFixture;
        const client = yield* RpcTest.makeClient(ContradictionRpcs);
        const list = yield* client.ListContradictionCandidates(
          ContradictionListPayload.make({
            disposition: "open",
            knownAt: instant(2_000),
            limit: PosInt.make(20),
            offset: NonNegativeInt.make(0),
            validAt: instant(2_000),
          })
        );
        const detail = yield* client.GetContradictionCandidate({
          candidateId: candidate.id,
          knownAt: instant(2_000),
          validAt: instant(2_000),
        });
        const reviewError = yield* Effect.flip(
          client.ReviewContradictionCandidate(
            ReviewContradictionCandidate.make({
              candidateId: candidate.id,
              decision: ContradictionReviewDecision.cases.reject.make({
                reason: "The beliefs describe different obligations.",
              }),
              expectedCandidateVersion: PosInt.make(1),
            })
          )
        );
        const page = yield* client.GetEvidenceSourcePage(
          sourcePayload(EvidenceSourcePageSelector.cases.anchor.make({}))
        );
        const result = { detail, list, page, reviewError };

        expect(result.list.total).toBe(0);
        expect(captures.listOrgId).toBe(1);
        expect(captures.expandedKnownAt).toStrictEqual(instant(2_000));
        expect(captures.expandedOrgId).toBe(1);
        expect(captures.expandedValidAt).toStrictEqual(instant(2_000));
        expect(captures.reviewOrgId).toBe(1);
        expect(captures.reviewer).toMatchObject({ kind: "User", userId: 1 });
        expect(result.reviewError).toMatchObject({
          _tag: "ContradictionActionError",
          reason: "candidate-already-resolved",
        });
        assertSome<string>(
          pipe(
            A.head(result.detail.left.evidence),
            O.flatMap((evidence) => evidence.verifiedAnchor),
            O.map((anchor) => anchor.anchor.quote)
          ),
          "fact"
        );
        expect(result.page.page.pageIndex).toBe(1);
        expect(result.page.page.startOffset).toBe(65_535);
        expect(result.page.highlight).toStrictEqual(
          EvidenceSourceHighlight.make({
            endChar: verifiedAnchor.anchor.endChar,
            source: verifiedAnchor.source,
            startChar: verifiedAnchor.anchor.startChar,
          })
        );
        expect(captures.resolverCalls).toBe(1);
      })
    );
  });

  it.layer(
    registrationLayer(
      `${Str.repeat(65_534)("a")}WXYZ`,
      TextAnchor.make({ endChar: NonNegativeInt.make(65_538), quote: "WXYZ", startChar: NonNegativeInt.make(65_534) }),
      "private/cross-page-source.txt",
      "workspace:1"
    ),
    { timeout: cryptoLayerTimeout }
  )("allows a valid anchor to continue across adjacent source pages", (it) => {
    it.effect(
      "allows a valid anchor to continue across adjacent source pages",
      Effect.fnUntraced(function* () {
        const client = yield* RpcTest.makeClient(ContradictionRpcs);
        const page = yield* client.GetEvidenceSourcePage(
          sourcePayload(EvidenceSourcePageSelector.cases.anchor.make({}))
        );

        expect(page.page.pageIndex).toBe(0);
        expect(page.page.endOffset).toBe(65_536);
        expect(page.highlight.endChar).toBeGreaterThan(page.page.endOffset);
      })
    );
  });

  it.layer(
    registrationLayer(
      "fact",
      TextAnchor.make({ endChar: NonNegativeInt.make(4), quote: "leak", startChar: NonNegativeInt.make(0) }),
      "private/quote-leak.txt",
      "workspace:1"
    ),
    { timeout: cryptoLayerTimeout }
  )("rejects a persisted quote mismatch without leaking source detail", (it) => {
    it.effect(
      "rejects a persisted quote mismatch without leaking source detail",
      Effect.fnUntraced(function* () {
        const result = yield* sourceError();
        const encoded = encodeActionError(result.error);

        expect(result.error).toMatchObject({ reason: "source-stale" });
        expect(encoded).not.toContain("private/quote-leak.txt");
        expect(encoded).not.toContain("leak");
        expect(encoded).not.toContain(sourceDigest);
      })
    );
  });

  it.layer(
    registrationLayer(
      "short",
      TextAnchor.make({ endChar: NonNegativeInt.make(110), quote: "range-leak", startChar: NonNegativeInt.make(100) }),
      "private/range-leak.txt",
      "workspace:1"
    ),
    { timeout: cryptoLayerTimeout }
  )("rejects an out-of-range persisted anchor without leaking source detail", (it) => {
    it.effect(
      "rejects an out-of-range persisted anchor without leaking source detail",
      Effect.fnUntraced(function* () {
        const result = yield* sourceError();
        const encoded = encodeActionError(result.error);

        expect(result.error).toMatchObject({ reason: "source-stale" });
        expect(encoded).not.toContain("private/range-leak.txt");
        expect(encoded).not.toContain("range-leak");
        expect(encoded).not.toContain(result.identity.textDigest);
      })
    );
  });

  it.layer(
    registrationLayer(
      "A😀B",
      TextAnchor.make({
        endChar: NonNegativeInt.make(3),
        quote: Str.slice(2, 3)("A😀B"),
        startChar: NonNegativeInt.make(2),
      }),
      "private/surrogate-leak.txt",
      "workspace:1"
    ),
    { timeout: cryptoLayerTimeout }
  )("rejects a persisted anchor that splits a UTF-16 surrogate pair", (it) => {
    it.effect(
      "rejects a persisted anchor that splits a UTF-16 surrogate pair",
      Effect.fnUntraced(function* () {
        const result = yield* sourceError();

        expect(result.error).toMatchObject({ reason: "source-stale" });
        expect(encodeActionError(result.error)).not.toContain("private/surrogate-leak.txt");
      })
    );
  });

  it.layer(
    registrationLayer(
      "fact",
      TextAnchor.make({ endChar: NonNegativeInt.make(4), quote: "fact", startChar: NonNegativeInt.make(0) }),
      "private/foreign-workspace.txt",
      "workspace:2"
    ),
    { timeout: cryptoLayerTimeout }
  )("denies a persisted anchor from another workspace before resolver use", (it) => {
    it.effect(
      "denies a persisted anchor from another workspace before resolver use",
      Effect.fnUntraced(function* () {
        const { captures } = yield* RegistrationFixture;
        const client = yield* RpcTest.makeClient(ContradictionRpcs);
        const error = yield* Effect.flip(
          client.GetEvidenceSourcePage(sourcePayload(EvidenceSourcePageSelector.cases.anchor.make({})))
        );

        expect(error).toMatchObject({ reason: "source-access-denied" });
        expect(captures.resolverCalls).toBe(0);
        expect(encodeActionError(error)).not.toContain("private/foreign-workspace.txt");
      })
    );
  });
});
