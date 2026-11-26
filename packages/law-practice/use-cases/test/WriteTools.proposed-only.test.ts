import { ExtractionDocument } from "@beep/annotation/Kinds";
import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { AnswerRow, VerdictRow } from "@beep/law-practice-domain";
import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  DistinctionProposition,
  LawHumanAdmissionToken,
  LawProposedClaimRecord,
} from "@beep/law-practice-domain/values/LawClaim";
import {
  ClaimProposal,
  ClaimProposalLayer,
  ClaimProposalRequest,
  ClaimProposeFailure,
  ClaimProposeTool,
  LawClaimToolkit,
  LawClaimToolkitLayer,
} from "@beep/law-practice-use-cases/ClaimProposal";
import { LawClaimProposals } from "@beep/law-practice-use-cases/ClaimStore";
import { requiredExtraction } from "@beep/law-practice-use-cases/IrToLaw";
import { LawPrincipal, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import { OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import {
  ClaimProvenance,
  ClaimProvenanceMissing,
  ProvenanceResult,
  ProvenanceTraversal,
} from "@beep/law-practice-use-cases/ProvenanceTraversal";
import { RecordVerdictInput } from "@beep/law-practice-use-cases/ReviewQueue";
import {
  ApplicationLookupParams,
  BudgetParams,
  CandidateClaimsParams,
  ClaimInspectionTool,
  ClaimSelfCheck,
  ClaimSelfCheckReviewRequest,
  ClaimSelfCheckReviewResult,
  ClaimSelfCheckTool,
  CorpusGetDocumentTool,
  CorpusSearchTextTool,
  CorrespondentLookupParams,
  DocketFamilyParams,
  EmailSearchParams,
  EmailSearchTool,
  FindParams,
  GetDocumentParams,
  KgApplicationLookupTool,
  KgCandidateClaimsTool,
  KgClientsTool,
  KgCorrespondentLookupTool,
  KgDocketFamilyTool,
  KgFindTool,
  KgMatterLookupTool,
  KgProvenanceTool,
  MatterLookupParams,
  PracticeKgCandidateClaimsNotLoadedResult,
  PracticeKgCandidateClaimsResult,
  PracticeKgCandidateClaimToolRow,
  PracticeKgToolkit,
  PracticeKgToolResult,
  ProvenanceParams,
  ReviewHub,
  SearchTextParams,
} from "@beep/law-practice-use-cases/server";
import { sanitizedToolkit } from "@beep/mcp-kit/SanitizedSpan";
import { fromApprovedToolsPolicy, TierGate, TierGatePolicy } from "@beep/mcp-kit/TierGate";
import { connectHttp, layerConformanceHttp } from "@beep/mcp-kit/test/Conformance";
import { ActivityId } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { mintCaptureId } from "@beep/text/Capture";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { modelOutput, text } from "./fixtures/office-action-review/fixture.ts";
import {
  authorityStaffing,
  fixturePrincipal,
  fixtureRevision,
  issueToken,
  makeLayer,
  makeMemoryClaimStore,
  resolverReturning,
  reviewScenario,
  unstaffedPrincipal,
} from "./fixtures/office-action-review/support.ts";
import type { LawClaimAdmissions, LawClaimProposalsShape } from "@beep/law-practice-use-cases/ClaimStore";
import type { AttorneyAttestation, LawAdmission } from "@beep/law-practice-use-cases/LawAdmission";
import type { ContentHash } from "@beep/schema/ContentHash";

const ProposeClaimTerm = TermIri.make(iri("operation:ProposeClaim"));

const gateApproving = (approvedTools: TierGatePolicy["approvedTools"]) =>
  TierGate.of(fromApprovedToolsPolicy(TierGatePolicy.make({ approvedTools })));

const strictDecode = { onExcessProperty: "error" } as const;

const encodeRequest = S.encodeEffect(S.toCodecJson(ClaimProposalRequest));

const decodeStoredProvenance = S.decodeUnknownEffect(S.toType(ClaimProvenance));

const SmuggledRequest = S.Struct({ ...ClaimProposalRequest.fields, token: LawHumanAdmissionToken });

const encodeSmuggled = S.encodeEffect(S.toCodecJson(SmuggledRequest));

const encodeRecord = S.encodeEffect(LawProposedClaimRecord);

const decodeRecord = S.decodeUnknownEffect(S.toType(LawProposedClaimRecord));

const proposedOf = Effect.fn("WriteTools.proposedOf")(function* (result: {
  readonly isFailure: boolean;
  readonly result: unknown;
}) {
  expect(result.isFailure).toBe(false);
  return yield* decodeRecord(result.result);
});

const sortedIds = (ids: Iterable<ContentHash>): ReadonlyArray<string> => A.sort(A.fromIterable(ids), Order.String);

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

const stringsUnder = (value: unknown): ReadonlyArray<string> =>
  P.isString(value)
    ? [value]
    : A.isArray(value)
      ? A.flatMap(value, stringsUnder)
      : P.isObject(value)
        ? A.flatMap(R.values(value as R.ReadonlyRecord<string, unknown>), stringsUnder)
        : [];

const stanceSchemasUnder = (value: unknown): ReadonlyArray<unknown> =>
  A.isArray(value)
    ? A.flatMap(value, stanceSchemasUnder)
    : P.isObject(value)
      ? pipe(
          R.toEntries(value as R.ReadonlyRecord<string, unknown>),
          A.flatMap(([key, nested]) =>
            key === "stance" ? [nested, ...stanceSchemasUnder(nested)] : stanceSchemasUnder(nested)
          )
        )
      : [];

const writeTools = pipe(
  [...R.values(ReviewHub.ReviewHubToolkit.tools), ...R.values(LawClaimToolkit.tools)],
  A.filter((tool: Tool.Any) => Context.get(tool.annotations, Tool.Readonly) !== true)
);

const storedTraversal = (proposals: LawClaimProposalsShape) =>
  ProvenanceTraversal.of({
    fromClaim: Effect.fn("WriteTools.fromClaim")(function* (claim) {
      const stored = yield* proposals.get(claim);
      const activities = yield* proposals.activities(claim);
      return O.match(stored, {
        onNone: () => ProvenanceResult.cases.Missing.make({}),
        onSome: () =>
          ProvenanceResult.cases.Found.make({
            provenance: ClaimProvenance.make({ claim, activities, captures: HashSet.empty(), admissions: [] }),
          }),
      });
    }, Effect.orDie),
  });

const proposalScenario = Effect.fn("WriteTools.proposalScenario")(function* (options: {
  readonly principal: typeof fixturePrincipal;
  readonly current: string;
  readonly gate: ReadonlyArray<string>;
}) {
  const base = yield* reviewScenario({ principal: fixturePrincipal, current: text });
  const reviewedA = yield* base.review.review(base.input);
  const handoffA = base.handoff();
  const reviewedB = yield* base.review.review(
    OfficeActionReviewInput.make({ ...base.input, matterFixtureKey: "matter.b" })
  );
  const handoffB = base.handoff();
  const supportA = yield* requiredExtraction(handoffA, "distinction");
  const supportB = yield* requiredExtraction(handoffB, "distinction");
  const store = yield* makeMemoryClaimStore();
  const digest = yield* Digest.Digest;
  const services = Layer.mergeAll(
    Layer.succeed(LawPrincipal, { principal: options.principal }),
    Layer.succeed(MatterAuthority, authorityStaffing(fixturePrincipal)),
    Layer.succeed(LawClaimProposals, store.proposals),
    Layer.succeed(SourceTextResolver, resolverReturning(options.current)),
    Layer.succeed(Digest.Digest, digest)
  );
  const proposalLayer = ClaimProposalLayer.pipe(Layer.provide(services));
  const handlers = LawClaimToolkitLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        proposalLayer,
        Layer.succeed(TierGate, gateApproving(options.gate)),
        Layer.succeed(ProvenanceTraversal, storedTraversal(store.proposals))
      )
    )
  );
  const built = yield* Layer.build(handlers);
  const toolkit = yield* Effect.provideContext(LawClaimToolkit, built);
  const requestA = ClaimProposalRequest.make({
    document: handoffA.document,
    proposition: reviewedA.proposed.core.proposition,
    candidates: HashSet.make(supportA.id),
  });
  const requestB = ClaimProposalRequest.make({
    document: handoffB.document,
    proposition: reviewedB.proposed.core.proposition,
    candidates: HashSet.make(supportB.id),
  });
  const otherClaimA = ClaimProposalRequest.make({
    ...requestA,
    proposition: DistinctionProposition.make({
      ...requestA.proposition,
      claimNumber: requestA.proposition.claimNumber + 1,
    }),
  });
  const call = (params: S.Json) =>
    toolkit
      .handle("claim_propose", params, undefined, strictDecode)
      .pipe(Stream.unwrap, Stream.run(Sink.last()), Effect.flatMap(Effect.fromOption));
  const propose = Effect.fn("WriteTools.propose")(function* (request: ClaimProposalRequest) {
    const encoded = yield* encodeRequest(request);
    return yield* call(encoded);
  });
  const proposeRecord = Effect.fn("WriteTools.proposeRecord")(function* (request: ClaimProposalRequest) {
    const result = yield* propose(request);
    return yield* proposedOf(result);
  });
  const provenance = (claim: string) =>
    toolkit
      .handle("claim_provenance", { claim }, undefined, strictDecode)
      .pipe(Stream.unwrap, Stream.run(Sink.last()), Effect.flatMap(Effect.fromOption));
  return { call, otherClaimA, propose, proposeRecord, provenance, requestA, requestB, store, supportA, supportB };
});

describe("write tools emit proposed records only", () => {
  it("write tools emit proposed records only: (a) no write tool's success schema carries an admission", () => {
    expect(A.map(writeTools, (tool) => tool.name)).toEqual([
      "review_record_verdict",
      "review_lock_batch",
      "review_record_answer",
      "claim_propose",
    ]);
    for (const tool of writeTools) {
      const document = S.toJsonSchemaDocument(tool.successSchema);
      const stances = A.flatMap(stanceSchemasUnder(document), stringsUnder);
      expect(A.contains(stances, "admitted")).toBe(false);
      expect(A.filter(R.keys(document.definitions), (name) => /Admission$|HumanAdmissionToken/.test(name))).toEqual([]);
    }
  });

  it("write tools emit proposed records only: (b) the proposal and handler layers require no admission port", () => {
    type Forbidden = LawAdmission | LawClaimAdmissions | AttorneyAttestation;
    expectTypeOf<Extract<Layer.Services<typeof ClaimProposalLayer>, Forbidden>>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Layer.Services<typeof LawClaimToolkitLayer>, Forbidden>>().toEqualTypeOf<never>();
    expectTypeOf<Layer.Services<typeof LawClaimToolkitLayer>>().toEqualTypeOf<
      TierGate | ClaimProposal | ProvenanceTraversal
    >();
  });

  it.layer(makeLayer(modelOutput), { timeout: "20 seconds" })("dispatch", (it) => {
    it.effect("write tools emit proposed records only: (a) an admitted record fails the proposed schema", () =>
      Effect.gen(function* () {
        const scenario = yield* proposalScenario({
          principal: fixturePrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        const record = yield* scenario.proposeRecord(scenario.requestA);
        const encoded = yield* encodeRecord(record);
        const admitted = S.decodeUnknownExit(LawProposedClaimRecord)({ ...encoded, stance: "admitted" });
        expect(admitted._tag).toBe("Failure");
      })
    );

    it.effect(
      "write tools emit proposed records only: (b) a smuggled admission token is refused by strict decode",
      () =>
        Effect.gen(function* () {
          const scenario = yield* proposalScenario({
            principal: fixturePrincipal,
            current: text,
            gate: ["claim_propose"],
          });
          expect(Tool.getStrictMode(ClaimProposeTool)).toBe(true);
          const encoded = yield* encodeRequest(scenario.requestA);
          const token = issueToken({ revision: fixtureRevision, scope: scenario.requestA.document.text.scopeRef });
          const smuggled = yield* encodeSmuggled({ ...scenario.requestA, token });
          const refused = yield* scenario.call(smuggled);
          expect(refused).toMatchObject({ isFailure: true, failureOrigin: "parameters" });
          const stored = yield* scenario.store.stored;
          expect(stored).toEqual([]);
          const acceptedResult = yield* scenario.call(encoded);
          const accepted = yield* proposedOf(acceptedResult);
          expect(accepted.stance).toBe("proposed");
        })
    );

    it.effect("write tools emit proposed records only: (c) unverified support and a denied scope store nothing", () =>
      Effect.gen(function* () {
        const drifted = yield* proposalScenario({
          principal: fixturePrincipal,
          current: `${text} amended`,
          gate: ["claim_propose"],
        });
        const unverified = yield* drifted.propose(drifted.requestA);
        expect(unverified).toMatchObject({
          isFailure: true,
          result: { _tag: "SupportUnverified", reason: "invalid-creation-support" },
        });
        const driftedStored = yield* drifted.store.stored;
        expect(driftedStored).toEqual([]);
        const denied = yield* proposalScenario({
          principal: unstaffedPrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        const refused = yield* denied.propose(denied.requestA);
        expect(refused).toMatchObject({ isFailure: true, result: { _tag: "DeniedScope" } });
        const deniedStored = yield* denied.store.stored;
        expect(deniedStored).toEqual([]);
      })
    );

    it.effect(
      "write tools emit proposed records only: (c) a forged document and an absent candidate store nothing",
      () =>
        Effect.gen(function* () {
          const scenario = yield* proposalScenario({
            principal: fixturePrincipal,
            current: text,
            gate: ["claim_propose"],
          });
          const document = scenario.requestA.document;
          const mentions = pipe(
            HashMap.toEntries(document.annotations),
            A.filter(([, annotation]) => annotation._tag === "Mention")
          );
          const [firstKey, firstAnnotation] = O.getOrThrow(A.get(mentions, 0));
          const [secondKey, secondAnnotation] = O.getOrThrow(A.get(mentions, 1));
          const swapped = pipe(
            document.annotations,
            HashMap.set(firstKey, secondAnnotation),
            HashMap.set(secondKey, firstAnnotation)
          );
          const forged = ExtractionDocument.make({ ...document, annotations: swapped });
          const invalid = yield* scenario.propose(
            ClaimProposalRequest.make({ ...scenario.requestA, document: forged })
          );
          const absent = yield* scenario.propose(
            ClaimProposalRequest.make({ ...scenario.requestA, candidates: HashSet.make(scenario.supportB.id) })
          );
          const stored = yield* scenario.store.stored;
          expect(invalid).toMatchObject({ isFailure: true, result: { _tag: "InvalidDocument" } });
          expect(absent).toMatchObject({
            isFailure: true,
            result: { _tag: "SupportUnverified", reason: "invalid-creation-support" },
          });
          expect(stored).toEqual([]);
        })
    );

    it.effect("write tools emit proposed records only: (c) a successful proposal writes no admission or binding", () =>
      Effect.gen(function* () {
        const scenario = yield* proposalScenario({
          principal: fixturePrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        yield* scenario.proposeRecord(scenario.requestA);
        const stored = yield* scenario.store.stored;
        const admitted = yield* scenario.store.admitted;
        const opened = yield* scenario.store.opened;
        expect(A.length(stored)).toBe(1);
        expect(admitted).toEqual([]);
        expect(opened).toEqual([]);
      })
    );

    it.effect("write tools emit proposed records only: (d) the gate refuses claim_propose without an approval", () =>
      Effect.gen(function* () {
        expect(Context.get(ClaimProposeTool.annotations, Tool.Readonly)).toBe(false);
        expect(Context.get(ClaimProposeTool.annotations, Tool.Destructive)).toBe(false);
        expect(Context.get(ClaimProposeTool.annotations, Tool.Idempotent)).toBe(true);
        const scenario = yield* proposalScenario({ principal: fixturePrincipal, current: text, gate: [] });
        const refused = yield* scenario.propose(scenario.requestA);
        const stored = yield* scenario.store.stored;
        expect(refused).toMatchObject({ isFailure: true, result: { _tag: "TierGateRefused" } });
        expect(stored).toEqual([]);
      })
    );

    it.effect(
      "write tools emit proposed records only: (d) two identical dispatches return one claim and one activity",
      () =>
        Effect.gen(function* () {
          const scenario = yield* proposalScenario({
            principal: fixturePrincipal,
            current: text,
            gate: ["claim_propose"],
          });
          const first = yield* scenario.proposeRecord(scenario.requestA);
          const second = yield* scenario.proposeRecord(scenario.requestA);
          expect(second.claim).toBe(first.claim);
          const stored = yield* scenario.store.stored;
          expect(A.length(stored)).toBe(1);
          expect(A.map(stored, (entry) => HashSet.size(entry.activities))).toEqual([1]);
        })
    );

    it.effect("write tools emit proposed records only: (f) concurrent and clock-stepped proposals all append", () =>
      Effect.gen(function* () {
        const scenario = yield* proposalScenario({
          principal: fixturePrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        const both = yield* Effect.all([scenario.propose(scenario.requestA), scenario.propose(scenario.otherClaimA)], {
          concurrency: 2,
        }).pipe(Effect.provideService(Clock.Clock, backwardClock([9_000, 2_000, 8_000, 1_000])));
        expect(A.map(both, (result) => result.isFailure)).toEqual([false, false]);
        const third = DistinctionProposition.make({
          ...scenario.requestA.proposition,
          claimNumber: scenario.requestA.proposition.claimNumber + 2,
        });
        const stepped = yield* scenario
          .propose(ClaimProposalRequest.make({ ...scenario.requestA, proposition: third }))
          .pipe(Effect.provideService(Clock.Clock, backwardClock([1_000])));
        const steppedRecord = yield* proposedOf(stepped);
        const inA = yield* scenario.store.stored;
        expect(A.length(inA)).toBe(3);
        const recordB = yield* scenario.proposeRecord(scenario.requestB);
        const afterB = yield* scenario.store.stored;
        const scopeA = scenario.requestA.document.text.scopeRef;
        expect(A.filter(afterB, (entry) => Eq.equals(entry.record.core.scope, scopeA))).toEqual(inA);
        expect(recordB.core.scope).not.toBe(scopeA);
        const earlier = A.filter(inA, (entry) => !Eq.equals(entry.record.claim, steppedRecord.claim));
        expect(
          A.every(earlier, (entry) =>
            DateTime.isGreaterThanOrEqualTo(steppedRecord.core.knowledgeStart, entry.record.core.knowledgeStart)
          )
        ).toBe(true);
        expect(DateTime.toEpochMillis(steppedRecord.core.knowledgeStart)).toBeGreaterThan(1_000);
      })
    );

    it.effect("claim_provenance reads a stored claim and answers Missing for an absent one", () =>
      Effect.gen(function* () {
        const scenario = yield* proposalScenario({
          principal: fixturePrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        const record = yield* scenario.proposeRecord(scenario.requestA);
        const found = yield* scenario.provenance(record.claim);
        const absent = yield* scenario.provenance(`sha256:${Str.repeat(64)("0")}`);
        const foundClaim = S.is(ClaimProvenance)(found.result) ? O.some(found.result.claim) : O.none();
        expect(found.isFailure).toBe(false);
        assertSome(foundClaim, record.claim);
        const stored = yield* decodeStoredProvenance(found.result);
        const earliest = ActivityId.make(`sha256:${Str.repeat(64)("0")}`);
        const provenance = ClaimProvenance.make({
          ...stored,
          activities: HashSet.fromIterable(
            A.flatMap(A.fromIterable(stored.activities), (activity) => [
              activity,
              ActivityRecord.make({ ...activity, id: earliest }),
            ])
          ),
        });
        const encoded = yield* S.encodeEffect(ClaimProvenance)(provenance);
        const decoded = yield* S.decodeEffect(ClaimProvenance)(encoded);
        expect(A.map(encoded.activities, (activity) => activity.id)).toEqual(
          A.sort(
            A.map(encoded.activities, (activity) => activity.id),
            Order.String
          )
        );
        assertSome(A.head(encoded.activities).pipe(O.map((activity) => activity.id)), earliest);
        expect(HashSet.size(decoded.activities)).toBe(HashSet.size(provenance.activities));
        expect(absent.isFailure).toBe(true);
        expect(S.is(ClaimProvenanceMissing)(absent.result)).toBe(true);
      })
    );

    it.effect("write tools emit proposed records only: (g) the ProposeClaim descriptor generates the claim id", () =>
      Effect.gen(function* () {
        const scenario = yield* proposalScenario({
          principal: fixturePrincipal,
          current: text,
          gate: ["claim_propose"],
        });
        const record = yield* scenario.proposeRecord(scenario.requestA);
        const [entry] = yield* scenario.store.stored;
        const activities = A.fromIterable(entry?.activities ?? HashSet.empty());
        expect(A.map(activities, (activity) => activity.start.operation)).toEqual([ProposeClaimTerm]);
        const [activity] = activities;
        const capture = yield* mintCaptureId(scenario.requestA.document.text);
        expect(sortedIds(activity?.generated ?? [])).toEqual([record.claim]);
        expect(sortedIds(activity?.start.used ?? [])).toEqual(
          sortedIds([capture, scenario.supportA.id, scenario.supportA.occurrence])
        );
        expect(activity?.id).toBe(record.core.generatedBy);
      })
    );
  });
});

const ReferenceProposeTool = Tool.make("claim_propose_reference", {
  description: "Reference tool declared over the domain schemas claim_propose exposes.",
  failure: ClaimProposeFailure,
  failureMode: "return",
  parameters: ClaimProposalRequest,
  success: LawProposedClaimRecord,
}).annotate(Tool.Strict, true);

const ReferenceToolkit = Toolkit.make(ReferenceProposeTool);

const unusedTraversal = ProvenanceTraversal.of({
  fromClaim: Effect.fn("WriteTools.unusedFromClaim")(function* () {
    return yield* Effect.die("the listing test never dispatches");
  }),
});

const unusedProposal = ClaimProposal.of({
  propose: Effect.fn("WriteTools.unusedPropose")(function* () {
    return yield* Effect.die("the listing test never dispatches");
  }),
});

const listingRegistrations = Layer.mergeAll(
  sanitizedToolkit(LawClaimToolkit).pipe(
    Layer.provide(LawClaimToolkitLayer),
    Layer.provide(Layer.succeed(ClaimProposal, unusedProposal)),
    Layer.provide(Layer.succeed(ProvenanceTraversal, unusedTraversal)),
    Layer.provide(Layer.succeed(TierGate, gateApproving([])))
  ),
  sanitizedToolkit(ReferenceToolkit).pipe(
    Layer.provide(
      ReferenceToolkit.toLayer({ claim_propose_reference: () => Effect.die("the listing test never dispatches") })
    )
  )
);

const declaredSchemas: ReadonlyArray<readonly [Tool.Any, S.Top, S.Top]> = [
  [KgClientsTool, BudgetParams, PracticeKgToolResult],
  [KgDocketFamilyTool, DocketFamilyParams, PracticeKgToolResult],
  [KgApplicationLookupTool, ApplicationLookupParams, PracticeKgToolResult],
  [KgFindTool, FindParams, PracticeKgToolResult],
  [CorpusSearchTextTool, SearchTextParams, PracticeKgToolResult],
  [CorpusGetDocumentTool, GetDocumentParams, PracticeKgToolResult],
  [EmailSearchTool, EmailSearchParams, PracticeKgToolResult],
  [KgCandidateClaimsTool, CandidateClaimsParams, PracticeKgCandidateClaimsResult],
  [KgMatterLookupTool, MatterLookupParams, PracticeKgToolResult],
  [KgCorrespondentLookupTool, CorrespondentLookupParams, PracticeKgToolResult],
  [KgProvenanceTool, ProvenanceParams, PracticeKgToolResult],
  [ClaimInspectionTool, ClaimSelfCheck.ClaimInspectionPageRequest, ClaimSelfCheck.ClaimInspectionPage],
  [ClaimSelfCheckTool, ClaimSelfCheckReviewRequest, ClaimSelfCheckReviewResult],
  [ReviewHub.OpenItemsTool, ReviewHub.OpenItemsRequest, ReviewHub.OpenItems],
  [ReviewHub.RecordVerdictTool, RecordVerdictInput, VerdictRow],
  [ReviewHub.LockBatchTool, ReviewHub.LockBatchRequest, VerdictRow],
  [ReviewHub.RecordAnswerTool, ReviewHub.RecordAnswerRequest, AnswerRow],
];

const statusIdentifier = (definitions: R.ReadonlyRecord<string, unknown>): ReadonlyArray<string> =>
  A.filter(R.keys(definitions), (identifier) => Str.endsWith("/PracticeKgEpistemicStatus")(identifier));

describe("write tools emit proposed records only: (e) same schemas", () => {
  it("write tools emit proposed records only: (e) every law-practice tool publishes its declared domain schemas", () => {
    const listed = A.map(declaredSchemas, ([tool]) => tool.name);
    expect(A.sort(listed, Str.Order)).toEqual(
      A.sort([...R.keys(PracticeKgToolkit.tools), ...R.keys(ReviewHub.ReviewHubToolkit.tools)], Str.Order)
    );
    for (const [tool, parameters, success] of declaredSchemas) {
      expect(S.toJsonSchemaDocument(tool.parametersSchema)).toEqual(S.toJsonSchemaDocument(parameters));
      expect(S.toJsonSchemaDocument(tool.successSchema)).toEqual(S.toJsonSchemaDocument(success));
    }
  });

  it("write tools emit proposed records only: (e) kg_candidate_claims states its status and label as the domain status", () => {
    const domain = S.toJsonSchemaDocument(PracticeKgEpistemicStatus);
    const published = S.toJsonSchemaDocument(KgCandidateClaimsTool.successSchema).definitions;
    const row = S.toJsonSchemaDocument(PracticeKgCandidateClaimToolRow).definitions;
    const notLoaded = S.toJsonSchemaDocument(PracticeKgCandidateClaimsNotLoadedResult).definitions;
    const [identifier] = statusIdentifier(domain.definitions);
    expect(identifier).toBeDefined();
    for (const definitions of [published, row, notLoaded]) {
      expect(statusIdentifier(definitions)).toEqual([identifier]);
      expect(definitions[identifier ?? ""]).toEqual(domain.definitions[identifier ?? ""]);
    }
  });

  it.effect(
    "write tools emit proposed records only: (e) claim_propose lists the JSON Schema of its domain schemas",
    () =>
      Effect.gen(function* () {
        const harness = layerConformanceHttp({
          name: "law-claim-toolkit-listing",
          version: "0.0.0",
          registrations: listingRegistrations,
          tool: { name: "claim_propose", arguments: {}, invalidArguments: {} },
        });
        const context = yield* Layer.build(harness);
        const { rpc } = yield* connectHttp().pipe(Effect.provideContext(context));
        const { tools } = yield* rpc["tools/list"]({});
        const byName = (name: string) => O.getOrThrow(A.findFirst(tools, (tool) => tool.name === name));
        const proposeListing = byName("claim_propose");
        const reference = byName("claim_propose_reference");
        expect(proposeListing.inputSchema).toEqual(reference.inputSchema);
        expect(proposeListing.outputSchema).toEqual(reference.outputSchema);
        expect(proposeListing.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true });
      })
  );
});

const roundTrips = Effect.fnUntraced(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("write tools emit proposed records only: (f) generated schema-derived values", () => {
  it.effect.prop(
    "round-trips every generated PracticeKgEpistemicStatus through its encoding",
    [Arbitrary.schema(PracticeKgEpistemicStatus)],
    ([value]) => roundTrips(PracticeKgEpistemicStatus, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated VerdictRow through its encoding",
    [Arbitrary.schema(VerdictRow)],
    ([value]) => roundTrips(VerdictRow, value),
    { arbitrary: fcRuns(25) }
  );
});
