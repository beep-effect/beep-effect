/**
 * Scoped cleaner value issuance. Text allocation follows the pinned CPython
 * SRE/Unicode rules; host values remain captured runtime capabilities.
 * See THIRD_PARTY_NOTICES.md for Free Law Project and PSF attribution.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { CitationCleanerFailure, CitationCleanerObject } from "./CleanerPipeline.ts";
import { CitationCleanerTextDescriptor, CitationCleanerTextOutput } from "./CleanerTextIdentity.ts";

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
 * R = never. This is value ownership, not a Python registry/protocol evaluator.
 * @internal @category services @since 0.0.0
 */
export class CitationCleanerValues extends Context.Service<
  CitationCleanerValues,
  {
    readonly text: (input: unknown) => Effect.Effect<CitationCleanerObject, CitationCleanerFailure>;
    readonly subclass: (input: unknown, host: unknown) => Effect.Effect<CitationCleanerObject, CitationCleanerFailure>;
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
    ) => Effect.Effect<CitationCleanerObject, CitationCleanerFailure>;
    readonly snapshot: Effect.Effect<CitationCleanerValueSnapshot>;
  }
>()($I`CitationCleanerValues`) {}

// These entries hold live host capabilities; they are not data/wire models.
type Value =
  | {
      readonly kind: "text";
      readonly text: string;
      readonly subtype: CitationCleanerTextDescriptor["subtype"];
      readonly host: unknown;
    }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array }
  | { readonly kind: "host"; readonly host: unknown };
type Entry = Value & { readonly slot: number };
const SlotDescriptor = S.Struct({ value: S.Natural });
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
/**
 * Capture the owning Scope. Weak issuance keys preserve retained references
 * across operations without making the arena retain every result. Only empty
 * and replacement-space text have strong, bounded caches. Closure invalidates
 * all capabilities and drops every arena-held value without inspecting hosts.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCleanerValues = Effect.fn("Citation.makeCleanerValues")(function* () {
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
      return mint({ kind: "text", text: kind === "empty" ? "" : " ", subtype: "plain", host: undefined }, (ref) => {
        if (kind === "empty") empty = O.some(ref);
        else space = O.some(ref);
      });
    });
  const fresh = (text: string): Effect.Effect<CitationCleanerObject, CitationCleanerFailure> =>
    Str.length(text) === 0
      ? cached("empty")
      : Effect.suspend(() => mint({ kind: "text", text, subtype: "plain", host: undefined }, () => {}));
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
  return CitationCleanerValues.of({
    text: Effect.fn("Citation.issueCleanerText")(function* (input) {
      if (closed) return yield* fail("closed-owner");
      const text = yield* S.decodeUnknownEffect(CitationCleanerTextDescriptor.fields.text)(input).pipe(
        Effect.mapError(() => fail("invalid-input"))
      );
      return yield* fresh(text);
    }),
    subclass: Effect.fn("Citation.issueCleanerSubclass")(function* (input, host) {
      if (closed) return yield* fail("closed-owner");
      const text = yield* S.decodeUnknownEffect(CitationCleanerTextDescriptor.fields.text)(input).pipe(
        Effect.mapError(() => fail("invalid-input"))
      );
      return yield* Effect.suspend(() => mint({ kind: "text", text, subtype: "subclass", host }, () => {}));
    }),
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
            ? O.some(CitationCleanerTextDescriptor.make({ text: entry.text, subtype: entry.subtype }))
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
    materialize: Effect.fn("Citation.materializeCleanerText")(function* (input, output) {
      const entry = yield* get(input);
      const result = yield* S.decodeUnknownEffect(CitationCleanerTextOutputType)(output).pipe(
        Effect.mapError(() => fail("invalid-text-allocation"))
      );
      return yield* Match.value(result.allocation).pipe(
        Match.when("empty", () =>
          result.text === "" ? cached("empty") : Effect.fail(fail("invalid-text-allocation"))
        ),
        Match.when("space", () =>
          result.text === " " ? cached("space") : Effect.fail(fail("invalid-text-allocation"))
        ),
        Match.when("fresh", () =>
          Str.length(result.text) > 0 ? fresh(result.text) : Effect.fail(fail("invalid-text-allocation"))
        ),
        Match.when("unchanged", () =>
          entry.kind !== "text" || result.text !== entry.text
            ? Effect.fail(fail("invalid-text-allocation"))
            : entry.subtype === "plain"
              ? Effect.succeed(input)
              : fresh(result.text)
        ),
        Match.exhaustive
      );
    }),
    snapshot: Effect.sync(() =>
      CitationCleanerValueSnapshot.make({
        issued: next,
        cached: (O.isSome(empty) ? 1 : 0) + (O.isSome(space) ? 1 : 0),
        closed,
      })
    ),
  });
});
