/**
 * Shared fixture host for the kit's own client, caller and conformance tests:
 * a small toolkit registered through `sanitizedToolkit`, one titled prompt,
 * and the descriptor the conformance runner consumes.
 *
 * @since 0.0.0
 */
import {
  ApiKeyRequiredFailure,
  apiKeyRequiredFailure,
  CurrentMcpCaller,
  CurrentMcpDispatchAnchor,
  resolveSourceCredential,
  SourceAuthRegistration,
  sanitizedToolkit,
} from "@beep/mcp-kit";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import * as McpServer from "effect/unstable/ai/McpServer";
import type { ConformanceHost } from "@beep/mcp-kit/test/Conformance";

export const softRegistration = SourceAuthRegistration.make({
  name: "Soft Fixture Source",
  envVar: "MCP_KIT_TEST_SOFT_KEY",
  gate: "soft",
});

export const EchoTool = Tool.make("echo", {
  description: "Echo the given text back.",
  parameters: S.Struct({ text: S.String }),
  success: S.Struct({ echoed: S.String }),
}).annotate(Tool.Title, "Echo");

export const CallerReportTool = Tool.make("caller_report", {
  description: "Report the caller identity the dispatch provided.",
  success: S.String,
});

export const AnchorReportTool = Tool.make("anchor_report", {
  description: "Report the dispatch anchor the dispatch provided.",
  success: S.String,
});

export const SoftSourceTool = Tool.make("soft_source_tool", {
  description: "Fixture soft-gated tool that degrades at call time.",
  failure: ApiKeyRequiredFailure,
  failureMode: "return",
  success: S.String,
});

export const FixtureToolkit = Toolkit.make(EchoTool, CallerReportTool, AnchorReportTool, SoftSourceTool);

export const FixtureHandlersLive = FixtureToolkit.toLayer({
  echo: (params: { readonly text: string }) => Effect.succeed({ echoed: params.text }),
  caller_report: Effect.fn("FixtureHost.callerReport")(function* () {
    const caller = yield* CurrentMcpCaller;
    return O.match(caller, {
      onNone: () => "caller=none",
      onSome: (identity) => `client=${identity.clientId};session=${O.getOrElse(identity.sessionId, () => "none")}`,
    });
  }),
  anchor_report: Effect.fn("FixtureHost.anchorReport")(function* () {
    const anchor = yield* CurrentMcpDispatchAnchor;
    return O.getOrElse(anchor, () => "anchor=none");
  }),
  soft_source_tool: Effect.fn("FixtureHost.softSourceTool")(function* () {
    const credential = yield* resolveSourceCredential(softRegistration).pipe(Effect.orDie);
    if (O.isNone(credential)) {
      return yield* Effect.fail(apiKeyRequiredFailure({ registration: softRegistration, tool: "soft_source_tool" }));
    }
    return "ok";
  }),
});

export const FIXTURE_PROMPT_NAME = "fixture_prompt";
export const FIXTURE_PROMPT_TITLE = "Fixture Prompt";
export const FIXTURE_INSTRUCTIONS = "Fixture host for the kit conformance port.";

export const FixturePromptLive = McpServer.prompt({
  name: FIXTURE_PROMPT_NAME,
  title: FIXTURE_PROMPT_TITLE,
  description: "A prompt with a title, for the discovery arms.",
  content: () => Effect.succeed("Say hello."),
});

/**
 * Registrations only: toolkit plus prompt. Compose with a transport layer
 * (`McpServer.layerHttp` / `layerStdio`) or with `McpServer.McpServer.layer`.
 */
export const FixtureRegistrationsLive: Layer.Layer<never> = Layer.merge(
  sanitizedToolkit(FixtureToolkit).pipe(Layer.provide(FixtureHandlersLive)),
  FixturePromptLive
);

export const fixtureHost: ConformanceHost<never> = {
  name: "mcp-kit-fixture",
  version: "0.0.0",
  instructions: FIXTURE_INSTRUCTIONS,
  registrations: FixtureRegistrationsLive,
  tool: { name: "echo", arguments: { text: "hi" }, invalidArguments: { text: 1 } },
  prompt: { name: FIXTURE_PROMPT_NAME, title: FIXTURE_PROMPT_TITLE },
};
