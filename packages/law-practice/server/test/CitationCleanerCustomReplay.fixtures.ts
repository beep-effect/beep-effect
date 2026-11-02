/** Shared controlled cleaner verifier; source expectations never configure callback behavior.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationOperationAdmission, makeCitationOperationAdmission } from "../src/internal/Citation/Admission.ts";
import { makeCitationCleanerOperation } from "../src/internal/Citation/CleanerOperation.ts";
import { CitationCleanerRuntime } from "../src/internal/Citation/CleanerPipeline.ts";
import { makeControlledLiteralScene } from "./CitationCleanerCustom.fixtures.ts";
import { loadCitationCleanerSource } from "./CitationCleanerSource.fixtures.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CitationCleanerObject, CitationCleanerWork } from "../src/internal/Citation/CleanerPipeline.ts";

const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), value: S.Json, sameAsInput: S.Boolean }),
  S.Struct({ kind: S.tag("failure"), pythonType: S.String }),
]).pipe(S.toTaggedUnion("kind"));
const ObservableEvent = S.Union([
  S.Struct({ kind: S.tag("callback-enter"), name: S.String, call: S.Natural, value: S.Json }),
  S.Struct({ kind: S.tag("callback-return"), name: S.String, value: S.Json }),
  S.Struct({ kind: S.tag("iterator-enter") }),
  S.Struct({ kind: S.tag("iterator-yield"), index: S.Natural, value: S.Json }),
  S.Struct({ kind: S.tag("iterator-raise"), index: S.Natural }),
  S.Struct({ kind: S.tag("iterator-complete") }),
  S.Struct({ kind: S.tag("step-hash"), mode: S.String, call: S.Natural }),
  S.Struct({ kind: S.tag("step-hash-return"), raw: S.String }),
  S.Struct({ kind: S.tag("step-equality"), mode: S.String, other: S.Json }),
  S.Struct({ kind: S.tag("step-call"), mode: S.String, value: S.Json }),
  S.Struct({ kind: S.tag("equality-bool"), result: S.Boolean }),
  S.Struct({ kind: S.tag("callable-text-called") }),
]).pipe(S.toTaggedUnion("kind"));
const JsonArray = S.Array(S.Json);
const SourceInput = S.Struct({ kind: S.tag("text"), text: S.String, subtype: S.Literals(["plain", "marked"]) });
const expectedReason = (scene: string) => {
  if (scene === "dispatch:delete-second-hash") return "lookup-key-missing";
  if (scene === "dispatch:hash-raises" || scene === "dispatch:equality-raises") return "callback-failed";
  if (A.contains(["unknown-stops", "registry-delete", "integer-step", "bytes-step", "steps-string"], scene))
    return "unknown-step";
  if (scene === "registry-noncallable") return "not-callable";
  if (A.contains(["callback-raises", "unhashable-stops", "unhashable-callable"], scene)) return "callback-failed";
  if (A.contains(["steps-none", "iterator-raises", "iterator-raises-first"], scene)) return "iteration-failed";
  return "builtin-input-type";
};
const sourceFailureType = (scene: string) =>
  scene === "dispatch:delete-second-hash"
    ? "builtins.KeyError"
    : A.contains(
          [
            "none-to-builtin",
            "int-to-builtin",
            "bytes-to-builtin",
            "registry-noncallable",
            "unhashable-stops",
            "unhashable-callable",
            "steps-none",
          ],
          scene
        )
      ? "builtins.TypeError"
      : "builtins.ValueError";

const $I = $LawPracticeServerId.create("test/CitationCleanerCustomReplay");
class ReplayTotals extends S.Opaque<ReplayTotals, { readonly brand: unique symbol }>()(
  S.Struct({ scenes: S.Natural, runs: S.Natural, events: S.Natural, safetyDivergences: S.Natural }).pipe(
    $I.annoteSchema("ReplayTotals", {
      description: "Exact result and observable-event totals, retaining approved safety differences separately.",
    })
  )
) {}
/** Replay selected source scenes through independent captured protocols and the admitted production cleaner.
 * Native process access is an explicit test capability; the default forbids children.
 * @internal @category testing @since 0.0.0
 */
export const replayControlledCleanerScenes = Effect.fn("CleanerCustomCorpusTest.replay")(function* (
  scenes: ReadonlyArray<string>,
  spawner?: ChildProcessSpawner.ChildProcessSpawner["Service"]
) {
  const corpus = yield* loadCitationCleanerSource();
  const artifacts = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value]));
  const expand = (value: S.Json): S.Json => {
    if (P.isString(value)) return O.getOrElse(HashMap.get(artifacts, value), () => value);
    if (S.is(JsonArray)(value)) return A.map(value, expand);
    if (S.is(S.JsonObject)(value)) return R.map(value, expand);
    return value;
  };
  const limits = (yield* defaultCitationEnginePolicy).limits;
  let checked = 0;
  let runs = 0;
  let traceEvents = 0;
  let safetyDivergences = 0;
  const verify = Effect.fn("CleanerCustomCorpusTest.verify")(function* (row: (typeof corpus.cases)[number]) {
    const owned = yield* makeControlledLiteralScene(row.name, spawner);
    const input = yield* S.decodeUnknownEffect(SourceInput)(row.input);
    const text = O.getOrThrow(HashMap.get(artifacts, input.text));
    const admission = yield* makeCitationOperationAdmission(limits);
    let initial = O.none<CitationCleanerObject>();
    let lastWork = O.none<CitationCleanerWork>();
    const runtime = CitationCleanerRuntime.of({
      ...owned.h.registry.runtime,
      open: Effect.fn("CleanerCustomCorpusTest.open")((plan, value, work) => {
        lastWork = O.some(work);
        return owned.h.registry.runtime.open(plan, value, work);
      }),
      fromText: Effect.fn("CleanerCustomCorpusTest.source")((source) =>
        owned.source(source).pipe(
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
    for (const raw of row.runs) {
      const outcome = yield* S.decodeUnknownEffect(Outcome)(raw);
      if (row.name === "resource-before-callback") {
        expect(outcome.kind).toBe("success");
        expect(yield* Effect.flip(operation.run({ text, plan: row.name }))).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          operation: "clean",
          limit: "nativeHtmlParserResource",
        });
        safetyDivergences++;
      } else if (outcome.kind === "failure") {
        expect(outcome.pythonType).toBe(sourceFailureType(row.name));
        const failure = yield* Effect.flip(operation.run({ text, plan: row.name }));
        expect(failure, row.name).toMatchObject({ reason: expectedReason(row.name) });
      } else {
        const result = yield* operation.run({ text, plan: row.name });
        expect(yield* owned.present(result.value), row.name).toEqual(expand(outcome.value));
        expect(yield* owned.h.values.same(O.getOrThrow(initial), result.value), row.name).toBe(outcome.sameAsInput);
      }
      expect((yield* O.getOrThrow(lastWork).snapshot).closed).toBe(true);
      expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
      runs++;
    }
    const expected = yield* Effect.forEach(A.filter(row.events, S.is(ObservableEvent)), (value) =>
      S.decodeEffect(ObservableEvent)(value).pipe(Effect.map((event) => expand(event)))
    );
    const observed = yield* owned.events;
    expect(observed, row.name).toEqual(row.name === "resource-before-callback" ? [] : expected);
    expect(yield* owned.bindings, row.name).toEqual(A.map(row.lookupAfter, expand));
    traceEvents += observed.length;
    checked++;
  });
  for (const row of corpus.cases)
    if (row.family === "custom" && A.contains(scenes, row.name))
      yield* Effect.scoped(verify(row)).pipe(Effect.tapCause(() => Effect.logError(row.name)));
  expect(checked).toBe(scenes.length);
  return ReplayTotals.make({ scenes: checked, runs, events: traceEvents, safetyDivergences });
});
