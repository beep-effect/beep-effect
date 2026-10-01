import { CacheProducerBinding, CacheProducerBundle } from "@beep/repo-cli/commands/Cache";
import {
  CacheProducerAcceptanceReference,
  CacheProducerImportRequest,
  CacheProducerObservation,
  CacheProducerTrustLocations,
  hashCacheProducerContract,
  initializeCacheProducerIssuer,
  readCacheProducerAcceptance,
  revokeCacheProducerIssuer,
} from "@beep/repo-cli/test/Cache";
import { CacheTaskContract } from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canaryInput, contractInput, input } from "./helpers/cache-producer-bundle-fixture.ts";

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer), {
  timeout: "30 seconds",
  excludeTestServices: true,
})("native acceptance CLI", (it) => {
  it.effect("accepts complete CLI bundles larger than 64 KiB and refuses revoked issuers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        directory: process.cwd(),
        prefix: ".qualification-accept-cli-",
      });
      const bundle = yield* S.decodeUnknownEffect(CacheProducerBundle)(input);
      const canary = yield* S.decodeUnknownEffect(CacheProducerBundle)(canaryInput);
      const contract = yield* S.decodeUnknownEffect(CacheTaskContract)({
        ...contractInput,
        semanticInputClasses: ["source-comment"],
      });
      const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
        ...input.pilot,
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
      const requestPath = path.join(root, "request.json");
      const referencePath = path.join(root, "reference.json");
      yield* fs.writeFileString(
        requestPath,
        yield* S.encodeEffect(S.fromJsonString(CacheProducerImportRequest))(request),
        { mode: 0o600 }
      );
      const args = [
        "bun",
        "run",
        "src/bin.ts",
        "--",
        "cache",
        "accept",
        "--request",
        requestPath,
        "--output",
        referencePath,
      ];
      const env = {
        ...process.env,
        BEEP_CACHE_ACCEPTANCE_STORE: directory,
        BEEP_CACHE_STABLE_ISSUER_STORE: trust.stable,
        BEEP_CACHE_CANARY_ISSUER_STORE: trust.canary,
      };
      const accepted = Bun.spawnSync(args, { env, stdout: "pipe", stderr: "pipe" });
      expect((yield* fs.stat(requestPath)).size).toBeGreaterThan(BigInt(64 * 1024));
      expect(accepted.exitCode).toBe(0);
      const marker = yield* fs.readFileString(referencePath);
      const reference = yield* S.decodeEffect(S.fromJsonString(CacheProducerAcceptanceReference))(marker);
      const result = yield* readCacheProducerAcceptance(directory, reference, trust);
      expect(result.contract).toEqual(contract);
      expect(result.failures).toEqual([]);
      expect(yield* fs.readDirectory(directory)).toEqual([`${reference.sha256}.json`]);
      const alteredReferences = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Sha256Hex),
        (sha256) =>
          Effect.gen(function* () {
            const altered = CacheProducerAcceptanceReference.make({ ...reference, sha256 });
            expect(yield* readCacheProducerAcceptance(directory, altered, trust).pipe(Effect.isSuccess)).toBe(
              sha256 === reference.sha256
            );
            expect(yield* fs.readFileString(referencePath)).toBe(marker);
            return true;
          }),
        fcRuns(10)
      );
      expect(alteredReferences._tag).toBe("Passed");
      yield* revokeCacheProducerIssuer(trust.canary);
      const revoked = Bun.spawnSync(args, { env, stdout: "pipe", stderr: "pipe" });
      expect(revoked.exitCode).not.toBe(0);
      expect(yield* fs.readFileString(referencePath)).toBe(marker);
    })
  );
});
