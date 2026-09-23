/**
 * Catalog-side services for `beep models`: the I/O seam, the layered catalog,
 * and the home snapshot ledger.
 *
 * **Details**
 *
 * {@link ModelsCatalogSources} is the one seam that touches the network, a
 * subprocess, or a file outside the manifest, which is what lets the catalog
 * and the ledger be exercised entirely from fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import { Crypto, DateTime, Effect, Encoding, FileSystem, Layer, Path } from "effect";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { runCaptured } from "../../internal/process/StepExec.ts";
import {
  CatalogModel,
  CatalogSnapshot,
  CatalogSnapshotSummary,
  CodexModelsCache,
  CursorModelList,
  GrokModelsCache,
  ProxyModelsResponse,
  UpstreamCatalog,
} from "./Models.catalog.schemas.ts";
import { mergeLayers } from "./Models.diff.ts";
import { ModelsCatalogError, ModelsLedgerError } from "./Models.errors.ts";
import { defaultProxyBaseUrl, parseJsonText, upstreamCatalogUrls } from "./Models.paths.ts";
import type { CatalogSource } from "./Models.catalog.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.catalog.service");

const decodeUpstream = S.decodeUnknownEffect(UpstreamCatalog);
const decodeCodexCache = S.decodeUnknownEffect(CodexModelsCache);
const decodeGrokCache = S.decodeUnknownEffect(GrokModelsCache);
const decodeProxyModels = S.decodeUnknownEffect(ProxyModelsResponse);
const decodeCursorModels = S.decodeUnknownEffect(CursorModelList);
const decodeSnapshot = S.decodeUnknownEffect(CatalogSnapshot);
const encodeSnapshot = S.encodeUnknownEffect(CatalogSnapshot);
const encodeCatalogModels = S.encodeUnknownEffect(S.Array(CatalogModel));

const textEncoder = new TextEncoder();

const ledgerRelativeDir: ReadonlyArray<string> = [".local", "state", "beep", "models"];

const readOptionalFile = Effect.fnUntraced(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(() => false));
  return exists
    ? yield* fs.readFileString(absolutePath).pipe(Effect.asSome, Effect.orElseSucceed(O.none))
    : O.none<string>();
});

// ── I/O seam ────────────────────────────────────────────────────────────────

/**
 * Everything a catalog assembly touches outside the manifest.
 *
 * **Details**
 *
 * Only the upstream fetch can fail: each overlay answers `None` when its
 * source is absent — no Codex cache on this box, no `cursor-agent` binary, a
 * proxy that is not running — because an absent overlay weakens availability
 * rather than removing models. The proxy reader never logs, echoes, or returns
 * the client token.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsCatalogSourcesShape {
  readonly fetchUpstream: Effect.Effect<UpstreamCatalog, ModelsCatalogError>;
  readonly listCursorModels: Effect.Effect<O.Option<CursorModelList>, ModelsCatalogError>;
  readonly listProxyModels: (
    baseUrl: string,
    tokenPath: string
  ) => Effect.Effect<O.Option<ProxyModelsResponse>, ModelsCatalogError>;
  readonly readCodexCache: (home: string) => Effect.Effect<O.Option<CodexModelsCache>, ModelsCatalogError>;
  readonly readGrokCache: (home: string) => Effect.Effect<O.Option<GrokModelsCache>, ModelsCatalogError>;
}

/**
 * The one seam through which catalog assembly reaches the outside world.
 *
 * **Example** (Describe a sources program)
 *
 * ```ts
 * import { ModelsCatalogSources } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsCatalogSources.use((sources) => sources.fetchUpstream)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsCatalogSources extends Context.Service<ModelsCatalogSources, ModelsCatalogSourcesShape>()(
  $I`ModelsCatalogSources`
) {}

/**
 * Parse the `<id> - <label>` lines `cursor-agent models` prints.
 *
 * **Example** (Parse a two-line listing)
 *
 * ```ts
 * import { parseCursorModelLines } from "@beep/repo-cli/commands/Models"
 *
 * console.log(parseCursorModelLines("composer-2.5 - Composer\nauto - Auto\n").length) // 2
 * ```
 *
 * @param output - The captured stdout of `cursor-agent models`.
 * @returns The seat ids, in listing order.
 * @category mapping
 * @since 0.0.0
 */
export const parseCursorModelLines = (output: string): ReadonlyArray<string> =>
  pipe(
    Str.split(output, "\n"),
    A.map((line) => Str.trim(pipe(Str.split(line, " - "), A.headNonEmpty))),
    A.filter(Str.isNonEmpty)
  );

const fetchUpstreamFrom = Effect.fnUntraced(function* (url: string) {
  const response = yield* HttpClient.get(url).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    ModelsCatalogError.mapError(`Failed to fetch ${url}`, "router-for-me")
  );
  const json = yield* response.json.pipe(
    ModelsCatalogError.mapError(`Failed to read the model manifest body from ${url}`, "router-for-me")
  );
  return yield* decodeUpstream(json).pipe(
    ModelsCatalogError.mapError(`Failed to decode the model manifest from ${url}`, "router-for-me")
  );
});

const makeCatalogSources = Effect.fnUntraced(function* () {
  const crypto = yield* Crypto.Crypto;
  const httpClient = yield* HttpClient.HttpClient;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const withFs = <AA, EE>(effect: Effect.Effect<AA, EE, FileSystem.FileSystem>) =>
    Effect.provideService(effect, FileSystem.FileSystem, fs);
  const withHttp = <AA, EE>(effect: Effect.Effect<AA, EE, HttpClient.HttpClient>) =>
    Effect.provideService(effect, HttpClient.HttpClient, httpClient);

  const fetchUpstream: ModelsCatalogSourcesShape["fetchUpstream"] = withHttp(
    A.reduce(A.drop(upstreamCatalogUrls, 1), fetchUpstreamFrom(A.headNonEmpty(upstreamCatalogUrls)), (left, url) =>
      Effect.catch(left, () => fetchUpstreamFrom(url))
    )
  );

  const readJsonCache = Effect.fnUntraced(function* <AA>(
    home: string,
    relative: ReadonlyArray<string>,
    decode: (input: unknown) => Effect.Effect<AA, S.SchemaError>,
    source: CatalogSource
  ): Effect.fn.Return<O.Option<AA>, ModelsCatalogError> {
    const absolutePath = [home, ...relative].join("/");
    const text = yield* withFs(readOptionalFile(absolutePath));
    return yield* pipe(
      text,
      O.flatMap(parseJsonText),
      O.match({
        onNone: () => Effect.succeed(O.none<AA>()),
        onSome: (json) =>
          decode(json).pipe(Effect.asSome, ModelsCatalogError.mapError(`Failed to decode ${absolutePath}`, source)),
      })
    );
  });

  const readCodexCache: ModelsCatalogSourcesShape["readCodexCache"] = (home) =>
    readJsonCache(home, [".codex", "models_cache.json"], decodeCodexCache, "codex-cache");

  const readGrokCache: ModelsCatalogSourcesShape["readGrokCache"] = (home) =>
    readJsonCache(home, [".grok", "models_cache.json"], decodeGrokCache, "grok-cache");

  const listCursorModels: ModelsCatalogSourcesShape["listCursorModels"] = Effect.gen(function* () {
    const captured = yield* runCaptured({
      args: ["models"],
      command: "cursor-agent",
      source: "stdout",
      timeout: "60 seconds",
      trim: true,
    }).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.option
    );

    return yield* pipe(
      captured,
      O.filter((step) => step.exitCode === 0),
      O.map((step) => parseCursorModelLines(step.output)),
      O.match({
        onNone: () => Effect.succeed(O.none<CursorModelList>()),
        onSome: (ids) =>
          decodeCursorModels(ids).pipe(
            Effect.asSome,
            ModelsCatalogError.mapError("Failed to decode the cursor-agent model listing", "cursor-agent")
          ),
      })
    );
  });

  const listProxyModels: ModelsCatalogSourcesShape["listProxyModels"] = Effect.fnUntraced(function* (
    baseUrl: string,
    tokenPath: string
  ) {
    // The token is read straight into a request header and is never logged,
    // echoed, or carried into an error message.
    const token = yield* withFs(readOptionalFile(tokenPath)).pipe(Effect.map(O.map(Str.trim)));
    if (O.isNone(token) || Str.isEmpty(token.value)) {
      return O.none<ProxyModelsResponse>();
    }

    const listing = yield* withHttp(
      HttpClient.get(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${token.value}` },
      }).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.json)
      )
    ).pipe(Effect.option);

    return yield* pipe(
      listing,
      O.match({
        onNone: () => Effect.succeed(O.none<ProxyModelsResponse>()),
        onSome: (json) => decodeProxyModels(json).pipe(Effect.asSome, Effect.orElseSucceed(O.none)),
      })
    );
  });

  return ModelsCatalogSources.of({
    fetchUpstream,
    readCodexCache,
    readGrokCache,
    listCursorModels,
    listProxyModels,
  });
});

/**
 * Live catalog sources over the platform HTTP client, file system, and
 * child-process spawner.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsCatalogSourcesLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsCatalogSourcesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsCatalogSourcesLive: Layer.Layer<
  ModelsCatalogSources,
  never,
  Crypto.Crypto | HttpClient.HttpClient | FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(ModelsCatalogSources, makeCatalogSources());

// ── Catalog ─────────────────────────────────────────────────────────────────

/**
 * Options one catalog assembly runs under.
 *
 * **Example** (Assemble from local overlays alone)
 *
 * ```ts
 * import { ModelsCatalogOptions } from "@beep/repo-cli/commands/Models"
 *
 * const options = ModelsCatalogOptions.make({ home: "/home/op", offline: true })
 * console.log(options.offline) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsCatalogOptions extends S.Class<ModelsCatalogOptions>($I`ModelsCatalogOptions`)(
  {
    home: S.NonEmptyString,
    offline: S.Boolean,
  },
  $I.annote("ModelsCatalogOptions", {
    description: "The operator home one assembly reads overlays under, and whether it skips the upstream fetch.",
  })
) {}

/**
 * Assembles the layered catalog into one dated snapshot.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsCatalogShape {
  readonly snapshot: (
    options: ModelsCatalogOptions
  ) => Effect.Effect<CatalogSnapshot, ModelsCatalogError, ModelsCatalogSources>;
}

/**
 * The layered catalog: upstream existence narrowed by four availability
 * overlays.
 *
 * **Example** (Describe a snapshot program)
 *
 * ```ts
 * import { ModelsCatalog } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsCatalog.use((catalog) => catalog.snapshot({ home: "/home/op", offline: true }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsCatalog extends Context.Service<ModelsCatalog, ModelsCatalogShape>()($I`ModelsCatalog`) {}

const sourcesAnswered = (answers: {
  readonly upstream: O.Option<unknown>;
  readonly codex: O.Option<unknown>;
  readonly grok: O.Option<unknown>;
  readonly cursor: O.Option<unknown>;
  readonly proxy: O.Option<unknown>;
}): ReadonlyArray<CatalogSource> =>
  pipe(
    [
      ["router-for-me", answers.upstream],
      ["codex-cache", answers.codex],
      ["grok-cache", answers.grok],
      ["cursor-agent", answers.cursor],
      ["proxy-v1-models", answers.proxy],
    ] as ReadonlyArray<readonly [CatalogSource, O.Option<unknown>]>,
    A.map(([source, value]) => (O.isSome(value) ? O.some(source) : O.none<CatalogSource>())),
    A.getSomes
  );

const makeCatalog = Effect.fnUntraced(function* () {
  const crypto = yield* Crypto.Crypto;

  const snapshot: ModelsCatalogShape["snapshot"] = Effect.fnUntraced(function* (options: ModelsCatalogOptions) {
    const sources = yield* ModelsCatalogSources;
    const upstream = options.offline ? O.none<UpstreamCatalog>() : yield* Effect.asSome(sources.fetchUpstream);
    const codex = yield* sources.readCodexCache(options.home);
    const grok = yield* sources.readGrokCache(options.home);
    const cursor = yield* sources.listCursorModels;
    const proxy = yield* sources.listProxyModels(defaultProxyBaseUrl, `${options.home}/.cli-proxy-api/client-token`);

    const models = mergeLayers({ upstream, codex, grok, cursor, proxy });
    const encoded = yield* encodeCatalogModels(models).pipe(
      ModelsCatalogError.mapError("Failed to encode the assembled catalog snapshot")
    );
    const digest = yield* crypto
      .digest("SHA-256", textEncoder.encode(formatJsonValue(encoded)))
      .pipe(ModelsCatalogError.mapError("Failed to digest the assembled catalog snapshot"));
    const now = yield* DateTime.now;

    return CatalogSnapshot.make({
      summary: CatalogSnapshotSummary.make({
        fetchedAt: now,
        contentSha256: Encoding.encodeHex(digest),
        sources: sourcesAnswered({ upstream, codex, grok, cursor, proxy }),
        modelCount: A.length(models),
      }),
      models,
    });
  });

  return ModelsCatalog.of({ snapshot });
});

/**
 * Live catalog over the platform crypto service.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsCatalogLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsCatalogLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsCatalogLive: Layer.Layer<ModelsCatalog, never, Crypto.Crypto> = Layer.effect(
  ModelsCatalog,
  makeCatalog()
);

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * Dated catalog snapshots under `$HOME/.local/state/beep/models/`.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsLedgerShape {
  readonly latest: (home: string) => Effect.Effect<O.Option<CatalogSnapshot>, ModelsLedgerError>;
  readonly record: (home: string, snapshot: CatalogSnapshot) => Effect.Effect<string, ModelsLedgerError>;
}

/**
 * The home ledger of dated catalog snapshots.
 *
 * **Example** (Describe a ledger read)
 *
 * ```ts
 * import { ModelsLedger } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsLedger.use((ledger) => ledger.latest("/home/op"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsLedger extends Context.Service<ModelsLedger, ModelsLedgerShape>()($I`ModelsLedger`) {}

const makeLedger = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledgerDir = (home: string): string => path.join(home, ...ledgerRelativeDir);
  const latestPath = (home: string): string => path.join(ledgerDir(home), "latest.json");

  const latest: ModelsLedgerShape["latest"] = Effect.fnUntraced(function* (home: string) {
    const file = latestPath(home);
    const text = yield* Effect.provideService(readOptionalFile(file), FileSystem.FileSystem, fs);
    return yield* pipe(
      text,
      O.flatMap(parseJsonText),
      O.match({
        onNone: () => Effect.succeed(O.none<CatalogSnapshot>()),
        onSome: (json) =>
          decodeSnapshot(json).pipe(Effect.asSome, ModelsLedgerError.mapError(`Failed to decode ${file}`, file)),
      })
    );
  });

  const record: ModelsLedgerShape["record"] = Effect.fnUntraced(function* (home: string, snapshot: CatalogSnapshot) {
    const previous = yield* latest(home);
    const unchanged = O.exists(previous, (entry) => entry.summary.contentSha256 === snapshot.summary.contentSha256);
    if (unchanged) {
      return latestPath(home);
    }

    const directory = ledgerDir(home);
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(ModelsLedgerError.mapError(`Failed to create ${directory}`, directory));

    const encoded = yield* encodeSnapshot(snapshot).pipe(
      ModelsLedgerError.mapError("Failed to encode a catalog snapshot")
    );
    const body = formatJsonValue(encoded);
    const stamp = pipe(DateTime.formatIso(snapshot.summary.fetchedAt), Str.replaceAll(":", "-"));
    const shortSha = Str.slice(0, 8)(snapshot.summary.contentSha256);
    const datedPath = path.join(directory, `${stamp}-${shortSha}.json`);

    yield* fs
      .writeFileString(datedPath, body)
      .pipe(ModelsLedgerError.mapError(`Failed to write ${datedPath}`, datedPath));
    yield* fs
      .writeFileString(latestPath(home), body)
      .pipe(ModelsLedgerError.mapError(`Failed to write ${latestPath(home)}`, latestPath(home)));

    return datedPath;
  });

  return ModelsLedger.of({ latest, record });
});

/**
 * Live ledger over the platform file system.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsLedgerLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsLedgerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsLedgerLive: Layer.Layer<ModelsLedger, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
  ModelsLedger,
  makeLedger()
);
