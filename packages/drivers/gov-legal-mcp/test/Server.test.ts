/**
 * Offline contract proofs for the thin gov-legal MCP host.
 *
 * Synthetic `HttpClient` responses exercise the real public GovInfo and eCFR
 * driver layers without network access or real credentials.
 *
 * @since 0.0.0
 */

import {
  Ecfr,
  EcfrConfigInput,
  EcfrDatedTitleParams,
  EcfrSearchParams,
  SearchResultsResponse,
  StructureNode,
  TitlesResponse,
} from "@beep/ecfr";
import {
  buildToolNameCollisionReport,
  EcfrListTitlesParams,
  EcfrSourceAuthRegistration,
  EcfrToolkit,
  EcfrToolkitHandlersLive,
  GovinfoSearchFailure,
  GovinfoSourceAuthRegistration,
  GovinfoToolkit,
  GovinfoToolkitHandlersLive,
  ProductionToolNameCollisionReport,
  projectToolNameCandidate,
  renderToolNameCollisionReport,
  resolveProductionToolName,
  ToolNameCandidate,
  ToolNameCollisionError,
  ToolNameCollisionReport,
  ToolNameCollisionRow,
  VERSION,
} from "@beep/gov-legal-mcp";
import { Govinfo, GovinfoConfigInput, GovinfoError, GovinfoErrorOptions, Search } from "@beep/govinfo";
import { composeGatedLayers, gatedLayer, sanitizedToolkit } from "@beep/mcp-kit";
import { fcRuns } from "@beep/test-utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import { FastCheck as fc } from "effect/testing";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import type * as Context from "effect/Context";

const SENTINEL = "gov-legal-sensitive-sentinel";
const GOVINFO_API_KEY_SENTINEL = "synthetic-test-key";
const sensitiveSpanAttributeKeys = ["parameters", "url.full", "url.path", "url.query"];
const sensitiveValues = [SENTINEL, GOVINFO_API_KEY_SENTINEL];
const ECFR_TITLE_PATH = "/api/versioner/v1/titles.json";
const ECFR_SEARCH_PATH = "/api/search/v1/results";
const ECFR_STRUCTURE_PATH = "/api/versioner/v1/structure/";
const GOVINFO_SEARCH_PATH = "/search";

const titlesFixture = '{"titles":[{"number":1,"name":"General Provisions","reserved":false}]}';
const searchResultsFixture =
  '{"results":[{"title":1,"full_text_excerpt":"synthetic result"}],"meta":{"current_page":1,"total_count":1,"total_pages":1}}';
const structureFixture = '{"type":"title","label":"Title 1","identifier":"1","children":[]}';
const govinfoFixture = '{"count":0,"offsetMark":"next-cursor","results":[]}';

const govinfoArguments = {
  historical: false,
  offsetMark: "*",
  pageSize: 1,
  query: SENTINEL,
  resultLevel: "default",
  sorts: [{ field: "publishdate", sortOrder: "DESC" }],
};
const ecfrSearchArguments = { query: SENTINEL };
const ecfrStructureArguments = { date: "2026-07-31", title: SENTINEL };

const fixtureBody = Match.type<string>().pipe(
  Match.when(Str.includes(ECFR_TITLE_PATH), () => titlesFixture),
  Match.when(Str.includes(ECFR_SEARCH_PATH), () => searchResultsFixture),
  Match.when(Str.includes(ECFR_STRUCTURE_PATH), () => structureFixture),
  Match.when(Str.includes(GOVINFO_SEARCH_PATH), () => govinfoFixture),
  Match.orElse(() => govinfoFixture)
);

const FixtureHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.sync(() =>
      HttpClientResponse.fromWeb(
        request,
        new Response(fixtureBody(request.url), { headers: { "content-type": "application/json" } })
      )
    )
  )
);

const FixtureEcfr = Ecfr.makeLayer(EcfrConfigInput.make({})).pipe(
  Layer.provide(FixtureHttpClient),
  Layer.provide(RateLimiter.layerStoreMemory)
);

const FixtureGovinfo = Govinfo.makeLayer(
  GovinfoConfigInput.make({ apiKey: O.some(Redacted.make(GOVINFO_API_KEY_SENTINEL)) })
).pipe(Layer.provide(FixtureHttpClient), Layer.provide(RateLimiter.layerStoreMemory));

const rawGovinfoFailure = GovinfoError.of(
  "transport",
  GovinfoErrorOptions.make({
    cause: O.some(`https://api.govinfo.gov/search?api_key=${GOVINFO_API_KEY_SENTINEL}&query=${SENTINEL}`),
  })
);

const FixtureFailingGovinfo = Layer.succeed(
  Govinfo,
  Govinfo.of({
    rateLimit: Effect.succeedNone,
    search: Effect.fn("FixtureGovinfo.search")(function* (_request: Search.Payload) {
      return yield* rawGovinfoFailure;
    }),
  })
);

const EcfrRegistrationLayer = sanitizedToolkit(EcfrToolkit).pipe(
  Layer.provide(EcfrToolkitHandlersLive),
  Layer.provide(FixtureEcfr)
);

const GovinfoRegistrationLayer = sanitizedToolkit(GovinfoToolkit).pipe(
  Layer.provide(GovinfoToolkitHandlersLive),
  Layer.provide(FixtureGovinfo)
);

const FailingGovinfoRegistrationLayer = sanitizedToolkit(GovinfoToolkit).pipe(
  Layer.provide(GovinfoToolkitHandlersLive),
  Layer.provide(FixtureFailingGovinfo)
);

// `McpServer.McpServer.layer` is typed as providing `McpServerClient` but only
// builds `McpServer`, so a direct `callTool` — one with no transport middleware
// in front of it — has to supply the caller itself.
const stubClientInfo = { name: "gov-legal-mcp-test-client", version: "0.0.0" };

const StubMcpClientLayer = Layer.succeed(
  McpSchema.McpServerClient,
  McpSchema.McpServerClient.of({
    clientId: 1,
    protocolVersion: "2025-06-18",
    clientCapabilities: {},
    clientInfo: stubClientInfo,
    getClient: Effect.die("the fixture client is never dereferenced") as never,
    initializePayload: {
      capabilities: {},
      clientInfo: stubClientInfo,
      protocolVersion: "2025-06-18",
    } as never,
  })
);

const buildFixtureLayer = (environment: Readonly<Record<string, string>>) =>
  Layer.mergeAll(
    McpServer.McpServer.layer,
    StubMcpClientLayer,
    composeGatedLayers(
      gatedLayer(EcfrSourceAuthRegistration, EcfrRegistrationLayer),
      gatedLayer(GovinfoSourceAuthRegistration, GovinfoRegistrationLayer)
    ).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(environment))), Layer.orDie)
  );

const buildEcfrOnlyLayer = () =>
  Layer.mergeAll(
    McpServer.McpServer.layer,
    StubMcpClientLayer,
    composeGatedLayers(gatedLayer(EcfrSourceAuthRegistration, EcfrRegistrationLayer)).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
      Layer.orDie
    )
  );

const buildFailingGovinfoLayer = () =>
  Layer.mergeAll(
    McpServer.McpServer.layer,
    StubMcpClientLayer,
    composeGatedLayers(gatedLayer(GovinfoSourceAuthRegistration, FailingGovinfoRegistrationLayer)).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ GOVINFO_API_KEY: "fixture-secret" }))),
      Layer.orDie
    )
  );

type McpServerShape = Context.Service.Shape<typeof McpServer.McpServer>;

const listedTools = (server: McpServerShape): ReadonlyArray<McpSchema.Tool> => A.map(server.tools, ({ tool }) => tool);

const listedNames = (server: McpServerShape): ReadonlyArray<string> =>
  pipe(
    listedTools(server),
    A.map((tool) => tool.name),
    A.sort(Order.String)
  );

interface RecordedAttribute {
  readonly key: string;
  readonly value: unknown;
}

interface RecordedSpan {
  readonly attributes: ReadonlyArray<RecordedAttribute>;
  readonly name: string;
}

const makeRecordingTracer = (): { readonly completed: Array<RecordedSpan>; readonly tracer: Tracer.Tracer } => {
  const completed: Array<RecordedSpan> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const attributes: Array<RecordedAttribute> = [];
      const span = new Tracer.NativeSpan(options);
      const originalAttribute = span.attribute.bind(span);
      const originalEnd = span.end.bind(span);
      span.attribute = (key: string, value: unknown) => {
        attributes.push({ key, value });
        originalAttribute(key, value);
      };
      span.end = (endTime, exit) => {
        completed.push({ attributes, name: span.name });
        originalEnd(endTime, exit);
      };
      return span;
    },
  });
  return { completed, tracer };
};

const isUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !P.isNull(value) && !A.isArray(value);

const containsSensitiveValue = (value: unknown): boolean =>
  Match.value(value).pipe(
    Match.when(P.isString, (text) => A.some(sensitiveValues, (sensitive) => Str.includes(sensitive)(text))),
    Match.when(A.isArray, A.some(containsSensitiveValue)),
    Match.when(isUnknownRecord, (record) => pipe(record, R.values, A.some(containsSensitiveValue))),
    Match.orElse(() => false)
  );

const assertCollision = (
  result: Result.Result<ToolNameCollisionReport, ToolNameCollisionError | unknown>,
  reason: "duplicate_normalized" | "duplicate_final"
): ToolNameCollisionError => {
  if (Result.isSuccess(result)) {
    assert.fail("Expected tool-name generation to fail closed.");
  }
  if (!S.is(ToolNameCollisionError)(result.failure)) {
    return assert.fail("Expected ToolNameCollisionError.");
  }
  assert.strictEqual(result.failure.reason, reason);
  assert.strictEqual(result.failure.report.duplicateVerdict, "duplicate");
  return result.failure;
};

describe("gov-legal MCP frozen contract", () => {
  layer(buildEcfrOnlyLayer())("with only the keyless eCFR source composed", (it) => {
    it.effect(
      "mounts and calls all three eCFR tools without credentials",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;

        assert.deepEqual(listedNames(server), ["ecfr_get_structure", "ecfr_list_titles", "ecfr_search_results"]);
        const titles = yield* server.callTool({ name: "ecfr_list_titles", arguments: {} });
        const search = yield* server.callTool({ name: "ecfr_search_results", arguments: ecfrSearchArguments });
        const structure = yield* server.callTool({
          name: "ecfr_get_structure",
          arguments: ecfrStructureArguments,
        });

        assert.isFalse(titles.isError);
        assert.isFalse(search.isError);
        assert.isFalse(structure.isError);
        yield* S.decodeUnknownEffect(TitlesResponse)(titles.structuredContent);
        yield* S.decodeUnknownEffect(SearchResultsResponse)(search.structuredContent);
        yield* S.decodeUnknownEffect(StructureNode)(structure.structuredContent);
      })
    );
  });

  layer(buildFixtureLayer({}))("without the GovInfo hard-gate key", (it) => {
    it.effect(
      "vanishes govinfo_search from listing and direct lookup",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        assert.isFalse(A.some(listedNames(server), Str.startsWith("govinfo_")));

        const result = yield* server
          .callTool({ name: "govinfo_search", arguments: govinfoArguments })
          .pipe(Effect.result);
        if (Result.isSuccess(result)) {
          return assert.fail("Expected the absent GovInfo tool lookup to fail.");
        }
        assert.isTrue(S.is(McpSchema.InvalidParams)(result.failure));
        if (!S.is(McpSchema.InvalidParams)(result.failure)) {
          return assert.fail("Expected an MCP InvalidParams tool-not-found failure.");
        }
        assert.strictEqual(result.failure.message, "Tool 'govinfo_search' not found");
      })
    );
  });

  layer(buildFixtureLayer({ GOVINFO_API_KEY: "fixture-secret" }))("with the GovInfo hard-gate key", (it) => {
    it.effect(
      "mounts govinfo_search and decodes its fixture result as Search.Success",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        assert.deepEqual(listedNames(server), [
          "ecfr_get_structure",
          "ecfr_list_titles",
          "ecfr_search_results",
          "govinfo_search",
        ]);

        const result = yield* server.callTool({ name: "govinfo_search", arguments: govinfoArguments });
        assert.isFalse(result.isError);
        const decoded = yield* S.decodeUnknownEffect(Search.Success)(result.structuredContent);
        assert.strictEqual(decoded.count, 0);
      })
    );

    it.effect(
      "decodes installed MCP definitions, listing, call envelopes, results, and source-schema round trips",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const tools = listedTools(server);

        yield* Effect.forEach(tools, (tool) =>
          S.encodeEffect(McpSchema.Tool)(tool).pipe(Effect.flatMap(S.decodeUnknownEffect(McpSchema.Tool)))
        );
        const listing = McpSchema.ListToolsResult.make({ tools });
        yield* S.decodeEffect(McpSchema.ListToolsResult)(yield* S.encodeEffect(McpSchema.ListToolsResult)(listing));

        const titlesArguments = yield* S.decodeEffect(EcfrListTitlesParams)({});
        const searchArguments = yield* S.decodeEffect(EcfrSearchParams)(ecfrSearchArguments);
        const structureArguments = yield* S.decodeEffect(EcfrDatedTitleParams)(ecfrStructureArguments);
        const govinfoSearchArguments = yield* S.decodeUnknownEffect(Search.Payload)(govinfoArguments);
        yield* S.decodeEffect(EcfrListTitlesParams)(yield* S.encodeEffect(EcfrListTitlesParams)(titlesArguments));
        yield* S.decodeEffect(EcfrSearchParams)(yield* S.encodeEffect(EcfrSearchParams)(searchArguments));
        yield* S.decodeEffect(EcfrDatedTitleParams)(yield* S.encodeEffect(EcfrDatedTitleParams)(structureArguments));
        yield* S.decodeEffect(Search.Payload)(yield* S.encodeEffect(Search.Payload)(govinfoSearchArguments));

        const requests = [
          { name: "ecfr_list_titles", arguments: {} },
          { name: "ecfr_search_results", arguments: ecfrSearchArguments },
          { name: "ecfr_get_structure", arguments: ecfrStructureArguments },
          { name: "govinfo_search", arguments: govinfoArguments },
        ];
        yield* Effect.forEach(requests, (request) => S.decodeEffect(McpSchema.CallTool.payloadSchema)(request));

        const titles = yield* server.callTool(A.getUnsafe(requests, 0));
        const search = yield* server.callTool(A.getUnsafe(requests, 1));
        const structure = yield* server.callTool(A.getUnsafe(requests, 2));
        const govinfo = yield* server.callTool(A.getUnsafe(requests, 3));
        yield* Effect.forEach([titles, search, structure, govinfo], (result) =>
          S.encodeEffect(McpSchema.CallToolResult)(result).pipe(
            Effect.flatMap(S.decodeUnknownEffect(McpSchema.CallToolResult))
          )
        );

        const titlesResult = yield* S.decodeUnknownEffect(TitlesResponse)(titles.structuredContent);
        const searchResult = yield* S.decodeUnknownEffect(SearchResultsResponse)(search.structuredContent);
        const structureResult = yield* S.decodeUnknownEffect(StructureNode)(structure.structuredContent);
        const govinfoResult = yield* S.decodeUnknownEffect(Search.Success)(govinfo.structuredContent);
        yield* S.decodeEffect(TitlesResponse)(yield* S.encodeEffect(TitlesResponse)(titlesResult));
        yield* S.decodeEffect(SearchResultsResponse)(yield* S.encodeEffect(SearchResultsResponse)(searchResult));
        yield* S.decodeEffect(StructureNode)(yield* S.encodeEffect(StructureNode)(structureResult));
        yield* S.decodeEffect(Search.Success)(yield* S.encodeEffect(Search.Success)(govinfoResult));
      })
    );

    it.effect(
      "keeps HTTP tracing enabled while suppressing request parameters from every completed span",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const { completed, tracer } = makeRecordingTracer();

        yield* Effect.withTracer(
          Effect.all([
            server.callTool({ name: "ecfr_list_titles", arguments: { sentinel: SENTINEL } }),
            server.callTool({ name: "ecfr_search_results", arguments: ecfrSearchArguments }),
            server.callTool({ name: "ecfr_get_structure", arguments: ecfrStructureArguments }),
            server.callTool({ name: "govinfo_search", arguments: govinfoArguments }),
          ]),
          tracer
        );

        assert.isTrue(A.isReadonlyArrayNonEmpty(completed));
        assert.isTrue(A.some(completed, (span) => Str.startsWith("http.client ")(span.name)));
        const sensitiveAttributes = A.flatMap(completed, (span) =>
          pipe(
            span.attributes,
            A.filter(
              (attribute) =>
                A.contains(sensitiveSpanAttributeKeys, attribute.key) || containsSensitiveValue(attribute.value)
            ),
            A.map((attribute) => ({ attribute, span: span.name }))
          )
        );
        assert.deepEqual(sensitiveAttributes, []);
        const tools = pipe(
          completed,
          A.flatMap((span) => span.attributes),
          A.filter((attribute) => attribute.key === "tool"),
          A.map((attribute) => attribute.value),
          A.filter(P.isString),
          A.sort(Order.String)
        );
        assert.deepEqual(tools, ["ecfr_get_structure", "ecfr_list_titles", "ecfr_search_results", "govinfo_search"]);
      })
    );

    it.effect(
      "encodes all four explicit read-only hint booleans",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        yield* Effect.forEach(listedTools(server), (tool) =>
          S.decodeUnknownEffect(McpSchema.ToolAnnotations)(tool.annotations).pipe(
            Effect.tap((annotations) =>
              Effect.sync(() => {
                assert.strictEqual(annotations.readOnlyHint, true);
                assert.strictEqual(annotations.destructiveHint, false);
                assert.strictEqual(annotations.idempotentHint, true);
                assert.strictEqual(annotations.openWorldHint, true);
              })
            )
          )
        );
      })
    );
  });

  layer(buildFailingGovinfoLayer())("when GovInfo returns a raw transport failure", (it) => {
    it.effect(
      "returns only the package-local sanitized failure envelope",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "govinfo_search", arguments: govinfoArguments });

        assert.isTrue(result.isError);
        const failure = yield* S.decodeUnknownEffect(GovinfoSearchFailure)(result.structuredContent);
        assert.strictEqual(failure.reason, "transport");
        assert.deepEqual(result.structuredContent, { _tag: "GovinfoSearchFailure", reason: "transport" });
        assert.isFalse(containsSensitiveValue(result));
      })
    );
  });

  it.effect(
    "fails closed on cross-driver normalization collisions",
    Effect.fnUntraced(function* () {
      const error = assertCollision(
        buildToolNameCollisionReport([
          ToolNameCandidate.make({ source: "agency.alpha", operationId: "search" }),
          ToolNameCandidate.make({ source: "agency_alpha", operationId: "search" }),
        ]),
        "duplicate_normalized"
      );
      assert.deepEqual(error.collisionKeys, ["agency_alpha_search"]);
    })
  );

  it("fails closed when a registered declaration is absent or its wire name drifts", () => {
    const missingReason = resolveProductionToolName(
      ToolNameCandidate.make({ source: "ecfr", operationId: "missing" }),
      "ecfr_missing"
    ).pipe(
      Result.match({
        onFailure: (error) => error.reason,
        onSuccess: () => "unexpected_success",
      })
    );
    const driftReason = resolveProductionToolName(
      ToolNameCandidate.make({ source: "ecfr", operationId: "listTitles" }),
      "ecfr_drifted"
    ).pipe(
      Result.match({
        onFailure: (error) => error.reason,
        onSuccess: () => "unexpected_success",
      })
    );

    assert.strictEqual(missingReason, "missing_candidate");
    assert.strictEqual(driftReason, "wire_name_drift");
  });

  it.effect(
    "marks punctuation normalization duplicates before failing",
    Effect.fnUntraced(function* () {
      const error = assertCollision(
        buildToolNameCollisionReport([
          ToolNameCandidate.make({ source: "ecfr", operationId: "search.results" }),
          ToolNameCandidate.make({ source: "ecfr", operationId: "search/results" }),
        ]),
        "duplicate_normalized"
      );
      assert.isTrue(A.every(error.report.candidates, (row) => row.duplicateVerdict === "duplicate_normalized"));
    })
  );

  it.effect(
    "reproduces and fails closed on the frozen SHA-256 truncation collision",
    Effect.fnUntraced(function* () {
      const firstValue = "ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_000000000g50";
      const secondValue = "ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_0000000011bm";
      const first = ToolNameCandidate.make({
        source: "ecfr",
        operationId: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_000000000g50",
      });
      const second = ToolNameCandidate.make({
        source: "ecfr",
        operationId: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_0000000011bm",
      });
      const firstRow = Result.getOrThrow(projectToolNameCandidate(first));
      const secondRow = Result.getOrThrow(projectToolNameCandidate(second));

      assert.strictEqual(firstRow.candidate, firstValue);
      assert.strictEqual(secondRow.candidate, secondValue);
      assert.strictEqual(firstRow.digest, "a06e92ed");
      assert.strictEqual(secondRow.digest, "a06e92ed");
      assert.strictEqual(firstRow.finalWireName.length, 64);
      assert.strictEqual(firstRow.finalWireName, secondRow.finalWireName);
      const error = assertCollision(buildToolNameCollisionReport([first, second]), "duplicate_final");
      assert.isTrue(A.every(error.report.candidates, (row) => row.duplicateVerdict === "duplicate_final"));
    })
  );

  it.effect(
    "imports the guarded bin module without launching stdio",
    Effect.fnUntraced(function* () {
      const bin = yield* Effect.promise(() => import("@beep/gov-legal-mcp/bin"));
      assert.strictEqual(bin.SERVER_CONFIG.name, "beep-gov-legal");
      assert.strictEqual(bin.SERVER_CONFIG.version, VERSION);
      assert.strictEqual(typeof bin.runGovLegalMcpServer, "function");
    })
  );
});

const ToolNameCandidateArbitrary = S.toArbitrary(ToolNameCandidate)(fc);

const encodeThrowing = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  value: Codec["Type"]
): Codec["Encoded"] => Result.getOrThrow(S.encodeResult(schema)(value));

const decodeThrowing = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  value: Codec["Encoded"]
): Codec["Type"] => Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encodeThrowing(schema, value);
  const decoded = decodeThrowing(schema, encoded);
  const reencoded = encodeThrowing(schema, decoded);

  assert.deepEqual(reencoded, encoded);
  assert.isTrue(S.toEquivalence(schema)(decoded, value));
};

describe("tool-name report determinism", () => {
  it("projects arbitrary candidates deterministically under the frozen cap and digest contract", () =>
    fc.assert(
      fc.property(ToolNameCandidateArbitrary, (candidate) => {
        expectRoundTrip(ToolNameCandidate, candidate);

        const first = projectToolNameCandidate(candidate);
        const second = projectToolNameCandidate(candidate);
        assert.deepEqual(second, first);
        if (Result.isFailure(first)) {
          return;
        }

        const row = Result.getOrThrow(first);
        expectRoundTrip(ToolNameCollisionRow, row);
        assert.isAtMost(Str.length(row.finalWireName), 64);
        if (row.truncated) {
          assert.strictEqual(Str.length(row.finalWireName), 64);
          assert.isTrue(P.isNotNull(row.digest));
        } else {
          assert.strictEqual(row.finalWireName, row.normalized);
          assert.isTrue(P.isNull(row.digest));
        }
      }),
      fcRuns(50)
    ));

  layer(NodeServices.layer)("with platform filesystem services", (it) => {
    it.effect(
      "renders identical temporary bytes matching the checked-in sorted artifact",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporaryDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "gov-legal-mcp-report-" });
        const firstPath = path.join(temporaryDirectory, "first.json");
        const secondPath = path.join(temporaryDirectory, "second.json");
        const checkedPath = path.join(
          import.meta.dirname,
          "..",
          "src",
          "_generated",
          "tool-name-collision-report.json"
        );
        const rendered = renderToolNameCollisionReport(ProductionToolNameCollisionReport);

        yield* fs.writeFileString(firstPath, rendered);
        yield* fs.writeFileString(secondPath, renderToolNameCollisionReport(ProductionToolNameCollisionReport));
        const first = yield* fs.readFile(firstPath);
        const second = yield* fs.readFile(secondPath);
        const checked = yield* fs.readFile(checkedPath);

        assert.deepEqual(first, second);
        assert.deepEqual(first, checked);
        assert.deepEqual(
          A.map(ProductionToolNameCollisionReport.candidates, (row) => row.finalWireName),
          ["ecfr_get_structure", "ecfr_list_titles", "ecfr_search_results", "govinfo_search"]
        );
        assert.isTrue(Str.startsWith('{\n  "candidates": [')(rendered));
        const rowKeyPositions = pipe(
          [
            "candidate",
            "digest",
            "duplicateVerdict",
            "finalWireName",
            "normalized",
            "originalOperationId",
            "source",
            "truncated",
          ],
          A.map((key) => pipe(rendered, Str.indexOf(`"${key}"`), O.getOrThrow))
        );
        assert.deepEqual(rowKeyPositions, A.sort(rowKeyPositions, Order.Number));
        assert.isFalse(Str.includes("timestamp")(rendered));
        assert.isFalse(Str.includes("\r")(rendered));
        assert.isTrue(Str.endsWith("\n")(rendered));
        assert.isFalse(Str.endsWith("\n\n")(rendered));
        yield* S.decodeEffect(S.fromJsonString(ToolNameCollisionReport))(rendered);
      })
    );
  });
});
