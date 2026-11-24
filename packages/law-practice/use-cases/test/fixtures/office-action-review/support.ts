import { TrustedClaimBinding } from "@beep/epistemics/Admission";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractionResult } from "@beep/file-processing/Extraction";
import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { allowRemoteExtractionPolicyLayer, LangExtractService, layer } from "@beep/langextract/Service";
import { LawHumanAdmissionToken, LawPrincipalId, LawRevision } from "@beep/law-practice-domain/values/LawClaim";
import { LawClaimAdmissions, LawClaimProposals, LawClaimStoreError } from "@beep/law-practice-use-cases/ClaimStore";
import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { AttorneyAttestation, LawAdmission, LawAdmissionLayer } from "@beep/law-practice-use-cases/LawAdmission";
import { GrantedScopes, LawPrincipal, MatterAccess, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import { makeOfficeActionReview, OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import { PosixPath } from "@beep/schema/PosixPath";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Response from "effect/ai/Response";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { text } from "./fixture.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore";
import type { SourceTextResolverShape } from "@beep/file-processing/SourceText";
import type { ExtractionHandoff } from "@beep/langextract/Handoff";
import type { LawAdmission as LawAdmissionRecord, ScopeRef } from "@beep/law-practice-domain/values/LawClaim";
import type {
  AdmissionBinding,
  LawClaimAdmissionsShape,
  LawClaimProposalsShape,
  ProposedClaimEntry,
} from "@beep/law-practice-use-cases/ClaimStore";

const usage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

export const makeLayer = (output: string) => {
  const model = Model.make(
    "test",
    "office-action-stub",
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: () =>
          Effect.succeed([
            Response.makePart("text", { text: output }),
            Response.makePart("finish", { reason: "stop", response: undefined, usage }),
          ]),
        streamText: () => Stream.empty,
      })
    )
  );
  const extraction = layer.pipe(Layer.provide(Layer.merge(model, allowRemoteExtractionPolicyLayer)));
  const files = makeFileProcessingServiceLayer([
    {
      ...TestFileProcessingEngine,
      extract: (operation) =>
        TestFileProcessingEngine.extract(operation).pipe(
          Effect.map((result) => ExtractionResult.make({ ...result, engineVersion: "1" }))
        ),
    },
  ]);
  return Layer.mergeAll(extraction, files).pipe(Layer.provideMerge(Digest.layerWebCrypto));
};

export const fixtureInput = Effect.fn("OfficeActionFlow.fixtureInput")(function* () {
  const digest = yield* Digest.Digest;
  const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(text));
  return OfficeActionReviewInput.make({
    matterFixtureKey: "matter.flow",
    officeActionFixtureKey: "office-action.flow",
    operationId: OperationId.make(`operation:${hash}`),
    sourceArtifact: SourceArtifact.make({
      id: ArtifactId.make(`artifact:${hash}`),
      digest: ContentDigest.make(`sha256:${hash}`),
      extension: "txt",
      name: "office-action.txt",
      relativePath: PosixPath.make("fixtures/office-action-review.txt"),
      locator: ArtifactLocator.make({ kind: "synthetic", value: PosixPath.make("fixtures/office-action-review.txt") }),
      sizeBytes: S.Natural.make(text.length),
      text,
    }),
  });
});

export const fixturePrincipal = LawPrincipalId.make(7);

export const unstaffedPrincipal = LawPrincipalId.make(8);

export const fixtureRevision = LawRevision.make("revision-1");

export const secondRevision = LawRevision.make("revision-2");

const fixtureAttestation = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("a")}`);

export const issueToken = (request: { readonly revision: LawRevision; readonly scope: ScopeRef }) =>
  LawHumanAdmissionToken.make({
    actor: fixturePrincipal,
    scope: request.scope,
    action: "admit-distinction",
    revision: request.revision,
    issuedAt: DateTime.makeUnsafe(0),
    attestation: fixtureAttestation,
  });

export const attestationIssuedByFixture = AttorneyAttestation.of({
  verify: Effect.fn("OfficeActionFlow.verifyAttestation")(function* (token: LawAdmissionRecord["token"]) {
    return Eq.equals(token.attestation, fixtureAttestation);
  }),
});

const fixtureMatter = MatterAccess.cases.Granted.make({ matter: LawPractice.MatterId.make(1) });

const notStaffed = MatterAccess.cases.Denied.make({ reason: "not-staffed" });

export const authorityStaffing = (staffed: LawPrincipalId) =>
  MatterAuthority.of({
    authorize: Effect.fn("OfficeActionFlow.authorize")(function* (request) {
      return Eq.equals(request.principal, staffed) ? fixtureMatter : notStaffed;
    }),
    authorizeFamily: Effect.fn("OfficeActionFlow.authorizeFamily")(function* (request) {
      return Eq.equals(request.principal, staffed) ? fixtureMatter : notStaffed;
    }),
    grantedScopes: Effect.fn("OfficeActionFlow.grantedScopes")(function* () {
      return GrantedScopes.make({
        scopeRefs: HashSet.empty(),
        familyKeys: HashSet.empty(),
        mailFolders: HashSet.empty(),
      });
    }),
  });

export const resolverReturning = (current: string) =>
  SourceTextResolver.of({
    resolve: Effect.fn("OfficeActionFlow.resolve")(function* (request) {
      return ResolvedSourceText.make({ identity: request.identity, text: current });
    }),
  });

export const makeMemoryClaimStore = Effect.fn("OfficeActionFlow.memoryClaimStore")(function* () {
  const entries = yield* Ref.make(HashMap.empty<ClaimId, ProposedClaimEntry>());
  const bindings = yield* Ref.make<ReadonlyArray<AdmissionBinding>>([]);
  const admitted = yield* Ref.make<ReadonlyArray<LawAdmissionRecord>>([]);
  const permit = yield* Semaphore.make(1);
  const stored = Effect.map(Ref.get(entries), (map) => map.pipe(HashMap.values, A.fromIterable));
  const latestIn = (scope: ScopeRef) =>
    Effect.map(stored, (all) =>
      pipe(
        all,
        A.filter((entry) => Eq.equals(entry.record.core.scope, scope)),
        A.map((entry) => entry.record.core.knowledgeStart),
        A.reduce(O.none<DateTime.Utc>(), (latest, at) =>
          O.some(O.match(latest, { onNone: () => at, onSome: DateTime.max(at) }))
        )
      )
    );
  const proposals: LawClaimProposalsShape = {
    activities: (claim) =>
      Effect.map(Ref.get(entries), (map) =>
        O.match(HashMap.get(map, claim), { onNone: HashSet.empty, onSome: (entry) => entry.activities })
      ),
    captures: (claim) =>
      Effect.map(Ref.get(entries), (map) =>
        O.match(HashMap.get(map, claim), { onNone: HashSet.empty, onSome: (entry) => entry.captures })
      ),
    appendProposed: Effect.fn("OfficeActionFlow.appendProposed")(function* (entry: ProposedClaimEntry) {
      const latest = yield* latestIn(entry.record.core.scope);
      if (O.exists(latest, (at) => DateTime.isLessThan(entry.record.core.knowledgeStart, at)))
        return yield* LawClaimStoreError.make({ operation: "append-proposed" });
      yield* Ref.update(entries, HashMap.set(entry.record.claim, entry));
    }),
    findProposed: (lookup) =>
      Effect.map(Ref.get(entries), (map) =>
        map.pipe(
          HashMap.values,
          A.fromIterable,
          A.findFirst(
            (entry) =>
              Eq.equals(entry.record.core.scope, lookup.scope) &&
              Eq.equals(entry.record.core.logicalKey, lookup.logicalKey) &&
              Eq.equals(entry.record.core.supportAtCreation, lookup.supportAtCreation)
          ),
          O.map((entry) => entry.record)
        )
      ),
    generation: (activity) =>
      Effect.map(Ref.get(entries), (map) =>
        map.pipe(
          HashMap.values,
          A.fromIterable,
          A.findFirst((entry) => Eq.equals(entry.generation.activity, activity)),
          O.map((entry) => entry.generation)
        )
      ),
    get: (claim) => Effect.map(Ref.get(entries), (map) => O.map(HashMap.get(map, claim), (entry) => entry.record)),
    withPartition: (scope, body) => Semaphore.withPermits(permit, 1, Effect.flatMap(latestIn(scope), body)),
  };
  const admissions: LawClaimAdmissionsShape = {
    admissions: (claim) =>
      Effect.map(
        Ref.get(admitted),
        A.filter((admission: LawAdmissionRecord) => Eq.equals(admission.claim, claim))
      ),
    appendAdmission: (admission) => Ref.update(admitted, A.append(admission)),
    binding: (request) =>
      Effect.map(Ref.get(bindings), (opened) =>
        pipe(
          opened,
          A.findLast(
            (binding) =>
              Eq.equals(binding.actor, request.actor) &&
              Eq.equals(binding.action, request.action) &&
              Eq.equals(binding.revision, request.revision) &&
              Eq.equals(binding.scope, request.scope)
          ),
          O.match({
            onNone: () => TrustedClaimBinding.cases.Unavailable.make({ reason: "missing" }),
            onSome: (binding) =>
              TrustedClaimBinding.cases.Claim.make({ claim: binding.claim, clearsRetraction: O.none() }),
          })
        )
      ),
    openAdmission: (binding) => Ref.update(bindings, A.append(binding)),
  };
  return { proposals, admissions, stored, opened: Ref.get(bindings), admitted: Ref.get(admitted) };
});

export const serviceOf =
  <I, Shape>(key: Context.Key<I, Shape>) =>
  <E, R>(built: Layer.Layer<I, E, R>) =>
    Effect.map(Layer.build(built), (context) => Context.get(context, key));

export const reviewScenario = Effect.fn("OfficeActionFlow.reviewScenario")(function* (options: {
  readonly principal: LawPrincipalId;
  readonly current: string;
  readonly admittingAs?: LawPrincipalId;
  readonly resolver?: SourceTextResolverShape;
}) {
  const digest = yield* Digest.Digest;
  const fileProcessing = yield* FileProcessingService;
  const langExtract = yield* LangExtractService;
  const store = yield* makeMemoryClaimStore();
  const authority = authorityStaffing(fixturePrincipal);
  let captured = O.none<ExtractionHandoff>();
  const irToLaw = makeIrToLaw();
  const review = makeOfficeActionReview({
    authority,
    digest,
    fileProcessing,
    irToLaw,
    principal: options.principal,
    proposals: store.proposals,
    langExtract: {
      extract: (request) =>
        langExtract.extract(request).pipe(
          Effect.tap((result) =>
            Effect.sync(() => {
              captured = O.some(result.handoff);
            })
          )
        ),
    },
  });
  const services = Layer.mergeAll(
    Layer.succeed(LawPrincipal, { principal: options.admittingAs ?? options.principal }),
    Layer.succeed(MatterAuthority, authority),
    Layer.succeed(LawClaimProposals, store.proposals),
    Layer.succeed(LawClaimAdmissions, store.admissions),
    Layer.succeed(SourceTextResolver, options.resolver ?? resolverReturning(options.current)),
    Layer.succeed(AttorneyAttestation, attestationIssuedByFixture),
    Layer.succeed(Digest.Digest, digest)
  );
  const admission = yield* serviceOf(LawAdmission)(LawAdmissionLayer.pipe(Layer.provide(services)));
  const input = yield* fixtureInput();
  const handoff = () => O.getOrThrow(captured);
  return { admission, handoff, input, irToLaw, review, store };
});
