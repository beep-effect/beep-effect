import { $LawPracticeServerId } from "@beep/identity/packages";
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
import * as S from "effect/Schema";
import { CitationOperationAdmission, makeCitationOperationAdmission } from "../src/internal/Citation/Admission.ts";
import { makeCitationCleanerOperation } from "../src/internal/Citation/CleanerOperation.ts";
import { CitationCleanerRuntime } from "../src/internal/Citation/CleanerPipeline.ts";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { loadCitationCleanerSource } from "./CitationCleanerSource.fixtures.ts";
import type { CitationCleanerObject } from "../src/internal/Citation/CleanerPipeline.ts";

const $I = $LawPracticeServerId.create("test/CitationCleanerNamedCorpus");
const SourceText = S.Struct({ kind: S.tag("text"), text: S.String, subtype: S.tag("plain") }).pipe(
  $I.annoteSchema("SourceText", {
    description: "Source text artifact reference retained by the sealed cleaner observations.",
  })
);
const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), value: SourceText, sameAsInput: S.Boolean }),
  S.Struct({ kind: S.tag("failure"), pythonType: S.String, message: S.String }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Outcome", { description: "Literal named-cleaner source result or invalid-name failure." })
);
const NamedCase = S.Struct({
  name: S.String,
  family: S.Literals(["named", "official"]),
  input: SourceText,
  steps: S.Struct({ kind: S.tag("list"), names: S.Array(S.String) }),
  runs: S.Array(Outcome),
}).pipe(
  $I.annoteSchema("NamedCase", {
    description: "Complete named or official cleaner sequence with exact source outputs.",
  })
);
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("admitted named source sequences", (it) => {
  it.effect(
    "matches all 600 non-HTML named/official cases, including identity and invalid-step failure",
    () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationCleanerSource();
        const artifacts = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value]));
        const text = (id: string) => O.getOrThrow(HashMap.get(artifacts, id));
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const h = yield* makeCitationCleanerRegistryHarness();
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
        let failures = 0;
        const verify = Effect.fn("NamedCorpusTest.verify")(function* (row: typeof NamedCase.Type) {
          h.select(yield* Effect.forEach(row.steps.names, h.values.text));
          for (const expected of row.runs) {
            const input = { text: text(row.input.text), plan: row.name };
            if (expected.kind === "failure") {
              expect(expected.pythonType).toBe("builtins.ValueError");
              expect(yield* Effect.flip(operation.run(input)), row.name).toMatchObject({ reason: "unknown-step" });
              failures++;
              continue;
            }
            const result = yield* operation.run(input);
            expect(O.getOrThrow(yield* h.values.getText(result.value)).text, row.name).toBe(text(expected.value.text));
            expect(yield* h.values.same(O.getOrThrow(initial), result.value), row.name).toBe(expected.sameAsInput);
            successes++;
          }
          expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
          checked++;
        });
        for (const rawCase of corpus.cases) {
          if (rawCase.family === "custom") continue;
          const row = yield* S.decodeUnknownEffect(NamedCase)(rawCase);
          if (A.contains(row.steps.names, "html")) continue;
          yield* verify(row);
        }
        expect(checked).toBe(600);
        expect(successes).toBe(599);
        expect(failures).toBe(1);
      }),
    { timeout: 30_000 }
  );
});
