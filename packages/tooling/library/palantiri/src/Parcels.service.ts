/**
 * The `Parcels` service and the source ports it reads through.
 *
 * **Details**
 *
 * Every local source a parcel needs lives in the repo CLI, which no package
 * may depend on. So each parcel declares a narrow source port here, the CLI
 * provides it from its own services, and `Parcels` stays host-agnostic: the
 * CLI command and the MCP host read the same service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { AgentProvider } from "@beep/repo-ai-metrics/AiMetrics.instruments";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AccountHeadroomSpec,
  accountHeadroomItems,
  freshAccountHeadroom,
  reduceAccountHeadroom,
} from "./AccountHeadroom.ts";
import { AppErrorClassesSpec, reduceAppErrorClasses } from "./AppErrorClasses.ts";
import { Freshness } from "./Freshness.ts";
import { replaceGaugeSeries } from "./GaugeSeries.ts";
import { freshPressureStalls, HostPressureSpec, hostPressureItems, reduceHostPressure } from "./HostPressure.ts";
import { LaneRedsSpec, reduceLaneReds } from "./LaneReds.ts";
import {
  AccountsWindowRemaining,
  HostPressureStall,
  ParcelAttribute,
  ParcelFreshnessAttribute,
  ProviderAttribute,
  ResourceAttribute,
  WindowAttribute,
  WindowScopeAttribute,
} from "./Palantiri.instruments.ts";
import { ParcelId, ParcelReadOptions } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft, ParcelEnvelope } from "./ParcelEnvelope.models.ts";
import { UnknownParcel } from "./Parcels.errors.ts";
import { reduceSinceLastCheck, SinceLastCheckSpec, sinceLastCheckCursor } from "./SinceLastCheck.ts";
import type { AccountHeadroom, AccountHeadroomInput } from "./AccountHeadroom.models.ts";
import type { HostPressureInput, HostPressureItem } from "./HostPressure.models.ts";
import type { LaneRedsInput } from "./LaneReds.models.ts";
import type { ParcelBudget, ParcelSpec, SessionKey } from "./Parcel.models.ts";
import type { SourceFailed } from "./Parcels.errors.ts";
import type { SinceLastCheckInput } from "./SinceLastCheck.models.ts";

const $I = $PalantiriId.create("Parcels.service");

/**
 * Port the account-headroom parcel reads through: one accounts report.
 *
 * **Example** (Provide a fixed report)
 *
 * ```ts
 * import { AccountHeadroomSource } from "@beep/palantiri/Parcels.service"
 * import { AccountHeadroomInput, AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const source = AccountHeadroomSource.of({
 *   snapshot: Effect.succeed(
 *     AccountHeadroomInput.make({
 *       report: AccountsReportInput.make({ schemaVersion: "accounts-status/v2", generatedAt: DateTime.makeUnsafe(0), groups: [] }),
 *       expectedProviders: O.some([])
 *     })
 *   )
 * })
 * console.log(Effect.isEffect(source.snapshot)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class AccountHeadroomSource extends Context.Service<
  AccountHeadroomSource,
  {
    /**
     * The newest accounts report the host can serve, live or from its
     * snapshot, with the providers the host has configured.
     */
    readonly snapshot: Effect.Effect<AccountHeadroomInput, SourceFailed>;
  }
>()($I`AccountHeadroomSource`) {}

/**
 * Port the lane-reds parcel reads through: every checkout's inbox rows and
 * proof jobs.
 *
 * **Example** (Provide no checkouts)
 *
 * ```ts
 * import { LaneRedsSource } from "@beep/palantiri/Parcels.service"
 * import { LaneRedsInput } from "@beep/palantiri/LaneReds.models"
 * import * as Effect from "effect/Effect"
 *
 * const source = LaneRedsSource.of({ snapshot: Effect.succeed(LaneRedsInput.make({ checkouts: [] })) })
 * console.log(Effect.isEffect(source.snapshot)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class LaneRedsSource extends Context.Service<
  LaneRedsSource,
  {
    /** The inbox rows and proof jobs of every checkout the host knows. */
    readonly snapshot: Effect.Effect<LaneRedsInput, SourceFailed>;
  }
>()($I`LaneRedsSource`) {}

/**
 * Port the host-pressure parcel reads through: the host's pressure stall
 * files, memory and admission occupancy.
 *
 * **Example** (Provide a host without pressure files)
 *
 * ```ts
 * import { HostPressureSource } from "@beep/palantiri/Parcels.service"
 * import { HostPressureInput, PressureSourceInput } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const source = HostPressureSource.of({
 *   snapshot: Effect.succeed(
 *     HostPressureInput.make({
 *       readAt: DateTime.makeUnsafe(0),
 *       pressure: PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure" }),
 *       memory: O.none(),
 *       admission: O.none()
 *     })
 *   )
 * })
 * console.log(Effect.isEffect(source.snapshot)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class HostPressureSource extends Context.Service<
  HostPressureSource,
  {
    /** The host's readings, taken now. */
    readonly snapshot: Effect.Effect<HostPressureInput, SourceFailed>;
  }
>()($I`HostPressureSource`) {}

/**
 * Port the since-last-check parcel reads through: a session's cursor, the
 * session ledger and the checkout inbox, and the cursor write.
 *
 * **Details**
 *
 * `advance` must replace the cursor atomically, so a crash never leaves a
 * torn cursor behind.
 *
 * **Example** (Provide an empty session)
 *
 * ```ts
 * import { SinceLastCheckSource } from "@beep/palantiri/Parcels.service"
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const source = SinceLastCheckSource.of({
 *   read: () => Effect.succeed(SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })),
 *   advance: () => Effect.void
 * })
 * console.log(Effect.isEffect(source.advance("session-1", DateTime.makeUnsafe(0)))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class SinceLastCheckSource extends Context.Service<
  SinceLastCheckSource,
  {
    /** The session's cursor, the repository's ledger rows and the checkout's inbox rows. */
    readonly read: (session: SessionKey) => Effect.Effect<SinceLastCheckInput, SourceFailed>;
    /** Move the session's cursor to `at`, atomically. */
    readonly advance: (session: SessionKey, at: DateTime.Utc) => Effect.Effect<void, SourceFailed>;
  }
>()($I`SinceLastCheckSource`) {}

/**
 * Every source port the {@link Parcels} service reads through.
 *
 * @category ports
 * @since 0.0.0
 */
export type ParcelSources = AccountHeadroomSource | LaneRedsSource | HostPressureSource | SinceLastCheckSource;

/**
 * The spec of every parcel, in `ParcelId` order.
 *
 * **Example** (List the parcel ids)
 *
 * ```ts
 * import { parcelSpecs } from "@beep/palantiri/Parcels.service"
 *
 * console.log(parcelSpecs.map((spec) => spec.id))
 * // ["account-headroom", "lane-reds", "host-pressure", "app-error-classes", "since-last-check"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const parcelSpecs: ReadonlyArray<ParcelSpec> = [
  AccountHeadroomSpec,
  LaneRedsSpec,
  HostPressureSpec,
  AppErrorClassesSpec,
  SinceLastCheckSpec,
];

/**
 * Shape of the {@link Parcels} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface ParcelsShape {
  /**
   * Read one parcel by id. A source failure is served as
   * `Unknown{unreachable}`; only an unknown id fails. `since-last-check`
   * reads `options.session` and advances that session's cursor.
   */
  readonly read: (id: string, options?: ParcelReadOptions) => Effect.Effect<ParcelEnvelope, UnknownParcel>;
}

/**
 * Reads parcels, checks their freshness, and records the quota gauge.
 *
 * **Example** (Read a parcel)
 *
 * ```ts
 * import { AccountHeadroomSource, Parcels, layerParcels } from "@beep/palantiri/Parcels.service"
 * import { AccountHeadroomInput, AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const source = Layer.succeed(AccountHeadroomSource, {
 *   snapshot: Effect.succeed(
 *     AccountHeadroomInput.make({
 *       report: AccountsReportInput.make({ schemaVersion: "accounts-status/v2", generatedAt: DateTime.makeUnsafe(0), groups: [] }),
 *       expectedProviders: O.some([])
 *     })
 *   )
 * })
 * const program = Parcels.use((parcels) => parcels.read("account-headroom")).pipe(
 *   Effect.provide(layerParcels.pipe(Layer.provide(source)))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Parcels extends Context.Service<Parcels, ParcelsShape>()($I`Parcels`) {}

const windowRemaining = Metric.gauge(AccountsWindowRemaining.name, {
  description: AccountsWindowRemaining.description,
});

const agentProviders = HashMap.make<ReadonlyArray<readonly [string, AgentProvider]>>(
  ["claude", AgentProvider.Enum.anthropic],
  ["codex", AgentProvider.Enum.openai],
  ["cursor", AgentProvider.Enum.cursor],
  ["grok", AgentProvider.Enum.xai],
  ["grok-bot", AgentProvider.Enum.xai],
  ["muse", AgentProvider.Enum.meta],
  ["junie", AgentProvider.Enum.jetbrains]
);

const GaugeReading = S.Struct({ provider: AgentProvider, window: S.String, scope: S.String, remaining: S.Finite });
type GaugeReading = typeof GaugeReading.Type;

const byRemaining: Order.Order<GaugeReading> = Order.mapInput(Num.Order, (reading) => reading.remaining);

// One series per provider, window and scope: several accounts of one provider
// share it, so it reports the most headroom any of them has, and scoped
// windows (one per model group) stay separate series. Only fresh items count,
// so a stale reading never looks current. A gauge keeps its last value, so
// every read replaces the gauge's whole series set: in a long-lived host (the
// `beep palantiri mcp` server) a series whose reading went stale, or whose
// source failed, stops reporting instead of repeating its last fresh value.
const gaugeReadings = (items: ReadonlyArray<AccountHeadroom>): ReadonlyArray<GaugeReading> =>
  A.map(
    R.values(
      A.groupBy(
        A.flatMap(freshAccountHeadroom(items), (item) =>
          O.match(HashMap.get(agentProviders, item.provider), {
            onNone: A.empty<GaugeReading>,
            onSome: (provider) =>
              A.map(item.windows, (window) => ({
                provider,
                window: window.kind,
                scope: O.getOrElse(window.scope, () => "all"),
                remaining: window.remainingPercent,
              })),
          })
        ),
        (reading) => `${reading.provider} ${reading.window} ${reading.scope}`
      )
    ),
    (readings) => A.max(readings, byRemaining)
  );

const recordHeadroom = (items: ReadonlyArray<AccountHeadroom>) =>
  replaceGaugeSeries(
    windowRemaining,
    A.map(gaugeReadings(items), (reading) => [
      {
        [ProviderAttribute]: reading.provider,
        [WindowAttribute]: reading.window,
        [WindowScopeAttribute]: reading.scope,
      },
      reading.remaining,
    ])
  );

const pressureStall = Metric.gauge(HostPressureStall.name, { description: HostPressureStall.description });

// One series per resource, from fresh readings only; a resource that is no
// longer fresh loses its series.
const recordPressure = (items: ReadonlyArray<HostPressureItem>) =>
  replaceGaugeSeries(
    pressureStall,
    A.map(freshPressureStalls(items), (stall) => [{ [ResourceAttribute]: stall.resource }, stall.some.avg10])
  );

const freshnessState = Freshness.match({ Fresh: () => "fresh", Unknown: () => "unknown" });

const unavailable = (spec: ParcelSpec, now: DateTime.Utc, budget: ParcelBudget, failure: SourceFailed) =>
  makeParcelEnvelope(
    ParcelDraft.make({
      spec,
      readAt: now,
      freshness: Freshness.cases.Unknown.make({
        reason: "unreachable",
        asOf: O.none(),
        detail: O.some(failure.detail),
      }),
      summary: `${Str.replaceAll("-", " ")(spec.id)} unavailable: ${failure.detail}`,
      items: [],
      budget,
    })
  );

const makeParcels = Effect.gen(function* () {
  const accounts = yield* AccountHeadroomSource;

  const lanes = yield* LaneRedsSource;
  const host = yield* HostPressureSource;
  const sessions = yield* SinceLastCheckSource;

  const readAccountHeadroom = Effect.fnUntraced(function* (budget: ParcelBudget) {
    const now = yield* DateTime.now;
    return yield* accounts.snapshot.pipe(
      Effect.tap((input) => recordHeadroom(accountHeadroomItems(input.report, now))),
      Effect.map(reduceAccountHeadroom(now, budget)),
      Effect.catchTag("SourceFailed", (failure) =>
        recordHeadroom([]).pipe(Effect.as(unavailable(AccountHeadroomSpec, now, budget, failure)))
      )
    );
  });

  const readLaneReds = Effect.fnUntraced(function* (budget: ParcelBudget) {
    const now = yield* DateTime.now;
    return yield* lanes.snapshot.pipe(
      Effect.map(reduceLaneReds(now, budget)),
      Effect.catchTag("SourceFailed", (failure) => Effect.succeed(unavailable(LaneRedsSpec, now, budget, failure)))
    );
  });

  const readHostPressure = Effect.fnUntraced(function* (budget: ParcelBudget) {
    const now = yield* DateTime.now;
    return yield* host.snapshot.pipe(
      Effect.tap((input) => recordPressure(hostPressureItems(input, now))),
      Effect.map(reduceHostPressure(now, budget)),
      Effect.catchTag("SourceFailed", (failure) =>
        recordPressure([]).pipe(Effect.as(unavailable(HostPressureSpec, now, budget, failure)))
      )
    );
  });

  const readAppErrorClasses = Effect.fnUntraced(function* (budget: ParcelBudget) {
    const now1 = yield* DateTime.now;
    return reduceAppErrorClasses(now1, budget);
  });

  // The cursor moves to the read time taken before the sources are read, so
  // a row written during the read shows up again next time rather than never.
  // It moves only as far as the changes served, and not at all when the inbox
  // could not be read (sinceLastCheckCursor).
  const readSinceLastCheck = Effect.fnUntraced(function* (budget: ParcelBudget, session: O.Option<SessionKey>) {
    const now = yield* DateTime.now;
    return yield* O.match(session, {
      onNone: () =>
        Effect.succeed(
          makeParcelEnvelope(
            ParcelDraft.make({
              spec: SinceLastCheckSpec,
              readAt: now,
              freshness: Freshness.cases.Unknown.make({
                reason: "attribution-incomplete",
                asOf: O.none(),
                detail: O.some("no session id: pass --session or run under a harness that exports one"),
              }),
              summary: "since last check needs a session id",
              items: [],
              budget,
            })
          )
        ),
      onSome: (key) =>
        sessions.read(key).pipe(
          Effect.flatMap((input) => {
            const envelope = reduceSinceLastCheck(input, now, budget);
            return O.match(sinceLastCheckCursor(input, now, budget), {
              onNone: () => Effect.succeed(envelope),
              onSome: (cursor) =>
                sessions.advance(key, cursor).pipe(
                  Effect.as(envelope),
                  Effect.catchTag("SourceFailed", (failure) =>
                    Effect.succeed(
                      ParcelEnvelope.make({
                        ...envelope,
                        summary: `${envelope.summary}; read cursor not saved (${failure.detail})`,
                      })
                    )
                  )
                ),
            });
          }),
          Effect.catchTag("SourceFailed", (failure) =>
            Effect.succeed(unavailable(SinceLastCheckSpec, now, budget, failure))
          )
        ),
    });
  });

  const read = Effect.fn("Parcels.read")(function* (id: string, options?: ParcelReadOptions) {
    const parcel = yield* S.decodeUnknownEffect(ParcelId)(id).pipe(
      Effect.mapError(() => UnknownParcel.make({ parcel: id }))
    );
    yield* Effect.annotateCurrentSpan(ParcelAttribute, parcel);
    const { budget, session } = options ?? ParcelReadOptions.make({});
    const envelope = yield* ParcelId.match(parcel, {
      "account-headroom": () => readAccountHeadroom(budget),
      "lane-reds": () => readLaneReds(budget),
      "host-pressure": () => readHostPressure(budget),
      "app-error-classes": () => readAppErrorClasses(budget),
      "since-last-check": () => readSinceLastCheck(budget, session),
    });
    yield* Effect.annotateCurrentSpan(ParcelFreshnessAttribute, freshnessState(envelope.freshness));
    return envelope;
  });

  return Parcels.of({ read });
});

/**
 * The {@link Parcels} service over its source ports.
 *
 * **Example** (Provide the parcels service)
 *
 * ```ts
 * import { Parcels, layerParcels } from "@beep/palantiri/Parcels.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Parcels.use((parcels) => parcels.read("account-headroom")).pipe(Effect.provide(layerParcels))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerParcels = Layer.effect(Parcels, makeParcels);
