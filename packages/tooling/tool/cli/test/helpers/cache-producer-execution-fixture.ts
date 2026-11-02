/** Shared independently approved synthetic upload profile and private issuer fixture. */
import { CacheConformanceTarget, CacheProducerBinding } from "@beep/repo-cli/commands/Cache";
import {
  CacheProducerAdapterLaunch,
  CacheProducerExecutionProfile,
  CacheProducerUploadRuntime,
  hashCacheProducerContract,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
  initializeCacheProducerIssuer,
} from "@beep/repo-cli/test/Cache";
import { CacheTaskContract } from "@beep/repo-configs/cache";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { bearers, targetFor } from "../cache-conformance-server.ts";
import { input as bundleInput, contractInput } from "./cache-producer-bundle-fixture.ts";

const namespace = "team_beep_signed_canary_v1";
const decodeContract = S.decodeUnknownEffect(CacheTaskContract);
const encodeExecutionProfile = S.encodeEffect(S.fromJsonString(CacheProducerExecutionProfile));

/** Build the independently hashed synthetic upload profile. */
export const makeProducerUploadRuntimeFixture = Effect.fn("ProducerUploadRuntimeTest.fixture")(function* () {
  const target = CacheConformanceTarget.make({
    ...targetFor({ url: "http://127.0.0.1:19427/" }),
    namespace: { teamId: namespace, foreignTeamId: "team_foreign_upload_test" },
    backend: { id: "fixture-adapter", release: "fixture", digest: Str.repeat(64)("d") },
    storage: O.some({
      endpoint: yield* S.decodeEffect(S.URLFromString)(`https://${Str.repeat(32)("0")}.r2.cloudflarestorage.com/`),
      bucket: "beep-turbo-r2-pilot",
    }),
  });
  const runtime = CacheProducerUploadRuntime.make({
    target,
    bearers,
    signing: Redacted.make("synthetic-upload-key"),
    adapter: O.some(
      CacheProducerAdapterLaunch.make({
        executable: "/fixture/adapter",
        accessKey: Redacted.make("synthetic-storage-id"),
        secretKey: Redacted.make("synthetic-storage-secret"),
      })
    ),
  });
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...bundleInput.pilot,
    client: { ...bundleInput.pilot.client, namespace },
    protocolClient: bundleInput.protocol.observation.client,
    workflowRevision: Str.repeat(40)("a"),
    workflowImplementation: Str.repeat(64)("b"),
    policyDigest: Str.repeat(64)("c"),
    uploadApproval: {
      targetSha256: yield* hashCacheProducerUploadTarget(target),
      artifactKeySha256: yield* hashCacheProducerUploadKey(runtime.signing),
    },
  });
  return Tuple.make(binding, runtime);
});

/** Install its private execution material without any cloud capability. */
export const makeProducerExecutionFixture = Effect.fn("ProducerUploadRuntimeTest.executionFixture")(function* (
  withUploadApproval: typeof S.Boolean.Type = true
) {
  const [original, runtime] = yield* makeProducerUploadRuntimeFixture();
  const before = yield* decodeContract(contractInput);
  const contract = CacheTaskContract.make({ ...before, clients: { ...before.clients, stable: original.client } });
  const binding = CacheProducerBinding.make({
    ...original,
    uploadApproval: withUploadApproval ? original.uploadApproval : O.none(),
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped();
  const directory = path.join(parent, "issuer");
  yield* initializeCacheProducerIssuer(directory, binding, contract);
  const adapter = O.getOrThrow(runtime.adapter);
  const profile = CacheProducerExecutionProfile.make({ target: runtime.target, adapterExecutable: adapter.executable });
  const file = path.join(directory, "runtime.json");
  yield* fs.writeFileString(file, yield* encodeExecutionProfile(profile), { mode: 0o600 });
  const names = profile.target.credentials;
  const environment = {
    TURBO_REMOTE_CACHE_SIGNATURE_KEY: Redacted.value(runtime.signing),
    R2_ACCESS_KEY_ID: Redacted.value(adapter.accessKey),
    R2_SECRET_ACCESS_KEY: Redacted.value(adapter.secretKey),
    [names.reader]: Redacted.value(runtime.bearers.reader),
    [names.writer]: Redacted.value(runtime.bearers.writer),
    [names.foreign]: Redacted.value(runtime.bearers.foreign),
    [names.unknown]: Redacted.value(runtime.bearers.unknown),
  };
  return { fs, path, directory, file, profile, binding, runtime, environment, contract };
});
