// Ported from upstream EnvelopeTypes.test.ts (MIT).

import { fcRuns } from "@beep/fc-runs";
import { Envelope, Journal, JsonlEvent, Line } from "@beep/jsonl";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type {
  Envelope as EnvelopeType,
  EnvelopeUnion,
  EnvelopeWithTag,
  JournalShape,
  JsonlEvent as JsonlEventType,
} from "@beep/jsonl";
import type * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";
import type * as Stream from "effect/Stream";

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_Expected extends true>(): void => {};

const MailReceived = JsonlEvent.make("mail-received", {
  data: S.Struct({ round: S.Finite, from: S.String }),
});
const Unlinked = JsonlEvent.make("unlinked", { data: S.Void, terminal: true });
const Relinked = JsonlEvent.make("relinked", { data: S.Struct({ reason: S.String }), reopen: true });
const registry = [MailReceived, Unlinked, Relinked] as const;
type Registry = typeof registry;

interface SomeService {
  readonly _: unique symbol;
}
declare const NeedsAService: S.Codec<number, string, SomeService, never>;

const serviceRequiringPayloadFailsAtMake = (): void => {
  // @ts-expect-error -- a payload schema requiring services must be rejected at registration, or the sync core loses its no-runtime guarantee. Owner: @beep/jsonl. Exit: remove if the DataSchema bound is meant to admit service-requiring schemas.
  JsonlEvent.make("needs-a-service", { data: NeedsAService });
};

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

assertType<Equals<JsonlEventType.TerminalTags<Registry>, "unlinked">>();
assertType<Equals<JsonlEventType.ReopenTags<Registry>, "relinked">>();

assertType<
  Equals<
    EnvelopeWithTag<Registry, "mail-received">,
    EnvelopeType<"mail-received", { readonly round: number; readonly from: string }>
  >
>();

declare const at: DateTime.Utc;

const encodeIsTyped = (): void => {
  // @ts-expect-error -- the payload must match the schema registered for the tag. Owner: @beep/jsonl. Exit: remove if the API is meant to accept this.
  Envelope.encodeResult({ event: "mail-received", data: { round: "seven", from: "x" }, at }, registry);

  // @ts-expect-error -- the tag must be one the registry defines. Owner: @beep/jsonl. Exit: remove if the API is meant to accept this.
  Envelope.encodeResult({ event: "not-in-registry", data: undefined, at }, registry);

  // @ts-expect-error -- a payload belonging to a DIFFERENT tag is rejected. Owner: @beep/jsonl. Exit: remove if the API is meant to accept this.
  Envelope.encodeResult({ event: "relinked", data: { round: 1, from: "x" }, at }, registry);
};

describe("Envelope type-level contract", () => {
  it("loads the compile-time contract, which types:check enforces: a @ts-expect-error that stops erroring fails the typecheck", () => {
    assert.isFunction(
      serviceRequiringPayloadFailsAtMake,
      "never called: it exists so its @ts-expect-error is type-checked"
    );
    assert.isFunction(encodeIsTyped);
    assert.isFunction(assertType);
    assert.isFunction(
      readSurfacesAreNarrowed,
      "never called, since readJournal is a declare const that throws on import when evaluated; runtime filtering cannot prove narrowing, a surface can filter correctly while typing its stream as the full union"
    );
    assert.isFunction(
      layerErrorIsHonest,
      "the layer's error channel must accept PlatformError: a layer typed never fails at runtime in the same shape, so construction failures become uncatchable defects and only this type assignment notices"
    );
  });

  it.prop(
    "decodes every encoded relinked reason under its own tag",
    [Relinked.data],
    ([data]) => {
      const encoded = Result.getOrThrow(
        Envelope.encodeResult({ at: DateTime.makeUnsafe(0), event: "relinked", data }, registry)
      );
      const decoded = A.map(Envelope.decodeAllResult(encoded, registry), Result.getOrThrow);
      assert.deepStrictEqual(
        A.map(decoded, (envelope) => [envelope.event, envelope.data]),
        [["relinked", data]]
      );
      assert.strictEqual(Line.split(encoded).length, 1);
    },
    { arbitrary: fcRuns(100) }
  );
});

declare const readJournal: JournalShape<Registry>;

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

  const unsliced = readJournal.query();
  assertType<Equals<Stream.Success<typeof unsliced>, EnvelopeUnion<Registry>>>();
  const scopedOnly = readJournal.changes({ scopes: ["mailbox-a"] });
  assertType<Equals<Stream.Success<typeof scopedOnly>, EnvelopeUnion<Registry>>>();

  const projected = readJournal.projection(0, (total, envelope) => total + envelope.data.round, {
    events: ["mail-received"],
  });
  assertType<Equals<Stream.Success<typeof projected>, number>>();
};

class TypedJournal extends Journal.Service<TypedJournal>()("test/TypedJournal", { events: registry }) {}

type LayerError = ReturnType<typeof TypedJournal.layer> extends Layer.Layer<infer _Self, infer E, infer _R> ? E : never;

declare const platformError: PlatformError.PlatformError;

const layerErrorIsHonest = (): void => {
  const carried: LayerError = platformError;
  void carried;
};
