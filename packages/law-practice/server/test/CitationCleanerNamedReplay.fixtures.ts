/** Exact named cleaner outputs, builtin boundaries and final registry state.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationCleanerOperation } from "@beep/law-practice-server/internal/Citation/CleanerOperation";
import {
  CitationCleanerFailure,
  CitationCleanerRuntime,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationBuiltinCleanerName } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { LiteralKit } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationBuiltinObservation } from "./CitationCleanerBuiltinObservation.fixtures.ts";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { loadCitationCleanerSource } from "./CitationCleanerSource.fixtures.ts";
import type { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $LawPracticeServerId.create("test/CitationCleanerNamedReplay");
const SourceText = S.Struct({ kind: S.tag("text"), text: S.String, subtype: S.tag("plain") }).pipe(
  $I.annoteSchema("SourceText", {
    description: "Original source text artifact reference for named cleaner observations.",
  })
);
const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), value: SourceText, sameAsInput: S.Boolean }),
  S.Struct({ kind: S.tag("failure"), pythonType: S.String, message: S.String }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Outcome", {
    description: "Complete source result or native parse/declaration/unknown-step failure.",
  })
);
const BuiltinEvent = S.Union([
  S.Struct({ kind: S.tag("builtin-enter"), name: CitationBuiltinCleanerName, value: SourceText }),
  S.Struct({ kind: S.tag("builtin-return"), name: CitationBuiltinCleanerName, value: SourceText }),
  S.Struct({
    kind: S.tag("builtin-raise"),
    name: CitationBuiltinCleanerName,
    failure: S.Struct({ pythonType: S.String }),
  }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("BuiltinEvent", {
    description: "Source builtin value boundaries and failure categories; exception messages remain private.",
  })
);
const Bindings = S.Array(
  S.Struct({ key: SourceText, value: S.Struct({ kind: S.tag("builtin-function"), name: CitationBuiltinCleanerName }) })
).pipe($I.annoteSchema("Bindings", { description: "Original insertion-ordered named registry snapshot." }));
const NamedCase = S.Struct({
  name: S.String,
  family: S.Literals(["named", "official"]),
  input: SourceText,
  steps: S.Struct({ kind: S.tag("list"), names: S.Array(S.String) }),
  runs: S.Array(Outcome),
  events: S.Array(S.Json),
  lookupAfter: Bindings,
}).pipe(
  $I.annoteSchema("NamedCase", {
    description: "Original named/official request, outcomes, builtin observations and final bindings.",
  })
);
const Mode = LiteralKit(["literal", "html"]).pipe(
  $I.annoteSchema("Mode", { description: "Explicit unit or hosted-native source partition selector." })
);
class ReplayTotals extends S.Opaque<ReplayTotals, { readonly brand: unique symbol }>()(
  S.Struct({
    cases: S.Natural,
    successes: S.Natural,
    parseFailures: S.Natural,
    declarationFailures: S.Natural,
    unknownSteps: S.Natural,
    events: S.Natural,
  }).pipe(
    $I.annoteSchema("ReplayTotals", {
      description: "Exact named outcome and observed builtin-event totals for one source partition.",
    })
  )
) {}
const fail = () => CitationCleanerFailure.make({ reason: "callback-failed" });
/** Replay complete source partitions through real admission, owned values, hashing,
 * registry and builtins. A native spawner is an explicit hosted-test capability.
 * @internal @category testing @since 0.0.0
 */
export const replayNamedCleanerScenes = Effect.fn("NamedCorpusTest.replay")(function* (
  mode: typeof Mode.Type,
  spawner?: ChildProcessSpawner.ChildProcessSpawner["Service"]
) {
  const corpus = yield* loadCitationCleanerSource();
  const artifacts = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value]));
  const text = (id: string) => O.getOrThrow(HashMap.get(artifacts, id));
  let observed = A.empty<S.Json>();
  const observation = yield* makeCitationBuiltinObservation(
    (value) => present(value),
    (event) =>
      Effect.sync(() => {
        observed = A.append(observed, event);
      })
  );
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const h = yield* makeCitationCleanerRegistryHarness(undefined, undefined, spawner, observation);
  const present = Effect.fn("NamedCorpusTest.present")(function* (
    value: CitationCleanerObject
  ): Effect.fn.Return<S.Json, CitationCleanerFailure> {
    const descriptor = yield* Effect.fromOption(yield* h.values.getText(value), fail);
    return { kind: "text", text: descriptor.text, subtype: descriptor.subtype === "plain" ? "plain" : "marked" };
  });
  const admission = yield* makeCitationOperationAdmission(limits);
  let initial = O.none<CitationCleanerObject>();
  const runtime = CitationCleanerRuntime.of({
    ...h.registry.runtime,
    fromText: Effect.fn("NamedCorpusTest.captureSource")((source) =>
      h.registry.runtime.fromText(source).pipe(
        Effect.tap((value) =>
          Effect.sync(() => {
            initial = O.some(value);
          })
        )
      )
    ),
  });
  const operation = yield* makeCitationCleanerOperation(limits).pipe(
    Effect.provideService(CitationOperationAdmission, admission),
    Effect.provideService(CitationCleanerRuntime, runtime)
  );
  let checked = 0;
  let successes = 0;
  let parseFailures = 0;
  let declarationFailures = 0;
  let unknownSteps = 0;
  let events = 0;
  const normalize = (event: typeof BuiltinEvent.Type): S.Json =>
    event.kind === "builtin-raise" ? event : { ...event, value: { ...event.value, text: text(event.value.text) } };
  const verify = Effect.fn("NamedCorpusTest.verify")(function* (row: typeof NamedCase.Type) {
    observed = [];
    h.select(yield* Effect.forEach(row.steps.names, h.values.text));
    for (const expected of row.runs) {
      const input = { text: text(row.input.text), plan: row.name };
      if (expected.kind === "failure") {
        const failure = yield* Effect.flip(operation.run(input));
        if (expected.pythonType === "lxml.etree.ParserError") {
          expect(failure, row.name).toMatchObject({ reason: "html-parse-error" });
          parseFailures++;
        } else if (mode === "html") {
          expect(expected.pythonType).toBe("builtins.ValueError");
          expect(failure, row.name).toMatchObject({ reason: "html-unicode-encoding-declaration" });
          declarationFailures++;
        } else {
          expect(expected.pythonType).toBe("builtins.ValueError");
          expect(failure, row.name).toMatchObject({ reason: "unknown-step" });
          unknownSteps++;
        }
      } else {
        const result = yield* operation.run(input);
        expect(O.getOrThrow(yield* h.values.getText(result.value)).text, row.name).toBe(text(expected.value.text));
        expect(yield* h.values.same(O.getOrThrow(initial), result.value), row.name).toBe(expected.sameAsInput);
        successes++;
      }
    }
    const expectedEvents = yield* Effect.forEach(A.filter(row.events, S.is(BuiltinEvent)), (value) =>
      S.decodeEffect(BuiltinEvent)(value).pipe(Effect.map(normalize))
    );
    expect(observed, row.name).toEqual(expectedEvents);
    const actual = yield* Effect.forEach(yield* h.registry.read, ([key, _value, builtin]) =>
      Effect.gen(function* () {
        return { key: yield* present(key), value: { kind: "builtin-function", name: O.getOrThrow(builtin) } };
      })
    );
    expect(actual, row.name).toEqual(
      A.map(row.lookupAfter, (binding) => ({ ...binding, key: { ...binding.key, text: text(binding.key.text) } }))
    );
    expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
    events += observed.length;
    checked++;
  });
  for (const raw of corpus.cases) {
    if (raw.family === "custom") continue;
    const row = yield* S.decodeUnknownEffect(NamedCase)(raw);
    if (A.contains(row.steps.names, "html") !== (mode === "html")) continue;
    yield* verify(row).pipe(Effect.tapCause(() => Effect.logError(row.name)));
  }
  return ReplayTotals.make({ cases: checked, successes, parseFailures, declarationFailures, unknownSteps, events });
});
