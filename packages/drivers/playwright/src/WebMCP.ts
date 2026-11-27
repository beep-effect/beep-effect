/**
 * Effect service wrapper for tools registered through the WebMCP browser API.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { WebMCP as CoreWebMCP } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("WebMCP");

/**
 * Hints a page provides about a WebMCP tool.
 *
 * @category models
 * @since 0.0.0
 */
export interface WebMCPToolAnnotations {
  /**
   * The tool takes a consequential action, such as placing an order.
   */
  readonly consequential?: boolean;
  /**
   * The tool does not modify any state.
   */
  readonly readOnly?: boolean;
  /**
   * The tool output may contain third-party content.
   */
  readonly untrustedContent?: boolean;
}

/**
 * A tool registered by a frame through the WebMCP browser API.
 *
 * @see {@link CoreWebMCP.tools} for the Playwright method that lists them.
 * @category models
 * @since 0.0.0
 */
export interface WebMCPTool {
  /**
   * Hints the page provides about the tool.
   */
  readonly annotations?: WebMCPToolAnnotations;
  /**
   * Tool description.
   */
  readonly description: string;
  /**
   * JSON Schema of the tool input, when the page provides one.
   */
  readonly inputSchema?: unknown;
  /**
   * Tool name, unique within the frame.
   */
  readonly name: string;
}

/**
 * Tools that a frame registers through the experimental
 * [WebMCP](https://webmachinelearning.github.io/webmcp/) browser API.
 *
 * @see {@link CoreWebMCP} for the wrapped Playwright interface.
 * @category models
 * @since 0.0.0
 */
export interface WebMCPShape {
  /**
   * Calls a tool registered by the frame and returns its result. The result is whatever the tool's `execute`
   * function resolved to. A result with `isError: true` succeeds as is; the effect fails when the tool is not
   * registered or its `execute` function throws.
   *
   * @see {@link CoreWebMCP.callTool} for the wrapped Playwright method.
   */
  readonly callTool: (
    name: string,
    input?: unknown,
    options?: Parameters<CoreWebMCP["callTool"]>[2]
  ) => Effect.Effect<unknown, PlaywrightError>;
  /**
   * Returns the tools currently registered by the frame. Fails if the browser was launched without WebMCP support.
   *
   * @see {@link CoreWebMCP.tools} for the wrapped Playwright method.
   */
  readonly tools: (
    options?: Parameters<CoreWebMCP["tools"]>[0]
  ) => Effect.Effect<ReadonlyArray<WebMCPTool>, PlaywrightError>;
}

/**
 * Service for a {@link WebMCPShape}.
 *
 * **Gotchas**
 *
 * WebMCP must be enabled when the browser launches. In Chromium, pass
 * `--enable-features=WebMCP`; WebKit does not support it. A page's `webmcp`
 * only covers the main frame, so child frames list their tools through their
 * own frame's `webmcp`.
 *
 * **Example** (List and call a page tool)
 *
 * ```ts
 * import { WebMCP } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const added = Effect.gen(function* () {
 *   const webmcp = yield* WebMCP
 *   const tools = yield* webmcp.tools()
 *   const result = yield* webmcp.callTool("add", { a: 2, b: 40 })
 *   return { tools, result }
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WebMCP extends Context.Service<WebMCP, WebMCPShape>()($I`WebMCP`) {}

/**
 * Creates `WebMCP` from a Playwright `WebMCP` instance.
 *
 * **Example** (Wrap a page's WebMCP tools)
 *
 * ```ts
 * import { makeWebMCP } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const pageTools = (page: Page) => makeWebMCP(page.webmcp).tools()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeWebMCP = (webmcp: CoreWebMCP): WebMCPShape => {
  const use = useHelper(webmcp);

  return WebMCP.of({
    callTool: Effect.fn("WebMCP.callTool")((name, input, options) => use((w) => w.callTool(name, input, options))),
    tools: Effect.fn("WebMCP.tools")((options) => use((w) => w.tools(options))),
  });
};
