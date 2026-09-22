/**
 * Fixture readers and the fixture-backed catalog-sources layer shared by the
 * `beep models` test files.
 *
 * @internal
 */
import {
  CodexModelsCache,
  CursorModelList,
  GrokModelsCache,
  ModelsCatalogSources,
  ProxyModelsResponse,
  parseCursorModelLines,
  UpstreamCatalog,
} from "@beep/repo-cli/commands/Models";
import { Effect, FileSystem, Layer } from "effect";
import { constant } from "effect/Function";
import * as S from "effect/Schema";
import type * as PlatformError from "effect/PlatformError";

const fixturesDir = new URL("../fixtures/models/", import.meta.url).pathname;

const decoderFor = <Schema extends S.Top>(schema: Schema) => S.decodeUnknownEffect(schema);

/**
 * Read one `test/fixtures/models` file as text.
 *
 * @internal
 */
export const readFixtureText = (
  name: string
): Effect.Effect<string, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${fixturesDir}${name}`));

const readFixtureAs = <Schema extends S.Top>(
  schema: Schema,
  name: string
): Effect.Effect<
  Schema["Type"],
  PlatformError.PlatformError | S.SchemaError,
  FileSystem.FileSystem | Schema["DecodingServices"]
> => Effect.flatMap(Effect.flatMap(readFixtureText(name), decoderFor(S.fromJsonString(S.Json))), decoderFor(schema));

/**
 * Decode every catalog fixture into the shapes a snapshot is assembled from.
 *
 * @internal
 */
export const readFixtureLayers = Effect.fnUntraced(function* () {
  const upstream = yield* readFixtureAs(UpstreamCatalog, "models.json");
  const codex = yield* readFixtureAs(CodexModelsCache, "codex-models-cache.json");
  const grok = yield* readFixtureAs(GrokModelsCache, "grok-models-cache.json");
  const proxy = yield* readFixtureAs(ProxyModelsResponse, "proxy-models.json");
  const cursor = yield* Effect.flatMap(
    Effect.map(readFixtureText("cursor-models.txt"), parseCursorModelLines),
    decoderFor(CursorModelList)
  );
  return { upstream, codex, grok, proxy, cursor };
});

/**
 * A `ModelsCatalogSources` layer that answers from the checked-in fixtures.
 *
 * @internal
 */
export const FixtureCatalogSources = Layer.effect(
  ModelsCatalogSources,
  Effect.map(readFixtureLayers(), (fixtures) => {
    // Each overlay answers the same fixture however often it is asked, so the
    // effects are built once and handed back rather than rebuilt per call.
    const codexCache = Effect.succeedSome(fixtures.codex);
    const grokCache = Effect.succeedSome(fixtures.grok);
    const proxyModels = Effect.succeedSome(fixtures.proxy);

    return ModelsCatalogSources.of({
      fetchUpstream: Effect.succeed(fixtures.upstream),
      readCodexCache: constant(codexCache),
      readGrokCache: constant(grokCache),
      listCursorModels: Effect.succeedSome(fixtures.cursor),
      listProxyModels: constant(proxyModels),
    });
  })
);

/**
 * The same fixture-backed sources with the proxy overlay silent, as a box with
 * no admitted proxy credential sees it.
 *
 * @internal
 */
export const FixtureCatalogSourcesWithoutProxy = Layer.effect(
  ModelsCatalogSources,
  Effect.map(readFixtureLayers(), (fixtures) => {
    const codexCache = Effect.succeedSome(fixtures.codex);
    const grokCache = Effect.succeedSome(fixtures.grok);
    const noProxy = Effect.succeedNone;

    return ModelsCatalogSources.of({
      fetchUpstream: Effect.succeed(fixtures.upstream),
      readCodexCache: constant(codexCache),
      readGrokCache: constant(grokCache),
      listCursorModels: Effect.succeedSome(fixtures.cursor),
      listProxyModels: constant(noProxy),
    });
  })
);
