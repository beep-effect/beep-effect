import { $RepoCliId } from "@beep/identity/packages";
import { CacheConformanceBearers, CacheConformanceTarget, CacheProducerBinding } from "@beep/repo-cli/commands/Cache";
import {
  assertCacheProducerUploadRuntime,
  CacheProducerAdapterLaunch,
  CacheProducerExecutionProfile,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  hashCacheProducerContract,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
  initializeCacheProducerIssuer,
  loadCacheProducerExecutionRuntime,
  revokeCacheProducerIssuer,
} from "@beep/repo-cli/test/Cache";
import { CacheTaskContract } from "@beep/repo-configs/cache";
import { LiteralKit } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { input as bundleInput, contractInput } from "./helpers/cache-producer-bundle-fixture.ts";

const namespace = "team_beep_signed_canary_v1";
const $I = $RepoCliId.create("test/cache-producer-upload-runtime");
const BackendCapability = LiteralKit(["reader", "writer", "foreign", "unknown", "accessKey", "secretKey"]).pipe(
  $I.annoteSchema("BackendCapability", {
    description: "Transport or storage capabilities that must not carry an artifact key.",
  })
);
const encodeTarget = S.encodeEffect(S.fromJsonString(CacheConformanceTarget));
const decodeContract = S.decodeUnknownEffect(CacheTaskContract);
const encodeExecutionProfile = S.encodeEffect(S.fromJsonString(CacheProducerExecutionProfile));
const fixture = Effect.fn("ProducerUploadRuntimeTest.fixture")(function* () {
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

it.layer(NodeCrypto.layer)("approved producer upload runtime", (it) => {
  it.effect.each(BackendCapability.literals)("keeps the artifact signing key out of backend %s", (role) =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      const aliased = Match.value(role).pipe(
        Match.whenOr("accessKey", "secretKey", (field) =>
          CacheProducerUploadRuntime.make({
            ...runtime,
            adapter: O.map(runtime.adapter, (adapter) =>
              CacheProducerAdapterLaunch.make({ ...adapter, [field]: runtime.signing })
            ),
          })
        ),
        Match.orElse((field) =>
          CacheProducerUploadRuntime.make({
            ...runtime,
            bearers: CacheConformanceBearers.make({ ...runtime.bearers, [field]: runtime.signing }),
          })
        )
      );
      assertTrue(yield* assertCacheProducerUploadRuntime(binding, O.some(aliased)).pipe(Effect.isFailure));
    })
  );
  it.effect.prop(
    "constrains schema-generated storage buckets even with a newly matching approval",
    { candidate: S.Struct({ bucket: S.NonEmptyString, useApproved: S.Boolean }) },
    ({ candidate }) =>
      Effect.gen(function* () {
        const [binding, runtime] = yield* fixture();
        const bucket = candidate.useApproved ? "beep-turbo-r2-pilot" : candidate.bucket;
        const target = CacheConformanceTarget.make({
          ...runtime.target,
          storage: O.some({ ...O.getOrThrow(runtime.target.storage), bucket }),
        });
        const approved = CacheProducerBinding.make({
          ...binding,
          uploadApproval: O.some(
            CacheProducerUploadApproval.make({
              ...O.getOrThrow(binding.uploadApproval),
              targetSha256: yield* hashCacheProducerUploadTarget(target),
            })
          ),
        });
        const result = yield* assertCacheProducerUploadRuntime(
          approved,
          O.some(CacheProducerUploadRuntime.make({ ...runtime, target }))
        ).pipe(Effect.isSuccess);
        expect(result).toBe(bucket === "beep-turbo-r2-pilot");
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect("requires paired independent approval and runtime before an upload", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      assertSome(yield* assertCacheProducerUploadRuntime(binding, O.some(runtime)), runtime);
      assertTrue(yield* assertCacheProducerUploadRuntime(binding, O.none()).pipe(Effect.isFailure));
      const historical = CacheProducerBinding.make({ ...binding, uploadApproval: O.none() });
      assertNone(yield* assertCacheProducerUploadRuntime(historical, O.none()));
      assertTrue(yield* assertCacheProducerUploadRuntime(historical, O.some(runtime)).pipe(Effect.isFailure));
      const encoded = yield* S.encodeEffect(CacheProducerBinding)(historical);
      expect(encoded).not.toHaveProperty("uploadApproval");
    })
  );

  it.effect("owns its validated descriptor and capabilities after caller mutation", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      const owned = O.getOrThrow(yield* assertCacheProducerUploadRuntime(binding, O.some(runtime)));
      const writer = Redacted.value(runtime.bearers.writer);
      const originalStorageKey = Redacted.value(O.getOrThrow(runtime.adapter).secretKey);
      const originalEndpoint = O.getOrThrow(runtime.target.storage).endpoint.href;
      runtime.target.baseUrl.port = "19428";
      O.getOrThrow(runtime.target.storage).endpoint.hostname = "changed.invalid";
      assertTrue(Reflect.set(O.getOrThrow(runtime.adapter), "secretKey", Redacted.make("changed-caller-storage-key")));
      assertTrue(Reflect.set(runtime, "signing", Redacted.make("changed-caller-key")));
      assertTrue(Reflect.set(runtime.bearers, "writer", Redacted.make("changed-caller-writer")));
      expect(owned.target.baseUrl.port).toBe("19427");
      expect(Redacted.value(owned.bearers.writer)).toBe(writer);
      expect(O.getOrThrow(owned.target.storage).endpoint.href).toBe(originalEndpoint);
      expect(Redacted.value(O.getOrThrow(owned.adapter).secretKey)).toBe(originalStorageKey);
      expect(yield* hashCacheProducerUploadKey(owned.signing)).toBe(
        O.getOrThrow(binding.uploadApproval).artifactKeySha256
      );
    })
  );

  it.effect("requires the owned launch and approved storage for an upload", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      for (const candidate of [
        CacheProducerUploadRuntime.make({ ...runtime, adapter: O.none() }),
        CacheProducerUploadRuntime.make({
          ...runtime,
          target: CacheConformanceTarget.make({ ...runtime.target, storage: O.none() }),
        }),
      ]) {
        const failure = yield* assertCacheProducerUploadRuntime(binding, O.some(candidate)).pipe(Effect.flip);
        expect(failure.message).toContain("approved storage and an owned adapter capability");
      }
    })
  );

  it.effect("refuses broader storage destinations and unpinned launchers despite matching target approval", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      const storage = O.getOrThrow(runtime.target.storage);
      const endpoint = storage.endpoint.origin;
      const urls = [
        Str.replace("https:", "http:")(endpoint),
        "https://example.invalid/",
        `${endpoint}:444/`,
        `${endpoint}/other`,
        `${endpoint}/?other=1`,
        `${endpoint}/#other`,
        `${endpoint}/?`,
        `${endpoint}/#`,
        Str.replace("https://", "https://user:password@")(endpoint),
      ];
      const targets = yield* Effect.forEach(
        urls,
        (value) =>
          S.decodeEffect(S.URLFromString)(value).pipe(
            Effect.map((url) =>
              CacheConformanceTarget.make({ ...runtime.target, storage: O.some({ ...storage, endpoint: url }) })
            )
          ),
        { concurrency: 1 }
      );
      const candidates = A.appendAll(targets, [
        CacheConformanceTarget.make({
          ...runtime.target,
          baseUrl: yield* S.decodeEffect(S.URLFromString)("http://127.0.0.1:19427/?"),
        }),
        CacheConformanceTarget.make({
          ...runtime.target,
          baseUrl: yield* S.decodeEffect(S.URLFromString)("http://127.0.0.1:19427/#"),
        }),
        CacheConformanceTarget.make({
          ...runtime.target,
          storage: O.some({ ...storage, bucket: "unapproved-bucket" }),
        }),
        CacheConformanceTarget.make({
          ...runtime.target,
          backend: { ...runtime.target.backend, digest: "unreviewed" },
        }),
      ]);
      for (const target of candidates) {
        const approved = CacheProducerBinding.make({
          ...binding,
          uploadApproval: O.some(
            CacheProducerUploadApproval.make({
              ...O.getOrThrow(binding.uploadApproval),
              targetSha256: yield* hashCacheProducerUploadTarget(target),
            })
          ),
        });
        const failure = yield* assertCacheProducerUploadRuntime(
          approved,
          O.some(CacheProducerUploadRuntime.make({ ...runtime, target }))
        ).pipe(Effect.flip);
        expect(failure.message).toContain("approved bounded pilot profile");
      }
      const relative = CacheProducerUploadRuntime.make({
        ...runtime,
        adapter: O.some(
          CacheProducerAdapterLaunch.make({ ...O.getOrThrow(runtime.adapter), executable: "relative-adapter" })
        ),
      });
      assertTrue(yield* assertCacheProducerUploadRuntime(binding, O.some(relative)).pipe(Effect.isFailure));
    })
  );

  it.effect("binds descriptor changes while keeping runtime credentials outside target identity", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      const changed = CacheConformanceTarget.make({
        ...runtime.target,
        backend: { ...runtime.target.backend, release: "changed-adapter-release" },
      });
      expect(yield* hashCacheProducerUploadTarget(changed)).not.toBe(
        yield* hashCacheProducerUploadTarget(runtime.target)
      );
      assertTrue(
        yield* assertCacheProducerUploadRuntime(
          binding,
          O.some(CacheProducerUploadRuntime.make({ ...runtime, target: changed }))
        ).pipe(Effect.isFailure)
      );
      const rotated = CacheProducerUploadRuntime.make({
        ...runtime,
        bearers: { ...runtime.bearers, writer: Redacted.make("synthetic-rotated-writer") },
      });
      assertSome(yield* assertCacheProducerUploadRuntime(binding, O.some(rotated)), rotated);
      const changedKey = CacheProducerUploadRuntime.make({
        ...runtime,
        signing: Redacted.make("synthetic-rotated-upload-key"),
      });
      assertTrue(yield* assertCacheProducerUploadRuntime(binding, O.some(changedKey)).pipe(Effect.isFailure));
      const descriptor = yield* encodeTarget(runtime.target);
      for (const value of [Redacted.value(runtime.signing), Redacted.value(runtime.bearers.writer)])
        expect(descriptor).not.toContain(value);
    })
  );

  it.effect("refuses wider destinations and weaker policies even with a matching descriptor hash", () =>
    Effect.gen(function* () {
      const [binding, runtime] = yield* fixture();
      const urls = [
        "http://example.invalid:19427/",
        "http://127.0.0.1:19428/",
        "http://127.0.0.1:19427/other",
        "http://127.0.0.1:19427/?other=1",
        "http://127.0.0.1:19427/#other",
        "http://user@127.0.0.1:19427/",
      ];
      const destinations = yield* Effect.forEach(
        urls,
        (url) =>
          S.decodeEffect(S.URLFromString)(url).pipe(
            Effect.map((baseUrl) => CacheConformanceTarget.make({ ...runtime.target, baseUrl }))
          ),
        { concurrency: 1 }
      );
      const targets = [
        ...destinations,
        CacheConformanceTarget.make({
          ...runtime.target,
          namespace: { ...runtime.target.namespace, teamId: "team_other_upload_test" },
        }),
        CacheConformanceTarget.make({
          ...runtime.target,
          namespace: { ...runtime.target.namespace, foreignTeamId: namespace },
        }),
        CacheConformanceTarget.make({
          ...runtime.target,
          policy: { ...runtime.target.policy, readerWriterSplit: false },
        }),
        CacheConformanceTarget.make({ ...runtime.target, policy: { ...runtime.target.policy, tenantBinding: false } }),
      ];
      for (const target of targets) {
        const independentlyHashed = CacheProducerBinding.make({
          ...binding,
          uploadApproval: O.some(
            CacheProducerUploadApproval.make({
              ...O.getOrThrow(binding.uploadApproval),
              targetSha256: yield* hashCacheProducerUploadTarget(target),
            })
          ),
        });
        const selected = CacheProducerUploadRuntime.make({ ...runtime, target });
        const failure = yield* assertCacheProducerUploadRuntime(independentlyHashed, O.some(selected)).pipe(
          Effect.flip
        );
        expect(failure.message).toBe("Producer upload target differs from its approved bounded pilot profile.");
      }
    })
  );
});

const executionFixture = Effect.fn("ProducerUploadRuntimeTest.executionFixture")(function* () {
  const [original, runtime] = yield* fixture();
  const before = yield* decodeContract(contractInput);
  const contract = CacheTaskContract.make({ ...before, clients: { ...before.clients, stable: original.client } });
  const binding = CacheProducerBinding.make({ ...original, policyDigest: yield* hashCacheProducerContract(contract) });
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
  return { fs, path, directory, file, profile, binding, runtime, environment };
});
const denyCredentialLookup = ConfigProvider.make(() =>
  Effect.die("Private producer approval must be checked before credential lookup.")
);

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer))("closed producer capability loading", (it) => {
  it.effect("loads only capabilities matching the pre-provisioned private approval", () =>
    Effect.gen(function* () {
      const { directory, binding, runtime, environment } = yield* executionFixture();
      const [approved, loaded] = yield* loadCacheProducerExecutionRuntime(directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(environment))
      );
      expect(approved).toEqual(binding);
      expect(loaded.target).toEqual(runtime.target);
      expect(Redacted.value(loaded.signing)).toBe(Redacted.value(runtime.signing));
      expect(Redacted.value(O.getOrThrow(loaded.adapter).accessKey)).toBe(environment.R2_ACCESS_KEY_ID);
    })
  );
  it.effect.prop(
    "requires every generated signing key to match the independent key identity",
    { candidate: S.Struct({ key: S.NonEmptyString, useApproved: S.Boolean }) },
    ({ candidate }) =>
      Effect.gen(function* () {
        const { directory, environment } = yield* executionFixture();
        const signing = candidate.useApproved ? environment.TURBO_REMOTE_CACHE_SIGNATURE_KEY : candidate.key;
        const accepted = yield* loadCacheProducerExecutionRuntime(directory).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({ ...environment, TURBO_REMOTE_CACHE_SIGNATURE_KEY: signing })
          ),
          Effect.isSuccess
        );
        expect(accepted).toBe(signing === environment.TURBO_REMOTE_CACHE_SIGNATURE_KEY);
      }),
    { arbitrary: fcRuns(20) }
  );
  it.effect("refuses a changed destination before any credential lookup", () =>
    Effect.gen(function* () {
      const { directory, fs, file, profile } = yield* executionFixture();
      const target = CacheConformanceTarget.make({
        ...profile.target,
        storage: O.some({ ...O.getOrThrow(profile.target.storage), bucket: "unapproved-bucket" }),
      });
      yield* fs.writeFileString(
        file,
        yield* encodeExecutionProfile(CacheProducerExecutionProfile.make({ ...profile, target }))
      );
      (yield* loadCacheProducerExecutionRuntime(directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, denyCredentialLookup),
        Effect.result
      )).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("honors revocation before any credential lookup", () =>
    Effect.gen(function* () {
      const { directory } = yield* executionFixture();
      yield* revokeCacheProducerIssuer(directory);
      (yield* loadCacheProducerExecutionRuntime(directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, denyCredentialLookup),
        Effect.result
      )).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("refuses missing runtime configuration before any credential lookup", () =>
    Effect.gen(function* () {
      const { fs, directory, file } = yield* executionFixture();
      yield* fs.remove(file);
      (yield* loadCacheProducerExecutionRuntime(directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, denyCredentialLookup),
        Effect.result
      )).pipe(Result.isFailure, assertTrue);
      expect(yield* fs.exists(file)).toBe(false);
    })
  );
  it.effect("fails closed when required credentials are absent", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* executionFixture();
      const material = path.join(directory, "issuer.key");
      const before = yield* fs.readFile(material);
      assertTrue(
        yield* loadCacheProducerExecutionRuntime(directory).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({})),
          Effect.isFailure
        )
      );
      expect(yield* fs.readFile(material)).toEqual(before);
    })
  );
  it.effect("rejects a relative executable even with the approved destination and credentials", () =>
    Effect.gen(function* () {
      const { fs, file, profile, directory, environment } = yield* executionFixture();
      yield* fs.writeFileString(
        file,
        yield* encodeExecutionProfile(
          CacheProducerExecutionProfile.make({ ...profile, adapterExecutable: "relative/adapter" })
        )
      );
      assertTrue(
        yield* loadCacheProducerExecutionRuntime(directory).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(environment)),
          Effect.isFailure
        )
      );
    })
  );
});
