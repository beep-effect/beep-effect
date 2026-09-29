/**
 * Fixture proofs for the USPTO MCP proving host, mirroring
 * `packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts`'s
 * ConfigProvider-fixture shape for the credential gate and
 * `packages/drivers/uspto/test/Uspto.service.test.ts`'s fixture-mocked
 * `HttpClient` shape for the real-data path. No real network call and no
 * real `USPTO_API_KEY` are ever used.
 *
 * @since 0.0.0
 */

import { composeGatedLayers, FetchableHandle, gatedLayer, sanitizedToolkit } from "@beep/mcp-kit";
import { conformance2026, connectHttp, layerConformanceHttp } from "@beep/mcp-kit/test/Conformance";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Uspto, UsptoApplicationMetadata, UsptoConfigInput, UsptoDocumentReference } from "@beep/uspto";
import {
  DocumentsProjectionOutput,
  MintFetchableHandle,
  ProjectDocumentsWithinBudgetOptions,
  projectDocumentsWithinBudget,
  USPTO_MCP_INSTRUCTIONS,
  UsptoGetDocumentsParams,
  UsptoMcpFailure,
  UsptoMcpRegistrationsLive,
  UsptoMcpServerConfig,
  UsptoSearchApplicationsParams,
  UsptoSourceAuthRegistration,
  UsptoToolError,
  UsptoToolErrorReason,
  UsptoToolkit,
  UsptoToolkitHandlersLive,
  usptoDocumentFieldTiers,
} from "@beep/uspto-mcp";
import { assert, describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, Effect, Equal, Layer, Redacted } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import { McpServerClient } from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const PosInt = S.Int.check(S.isGreaterThan(0));

const encodeUnknownJson = S.encodeEffect(UnknownFromJsonString);
const decodeDocumentsProjectionOutput = S.decodeEffect(DocumentsProjectionOutput);
const decodeDocumentsProjectionOutputJson = S.decodeEffect(S.fromJsonString(DocumentsProjectionOutput));
const decodeStructInlineSchemaJson = S.decodeEffect(S.fromJsonString(S.Struct({ error: S.String, envVar: S.String })));
const decodeUsptoGetDocumentsParams = S.decodeEffect(UsptoGetDocumentsParams);
const decodeUsptoMcpFailure = S.decodeEffect(UsptoMcpFailure);
const encodeDocumentsProjectionOutput = S.encodeEffect(DocumentsProjectionOutput);
const encodeUsptoGetDocumentsParams = S.encodeEffect(UsptoGetDocumentsParams);
const encodeUsptoMcpFailure = S.encodeEffect(UsptoMcpFailure);
const ApplicationMetadataArray = S.Struct({
  applicationNumberText: S.String,
  inventionTitle: S.optionalKey(S.String),
}).pipe(S.Array, S.fromJsonString);
const decodeApplicationMetadataArray = S.decodeEffect(ApplicationMetadataArray);

const applicationEnvelope = JSON.stringify({
  count: 1,
  patentFileWrapperDataBag: [
    {
      applicationMetaData: {
        applicationStatusDescriptionText: "Patented Case",
        filingDate: "2018-09-21",
        firstApplicantName: "Precision Widgets LLC",
        firstInventorName: "Ada Lovelace",
        grantDate: "2020-09-15",
        inventionTitle: "Adjustable widget assembly",
        patentNumber: "10772255",
      },
      applicationNumberText: "16138242",
    },
  ],
});

const LARGE_DOCUMENT_COUNT = 200;

const largeDocumentsEnvelope = JSON.stringify({
  documentBag: Array.from({ length: LARGE_DOCUMENT_COUNT }, (_unused, index) => ({
    documentCode: `CODE-${index}`,
    documentCodeDescriptionText:
      "A verbose, human-readable description of this file-wrapper document, repeated to simulate realistic USPTO ODP payload sizes for the field-tier reshaping proof.",
    documentIdentifier: `DOC-${index}`,
    downloadOptionBag: [{ downloadUrl: `https://api.uspto.gov/docs/DOC-${index}.pdf`, mimeTypeIdentifier: "PDF" }],
    officialDate: "2018-09-21",
  })),
});

const respondWith = (body: string): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, new Response(body, { headers: { "content-type": "application/json" } }))
      )
    )
  );

const testUsptoLayer = (http: Layer.Layer<HttpClient.HttpClient>): Layer.Layer<Uspto> =>
  Uspto.makeLayer(UsptoConfigInput.make({ apiKey: Redacted.make("test-key") })).pipe(Layer.provide(http));

// `McpServer.McpServer.layer` is typed as providing `McpServerClient` but only
// builds `McpServer`, so a direct `callTool` — one with no transport middleware
// in front of it — has to supply the caller itself.
const stubClientInfo = { name: "uspto-mcp-test-client", version: "0.0.0" };

const StubMcpClientLayer = Layer.succeed(
  McpServerClient,
  McpServerClient.of({
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

const buildLayer = (env: Record<string, string>, http: Layer.Layer<HttpClient.HttpClient>) => {
  const usptoToolkitLayer = sanitizedToolkit(UsptoToolkit).pipe(
    Layer.provide(UsptoToolkitHandlersLive),
    Layer.provide(testUsptoLayer(http))
  );

  // The soft gate always mounts regardless of the credential's presence, so
  // (per ApiKeyRequired.test.ts's own note) the fixture ConfigProvider can be
  // a sibling: the credential is re-read per call, inside the handler, not
  // while this layer builds.
  return Layer.mergeAll(
    McpServer.McpServer.layer,
    StubMcpClientLayer,
    composeGatedLayers(gatedLayer(UsptoSourceAuthRegistration, usptoToolkitLayer)),
    ConfigProvider.layer(ConfigProvider.fromUnknown(env))
  );
};

const callSearch = Effect.fn("callSearch")(function* () {
  const server = yield* McpServer.McpServer;
  return yield* server.callTool({ name: "uspto_search_applications", arguments: { query: "widget" } });
});

const callGetDocuments = Effect.fn("callGetDocuments")(function* () {
  const server = yield* McpServer.McpServer;
  return yield* server.callTool({
    name: "uspto_get_documents",
    arguments: { applicationNumber: "16138242" },
  });
});

const textOf = (result: {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
}): string => {
  const [first] = result.content;
  assert.strictEqual(first?.type, "text");
  assert.isString(first?.text);
  return first?.text as string;
};

const schemaRoundTrips = Effect.fnUntraced(function* <Schema extends S.Codec<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  return Equal.equals(decoded, value);
});

const schemaDecodesToSelf = Effect.fnUntraced(function* <Schema extends S.Codec<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const decoded = yield* S.decodeUnknownEffect(schema)(value);
  return S.is(schema)(value) && S.toEquivalence(schema)(decoded, value);
});

describe("uspto-mcp fixture proofs", () => {
  it.effect(
    "imports the bin module without launching the stdio server",
    Effect.fnUntraced(function* () {
      const bin = yield* Effect.promise(() => import("@beep/uspto-mcp/bin"));

      assert.strictEqual(bin.SERVER_CONFIG.name, "beep-uspto");
      assert.strictEqual(typeof bin.runUsptoMcpServer, "function");
    })
  );

  it.layer(buildLayer({}, respondWith(applicationEnvelope)), { timeout: "10 seconds" })("credential absent", (it) => {
    it.effect(
      "returns the api_key_required envelope when USPTO_API_KEY is absent",
      Effect.fnUntraced(function* () {
        const result = yield* callSearch();

        assert.isFalse(result.isError);
        const decoded = yield* decodeStructInlineSchemaJson(textOf(result));
        assert.strictEqual(decoded.error, "api_key_required");
        assert.strictEqual(decoded.envVar, "USPTO_API_KEY");
      })
    );
  });

  it.layer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(applicationEnvelope)), {
    timeout: "10 seconds",
  })("credential present", (it) => {
    it.effect(
      "returns real @beep/uspto data when USPTO_API_KEY is present",
      Effect.fnUntraced(function* () {
        const result = yield* callSearch();

        assert.isFalse(result.isError);
        const decoded = yield* decodeApplicationMetadataArray(textOf(result));
        assert.strictEqual(decoded.length, 1);
        assert.strictEqual(decoded[0]?.applicationNumberText, "16138242");
        assert.strictEqual(decoded[0]?.inventionTitle, "Adjustable widget assembly");
      })
    );
  });

  it.layer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(largeDocumentsEnvelope)), {
    timeout: "10 seconds",
  })("document budget", (it) => {
    it.effect(
      "reshapes a large documentBag response under a configured budget via a named field tier",
      Effect.fnUntraced(function* () {
        const result = yield* callGetDocuments();

        assert.isFalse(result.isError);
        const raw = textOf(result);

        // The complete-tier payload for 200 documents comfortably exceeds the
        // default 8000-byte budget; the response must have been reshaped down
        // to a smaller named tier rather than returned inline in full.
        const projection = yield* decodeDocumentsProjectionOutputJson(raw);

        assert.strictEqual(projection._tag, "Inline");
        if (projection._tag === "Inline") {
          assert.isTrue(
            projection.tier === "balanced" || projection.tier === "minimal",
            `tier was: ${projection.tier}`
          );
        }
        assert.isAtMost(raw.length, 8000);
      })
    );
  });
});

describe("uspto-mcp UTF-8 response budgets", () => {
  // These replacements affect only document identifiers, preserving the 200-row
  // fixture and its document metadata/download URLs.
  for (const { label, identifierPrefix, expected } of [
    { label: "multibyte identifiers", identifierPrefix: "文档-", expected: "Inline" },
    { label: "oversized multibyte identifiers", identifierPrefix: Str.repeat(20)("界") + "-", expected: "Fetchable" },
  ]) {
    const body = Str.replaceAll('"DOC-', '"' + identifierPrefix)(largeDocumentsEnvelope);
    it.layer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(body)), { timeout: "10 seconds" })(
      label,
      (it) =>
        it.effect(
          "honors the 8000-byte budget for 200 documents",
          Effect.fnUntraced(function* () {
            const result = yield* callGetDocuments();
            assert.isFalse(result.isError);
            const raw = textOf(result);
            const projection = yield* decodeDocumentsProjectionOutputJson(raw);
            assert.strictEqual(projection._tag, expected);
            assert.isAtMost(new TextEncoder().encode(raw).byteLength, 8000);
            if (projection._tag === "Inline") {
              assert.strictEqual(projection.envelope.rows.length, LARGE_DOCUMENT_COUNT);
              assert.isTrue(projection.tier === "balanced" || projection.tier === "minimal");
            } else {
              assert.isAbove(projection.handle.sizeBytes, 8000);
              assert.strictEqual(projection.handle.tier, "minimal");
            }
          })
        )
    );
  }

  it.effect(
    "includes the Inline wrapper at the exact ASCII budget boundary",
    Effect.fnUntraced(function* () {
      const documents = [UsptoDocumentReference.make({ documentIdentifier: "DOC-1" })];
      const expected: (typeof DocumentsProjectionOutput)["Encoded"] = {
        _tag: "Inline",
        tier: "minimal",
        envelope: { columns: ["documentIdentifier"], rows: [["DOC-1"]] },
      };
      const wire = yield* encodeUnknownJson(expected);
      const exactBytes = new TextEncoder().encode(wire).byteLength;
      const options = (budgetBytes: number) =>
        ProjectDocumentsWithinBudgetOptions.make({
          budgetBytes: PosInt.make(budgetBytes),
          mintFetchableHandle: MintFetchableHandle.implementSync((oversized) =>
            FetchableHandle.make({
              handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
              expiresAt: "2026-07-01T01:00:00.000Z",
              sizeBytes: oversized.sizeBytes,
              tier: "minimal",
            })
          ),
        });
      const exact = projectDocumentsWithinBudget(documents, options(exactBytes));
      assert.deepEqual(yield* encodeDocumentsProjectionOutput(exact), expected);
      const tooSmall = projectDocumentsWithinBudget(documents, options(exactBytes - 1));
      assert.strictEqual(tooSmall._tag, "Fetchable");
      if (tooSmall._tag === "Fetchable") assert.strictEqual(tooSmall.handle.sizeBytes, exactBytes);
    })
  );
});

describe("uspto-mcp schema parity", () => {
  it.effect(
    "keeps explicit get-documents parameter wire shape and defaults missing budget in the schema",
    Effect.fnUntraced(function* () {
      const explicitWire = { applicationNumber: "16138242", budgetBytes: 8000 };
      const decoded = yield* decodeUsptoGetDocumentsParams(explicitWire);
      const encoded = yield* encodeUsptoGetDocumentsParams(decoded);
      const defaulted = yield* decodeUsptoGetDocumentsParams({ applicationNumber: "16138242" });

      assert.deepEqual(encoded, explicitWire);
      assert.strictEqual(defaulted.budgetBytes, 8000);
    })
  );

  it.effect(
    "keeps failure and projection encoded shapes byte-identical",
    Effect.fnUntraced(function* () {
      const failureWire = {
        message: "USPTO get documents failed: transport",
        reason: UsptoToolErrorReason.Enum.transport,
        tool: "uspto_get_documents",
      };
      const projectionWire = {
        _tag: "Inline" as const,
        tier: "minimal" as const,
        envelope: { columns: ["documentIdentifier"], rows: [["DOC-1"]] },
      };

      const failure = yield* decodeUsptoMcpFailure(failureWire);
      const projection = yield* decodeDocumentsProjectionOutput(projectionWire);

      assert.isTrue(UsptoMcpFailure.is(failure));
      assert.isTrue(DocumentsProjectionOutput.is(projection));
      assert.deepEqual(yield* encodeUsptoMcpFailure(failure), failureWire);
      assert.deepEqual(yield* encodeDocumentsProjectionOutput(projection), projectionWire);
    })
  );

  it("keeps the USPTO document tier field sets stable", () => {
    assert.deepEqual(Object.keys(usptoDocumentFieldTiers.minimal.fields), ["documentIdentifier"]);
    assert.deepEqual(Object.keys(usptoDocumentFieldTiers.balanced.fields), [
      "documentCode",
      "documentIdentifier",
      "officialDate",
    ]);
    assert.deepEqual(Object.keys(usptoDocumentFieldTiers.complete.fields), [
      "documentCode",
      "documentCodeDescriptionText",
      "documentIdentifier",
      "downloadUrl",
      "officialDate",
    ]);
  });

  it("supports data-last document projection without changing the two-argument form", () => {
    const documents = [UsptoDocumentReference.make({ documentIdentifier: "DOC-1" })];
    const options = ProjectDocumentsWithinBudgetOptions.make({
      budgetBytes: PosInt.make(10_000),
      mintFetchableHandle: MintFetchableHandle.implementSync((oversized) =>
        FetchableHandle.make({
          handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
          expiresAt: "2026-07-01T01:00:00.000Z",
          sizeBytes: oversized.sizeBytes,
          tier: "minimal",
        })
      ),
    });

    assert.strictEqual(projectDocumentsWithinBudget(documents, options)._tag, "Inline");
    assert.strictEqual(projectDocumentsWithinBudget(options)(documents)._tag, "Inline");
  });
});

describe("uspto-mcp schema-derived arbitraries", () => {
  it.effect.prop(
    "only generates UsptoApplicationMetadata values that round-trip through their schema",
    [Arbitrary.schema(UsptoApplicationMetadata)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoApplicationMetadata, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoApplicationMetadata arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoApplicationMetadata)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoApplicationMetadata, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "only generates DocumentsProjectionOutput values that round-trip through their schema",
    [Arbitrary.schema(DocumentsProjectionOutput)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(DocumentsProjectionOutput, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "DocumentsProjectionOutput arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(DocumentsProjectionOutput)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(DocumentsProjectionOutput, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "only generates package-owned tool schemas that round-trip through themselves",
    [Arbitrary.schema(UsptoToolErrorReason)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoToolErrorReason, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoToolErrorReason arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoToolErrorReason)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoToolErrorReason, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "UsptoToolError arbitrary values decode to themselves",
    [Arbitrary.schema(UsptoToolError)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoToolError, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoToolError arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoToolError)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoToolError, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "UsptoMcpFailure arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoMcpFailure)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoMcpFailure, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "UsptoSearchApplicationsParams arbitrary values decode to themselves",
    [Arbitrary.schema(UsptoSearchApplicationsParams)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoSearchApplicationsParams, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoSearchApplicationsParams arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoSearchApplicationsParams)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoSearchApplicationsParams, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "UsptoGetDocumentsParams arbitrary values decode to themselves",
    [Arbitrary.schema(UsptoGetDocumentsParams)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoGetDocumentsParams, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoGetDocumentsParams arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoGetDocumentsParams)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoGetDocumentsParams, value));
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "UsptoMcpServerConfig arbitrary values decode to themselves",
    [Arbitrary.schema(UsptoMcpServerConfig)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaDecodesToSelf(UsptoMcpServerConfig, value));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "UsptoMcpServerConfig arbitrary values retain exact Equal round-trip",
    [Arbitrary.schema(UsptoMcpServerConfig)],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(yield* schemaRoundTrips(UsptoMcpServerConfig, value));
      }),
    { arbitrary: fcRuns(20) }
  );
});

// The host as the kit conformance runner sees it: registrations only, with
// the fixture `Uspto` client and a resolvable USPTO_API_KEY so the soft gate
// answers with real data rather than the `api_key_required` envelope.
const usptoConformanceHost = {
  name: "beep-uspto-test",
  version: "0.0.0",
  instructions: USPTO_MCP_INSTRUCTIONS,
  registrations: UsptoMcpRegistrationsLive.pipe(
    Layer.provide(testUsptoLayer(respondWith(applicationEnvelope))),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ USPTO_API_KEY: "fixture-secret" })))
  ),
  tool: {
    name: "uspto_search_applications",
    arguments: { query: "widget" },
    invalidArguments: { query: "" },
  },
};

conformance2026(usptoConformanceHost);

describe("uspto-mcp through the kit client", () => {
  it.layer(layerConformanceHttp(usptoConformanceHost), { timeout: "10 seconds" })("over streamable HTTP", (it) => {
    it.effect("carries an array success in text content and emits no structuredContent", () =>
      Effect.gen(function* () {
        // `uspto_search_applications` succeeds with an array. The 2026-07-28
        // `structuredContent` field is an object by contract, so the kit's
        // projection withholds it for non-object results and the array rides
        // in the text content, where the kit client decodes it back verbatim.
        const { discovery, rpc } = yield* connectHttp();
        assert.strictEqual(discovery.instructions, USPTO_MCP_INSTRUCTIONS);
        const result = yield* rpc["tools/call"]({ name: "uspto_search_applications", arguments: { query: "widget" } });
        assert.notStrictEqual(result.isError, true);
        assert.isUndefined(result.structuredContent);
        const applications = yield* decodeApplicationMetadataArray(textOf(result));
        assert.strictEqual(applications.length, 1);
        assert.strictEqual(applications[0]?.applicationNumberText, "16138242");
        assert.strictEqual(applications[0]?.inventionTitle, "Adjustable widget assembly");
      })
    );
  });
});
