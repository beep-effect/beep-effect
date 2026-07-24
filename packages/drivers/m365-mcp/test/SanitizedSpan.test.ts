/**
 * Proof: `M365Toolkit`'s dispatch, mounted via `sanitizedToolkit` (the
 * `mcp-host-retrofit` fix for the `Toolkit.ts:263-265` raw-`parameters` span
 * leak, `standards/architecture/12-observability.md` §3), does not leak a
 * tool call's raw request payload onto span attributes, while the call still
 * dispatches through the real `M365Toolkit`/`M365ToolkitHandlersLive`
 * production code.
 *
 * @since 0.1.0
 */
import { GraphSite, M365, M365GetSiteRequest } from "@beep/m365";
import { M365Toolkit, M365ToolkitHandlersLive } from "@beep/m365-mcp";
import { sanitizedToolkit } from "@beep/mcp-kit";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as Tracer from "effect/Tracer";
import * as McpServer from "effect/unstable/ai/McpServer";

const site = GraphSite.make({ id: "contoso.sharepoint.com,secret-site-id,web", name: O.none() });

const notUsedInThisTest = Effect.fn("MockM365.notUsedInThisTest")(() => Effect.die(new Error("not used in this test")));

const MockM365Layer = Layer.succeed(
  M365,
  M365.of({
    deltaDriveItems: notUsedInThisTest,
    downloadDriveItemContent: notUsedInThisTest,
    getEvent: notUsedInThisTest,
    getListItem: notUsedInThisTest,
    getMessage: notUsedInThisTest,
    getSite: Effect.fn("MockM365.getSite")(function* () {
      return site;
    }),
    listDriveItemVersions: notUsedInThisTest,
    listDrives: notUsedInThisTest,
    listEvents: notUsedInThisTest,
    listMessages: notUsedInThisTest,
    listSites: notUsedInThisTest,
  })
);

interface RecordedAttribute {
  readonly key: string;
  readonly value: unknown;
}

const makeRecordingTracer = (): { readonly tracer: Tracer.Tracer; readonly captured: Array<RecordedAttribute> } => {
  const captured: Array<RecordedAttribute> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      const original = span.attribute.bind(span);
      span.attribute = (key: string, value: unknown) => {
        captured.push({ key, value });
        original(key, value);
      };
      return span;
    },
  });
  return { captured, tracer };
};

const registrationLayer = sanitizedToolkit(M365Toolkit).pipe(
  Layer.provide(M365ToolkitHandlersLive),
  Layer.provide(MockM365Layer)
);
const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, registrationLayer);

describe("m365-mcp sanitized dispatch", () => {
  layer(fullLayer)("with M365Toolkit mounted via sanitizedToolkit", (it) => {
    it.effect(
      "does not leak the raw m365_get_site request payload onto span attributes",
      Effect.fnUntraced(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const server = yield* McpServer.McpServer;

        const request = M365GetSiteRequest.make({ siteId: "contoso.sharepoint.com,secret-site-id,web" });
        const result = yield* Effect.withTracer(server.callTool({ name: "m365_get_site", arguments: request }), tracer);

        assert.isFalse(result.isError);

        const parameterAttribute = captured.find((entry) => entry.key === "parameters");
        assert.isUndefined(parameterAttribute);

        const toolAttribute = captured.find((entry) => entry.key === "tool");
        assert.strictEqual(toolAttribute?.value, "m365_get_site");
      })
    );
  });
});
