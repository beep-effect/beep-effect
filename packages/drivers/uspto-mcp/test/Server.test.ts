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

import { composeGatedLayers, gatedLayer, sanitizedToolkit } from "@beep/mcp-kit";
import { provideScopedLayer } from "@beep/test-utils";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import { UsptoSourceAuthRegistration, UsptoToolkit, UsptoToolkitHandlersLive } from "@beep/uspto-mcp";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import * as S from "effect/Schema";
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

describe("uspto-mcp fixture proofs", () => {
  it.effect("returns the api_key_required envelope when USPTO_API_KEY is absent", () =>
    Effect.gen(function* () {
      const result = yield* callSearch().pipe(provideScopedLayer(buildLayer({}, respondWith(applicationEnvelope))));

      assert.isFalse(result.isError);
      const decoded = yield* S.decodeUnknownEffect(S.fromJsonString(S.Struct({ error: S.String, envVar: S.String })))(
        textOf(result)
      );
      assert.strictEqual(decoded.error, "api_key_required");
      assert.strictEqual(decoded.envVar, "USPTO_API_KEY");
    })
  );

  it.effect("returns real @beep/uspto data when USPTO_API_KEY is present", () =>
    Effect.gen(function* () {
      const result = yield* callSearch().pipe(
        provideScopedLayer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(applicationEnvelope)))
      );

      assert.isFalse(result.isError);
      const ApplicationMetadataArray = S.Struct({
        applicationNumberText: S.String,
        inventionTitle: S.optionalKey(S.String),
      }).pipe(S.Array, S.fromJsonString);
      const decoded = yield* S.decodeUnknownEffect(ApplicationMetadataArray)(textOf(result));
      assert.strictEqual(decoded.length, 1);
      assert.strictEqual(decoded[0]?.applicationNumberText, "16138242");
      assert.strictEqual(decoded[0]?.inventionTitle, "Adjustable widget assembly");
    })
  );

  it.effect("reshapes a large documentBag response under a configured budget via a named field tier", () =>
    Effect.gen(function* () {
      const result = yield* callGetDocuments().pipe(
        provideScopedLayer(buildLayer({ USPTO_API_KEY: "fixture-secret" }, respondWith(largeDocumentsEnvelope)))
      );

      assert.isFalse(result.isError);
      const raw = textOf(result);

      // The complete-tier payload for 200 documents comfortably exceeds the
      // default 8000-byte budget; the response must have been reshaped down
      // to a smaller named tier rather than returned inline in full.
      const decoded = yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(raw);
      const projection = decoded as { readonly _tag: string; readonly tier?: string };

      assert.strictEqual(projection._tag, "Inline");
      assert.isTrue(projection.tier === "balanced" || projection.tier === "minimal", `tier was: ${projection.tier}`);
      assert.isAtMost(raw.length, 8000);
    })
  );
});
