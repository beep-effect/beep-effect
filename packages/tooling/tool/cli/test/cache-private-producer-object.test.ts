import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import {
  CacheConformanceTarget,
  CachePilotRun,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheProducerEnvelope,
  CacheQualificationLive,
  CacheSignedPilotCaptureControl,
  CacheSignedPilotFreshPair,
  CacheSignedPilotReceipt,
} from "@beep/repo-cli/commands/Cache";
import {
  buildCacheHostedProducerCompleteReport,
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerReference,
  CacheHostedProducerReport,
  CacheHostedProducerRunReference,
  CacheProducerExecutionProfile,
  CacheProducerObservation,
  downloadCacheProducerPrivateObservation,
  initializeCacheProducerIssuer,
  loadCacheProducerStorageRuntime,
  makeCacheCommandForTesting,
  readCacheProducerPrivateObservation,
  removeCacheProducerPrivateObservation,
  revokeCacheProducerIssuer,
  uploadCacheProducerPrivateObservation,
} from "@beep/repo-cli/test/Cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { preparePublishedProducerObservation, zipProducerReport } from "./helpers/cache-hosted-publication-fixture.ts";
import {
  makeProducerExecutionFixture as executionFixture,
  makeIssuedProducerObservationFixture as issuedFixture,
} from "./helpers/cache-producer-execution-fixture.ts";

const encodeObservation = S.encodeEffect(S.fromJsonString(CacheProducerObservation));
const encodeProfile = S.encodeEffect(S.fromJsonString(CacheProducerExecutionProfile));
const encodeApproval = S.encodeEffect(S.fromJsonString(CacheHostedProducerApproval));
const encodeReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerReport));
const encodeCompleteReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerCompleteReport));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

type PublishedObservation = Effect.Success<ReturnType<typeof preparePublishedProducerObservation>>;

/** Serve authenticated metadata for one publication, running `beforeWorkflow` when its workflow bytes are read. */
const metadataFor = (published: PublishedObservation, beforeWorkflow: Effect.Effect<void> = Effect.void) =>
  Layer.build(
    Layer.mergeAll(
      GitHubClient.layerFixture({
        requestDecoded: {
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}": published.run,
          "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}": published.artifact,
        },
      }),
      GitHubContent.layerTest({
        getFile: dual(2, (_file: string, _options?: { readonly ref?: string | undefined }) =>
          Effect.as(beforeWorkflow, published.workflow)
        ),
      })
    )
  );

function controlledFetch(
  handler: (
    input: Parameters<typeof globalThis.fetch>[0],
    options?: Parameters<typeof globalThis.fetch>[1]
  ) => Promise<Response>
): typeof globalThis.fetch {
  return Object.assign(handler, { preconnect: () => {} });
}

const publishedFixture = Effect.fn("PrivateProducerObjectTest.publish")(function* (
  tamperMac: typeof S.Boolean.Type = false
) {
  const issued = yield* issuedFixture();
  const observation = tamperMac
    ? CacheProducerObservation.make({
        ...issued.observation,
        envelope: CacheProducerEnvelope.make({
          ...issued.observation.envelope,
          mac: Sha256Hex.make(Str.repeat(64)("0")),
        }),
      })
    : issued.observation;
  const fixture = {
    ...issued,
    observation,
    text: yield* encodeObservation(observation),
  };
  const published = yield* preparePublishedProducerObservation(
    fixture.directory,
    fixture.observation,
    fixture.binding,
    fixture.run.runId
  );
  const metadata = yield* metadataFor(published);
  return { ...fixture, published, metadata };
});

type PublishedFixture = Effect.Success<ReturnType<typeof publishedFixture>>;

/** Re-archive a hosted report and give GitHub metadata that authenticates exactly the new archive. */
const republishedReport = Effect.fn("PrivateProducerObjectTest.republish")(function* (
  fixture: PublishedFixture,
  contents: string
) {
  const archive = yield* zipProducerReport(contents);
  const artifact = {
    ...fixture.published.artifact,
    size_in_bytes: archive.byteLength,
    digest: `sha256:${yield* hashBytes(archive)}`,
  };
  return { archive, metadata: yield* metadataFor({ ...fixture.published, artifact }) };
});

/** Replace the whole private store with a differently bound issuer while hosted workflow bytes are read. */
const swapStoreDuringMetadata = Effect.fn("PrivateProducerObjectTest.swapStore")(function* (fixture: PublishedFixture) {
  const parent = yield* fixture.fs.makeTempDirectoryScoped();
  const replacement = fixture.path.join(parent, "issuer");
  const binding = CacheProducerBinding.make({
    ...fixture.binding,
    workflowRevision: CacheProducerBinding.fields.workflowRevision.make(Str.repeat(40)("f")),
  });
  yield* initializeCacheProducerIssuer(replacement, binding, fixture.contract);
  yield* fixture.fs.writeFileString(
    fixture.path.join(replacement, "runtime.json"),
    yield* encodeProfile(fixture.profile),
    {
      mode: 0o600,
    }
  );
  const swap = fixture.fs
    .rename(fixture.directory, fixture.path.join(parent, "original"))
    .pipe(Effect.andThen(fixture.fs.rename(replacement, fixture.directory)), Effect.orDie);
  return yield* metadataFor(fixture.published, swap);
});

/** Count private-object requests while answering each with one fixed response. */
const countingFetch = (respond: () => Response) => {
  const calls = { requests: 0 };
  const fetch = controlledFetch(() => {
    calls.requests += 1;
    return Promise.resolve(respond());
  });
  return { calls, fetch };
};

/** Rebuild one issued observation with every capture diagnostic replaced, bypassing construction checks. */
const withCaptureDiagnostics = (observation: CacheProducerObservation, diagnostic: string) => {
  const unchecked = { disableChecks: true };
  const pilot = observation.observation.pilot;
  return CacheProducerObservation.make(
    {
      ...observation,
      observation: CacheProducerBundle.make(
        {
          ...observation.observation,
          pilot: CacheSignedPilotReceipt.make(
            {
              ...pilot,
              captureControls: A.map(pilot.captureControls, (control) =>
                CacheSignedPilotCaptureControl.make({ ...control, diagnostic }, unchecked)
              ),
            },
            unchecked
          ),
        },
        unchecked
      ),
    },
    unchecked
  );
};

const deniedCredentials = ConfigProvider.make(() => Effect.die("Credential lookup must remain unreachable."));

it.layer(
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
    Git.layer.pipe(Layer.provide(NodeServices.layer))
  ),
  {
    timeout: "30 seconds",
    concurrent: false,
  }
)("private producer object", (it) => {
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
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(fixture.storageEnvironment)
          ),
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
      const fs = yield* FileSystem.FileSystem;
      const file = fixture.path.join(fixture.directory, "observation.json");
      yield* fs.writeFileString(file, fixture.text, { mode: 0o600 });
      expect(yield* readCacheProducerPrivateObservation(file)).toEqual(fixture.observation);
      const alias = fixture.path.join(fixture.directory, "alias.json");
      yield* fs.symlink(file, alias);
      expect((yield* readCacheProducerPrivateObservation(alias).pipe(Effect.flip)).message).toBe(
        "Cannot read the bounded private producer observation."
      );
    })
  );

  it.effect.each(["", "{}"])("rejects an empty or malformed private observation %j", (contents) =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const file = fixture.path.join(fixture.directory, "invalid-observation.json");
      yield* fixture.fs.writeFileString(file, contents, { mode: 0o600 });
      const error = yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip);
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(yield* fixture.fs.readFileString(file)).toBe(contents);
    })
  );

  it.effect("rejects an oversized observation before issuer or storage authentication", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const pilot = fixture.observation.observation.pilot;
      const observation = CacheProducerObservation.make({
        ...fixture.observation,
        observation: CacheProducerBundle.make({
          ...fixture.observation.observation,
          pilot: CacheSignedPilotReceipt.make({
            ...pilot,
            freshPairs: A.map(pilot.freshPairs, (pair, index) =>
              index === 0
                ? CacheSignedPilotFreshPair.make({
                    ...pair,
                    left: CachePilotRun.make({ ...pair.left, id: Str.repeat(8 * 1024 * 1024)("x") }),
                  })
                : pair
            ),
          }),
        }),
      });
      let requests = 0;
      const fetch = controlledFetch(() => {
        requests += 1;
        return Promise.resolve(new Response(null, { status: 200 }));
      });
      const denied = ConfigProvider.make(() => Effect.die("Oversized observations must not load credentials."));
      const error = yield* uploadCacheProducerPrivateObservation(fixture.directory, fixture.run, observation).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, denied),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(requests).toBe(0);
    })
  );

  it.effect.each([201, 403, 404, 429, 503])(
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
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(fixture.storageEnvironment)
          ),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toContain("Private producer object PUT failed");
        expect(error.message).not.toContain("synthetic-private-remote-body");
        expect(requests).toBe(1);
      })
  );

  it.effect("rejects unapproved and storage-less profiles before reading storage credentials", () =>
    Effect.gen(function* () {
      const unapproved = yield* executionFixture(false);
      const approvalError = yield* loadCacheProducerStorageRuntime(unapproved.directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({})),
        Effect.flip
      );
      expect(approvalError.message).toBe("The producer store has no independently approved upload.");
      const fixture = yield* executionFixture();
      const profile = CacheProducerExecutionProfile.make({
        ...fixture.profile,
        target: CacheConformanceTarget.make({ ...fixture.profile.target, storage: O.none() }),
      });
      yield* fixture.fs.writeFileString(fixture.file, yield* encodeProfile(profile));
      const storageError = yield* loadCacheProducerStorageRuntime(fixture.directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({})),
        Effect.flip
      );
      expect(storageError.message).toBe("Producer upload requires approved storage and an owned adapter capability.");
    })
  );

  it.effect("fails closed when approved storage credentials are absent", () =>
    Effect.gen(function* () {
      const fixture = yield* executionFixture();
      const error = yield* loadCacheProducerStorageRuntime(fixture.directory).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({})),
        Effect.flip
      );
      expect(error.message).toBe("Approved producer storage capabilities are required.");
    })
  );

  it.effect.each([0, 1024 * 1024 + 1])("rejects archive size %s before publication or credential access", (size) =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        new Uint8Array(size)
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({})),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
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
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
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
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
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
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
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
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch)
      );
      expect(requests).toBe(1);
    })
  );
  it.effect.each(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"])(
    "rejects artifact-key aliasing through %s without loading the artifact key",
    (field) =>
      Effect.gen(function* () {
        const fixture = yield* issuedFixture();
        let requests = 0;
        const fetch = controlledFetch(() => {
          requests += 1;
          return Promise.resolve(new Response(null, { status: 200 }));
        });
        const environment = {
          ...fixture.storageEnvironment,
          [field]: fixture.environment.TURBO_REMOTE_CACHE_SIGNATURE_KEY,
        };
        const error = yield* uploadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.run,
          fixture.observation
        ).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(environment)),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toBe("Producer artifact signing must be distinct from backend capabilities.");
        expect(requests).toBe(0);
      })
  );
  it.effect("dispatches one saved observation through the real producer-publish CLI", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const fs = yield* FileSystem.FileSystem;
      const file = fixture.path.join(fixture.directory, "observation.json");
      yield* fs.writeFileString(file, fixture.text, { mode: 0o600 });
      let requests = 0;
      const fetch = controlledFetch(() => {
        requests += 1;
        return Promise.resolve(new Response(null, { status: 200 }));
      });
      const run = Command.runWith(makeCacheCommandForTesting(CacheQualificationLive), { version: "0.0.0" });
      yield* run(["producer-publish", "--observation", file]).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({
            ...fixture.storageEnvironment,
            BEEP_CACHE_PRODUCER_STORE: fixture.directory,
            GITHUB_RUN_ID: "42",
            GITHUB_RUN_ATTEMPT: "1",
          })
        ),
        Effect.provideService(FetchHttpClient.Fetch, fetch)
      );
      expect(requests).toBe(1);
      expect(yield* fs.readFileString(file)).toBe(fixture.text);
    })
  );

  it.effect("preserves the issued observation and performs no retry when the CLI publisher fails", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const fs = yield* FileSystem.FileSystem;
      const file = fixture.path.join(fixture.directory, "observation.json");
      yield* fs.writeFileString(file, fixture.text, { mode: 0o600 });
      let requests = 0;
      const fetch = controlledFetch(() => {
        requests += 1;
        return Promise.resolve(new Response("synthetic-private-response", { status: 503 }));
      });
      const run = Command.runWith(makeCacheCommandForTesting(CacheQualificationLive), { version: "0.0.0" });
      const failed = yield* run(["producer-publish", "--observation", file]).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({
            ...fixture.storageEnvironment,
            BEEP_CACHE_PRODUCER_STORE: fixture.directory,
            GITHUB_RUN_ID: "42",
            GITHUB_RUN_ATTEMPT: "1",
          })
        ),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(failed._tag).toBe("CliReportedExit");
      expect(requests).toBe(1);
      expect(yield* fs.readFileString(file)).toBe(fixture.text);
    })
  );

  it.effect("refuses an existing private fetch output before credential or metadata access", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const fs = yield* FileSystem.FileSystem;
      const file = fixture.path.join(fixture.directory, "existing.json");
      yield* fs.writeFileString(file, "private-sentinel", { mode: 0o600 });
      const denied = ConfigProvider.make(() => Effect.die("Existing output must fail before credential lookup."));
      const run = Command.runWith(makeCacheCommandForTesting(CacheQualificationLive), { version: "0.0.0" });
      const failed = yield* run(["producer-fetch", "--reference", file, "--archive", file, "--output", file]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, denied),
        Effect.flip
      );
      expect(failed._tag).toBe("CliReportedExit");
      expect(yield* fs.readFileString(file)).toBe("private-sentinel");
    })
  );
  it.effect("rejects unsafe modes, hard links, invalid UTF-8 and oversized private files", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const fs = yield* FileSystem.FileSystem;
      const file = fixture.path.join(fixture.directory, "private-boundary.json");
      yield* fs.writeFileString(file, fixture.text, { mode: 0o600 });
      yield* fs.chmod(file, 0o644);
      expect((yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip)).message).toBe(
        "Observation must be a private single-link file."
      );
      yield* fs.chmod(file, 0o600);
      const link = fixture.path.join(fixture.directory, "hardlink.json");
      yield* fs.link(file, link);
      expect((yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip)).message).toBe(
        "Observation must be a private single-link file."
      );
      yield* fs.remove(link);
      yield* fs.writeFile(file, new Uint8Array([255]));
      expect((yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip)).message).toContain(
        "payload-rejected"
      );
      yield* fs.truncate(file, 8 * 1024 * 1024 + 1);
      expect((yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip)).message).toContain(
        "payload-rejected"
      );
    })
  );

  it.effect("bounds a streamed private download and cancels it when the observation limit is exceeded", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      let cancelled = false;
      const fetch = controlledFetch(() =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(8 * 1024 * 1024));
              },
              cancel() {
                cancelled = true;
              },
            })
          )
        )
      );
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toContain("truncated-body");
      expect(cancelled).toBe(true);
    })
  );

  it.effect("classifies a broken response body as transport failure without leaking its cause", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      let requests = 0;
      const fetch = controlledFetch(() => {
        requests += 1;
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("synthetic-private-body-detail"));
              },
            })
          )
        );
      });
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (transport-error).");
      expect(error.cause).toBe("transport-error");
      expect(requests).toBe(1);
    })
  );

  it.effect("classifies an absent authenticated private object as not-found rather than a cache miss", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const fetch = controlledFetch(() => Promise.resolve(new Response("synthetic-private-error", { status: 404 })));
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (not-found).");
      expect(error.cause).toBe("not-found");
    })
  );
  it.effect("rejects a bad issuer MAC even when the immutable hosted digest authenticates those exact bytes", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture(true);
      let requests = 0;
      const fetch = controlledFetch(() => {
        requests += 1;
        return Promise.resolve(new Response(fixture.text));
      });
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Producer envelope authentication is invalid.");
      expect(requests).toBe(1);
    })
  );
  it.layer(TestClock.layer())("owned exchange deadline", (it) => {
    it.effect("times out a stalled exchange at its existing thirty-second bound and cancels the body", () =>
      Effect.gen(function* () {
        const fixture = yield* issuedFixture();
        let cancelled = false;
        const started = yield* Deferred.make<void>();
        const fetch = controlledFetch(() =>
          Promise.resolve(
            new Response(
              new ReadableStream({
                start() {
                  Deferred.doneUnsafe(started, Effect.void);
                },
                cancel() {
                  cancelled = true;
                },
              })
            )
          )
        );
        const fiber = yield* uploadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.run,
          fixture.observation
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(fixture.storageEnvironment)
          ),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip,
          Effect.forkChild
        );
        yield* Deferred.await(started);
        yield* TestClock.adjust(Duration.seconds(31));
        const error = yield* Fiber.join(fiber);
        expect(error.message).toBe("Private producer object PUT failed (timeout; write-ambiguous).");
        expect(cancelled).toBe(true);
      })
    );
  });
  it.effect.each(["revocation", "runtime", "approval"])(
    "rejects concurrent private %s changes while download is in flight",
    (change) =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        const started = yield* Deferred.make<ReadableStreamDefaultController<Uint8Array>>();
        const fetch = controlledFetch(() =>
          Promise.resolve(
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  Deferred.doneUnsafe(started, Effect.succeed(controller));
                },
              })
            )
          )
        );
        const fiber = yield* downloadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.published.reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(fixture.storageEnvironment)
          ),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip,
          Effect.forkChild
        );
        const controller = yield* Deferred.await(started);
        yield* Match.value(change).pipe(
          Match.when("revocation", () => revokeCacheProducerIssuer(fixture.directory)),
          Match.when("runtime", () =>
            Effect.gen(function* () {
              const profile = CacheProducerExecutionProfile.make({
                ...fixture.profile,
                adapterExecutable: "/fixture/changed-adapter",
              });
              yield* fixture.fs.writeFileString(fixture.file, yield* encodeProfile(profile));
            })
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const approval = CacheHostedProducerApproval.make({
                ...fixture.published.approval,
                workflowSha256: Sha256Hex.make(Str.repeat(64)("e")),
              });
              yield* fixture.fs.writeFileString(
                fixture.path.join(fixture.directory, "publication.json"),
                yield* encodeApproval(approval)
              );
            })
          )
        );
        yield* Effect.sync(() => {
          controller.enqueue(new TextEncoder().encode(fixture.text));
          controller.close();
        });
        const error = yield* Fiber.join(fiber);
        expect(error.message).toContain(change === "revocation" ? "revoked" : "payload-rejected");
      })
  );

  it.effect("rejects a private UTF-8 file that is not a producer observation", () =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const file = fixture.path.join(fixture.directory, "not-an-observation.json");
      yield* fixture.fs.writeFileString(file, `{"schemaVersion":"cache-producer-observation/v1"}`, { mode: 0o600 });
      const error = yield* readCacheProducerPrivateObservation(file).pipe(Effect.flip);
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(error.cause).toBe("payload-rejected");
    })
  );

  it.effect.each([
    { shape: "an unencodable", length: 0 },
    { shape: "an oversized", length: 2_200_000 },
  ])("rejects $shape observation before issuer, credential or private-object access", ({ length }) =>
    Effect.gen(function* () {
      const fixture = yield* issuedFixture();
      const { calls, fetch } = countingFetch(() => new Response(null, { status: 200 }));
      const error = yield* uploadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.run,
        withCaptureDiagnostics(fixture.observation, Str.repeat(length)("a"))
      ).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, deniedCredentials),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(error.cause).toBe("payload-rejected");
      expect(calls.requests).toBe(0);
    })
  );

  it.effect("refuses a publication whose store has no independent upload approval", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const unapproved = yield* executionFixture(false);
      yield* preparePublishedProducerObservation(
        unapproved.directory,
        fixture.observation,
        unapproved.binding,
        fixture.run.runId
      );
      const { calls, fetch } = countingFetch(() => new Response(null, { status: 204 }));
      const error = yield* removeCacheProducerPrivateObservation(
        unapproved.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, deniedCredentials),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(calls.requests).toBe(0);
    })
  );

  it.effect.each(["binding", "target"])(
    "refuses a publication whose approval or execution profile has a different %s",
    (change) =>
      Effect.gen(function* () {
        const fixture = yield* publishedFixture();
        yield* Match.value(change).pipe(
          Match.when("binding", () =>
            Effect.gen(function* () {
              const approval = CacheHostedProducerApproval.make({
                ...fixture.published.approval,
                binding: CacheProducerBinding.make({
                  ...fixture.binding,
                  workflowRevision: CacheProducerBinding.fields.workflowRevision.make(Str.repeat(40)("e")),
                }),
              });
              yield* fixture.fs.writeFileString(
                fixture.path.join(fixture.directory, "publication.json"),
                yield* encodeApproval(approval)
              );
            })
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const profile = CacheProducerExecutionProfile.make({
                ...fixture.profile,
                target: CacheConformanceTarget.make({
                  ...fixture.profile.target,
                  storage: O.map(fixture.profile.target.storage, (storage) => ({
                    ...storage,
                    bucket: "beep-turbo-r2-other",
                  })),
                }),
              });
              yield* fixture.fs.writeFileString(fixture.file, yield* encodeProfile(profile));
            })
          )
        );
        const { calls, fetch } = countingFetch(() => new Response(fixture.text));
        const error = yield* downloadCacheProducerPrivateObservation(
          fixture.directory,
          fixture.published.reference,
          fixture.published.publication.archive
        ).pipe(
          Effect.provideContext(fixture.metadata),
          Effect.provideService(ConfigProvider.ConfigProvider, deniedCredentials),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.flip
        );
        expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
        expect(calls.requests).toBe(0);
      })
  );

  it.effect("refuses an authenticated legacy upload-only report before credential or private-object access", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const complete = yield* buildCacheHostedProducerCompleteReport(fixture.observation, fixture.run);
      const legacy = CacheHostedProducerReport.make({
        binding: complete.binding,
        runId: complete.runId,
        attempt: complete.attempt,
        uploads: complete.uploads,
      });
      const republished = yield* republishedReport(fixture, yield* encodeReport(legacy));
      const { calls, fetch } = countingFetch(() => new Response(fixture.text));
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        republished.archive
      ).pipe(
        Effect.provideContext(republished.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, deniedCredentials),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(calls.requests).toBe(0);
    })
  );

  it.effect("rejects non-canonical private bytes even when the authenticated report digests those exact bytes", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const nonCanonical = `${fixture.text}\n`;
      const complete = yield* buildCacheHostedProducerCompleteReport(fixture.observation, fixture.run);
      const report = CacheHostedProducerCompleteReport.make({
        ...complete,
        observationSha256: yield* hashBytes(new TextEncoder().encode(nonCanonical)),
      });
      const republished = yield* republishedReport(fixture, yield* encodeCompleteReport(report));
      const { calls, fetch } = countingFetch(() => new Response(nonCanonical));
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        republished.archive
      ).pipe(
        Effect.provideContext(republished.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (payload-rejected).");
      expect(calls.requests).toBe(1);
    })
  );

  it.effect("classifies a private body stream error as a transport error without exposing it", () =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const { calls, fetch } = countingFetch(
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(fixture.text));
                controller.error(new Error("synthetic-private-stream"));
              },
            })
          )
      );
      const error = yield* downloadCacheProducerPrivateObservation(
        fixture.directory,
        fixture.published.reference,
        fixture.published.publication.archive
      ).pipe(
        Effect.provideContext(fixture.metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe("Private producer object GET failed (transport-error).");
      expect(error.cause).toBe("transport-error");
      expect(calls.requests).toBe(1);
    })
  );

  it.effect.each([
    { operation: "download", method: "GET" },
    { operation: "remove", method: "DELETE" },
  ])("refuses to $operation after the private store is rebound during publication checks", ({ operation, method }) =>
    Effect.gen(function* () {
      const fixture = yield* publishedFixture();
      const metadata = yield* swapStoreDuringMetadata(fixture);
      const { calls, fetch } = countingFetch(() => new Response(fixture.text));
      const reference = fixture.published.reference;
      const archive = fixture.published.publication.archive;
      const error = yield* Match.value(operation).pipe(
        Match.when("download", () =>
          Effect.asVoid(downloadCacheProducerPrivateObservation(fixture.directory, reference, archive))
        ),
        Match.orElse(() => removeCacheProducerPrivateObservation(fixture.directory, reference, archive)),
        Effect.provideContext(metadata),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(fixture.storageEnvironment)),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.flip
      );
      expect(error.message).toBe(`Private producer object ${method} failed (payload-rejected).`);
      expect(calls.requests).toBe(0);
    })
  );
});
