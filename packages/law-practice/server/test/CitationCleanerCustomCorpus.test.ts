import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationOperationAdmission, makeCitationOperationAdmission } from "../src/internal/Citation/Admission.ts";
import { makeCitationCleanerOperation } from "../src/internal/Citation/CleanerOperation.ts";
import { CitationCleanerRuntime } from "../src/internal/Citation/CleanerPipeline.ts";
import { controlledLiteralScenes, makeControlledLiteralScene } from "./CitationCleanerCustom.fixtures.ts";
import { loadCitationCleanerSource } from "./CitationCleanerSource.fixtures.ts";
import type { CitationCleanerObject } from "../src/internal/Citation/CleanerPipeline.ts";

const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), value: S.Json, sameAsInput: S.Boolean }),
  S.Struct({ kind: S.tag("failure"), pythonType: S.String }),
]).pipe(S.toTaggedUnion("kind"));
const CallbackEvent = S.Union([
  S.Struct({ kind: S.tag("callback-enter"), name: S.String, call: S.Natural, value: S.Json }),
  S.Struct({ kind: S.tag("callback-return"), name: S.String, value: S.Json }),
]).pipe(S.toTaggedUnion("kind"));
const JsonArray = S.Array(S.Json);
const SourceInput = S.Struct({ kind: S.tag("text"), text: S.String, subtype: S.Literals(["plain", "marked"]) });
const expectedReason = (scene: string) =>
  scene === "unknown-stops" || scene === "registry-delete"
    ? "unknown-step"
    : scene === "registry-noncallable"
      ? "not-callable"
      : scene === "callback-raises"
        ? "callback-failed"
        : "builtin-input-type";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("controlled source callbacks", (it) => {
  it.effect(
    "replays 24 controlled non-HTML scenes with exact callback inputs/returns and retained value identity",
    () =>
      Effect.gen(function* () {
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
        let callbackEvents = 0;
        const verify = Effect.fn("CleanerCustomCorpusTest.verify")(function* (row: (typeof corpus.cases)[number]) {
          const owned = yield* makeControlledLiteralScene(row.name);
          const input = yield* S.decodeUnknownEffect(SourceInput)(row.input);
          const text = O.getOrThrow(HashMap.get(artifacts, input.text));
          const admission = yield* makeCitationOperationAdmission(limits);
          let initial = O.none<CitationCleanerObject>();
          const runtime = CitationCleanerRuntime.of({
            ...owned.h.registry.runtime,
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
            if (outcome.kind === "failure") {
              expect(outcome.pythonType).toBe(
                expectedReason(row.name) === "unknown-step" || expectedReason(row.name) === "callback-failed"
                  ? "builtins.ValueError"
                  : "builtins.TypeError"
              );
              const failure = yield* Effect.flip(operation.run({ text, plan: row.name }));
              expect(failure, row.name).toMatchObject({ reason: expectedReason(row.name) });
            } else {
              const result = yield* operation.run({ text, plan: row.name });
              expect(yield* owned.present(result.value), row.name).toEqual(expand(outcome.value));
              expect(yield* owned.h.values.same(O.getOrThrow(initial), result.value), row.name).toBe(
                outcome.sameAsInput
              );
            }
            expect((yield* (yield* owned.h.work).snapshot).closed).toBe(true);
            expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
            runs++;
          }
          const expected = yield* Effect.forEach(A.filter(row.events, S.is(CallbackEvent)), (value) =>
            S.decodeEffect(CallbackEvent)(value).pipe(Effect.map((event) => expand(event)))
          );
          const observed = yield* owned.events;
          expect(observed, row.name).toEqual(expected);
          callbackEvents += observed.length;
          checked++;
        });
        for (const row of corpus.cases)
          if (row.family === "custom" && A.contains(controlledLiteralScenes, row.name))
            yield* Effect.scoped(verify(row)).pipe(Effect.tapCause(() => Effect.logError(row.name)));
        expect(checked).toBe(24);
        expect(runs).toBe(25);
        expect(callbackEvents).toBe(59);
      })
  );
});
