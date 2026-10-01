import {
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheProducerEnvelope,
} from "@beep/repo-cli/commands/Cache";
import {
  hashCacheProducerContract,
  initializeCacheProducerIssuer,
  makeCacheProducerIssuer,
  openCacheProducerIssuer,
  openCacheProducerVerifier,
  revokeCacheProducerIssuer,
} from "@beep/repo-cli/test/Cache";
import { CacheTaskContract } from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { input as bundleInput, contractInput, pilot as input } from "./helpers/cache-producer-bundle-fixture.ts";

const contract = S.decodeUnknownSync(CacheTaskContract)(contractInput);
const setup = Effect.fn("ProducerTest.setup")(function* () {
  const receipt = yield* S.decodeUnknownEffect(CacheProducerBundle)(bundleInput);
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...input,
    protocolClient: bundleInput.protocol.observation.client,
    workflowRevision: Str.repeat(40)("a"),
    workflowImplementation: Str.repeat(64)("b"),
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  const issuer = yield* makeCacheProducerIssuer(binding);
  const envelope = yield* issuer.issue(receipt);
  const encoded = yield* S.encodeEffect(CacheProducerEnvelope)(envelope);
  return { receipt, binding, issuer, envelope, encoded };
});
it.layer(NodeCrypto.layer)("closed producer issuer", (it) => {
  it.effect("authenticates every schema-generated policy digest against the issued envelope", () =>
    Effect.gen(function* () {
      const { issuer, receipt, envelope } = yield* setup();
      const checked = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Sha256Hex),
        (policyDigest) =>
          Effect.gen(function* () {
            const altered = CacheProducerEnvelope.make({
              ...envelope,
              body: { ...envelope.body, binding: { ...envelope.body.binding, policyDigest } },
            });
            expect(yield* issuer.verify(altered, receipt).pipe(Effect.isSuccess)).toBe(
              policyDigest === envelope.body.binding.policyDigest
            );
            return true;
          }),
        fcRuns(20)
      );
      expect(checked._tag).toBe("Passed");
    })
  );

  it.effect("rejects legacy receipts and missing measured projection identities", () =>
    Effect.gen(function* () {
      for (const patch of [
        { schemaVersion: "cache-pilot-signed/v8" },
        { activatedConfigurationDigest: undefined },
        { signedConfigurationDigest: undefined },
      ])
        expect(
          yield* S.decodeUnknownEffect(CacheProducerBundle)({
            ...bundleInput,
            pilot: { ...input, ...patch },
          }).pipe(Effect.isFailure)
        ).toBe(true);
    })
  );
  it.effect("authenticates conformance bytes together with the pilot and refuses incomplete bundles", () =>
    Effect.gen(function* () {
      const { issuer, envelope } = yield* setup();
      const changed = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...bundleInput,
        protocol: {
          ...bundleInput.protocol,
          observation: {
            ...bundleInput.protocol.observation,
            runs: A.map(bundleInput.protocol.observation.runs, (run, index) =>
              index === 0 ? { ...run, summary: Str.repeat(64)("f") } : run
            ),
          },
        },
      });
      // This remains valid conformance; its bytes are not the authenticated payload.
      yield* issuer.issue(changed);
      expect(Result.isFailure(yield* issuer.verify(envelope, changed).pipe(Effect.result))).toBe(true);
      const incomplete = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...bundleInput,
        protocol: { ...bundleInput.protocol, events: [] },
      });
      expect(Result.isFailure(yield* issuer.issue(incomplete).pipe(Effect.result))).toBe(true);
    })
  );
  it.effect("authenticates a bound observation without exporting keys", () =>
    Effect.gen(function* () {
      const { issuer, receipt, envelope } = yield* setup();
      expect(yield* issuer.verify(envelope, receipt)).toEqual(receipt);
      expect(R.keys(issuer)).toEqual(["issue", "verify"]);
    })
  );
  it.effect("rejects edited envelopes, identities and validity windows", () =>
    Effect.gen(function* () {
      const { issuer, receipt, encoded } = yield* setup();
      for (const value of [
        { ...encoded, mac: Str.repeat(64)("0") },
        { ...encoded, body: { ...encoded.body, expiresAtMs: 0 } },
        { ...encoded, body: { ...encoded.body, issuedAtMs: 1000 } },
        ...A.map(
          [
            { ...encoded.body.binding, sourceRevision: Str.repeat(40)("0") },
            { ...encoded.body.binding, workflowRevision: Str.repeat(40)("0") },
            { ...encoded.body.binding, workflowImplementation: Str.repeat(64)("0") },
            { ...encoded.body.binding, policyDigest: Str.repeat(64)("0") },
            { ...encoded.body.binding, key: { ...encoded.body.binding.key, profile: "other" } },
            { ...encoded.body.binding, key: { ...encoded.body.binding.key, epoch: "other" } },
          ],
          (binding) => ({ ...encoded, body: { ...encoded.body, binding } })
        ),
      ]) {
        const envelope = yield* S.decodeUnknownEffect(CacheProducerEnvelope)(value);
        expect(Result.isFailure(yield* issuer.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      }
    })
  );
  it.effect("rejects a changed payload and an unknown issuer", () =>
    Effect.gen(function* () {
      const { issuer, receipt, binding, envelope } = yield* setup();
      const other = yield* makeCacheProducerIssuer(binding);
      expect(Result.isFailure(yield* other.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      const changed = yield* S.decodeUnknownEffect(CacheProducerBundle)({
        ...bundleInput,
        pilot: { ...input, sourceRevision: Str.repeat(40)("0") },
      });
      expect(Result.isFailure(yield* issuer.verify(envelope, changed).pipe(Effect.result))).toBe(true);
    })
  );
  it.effect("refuses to issue against incorrect source, client, runtime and epoch", () =>
    Effect.gen(function* () {
      const { issuer } = yield* setup();
      for (const patch of [
        { sourceRevision: Str.repeat(40)("0") },
        { channel: "canary" },
        { runtimeKeyDigest: Str.repeat(64)("0") },
        { client: { ...input.client, sha256: Str.repeat(64)("0") } },
        { configurationDigest: Str.repeat(64)("0") },
        { activatedConfigurationDigest: Str.repeat(64)("0") },
        { signedConfigurationDigest: Str.repeat(64)("0") },
        { toolchainDigest: Str.repeat(64)("0") },
        { signedRootConfiguration: Str.repeat(64)("0") },
        { key: { ...input.key, epoch: "other" }, baseKey: { ...input.baseKey, epoch: "other" } },
      ]) {
        const receipt = yield* S.decodeUnknownEffect(CacheProducerBundle)({
          ...bundleInput,
          pilot: { ...input, ...patch },
        });
        expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      }
    })
  );
  it.effect("refuses duplicated pairs and rejected uploads before authentication", () =>
    Effect.gen(function* () {
      const { issuer } = yield* setup();
      for (const pairs of [
        A.map(input.pairs, () => input.pairs[0]),
        A.map(input.pairs, (pair) => ({
          ...pair,
          events: A.map(pair.events, (event) => (event.operation === "put" ? { ...event, status: 403 } : event)),
        })),
        A.map(input.pairs, (pair) => ({ ...pair, events: [] })),
      ]) {
        const receipt = yield* S.decodeUnknownEffect(CacheProducerBundle)({
          ...bundleInput,
          pilot: { ...input, pairs },
        });
        expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      }
    })
  );
  it.effect("does not share trusted configuration with callers or returned envelopes", () =>
    Effect.gen(function* () {
      const { issuer, receipt, binding, envelope } = yield* setup();
      yield* Effect.sync(() => {
        Reflect.set(binding, "sourceRevision", Str.repeat(40)("0"));
        Reflect.set(envelope.body.binding, "sourceRevision", Str.repeat(40)("0"));
      });
      const fresh = yield* issuer.issue(receipt);
      expect(fresh.body.binding.sourceRevision).toBe(receipt.pilot.sourceRevision);
      expect(yield* issuer.verify(fresh, receipt)).toEqual(receipt);
    })
  );
  it.effect("expires a correctly authenticated envelope after its lifetime", () =>
    Effect.gen(function* () {
      const { issuer, receipt, envelope } = yield* setup();
      yield* TestClock.adjust("25 hours");
      expect(Result.isFailure(yield* issuer.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
    })
  );
});

const persistentSetup = Effect.fn("ProducerTest.persistentSetup")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped();
  const directory = path.join(parent, "issuer");
  const { receipt, binding } = yield* setup();
  const issuer = yield* initializeCacheProducerIssuer(directory, binding, contract);
  const envelope = yield* issuer.issue(receipt);
  return { fs, path, directory, receipt, binding, issuer, envelope };
});
it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer))("persistent producer issuer", (it) => {
  it.effect("reopens the same issuer and refuses accidental reprovisioning", () =>
    Effect.gen(function* () {
      const { directory, binding, receipt, envelope } = yield* persistentSetup();
      const reopened = yield* openCacheProducerIssuer(directory, binding);
      expect(yield* reopened.verify(envelope, receipt)).toEqual(receipt);
      expect(
        Result.isFailure(yield* initializeCacheProducerIssuer(directory, binding, contract).pipe(Effect.result))
      ).toBe(true);
      expect(yield* reopened.verify(envelope, receipt)).toEqual(receipt);
    }).pipe(Effect.scoped)
  );
  it.effect("cannot rebind an existing issuer by changing caller expectations", () =>
    Effect.gen(function* () {
      const { directory, binding, receipt, envelope } = yield* persistentSetup();
      for (const patch of [
        { sourceRevision: Str.repeat(40)("0") },
        { workflowRevision: Str.repeat(40)("0") },
        { workflowImplementation: Str.repeat(64)("0") },
        { policyDigest: Str.repeat(64)("0") },
        { channel: "canary" },
        { runtimeKeyDigest: Str.repeat(64)("0") },
        { client: { ...input.client, sha256: Str.repeat(64)("0") } },
        { configurationDigest: Str.repeat(64)("0") },
        { activatedConfigurationDigest: Str.repeat(64)("0") },
        { signedConfigurationDigest: Str.repeat(64)("0") },
        { toolchainDigest: Str.repeat(64)("0") },
        { signedRootConfiguration: Str.repeat(64)("0") },
        { key: { ...input.key, epoch: "other" } },
        { key: { ...input.key, profile: "other" } },
      ]) {
        const changed = yield* S.decodeUnknownEffect(CacheProducerBinding)({ ...binding, ...patch });
        const result = yield* openCacheProducerIssuer(directory, changed).pipe(Effect.result);
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) expect(result.failure.message).toContain("different workflow");
      }
      const reopened = yield* openCacheProducerIssuer(directory, binding);
      expect(yield* reopened.verify(envelope, receipt)).toEqual(receipt);
    }).pipe(Effect.scoped)
  );
  it.effect("revokes live instances and future opens", () =>
    Effect.gen(function* () {
      const { directory, binding, receipt, envelope, issuer } = yield* persistentSetup();
      yield* revokeCacheProducerIssuer(directory);
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* issuer.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      expect((yield* openCacheProducerIssuer(directory, binding).pipe(Effect.flip)).message).toBe(
        "Producer issuer is revoked."
      );
    }).pipe(Effect.scoped)
  );
  it.effect("fails closed for missing and replaced material without recreating it", () =>
    Effect.gen(function* () {
      const { fs, path, directory, binding, receipt, envelope, issuer } = yield* persistentSetup();
      const file = path.join(directory, "issuer.key");
      yield* fs.remove(file);
      expect(Result.isFailure(yield* openCacheProducerIssuer(directory, binding).pipe(Effect.result))).toBe(true);
      expect(yield* fs.exists(file)).toBe(false);
      yield* fs.remove(directory, { recursive: true });
      const replacement = yield* initializeCacheProducerIssuer(directory, binding, contract);
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* issuer.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* replacement.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("refuses permissive directories and files after an instance opens", () =>
    Effect.gen(function* () {
      const { fs, path, directory, receipt, issuer } = yield* persistentSetup();
      yield* fs.chmod(directory, 0o755);
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      yield* fs.chmod(directory, 0o700);
      yield* fs.chmod(path.join(directory, "issuer.key"), 0o644);
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("refuses symbolic and hard-linked material and dangling revocation markers", () =>
    Effect.gen(function* () {
      const { fs, path, directory, binding, receipt, issuer } = yield* persistentSetup();
      const file = path.join(directory, "issuer.key");
      const moved = path.join(directory, "original");
      yield* fs.rename(file, moved);
      yield* fs.symlink(moved, file);
      expect(Result.isFailure(yield* openCacheProducerIssuer(directory, binding).pipe(Effect.result))).toBe(true);
      yield* fs.remove(file);
      yield* fs.link(moved, file);
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
      yield* fs.remove(file);
      yield* fs.rename(moved, file);
      yield* fs.symlink(path.join(directory, "missing"), path.join(directory, "revoked"));
      expect(Result.isFailure(yield* issuer.issue(receipt).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("refuses a store reached through a symbolic directory alias", () =>
    Effect.gen(function* () {
      const { fs, path, directory, binding } = yield* persistentSetup();
      const alias = path.join(path.dirname(directory), "alias");
      yield* fs.symlink(directory, alias);
      expect(Result.isFailure(yield* openCacheProducerIssuer(alias, binding).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects truncated or oversized material before importing it", () =>
    Effect.gen(function* () {
      const { fs, path, directory, binding } = yield* persistentSetup();
      for (const length of [0, 32, 64, 95, 97, 1024]) {
        yield* fs.writeFile(path.join(directory, "issuer.key"), new Uint8Array(length));
        expect(Result.isFailure(yield* openCacheProducerIssuer(directory, binding).pipe(Effect.result))).toBe(true);
      }
    }).pipe(Effect.scoped)
  );
});

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer))("private approval verifier", (it) => {
  it.effect("rejects edited full obligations even when the submitted bundle is unchanged", () =>
    Effect.gen(function* () {
      const { fs, path, directory, receipt, envelope } = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      const file = path.join(directory, "approval.json");
      const approval = yield* S.decodeUnknownEffect(S.fromJsonString(CacheProducerApproval))(
        yield* fs.readFileString(file)
      );
      const changedContract = CacheTaskContract.make({ ...approval.contract, negativeCases: ["weaker-policy"] });
      for (const binding of [
        approval.binding,
        CacheProducerBinding.make({
          ...approval.binding,
          policyDigest: yield* hashCacheProducerContract(changedContract),
        }),
      ]) {
        const changed = CacheProducerApproval.make({ binding, contract: changedContract });
        yield* fs.writeFileString(file, yield* S.encodeEffect(S.fromJsonString(CacheProducerApproval))(changed));
        expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
        expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      }
    }).pipe(Effect.scoped)
  );
  it.effect("loads independent approval and exposes verification only", () =>
    Effect.gen(function* () {
      const { directory, receipt, envelope } = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      expect(R.keys(verifier)).toEqual(["verify"]);
      expect((yield* verifier.verify(envelope, receipt)).contract).toEqual(contract);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects an edited approval at open and through an existing verifier", () =>
    Effect.gen(function* () {
      const { fs, path, directory, binding, receipt, envelope } = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      const changed = yield* S.decodeUnknownEffect(CacheProducerBinding)({
        ...binding,
        policyDigest: Str.repeat(64)("0"),
      });
      yield* fs.writeFileString(
        path.join(directory, "approval.json"),
        yield* S.encodeEffect(S.fromJsonString(CacheProducerBinding))(changed)
      );
      expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("refuses missing approval without reconstructing it from submitted evidence", () =>
    Effect.gen(function* () {
      const { fs, path, directory, receipt, envelope } = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      const file = path.join(directory, "approval.json");
      yield* fs.remove(file);
      expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      expect(yield* fs.exists(file)).toBe(false);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects permissive, symbolic and hard-linked approval records", () =>
    Effect.gen(function* () {
      const { fs, path, directory, receipt, envelope } = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      const file = path.join(directory, "approval.json");
      const moved = path.join(directory, "original-approval.json");
      yield* fs.chmod(file, 0o644);
      expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      yield* fs.chmod(file, 0o600);
      yield* fs.rename(file, moved);
      yield* fs.symlink(moved, file);
      expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
      yield* fs.remove(file);
      yield* fs.link(moved, file);
      expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects malformed, invalid UTF-8 and oversized approval before verification", () =>
    Effect.gen(function* () {
      const { fs, path, directory } = yield* persistentSetup();
      for (const bytes of [
        new Uint8Array(),
        new Uint8Array([255]),
        new TextEncoder().encode("{}"),
        new Uint8Array(16385),
      ]) {
        yield* fs.writeFile(path.join(directory, "approval.json"), bytes);
        expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
      }
    }).pipe(Effect.scoped)
  );
  it.effect("honors revocation and rejects a receipt from a different provisioned issuer", () =>
    Effect.gen(function* () {
      const { directory, receipt, envelope } = yield* persistentSetup();
      const other = yield* persistentSetup();
      const verifier = yield* openCacheProducerVerifier(directory);
      expect(Result.isFailure(yield* verifier.verify(other.envelope, receipt).pipe(Effect.result))).toBe(true);
      yield* revokeCacheProducerIssuer(directory);
      expect(Result.isFailure(yield* verifier.verify(envelope, receipt).pipe(Effect.result))).toBe(true);
      expect(Result.isFailure(yield* openCacheProducerVerifier(directory).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
});
