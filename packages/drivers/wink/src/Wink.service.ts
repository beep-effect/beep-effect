/**
 * Wink runtime engine service.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { createRequire } from "node:module";
import { $WinkId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Clock, Context, Effect, Layer, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { WinkEngineError, WinkEntityError, WinkTokenizationError } from "./Wink.errors.ts";
import { WinkEngineCustomEntities } from "./Wink.models.ts";
import { observeWinkWorkflow, textLengthAttribute } from "./WinkObservability.ts";
import type { AsHelpers, ItemToken, ItsHelpers, Model, Document as WinkDocument, WinkMethods } from "wink-nlp";

const $I = $WinkId.create("Wink/WinkEngine");
const require = createRequire(import.meta.url);

type WinkEngineShape = {
  readonly as: Effect.Effect<AsHelpers, WinkEngineError>;
  readonly getRef: Effect.Effect<Ref.Ref<WinkEngineRuntimeState>>;
  readonly getWinkTokens: (text: string) => Effect.Effect<ReadonlyArray<ItemToken>, WinkTokenizationError>;
  readonly getWinkDoc: (text: string) => Effect.Effect<WinkDocument, WinkTokenizationError>;
  readonly getWinkTokenCount: (text: string) => Effect.Effect<number, WinkTokenizationError>;
  readonly getCurrentCustomEntities: Effect.Effect<O.Option<WinkEngineCustomEntities>>;
  readonly its: Effect.Effect<ItsHelpers, WinkEngineError>;
  readonly learnCustomEntities: (customEntities: WinkEngineCustomEntities) => Effect.Effect<void, WinkEntityError>;
};

type WinkCustomEntityRecord = {
  readonly mark?: readonly [number, number] | undefined;
  readonly name: string;
  readonly patterns: Array<string>;
};

/**
 * Branded runtime identifier for one initialized wink engine instance.
 *
 * **Example** (Create branded instance id)
 *
 * ```ts
 * import { InstanceId } from "@beep/wink"
 *
 * const instanceId = InstanceId.fromUnknown("wink-engine-example-1")
 * console.log(instanceId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InstanceId = S.NonEmptyString.pipe(
  S.brand("InstanceId"),
  $I.annoteSchema("InstanceId", {
    description: "Stable identifier for one live wink engine instance.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link InstanceId} schema.
 *
 * **Example** (Type annotated instance id)
 *
 * ```ts
 * import { InstanceId } from "@beep/wink"
 * import type { InstanceId as InstanceIdType } from "@beep/wink"
 *
 * const instanceId: InstanceIdType = InstanceId.make("wink-engine-example-2")
 * console.log(instanceId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InstanceId = typeof InstanceId.Type;

/**
 * Serializable metadata for the current wink runtime and learned entity set.
 *
 * **Example** (Build serializable engine state)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { InstanceId, WinkEngineState } from "@beep/wink"
 *
 * const state = WinkEngineState.make({
 *   customEntities: O.none(),
 *   instanceId: InstanceId.make("wink-engine-example-3")
 * })
 *
 * console.log(state.customEntities._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WinkEngineState extends S.Class<WinkEngineState>($I`WinkEngineState`)(
  {
    customEntities: S.OptionFromOptionalKey(WinkEngineCustomEntities),
    instanceId: InstanceId,
  },
  $I.annote("WinkEngineState", {
    description: "Serializable metadata describing one live wink engine instance.",
  })
) {}

/**
 * In-memory state held by the live wink engine ref.
 *
 * **Gotchas**
 *
 * This type intentionally includes the live `wink-nlp` runtime object and is
 * therefore not serializable. Use {@link WinkEngineState} for metadata that can
 * cross process or persistence boundaries.
 *
 * **Example** (Read live runtime state)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { WinkEngine, WinkEngineLive } from "@beep/wink"
 * import type { WinkEngineRuntimeState } from "@beep/wink"
 *
 * const readState = Effect.gen(function* () {
 *   const engine = yield* WinkEngine
 *   const ref = yield* engine.getRef
 *   return yield* Ref.get(ref)
 * }).pipe(Effect.provide(WinkEngineLive))
 *
 * Effect.runPromise(readState).then((state: WinkEngineRuntimeState) =>
 *   console.log(state.instanceId)
 * )
 * ```
 *
 * @category models
 * @since 0.0.0
 */

export type WinkEngineRuntimeState = {
  readonly customEntities: O.Option<WinkEngineCustomEntities>;
  readonly instanceId: InstanceId;
  readonly nlp: WinkMethods;
};

const loadWinkRuntime = (): WinkMethods => {
  const winkNlp: typeof import("wink-nlp").default = require("wink-nlp");
  const model: Model = require("wink-eng-lite-web-model");
  return winkNlp(model);
};

const nextInstanceId = (nowMs: number, counter: number): InstanceId =>
  InstanceId.make(`wink-engine-${nowMs}-${counter}`);

const toMark = (mark: readonly [number, number]): readonly [number, number] => [mark[0], mark[1]];

const copyCustomEntity = (entry: {
  readonly mark?: readonly [number, number] | undefined;
  readonly name: string;
  readonly patterns: Iterable<string>;
}): WinkCustomEntityRecord =>
  O.match(O.fromNullishOr(entry.mark), {
    onNone: () => ({
      name: entry.name,
      patterns: A.fromIterable(entry.patterns),
    }),
    onSome: (mark) => ({
      mark: toMark(mark),
      name: entry.name,
      patterns: A.fromIterable(entry.patterns),
    }),
  });

const copyCustomEntities = (customEntities: WinkEngineCustomEntities): Array<WinkCustomEntityRecord> =>
  pipe(customEntities.toWinkFormat(), A.map(copyCustomEntity));

const observeEngine = (operation: string) =>
  observeWinkWorkflow({
    metricAttributes: { operation },
    name: `engine.${operation}`,
  });

const collectTokens = (state: WinkEngineRuntimeState, text: string): Array<ItemToken> => {
  const tokens: Array<ItemToken> = [];
  state.nlp
    .readDoc(text)
    .tokens()
    .each((token: ItemToken) => {
      A.appendInPlace(tokens, token);
    });
  return tokens;
};

const makeWinkEngine = Effect.gen(function* () {
  const nlp = yield* Effect.try({
    try: loadWinkRuntime,
    catch: (cause) => WinkEngineError.fromCause(cause, "initialize"),
  });
  const instanceCounterRef = yield* Ref.make(0);
  const initialTimeMs = yield* Clock.currentTimeMillis;
  const stateRef = yield* Ref.make<WinkEngineRuntimeState>({
    customEntities: O.none(),
    instanceId: nextInstanceId(initialTimeMs, 0),
    nlp,
  });

  const allocateInstanceId = pipe(
    Ref.updateAndGet(instanceCounterRef, (current) => current + 1),
    Effect.flatMap(
      Effect.fnUntraced(function* (counter) {
        return yield* Effect.map(Clock.currentTimeMillis, (nowMs) => nextInstanceId(nowMs, counter));
      })
    )
  );

  return WinkEngine.of({
    as: Ref.get(stateRef).pipe(Effect.map((state) => state.nlp.as)),
    getRef: Effect.succeed(stateRef),
    getWinkDoc: Effect.fn("Wink.WinkEngine.getWinkDoc")(function* (text: string) {
      yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
      const state = yield* Ref.get(stateRef);
      return yield* Effect.try({
        try: () => state.nlp.readDoc(text),
        catch: (cause) => WinkTokenizationError.fromCause(cause, "readDoc", text),
      });
    }, observeEngine("get_wink_doc")),
    getWinkTokens: Effect.fn("Wink.WinkEngine.getWinkTokens")(function* (text: string) {
      yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
      const state = yield* Ref.get(stateRef);
      return yield* Effect.try({
        try: () => collectTokens(state, text),
        catch: (cause) => WinkTokenizationError.fromCause(cause, "tokens", text),
      });
    }, observeEngine("get_wink_tokens")),
    getWinkTokenCount: Effect.fn("Wink.WinkEngine.getWinkTokenCount")(function* (text: string) {
      yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
      const state = yield* Ref.get(stateRef);
      return yield* Effect.try({
        try: () => state.nlp.readDoc(text).tokens().length(),
        catch: (cause) => WinkTokenizationError.fromCause(cause, "tokenCount", text),
      });
    }, observeEngine("get_wink_token_count")),
    getCurrentCustomEntities: Ref.get(stateRef).pipe(Effect.map((state) => state.customEntities)),
    its: Ref.get(stateRef).pipe(Effect.map((state) => state.nlp.its)),
    learnCustomEntities: Effect.fn("Wink.WinkEngine.learnCustomEntities")(function* (
      customEntities: WinkEngineCustomEntities
    ) {
      yield* Effect.annotateCurrentSpan({
        custom_entity_count: `${customEntities.size()}`,
        custom_entity_group: customEntities.name,
      });
      const currentState = yield* Ref.get(stateRef);
      yield* Effect.try({
        try: () => {
          currentState.nlp.learnCustomEntities(copyCustomEntities(customEntities));
        },
        catch: (cause) => WinkEntityError.fromCause(cause, "learnCustomEntities", customEntities.name),
      });
      const instanceId = yield* allocateInstanceId;
      yield* Ref.set(stateRef, {
        customEntities: O.some(customEntities),
        instanceId,
        nlp: currentState.nlp,
      });
    }, observeEngine("learn_custom_entities")),
  });
}).pipe(observeWinkWorkflow({ name: "engine.make" }));

/**
 * Service tag for direct access to the loaded `wink-nlp` runtime.
 *
 * **Example** (Count tokens via service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkEngine, WinkEngineLive } from "@beep/wink"
 *
 * const tokenCount = Effect.gen(function* () {
 *   const engine = yield* WinkEngine
 *   return yield* engine.getWinkTokenCount("Wink engine counts these tokens.")
 * })
 *
 * Effect.runPromise(tokenCount.pipe(Effect.provide(WinkEngineLive))).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WinkEngine extends Context.Service<WinkEngine, WinkEngineShape>()($I`WinkEngine`) {}

/**
 * Live layer that loads `wink-nlp` with the bundled English lite web model.
 *
 * **Example** (Provide live engine layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkEngine, WinkEngineLive } from "@beep/wink"
 *
 * const readRuntimeHelpers = Effect.gen(function* () {
 *   const engine = yield* WinkEngine
 *   return yield* engine.as
 * })
 *
 * Effect.runPromise(readRuntimeHelpers.pipe(Effect.provide(WinkEngineLive))).then((helpers) =>
 *   console.log(Object.keys(helpers).length)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkEngineLive = Layer.effect(WinkEngine, makeWinkEngine);
