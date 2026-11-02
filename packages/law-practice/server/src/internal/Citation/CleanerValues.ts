/**
 * Scoped cleaner value issuance. Text allocation follows the pinned CPython
 * SRE/Unicode rules; host values remain captured runtime capabilities.
 * See THIRD_PARTY_NOTICES.md for Free Law Project and PSF attribution.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { CitationCleanerFailure, CitationCleanerObject } from "./CleanerPipeline.ts";
import { CitationCleanerTextDescriptor, CitationCleanerTextOutput } from "./CleanerTextIdentity.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationPythonUnicodeValue, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import type { CitationPythonUnicodeFailure } from "./PythonUnicode.ts";

const Limits = S.toType(CitationEngineLimits);
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;

const CitationCleanerTextOutputType = S.toType(CitationCleanerTextOutput);

const $I = $LawPracticeServerId.create("internal/Citation/CleanerValues");
/** @internal @category models @since 0.0.0 */
export class CitationCleanerValueSnapshot extends S.Opaque<
  CitationCleanerValueSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ issued: S.Natural, cached: S.Natural.check(S.isLessThanOrEqualTo(2)), closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationCleanerValueSnapshot", {
      description: "Lifetime issuance count and two bounded text caches, not retained heap size or source values.",
    })
  )
) {}
/**
 * Captured runtime references, never serialized host payloads. Issuing a text
 * reference does not reserve production: adapters must charge before building
 * text and return the original work tickets. Subclass payloads/host values are
 * retained without reading properties or invoking coercion. Every method has
 * R = never. Native storage is private; getUnicode returns a detached snapshot.
 * getText is only a JavaScript projection. Native producers must use
 * materializeUnicode rather than reconstructing state from that projection.
 * This is value ownership, not a Python registry/protocol evaluator.
 * @internal @category services @since 0.0.0
 */
export class CitationCleanerValues extends Context.Service<
  CitationCleanerValues,
  {
    readonly text: (input: unknown) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly unicode: (input: unknown) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly unicodeSubclass: (input: unknown, host: unknown) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly getUnicode: (
      value: CitationCleanerObject
    ) => Effect.Effect<O.Option<CitationPythonUnicodeValue>, CitationCleanerFailure>;
    readonly subclass: (input: unknown, host: unknown) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly bytes: (input: unknown) => Effect.Effect<CitationCleanerObject, CitationCleanerFailure>;
    readonly getBytes: (value: CitationCleanerObject) => Effect.Effect<O.Option<Uint8Array>, CitationCleanerFailure>;
    readonly retainHost: (host: unknown) => Effect.Effect<CitationCleanerObject, CitationCleanerFailure>;
    readonly getText: (
      value: CitationCleanerObject
    ) => Effect.Effect<O.Option<CitationCleanerTextDescriptor>, CitationCleanerFailure>;
    readonly getHost: (value: CitationCleanerObject) => Effect.Effect<O.Option<unknown>, CitationCleanerFailure>;
    readonly assertOwned: (value: CitationCleanerObject) => Effect.Effect<void, CitationCleanerFailure>;
    readonly same: (
      left: CitationCleanerObject,
      right: CitationCleanerObject
    ) => Effect.Effect<boolean, CitationCleanerFailure>;
    readonly materialize: (
      input: CitationCleanerObject,
      output: unknown
    ) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly materializeUnicode: (
      input: CitationCleanerObject,
      output: unknown,
      storage: unknown
    ) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly snapshot: Effect.Effect<CitationCleanerValueSnapshot>;
  }
>()($I`CitationCleanerValues`) {}

// These entries hold live host capabilities; they are not data/wire models.
type Value =
  | {
      readonly kind: "text";
      readonly unicode: CitationPythonUnicodeValue;
      readonly subtype: CitationCleanerTextDescriptor["subtype"];
      readonly host: unknown;
    }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array }
  | { readonly kind: "host"; readonly host: unknown };
type Entry = Value & { readonly slot: number };
const SlotDescriptor = S.Struct({ value: S.Natural });
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
/**
 * Capture the explicit resource policy, Clock and owning Scope. Weak issuance keys preserve retained references
 * across operations without making the arena retain every result. Only empty
 * and replacement-space text have strong, bounded caches. Closure invalidates
 * all capabilities and drops every arena-held value without inspecting hosts.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCleanerValues = Effect.fn("Citation.makeCleanerValues")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(() => fail("invalid-input")));
  const clock = yield* Clock.Clock;
  const cleanMillis = Duration.toMillis(limits.cleanDeadline);
  const operationMillis = Duration.toMillis(limits.operationDeadline);
  const timeLimit = cleanMillis <= operationMillis ? "cleanDeadline" : "operationDeadline";
  const deadline = Duration.millis(cleanMillis <= operationMillis ? cleanMillis : operationMillis);
  const safety = (limit: "producedTextUtf16" | "cleanDeadline" | "operationDeadline") =>
    CitationSafetyLimitExceeded.make({ operation: "clean", limit });
  const translate = (error: CitationPythonUnicodeFailure): Failure =>
    error.reason === "invalid-input"
      ? fail("invalid-input")
      : safety(error.reason === "limit-exceeded" ? "producedTextUtf16" : timeLimit);
  const unicode = yield* makeCitationPythonUnicode(limits).pipe(Effect.mapError(translate));
  const emptyValue = yield* unicode.fromText("").pipe(Effect.mapError(translate));
  const spaceValue = yield* unicode.fromText(" ").pipe(Effect.mapError(translate));
  const bounded = <A>(body: Effect.Effect<A, Failure>) =>
    body.pipe(
      Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety(timeLimit)) }),
      Effect.provideService(Clock.Clock, clock)
    );
  const scope = yield* Scope.Scope;
  let entries = new WeakMap<CitationCleanerObject, Entry>();
  let empty = O.none<CitationCleanerObject>();
  let space = O.none<CitationCleanerObject>();
  let next = 0;
  let closed = false;
  // Called only inside synchronous Effect.suspend callbacks. Cache publication
  // happens before returning an Effect, so concurrent fibers cannot issue two
  // objects for one cached Python string.
  const mint = (
    value: Value,
    publish: (ref: CitationCleanerObject) => void
  ): Effect.Effect<CitationCleanerObject, CitationCleanerFailure> => {
    if (closed) return Effect.fail(fail("closed-owner"));
    if (next >= 9_007_199_254_740_991) return Effect.fail(fail("identity-exhausted"));
    const ref = Object.freeze(CitationCleanerObject.make({ slot: next++ }));
    entries.set(ref, { ...value, slot: ref.slot });
    publish(ref);
    return Effect.succeed(ref);
  };
  const cached = (kind: "empty" | "space"): Effect.Effect<CitationCleanerObject, CitationCleanerFailure> =>
    Effect.suspend(() => {
      if (closed) return Effect.fail(fail("closed-owner"));
      const current = kind === "empty" ? empty : space;
      if (O.isSome(current)) return get(current.value).pipe(Effect.as(current.value));
      return mint(
        { kind: "text", unicode: kind === "empty" ? emptyValue : spaceValue, subtype: "plain", host: undefined },
        (ref) => {
          if (kind === "empty") empty = O.some(ref);
          else space = O.some(ref);
        }
      );
    });
  const freshUnicode = (
    value: CitationPythonUnicodeValue
  ): Effect.Effect<CitationCleanerObject, CitationCleanerFailure> =>
    Str.length(value.text) === 0
      ? cached("empty")
      : Effect.suspend(() => mint({ kind: "text", unicode: value, subtype: "plain", host: undefined }, () => {}));
  const fresh = Effect.fn("Citation.issueCanonicalCleanerText")((text: string) =>
    unicode.fromText(text).pipe(Effect.mapError(translate), Effect.flatMap(freshUnicode))
  );
  const get = Effect.fn("Citation.getCleanerValue")(function* (ref: CitationCleanerObject) {
    if (closed) return yield* fail("closed-owner");
    const entry = entries.get(ref);
    if (entry === undefined) return yield* fail("unissued-value");
    // Validate the original data property without invoking a substituted getter.
    const descriptor: unknown = Object.getOwnPropertyDescriptor(ref, "slot");
    const slot = yield* S.decodeUnknownEffect(SlotDescriptor)(descriptor).pipe(
      Effect.mapError(() => fail("unissued-value"))
    );
    if (slot.value !== entry.slot) return yield* fail("unissued-value");
    return entry;
  });
  yield* Scope.addFinalizer(
    scope,
    Effect.sync(() => {
      closed = true;
      entries = new WeakMap();
      empty = O.none();
      space = O.none();
    })
  );
  const sameNative = Effect.fn("Citation.sameNativeCleanerText")(function* (
    left: CitationPythonUnicodeValue,
    right: CitationPythonUnicodeValue
  ) {
    if (left.storage.width !== right.storage.width || left.storage.bytes.length !== right.storage.bytes.length)
      return false;
    for (let index = 0; index < left.storage.bytes.length; index++) {
      if (index % 8192 === 0) yield* Effect.yieldNow;
      if (left.storage.bytes[index] !== right.storage.bytes[index]) return false;
    }
    return true;
  });
  const materialize = Effect.fn("Citation.allocateCleanerText")(function* (
    input: CitationCleanerObject,
    output: unknown,
    explicit: O.Option<CitationPythonUnicodeValue>
  ) {
    const entry = yield* get(input);
    const result = yield* S.decodeUnknownEffect(CitationCleanerTextOutputType)(output).pipe(
      Effect.mapError(() => fail("invalid-text-allocation"))
    );
    if (O.isSome(explicit) && explicit.value.text !== result.text) return yield* fail("invalid-text-allocation");
    return yield* Match.value(result.allocation).pipe(
      Match.when("empty", () => (result.text === "" ? cached("empty") : Effect.fail(fail("invalid-text-allocation")))),
      Match.when("space", () => (result.text === " " ? cached("space") : Effect.fail(fail("invalid-text-allocation")))),
      Match.when("fresh", () =>
        Str.length(result.text) === 0
          ? Effect.fail(fail("invalid-text-allocation"))
          : O.isSome(explicit)
            ? freshUnicode(explicit.value)
            : fresh(result.text)
      ),
      Match.when("unchanged", () =>
        Effect.gen(function* () {
          if (entry.kind !== "text" || result.text !== entry.unicode.text)
            return yield* fail("invalid-text-allocation");
          if (O.isSome(explicit) && !(yield* sameNative(entry.unicode, explicit.value)))
            return yield* fail("invalid-text-allocation");
          if (closed) return yield* fail("closed-owner");
          return entry.subtype === "plain" ? input : yield* freshUnicode(entry.unicode);
        })
      ),
      Match.exhaustive
    );
  });
  return CitationCleanerValues.of({
    text: Effect.fn("Citation.issueCleanerText")(function* (input) {
      if (closed) return yield* fail("closed-owner");
      return yield* unicode.fromText(input).pipe(Effect.mapError(translate), Effect.flatMap(freshUnicode));
    }),
    unicode: Effect.fn("Citation.issueNativeCleanerText")(function* (input) {
      if (closed) return yield* fail("closed-owner");
      return yield* unicode.fromStorage(input).pipe(Effect.mapError(translate), Effect.flatMap(freshUnicode));
    }),
    subclass: Effect.fn("Citation.issueCleanerSubclass")(function* (input, host) {
      if (closed) return yield* fail("closed-owner");
      const value = yield* unicode.fromText(input).pipe(Effect.mapError(translate));
      return yield* Effect.suspend(() => mint({ kind: "text", unicode: value, subtype: "subclass", host }, () => {}));
    }),
    unicodeSubclass: Effect.fn("Citation.issueNativeCleanerSubclass")(function* (input, host) {
      if (closed) return yield* fail("closed-owner");
      const value = yield* unicode.fromStorage(input).pipe(Effect.mapError(translate));
      return yield* Effect.suspend(() => mint({ kind: "text", unicode: value, subtype: "subclass", host }, () => {}));
    }),
    getUnicode: Effect.fn("Citation.readNativeCleanerText")((ref) =>
      get(ref).pipe(
        Effect.map((entry) =>
          entry.kind === "text"
            ? O.some(
                CitationPythonUnicodeValue.make({
                  ...entry.unicode,
                  storage: CitationPythonUnicodeStorage.make({
                    width: entry.unicode.storage.width,
                    bytes: new Uint8Array(entry.unicode.storage.bytes),
                  }),
                })
              )
            : O.none()
        )
      )
    ),
    bytes: Effect.fn("Citation.issueCleanerBytes")(function* (input) {
      if (closed) return yield* fail("closed-owner");
      const bytes = yield* S.decodeUnknownEffect(S.Uint8Array)(input).pipe(
        Effect.mapError(() => fail("invalid-input"))
      );
      // Registration captures an already-owned immutable Python-byte value;
      // adapters must not pass mutable bytearray/memoryview representations.
      return yield* Effect.suspend(() => mint({ kind: "bytes", bytes }, () => {}));
    }),
    getBytes: Effect.fn("Citation.readCleanerBytes")((ref) =>
      get(ref).pipe(Effect.map((entry) => (entry.kind === "bytes" ? O.some(entry.bytes) : O.none())))
    ),
    retainHost: Effect.fn("Citation.retainCleanerHost")((host) =>
      Effect.suspend(() => mint({ kind: "host", host }, () => {}))
    ),
    getText: Effect.fn("Citation.readCleanerText")((ref) =>
      get(ref).pipe(
        Effect.map((entry) =>
          entry.kind === "text"
            ? O.some(CitationCleanerTextDescriptor.make({ text: entry.unicode.text, subtype: entry.subtype }))
            : O.none()
        )
      )
    ),
    getHost: Effect.fn("Citation.readCleanerHost")((ref) =>
      get(ref).pipe(
        Effect.map((entry) =>
          entry.kind === "host" || (entry.kind === "text" && entry.subtype === "subclass")
            ? O.some(entry.host)
            : O.none()
        )
      )
    ),
    assertOwned: Effect.fn("Citation.assertCleanerValue")((ref) => get(ref).pipe(Effect.asVoid)),
    same: Effect.fn("Citation.sameCleanerValue")(function* (left, right) {
      yield* get(left);
      yield* get(right);
      return left === right;
    }),
    materialize: Effect.fn("Citation.materializeCleanerText")((input, output) =>
      bounded(materialize(input, output, O.none()))
    ),
    materializeUnicode: Effect.fn("Citation.materializeNativeCleanerText")((input, output, storage) =>
      bounded(
        Effect.gen(function* () {
          yield* get(input);
          const value = yield* unicode.fromStorage(storage).pipe(Effect.mapError(translate));
          return yield* materialize(input, output, O.some(value));
        })
      )
    ),
    snapshot: Effect.sync(() =>
      CitationCleanerValueSnapshot.make({
        issued: next,
        cached: (O.isSome(empty) ? 1 : 0) + (O.isSome(space) ? 1 : 0),
        closed,
      })
    ),
  });
});
