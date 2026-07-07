/**
 * Runpod LLM documentation index client.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { Fn, SchemaUtils, URLStr } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Config, Context, Effect, flow, Layer, pipe, SchemaIssue } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { RUNPOD_DOCS_INDEX_URL, RunpodConfigUrl, RunpodDocsConfigInput } from "./Runpod.config.ts";
import { RunpodDocsError } from "./Runpod.errors.ts";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const $I = $RunpodId.create("RunpodDocs.service");
const defaultDocsSection = "Docs";
const RunpodDocsUrl = S.String.check(URLStr.filter).pipe(
  $I.annoteSchema("RunpodDocsUrl", {
    description: "Absolute URL parsed from Runpod documentation index links.",
    toArbitrary: () => (fc) => fc.webUrl(),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * One Markdown documentation link parsed from Runpod's `llms.txt` index.
 *
 * @example
 * ```ts
 * import { RunpodDocsIndexEntry } from "@beep/runpod"
 *
 * const entry = RunpodDocsIndexEntry.make({
 *   section: "Pods",
 *   title: "Create a pod",
 *   url: "https://docs.runpod.io/pods"
 * })
 * console.log(entry.title)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodDocsIndexEntry extends S.Class<RunpodDocsIndexEntry>($I`RunpodDocsIndexEntry`)(
  {
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    section: S.NonEmptyString,
    title: S.NonEmptyString,
    url: RunpodDocsUrl,
  },
  $I.annote("RunpodDocsIndexEntry", {
    description: "One Markdown documentation link parsed from Runpod's llms.txt index.",
  })
) {}

/**
 * Parsed Runpod documentation index.
 *
 * @example
 * ```ts
 * import { RunpodDocsIndex, RunpodDocsIndexEntry } from "@beep/runpod"
 *
 * const entry = RunpodDocsIndexEntry.make({
 *   section: "Pods",
 *   title: "Create a pod",
 *   url: "https://docs.runpod.io/pods"
 * })
 *
 * const index = RunpodDocsIndex.make({
 *   entries: [entry],
 *   title: "Runpod Documentation"
 * })
 * console.log(index.title)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodDocsIndex extends S.Class<RunpodDocsIndex>($I`RunpodDocsIndex`)(
  {
    entries: S.NonEmptyArray(RunpodDocsIndexEntry),
    title: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("Runpod Documentation")),
  },
  $I.annote("RunpodDocsIndex", {
    description: "Parsed Runpod documentation index from docs.runpod.io/llms.txt.",
  })
) {}

/**
 * Public service shape for the Runpod documentation index client.
 *
 * @category services
 * @since 0.1.0
 */
interface RunpodDocsShape {
  readonly fetchIndex: Effect.Effect<RunpodDocsIndex, RunpodDocsError>;
}

class ResolvedRunpodDocsConfig extends S.Class<ResolvedRunpodDocsConfig>($I`ResolvedRunpodDocsConfig`)(
  {
    headers: S.Record(S.String, S.String),
    indexUrl: S.String,
  },
  $I.annote("ResolvedRunpodDocsConfig", {
    description: "Resolved runtime configuration for the Runpod documentation index client.",
  })
) {}

class DocsParseState extends S.Class<DocsParseState>($I`DocsParseState`)(
  {
    entries: S.Array(RunpodDocsIndexEntry).pipe(SchemaUtils.withEmptyArrayDefaults<RunpodDocsIndexEntry>()),
    section: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultDocsSection)),
    title: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("DocsParseState", {
    description: "Internal parser state for Runpod's llms.txt index.",
  })
) {}

const normalizeUrl = Str.replace(/\/+$/, "");

const resolveConfig = (config: RunpodDocsConfigInput): ResolvedRunpodDocsConfig =>
  ResolvedRunpodDocsConfig.make({
    headers: config.headers,
    indexUrl: RunpodConfigUrl.fromUnknown(config.indexUrl),
  });

const nonEmptyTrimmed: (value: string) => O.Option<string> = flow(Str.trim, O.liftPredicate(Str.isNonEmpty));

const descriptionFrom: (value: string) => O.Option<string> = flow(
  Str.trim,
  O.liftPredicate(Str.startsWith(": ")),
  O.map(Str.slice(2)),
  O.flatMap(nonEmptyTrimmed)
);

const parseEntry = (section: string, line: string): O.Option<RunpodDocsIndexEntry> => {
  if (!pipe(line, Str.startsWith("- ["))) {
    return O.none();
  }

  const body = Str.slice(3)(line);
  return pipe(
    Str.indexOf("](")(body),
    O.flatMap((titleEnd) => {
      const afterTitle = Str.slice(titleEnd + 2)(body);
      return pipe(
        Str.indexOf(")")(afterTitle),
        O.flatMap((urlEnd) => {
          const description = descriptionFrom(Str.slice(urlEnd + 1)(afterTitle));
          return pipe(
            O.all({
              title: nonEmptyTrimmed(Str.slice(0, titleEnd)(body)),
              url: pipe(nonEmptyTrimmed(Str.slice(0, urlEnd)(afterTitle)), O.filter(RunpodDocsUrl.is)),
            }),
            O.map(({ title, url }) =>
              RunpodDocsIndexEntry.make({
                description,
                section,
                title,
                url,
              })
            )
          );
        })
      );
    })
  );
};

const parseLine = (state: DocsParseState, rawLine: string): DocsParseState => {
  const line = Str.trim(rawLine);

  if (pipe(line, Str.startsWith("# "))) {
    return pipe(
      nonEmptyTrimmed(Str.slice(2)(line)),
      O.map((title) =>
        DocsParseState.make({
          ...state,
          title: O.some(title),
        })
      ),
      O.getOrElse(() => state)
    );
  }

  if (pipe(line, Str.startsWith("## "))) {
    return pipe(
      nonEmptyTrimmed(Str.slice(3)(line)),
      O.map((section) =>
        DocsParseState.make({
          ...state,
          section,
        })
      ),
      O.getOrElse(() => state)
    );
  }

  return pipe(
    parseEntry(state.section, line),
    O.match({
      onNone: () => state,
      onSome: (entry) =>
        DocsParseState.make({
          ...state,
          entries: A.append(state.entries, entry),
        }),
    })
  );
};

/**
 * Schema contract for parsing Runpod's `llms.txt` Markdown index.
 *
 * @example
 * ```ts
 * import { RunpodDocsIndexParser } from "@beep/runpod"
 *
 * console.log(RunpodDocsIndexParser.inputSchema.ast)
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const RunpodDocsIndexParser = Fn({
  input: S.String,
  output: RunpodDocsIndex,
  error: RunpodDocsError,
}).pipe(
  $I.annoteSchema("RunpodDocsIndexParser", {
    description: "Schema contract for parsing Runpod's llms.txt Markdown index.",
  })
);

const parseRunpodDocsIndexContract = RunpodDocsIndexParser.implementEffect(
  Effect.fn("RunpodDocs.parseRunpodDocsIndexContract")(function* (text) {
    const state = pipe(A.fromIterable(Str.linesIterator(text)), A.reduce(DocsParseState.make({}), parseLine));

    return yield* A.match(state.entries, {
      onEmpty: () => Effect.fail(RunpodDocsError.fromReason("parse")),
      onNonEmpty: (entries) =>
        Effect.succeed(
          RunpodDocsIndex.make({
            entries,
            ...O.getSomesStruct({ title: state.title }),
          })
        ),
    });
  })
);

const mapParserContractError = (cause: RunpodDocsError | SchemaIssue.Issue): RunpodDocsError =>
  SchemaIssue.isIssue(cause) ? RunpodDocsError.fromReason("parse", { cause }) : cause;

/**
 * Parse Runpod's `llms.txt` Markdown index into a structured schema model.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { parseRunpodDocsIndex } from "@beep/runpod"
 *
 * const markdown = "# Runpod Docs\n\n## Pods\n- [Create a pod](https://docs.runpod.io/pods)"
 * const program = parseRunpodDocsIndex(markdown)
 * Effect.runPromise(program).then((index) => console.log(index.entries.length))
 * ```
 *
 * @effects Parses text into a schema model and fails with `RunpodDocsError` when the index contains no entries.
 *
 * @category parsing
 * @since 0.1.0
 */
export const parseRunpodDocsIndex = Effect.fn("RunpodDocs.parseRunpodDocsIndex")(function* (
  text: string
): Effect.fn.Return<RunpodDocsIndex, RunpodDocsError> {
  return yield* parseRunpodDocsIndexContract(text).pipe(Effect.mapError(mapParserContractError));
});

const ensureSuccessStatus = Effect.fnUntraced(function* (
  url: string,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, RunpodDocsError> {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  return yield* RunpodDocsError.fromReason("response status", { status: response.status, url });
});

const fetchIndex = Effect.fn("RunpodDocs.fetchIndex")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedRunpodDocsConfig
) {
  return yield* pipe(
    HttpClientRequest.get(config.indexUrl),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.accept("text/plain"),
    (request) => client.execute(request),
    Effect.mapError((cause) => RunpodDocsError.fromReason("transport", { cause, url: config.indexUrl })),
    Effect.flatMap((response) => ensureSuccessStatus(config.indexUrl, response)),
    Effect.flatMap((response) =>
      response.text.pipe(
        Effect.mapError((cause) => RunpodDocsError.fromReason("response decoding", { cause, url: config.indexUrl }))
      )
    ),
    Effect.flatMap(parseRunpodDocsIndex),
    Effect.withSpan("RunpodDocs.fetchIndex", {
      attributes: {
        provider: "runpod",
        url: normalizeUrl(config.indexUrl),
      },
    })
  );
});

const makeFetchIndex = (
  client: HttpClient.HttpClient,
  config: ResolvedRunpodDocsConfig
): RunpodDocsShape["fetchIndex"] => fetchIndex(client, config);

const makeRunpodDocsFromConfig = Effect.fn("RunpodDocs.makeRunpodDocsFromConfig")(function* (
  config: ResolvedRunpodDocsConfig
): Effect.fn.Return<RunpodDocsShape, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  return RunpodDocs.of({
    fetchIndex: makeFetchIndex(client, config),
  });
});

const makeRunpodDocsFromEnvironment = Effect.fn("RunpodDocs.makeRunpodDocsFromEnvironment")(function* () {
  const indexUrl = yield* Config.string("RUNPOD_DOCS_INDEX_URL").pipe(Config.withDefault(RUNPOD_DOCS_INDEX_URL));
  return yield* makeRunpodDocsFromConfig(
    resolveConfig(
      RunpodDocsConfigInput.make({
        indexUrl,
      })
    )
  );
});

/**
 * Effect service for the Runpod LLM documentation index.
 *
 * @example
 * ```ts
 * import { RunpodDocs, RunpodDocsConfigInput } from "@beep/runpod"
 *
 * const layer = RunpodDocs.makeLayer(
 *   RunpodDocsConfigInput.make({ indexUrl: "https://docs.runpod.io/llms.txt" })
 * )
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class RunpodDocs extends Context.Service<RunpodDocs, RunpodDocsShape>()($I`RunpodDocs`) {
  /**
   * Build a Runpod docs layer from explicit runtime configuration.
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly makeLayer = (
    config = RunpodDocsConfigInput.make({})
  ): Layer.Layer<RunpodDocs, never, HttpClient.HttpClient> =>
    Layer.effect(RunpodDocs, makeRunpodDocsFromConfig(resolveConfig(config)));

  /**
   * Live Runpod docs layer backed by `RUNPOD_DOCS_INDEX_URL` when provided.
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer: Layer.Layer<RunpodDocs, RunpodDocsError> = Layer.effect(
    RunpodDocs,
    makeRunpodDocsFromEnvironment().pipe(Effect.mapError((cause) => RunpodDocsError.fromReason("config", { cause })))
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
