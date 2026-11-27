/**
 * Turn a finished Vitest run into gate events, ported from upstream
 * `packages/ui/src/synthesize.ts` with the module and suite failure rules of
 * `packages/sdk/src/utils/build-report.ts`: every test is an item keyed by
 * its file and full name (a repeated full name numbered), each error of a
 * module that failed to load or whose hook threw is a unit fault, an
 * unhandled error is its own item, and Vitest's reason is the tool's
 * reason. The model's reducer applies the honest-count rules.
 *
 * @since 0.0.0
 */
import { plural } from "@beep/gate-report/Format";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { ItemOutcome, RunReason } from "@beep/gate-report/Vocabulary";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { errorDetail, messageOf, readField } from "./ErrorText.ts";
import { errorSignature, failureLocation, topFrame } from "./TopFrame.ts";
import type { Location } from "@beep/gate-report/Item";
import type { StrayOutput } from "@beep/gate-report/StrayOutput";
import type * as DateTime from "effect/DateTime";
import type { VitestError, VitestModule, VitestSuite, VitestTestCase } from "./VitestShapes.ts";

type VitestParent = VitestTestCase["parent"];

/**
 * The item name of a module that failed before any test was collected.
 *
 * @since 0.0.0
 */
export const SUITE_LOAD_FAILURE_LABEL = "test suite failed to load";

/**
 * The item name of a module that loaded and collected tests but whose hook
 * threw.
 *
 * @since 0.0.0
 */
export const SUITE_FAILURE_LABEL = "test suite failed";

type SynthesisInput = {
  readonly runId: string;
  readonly gate: string;
  readonly subject: string;
  readonly root: string;
  readonly startedAt: DateTime.Utc;
  readonly durationMs: number;
  readonly inputFingerprint: string;
  readonly modules: ReadonlyArray<VitestModule>;
  readonly unhandledErrors: ReadonlyArray<VitestError>;
  readonly reason: string;
  readonly strayOutput: O.Option<StrayOutput>;
};

const TIMEOUT_MESSAGE = /\btimed out in \d+\s*ms/iu;
const TIMEOUT_NAME = /timeout/iu;

/**
 * True when an error looks like a Vitest test or hook timeout: its message
 * says "timed out in Nms" or its name contains "timeout".
 *
 * @since 0.0.0
 */
export const isTimeoutError = (error: VitestError): boolean =>
  TIMEOUT_MESSAGE.test(messageOf(error)) ||
  O.exists(
    readField(() => error.name),
    (name) => TIMEOUT_NAME.test(name)
  );

/**
 * A Vitest state as an item outcome: `passed`, `failed` and `skipped` keep
 * their name; `pending`, `todo`, `queued` and anything unknown are
 * `skipped`.
 *
 * @since 0.0.0
 */
export const normalizeState = (state: string | undefined): ItemOutcome =>
  pipe(
    O.fromNullishOr(state),
    O.filter(ItemOutcome.is.passed),
    O.orElse(() => O.filter(O.fromNullishOr(state), ItemOutcome.is.failed)),
    O.getOrElse((): ItemOutcome => "skipped")
  );

/**
 * Vitest's run end reason as a run reason: `interrupted` is `cancelled`,
 * and anything Vitest may add later is `failed`.
 *
 * @since 0.0.0
 */
export const runReasonOf = (reason: string): RunReason =>
  reason === "interrupted"
    ? "cancelled"
    : pipe(
        O.liftPredicate(reason, RunReason.is.passed),
        O.getOrElse((): RunReason => "failed")
      );

const guarded = <A>(read: () => A, fallback: A): A => Result.getOrElse(Result.try(read), () => fallback);

const isSuite = (parent: VitestParent): parent is VitestSuite => P.isNotUndefined(parent) && parent.type === "suite";

const suitePath = (parent: VitestParent, inner: ReadonlyArray<string> = []): ReadonlyArray<string> =>
  isSuite(parent) ? suitePath(parent.parent, [parent.name, ...inner]) : inner;

const attemptsOf = (test: VitestTestCase): O.Option<A.NonEmptyReadonlyArray<ItemOutcome>> => {
  const outcomes = A.map(
    guarded(() => test.attempts?.() ?? [], []),
    (attempt) => normalizeState(attempt.state)
  );
  return A.isReadonlyArrayNonEmpty(outcomes) && outcomes.length > 1 ? O.some(outcomes) : O.none();
};

const locationOf = (root: string, error: VitestError) => O.flatMap(topFrame(error), failureLocation(root));

const testItem =
  (root: string, file: string) =>
  (test: VitestTestCase, fullName: string): Item => {
    const result = O.fromNullishOr(guarded(() => test.result(), undefined));
    const outcome = pipe(
      result,
      O.map((value) => value.state),
      O.getOrUndefined,
      normalizeState
    );
    const first = pipe(
      result,
      O.flatMap((value) => A.head(value.errors ?? []))
    );
    const failure = O.filter(first, () => ItemOutcome.is.failed(outcome));
    return Item.make({
      key: ItemKey.cases.TestKey.make({ file, fullName }),
      unit: file,
      path: suitePath(test.parent),
      name: test.name,
      outcome,
      detail: O.map(first, errorDetail),
      failureKind: O.map(failure, (error) => (isTimeoutError(error) ? "timeout" : "assertion")),
      location: O.flatMap(failure, (error) => locationOf(root, error)),
      signature: O.flatMap(failure, errorSignature),
      attempts: attemptsOf(test),
      durationMs: O.map(O.fromNullishOr(guarded(() => test.diagnostic(), undefined)), (diag) => diag.duration),
    });
  };

const freeName = (taken: HashSet.HashSet<string>, fullName: string, ordinal = 1): string => {
  const candidate = ordinal === 1 ? fullName : `${fullName} (${ordinal})`;
  return HashSet.has(taken, candidate) ? freeName(taken, fullName, ordinal + 1) : candidate;
};

/**
 * The full name each test of one module is keyed by. Vitest accepts two
 * tests with one title, so a repeated full name gets ` (2)`, ` (3)` and so
 * on in collection order, and every test stays its own item. The first keeps
 * the plain name, so its key and history stay as they were.
 *
 * @since 0.0.0
 */
export const keyedNames = (fullNames: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.mapAccum(fullNames, HashSet.empty<string>(), (taken, fullName) => {
    const name = freeName(taken, fullName);
    return [HashSet.add(taken, name), name];
  })[1];

/**
 * The most unit faults one module records. Errors past it are counted in
 * the last recorded fault's message.
 *
 * @since 0.0.0
 */
export const MAX_UNIT_FAULTS = 10;

const faultName = (label: string, index: number): string => (index === 0 ? label : `${label} (${index + 1})`);

const withDropped = (detail: ItemDetail, dropped: number): ItemDetail =>
  dropped === 0
    ? detail
    : ItemDetail.make({
        ...detail,
        message: `${detail.message}\n${plural({ count: dropped, one: "more error", other: "more errors" })} in this module not recorded`,
      });

const NO_ERROR = errorDetail({ message: "the module failed without an error" });

const unitFaults = (input: {
  readonly root: string;
  readonly unit: string;
  readonly collected: boolean;
  readonly errors: ReadonlyArray<VitestError>;
}): A.NonEmptyReadonlyArray<GateEvent> => {
  const kind = input.collected ? "hook" : "load";
  const label = input.collected ? SUITE_FAILURE_LABEL : SUITE_LOAD_FAILURE_LABEL;
  const fault = (detail: ItemDetail, location: O.Option<Location>, index: number) =>
    GateEvent.cases.UnitFaulted.make({ unit: input.unit, kind, name: faultName(label, index), detail, location });
  const kept = A.take(input.errors, MAX_UNIT_FAULTS);
  const dropped = input.errors.length - kept.length;
  return A.isReadonlyArrayNonEmpty(kept)
    ? A.map(kept, (error, index) =>
        fault(
          index === kept.length - 1 ? withDropped(errorDetail(error), dropped) : errorDetail(error),
          locationOf(input.root, error),
          index
        )
      )
    : [fault(NO_ERROR, O.none(), 0)];
};

const suiteErrors = (module: VitestModule): ReadonlyArray<VitestError> =>
  A.flatMap(
    guarded(() => A.fromIterable(module.children.allSuites()), []),
    (suite) => guarded(() => suite.errors?.() ?? [], [])
  );

const anySuiteFailed = (module: VitestModule): boolean =>
  A.some(
    guarded(() => A.fromIterable(module.children.allSuites()), []),
    (suite) => ItemOutcome.is.failed(normalizeState(guarded(() => suite.state(), "pending")))
  );

const moduleFault = (input: {
  readonly root: string;
  readonly module: VitestModule;
  readonly tests: ReadonlyArray<VitestTestCase>;
  readonly items: ReadonlyArray<Item>;
}): ReadonlyArray<GateEvent> => {
  const errors = [...guarded(() => input.module.errors(), []), ...suiteErrors(input.module)];
  const failedState =
    ItemOutcome.is.failed(normalizeState(guarded(() => input.module.state(), "pending"))) ||
    anySuiteFailed(input.module);
  const explained = A.some(input.items, (item) => ItemOutcome.is.failed(item.outcome));
  const faulted = A.isReadonlyArrayNonEmpty(errors) || (failedState && !explained);
  return faulted
    ? unitFaults({
        root: input.root,
        unit: input.module.relativeModuleId,
        collected: A.isReadonlyArrayNonEmpty(input.tests),
        errors,
      })
    : [];
};

const moduleEvents =
  (root: string) =>
  (module: VitestModule): ReadonlyArray<GateEvent> => {
    const unit = module.relativeModuleId;
    const tests = guarded(() => A.fromIterable(module.children.allTests()), []);
    const items = A.zipWith(tests, keyedNames(A.map(tests, (test) => test.fullName)), testItem(root, unit));
    return [
      GateEvent.cases.UnitStarted.make({ unit }),
      GateEvent.cases.UnitCollected.make({ unit, items: tests.length }),
      ...A.map(items, (item) => GateEvent.cases.ItemFinished.make({ item })),
      ...moduleFault({ root, module, tests, items }),
      GateEvent.cases.UnitFinished.make({
        unit,
        durationMs: O.getOrElse(
          O.map(O.fromNullishOr(guarded(() => module.diagnostic(), undefined)), (diag) => diag.duration),
          () => 0
        ),
      }),
    ];
  };

const unhandledEvent =
  (root: string) =>
  (error: VitestError): GateEvent =>
    GateEvent.cases.UnhandledError.make({
      detail: errorDetail(error),
      location: locationOf(root, error),
    });

/**
 * Synthesize the gate events of one finished Vitest run.
 *
 * **Details**
 *
 * The package is the root unit and every test file a unit under it. The
 * events end with Vitest's own reason and no exit code: the reporter cannot
 * see the process exit, and the reducer decides the verdict from the items.
 *
 * A test file fails as a unit when it or one of its suites carries errors (a
 * load failure or a hook throw), with one fault per error up to the bound, or
 * when it or a suite is failed with no failed test to explain it.
 *
 * **Gotchas**
 *
 * Vitest may leave a module green when only a suite entity failed, so suite
 * states are read as well as the module's own.
 *
 * @since 0.0.0
 */
export const synthesizeEvents = (input: SynthesisInput): ReadonlyArray<GateEvent> => [
  GateEvent.cases.RunStarted.make({
    runId: input.runId,
    gate: input.gate,
    subject: input.subject,
    itemKind: "test",
    startedAt: input.startedAt,
    inputFingerprint: input.inputFingerprint,
  }),
  GateEvent.cases.UnitQueued.make({ unit: Unit.make({ id: input.subject, kind: "package" }) }),
  ...A.map(input.modules, (module) =>
    GateEvent.cases.UnitQueued.make({
      unit: Unit.make({ id: module.relativeModuleId, kind: "file", parent: O.some(input.subject) }),
    })
  ),
  ...A.flatMap(input.modules, moduleEvents(input.root)),
  ...A.map(input.unhandledErrors, unhandledEvent(input.root)),
  ...A.map(O.toArray(input.strayOutput), (strayOutput) => GateEvent.cases.StrayOutputCaptured.make({ strayOutput })),
  GateEvent.cases.RunFinished.make({ durationMs: input.durationMs, reason: runReasonOf(input.reason) }),
];
