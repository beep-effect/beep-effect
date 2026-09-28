import { ReferenceWorkspace, referenceWorkspaceLayer } from "@beep/repo-cli/commands/Refs";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Config, ConfigProvider, Context, Effect, FileSystem, Layer, Path } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

export const writeExecutable = Effect.fn("RefsTest.writeExecutable")(function* (file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, content);
  yield* fs.chmod(file, 0o755);
});

export const fixture = Effect.fn("RefsTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-refs-test-" });
  const owner = path.join(temp, "owner");
  const root = path.join(temp, "references");
  const home = path.join(temp, "home");
  const bin = path.join(temp, "bin");
  for (const directory of [path.join(owner, "scripts"), root, home, bin])
    yield* fs.makeDirectory(directory, { recursive: true });
  const manifestPath = yield* path.fromFileUrl(new URL("../../../../../scripts/references.json", import.meta.url));
  yield* fs.copyFile(manifestPath, path.join(owner, "scripts", "references.json"));
  const ambientPath = yield* Config.String("PATH");
  const configValues = { HOME: home, PATH: `${bin}:${ambientPath}`, BEEP_REFERENCES_ROOT: root };
  const config = ConfigProvider.layer(ConfigProvider.fromUnknown(configValues));
  const service = referenceWorkspaceLayer(owner).pipe(Layer.provideMerge(config));
  return { fs, path, temp, owner, root, home, bin, config, configValues, service };
});

/** Fake proxy credential; asserted absent from every receipt. */
export const graftTestApiKey = "sk-refs-test-secret";

/**
 * The fixture's configuration plus the unit's graft model settings.
 *
 * **Example** (Enable the cooldown preflight)
 * ```ts
 * typeof withGraftEnv // => "function"
 * ```
 * @category test-layers
 * @since 0.0.0
 */
export const withGraftEnv = (values: Readonly<Record<string, string>>) =>
  ConfigProvider.fromUnknown({
    ...values,
    GRAFT_PROVIDER: "openai",
    GRAFT_BASE_URL: "http://127.0.0.1:8317/v1/",
    GRAFT_MODEL: "claude-opus-5",
    GRAFT_API_KEY: graftTestApiKey,
  });

/**
 * Answers every request with the scripted web response, or a transport failure when it is none.
 *
 * **Details**
 * `seen` records each request so tests can assert the probe's method, URL, and headers.
 *
 * **Example** (Script a cooldown answer)
 * ```ts
 * typeof scriptedHttpClient // => "function"
 * ```
 * @category test-layers
 * @since 0.0.0
 */
export const scriptedHttpClient = ({
  respond,
  seen = [],
}: {
  readonly respond: () => Response | undefined;
  readonly seen?: Array<HttpClientRequest.HttpClientRequest>;
}) =>
  HttpClient.make((request) => {
    seen.push(request);
    const response = respond();
    return response === undefined
      ? Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, cause: "connection refused" }),
          })
        )
      : Effect.succeed(HttpClientResponse.fromWeb(request, response));
  });

export const testPlatform = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(provideScopedLayer(NodeServices.layer));

export const workspace = ReferenceWorkspace;

/**
 * Exposes one isolated reference fixture to its test registration.
 *
 * **Example** (Read the fixture)
 * ```ts
 * import { Effect } from "effect"
 * Effect.isEffect(ReferenceFixture) // => true
 * ```
 * @category test-services
 * @since 0.0.0
 */
export class ReferenceFixture extends Context.Service<ReferenceFixture, Effect.Success<ReturnType<typeof fixture>>>()(
  "@beep/repo-cli/test/refs-test-utils/ReferenceFixture"
) {}

/**
 * Acquires a fixture and its reference service for one test registration.
 *
 * **Details**
 * Register this layer separately for each test. Its temporary directory lives
 * until that registration closes; never share the mutable fixture across tests.
 *
 * **Example** (Inspect the fixture layer)
 * ```ts
 * import { Layer } from "effect"
 * Layer.isLayer(referenceFixtureLayer) // => true
 * ```
 * @category test-layers
 * @since 0.0.0
 */
export const referenceFixtureLayer = Layer.unwrap(
  Effect.gen(function* () {
    const value = yield* fixture();
    // Without GRAFT settings the probe never runs; the offline client guards against leaks.
    return Layer.mergeAll(
      Layer.succeed(ReferenceFixture, value),
      Layer.succeed(HttpClient.HttpClient, scriptedHttpClient({ respond: () => undefined })),
      value.service
    );
  })
).pipe(Layer.provideMerge(NodeServices.layer));
