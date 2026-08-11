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
import { PosInt } from "@beep/schema";
import { assertSchemaArbitraryDecodesToSelf, fcRuns, provideScopedLayer } from "@beep/test-utils";
import { Uspto, UsptoApplicationMetadata, UsptoConfigInput, UsptoDocumentReference } from "@beep/uspto";
import {
  DocumentsProjectionOutput,
  MintFetchableHandle,
  ProjectDocumentsWithinBudgetOptions,
  projectDocumentsWithinBudget,
  UsptoGetDocumentsParams,
  UsptoMcpFailure,
  UsptoMcpServerConfig,
  UsptoSearchApplicationsParams,
  UsptoSourceAuthRegistration,
  UsptoToolError,
  UsptoToolErrorReason,
  UsptoToolkit,
  UsptoToolkitHandlersLive,
  usptoDocumentFieldTiers,
} from "@beep/uspto-mcp";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Equal, Layer, Redacted } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

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

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: { readonly numRuns?: number }
): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeUnknownEffect(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Effect.runSync(encode(value));
      const decoded = Effect.runSync(decode(encoded));
      return Equal.equals(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 20)
  );
};

describe("uspto-mcp fixture proofs", () => {
  it.effect(
    "imports the bin module without launching the stdio server",
    Effect.fnUntraced(function* () {
      const bin = yield* Effect.promise(() => import("@beep/uspto-mcp/bin"));

      assert.strictEqual(bin.SERVER_CONFIG.name, "beep-uspto");
      assert.strictEqual(typeof bin.runUsptoMcpServer, "function");
    })
  );

  it.effect(
    "returns the api_key_required envelope when USPTO_API_KEY is absent",
    Effect.fnUntraced(function* () {
      const result = yield* callSearch().pipe(provideScopedLayer(buildLayer({}, respondWith(applicationEnvelope))));

      assert.isFalse(result.isError);
      const decoded = yield* S.decodeEffect(S.fromJsonString(S.Struct({ error: S.String, envVar: S.String })))(
        textOf(result)
      );
      assert.strictEqual(decoded.error, "api_key_required");
      assert.strictEqual(decoded.envVar, "USPTO_API_KEY");
    })
  );

  it.effect(
    "returns real @beep/uspto data when USPTO_API_KEY is present",
    Effect.fnUntraced(function* () {
      const result = yield* callSearch().pipe(
        provideScopedLayer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(applicationEnvelope)))
      );

      assert.isFalse(result.isError);
      const ApplicationMetadataArray = S.Struct({
        applicationNumberText: S.String,
        inventionTitle: S.optionalKey(S.String),
      }).pipe(S.Array, S.fromJsonString);
      const decoded = yield* S.decodeEffect(ApplicationMetadataArray)(textOf(result));
      assert.strictEqual(decoded.length, 1);
      assert.strictEqual(decoded[0]?.applicationNumberText, "16138242");
      assert.strictEqual(decoded[0]?.inventionTitle, "Adjustable widget assembly");
    })
  );

  it.effect(
    "reshapes a large documentBag response under a configured budget via a named field tier",
    Effect.fnUntraced(function* () {
      const result = yield* callGetDocuments().pipe(
        provideScopedLayer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(largeDocumentsEnvelope)))
      );

      assert.isFalse(result.isError);
      const raw = textOf(result);

      // The complete-tier payload for 200 documents comfortably exceeds the
      // default 8000-byte budget; the response must have been reshaped down
      // to a smaller named tier rather than returned inline in full.
      const projection = yield* S.decodeEffect(S.fromJsonString(DocumentsProjectionOutput))(raw);

      assert.strictEqual(projection._tag, "Inline");
      if (projection._tag === "Inline") {
        assert.isTrue(projection.tier === "balanced" || projection.tier === "minimal", `tier was: ${projection.tier}`);
      }
      assert.isAtMost(raw.length, 8000);
    })
  );
});

describe("uspto-mcp schema parity", () => {
  it.effect(
    "keeps explicit get-documents parameter wire shape and defaults missing budget in the schema",
    Effect.fnUntraced(function* () {
      const explicitWire = { applicationNumber: "16138242", budgetBytes: 8000 };
      const decoded = yield* S.decodeEffect(UsptoGetDocumentsParams)(explicitWire);
      const encoded = yield* S.encodeEffect(UsptoGetDocumentsParams)(decoded);
      const defaulted = yield* S.decodeEffect(UsptoGetDocumentsParams)({ applicationNumber: "16138242" });

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

      const failure = yield* S.decodeEffect(UsptoMcpFailure)(failureWire);
      const projection = yield* S.decodeEffect(DocumentsProjectionOutput)(projectionWire);

      assert.isTrue(UsptoMcpFailure.is(failure));
      assert.isTrue(DocumentsProjectionOutput.is(projection));
      assert.deepEqual(yield* S.encodeEffect(UsptoMcpFailure)(failure), failureWire);
      assert.deepEqual(yield* S.encodeEffect(DocumentsProjectionOutput)(projection), projectionWire);
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
  it("only generates UsptoApplicationMetadata values that round-trip through their schema", () => {
    assertSchemaArbitraryDecodesToSelf(UsptoApplicationMetadata);
    assertSchemaArbitraryRoundTrips(UsptoApplicationMetadata);
  });

  it("only generates DocumentsProjectionOutput values that round-trip through their schema", () => {
    assertSchemaArbitraryDecodesToSelf(DocumentsProjectionOutput);
    assertSchemaArbitraryRoundTrips(DocumentsProjectionOutput);
  });

  it("only generates package-owned tool schemas that round-trip through themselves", () => {
    assertSchemaArbitraryDecodesToSelf(UsptoToolErrorReason);
    assertSchemaArbitraryRoundTrips(UsptoToolErrorReason);
    assertSchemaArbitraryDecodesToSelf(UsptoToolError);
    assertSchemaArbitraryRoundTrips(UsptoToolError);
    assertSchemaArbitraryRoundTrips(UsptoMcpFailure);
    assertSchemaArbitraryDecodesToSelf(UsptoSearchApplicationsParams);
    assertSchemaArbitraryRoundTrips(UsptoSearchApplicationsParams);
    assertSchemaArbitraryDecodesToSelf(UsptoGetDocumentsParams);
    assertSchemaArbitraryRoundTrips(UsptoGetDocumentsParams);
    assertSchemaArbitraryDecodesToSelf(UsptoMcpServerConfig);
    assertSchemaArbitraryRoundTrips(UsptoMcpServerConfig);
  });
});
