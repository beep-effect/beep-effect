import { CacheProducerApproval, CacheProducerBinding, CacheProducerBundle } from "@beep/repo-cli/commands/Cache";
import {
  CacheProducerAcceptanceReference,
  CacheProducerImportRequest,
  CacheProducerObservation,
  CacheProducerTrustLocations,
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
  CacheEvidenceReference,
  CacheSignedExecutionProfile,
  CacheTaskContract,
  cachePromotionFailures,
} from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { canaryInput, contractInput, input } from "./helpers/cache-producer-bundle-fixture.ts";

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
it.layer(NodeCrypto.layer)("producer evidence projections", (it) => {
  it.effect("rejects signed approval with an omitted profile or activation even after rehashing policy", () =>
    Effect.gen(function* () {
      const { approval } = yield* setup;
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
      }
    })
  );

  it.effect("requires schema-generated source configuration identities to match producer approval", () =>
    Effect.gen(function* () {
      const { bundle, approval } = yield* setup;
      const checked = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Sha256Hex),
        (configurationDigest) =>
          Effect.gen(function* () {
            const altered = CacheProducerBundle.make({
              ...bundle,
              pilot: { ...bundle.pilot, configurationDigest },
            });
            expect(yield* deriveCacheProducerEvidence(altered, approval).pipe(Effect.isSuccess)).toBe(
              configurationDigest === bundle.pilot.configurationDigest
            );
            return true;
          }),
        fcRuns(20)
      );
      expect(checked._tag).toBe("Passed");
    })
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
      const negative = A.flatMap(
        A.filter(observations, (row) => row.kind === "negative-case"),
        (row) => row.subjects
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
      const semantic = A.flatMap(
        A.filter(observations, (row) => row.kind === "semantic-invalidation"),
        (row) => row.subjects
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
      expect(Result.isFailure(yield* deriveCacheProducerEvidence(bundle, changed).pipe(Effect.result))).toBe(true);
      const policy = CacheProducerApproval.make({
        ...approval,
        contract: CacheTaskContract.make({ ...approval.contract, negativeCases: ["weaker"] }),
      });
      expect(Result.isFailure(yield* deriveCacheProducerEvidence(bundle, policy).pipe(Effect.result))).toBe(true);
    })
  );
});

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer))("authenticated import preview", (it) => {
  it.effect("accepts only a fully covered approved policy and preserves envelope expiry", () =>
    Effect.gen(function* () {
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
      const stableIssuer = yield* initializeCacheProducerIssuer(trust.stable, binding, contract);
      const canaryIssuer = yield* initializeCacheProducerIssuer(trust.canary, canaryBinding, contract);
      const request = CacheProducerImportRequest.make({
        observations: {
          stable: CacheProducerObservation.make({ observation: bundle, envelope: yield* stableIssuer.issue(bundle) }),
          canary: CacheProducerObservation.make({ observation: canary, envelope: yield* canaryIssuer.issue(canary) }),
        },
      });
      const result = yield* validateCacheProducerImport(request, trust);
      expect(result.failures).toEqual([]);
      expect(result.contract).toEqual(contract);
      expect(A.sort(yield* fs.readDirectory(root), Str.Order)).toEqual(["canary", "stable"]);
      const directory = path.join(root, "accepted");
      yield* fs.makeDirectory(directory, { mode: 0o700 });
      const reference = yield* persistCacheProducerAcceptance(directory, request, trust);
      expect(yield* persistCacheProducerAcceptance(directory, request, trust)).toEqual(reference);
      expect((yield* readCacheProducerAcceptance(directory, reference, trust)).contract).toEqual(contract);
      const file = path.join(directory, `${reference.sha256}.json`);
      const original = yield* fs.readFileString(file);
      expect(yield* fs.readDirectory(directory)).toEqual([`${reference.sha256}.json`]);
      yield* fs.chmod(file, 0o644);
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result))
      ).toBe(true);
      yield* fs.chmod(file, 0o600);
      yield* fs.writeFileString(file, "{}");
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result))
      ).toBe(true);
      expect(
        Result.isFailure(yield* persistCacheProducerAcceptance(directory, request, trust).pipe(Effect.result))
      ).toBe(true);
      expect(yield* fs.readFileString(file)).toBe("{}");
      yield* fs.writeFileString(file, original);
      const moved = path.join(root, "moved-record.json");
      yield* fs.rename(file, moved);
      yield* fs.symlink(moved, file);
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result))
      ).toBe(true);
      yield* fs.remove(file);
      yield* fs.rename(moved, file);
      const alias = path.join(root, "alias");
      yield* fs.symlink(directory, alias);
      expect(Result.isFailure(yield* readCacheProducerAcceptance(alias, reference, trust).pipe(Effect.result))).toBe(
        true
      );
      const hardlink = path.join(root, "hardlink.json");
      yield* fs.link(file, hardlink);
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result))
      ).toBe(true);
      yield* fs.remove(hardlink);
      const forged = CacheProducerImportRequest.make({
        observations: {
          stable: request.observations.canary,
          canary: request.observations.stable,
        },
      });
      const forgedText = yield* S.encodeEffect(S.fromJsonString(CacheProducerImportRequest))(forged);
      const forgedReference = CacheProducerAcceptanceReference.make({
        sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(forgedText)),
      });
      yield* fs.writeFileString(path.join(directory, `${forgedReference.sha256}.json`), forgedText, {
        mode: 0o600,
        flag: "wx",
      });
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, forgedReference, trust).pipe(Effect.result))
      ).toBe(true);
      yield* TestClock.adjust("25 hours");
      expect(
        Result.isFailure(yield* readCacheProducerAcceptance(directory, reference, trust).pipe(Effect.result))
      ).toBe(true);
      expect(yield* fs.exists(file)).toBe(true);
      expect(Result.isFailure(yield* validateCacheProducerImport(request, trust).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
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
      expect(Result.isFailure(yield* validateCacheProducerImport(request, trust).pipe(Effect.result))).toBe(true);
      const deniedDirectory = path.join(root, "denied-import");
      expect(
        Result.isFailure(yield* persistCacheProducerAcceptance(deniedDirectory, request, trust).pipe(Effect.result))
      ).toBe(true);
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
      expect(Result.isFailure(swapped)).toBe(true);
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
      expect(Result.isFailure(mismatched)).toBe(true);
      if (Result.isFailure(mismatched)) expect(mismatched.failure.message).toContain("same reviewed task contract");
      yield* revokeCacheProducerIssuer(trust.canary);
      expect(Result.isFailure(yield* previewCacheProducerImport(request, trust).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
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
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) expect(result.failure.message).toContain("Import channel does not match");
      expect(yield* fs.readDirectory(root)).toEqual(["issuer"]);
    }).pipe(Effect.scoped)
  );
});
