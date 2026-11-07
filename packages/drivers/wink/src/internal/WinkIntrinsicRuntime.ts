/** Pinned private API adaptation; handles never leave their owning engine scope. @packageDocumentation @since 0.0.0 */
/// <reference path="./intrinsic-runtime.d.ts" />
import { $WinkId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { WinkEngineError } from "../Wink.errors.ts";
import { WinkIntrinsicNounActivationError, WinkIntrinsicNounError } from "../WinkIntrinsicNoun.errors.ts";
import {
  WinkIntrinsicNounRequest,
  WinkIntrinsicNounResult,
  winkIntrinsicNounQueryCost,
} from "../WinkIntrinsicNoun.models.ts";
import type { WinkMethods } from "wink-nlp";
import type { WinkIntrinsicNounShape } from "../WinkIntrinsicNoun.models.ts";

const $I = $WinkId.create("Wink/IntrinsicRuntime");
const CoreFactory = S.declare<() => unknown>((value): value is () => unknown => P.isFunction(value)).pipe(
  $I.annoteSchema("WinkCoreFactory", {
    description: "External fixed SDK constructor; its opaque result is passed only to the same engine/cache owner.",
  })
);
const CacheFactory = S.declare<(core: unknown, features: unknown) => unknown>(
  (value): value is (core: unknown, features: unknown) => unknown => P.isFunction(value)
).pipe(
  $I.annoteSchema("WinkMembershipCacheFactory", {
    description: "Private pinned factory; no module or model export is modified.",
  })
);
const MembershipMethod = S.declare<(form: string, pos: "NOUN") => unknown>(
  (value): value is (form: string, pos: "NOUN") => unknown => P.isFunction(value)
).pipe(
  $I.annoteSchema("WinkMembershipMethod", {
    description: "Only the pinned exact-form NOUN query is exposed internally.",
  })
);
const OovMethod = S.declare<(form: string) => unknown>((value): value is (form: string) => unknown =>
  P.isFunction(value)
).pipe($I.annoteSchema("WinkOovMethod", { description: "Read-only exact-form OOV membership." }));
class IntrinsicCache extends S.Opaque<IntrinsicCache, { readonly brand: unique symbol }>()(
  S.Struct({ hasSamePOS: MembershipMethod, isOOV: OovMethod }).pipe(
    $I.annoteSchema("WinkIntrinsicCache", {
      description: "Driver-private procedural SDK handle, never a serialized or product-domain value.",
    })
  )
) {}
const Bits = S.Struct({ baseNoun: S.Boolean, oov: S.Boolean }).pipe(
  $I.annoteSchema("WinkIntrinsicBits", { description: "Decode vendor results before publishing typed membership." })
);
const EngineVersion = S.Struct({ version: S.tag("2.4.0") }).pipe(
  $I.annoteSchema("WinkIntrinsicEngineVersion", {
    description: "Only the reviewed installed engine version can activate this private API.",
  })
);
const ModelVersion = S.Struct({ version: S.tag("1.8.1") }).pipe(
  $I.annoteSchema("WinkIntrinsicModelVersion", {
    description: "Only the reviewed installed model version can activate intrinsic membership.",
  })
);
const activationError = (reason: WinkIntrinsicNounActivationError["reason"]) => (cause: unknown) =>
  WinkIntrinsicNounActivationError.make({ reason, cause });

/** One nonserializable SDK owner; release clears every added model/cache reference. @internal */
export class WinkIntrinsicOwner {
  private active = true;
  private core: O.Option<unknown>;
  private features: O.Option<unknown>;
  private cache = O.none<IntrinsicCache>();
  private current = O.none<Effect.Effect<boolean>>();
  constructor(core: unknown, features: unknown) {
    this.core = O.some(core);
    this.features = O.some(features);
  }
  readonly setCurrent = (current: Effect.Effect<boolean>): void => {
    this.current = O.some(current);
  };
  readonly release = Effect.sync(() => {
    this.active = false;
    this.core = O.none();
    this.features = O.none();
    this.cache = O.none();
    this.current = O.none();
  });
  private readonly read = Effect.fn("WinkIntrinsic.read")(
    (request: WinkIntrinsicNounRequest, workDebit: number, remainingWork: number) =>
      Effect.gen({ self: this }, function* () {
        const cache = this.cache;
        if (O.isNone(cache))
          return yield* WinkIntrinsicNounError.make({
            reason: "released",
            cause: "membership owner unavailable",
            workDebit,
            remainingWork,
          });
        const raw = yield* Effect.try({
          try: () => ({
            baseNoun: cache.value.hasSamePOS(request.rawForm, "NOUN"),
            oov: cache.value.isOOV(request.rawForm),
          }),
          catch: (cause) => WinkIntrinsicNounError.make({ reason: "query-failed", cause, workDebit, remainingWork }),
        });
        const bits = yield* S.decodeUnknownEffect(Bits)(raw).pipe(
          Effect.mapError((cause) =>
            WinkIntrinsicNounError.make({ reason: "query-failed", cause, workDebit, remainingWork })
          )
        );
        return WinkIntrinsicNounResult.cases.known.make({
          rawForm: request.rawForm,
          ...bits,
          workDebit,
          remainingWork,
        });
      })
  );
  readonly query = Effect.fn("WinkIntrinsic.query")((input: WinkIntrinsicNounRequest) =>
    Effect.gen({ self: this }, function* () {
      const request = yield* S.decodeEffect(WinkIntrinsicNounRequest)(input).pipe(
        Effect.mapError((cause) =>
          WinkIntrinsicNounError.make({ reason: "invalid-request", cause, workDebit: 0, remainingWork: 0 })
        )
      );
      if (!this.active)
        return yield* WinkIntrinsicNounError.make({
          reason: "released",
          cause: "owning engine scope released",
          workDebit: 0,
          remainingWork: request.remainingWork,
        });
      const debit = winkIntrinsicNounQueryCost(request.rawForm);
      if (request.remainingWork < debit)
        return WinkIntrinsicNounResult.cases["work-limit"].make({
          rawForm: request.rawForm,
          remainingWork: request.remainingWork,
        });
      // This debit precedes identity reads, both vendor calls, and result allocation.
      const remainingWork = request.remainingWork - debit;
      yield* Effect.annotateCurrentSpan({
        "wink.intrinsic.form_length": request.rawForm.length,
        "wink.intrinsic.work_debit": debit,
        "wink.intrinsic.remaining_work": remainingWork,
      });
      const current = O.getOrElse(this.current, () => Effect.succeed(false));
      if (!(yield* current))
        return yield* WinkIntrinsicNounError.make({
          reason: "engine-replaced",
          cause: "engine reference no longer names the captured core owner",
          workDebit: debit,
          remainingWork,
        });
      return yield* this.read(request, debit, remainingWork);
    })
  );
  readonly activate = Effect.gen({ self: this }, function* () {
    const [cacheModule, enginePackage, modelPackage] = yield* Effect.all(
      [
        Effect.tryPromise({ try: () => import("wink-nlp/src/cache.js"), catch: activationError("private-api") }),
        Effect.tryPromise({ try: () => import("wink-nlp/package.json"), catch: activationError("version") }),
        Effect.tryPromise({
          try: () => import("wink-eng-lite-web-model/package.json"),
          catch: activationError("version"),
        }),
      ],
      { concurrency: 2 }
    );
    const engineVersion = yield* S.decodeUnknownEffect(EngineVersion)(enginePackage.default).pipe(
      Effect.mapError(activationError("version"))
    );
    const modelVersion = yield* S.decodeUnknownEffect(ModelVersion)(modelPackage.default).pipe(
      Effect.mapError(activationError("version"))
    );
    const factory = yield* S.decodeUnknownEffect(CacheFactory)(cacheModule.default).pipe(
      Effect.mapError(activationError("private-api"))
    );
    if (!this.active || O.isNone(this.core) || O.isNone(this.features))
      return yield* activationError("core-owner")("engine scope released before activation");
    const core = this.core.value;
    const features = this.features.value;
    const raw = yield* Effect.try({ try: () => factory(core, features), catch: activationError("private-api") });
    const cache = yield* S.decodeUnknownEffect(IntrinsicCache)(raw).pipe(
      Effect.mapError(activationError("private-api"))
    );
    if (!this.active) return yield* activationError("core-owner")("engine scope released during activation");
    this.cache = O.some(cache);
    return {
      provider: `wink-nlp@${engineVersion.version}/wink-eng-lite-web-model@${modelVersion.version}`,
      query: this.query,
    } satisfies WinkIntrinsicNounShape;
  });
}

/** Capture the sole core call made by the existing fixed Wink constructor. @internal */
export const constructWinkWithIntrinsicOwner = Effect.fn("WinkIntrinsic.construct")(function* (
  engine: typeof import("wink-nlp").default,
  model: typeof import("wink-eng-lite-web-model").default
) {
  const coreFactory = yield* S.decodeUnknownEffect(CoreFactory)(model.core).pipe(
    Effect.mapError(activationError("core-owner"))
  );
  let captured = O.none<unknown>();
  let calls = 0;
  const adapter = Object.freeze({
    ...model,
    core: () => {
      calls++;
      if (O.isSome(captured)) return captured.value;
      const core = coreFactory();
      captured = O.some(core);
      return core;
    },
  });
  const nlp: WinkMethods = yield* Effect.try({
    try: () => engine(adapter),
    catch: (cause) => WinkEngineError.fromCause(cause, "initialize"),
  });
  if (calls !== 1 || O.isNone(captured))
    return yield* activationError("core-owner")("fixed engine did not construct exactly one core");
  return { nlp, owner: new WinkIntrinsicOwner(captured.value, model.featureFn) };
});
