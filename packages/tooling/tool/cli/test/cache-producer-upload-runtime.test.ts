import { CacheConformanceTarget, CacheProducerBinding } from "@beep/repo-cli/commands/Cache";
import {
  assertCacheProducerUploadRuntime,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
} from "@beep/repo-cli/test/Cache";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { input as bundleInput } from "./helpers/cache-producer-bundle-fixture.ts";

const namespace = "team_beep_signed_canary_v1";
const fixture = Effect.fn("ProducerUploadRuntimeTest.fixture")(function* () {
  const target = CacheConformanceTarget.make({
    ...targetFor({ url: "http://127.0.0.1:19427/" }),
    namespace: { teamId: namespace, foreignTeamId: "team_foreign_upload_test" },
  });
  const runtime = CacheProducerUploadRuntime.make({ target, bearers, signing: Redacted.make("synthetic-upload-key") });
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
      runtime.target.baseUrl.port = "19428";
      assertTrue(Reflect.set(runtime, "signing", Redacted.make("changed-caller-key")));
      assertTrue(Reflect.set(runtime.bearers, "writer", Redacted.make("changed-caller-writer")));
      expect(owned.target.baseUrl.port).toBe("19427");
      expect(Redacted.value(owned.bearers.writer)).toBe(writer);
      expect(yield* hashCacheProducerUploadKey(owned.signing)).toBe(
        O.getOrThrow(binding.uploadApproval).artifactKeySha256
      );
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
      const descriptor = yield* S.encodeEffect(S.fromJsonString(CacheConformanceTarget))(runtime.target);
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
