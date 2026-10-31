import { GitHubClient } from "@beep/github/GitHubClient";
import {
  CacheCommandError,
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheSignedPilotReceipt,
} from "@beep/repo-cli/commands/Cache";
import { cacheProducerImportMaxBytes } from "@beep/repo-cli/commands/Cache/Cache.acceptance.store";
import {
  buildCacheHostedProducerCompleteReport,
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerReference,
  CacheHostedProducerRunReference,
  CacheHostedProducerUpload,
  CacheHostedProducerVerifier,
  CacheHostedProducerVerifierLive,
  CacheProducerAcceptanceReference,
  CacheProducerImportRequest,
  CacheProducerObservation,
  CacheProducerPublication,
  CacheProducerTrustLocations,
  CacheRuntimeFileGuards,
  deriveCacheProducerEvidence,
  hashCacheProducerContract,
  initializeCacheProducerIssuer,
  persistCacheProducerAcceptance,
  previewCacheProducerImport,
  readCacheProducerAcceptance,
  revokeCacheProducerIssuer,
  validateCacheProducerApproval,
  validateCacheProducerImport,
} from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheClientPin,
  CacheEvidenceReference,
  CacheSignedExecutionProfile,
  CacheTaskContract,
  cachePromotionFailures,
} from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it, vi } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import {
  makePublishedAcceptanceFixture,
  PublishedContentClient,
  zipProducerReport,
} from "./helpers/cache-hosted-publication-fixture.ts";
import { canaryInput, contractInput, input } from "./helpers/cache-producer-bundle-fixture.ts";

const ProducerImportRequestJson = S.fromJsonString(CacheProducerImportRequest);
const encodeHostedApproval = S.encodeEffect(S.fromJsonString(CacheHostedProducerApproval));
const encodeCompleteReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerCompleteReport));

const setup = Effect.gen(function* () {
  const bundle = yield* S.decodeUnknownEffect(CacheProducerBundle)(input);
  const contract = yield* S.decodeUnknownEffect(CacheTaskContract)(contractInput);
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...input.pilot,
    protocolClient: input.protocol.observation.client,
    workflowRevision: Str.repeat(40)("a"),
    workflowImplementation: Str.repeat(64)("b"),
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  return { bundle, approval: CacheProducerApproval.make({ binding, contract }) };
});
const publishedSetup = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const { bundle, approval } = yield* setup;
  const contract = CacheTaskContract.make({ ...approval.contract, semanticInputClasses: ["source-comment"] });
  const binding = CacheProducerBinding.make({
    ...approval.binding,
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  const canary = yield* S.decodeUnknownEffect(CacheProducerBundle)(canaryInput);
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
  const published = yield* makePublishedAcceptanceFixture(trust, contract, bundle, binding, canary, canaryBinding);
  return { fs, path, root, contract, trust, published };
});

it.layer(NodeCrypto.layer, { timeout: "30 seconds" })("producer evidence projections", (it) => {
  it.effect("rejects signed approval with an omitted profile or activation even after rehashing policy", () =>
    Effect.gen(function* () {
      const { bundle, approval } = yield* setup;
      for (const patch of [{ signedExecution: O.none() }, { activation: O.none() }]) {
        const contract = CacheTaskContract.make({ ...approval.contract, ...patch });
        const binding = CacheProducerBinding.make({
          ...approval.binding,
          policyDigest: yield* hashCacheProducerContract(contract),
        });
        const failure = yield* validateCacheProducerApproval(CacheProducerApproval.make({ binding, contract })).pipe(
          Effect.flip
        );
        expect(failure.message).toBe("Signed producer approval requires a reviewed execution profile and activation.");
        const projectionFailure = yield* deriveCacheProducerEvidence(
          bundle,
          CacheProducerApproval.make({ binding, contract })
        ).pipe(Effect.flip);
        expect(projectionFailure.message).toBe(failure.message);
      }
    })
  );

  it.effect.prop(
    "requires schema-generated source configuration identities to match producer approval",
    { configurationDigest: Sha256Hex },
    ({ configurationDigest }) =>
      Effect.gen(function* () {
        const { bundle, approval } = yield* setup;
        const altered = CacheProducerBundle.make({
          ...bundle,
          pilot: CacheSignedPilotReceipt.make({ ...bundle.pilot, configurationDigest }),
        });
        strictEqual(
          yield* deriveCacheProducerEvidence(altered, approval).pipe(Effect.isSuccess),
          configurationDigest === bundle.pilot.configurationDigest
        );
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect("binds separate source and execution identities to independently approved signed reports", () =>
    Effect.gen(function* () {
      const { bundle, approval } = yield* setup;
      const execution = CacheSignedExecutionProfile.make({
        sourceKey: bundle.pilot.baseKey,
        sourceConfiguration: approval.binding.configurationDigest,
        sourceToolchain: approval.binding.toolchainDigest,
        activatedConfiguration: bundle.pilot.activatedConfigurationDigest,
        activationRequest: bundle.pilot.activation,
        signedRootConfiguration: CacheEvidenceReference.make({
          path: "signed-root.json",
          sha256: bundle.pilot.signedRootConfiguration,
        }),
        runtimeKeys: { stable: bundle.pilot.runtimeKeyDigest, canary: bundle.pilot.runtimeKeyDigest },
      });
      const contract = CacheTaskContract.make({
        ...approval.contract,
        pins: {
          ...approval.contract.pins,
          configuration: bundle.pilot.signedConfigurationDigest,
          toolchain: execution.runtimeKeys.stable,
        },
        signedExecution: O.some(execution),
        activation: O.some(
          CacheActivationProjection.make({
            path: "packages/identity/turbo.json",
            before: CacheEvidenceReference.make({ path: "before.json", sha256: execution.sourceConfiguration }),
            after: CacheEvidenceReference.make({ path: "after.json", sha256: execution.activatedConfiguration }),
            sourceConfiguration: execution.sourceConfiguration,
          })
        ),
      });
      const binding = CacheProducerBinding.make({
        ...approval.binding,
        policyDigest: yield* hashCacheProducerContract(contract),
      });
      const reviewed = CacheProducerApproval.make({ binding, contract });
      yield* validateCacheProducerApproval(reviewed);
      const fragments = yield* deriveCacheProducerEvidence(bundle, reviewed);
      const activationRows = A.filter(fragments, (fragment) =>
        A.contains(fragment.observation.subjects, "activation-projection")
      );
      expect(activationRows).toHaveLength(1);
      for (const fragment of activationRows) {
        expect(fragment.observation.kind).toBe("orchestration-invariance");
        const baseline = yield* Effect.fromOption(A.head(bundle.pilot.pairs), () => "Missing native baseline pair");
        expect(fragment.observation.roots).toEqual([baseline.authorityRoot, baseline.producerRoot]);
        expect(fragment.contents).toContain(bundle.pilot.activatedConfigurationDigest);
        expect(fragment.contents).toContain(bundle.pilot.signedConfigurationDigest);
      }
      expect(
        cachePromotionFailures(
          contract,
          A.map(fragments, (fragment) => fragment.observation)
        )
      ).not.toContain("stable:missing-orchestration-invariance:activation-projection");
      for (const patch of [
        { activatedConfigurationDigest: approval.binding.policyDigest },
        { signedConfigurationDigest: approval.binding.policyDigest },
      ]) {
        const altered = yield* S.decodeUnknownEffect(CacheProducerBundle)({
          ...input,
          pilot: { ...input.pilot, ...patch },
        });
        expect(yield* deriveCacheProducerEvidence(altered, reviewed).pipe(Effect.isFailure)).toBe(true);
      }
      const changedPins = CacheTaskContract.make({
        ...contract,
        pins: { ...contract.pins, configuration: binding.policyDigest },
      });
      expect(
        yield* validateCacheProducerApproval(
          CacheProducerApproval.make({
            contract: changedPins,
            binding: CacheProducerBinding.make({
              ...binding,
              policyDigest: yield* hashCacheProducerContract(changedPins),
            }),
          })
        ).pipe(Effect.isFailure)
      ).toBe(true);
      const different = binding.policyDigest;
      const canaryBinding = CacheProducerBinding.make({
        ...binding,
        channel: "canary",
        client: contract.clients.canary,
        protocolClient: { ...contract.clients.canary, namespace: "protocol-canary" },
        runtimeKeyDigest: execution.runtimeKeys.canary,
      });
      yield* validateCacheProducerApproval(CacheProducerApproval.make({ binding: canaryBinding, contract }));
      const canaryDrift = CacheTaskContract.make({
        ...contract,
        signedExecution: O.some(
          CacheSignedExecutionProfile.make({
            ...execution,
            runtimeKeys: { ...execution.runtimeKeys, canary: different },
          })
        ),
      });
      const canaryDriftDigest = yield* hashCacheProducerContract(canaryDrift);
      yield* validateCacheProducerApproval(
        CacheProducerApproval.make({
          contract: canaryDrift,
          binding: CacheProducerBinding.make({ ...binding, policyDigest: canaryDriftDigest }),
        })
      );
      expect(
        yield* validateCacheProducerApproval(
          CacheProducerApproval.make({
            contract: canaryDrift,
            binding: CacheProducerBinding.make({ ...canaryBinding, policyDigest: canaryDriftDigest }),
          })
        ).pipe(Effect.isFailure)
      ).toBe(true);
      for (const changed of [
        CacheSignedExecutionProfile.make({ ...execution, sourceConfiguration: different }),
        CacheSignedExecutionProfile.make({ ...execution, sourceToolchain: different }),
        CacheSignedExecutionProfile.make({ ...execution, activatedConfiguration: different }),
        CacheSignedExecutionProfile.make({
          ...execution,
          signedRootConfiguration: CacheEvidenceReference.make({
            ...execution.signedRootConfiguration,
            sha256: different,
          }),
        }),
        CacheSignedExecutionProfile.make({
          ...execution,
          runtimeKeys: { ...execution.runtimeKeys, stable: different },
        }),
      ]) {
        const changedContract = CacheTaskContract.make({ ...contract, signedExecution: O.some(changed) });
        const changedBinding = CacheProducerBinding.make({
          ...binding,
          policyDigest: yield* hashCacheProducerContract(changedContract),
        });
        expect(
          yield* validateCacheProducerApproval(
            CacheProducerApproval.make({ binding: changedBinding, contract: changedContract })
          ).pipe(Effect.isFailure)
        ).toBe(true);
      }
      const changedContract = CacheTaskContract.make({
        ...contract,
        signedExecution: O.some(
          CacheSignedExecutionProfile.make({
            ...execution,
            activationRequest: CacheEvidenceReference.make({ ...execution.activationRequest, sha256: different }),
          })
        ),
      });
      const changedApproval = CacheProducerApproval.make({
        contract: changedContract,
        binding: CacheProducerBinding.make({
          ...binding,
          policyDigest: yield* hashCacheProducerContract(changedContract),
        }),
      });
      yield* validateCacheProducerApproval(changedApproval);
      expect((yield* deriveCacheProducerEvidence(bundle, changedApproval).pipe(Effect.flip)).message).toContain(
        "activation request"
      );
    })
  );
  it.effect("derives native control subjects and counts only strictly overlapping task intervals", () =>
    Effect.gen(function* () {
      const { approval } = yield* setup;
      const bundle = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...input,
        pilot: {
          ...input.pilot,
          freshPairs: A.map(input.pilot.freshPairs, (pair) =>
            pair.id === 0
              ? pair
              : {
                  ...pair,
                  right: {
                    ...pair.right,
                    selectedTaskInterval: {
                      ...pair.right.selectedTaskInterval,
                      startTime: pair.left.selectedTaskInterval.endTime,
                    },
                  },
                }
          ),
        },
      });
      const fragments = yield* deriveCacheProducerEvidence(bundle, approval);
      const observations = A.map(fragments, (fragment) => fragment.observation);
      expect(A.some(observations, (row) => A.contains(row.subjects, "activation-projection"))).toBe(true);
      expect(A.filter(observations, (row) => row.kind === "concurrency")).toHaveLength(1);
      expect(A.filter(observations, (row) => row.kind === "cross-root")).toHaveLength(3);
      const negative = pipe(
        observations,
        A.filter((row) => row.kind === "negative-case"),
        A.flatMap((row) => row.subjects)
      );
      expect(negative).toEqual(
        expect.arrayContaining([
          "missing-child-config",
          "missing-root-config",
          "malformed-root-config",
          "malformed-child-config",
          "absent-script",
        ])
      );
      const semantic = pipe(
        observations,
        A.filter((row) => row.kind === "semantic-invalidation"),
        A.flatMap((row) => row.subjects)
      );
      expect(semantic).toEqual(expect.arrayContaining(A.map(input.pilot.mutations, (mutation) => mutation.case)));
      expect(semantic).not.toContain("source");
      const failures = cachePromotionFailures(approval.contract, observations);
      expect(failures).toContain("stable:missing-semantic-invalidation:source");
      expect(failures).not.toContain("stable:missing-negative-case:missing-child-config");
    })
  );
  it.effect("retains distinct native comparison bytes without fabricating missing obligations", () =>
    Effect.gen(function* () {
      const { bundle, approval } = yield* setup;
      const fragments = yield* deriveCacheProducerEvidence(bundle, approval);
      const comparisons = A.filter(fragments, (fragment) =>
        A.contains(["fresh-fresh", "fresh-remote-hit", "shadow"], fragment.observation.kind)
      );
      expect(comparisons).toHaveLength(16);
      expect(A.dedupe(A.map(comparisons, (fragment) => fragment.reference.sha256))).toHaveLength(16);
      for (const fragment of fragments) {
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(fragment.contents))).toBe(
          fragment.reference.sha256
        );
        expect(fragment.observation.receipt).toEqual(fragment.reference);
      }
      const failures = cachePromotionFailures(
        approval.contract,
        A.map(fragments, (fragment) => fragment.observation)
      );
      expect(failures).not.toContain("stable:missing-capture-safety");
      expect(failures).not.toContain("stable:missing-trust");
      expect(failures).toContain("stable:missing-semantic-invalidation:source");
      expect(failures).not.toContain("stable:missing-conformance");
      const conformance = A.filter(fragments, (fragment) => fragment.observation.kind === "conformance");
      expect(conformance).toHaveLength(1);
      expect(A.flatMap(conformance, (fragment) => fragment.observation.roots)).toEqual(
        A.map(bundle.protocol.roots, (root) => root.sha256)
      );
      expect(failures).not.toContain("stable:missing-isolated-fresh-fresh");
      expect(failures).not.toContain("stable:missing-isolated-fresh-remote-hit");
      expect(failures).not.toContain("stable:missing-shadow-decisions");
    })
  );
  it.effect("rejects mismatched policy and producer binding before projecting rows", () =>
    Effect.gen(function* () {
      const { bundle, approval } = yield* setup;
      const changed = CacheProducerApproval.make({
        ...approval,
        binding: CacheProducerBinding.make({ ...approval.binding, sourceRevision: Str.repeat(40)("0") }),
      });
      (yield* deriveCacheProducerEvidence(bundle, changed).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      const policy = CacheProducerApproval.make({
        ...approval,
        contract: CacheTaskContract.make({ ...approval.contract, negativeCases: ["weaker"] }),
      });
      (yield* deriveCacheProducerEvidence(bundle, policy).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
});

const checkStoreBounds = Effect.fn("AcceptanceTest.checkStoreBounds")(function* (
  directory: string,
  reference: CacheProducerAcceptanceReference,
  request: CacheProducerImportRequest,
  trust: CacheProducerTrustLocations
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(directory, `${reference.sha256}.json`);
  const original = yield* fs.readFileString(file);
  for (const contents of ["", Str.repeat(cacheProducerImportMaxBytes + 1)("x")]) {
    yield* fs.writeFileString(file, contents);
    const error = yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.flip);
    expect(error.message).toContain("bounded private single-link file");
  }
  yield* fs.writeFileString(file, original);
  const oversized = CacheProducerImportRequest.make({
    observations: {
      ...request.observations,
      stable: CacheProducerObservation.make({
        ...request.observations.stable,
        observation: CacheProducerBundle.make({
          ...request.observations.stable.observation,
          pilot: CacheSignedPilotReceipt.make({
            ...request.observations.stable.observation.pilot,
            client: CacheClientPin.make({
              ...request.observations.stable.observation.pilot.client,
              version: `2.11.4-${Str.repeat(cacheProducerImportMaxBytes)("x")}`,
            }),
          }),
        }),
      }),
    },
  });
  expect((yield* persistCacheProducerAcceptance(directory, oversized, trust).pipe(Effect.flip)).message).toContain(
    "request exceeds"
  );
  const read = CacheRuntimeFileGuards.readContainedFileBytesNoFollow;
  const missing = vi
    .spyOn(CacheRuntimeFileGuards, "readContainedFileBytesNoFollow")
    .mockImplementation((...args) => read(...args).pipe(Effect.map((result) => ({ ...result, contents: O.none() }))));
  const missingError = yield* readCacheProducerAcceptance(directory, reference, trust).pipe(
    Effect.flip,
    Effect.ensuring(Effect.sync(() => missing.mockRestore()))
  );
  expect(missingError.message).toContain("record is missing");
  const failedLink = persistCacheProducerAcceptance(directory, request, trust).pipe(
    Effect.provideService(FileSystem.FileSystem, {
      ...fs,
      link: (_source, destination) => fs.link(path.join(directory, "absent-source"), destination),
    }),
    Effect.result
  );
  (yield* failedLink).pipe(Result.isFailure, assertTrue);
  expect(yield* fs.readFileString(file)).toBe(original);
  expect(yield* fs.readDirectory(directory)).toEqual([`${reference.sha256}.json`]);
});

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer, PublishedContentClient), {
  concurrent: false,
  timeout: "30 seconds",
})("authenticated import preview", (it) => {
  it.effect("accepts only a fully covered approved policy and preserves envelope expiry", () =>
    Effect.gen(function* () {
      const { fs, path, root, contract, trust, published } = yield* publishedSetup;
      const { request } = published;
      const legacy = CacheProducerImportRequest.make({ observations: request.observations });
      expect((yield* previewCacheProducerImport(legacy, trust)).failures).toEqual([
        "stable:missing-hosted-publication",
        "canary:missing-hosted-publication",
      ]);
      expect(yield* validateCacheProducerImport(legacy, trust).pipe(Effect.isFailure)).toBe(true);
      expect(yield* Ref.get(published.reads)).toBe(0);
      expect((yield* validateCacheProducerImport(request, trust).pipe(Effect.flip)).message).toContain(
        "not configured"
      );
      yield* Effect.gen(function* () {
        const result = yield* validateCacheProducerImport(request, trust);
        expect(result.failures).toEqual([]);
        expect(result.contract).toEqual(contract);
        expect(A.sort(yield* fs.readDirectory(root), Str.Order)).toEqual(["canary", "stable"]);
        const directory = path.join(root, "accepted");
        yield* fs.makeDirectory(directory, { mode: 0o700 });
        const reference = yield* persistCacheProducerAcceptance(directory, request, trust);
        expect(yield* persistCacheProducerAcceptance(directory, request, trust)).toEqual(reference);
        expect((yield* readCacheProducerAcceptance(directory, reference, trust)).contract).toEqual(contract);
        const publications = O.getOrThrow(request.publications);
        const corrupted = new Uint8Array(publications.stable.archive);
        corrupted[0] = 0;
        for (const substituted of [
          CacheProducerPublication.make({
            ...publications.stable,
            reference: CacheHostedProducerReference.make({ ...publications.stable.reference, artifactId: 999 }),
          }),
          CacheProducerPublication.make({ ...publications.stable, archive: corrupted }),
          publications.canary,
        ]) {
          const changed = CacheProducerImportRequest.make({
            ...request,
            publications: O.some({ ...publications, stable: substituted }),
          });
          expect(yield* validateCacheProducerImport(changed, trust).pipe(Effect.isFailure)).toBe(true);
        }
        const attempt = published.channels.stable.run.run_attempt;
        published.channels.stable.run.run_attempt = attempt + 1;
        expect(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.isFailure)).toBe(true);
        published.channels.stable.run.run_attempt = attempt;
        expect((yield* readCacheProducerAcceptance(directory, reference, trust)).contract).toEqual(contract);
        const privateApproval = path.join(trust.stable, "publication.json");
        const readsBeforeUnsafeApproval = yield* Ref.get(published.reads);
        yield* fs.chmod(privateApproval, 0o644);
        expect(yield* validateCacheProducerImport(request, trust).pipe(Effect.isFailure)).toBe(true);
        expect(yield* Ref.get(published.reads)).toBe(readsBeforeUnsafeApproval);
        yield* fs.chmod(privateApproval, 0o600);
        yield* checkStoreBounds(directory, reference, request, trust);
        const file = path.join(directory, `${reference.sha256}.json`);
        const original = yield* fs.readFileString(file);
        expect(yield* fs.readDirectory(directory)).toEqual([`${reference.sha256}.json`]);
        yield* fs.chmod(file, 0o644);
        (yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        yield* fs.chmod(file, 0o600);
        yield* fs.writeFileString(file, "{}");
        (yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        (yield* persistCacheProducerAcceptance(directory, request, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        expect(yield* fs.readFileString(file)).toBe("{}");
        yield* fs.writeFileString(file, original);
        const moved = path.join(root, "moved-record.json");
        yield* fs.rename(file, moved);
        yield* fs.symlink(moved, file);
        (yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        yield* fs.remove(file);
        yield* fs.rename(moved, file);
        const alias = path.join(root, "alias");
        yield* fs.symlink(directory, alias);
        (yield* readCacheProducerAcceptance(alias, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        const hardlink = path.join(root, "hardlink.json");
        yield* fs.link(file, hardlink);
        (yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        yield* fs.remove(hardlink);
        const forged = CacheProducerImportRequest.make({
          ...request,
          observations: {
            stable: request.observations.canary,
            canary: request.observations.stable,
          },
        });
        const forgedText = yield* S.encodeEffect(ProducerImportRequestJson)(forged);
        const forgedReference = CacheProducerAcceptanceReference.make({
          sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(forgedText)),
        });
        yield* fs.writeFileString(path.join(directory, `${forgedReference.sha256}.json`), forgedText, {
          mode: 0o600,
          flag: "wx",
        });
        (yield* readCacheProducerAcceptance(directory, forgedReference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        yield* TestClock.adjust("25 hours");
        (yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        expect(yield* fs.exists(file)).toBe(true);
        (yield* validateCacheProducerImport(request, trust).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      }).pipe(Effect.provideService(CacheHostedProducerVerifier, published.verifier));
    })
  );

  it.effect("rejects replaced independent approvals before and during publication verification", () =>
    Effect.gen(function* () {
      const { fs, path, trust, published } = yield* publishedSetup;
      const file = path.join(trust.stable, "publication.json");
      const original = yield* fs.readFileString(file);
      yield* fs.writeFileString(file, yield* encodeHostedApproval(published.channels.canary.approval));
      const mismatch = yield* validateCacheProducerImport(published.request, trust).pipe(
        Effect.provideService(CacheHostedProducerVerifier, published.verifier),
        Effect.flip
      );
      expect(mismatch.message).toContain("independently authenticated channel binding");
      expect(yield* Ref.get(published.reads)).toBe(0);
      yield* fs.writeFileString(file, original);
      const changed = CacheHostedProducerApproval.make({
        ...published.channels.stable.approval,
        workflowSha256: Sha256Hex.make(Str.repeat(64)("0")),
      });
      const changedText = yield* encodeHostedApproval(changed);
      for (const replacingDuring of [trust.stable, trust.canary]) {
        const replacing = CacheHostedProducerVerifier.of({
          verify: Effect.fn("AcceptanceTest.replaceApproval")(function* (
            ...args: Parameters<typeof published.verifier.verify>
          ) {
            const observation = yield* published.verifier.verify(...args);
            if (args[0] === replacingDuring)
              yield* fs
                .writeFileString(file, changedText)
                .pipe(CacheCommandError.mapError("Fixture approval write failed."));
            return observation;
          }),
        });
        const raced = yield* validateCacheProducerImport(published.request, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, replacing),
          Effect.result
        );
        raced.pipe(Result.isFailure, assertTrue);
        if (Result.isFailure(raced))
          expect(raced.failure.message).toContain("approval changed during acceptance verification");
        yield* fs.writeFileString(file, original);
      }
      expect(
        (yield* validateCacheProducerImport(published.request, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, published.verifier)
        )).failures
      ).toEqual([]);
    })
  );

  it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated complete publication observation", (it) => {
    it.effect("binds the entire authenticated observation and its exact owned upload to publication", () =>
      Effect.gen(function* () {
        const { trust, published } = yield* publishedSetup;
        const stable = published.channels.stable;
        yield* TestClock.adjust(Duration.millis(1));
        const reissued = CacheProducerObservation.make({
          observation: stable.observation.observation,
          envelope: yield* stable.issuer.issue(stable.observation.observation),
        });
        const changedObservation = CacheProducerImportRequest.make({
          ...published.request,
          observations: { ...published.request.observations, stable: reissued },
        });
        const digestMismatch = yield* validateCacheProducerImport(changedObservation, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, published.verifier),
          Effect.flip
        );
        expect(digestMismatch.message).toContain("complete observation bytes");
        const report = yield* buildCacheHostedProducerCompleteReport(
          stable.observation,
          CacheHostedProducerRunReference.make(stable.reference)
        );
        const upload = O.getOrThrow(stable.observation.observation.upload);
        const wrongUpload = CacheHostedProducerCompleteReport.make({
          ...report,
          uploads: [CacheHostedProducerUpload.make({ ...upload, archiveBytes: upload.archiveBytes + 1 })],
        });
        const archive = yield* zipProducerReport(yield* encodeCompleteReport(wrongUpload));
        stable.artifact.size_in_bytes = archive.byteLength;
        stable.artifact.digest = `sha256:${yield* S.decodeEffect(Sha256HexFromBytes)(archive)}`;
        const publications = O.getOrThrow(published.request.publications);
        const changedUpload = CacheProducerImportRequest.make({
          ...published.request,
          publications: O.some({
            ...publications,
            stable: CacheProducerPublication.make({ reference: stable.reference, archive }),
          }),
        });
        const uploadMismatch = yield* validateCacheProducerImport(changedUpload, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, published.verifier),
          Effect.flip
        );
        expect(uploadMismatch.message).toContain("complete observation's owned upload");
      })
    );
  });

  it.effect("rejects issuer revocation that occurs while hosted metadata is checked", () =>
    Effect.gen(function* () {
      const { fs, path, trust, published } = yield* publishedSetup;
      const digest = yield* Digest.Digest;
      const secureRandom = yield* SecureRandom.SecureRandom;
      const revoke = revokeCacheProducerIssuer(trust.stable).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.provideService(Digest.Digest, digest),
        Effect.provideService(SecureRandom.SecureRandom, secureRandom)
      );
      const revoking = CacheHostedProducerVerifier.of({
        verify: Effect.fn("AcceptanceTest.revokeDuringPublication")(function* (
          ...args: Parameters<typeof published.verifier.verify>
        ) {
          const observation = yield* published.verifier.verify(...args);
          if (args[0] === trust.canary) yield* revoke;
          return observation;
        }),
      });
      expect(
        yield* validateCacheProducerImport(published.request, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, revoking),
          Effect.isFailure
        )
      ).toBe(true);
    })
  );

  it.effect("keeps metadata authentication lazy and releases every verification scope", () =>
    Effect.gen(function* () {
      const { fs, path, root, trust, published } = yield* publishedSetup;
      const binary = path.join(root, "gh");
      yield* fs.writeFileString(
        binary,
        '#!/bin/sh\nprintf used > "$0.used"\nprintf "%s\\n" synthetic-test-github-token\n',
        { mode: 0o700 }
      );
      const opBinary = path.join(root, "op");
      yield* fs.writeFileString(opBinary, '#!/bin/sh\nprintf used > "$0.used"\nexit 73\n', { mode: 0o700 });
      const priorPath = yield* Config.String("PATH");
      const released = yield* Ref.make(0);
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue("Unexpected external network access in a controlled fixture");
      const client = vi.spyOn(GitHubClient, "layerFromToken").mockImplementation(() =>
        Layer.effect(
          GitHubClient,
          Effect.acquireRelease(Effect.succeed(published.client), () => Ref.update(released, (count) => count + 1))
        )
      );
      vi.stubEnv("PATH", `${root}:${priorPath}`);
      vi.stubEnv("GITHUB_TOKEN_REF", "op://synthetic-only/unavailable/field");
      yield* Effect.gen(function* () {
        const context = yield* Layer.build(CacheHostedProducerVerifierLive);
        const live = Context.get(context, CacheHostedProducerVerifier);
        const legacy = CacheProducerImportRequest.make({ observations: published.request.observations });
        expect((yield* previewCacheProducerImport(legacy, trust)).failures).toContain(
          "stable:missing-hosted-publication"
        );
        expect(client).not.toHaveBeenCalled();
        expect(yield* fs.exists(`${binary}.used`)).toBe(false);
        yield* validateCacheProducerImport(published.request, trust).pipe(
          Effect.provideService(CacheHostedProducerVerifier, live)
        );
        expect(client).toHaveBeenCalledTimes(2);
        expect(yield* Ref.get(released)).toBe(2);
        expect(yield* fs.exists(`${binary}.used`)).toBe(true);
        const publications = O.getOrThrow(published.request.publications);
        const altered = new Uint8Array(publications.stable.archive);
        altered[0] = 0;
        const corrupt = CacheProducerImportRequest.make({
          ...published.request,
          publications: O.some({
            ...publications,
            stable: CacheProducerPublication.make({ ...publications.stable, archive: altered }),
          }),
        });
        expect(
          yield* validateCacheProducerImport(corrupt, trust).pipe(
            Effect.provideService(CacheHostedProducerVerifier, live),
            Effect.isFailure
          )
        ).toBe(true);
        expect(yield* Ref.get(released)).toBe(3);
        expect(network).not.toHaveBeenCalled();
        expect(yield* fs.exists(`${opBinary}.used`)).toBe(false);
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
        Effect.ensuring(
          Effect.sync(() => {
            client.mockRestore();
            network.mockRestore();
            vi.unstubAllEnvs();
          })
        )
      );
    })
  );

  it.effect("authenticates both channels and rejects swapped trust, mismatched policies and revocation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const { bundle, approval } = yield* setup;
      const canary = yield* S.decodeUnknownEffect(CacheProducerBundle)(canaryInput);
      const canaryBinding = CacheProducerBinding.make({
        ...approval.binding,
        channel: "canary",
        client: canary.pilot.client,
        protocolClient: canary.protocol.observation.client,
      });
      const trust = CacheProducerTrustLocations.make({
        stable: path.join(root, "stable"),
        canary: path.join(root, "canary"),
      });
      const stableIssuer = yield* initializeCacheProducerIssuer(trust.stable, approval.binding, approval.contract);
      const canaryIssuer = yield* initializeCacheProducerIssuer(trust.canary, canaryBinding, approval.contract);
      const request = CacheProducerImportRequest.make({
        observations: {
          stable: CacheProducerObservation.make({ observation: bundle, envelope: yield* stableIssuer.issue(bundle) }),
          canary: CacheProducerObservation.make({ observation: canary, envelope: yield* canaryIssuer.issue(canary) }),
        },
      });
      const preview = yield* previewCacheProducerImport(request, trust);
      expect(preview.authority).toBe("authenticated-import-preview-only");
      expect(preview.contract).toEqual(approval.contract);
      (yield* validateCacheProducerImport(request, trust).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      const deniedDirectory = path.join(root, "denied-import");
      (yield* persistCacheProducerAcceptance(deniedDirectory, request, trust).pipe(Effect.result)).pipe(
        Result.isFailure,
        assertTrue
      );
      expect(yield* fs.exists(deniedDirectory)).toBe(false);
      for (const channel of ["stable", "canary"]) {
        expect(preview.failures).not.toContain(`${channel}:missing-capture-safety`);
        expect(preview.failures).not.toContain(`${channel}:missing-trust`);
        expect(preview.failures).not.toContain(`${channel}:missing-isolated-fresh-fresh`);
        expect(preview.failures).not.toContain(`${channel}:missing-shadow-decisions`);
      }
      expect(A.sort(yield* fs.readDirectory(root), Str.Order)).toEqual(["canary", "stable"]);
      const swapped = yield* previewCacheProducerImport(
        request,
        CacheProducerTrustLocations.make({ stable: trust.canary, canary: trust.stable })
      ).pipe(Effect.result);
      swapped.pipe(Result.isFailure, assertTrue);
      const changedContract = CacheTaskContract.make({ ...approval.contract, negativeCases: ["other-policy"] });
      const changedBinding = CacheProducerBinding.make({
        ...canaryBinding,
        policyDigest: yield* hashCacheProducerContract(changedContract),
      });
      const changedDirectory = path.join(root, "changed-policy");
      const changedIssuer = yield* initializeCacheProducerIssuer(changedDirectory, changedBinding, changedContract);
      const changedReport = CacheProducerObservation.make({
        observation: canary,
        envelope: yield* changedIssuer.issue(canary),
      });
      const mismatched = yield* previewCacheProducerImport(
        CacheProducerImportRequest.make({ observations: { ...request.observations, canary: changedReport } }),
        CacheProducerTrustLocations.make({ stable: trust.stable, canary: changedDirectory })
      ).pipe(Effect.result);
      mismatched.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(mismatched)) expect(mismatched.failure.message).toContain("same reviewed task contract");
      yield* revokeCacheProducerIssuer(trust.canary);
      (yield* previewCacheProducerImport(request, trust).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects one authenticated stable report reused as both channels", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const directory = path.join(root, "issuer");
      const { bundle, approval } = yield* setup;
      const issuer = yield* initializeCacheProducerIssuer(directory, approval.binding, approval.contract);
      const report = CacheProducerObservation.make({ observation: bundle, envelope: yield* issuer.issue(bundle) });
      const request = CacheProducerImportRequest.make({ observations: { stable: report, canary: report } });
      const result = yield* previewCacheProducerImport(
        request,
        CacheProducerTrustLocations.make({ stable: directory, canary: directory })
      ).pipe(Effect.result);
      result.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(result)) expect(result.failure.message).toContain("Import channel does not match");
      expect(yield* fs.readDirectory(root)).toEqual(["issuer"]);
    })
  );
});
