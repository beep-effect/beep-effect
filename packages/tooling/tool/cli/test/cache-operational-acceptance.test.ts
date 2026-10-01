import {
  CacheActivationPreview,
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCensusWorkspace,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheQualificationLive,
  CacheQualificationService,
  CacheToolchainSnapshot,
  CacheTransitionRequest,
} from "@beep/repo-cli/commands/Cache";
import * as Census from "@beep/repo-cli/commands/Cache/Cache.census";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import {
  CacheProducerAcceptanceReference,
  CacheProducerImportRequest,
  CacheProducerObservation,
  CacheProducerTrustLocations,
  hashCacheProducerContract,
  initializeCacheProducerIssuer,
  persistCacheProducerAcceptance,
  revokeCacheProducerIssuer,
} from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheEvidenceReference,
  CachePolicyBaseline,
  CachePolicyNode,
  CachePolicyProjection,
  CacheQualificationEntry,
  CacheQualificationEvent,
  CacheQualificationKey,
  CacheQualificationStore,
  CacheReviewDecision,
  CacheSignedExecutionProfile,
  CacheTaskConfiguration,
  CacheTaskContract,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canaryInput, contractInput, input } from "./helpers/cache-producer-bundle-fixture.ts";

const platform = Layer.mergeAll(
  NodeCrypto.layer,
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it.live(
  "checks signed ledger acceptance through real fingerprints and rejects drift and revocation",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-operational-" });
      const worksheet = "Synthetic reviewed contract worksheet.\n";
      yield* fs.writeFileString(path.join(root, "review.md"), worksheet);
      const worksheetDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(worksheet));
      const observedBundle = yield* S.decodeUnknownEffect(CacheProducerBundle)(input);
      const draft = yield* S.decodeUnknownEffect(CacheTaskContract)({
        ...contractInput,
        pins: { ...contractInput.pins, contract: worksheetDigest },
        semanticInputClasses: ["source-comment"],
      });
      const writeEvidence = Effect.fn("OperationalTest.writeEvidence")(function* (relative: string, text: string) {
        yield* fs.makeDirectory(path.dirname(path.join(root, relative)), { recursive: true });
        yield* fs.writeFileString(path.join(root, relative), text);
        return CacheEvidenceReference.make({
          path: relative,
          sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)),
        });
      });
      const rootText = '{"remoteCache":{"enabled":false},"tasks":{}}';
      const rootReference = yield* writeEvidence("turbo.json", rootText);
      const beforeText = '{"extends":["//"],"tasks":{"lint":{"cache":false}}}';
      const afterText = '{"extends":["//"],"tasks":{"lint":{"cache":true}}}';
      const before = yield* writeEvidence("before.json", beforeText);
      const after = yield* writeEvidence("after.json", afterText);
      const child = yield* writeEvidence("packages/identity/turbo.json", beforeText);
      const node = CacheCensusNode.make({
        id: draft.key.computation,
        workspace: "@beep/identity",
        task: "lint",
        command: O.some("bun run beep:lint"),
        commandDigest: draft.commandDigest,
        dependencies: [],
        configuration: CacheTaskConfiguration.make({ ...draft.configuration, cache: false }),
        inputCount: S.Natural.make(1),
        inputsDigest: draft.pins.configuration,
      });
      const census = CacheCensusReport.make({
        revision: observedBundle.pilot.sourceRevision,
        turboVersion: draft.clients.stable.version,
        rootScripts: {},
        globalConfiguration: { remoteCache: { enabled: false } },
        workspaces: [
          CacheCensusWorkspace.make({
            name: "@beep/identity",
            directory: "packages/identity",
            scripts: { lint: "bun run beep:lint" },
          }),
        ],
        nodes: [node],
        sources: [CacheCensusSource.make(rootReference), CacheCensusSource.make(child)],
        entrypointSources: [],
        unresolved: [],
      });
      const sourceKey = CacheQualificationKey.make({
        ...observedBundle.pilot.baseKey,
        profile: "local-linux-x64-bun1.4.2",
      });
      const signedKey = CacheQualificationKey.make({
        ...sourceKey,
        profile: `${sourceKey.profile}-private-loopback-signed-v1`,
      });
      const toolchain = CacheToolchainSnapshot.make({
        profile: "local-linux-x64-bun1.4.2",
        kernel: "fixture",
        libc: "fixture",
        bun: { ...observedBundle.pilot.bun, version: "1.4.2" },
        node: observedBundle.pilot.node,
        biome: observedBundle.pilot.biome,
        turbo: draft.clients.stable,
        sources: [],
      });
      const source = yield* Fingerprint.fingerprintCacheComputation(sourceKey, census, toolchain);
      const activation = CacheActivationProjection.make({
        path: child.path,
        before,
        after,
        sourceConfiguration: source.configurationDigest,
      });
      const target = yield* Fingerprint.projectCacheActivation(
        source.key,
        census,
        toolchain,
        activation,
        beforeText,
        afterText
      );
      const preview = CacheActivationPreview.make({ activation, source, target });
      const activationRequest = yield* writeEvidence(
        "activation.json",
        yield* S.encodeEffect(S.fromJsonString(CacheActivationPreview))(preview)
      );
      const signedText = yield* Fingerprint.projectCacheSignedRoot(rootText);
      const signedRoot = yield* writeEvidence("signed-root.json", signedText);
      const identity = yield* Fingerprint.projectCacheSignedActivation(
        source.key,
        census,
        toolchain,
        activation,
        beforeText,
        afterText,
        rootText,
        signedText
      );
      const execution = CacheSignedExecutionProfile.make({
        sourceKey: source.key,
        sourceConfiguration: source.configurationDigest,
        sourceToolchain: source.toolchainDigest,
        activatedConfiguration: target.configurationDigest,
        activationRequest,
        signedRootConfiguration: signedRoot,
        runtimeKeys: { stable: source.toolchainDigest, canary: source.toolchainDigest },
      });
      const contract = CacheTaskContract.make({
        ...draft,
        key: signedKey,
        dependencies: [],
        activation: O.some(activation),
        signedExecution: O.some(execution),
        pins: { ...draft.pins, configuration: identity.configurationDigest, toolchain: identity.toolchainDigest },
      });
      const measured = {
        baseKey: sourceKey,
        key: signedKey,
        bun: toolchain.bun,
        configurationDigest: source.configurationDigest,
        toolchainDigest: source.toolchainDigest,
        runtimeKeyDigest: source.toolchainDigest,
        activatedConfigurationDigest: target.configurationDigest,
        signedConfigurationDigest: identity.configurationDigest,
        signedRootConfiguration: signedRoot.sha256,
        activation: activationRequest,
      };
      const bundle = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...input,
        pilot: { ...input.pilot, ...measured },
      });
      const canary = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...canaryInput,
        pilot: { ...canaryInput.pilot, ...measured },
      });
      const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
        ...bundle.pilot,
        protocolClient: input.protocol.observation.client,
        workflowRevision: Str.repeat(40)("a"),
        workflowImplementation: Str.repeat(64)("b"),
        policyDigest: yield* hashCacheProducerContract(contract),
      });
      const canaryBinding = CacheProducerBinding.make({
        ...binding,
        channel: "canary",
        client: canary.pilot.client,
        protocolClient: canary.protocol.observation.client,
      });
      const trust = CacheProducerTrustLocations.make({
        stable: path.join(root, "stable"),
        canary: path.join(root, "canary"),
      });
      const stableIssuer = yield* initializeCacheProducerIssuer(trust.stable, binding, contract);
      const canaryIssuer = yield* initializeCacheProducerIssuer(trust.canary, canaryBinding, contract);
      const request = CacheProducerImportRequest.make({
        observations: {
          stable: CacheProducerObservation.make({ observation: bundle, envelope: yield* stableIssuer.issue(bundle) }),
          canary: CacheProducerObservation.make({ observation: canary, envelope: yield* canaryIssuer.issue(canary) }),
        },
      });
      const directory = path.join(root, "accepted");
      yield* fs.makeDirectory(directory, { mode: 0o700 });
      const accepted = yield* persistCacheProducerAcceptance(directory, request, trust);
      const marker = yield* S.encodeEffect(S.fromJsonString(CacheProducerAcceptanceReference))(accepted);
      yield* fs.writeFileString(path.join(root, "accepted.json"), marker);
      const reference = CacheEvidenceReference.make({
        path: "accepted.json",
        sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(marker)),
      });
      vi.stubEnv("BEEP_CACHE_ACCEPTANCE_STORE", directory);
      vi.stubEnv("BEEP_CACHE_STABLE_ISSUER_STORE", trust.stable);
      vi.stubEnv("BEEP_CACHE_CANARY_ISSUER_STORE", trust.canary);
      const review = CacheReviewDecision.make({
        reviewer: "fixture",
        reason: "synthetic complete acceptance",
        basis: CacheEvidenceReference.make({ path: "review.md", sha256: worksheetDigest }),
      });
      vi.spyOn(Census, "collectCacheCensus").mockReturnValue(Effect.succeed(census));
      const observedToolchain = vi
        .spyOn(Fingerprint, "collectCacheToolchain")
        .mockReturnValue(Effect.succeed(toolchain));
      const baseline = CachePolicyBaseline.make({
        review,
        scope: [contract.key.computation],
        profile: contract.key.profile,
        epoch: contract.key.epoch,
        projection: CachePolicyProjection.make({
          globalConfiguration: census.globalConfiguration,
          sources: census.sources,
          nodes: [
            CachePolicyNode.make({
              computation: contract.key.computation,
              command: "bun run beep:lint",
              commandDigest: contract.commandDigest,
              dependencies: contract.dependencies,
              configuration: node.configuration,
            }),
          ],
        }),
      });
      yield* fs.makeDirectory(path.join(root, "standards"));
      yield* fs.writeFileString(
        path.join(root, "standards/cache-qualification-baseline.json"),
        yield* S.encodeEffect(S.fromJsonString(CachePolicyBaseline))(baseline)
      );
      const candidate = CacheQualificationEntry.make({
        key: contract.key,
        status: { state: "candidate", contract, review },
      });
      const shadow = CacheQualificationEntry.make({
        key: contract.key,
        status: { state: "shadow", contract, review, receipts: [] },
      });
      const qualified = CacheQualificationEntry.make({
        key: contract.key,
        status: { state: "qualified", contract, review, receipts: [reference] },
      });
      const prior = yield* S.encodeEffect(S.fromJsonString(CacheQualificationStore))(
        CacheQualificationStore.make({
          revision: 2,
          entries: [shadow],
          history: [
            CacheQualificationEvent.make({ revision: S.Int.make(1), entry: candidate }),
            CacheQualificationEvent.make({ revision: S.Int.make(2), entry: shadow }),
          ],
        })
      );
      const ledger = path.join(root, "standards/cache-qualification.json");
      yield* fs.writeFileString(ledger, prior);
      const cache = yield* CacheQualificationService;
      const transition = CacheTransitionRequest.make({ expectedRevision: S.Natural.make(2), entry: qualified });

      for (const patch of [{ signedExecution: O.none() }, { activation: O.none() }]) {
        const incompleteContract = CacheTaskContract.make({ ...contract, ...patch });
        const incompleteEntry = CacheQualificationEntry.make({
          key: contract.key,
          status: { state: "qualified", contract: incompleteContract, review, receipts: [reference] },
        });
        const failure = yield* cache
          .transition(root, CacheTransitionRequest.make({ ...transition, entry: incompleteEntry }))
          .pipe(Effect.flip);
        expect(failure.message).toBe("Signed qualification requires a reviewed execution profile and activation.");
        expect(yield* fs.readFileString(ledger)).toBe(prior);
        const priorStore = yield* S.decodeEffect(S.fromJsonString(CacheQualificationStore))(prior);
        yield* fs.writeFileString(
          ledger,
          yield* S.encodeEffect(S.fromJsonString(CacheQualificationStore))(
            CacheQualificationStore.make({
              ...priorStore,
              revision: 3,
              entries: [incompleteEntry],
              history: [
                ...priorStore.history,
                CacheQualificationEvent.make({ revision: S.Int.make(3), entry: incompleteEntry }),
              ],
            })
          )
        );
        expect((yield* cache.audit(root).pipe(Effect.flip)).message).toBe(
          "Signed qualification requires a reviewed execution profile and activation."
        );
        yield* fs.writeFileString(ledger, prior);
      }
      const result = yield* cache.transition(root, transition);
      expect(result.revision).toBe(3);
      expect(
        (yield* Fingerprint.fingerprintCacheComputation(contract.key, census, toolchain).pipe(Effect.flip)).message
      ).toBe("Computation and observed toolchain use different profiles.");
      expect(result.entries[0]?.status.state).toBe("qualified");
      expect(A.filter((yield* cache.audit(root)).findings, (finding) => finding.blocking)).toEqual([]);
      const promoted = yield* fs.readFileString(ledger);
      expect(yield* fs.readFileString(path.join(root, child.path))).toBe(beforeText);
      expect(node.configuration.cache).toBe(false);
      for (const reference of [rootReference, child, before, after, activationRequest, signedRoot]) {
        const file = path.join(root, reference.path);
        const original = yield* fs.readFileString(file);
        yield* fs.writeFileString(file, `${original} `);
        expect(yield* cache.audit(root).pipe(Effect.isFailure)).toBe(true);
        yield* fs.writeFileString(ledger, prior);
        expect(yield* cache.transition(root, transition).pipe(Effect.isFailure)).toBe(true);
        expect(yield* fs.readFileString(ledger)).toBe(prior);
        yield* fs.writeFileString(file, original);
        yield* fs.writeFileString(ledger, promoted);
      }
      expect(A.filter((yield* cache.audit(root)).findings, (finding) => finding.blocking)).toEqual([]);
      const runtimeDrift = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Sha256Hex),
        (kernel) =>
          Effect.gen(function* () {
            observedToolchain.mockReturnValue(Effect.succeed(CacheToolchainSnapshot.make({ ...toolchain, kernel })));
            yield* fs.writeFileString(ledger, promoted);
            expect(yield* cache.audit(root).pipe(Effect.isFailure)).toBe(kernel !== toolchain.kernel);
            yield* fs.writeFileString(ledger, prior);
            expect(yield* cache.transition(root, transition).pipe(Effect.isFailure)).toBe(kernel !== toolchain.kernel);
            if (kernel !== toolchain.kernel) expect(yield* fs.readFileString(ledger)).toBe(prior);
            return true;
          }),
        fcRuns(10)
      );
      expect(runtimeDrift._tag).toBe("Passed");
      observedToolchain.mockReturnValue(Effect.succeed(toolchain));
      yield* revokeCacheProducerIssuer(trust.canary);
      yield* fs.writeFileString(ledger, promoted);
      expect(yield* cache.audit(root).pipe(Effect.isFailure)).toBe(true);
      yield* fs.writeFileString(ledger, prior);
      expect(yield* cache.transition(root, transition).pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.readFileString(ledger)).toBe(prior);
    }).pipe(Effect.scoped, Effect.provide(CacheQualificationLive.pipe(Layer.provideMerge(platform)))),
  30000
);
