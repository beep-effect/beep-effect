/** Server-owned named cleaner containers for the original Document initializer.
 * Source list/tuple/generator behavior adapts eyecite 2.7.6 models.py (BSD-2-Clause);
 * see THIRD_PARTY_NOTICES.md. Arbitrary host protocols remain captured services.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationCleanerFailure } from "./CleanerPipeline.ts";
import { CitationCleanerProtocols } from "./CleanerRegistry.ts";
import { CitationBuiltinCleanerName, CitationCleanerValues } from "./CleanerValues.ts";
import { CitationDocumentInputFailure, CitationDocumentInputProtocols } from "./InputDocument.ts";
import type { CitationCleanerObject } from "./CleanerPipeline.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DocumentCleanerProtocols");
const Kind = LiteralKit(["list", "tuple", "generator"]).pipe(
  $I.annoteSchema("Kind", { description: "Explicit server-owned named list, tuple or one-shot generator." })
);
const GeneratorState = S.Struct({
  position: S.Natural,
  state: LiteralKit(["GEN_CREATED", "GEN_SUSPENDED", "GEN_CLOSED"]),
}).pipe(
  $I.annoteSchema("GeneratorState", {
    description: "Original generator progress: yielding the last item does not yet close it.",
  })
);
/** Private observation of an issued named container; not a request or wire value.
 * @internal @category models @since 0.0.0
 */
export class CitationDocumentCleanerContainerState extends S.Opaque<
  CitationDocumentCleanerContainerState,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: Kind,
    size: S.Natural,
    generator: S.Option(GeneratorState),
  }).pipe(
    $I.annoteSchema("CitationDocumentCleanerContainerState", {
      description: "Owned named container shape and optional shared generator state.",
    })
  )
) {}
const Input = S.Struct({ kind: Kind, names: S.Array(CitationBuiltinCleanerName) }).pipe(
  $I.annoteSchema("Input", { description: "Trusted named-container configuration; no host iterator or callback data." })
);
type Entry = {
  readonly kind: typeof Kind.Type;
  readonly names: ReadonlyArray<CitationBuiltinCleanerName>;
  readonly values: ReadonlyArray<CitationCleanerObject>;
  readonly plan: string;
  readonly generator: O.Option<Ref.Ref<typeof GeneratorState.Type>>;
};
const invalid = () => CitationCleanerFailure.make({ reason: "invalid-input" });
const sourceFailure = (sourceError: CitationDocumentInputFailure["sourceError"]) =>
  CitationDocumentInputFailure.make({ reason: "source-protocol", sourceError });

const LimitsValue = S.toType(CitationEngineLimits).pipe(
  $I.annoteSchema("LimitsValue", { description: "Captured static boundary codec for bounded citation processing." })
);
/** Capture one value owner, original cleaner protocols and optional host Document
 * protocols. Issued named containers share their exact handles between constructor
 * truth/membership and cleaner iteration. Selecting a plan never iterates it;
 * each list/tuple opening starts a fresh cursor, while generator membership and
 * cleaning consume the same one-shot cursor. Unknown host containers delegate
 * without property inspection. All returned protocol methods have R=never.
 * Scope closure invalidates this adapter and releases its bounded plan table.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDocumentCleanerProtocols = Effect.fn("Citation.makeDocumentCleanerProtocols")(function* (
  policy: unknown
) {
  const limits = yield* S.decodeUnknownEffect(LimitsValue)(policy).pipe(Effect.mapError(invalid));
  const values = yield* CitationCleanerValues;
  const hostCleaner = yield* CitationCleanerProtocols;
  const hostDocument = yield* Effect.serviceOption(CitationDocumentInputProtocols);
  let issued = new WeakMap<CitationCleanerObject, Entry>();
  let plans = HashMap.empty<string, Entry>();
  let remaining = limits.resolutionIterations;
  let closed = false;
  const ensureOpen = Effect.suspend(() =>
    closed ? Effect.fail(CitationCleanerFailure.make({ reason: "closed-owner" })) : Effect.void
  );
  const charge = (units: number) =>
    Effect.suspend(() => {
      if (units > remaining)
        return Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: "resolutionIterations" }));
      remaining -= units;
      return Effect.yieldNow;
    });
  const entryOf = Effect.fn("Citation.documentNamedEntry")(function* (value: CitationCleanerObject) {
    yield* ensureOpen;
    yield* values.assertOwned(value);
    return O.fromUndefinedOr(issued.get(value));
  });
  const names = S.Array(CitationBuiltinCleanerName).check(S.isMaxLength(limits.resolutionIterations));
  const create = Effect.fn("Citation.issueDocumentNamedSteps")(function* (input: unknown) {
    yield* ensureOpen;
    const configured = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(invalid));
    const decoded = yield* S.decodeEffect(names)(configured.names).pipe(Effect.mapError(invalid));
    const selected = A.copy(decoded);
    yield* charge(selected.length + 1);
    const items = yield* Effect.forEach(selected, (name) =>
      ensureOpen.pipe(Effect.andThen(Effect.yieldNow), Effect.andThen(values.builtinName(name)))
    );
    yield* ensureOpen;
    const value = yield* values.retainHost(Symbol("citation-named-cleaner-container"));
    const generator =
      configured.kind === "generator"
        ? yield* Ref.make(GeneratorState.make({ position: 0, state: "GEN_CREATED" })).pipe(Effect.asSome)
        : O.none<Ref.Ref<typeof GeneratorState.Type>>();
    const entry: Entry = {
      kind: configured.kind,
      names: selected,
      values: items,
      plan: `document-steps:${value.slot}`,
      generator,
    };
    issued.set(value, entry);
    plans = HashMap.set(plans, entry.plan, entry);
    return value;
  });
  const next = Effect.fn("Citation.nextDocumentNamedGenerator")(function* (entry: Entry) {
    yield* ensureOpen;
    const state = yield* Effect.fromOption(entry.generator, invalid);
    return yield* Ref.modify(state, (current): readonly [O.Option<number>, typeof GeneratorState.Type] => {
      if (current.position >= entry.values.length)
        return [O.none(), GeneratorState.make({ position: current.position, state: "GEN_CLOSED" })];
      return [
        O.some(current.position),
        GeneratorState.make({ position: current.position + 1, state: "GEN_SUSPENDED" }),
      ];
    });
  });
  const contains = Effect.fn("Citation.containsDocumentNamedHtml")(function* (entry: Entry) {
    if (O.isNone(entry.generator)) return A.contains(entry.names, "html");
    while (true) {
      const index = yield* next(entry);
      if (O.isNone(index)) return false;
      if (A.getUnsafe(entry.names, index.value) === "html") return true;
      yield* Effect.yieldNow;
    }
  });
  const inspect = Effect.fn("Citation.inspectDocumentNamedContainer")(function* (value: CitationCleanerObject) {
    const entry = yield* entryOf(value);
    if (O.isNone(entry)) return O.none<CitationDocumentCleanerContainerState>();
    const generator = O.isSome(entry.value.generator)
      ? yield* Ref.get(entry.value.generator.value).pipe(Effect.asSome)
      : O.none();
    return O.some(
      CitationDocumentCleanerContainerState.make({ kind: entry.value.kind, size: entry.value.names.length, generator })
    );
  });
  const document = CitationDocumentInputProtocols.of({
    truth: Effect.fn("Citation.documentDefaultTruth")(function* (value) {
      const entry = yield* entryOf(value);
      if (O.isSome(entry)) return entry.value.kind === "generator" || entry.value.names.length !== 0;
      const text = yield* values.getText(value);
      // Empty projection iff the owned native string has zero Python points;
      // this test needs no native-storage copy or surrogate normalization.
      if (O.isSome(text) && text.value.subtype === "plain") return Str.isNonEmpty(text.value.text);
      const host = yield* values.getHost(value);
      if (O.isSome(host) && host.value === null) return false;
      if (O.isSome(hostDocument)) return yield* hostDocument.value.truth(value);
      return yield* sourceFailure("TypeError");
    }),
    containsHtml: Effect.fn("Citation.documentDefaultContainsHtml")(function* (value) {
      const entry = yield* entryOf(value);
      if (O.isSome(entry)) return yield* contains(entry.value);
      if (O.isSome(hostDocument)) return yield* hostDocument.value.containsHtml(value);
      return yield* sourceFailure("TypeError");
    }),
    insertSourceHtml: Effect.fn("Citation.documentDefaultInsertHtml")(function* (value) {
      const entry = yield* entryOf(value);
      // The pinned source passes ("html", 0), so exact lists reject the
      // index before mutation and tuples have no insert attribute.
      if (O.isSome(entry)) return yield* sourceFailure(entry.value.kind === "list" ? "TypeError" : "AttributeError");
      if (O.isSome(hostDocument)) return yield* hostDocument.value.insertSourceHtml(value);
      return yield* sourceFailure("AttributeError");
    }),
    plan: Effect.fn("Citation.documentDefaultPlan")(function* (value) {
      const entry = yield* entryOf(value);
      if (O.isSome(entry)) return entry.value.plan;
      if (O.isSome(hostDocument)) return yield* hostDocument.value.plan(value);
      return yield* sourceFailure("TypeError");
    }),
    warnHtmlAdded: ensureOpen.pipe(
      Effect.andThen(Effect.suspend(() => (O.isSome(hostDocument) ? hostDocument.value.warnHtmlAdded : Effect.void)))
    ),
  });
  const cleaner = CitationCleanerProtocols.of({
    ...hostCleaner,
    open: Effect.fn("Citation.openDocumentNamedSteps")(function* (plan, initial, work) {
      yield* ensureOpen;
      const entry = HashMap.get(plans, plan);
      if (O.isNone(entry)) return yield* hostCleaner.open(plan, initial, work);
      if (O.isSome(entry.value.generator))
        return {
          next: next(entry.value).pipe(
            Effect.map((index) => O.map(index, (index) => A.getUnsafe(entry.value.values, index)))
          ),
        };
      let index = 0;
      return { next: ensureOpen.pipe(Effect.andThen(Effect.sync(() => A.get(entry.value.values, index++)))) };
    }),
  });
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      closed = true;
      issued = new WeakMap();
      plans = HashMap.empty();
    })
  );
  return { create, inspect, document, cleaner };
});
