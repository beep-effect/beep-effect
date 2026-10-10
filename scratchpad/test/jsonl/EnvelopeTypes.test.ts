// Restored from upstream EnvelopeTypes.test.ts (MIT). Binary envelope codecs
// take the envelope first and the registry second (lab value-first dual shape).
import { assert, describe, it } from "@effect/vitest";
import type * as DateTime from "effect/DateTime";
import type * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import type * as Stream from "effect/Stream";
import type {
  Envelope as EnvelopeType,
  EnvelopeUnion,
  EnvelopeWithTag,
  JournalShape,
  JsonlEvent as JsonlEventType,
} from "../../effected/jsonl/index.ts";
import { Envelope, Journal, JsonlEvent } from "../../effected/jsonl/index.ts";

/**
 * The assertions in this file are COMPILE-TIME. `types:check` is what runs
 * them; the single runtime test at the bottom exists so the file registers as
 * a test and its failure mode is visible in the suite rather than only in the
 * build. A `@ts-expect-error` that stops erroring FAILS the typecheck, so each
 * one is a live assertion, not a comment.
 */

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Expected extends true>(): void => {};

// ── the registry under test ─────────────────────────────────────────────────

const MailReceived = JsonlEvent.make("mail-received", {
  data: S.Struct({ round: S.Finite, from: S.String }),
});
const Unlinked = JsonlEvent.make("unlinked", { data: S.Void, terminal: true });
const Relinked = JsonlEvent.make("relinked", { data: S.Struct({ reason: S.String }), reopen: true });
const registry = [MailReceived, Unlinked, Relinked] as const;
type Registry = typeof registry;

// ── the DataSchema bound: a service-requiring payload must fail AT make ─────

interface SomeService {
  readonly _: unique symbol;
}
/** A payload schema that needs a service to decode — the thing the bound forbids. */
declare const NeedsAService: S.Codec<number, string, SomeService, never>;

/** Never called; it exists so the `@ts-expect-error` below is type-checked. */
const boundIsLoadBearing = (): void => {
  // @ts-expect-error — a payload schema requiring services must be rejected at
  // REGISTRATION. If this line ever stops erroring, the DataSchema bound has
  // silently stopped binding and the sync core's no-runtime guarantee is gone.
  JsonlEvent.make("needs-a-service", { data: NeedsAService });
};

// ── the derived union ───────────────────────────────────────────────────────

assertType<
  Equals<
    EnvelopeUnion<Registry>,
    | EnvelopeType<"mail-received", { readonly round: number; readonly from: string }>
    | EnvelopeType<"unlinked", void>
    | EnvelopeType<"relinked", { readonly reason: string }>
  >
>();

assertType<Equals<JsonlEventType.Tag<Registry>, "mail-received" | "unlinked" | "relinked">>();
assertType<Equals<JsonlEventType.Data<Registry, "mail-received">, { readonly round: number; readonly from: string }>>();
assertType<Equals<JsonlEventType.Data<Registry, "unlinked">, void>>();

// terminal / reopen survive onto the derived types
assertType<Equals<JsonlEventType.TerminalTags<Registry>, "unlinked">>();
assertType<Equals<JsonlEventType.ReopenTags<Registry>, "relinked">>();

assertType<
  Equals<
    EnvelopeWithTag<Registry, "mail-received">,
    EnvelopeType<"mail-received", { readonly round: number; readonly from: string }>
  >
>();

// ── encodeResult is typed per tag ───────────────────────────────────────────

declare const at: DateTime.Utc;

const encodeIsTyped = (): void => {
  // @ts-expect-error — the payload must match the schema registered for the tag.
  Envelope.encodeResult({ event: "mail-received", data: { round: "seven", from: "x" }, at }, registry);

  // @ts-expect-error — the tag must be one the registry defines.
  Envelope.encodeResult({ event: "not-in-registry", data: undefined, at }, registry);

  // @ts-expect-error — a payload belonging to a DIFFERENT tag is rejected.
  Envelope.encodeResult({ event: "relinked", data: { round: 1, from: "x" }, at }, registry);
};

describe("Envelope type-level contract", () => {
  it("is enforced by types:check, not by this assertion", () => {
    // The real assertions above are compile-time. This body only proves the
    // module loaded; if the type contract broke, `types:check` goes red and the
    // build gate fails before this ever runs.
    assert.isFunction(boundIsLoadBearing);
    assert.isFunction(encodeIsTyped);
    assert.isFunction(assertType);
  });
});

// ── P4: typed narrowing on the read surfaces ────────────────────────────────
//
// Runtime filtering and type narrowing are different properties: a surface can
// filter correctly while typing its stream as the full union, and every runtime
// test would still pass. These assertions are the only thing that catches that.

declare const readJournal: JournalShape<Registry>;

/**
 * Never called — it exists so the assertions inside are type-checked without
 * evaluating `readJournal`, which is a `declare const` and does not exist at
 * runtime. Written at top level, these expressions threw on import.
 */
const readSurfacesAreNarrowed = (): void => {
  const narrowedQuery = readJournal.query({ events: ["mail-received"] });
  assertType<
    Equals<
      Stream.Success<typeof narrowedQuery>,
      EnvelopeType<"mail-received", { readonly round: number; readonly from: string }>
    >
  >();

  const narrowedChanges = readJournal.changes({ events: ["unlinked"] });
  assertType<Equals<Stream.Success<typeof narrowedChanges>, EnvelopeType<"unlinked", void>>>();

  const twoTags = readJournal.changes({ events: ["mail-received", "relinked"] });
  assertType<
    Equals<
      Stream.Success<typeof twoTags>,
      | EnvelopeType<"mail-received", { readonly round: number; readonly from: string }>
      | EnvelopeType<"relinked", { readonly reason: string }>
    >
  >();

  // Omitting the slice — or omitting `events` — yields the FULL union.
  const unsliced = readJournal.query();
  assertType<Equals<Stream.Success<typeof unsliced>, EnvelopeUnion<Registry>>>();
  const scopedOnly = readJournal.changes({ scopes: ["mailbox-a"] });
  assertType<Equals<Stream.Success<typeof scopedOnly>, EnvelopeUnion<Registry>>>();

  // A projection over a slice sees only that slice's variants.
  const projected = readJournal.projection(0, (total, envelope) => total + envelope.data.round, {
    events: ["mail-received"],
  });
  assertType<Equals<Stream.Success<typeof projected>, number>>();
};
void readSurfacesAreNarrowed;

// ── the layer's error channel is honest ─────────────────────────────────────
//
// A runtime test cannot catch this one: an EACCES surfaces as a typed Fail
// whatever the declared channel says, so a layer typed `never` fails at
// runtime in exactly the same shape while no caller can name the error. The
// assertion has to be a type.

class TypedJournal extends Journal.Service<TypedJournal>()("test/TypedJournal", { events: registry }) {}

type LayerError =
  ReturnType<typeof TypedJournal.layer> extends Layer.Layer<infer _Self, infer E, infer _R> ? E : never;

declare const platformError: PlatformError.PlatformError;

const layerErrorIsHonest = (): void => {
  // Assignable INTO the channel, which `never` is not: narrowing the layer's
  // error back to `never` makes this line an error, and construction failures
  // become defects nobody can catch.
  const carried: LayerError = platformError;
  void carried;
};
void layerErrorIsHonest;
