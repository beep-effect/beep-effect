/**
 * Fixture proof: a `soft`-gated (key-optional) fixture tool stays registered
 * and returns the `api_key_required` envelope — `isError: false`, JSON
 * mirrored into `content[].text` — when its credential is absent.
 *
 * @since 0.0.0
 */
import {
  ApiKeyRequiredFailure,
  apiKeyRequiredFailure,
  resolveSourceCredential,
  SourceAuthRegistration,
} from "@beep/mcp-kit";
import { assert, describe, it, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Tool, Toolkit } from "effect/unstable/ai";
import * as McpServer from "effect/unstable/ai/McpServer";

const softRegistration = SourceAuthRegistration.make({
  name: "Soft Fixture Source",
  envVar: "MCP_KIT_TEST_SOFT_KEY",
  gate: "soft",
});

const SoftTool = Tool.make("soft_source_tool", {
  description: "Fixture soft-gated tool that degrades at call time.",
  failure: ApiKeyRequiredFailure,
  failureMode: "return",
  success: S.String,
});

const SoftToolkit = Toolkit.make(SoftTool);

const SoftToolkitHandlersLive = SoftToolkit.toLayer({
  soft_source_tool: Effect.fn("soft_source_tool")(function* () {
    const credential = yield* resolveSourceCredential(softRegistration).pipe(Effect.orDie);
    if (O.isNone(credential)) {
      return yield* Effect.fail(apiKeyRequiredFailure({ registration: softRegistration, tool: "soft_source_tool" }));
    }
    return "ok";
  }),
});

const softSourceLayer = McpServer.toolkit(SoftToolkit).pipe(Layer.provide(SoftToolkitHandlersLive));

// The credential read happens per tool call (inside the handler), not while
// this layer builds, so the fixture ConfigProvider can be a sibling: by the
// time an `it.effect` body calls `callTool`, the merged layer output
// (including the overridden `ConfigProvider`) is already its ambient context.
const buildLayer = (env: Record<string, string>) =>
  Layer.mergeAll(McpServer.McpServer.layer, softSourceLayer, ConfigProvider.layer(ConfigProvider.fromUnknown(env)));

const ApiKeyRequiredFailureFromJson = S.fromJsonString(ApiKeyRequiredFailure);
const StringFromJson = S.fromJsonString(S.String);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      assert.isTrue(equals(decode(encode(value)), value));
    }),
    { numRuns: 50 }
  );
};

describe("api_key_required envelope", () => {
  layer(buildLayer({}))("when the credential is absent", (it) => {
    it.effect("returns isError:false with the envelope mirrored into content[].text", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ arguments: {}, name: "soft_source_tool" });

        assert.isFalse(result.isError);
        assert.isAtLeast(result.content.length, 1);

        const [first] = result.content;
        assert.strictEqual(first?.type, "text");
        const envelope = yield* S.decodeUnknownEffect(ApiKeyRequiredFailureFromJson)(
          (first as { readonly text: string }).text
        );

        assert.strictEqual(envelope.error, "api_key_required");
        assert.strictEqual(envelope.tool, "soft_source_tool");
        assert.strictEqual(envelope.envVar, "MCP_KIT_TEST_SOFT_KEY");
      })
    );
  });

  layer(buildLayer({ MCP_KIT_TEST_SOFT_KEY: "fixture-secret" }))("when the credential is present", (it) => {
    it.effect("stays registered and succeeds normally", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ arguments: {}, name: "soft_source_tool" });

        assert.isFalse(result.isError);
        const [first] = result.content;
        assert.strictEqual(first?.type, "text");
        const decoded = yield* S.decodeUnknownEffect(StringFromJson)((first as { readonly text: string }).text);
        assert.strictEqual(decoded, "ok");
      })
    );
  });
});

describe("schema parity laws", () => {
  it("round-trips SourceAuthRegistration with schema-owned signupUrl defaults", () => {
    assert.deepStrictEqual(
      SourceAuthRegistration.make({ name: "No Signup", envVar: "NO_SIGNUP", gate: "none" }).signupUrl,
      O.none()
    );
    assertSchemaRoundTrip(SourceAuthRegistration);
  });

  it("round-trips ApiKeyRequiredFailure with the tag default owned by the schema", () => {
    assert.strictEqual(
      ApiKeyRequiredFailure.forTool({ registration: softRegistration, tool: "soft_source_tool" }).error,
      "api_key_required"
    );
    assertSchemaRoundTrip(ApiKeyRequiredFailure);
  });
});
