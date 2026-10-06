/**
 * Provider API-call metering: an in-memory counter per run and the private
 * JSONL ledger it is flushed to once, when the run ends.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, Layer, Ref } from "effect";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { makeStateFileAt } from "../internal/MailTaggingStateFile.ts";
import type { FileSystem, Path } from "effect";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.metering");

const defaultRunLabel = "practice-mail-tagging";

/**
 * Provider whose API calls are metered against a shared budget.
 *
 * **Example** (Guard a metered provider)
 *
 * ```ts
 * import { MeteredProvider } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MeteredProvider)("box")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MeteredProvider = LiteralKit(["box"]).pipe(
  $I.annoteSchema("MeteredProvider", {
    description: "Provider whose API calls are counted against a shared monthly budget.",
  })
);

/**
 * Runtime type for {@link MeteredProvider}.
 *
 * @category models
 * @since 0.0.0
 */
export type MeteredProvider = typeof MeteredProvider.Type;

/**
 * A number of API calls just made to one provider.
 *
 * **Example** (Record one upload call)
 *
 * ```ts
 * import { ProviderCalls } from "@beep/law-practice-server/MailTagging"
 *
 * const calls = ProviderCalls.make({ provider: "box", calls: 1 })
 * console.log(calls.calls) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderCalls extends S.Class<ProviderCalls>($I`ProviderCalls`)(
  {
    provider: MeteredProvider.annotateKey({
      description: "Provider the calls went to.",
    }),
    calls: S.Natural.annotateKey({
      description: "Number of API calls made.",
    }),
  },
  $I.annote("ProviderCalls", {
    description: "A number of API calls just made to one provider.",
  })
) {}

/**
 * One line of the shared Box API-call ledger: what one run of one workstream
 * spent.
 *
 * **Example** (Describe a run's spend)
 *
 * ```ts
 * import { ProviderCallLedgerLine } from "@beep/law-practice-server/MailTagging"
 * import * as DateTime from "effect/DateTime"
 *
 * const line = ProviderCallLedgerLine.make({
 *   runLabel: "run-0001",
 *   calls: 3,
 *   at: DateTime.makeUnsafe("2026-07-01T12:00:00.000Z")
 * })
 * console.log(line.workstream) // "email-tagging"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderCallLedgerLine extends S.Class<ProviderCallLedgerLine>($I`ProviderCallLedgerLine`)(
  {
    workstream: S.Literal("email-tagging")
      .pipe(S.withConstructorDefault(Effect.succeed("email-tagging")))
      .annotateKey({
        description: "Workstream the calls are charged to.",
      }),
    runLabel: S.NonEmptyString.annotateKey({
      description: "Label of the run that made the calls.",
    }),
    calls: S.Natural.annotateKey({
      description: "API calls the run made.",
    }),
    at: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the line was written.",
    }),
    exact: S.Literal(true)
      .pipe(S.withConstructorDefault(Effect.succeed(true)))
      .annotateKey({
        description: "Whether the count is exact rather than estimated; this adapter counts every call.",
      }),
  },
  $I.annote("ProviderCallLedgerLine", {
    description: "One run's API-call spend in the shared Box call ledger.",
  })
) {}

/**
 * JSON codec of one Box API-call ledger line.
 *
 * **Example** (Guard a decoded line)
 *
 * ```ts
 * import { ProviderCallLedgerJsonLine } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProviderCallLedgerJsonLine)({ workstream: "email-tagging" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProviderCallLedgerJsonLine = S.fromJsonString(ProviderCallLedgerLine).pipe(
  $I.annoteSchema("ProviderCallLedgerJsonLine", {
    description: "One JSON line of the shared Box API-call ledger.",
  })
);

/**
 * Runtime type for {@link ProviderCallLedgerJsonLine}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProviderCallLedgerJsonLine = typeof ProviderCallLedgerJsonLine.Type;

/**
 * Where the shared Box API-call ledger lives and how this run is labelled in
 * it.
 *
 * **Example** (Name the ledger and the run)
 *
 * ```ts
 * import { BoxCallLedgerConfig } from "@beep/law-practice-server/MailTagging"
 *
 * const config = BoxCallLedgerConfig.make({ path: "state/box-api-calls.jsonl" })
 * console.log(config.runLabel) // "practice-mail-tagging"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class BoxCallLedgerConfig extends S.Class<BoxCallLedgerConfig>($I`BoxCallLedgerConfig`)(
  {
    path: S.NonEmptyString.annotateKey({
      description: "Full path of the shared Box API-call JSONL ledger.",
    }),
    runLabel: S.NonEmptyString.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultRunLabel)),
      S.withConstructorDefault(Effect.succeed(defaultRunLabel))
    ).annotateKey({
      description: "Label the run's ledger line carries; defaults to the service name.",
    }),
  },
  $I.annote("BoxCallLedgerConfig", {
    description: "Location of the shared Box API-call ledger and this run's label.",
  })
) {}

/**
 * Service tag carrying the Box API-call ledger's location.
 *
 * **Example** (Provide the ledger location)
 *
 * ```ts
 * import { BoxCallLedgerConfig, BoxCallLedgerLocation } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Location = Layer.succeed(
 *   BoxCallLedgerLocation,
 *   BoxCallLedgerConfig.make({ path: "state/box-api-calls.jsonl", runLabel: "run-0001" })
 * )
 * console.log(Layer.isLayer(Location)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class BoxCallLedgerLocation extends Context.Service<BoxCallLedgerLocation, BoxCallLedgerConfig>()(
  $I`BoxCallLedgerLocation`
) {}

/**
 * Meter a provider adapter reports its API calls to.
 *
 * **Details**
 *
 * `record` only counts. Writing the count somewhere durable is the providing
 * layer's concern, so an adapter can report every call without touching a
 * file per call.
 *
 * **Example** (Provide a meter that discards the count)
 *
 * ```ts
 * import { ProviderCallMeter } from "@beep/law-practice-server/MailTagging"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const Unmetered = Layer.succeed(ProviderCallMeter, ProviderCallMeter.of({ record: () => Effect.void }))
 * console.log(Layer.isLayer(Unmetered)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProviderCallMeter extends Context.Service<
  ProviderCallMeter,
  {
    readonly record: (calls: ProviderCalls) => Effect.Effect<void>;
  }
>()($I`ProviderCallMeter`) {}

const encodeLedgerLine = S.encodeEffect(ProviderCallLedgerJsonLine);

const makeBoxCallMeter = Effect.gen(function* () {
  const location = yield* BoxCallLedgerLocation;
  const ledger = yield* makeStateFileAt("provider-call-ledger", location.path);
  const total = yield* Ref.make(0);

  const append = Effect.fn("BoxCallLedgerFile.append")(function* (calls: number) {
    const at = yield* DateTime.now;
    const line = yield* encodeLedgerLine(ProviderCallLedgerLine.make({ runLabel: location.runLabel, calls, at }));
    yield* ledger.append(`${line}\n`);
  });

  // The count is the diagnostic: a failed flush is logged with it, never with the path.
  const flush = Effect.flatMap(Ref.get(total), (calls) =>
    calls > 0
      ? append(calls).pipe(
          Effect.catchCause(() =>
            Effect.logError("Box API-call ledger line was not written").pipe(
              Effect.annotateLogs({ calls, runLabel: location.runLabel })
            )
          )
        )
      : Effect.void
  );

  yield* Effect.addFinalizer(() => flush);

  return ProviderCallMeter.of({
    record: Effect.fn("ProviderCallMeter.record")((calls: ProviderCalls) =>
      Ref.update(total, (count) => count + calls.calls)
    ),
  });
});

/**
 * Layer providing the provider call meter, flushed to the shared Box API-call
 * ledger when the layer's scope closes.
 *
 * **Details**
 *
 * `record` adds to an in-memory count. When the scope that built the layer
 * closes, whether the run succeeded, failed, or was interrupted, a run that
 * made at least one call appends exactly one line:
 * `{"workstream":"email-tagging","runLabel":…,"calls":…,"at":…,"exact":true}`.
 * A run that made no call, a dry run for example, appends nothing. A flush
 * that cannot write logs the count at error level, because a finalizer has no
 * failure channel.
 *
 * **Gotchas**
 *
 * The layer's scope is the run. Build it once per run; a long-lived instance
 * would hold every run's calls in memory until the process exits.
 *
 * **Example** (Wire the meter over a ledger file)
 *
 * ```ts
 * import {
 *   BoxCallLedgerConfig,
 *   BoxCallLedgerFile,
 *   BoxCallLedgerLocation
 * } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Meter = BoxCallLedgerFile.pipe(
 *   Layer.provide(
 *     Layer.succeed(BoxCallLedgerLocation, BoxCallLedgerConfig.make({ path: "state/box-api-calls.jsonl" }))
 *   )
 * )
 * console.log(Layer.isLayer(Meter)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxCallLedgerFile: Layer.Layer<
  ProviderCallMeter,
  never,
  BoxCallLedgerLocation | FileSystem.FileSystem | Path.Path
> = Layer.effect(ProviderCallMeter, makeBoxCallMeter);
