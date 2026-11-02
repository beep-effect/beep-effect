import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { CacheProducerBundle, CacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache";
import {
  buildCacheHostedProducerCompleteReport,
  CacheAdapterRuntimeObservation,
  CacheHostedProducerReference,
  CacheHostedProducerRunReference,
  CacheHostedProducerUpload,
  CacheProducerAdapterReceipt,
  CacheProducerObservation,
  downloadCacheProducerPrivateObservation,
  openCacheProducerIssuer,
  readCacheProducerPrivateObservation,
  removeCacheProducerPrivateObservation,
  revokeCacheProducerIssuer,
  uploadCacheProducerPrivateObservation,
} from "@beep/repo-cli/test/Cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { preparePublishedProducerObservation } from "./helpers/cache-hosted-publication-fixture.ts";
import { input as bundleInput } from "./helpers/cache-producer-bundle-fixture.ts";
import { makeProducerExecutionFixture } from "./helpers/cache-producer-execution-fixture.ts";

const encodeObservation = S.encodeEffect(S.fromJsonString(CacheProducerObservation));
const controlledFetch = (
  handler: (
    input: Parameters<typeof globalThis.fetch>[0],
    options?: Parameters<typeof globalThis.fetch>[1]
  ) => Promise<Response>
): typeof globalThis.fetch => Object.assign(handler, { preconnect: () => {} });

const issuedFixture = Effect.fn("PrivateProducerObjectTest.issue")(function* () {
  const base = yield* makeProducerExecutionFixture();
  const original = yield* S.decodeUnknownEffect(CacheProducerBundle)(bundleInput);
  const runtime = CacheAdapterRuntimeObservation.make({
    role: "writer",
    phase: "ready",
    tokioNamedThreadsIncludingBlocking: 2,
    totalThreads: 6,
    memoryPeakBytes: 1024,
  });
  const bundle = CacheProducerBundle.make({
    ...original,
    pilot: CacheSignedPilotReceipt.make({ ...original.pilot, client: base.binding.client }),
    upload: O.some(
      CacheHostedProducerUpload.make({
        taskHash: "0123456789abcdef",
        archiveSha256: Sha256Hex.make(Str.repeat(64)("d")),
        archiveBytes: 17,
        status: 200,
      })
    ),
    adapterRuntime: O.some(
      CacheProducerAdapterReceipt.make({
        backendSha256: Sha256Hex.make(Str.repeat(64)("d")),
        targetSha256: O.getOrThrow(base.binding.uploadApproval).targetSha256,
        ready: { ...runtime, role: "writer", phase: "ready" },
        afterLoad: { ...runtime, role: "writer", phase: "after-load" },
      })
    ),
  });
  const issuer = yield* openCacheProducerIssuer(base.directory, base.binding);
  const observation = CacheProducerObservation.make({ observation: bundle, envelope: yield* issuer.issue(bundle) });
  const run = CacheHostedProducerRunReference.make({ runId: 42, attempt: 1 });
  return { ...base, observation, run, text: yield* encodeObservation(observation) };
});

const publishedFixture = Effect.fn("PrivateProducerObjectTest.publish")(function* () {
  const fixture = yield* issuedFixture();
  const published = yield* preparePublishedProducerObservation(
    fixture.directory,
    fixture.observation,
    fixture.binding,
    fixture.run.runId
  );
  const metadata = yield* Layer.build(
    Layer.mergeAll(
      GitHubClient.layerFixture({
        requestDecoded: {
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}": published.run,
          "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}": published.artifact,
        },
      }),
      GitHubContent.layerTest({
        getFile: dual(2, (_file: string, _options?: { readonly ref?: string | undefined }) =>
          Effect.succeed(published.workflow)
        ),
      })
    )
  );
  return { ...fixture, published, metadata };
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "private producer object",
  (it) => {
    it.effect.prop(
      "uploads schema-generated run identities with exact canonical bytes and private S3 options",
      { run: CacheHostedProducerRunReference },
      ({ run }) =>
        Effect.gen(function* () {
          const fixture = { ...(yield* issuedFixture()), run: CacheHostedProducerRunReference.make(run) };
          const expected = yield* buildCacheHostedProducerCompleteReport(fixture.observation, fixture.run);
          let requests = 0;
          const fetch = controlledFetch((input, options) => {
            requests += 1;
            expect(input).toEqual(
              new URL(
                `s3://beep-turbo-r2-pilot/__beep_private_producer_v1/team_beep_signed_canary_v1/${run.runId}/${run.attempt}/${expected.observationSha256}.json`
              )
            );
            expect(options).toMatchObject({
              method: "PUT",
              redirect: "error",
              verbose: false,
              tls: { rejectUnauthorized: true },
              s3: {
                endpoint: "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
                bucket: "beep-turbo-r2-pilot",
                region: "auto",
                accessKeyId: "synthetic-storage-id",
                secretAccessKey: "synthetic-storage-secret",
                sessionToken: "",
                retry: 0,
                queueSize: 1,
                partSize: 8 * 1024 * 1024,
              },
            });
            expect(options?.body).toEqual(new TextEncoder().encode(fixture.text));
            return Promise.resolve(new Response(null, { status: 200 }));
          });
          const actual = yield* uploadCacheProducerPrivateObservation(
            fixture.directory,
            fixture.run,
            fixture.observation
          ).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
            Effect.provideService(FetchHttpClient.Fetch, fetch)
          );
          expect(actual).toEqual(expected);
          expect(requests).toBe(1);
        }),
      { arbitrary: fcRuns(20) }
    );

    it.effect("reads one private observation and refuses a symbolic alias", () =>
      Effect.gen(function* () {
        const fixture = yield* issuedFixture();
        const file = fixture.path.join(fixture.directory, "observation.json");
        yield* fixture.fs.writeFileString(file, fixture.text, { mode: 0o600 });
        expect(yield* readCacheProducerPrivateObservation(file)).toEqual(fixture.observation);
        const alias = fixture.path.join(fixture.directory, "alias.json");
        yield* fixture.fs.symlink(file, alias);
        expect((yield* readCacheProducerPrivateObservation(alias).pipe(Effect.flip)).message).toBe(
          "Cannot read the bounded private producer observation."
        );
      })
    );

    it.effect.each([403, 404, 429, 503])(
      "classifies one refused PUT status %s without exposing the response body",
      (status) =>
        Effect.gen(function* () {
          const fixture = yield* issuedFixture();
          let requests = 0;
          const fetch = controlledFetch(() => {
            requests += 1;
            return Promise.resolve(new Response("synthetic-private-remote-body", { status }));
          });
          const error = yield* uploadCacheProducerPrivateObservation(
            fixture.directory,
            fixture.run,
            fixture.observation
          ).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
            Effect.provideService(FetchHttpClient.Fetch, fetch),
            Effect.flip
          );
          expect(error.message).toContain("Private producer object PUT failed");
          expect(error.message).not.toContain("synthetic-private-remote-body");
          expect(requests).toBe(1);
        })
    );

    it.effect("does not retry or expose raw transport errors after an ambiguous write", () =>
      Effect.gen(function* () {
        const fixture = yield* issuedFixture();
        let requests = 0;
        const fetch = controlledFetch(() => {
          requests += 1;
          return Promise.reject(new Error("synthetic-private-credential"));
        });
        const error = yield* uploadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.run,
          fixture.observation
        ).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toContain("transport-error; write-ambiguous");
        expect(error.message).not.toContain("synthetic-private-credential");
        expect(error.cause).toBe("write-ambiguous");
        expect(requests).toBe(1);
      })
    );

    it.effect("refuses revoked material before reading credentials or making an upload", () =>
      Effect.gen(function* () {
        const fixture = yield* issuedFixture();
        yield* revokeCacheProducerIssuer(fixture.directory);
        const denied = ConfigProvider.make(() => Effect.die("Credential lookup must remain unreachable."));
        const fetch = controlledFetch(() => Promise.reject(new Error("Network must remain unreachable.")));
        const error = yield* uploadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.run,
          fixture.observation
        ).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, denied),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toContain("revoked");
      })
    );
    it.effect("downloads the authenticated canonical observation after the real archive and metadata join", () =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        let requests = 0;
        const fetch = controlledFetch((_input, options) => {
          requests += 1;
          expect(options?.method).toBe("GET");
          expect(options?.body).toBeUndefined();
          return Promise.resolve(new Response(fixture.text, { status: 200 }));
        });
        const observed = yield* downloadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.published.reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
          Effect.provideService(FetchHttpClient.Fetch, fetch)
        );
        expect(observed).toEqual(fixture.observation);
        expect(requests).toBe(1);
      })
    );

    it.effect("refuses a different authenticated run before credential or private-object access", () =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        let requests = 0;
        const fetch = controlledFetch(() => {
          requests += 1;
          return Promise.resolve(new Response(fixture.text));
        });
        const denied = ConfigProvider.make(() => Effect.die("Unapproved metadata must not load credentials."));
        const reference = CacheHostedProducerReference.make({ ...fixture.published.reference, runId: 43 });
        const error = yield* downloadCacheProducerPrivateObservation(
          fixture.directory,
          reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(ConfigProvider.ConfigProvider, denied),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error._tag).toBe("CacheCommandError");
        expect(requests).toBe(0);
      })
    );

    it.effect("rejects changed private object bytes against the authenticated canonical digest", () =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        const fetch = controlledFetch(() => Promise.resolve(new Response(`${fixture.text} `)));
        const error = yield* downloadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.published.reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toContain("payload-rejected");
      })
    );

    it.effect("deletes only the exact private observation selected by authenticated publication", () =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        let requests = 0;
        const report = yield* buildCacheHostedProducerCompleteReport(fixture.observation, fixture.run);
        const fetch = controlledFetch((input, options) => {
          requests += 1;
          expect(options?.method).toBe("DELETE");
          expect(options?.body).toBeUndefined();
          expect(input).toEqual(
            new URL(
              `s3://beep-turbo-r2-pilot/__beep_private_producer_v1/team_beep_signed_canary_v1/42/1/${report.observationSha256}.json`
            )
          );
          return Promise.resolve(new Response(null, { status: 204 }));
        });
        yield* removeCacheProducerPrivateObservation(
          fixture.directory,
          fixture.published.reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.environment)),
          Effect.provideService(FetchHttpClient.Fetch, fetch)
        );
        expect(requests).toBe(1);
      })
    );
  }
);
