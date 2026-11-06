/**
 * Live cleaner registry joining owned values, native Python hashes and captured
 * host protocols. Dispatch order adapts eyecite 2.7.6 clean.py (BSD-2-Clause);
 * dictionary behavior is the attributed CPython backend. See notices.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { CitationBuiltinCleaners } from "./BuiltinCleaners.ts";
import { CitationCleanerFailure, CitationCleanerRuntime, CitationLiveCleanerObject } from "./CleanerPipeline.ts";
import { CitationBuiltinCleanerName, CitationCleanerValues } from "./CleanerValues.ts";
import { makeCitationPythonHash } from "./PythonHash.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  makeCitationRuntimeDictionary,
} from "./RuntimeDictionary.ts";
import type {
  CitationCleanerCursor,
  CitationCleanerObject,
  CitationCleanerProduced,
  CitationCleanerWork,
} from "./CleanerPipeline.ts";
import type { CitationPythonHashFailure } from "./PythonHash.ts";

const crossPrimitiveKinds = (leftText: boolean, rightText: boolean, leftBytes: boolean, rightBytes: boolean) =>
  (leftText && rightBytes) || (rightText && leftBytes);
const $I = $LawPracticeServerId.create("internal/Citation/CleanerRegistry");
const Limits = S.toType(CitationEngineLimits);
const Hash = S.toType(CitationRuntimeDictionaryKey.fields.hash);
const RegistryEntry = S.Tuple([
  CitationLiveCleanerObject,
  CitationLiveCleanerObject,
  S.Option(CitationBuiltinCleanerName),
]).pipe(
  $I.annoteSchema("RegistryEntry", {
    description:
      "Ordered live key/value handles and the owner's builtin-function classification; not a persisted registry record.",
  })
);
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
const invalidInput = () => fail("invalid-input");
const unissuedValue = () => fail("unissued-value");
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "clean", limit: "resolutionIterations" });
/**
 * Trusted server object protocols. Hash/equality include Python reflection,
 * NotImplemented and truth evaluation in the adapter; subclasses use this path.
 * Callbacks retain state and must reserve before creating text. Requests carry
 * only plan selectors; all functions are captured here with R = never.
 * @internal @category services @since 0.0.0
 */
export class CitationCleanerProtocols extends Context.Service<
  CitationCleanerProtocols,
  {
    readonly hash: (value: CitationCleanerObject) => Effect.Effect<bigint, Failure>;
    readonly equal: (left: CitationCleanerObject, right: CitationCleanerObject) => Effect.Effect<boolean, Failure>;
    readonly callable: (value: CitationCleanerObject, work: CitationCleanerWork) => Effect.Effect<boolean, Failure>;
    readonly invoke: (
      callable: CitationCleanerObject,
      value: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerProduced, Failure>;
    readonly open: (
      plan: string,
      initial: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerCursor, Failure>;
  }
>()($I`CitationCleanerProtocols`) {}
/**
 * Capture one value owner, builtin dispatcher and host adapter. Registry entries
 * retain original key/value handles; query-only handles are released at return.
 * The owner has a bounded lifetime probe budget, independent of each pipeline's
 * output ledger. Same-fiber comparison/hash mutation is serialized reentrantly;
 * detached/forked callback mutation is outside this trusted protocol contract.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCleanerRegistry = Effect.fn("Citation.makeCleanerRegistry")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(invalidInput));
  const values = yield* CitationCleanerValues;
  const builtins = yield* CitationBuiltinCleaners;
  const protocols = yield* CitationCleanerProtocols;
  const hashes = yield* makeCitationPythonHash(limits).pipe(Effect.mapError(() => fail("runtime-failed")));
  const clock = yield* Clock.Clock;
  const cleanMillis = Duration.toMillis(limits.cleanDeadline);
  const operationMillis = Duration.toMillis(limits.operationDeadline);
  const deadline = Duration.millis(cleanMillis <= operationMillis ? cleanMillis : operationMillis);
  const deadlineLimit = cleanMillis <= operationMillis ? "cleanDeadline" : "operationDeadline";
  const translateHashFailure = (error: CitationPythonHashFailure): Failure =>
    error.reason === "deadline-exceeded"
      ? CitationSafetyLimitExceeded.make({ operation: "clean", limit: deadlineLimit })
      : fail("runtime-failed");
  const maximum = limits.resolutionIterations;
  let remaining = maximum;
  let closed = false;
  let refs = HashMap.empty<number, CitationCleanerObject>();
  let functions = HashMap.empty<number, CitationBuiltinCleanerName>();
  let active = A.empty<CitationCleanerObject>();
  let callbackFailure = O.none<Failure>();
  const mutex = yield* Semaphore.make(1);
  let owner = O.none<number>();
  const ensureOpen = Effect.suspend(() => (closed ? Effect.fail(fail("closed-owner")) : Effect.void));
  const step = Effect.suspend(() => {
    if (remaining <= 0) return Effect.fail(exceeded());
    remaining--;
    return Effect.yieldNow;
  });
  const lookup = (id: number) => Effect.fromOption(HashMap.get(refs, id), unissuedValue);
  const capture = <T>(effect: Effect.Effect<T, Failure>) =>
    effect.pipe(
      Effect.mapError((error) => {
        callbackFailure = O.some(error);
        return CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" });
      })
    );
  const exact = Effect.fn("Citation.registryExactUnicode")(function* (id: number) {
    const ref = yield* lookup(id);
    const text = yield* values.getText(ref);
    if (O.isNone(text) || text.value.subtype !== "plain") return O.none();
    const citationResult1 = yield* values.getUnicode(ref);
    return O.map(citationResult1, (value) => value.storage);
  });
  const equalBytes = Effect.fn("Citation.registryEqualBytes")(function* (left: Uint8Array, right: Uint8Array) {
    if (left.byteLength !== right.byteLength) return false;
    for (let index = 0; index < left.byteLength; index++) {
      if (index % 4096 === 0) yield* step;
      if (left[index] !== right[index]) return false;
    }
    return true;
  });
  const equal = Effect.fn("Citation.registryEqual")(function* (left: number, right: number) {
    const a = yield* lookup(left);
    const b = yield* lookup(right);
    const aText = yield* values.getText(a);
    const bText = yield* values.getText(b);
    const aPlain = O.exists(aText, (text) => text.subtype === "plain");
    const bPlain = O.exists(bText, (text) => text.subtype === "plain");
    // General tables retain primitive equality after conversion. Subclasses
    // and other host values still use reflected adapter protocols.
    if (aPlain && bPlain) {
      const citationResult2 = yield* values.getUnicode(a);
      const x = yield* Effect.fromOption(citationResult2, unissuedValue);
      const citationResult3 = yield* values.getUnicode(b);
      const y = yield* Effect.fromOption(citationResult3, unissuedValue);
      return x.storage.width === y.storage.width && (yield* equalBytes(x.storage.bytes, y.storage.bytes));
    }
    const aBytes = yield* values.getBytes(a);
    const bBytes = yield* values.getBytes(b);
    if (O.isSome(aBytes) && O.isSome(bBytes)) return yield* equalBytes(aBytes.value, bBytes.value);
    if (crossPrimitiveKinds(aPlain, bPlain, O.isSome(aBytes), O.isSome(bBytes))) return false;
    return yield* protocols.equal(a, b);
  });
  const table = yield* makeCitationRuntimeDictionary({ entries: limits.authorities, iterations: maximum }).pipe(
    Effect.provideService(CitationRuntimeDictionaryComparison, {
      exactUnicode: (id) => capture(exact(id)),
      equal: (a, b) => capture(equal(a, b)),
      step: capture(step),
    }),
    Effect.mapError(invalidInput)
  );
  const translate = (error: CitationRuntimeDictionaryFailure): Failure =>
    O.getOrElse(callbackFailure, () =>
      error.reason === "limit-exceeded"
        ? CitationSafetyLimitExceeded.make({ operation: "clean", limit: "authorities" })
        : fail("runtime-failed")
    );
  const prune = Effect.gen(function* () {
    const entries = yield* table.read;
    let retained = HashMap.empty<number, CitationCleanerObject>();
    for (const ref of active) retained = HashMap.set(retained, ref.slot, ref);
    const retain = (id: number) => {
      const ref = HashMap.get(refs, id);
      if (O.isSome(ref)) retained = HashMap.set(retained, id, ref.value);
    };
    let index = 0;
    for (const entry of entries) {
      if (index++ % 4096 === 0) yield* Effect.yieldNow;
      for (const id of [entry.objectId, entry.value]) retain(id);
    }
    refs = retained;
  });
  const serial = <T, E>(body: Effect.Effect<T, E>) =>
    Effect.withFiber((fiber) =>
      Effect.suspend(() =>
        O.isSome(owner) && owner.value === fiber.id
          ? body
          : mutex
              .withPermit(
                Effect.acquireUseRelease(
                  // timeout runs its body in a child fiber. Capture that actual owner
                  // inside acquisition so direct hash/equality reentry never deadlocks.
                  Effect.withFiber((running) =>
                    Effect.sync(() => {
                      owner = O.some(running.id);
                    })
                  ),
                  () => body,
                  () =>
                    Effect.sync(() => {
                      owner = O.none();
                    })
                )
              )
              .pipe(
                Effect.timeoutOrElse({
                  duration: deadline,
                  orElse: () =>
                    Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: deadlineLimit })),
                })
              )
      )
    ).pipe(Effect.provideService(Clock.Clock, clock));
  const withKey = <T>(
    key: CitationCleanerObject,
    body: (key: CitationRuntimeDictionaryKey) => Effect.Effect<T, Failure>
  ) =>
    serial(
      Effect.gen(function* () {
        yield* ensureOpen;
        yield* values.assertOwned(key);
        yield* step;
        const previous = active;
        const previousFailure = callbackFailure;
        return yield* Effect.acquireUseRelease(
          Effect.sync(() => {
            active = A.append(active, key);
            refs = HashMap.set(refs, key.slot, key);
            callbackFailure = O.none();
          }),
          Effect.fnUntraced(function* () {
            const text = yield* values.getText(key);
            const bytes = yield* values.getBytes(key);
            const hash =
              O.isSome(text) && text.value.subtype === "plain"
                ? yield* hashes
                    .unicode(
                      (yield* values
                        .getUnicode(key)
                        .pipe(Effect.flatMap((unicode) => Effect.fromOption(unicode, unissuedValue)))).storage
                    )
                    .pipe(Effect.mapError(translateHashFailure))
                : O.isSome(bytes)
                  ? yield* hashes.bytes(bytes.value).pipe(Effect.mapError(translateHashFailure))
                  : yield* protocols.hash(key);
            const normalized = yield* S.decodeEffect(Hash)(hash).pipe(Effect.mapError(() => fail("callback-failed")));
            return yield* body(CitationRuntimeDictionaryKey.make({ objectId: key.slot, hash: normalized }));
          }),
          () =>
            Effect.sync(() => {
              active = previous;
              callbackFailure = previousFailure;
            }).pipe(Effect.andThen(prune))
        );
      })
    );
  const getEntry = (key: CitationCleanerObject) =>
    withKey(key, (hashed) => table.get(hashed).pipe(Effect.mapError(translate)));
  const set = (key: CitationCleanerObject, value: CitationCleanerObject) =>
    serial(
      Effect.gen(function* () {
        yield* values.assertOwned(value);
        // Protect the value across reentrant hash/equality callbacks and pruning.
        const previous = active;
        return yield* Effect.acquireUseRelease(
          Effect.sync(() => {
            active = A.append(active, value);
            refs = HashMap.set(refs, value.slot, value);
          }),
          () => withKey(key, (hashed) => table.set(hashed, value.slot).pipe(Effect.mapError(translate), Effect.asVoid)),
          () =>
            Effect.sync(() => {
              active = previous;
            }).pipe(Effect.andThen(prune))
        );
      })
    );
  for (const name of CitationBuiltinCleanerName.literals) {
    const key = yield* values.builtinName(name);
    const fn = yield* values.retainHost(name);
    functions = HashMap.set(functions, fn.slot, name);
    yield* set(key, fn);
  }
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      closed = true;
      refs = HashMap.empty();
      functions = HashMap.empty();
      active = [];
    }).pipe(Effect.andThen(table.clear))
  );
  const checkWork = (work: CitationCleanerWork) =>
    work.snapshot.pipe(Effect.flatMap((snapshot) => (snapshot.closed ? Effect.fail(fail("closed-work")) : ensureOpen)));
  const runtime = CitationCleanerRuntime.of({
    fromText: Effect.fn("Citation.registrySource")((text) => ensureOpen.pipe(Effect.andThen(values.sourceText(text)))),
    assertOwned: Effect.fn("Citation.registryAssertOwned")((value) =>
      ensureOpen.pipe(Effect.andThen(values.assertOwned(value)))
    ),
    textUnits: Effect.fn("Citation.registryTextUnits")((value) => values.getUnicodeUnits(value)),
    open: Effect.fn("Citation.registryOpen")((plan, initial, work) =>
      checkWork(work).pipe(Effect.andThen(protocols.open(plan, initial, work)))
    ),
    contains: Effect.fn("Citation.registryContains")((key, work) =>
      checkWork(work).pipe(Effect.andThen(getEntry(key)), Effect.map(O.isSome))
    ),
    get: Effect.fn("Citation.registryGet")((key, work) =>
      checkWork(work).pipe(
        Effect.andThen(
          withKey(key, (hashed) =>
            table.get(hashed).pipe(
              Effect.mapError(translate),
              Effect.flatMap((entry) =>
                O.isSome(entry) ? lookup(entry.value.value) : Effect.fail(fail("lookup-key-missing"))
              )
            )
          )
        )
      )
    ),
    callable: Effect.fn("Citation.registryCallable")(function* (value, work) {
      yield* checkWork(work);
      yield* values.assertOwned(value);
      if (HashMap.has(functions, value.slot)) return true;
      const text = yield* values.getText(value);
      if (O.isSome(text) && text.value.subtype === "plain") return false;
      const citationResult4 = yield* values.getBytes(value);
      if (O.isSome(citationResult4)) return false;
      return yield* protocols.callable(value, work);
    }),
    invoke: Effect.fn("Citation.registryInvoke")(function* (fn, value, work) {
      yield* checkWork(work);
      yield* values.assertOwned(fn);
      yield* values.assertOwned(value);
      const builtin = HashMap.get(functions, fn.slot);
      if (O.isSome(builtin)) return yield* builtins.invoke(builtin.value, value, work);
      const text = yield* values.getText(fn);
      if ((O.isSome(text) && text.value.subtype === "plain") || (yield* values.getBytes(fn).pipe(Effect.map(O.isSome))))
        return yield* fail("not-callable");
      return yield* protocols.invoke(fn, value, work);
    }),
  });
  return {
    runtime,
    /** Bounded insertion-order inspection retains actual key/value identities and invokes no host hash/equality hooks. */
    read: serial(
      Effect.gen(function* () {
        yield* ensureOpen;
        yield* step;
        const entries = yield* table.read;
        let result = Chunk.empty<typeof RegistryEntry.Type>();
        for (const entry of entries) {
          yield* step;
          const key = yield* lookup(entry.objectId);
          const value = yield* lookup(entry.value);
          result = Chunk.append(result, RegistryEntry.make([key, value, HashMap.get(functions, value.slot)]));
        }
        return A.fromIterable(result);
      })
    ),
    set,
    remove: (key: CitationCleanerObject) =>
      withKey(key, (hashed) =>
        table.remove(hashed).pipe(Effect.mapBoth({ onFailure: translate, onSuccess: O.isSome }))
      ),
    clear: serial(ensureOpen.pipe(Effect.andThen(table.clear), Effect.andThen(prune))),
  };
});
