/**
 * Reduce the events of one gate run to its report, applying the honest-count
 * rules: nothing collected is errored, a failure the tool reported without a
 * failed item is errored with one item carrying the log excerpt, and a failed
 * item makes the run failed whatever the tool's own reason said.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { classifyOutcome, tally } from "./Classify.ts";
import { GateEvent } from "./GateEvent.ts";
import { GateReport, Unit } from "./GateReport.ts";
import { Item, ItemDetail, Location } from "./Item.ts";
import { fingerprint, ItemKey } from "./ItemKey.ts";
import { PolicyRenderState } from "./Policy.ts";
import { ItemOutcome, RunReason } from "./Vocabulary.ts";
import type { PolicyBreach } from "./Policy.ts";
import type { StrayOutput } from "./StrayOutput.ts";
import type { FailureKind } from "./Vocabulary.ts";

const $I = $GateReportId.create("Reducer");

/**
 * The events did not describe a whole run: no `RunStarted`, or neither a
 * `RunFinished` nor a `RunCancelled`.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { IncompleteRunError } from "@beep/gate-report/Reducer";
 *
 * const error = IncompleteRunError.make({ message: "no RunStarted event" });
 * console.log(error._tag); // IncompleteRunError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IncompleteRunError extends S.TaggedError<IncompleteRunError, { readonly brand: unique symbol }>(
  $I`IncompleteRunError`
)(
  "IncompleteRunError",
  { message: S.String },
  $I.annoteError<IncompleteRunError>("IncompleteRunError", {
    description: "The events did not describe a whole run: a start event or an end event is missing.",
  })
) {}

type RunStarted = typeof GateEvent.cases.RunStarted.Type;
type RunFinished = typeof GateEvent.cases.RunFinished.Type;

type Indexed<V> = { readonly order: number; readonly value: V };

type DiagnosticKey = typeof ItemKey.cases.DiagnosticKey.Type;

type Occurrence = { readonly ordinal: number; readonly location: O.Option<Location> };

type RunState = {
  readonly start: O.Option<RunStarted>;
  readonly occurrences: HashMap.HashMap<string, ReadonlyArray<Occurrence>>;
  readonly units: HashMap.HashMap<string, Indexed<Unit>>;
  readonly items: HashMap.HashMap<string, Indexed<Item>>;
  readonly collected: O.Option<number>;
  readonly breaches: ReadonlyArray<PolicyBreach>;
  readonly strayOutput: O.Option<StrayOutput>;
  readonly unhandled: number;
  readonly cancelled: boolean;
  readonly finish: O.Option<RunFinished>;
};

const emptyState: RunState = {
  start: O.none(),
  occurrences: HashMap.empty(),
  units: HashMap.empty(),
  items: HashMap.empty(),
  collected: O.none(),
  breaches: [],
  strayOutput: O.none(),
  unhandled: 0,
  cancelled: false,
  finish: O.none(),
};

const upsert = <V>(map: HashMap.HashMap<string, Indexed<V>>, id: string, value: V) =>
  HashMap.set(map, id, {
    order: pipe(
      HashMap.get(map, id),
      O.map((entry) => entry.order),
      O.getOrElse(() => HashMap.size(map))
    ),
    value,
  });

const ordered = <V>(map: HashMap.HashMap<string, Indexed<V>>): ReadonlyArray<V> =>
  pipe(
    HashMap.toValues(map),
    A.sort(Order.mapInput(Order.Number, (entry: Indexed<V>) => entry.order)),
    A.map((entry) => entry.value)
  );

const putItem = (state: RunState, item: Item): RunState => ({
  ...state,
  items: upsert(state.items, fingerprint(item.key), item),
});

const sameLocation = O.makeEquivalence(S.toEquivalence(Location));

const placeOccurrence = (state: RunState, item: Item, key: DiagnosticKey): RunState => {
  const base = ItemKey.cases.DiagnosticKey.make({ file: key.file, code: key.code, shape: key.shape });
  const id = fingerprint(base);
  const seen = O.getOrElse(HashMap.get(state.occurrences, id), (): ReadonlyArray<Occurrence> => []);
  const ordinal = pipe(
    A.findFirst(seen, (occurrence) => sameLocation(occurrence.location, item.location)),
    O.map((occurrence) => occurrence.ordinal),
    O.getOrElse(() => seen.length + 1)
  );
  const occurrences =
    ordinal > seen.length
      ? HashMap.set(state.occurrences, id, A.append(seen, { ordinal, location: item.location }))
      : state.occurrences;
  const placed = ItemKey.cases.DiagnosticKey.make({
    file: key.file,
    code: key.code,
    shape: key.shape,
    occurrence: ordinal > 1 ? O.some(ordinal) : O.none(),
  });
  return putItem({ ...state, occurrences }, Item.make({ ...item, key: placed }));
};

const placeItem = (state: RunState, item: Item): RunState => {
  const key = item.key;
  return ItemKey.guards.DiagnosticKey(key) ? placeOccurrence(state, item, key) : putItem(state, item);
};

const subjectOf = (state: RunState): string =>
  pipe(
    state.start,
    O.map((start) => start.subject),
    O.getOrElse(() => "run")
  );

const faultItem = (input: {
  readonly key: ItemKey;
  readonly unit: string;
  readonly name: string;
  readonly detail: ItemDetail;
  readonly failureKind: O.Option<FailureKind>;
  readonly location: O.Option<Location>;
}): Item =>
  Item.make({
    key: input.key,
    unit: input.unit,
    path: [],
    name: input.name,
    outcome: "failed",
    detail: O.some(input.detail),
    failureKind: input.failureKind,
    location: input.location,
  });

const onUnitFaulted = (state: RunState, event: typeof GateEvent.cases.UnitFaulted.Type): RunState =>
  putItem(
    state,
    faultItem({
      key: ItemKey.cases.FaultKey.make({ unit: event.unit, kind: event.kind, name: event.name }),
      unit: event.unit,
      name: event.name,
      detail: event.detail,
      failureKind: O.some(event.kind),
      location: event.location,
    })
  );

const onUnhandled = (state: RunState, event: typeof GateEvent.cases.UnhandledError.Type): RunState => {
  const count = state.unhandled + 1;
  const name = `unhandled error ${count}`;
  return {
    ...putItem(
      state,
      faultItem({
        key: ItemKey.cases.FaultKey.make({ unit: subjectOf(state), kind: "unhandled", name }),
        unit: subjectOf(state),
        name,
        detail: event.detail,
        failureKind: O.some("unhandled"),
        location: event.location,
      })
    ),
    unhandled: count,
  };
};

const onLabelled = (state: RunState, event: typeof GateEvent.cases.ItemLabelled.Type): RunState => ({
  ...state,
  items: HashMap.modify(state.items, fingerprint(event.key), (entry) => ({
    order: entry.order,
    value: Item.make({ ...entry.value, label: O.some(event.label) }),
  })),
});

const onUnitFinished = (state: RunState, event: typeof GateEvent.cases.UnitFinished.Type): RunState => ({
  ...state,
  units: HashMap.modify(state.units, event.unit, (entry) => ({
    order: entry.order,
    value: Unit.make({ ...entry.value, durationMs: O.some(event.durationMs) }),
  })),
});

const onUnitQueued = (state: RunState, unit: Unit): RunState =>
  HashMap.has(state.units, unit.id) ? state : { ...state, units: upsert(state.units, unit.id, unit) };

const addCollected = (state: RunState, items: number): RunState => ({
  ...state,
  collected: O.some(
    pipe(
      state.collected,
      O.getOrElse(() => 0)
    ) + items
  ),
});

const step = (state: RunState, event: GateEvent): RunState =>
  GateEvent.match(event, {
    RunStarted: (start) => ({ ...emptyState, start: O.some(start) }),
    UnitQueued: (queued) => onUnitQueued(state, queued.unit),
    UnitStarted: () => state,
    UnitCollected: (collected) => addCollected(state, collected.items),
    UnitFinished: (finished) => onUnitFinished(state, finished),
    UnitFaulted: (faulted) => onUnitFaulted(state, faulted),
    ItemStarted: () => state,
    ItemFinished: (finished) => placeItem(state, finished.item),
    ItemLabelled: (labelled) => onLabelled(state, labelled),
    UnhandledError: (unhandled) => onUnhandled(state, unhandled),
    PolicyBreached: (breached) => ({ ...state, breaches: A.append(state.breaches, breached.breach) }),
    StrayOutputCaptured: (captured) => ({ ...state, strayOutput: O.some(captured.strayOutput) }),
    RunCancelled: () => ({ ...state, cancelled: true }),
    RunFinished: (finish) => ({ ...state, finish: O.some(finish) }),
  });

const cancelledFinish = GateEvent.cases.RunFinished.make({ durationMs: 0, reason: "cancelled" });

const finishOf = (state: RunState): O.Option<RunFinished> =>
  state.cancelled ? O.orElse(state.finish, () => O.some(cancelledFinish)) : state.finish;

const toolReportedFailure = (finish: RunFinished): boolean =>
  !RunReason.is.passed(finish.reason) || O.exists(finish.exitCode, (code) => code !== 0);

const hasFailedItem = (items: ReadonlyArray<Item>): boolean =>
  A.some(items, (item) => ItemOutcome.is.failed(item.outcome));

const isCancelled = (state: RunState, finish: RunFinished): boolean =>
  state.cancelled || RunReason.is.cancelled(finish.reason);

const fallbackMessage = (finish: RunFinished): string =>
  pipe(
    finish.exitCode,
    O.map((code) => `the tool exited with code ${code} and reported no failed item`),
    O.getOrElse(() => `the tool reported ${finish.reason} and no failed item`)
  );

const erroredFallback = (subject: string, finish: RunFinished): Item =>
  faultItem({
    key: ItemKey.cases.FaultKey.make({ unit: subject, kind: "unhandled", name: "errored" }),
    unit: subject,
    name: "errored",
    detail: ItemDetail.make({
      message: pipe(
        finish.logExcerpt,
        O.getOrElse(() => fallbackMessage(finish))
      ),
    }),
    failureKind: O.none(),
    location: O.none(),
  });

const needsFallback = (state: RunState, finish: RunFinished, items: ReadonlyArray<Item>): boolean =>
  !isCancelled(state, finish) && !hasFailedItem(items) && toolReportedFailure(finish);

const collectedOf = (state: RunState, finish: RunFinished, items: ReadonlyArray<Item>): number =>
  pipe(
    finish.collected,
    O.orElse(() => state.collected),
    O.getOrElse(() => A.filter(items, (item) => !ItemKey.guards.FaultKey(item.key)).length)
  );

const settledReason = (input: {
  readonly cancelled: boolean;
  readonly errored: boolean;
  readonly items: ReadonlyArray<Item>;
}): RunReason => {
  if (input.cancelled) return "cancelled";
  if (input.errored) return "errored";
  return hasFailedItem(input.items) ? "failed" : "passed";
};

const settle = (state: RunState, start: RunStarted, finish: RunFinished): GateReport => {
  const recorded = ordered(state.items);
  const fallback = needsFallback(state, finish, recorded);
  const items = fallback ? A.append(recorded, erroredFallback(subjectOf(state), finish)) : recorded;
  const collected = collectedOf(state, finish, items);
  const errored = fallback || collected === 0 || RunReason.is.errored(finish.reason);
  const reason = settledReason({ cancelled: isCancelled(state, finish), errored, items });
  const totals = tally({ items, collected, durationMs: finish.durationMs });
  const policy = A.isReadonlyArrayNonEmpty(state.breaches)
    ? PolicyRenderState.makeOption({ breaches: state.breaches })
    : O.none();
  return GateReport.make({
    gate: start.gate,
    subject: start.subject,
    itemKind: start.itemKind,
    runId: start.runId,
    startedAt: start.startedAt,
    durationMs: finish.durationMs,
    inputFingerprint: start.inputFingerprint,
    head: start.head,
    branch: start.branch,
    reason,
    outcome: classifyOutcome({ reason, totals, policy }),
    units: ordered(state.units),
    items,
    totals,
    policy,
    strayOutput: state.strayOutput,
  });
};

const incomplete = (message: string): IncompleteRunError => IncompleteRunError.make({ message });

/**
 * Reduce the events of one gate run to its report.
 *
 * **Details**
 *
 * A `RunStarted` resets everything before it, so a watch-mode rerun reduces
 * into a clean report. Items are keyed by their {@link ItemKey}: a second
 * `ItemFinished` for the same key replaces the first and keeps its position,
 * so a retried test is one item. Diagnostics are the exception that keeps
 * count: a diagnostic whose key was already seen at a different location in
 * this run is a distinct occurrence and gets the next `occurrence` ordinal
 * (2, 3, ...); the same key at the same location replaces in place. The
 * reducer assigns ordinals and ignores any an adapter supplied.
 * A `RunCancelled` ends the run even when no `RunFinished` follows.
 *
 * **Example** (Reduce an empty run)
 *
 * ```ts
 * import { GateEvent } from "@beep/gate-report/GateEvent";
 * import { reduceEvents } from "@beep/gate-report/Reducer";
 * import * as DateTime from "effect/DateTime";
 * import * as Result from "effect/Result";
 *
 * const result = reduceEvents([
 *   GateEvent.cases.RunStarted.make({
 *     runId: "r1", gate: "test", subject: "@beep/glob", itemKind: "test",
 *     startedAt: DateTime.makeUnsafe(0), inputFingerprint: "x",
 *   }),
 *   GateEvent.cases.RunFinished.make({ durationMs: 3, reason: "passed" }),
 * ]);
 * console.log(Result.isSuccess(result) && result.success.reason); // errored
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const reduceEvents = (events: ReadonlyArray<GateEvent>): Result.Result<GateReport, IncompleteRunError> => {
  const state = A.reduce(events, emptyState, step);
  return pipe(
    state.start,
    Result.fromOption(() => incomplete("the events hold no RunStarted")),
    Result.flatMap((start) =>
      pipe(
        finishOf(state),
        Result.fromOption(() => incomplete("the events hold no RunFinished or RunCancelled")),
        Result.map((finish) => settle(state, start, finish))
      )
    )
  );
};
