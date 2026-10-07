/**
 * Authentic provider event validation.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeLibraryJson } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";

const ProviderItems = S.Array(S.Unknown);

const $I = $RepoCliId.create("commands/Research/Library/Library.provenance");

/**
 * Authentic alphaXiv full-text response envelope.
 *
 * **Example** (Checking a provider receipt)
 * ```ts
 * import { AlphaFullText } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as S from "effect/Schema"
 * console.log(S.is(AlphaFullText)({provider: "alphaxiv"})) // false
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class AlphaFullText extends S.Class<AlphaFullText>($I`AlphaFullText`)(
  {
    provider: S.Literal("alphaxiv"),
    operation: S.Literal("get_paper_content"),
    arguments: S.Struct({ url: S.String, fullText: S.Literal(true) }),
    result: S.Struct({ content: S.Array(S.Struct({ type: S.Literal("text"), text: S.String })) }),
  },
  $I.annote("AlphaFullText", {
    description: "Original provider response from a fullText:true alphaXiv paper content invocation.",
  })
) {}
const SlashLaunch = S.Struct({
  direction: S.Literal("sent"),
  message: S.Struct({
    method: S.Literal("session/prompt"),
    params: S.Struct({ sessionId: S.String, prompt: S.Array(S.Struct({ type: S.Literal("text"), text: S.String })) }),
  }),
});
const Workflow = S.Struct({
  direction: S.Literal("received"),
  message: S.Struct({
    params: S.Struct({
      sessionId: S.String,
      update: S.Struct({
        sessionUpdate: S.Literal("workflow_updated"),
        run_id: S.String,
        name: S.Literal("deep-research"),
        status: S.String,
        phases: S.Array(S.Struct({ title: S.String, state: S.String })),
      }),
    }),
  }),
});
const AcpTool = S.Struct({
  direction: S.Literal("received"),
  message: S.Struct({
    params: S.Struct({
      sessionId: S.String,
      update: S.Struct({
        sessionUpdate: S.Literals(["tool_call", "tool_call_update"]),
        toolCallId: S.String,
        title: S.optionalKey(S.String),
        status: S.optionalKey(S.String),
        rawInput: S.optionalKey(S.Unknown),
        rawOutput: S.optionalKey(S.Unknown),
        content: S.optionalKey(S.Unknown),
      }),
    }),
  }),
});
const XInput = S.Union([
  S.Struct({ variant: S.Literal("XSearch"), backend: S.Literal(true) }),
  S.Struct({
    tool_name: S.Literals(["x_keyword_search", "x_semantic_search", "x_search", "XSearch"]),
    parameters: S.Unknown,
  }),
  S.Struct({
    name: S.Literals(["x_keyword_search", "x_semantic_search", "x_search", "XSearch"]),
    arguments: S.Unknown,
  }),
]);
const NamedCall = S.Struct({
  type: S.Literal("tool_use"),
  id: S.String,
  name: S.Literals(["x_search", "XSearch", "x_keyword_search", "x_semantic_search"]),
  input: S.Unknown,
});
const NamedResult = S.Struct({ type: S.Literal("tool_result"), tool_use_id: S.String, content: S.Unknown });

/**
 * Read JSON or NDJSON originals without inventing normalized tool envelopes.
 * **Example** (Preserve native provider event envelopes)
 * ```ts
 * import { decodeProviderEvents } from "@beep/repo-cli/test/ResearchLibrary"
 * import { Effect, Match } from "effect"
 * console.log(Effect.runSync(decodeProviderEvents('{"type":"tool_use","id":"call-1"}')).length) // 1
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const decodeProviderEvents = Effect.fn("Library.decodeProviderEvents")(function* (text: string) {
  const whole = yield* decodeLibraryJson(S.Unknown)(text).pipe(Effect.option);
  if (O.isSome(whole)) {
    const array = S.decodeUnknownOption(ProviderItems)(whole.value);
    return O.isSome(array) ? array.value : [whole.value];
  }
  return yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), decodeLibraryJson(S.Unknown), {
    concurrency: 1,
  });
});

const alphaQualificationValid = (events: ReadonlyArray<unknown>) => {
  const evidence = A.head(A.getSomes(A.map(events, (event) => S.decodeUnknownOption(AlphaFullText)(event))));
  if (O.isSome(evidence)) {
    const decoded = evidence.value;
    if (A.some(decoded.result.content, (block) => Str.length(Str.trim(block.text)) > 1000)) return true;
  }

  return false;
};

const grokWorkflowQualificationValid = (events: ReadonlyArray<unknown>) => {
  const launches = A.getSomes(A.map(events, (input) => S.decodeUnknownOption(SlashLaunch)(input)));
  const workflows = A.getSomes(A.map(events, (input) => S.decodeUnknownOption(Workflow)(input)));
  const complete = A.findFirst(
    workflows,
    (event) =>
      A.contains(["complete", "completed"], event.message.params.update.status) &&
      A.every(["Plan", "Research", "Verify", "Report"], (phase) =>
        A.some(event.message.params.update.phases, (item) => item.title === phase && item.state === "done")
      )
  );
  if (
    O.isSome(complete) &&
    A.some(
      launches,
      (event) =>
        event.message.params.sessionId === complete.value.message.params.sessionId &&
        A.some(event.message.params.prompt, (block) => Str.startsWith("/deep-research ")(block.text))
    )
  )
    return true;

  return false;
};

const grokXQualificationValid = (events: ReadonlyArray<unknown>) => {
  const calls = A.getSomes(A.map(events, (input) => S.decodeUnknownOption(NamedCall)(input)));
  const results = A.getSomes(A.map(events, (input) => S.decodeUnknownOption(NamedResult)(input)));
  if (A.some(calls, (call) => A.some(results, (result) => result.tool_use_id === call.id))) return true;
  const updates = A.getSomes(A.map(events, (input) => S.decodeUnknownOption(AcpTool)(input)));
  const called = A.filter(updates, (event) => {
    const update = event.message.params.update;
    return (
      S.is(XInput)(update.rawInput) ||
      (update.title !== undefined &&
        A.contains(["x_keyword_search", "x_semantic_search", "x_search", "XSearch"], update.title))
    );
  });
  if (
    A.some(called, (call) =>
      A.some(
        updates,
        (result) =>
          result.message.params.sessionId === call.message.params.sessionId &&
          result.message.params.update.toolCallId === call.message.params.update.toolCallId &&
          result.message.params.update.status === "completed" &&
          (result.message.params.update.rawOutput !== undefined || result.message.params.update.content !== undefined)
      )
    )
  )
    return true;

  return false;
};

/**
 * Check real workflow, X search, or alphaXiv events independently of installation status.
 * **Example** (Reject installation-only evidence)
 * ```ts
 * import { validateProviderQualification } from "@beep/repo-cli/test/ResearchLibrary"
 * import { Effect, Match } from "effect"
 * console.log(Effect.runSync(validateProviderQualification("alphaxiv", []))) // false
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateProviderQualification = Effect.fn("Library.validateProviderQualification")(function* (
  adapter: string,
  events: ReadonlyArray<unknown>
) {
  const valid = Match.value(adapter).pipe(
    Match.when("alphaxiv", () => alphaQualificationValid(events)),
    Match.when("grok-deep-research", () => grokWorkflowQualificationValid(events)),
    Match.when("grok-x-import", () => grokXQualificationValid(events)),
    Match.orElse(() => false)
  );
  if (valid) return true;
  return yield* LibraryError.make({
    message: `Raw evidence does not prove operational qualification: ${adapter}.`,
    cause: "provenance",
  });
});
