import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { ActivityFacts, withActivity } from "@beep/nlp-processing/Activity";
import * as Composition from "@beep/nlp-processing/Backend/Composition";
import * as Backend from "@beep/nlp-processing/Backend/NLPBackend";
import {
  ActivityGeneratedCountAttribute,
  ActivityIdAttribute,
  ActivityOutcomeAttribute,
  ActivityUsedCountAttribute,
  CacheResultAttribute,
  CauseClassificationAttribute,
  NlpBackendFallbacks,
  NlpCacheLookups,
  NlpProcessingInstruments,
  OperationTermAttribute,
  PackageAttribute,
} from "@beep/nlp-processing/NlpProcessing.instruments";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import { mintInputs, StepFailure, stepTerm } from "./support/PipelineDescriptor.ts";
import type * as Tracer from "effect/Tracer";
import type { Entities } from "./support/PipelineDescriptor.ts";

const packageLabel = { [PackageAttribute]: "@beep/nlp-processing" };

const capabilities = Backend.BackendCapabilities.make({
  constituencyParsing: false,
  coreferenceResolution: false,
  dependencyParsing: false,
  lemmatization: false,
  ner: false,
  posTagging: false,
  relationExtraction: false,
  sentencization: false,
  tokenization: true,
});

const backendNamed = (
  name: string,
  tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>, Backend.NLPBackendError>
): Backend.NLPBackendShape => ({
  capabilities,
  extractEntities: () => Effect.succeed([]),
  extractRelations: () => Effect.succeed([]),
  lemmatize: () => Effect.succeed([]),
  name,
  parseDependencies: () => Effect.succeed([]),
  posTag: () => Effect.succeed([]),
  sentencize: () => Effect.succeed([]),
  tokenize,
});

const counted = (name: string, attributes: Record<string, string>) =>
  Effect.map(Metric.value(Metric.withAttributes(Metric.counter(name), attributes)), (state) => state.count);

const spanCapturing = (captured: Ref.Ref<O.Option<Tracer.Span>>, fail: boolean) =>
  withActivity<Entities, Entities, never>({
    facts: (used) =>
      Effect.succeed(
        ActivityFacts.make({
          pin: ActivityPin.cases.Engine.make({ engine: "telemetry", edition: "1" }),
          promptDigest: O.none(),
          used,
        })
      ),
    generated: (output) => output,
  })({
    name: stepTerm,
    run: Effect.fnUntraced(function* (used: Entities) {
      const span = yield* Effect.currentSpan;
      yield* Ref.set(captured, O.some(span));
      if (fail) return yield* Effect.fail(StepFailure.make({ step: 0 }));
      return used;
    }),
  });

const attributesOf = Effect.fnUntraced(function* (captured: Ref.Ref<O.Option<Tracer.Span>>) {
  const span = yield* Effect.flatMap(Ref.get(captured), Effect.fromOption);
  return span.attributes;
});

describe("NlpProcessing telemetry", () => {
  it("declares only static or bounded keys on its metrics", () => {
    const unboundedKeys = HashSet.fromIterable(
      A.map(
        A.filter(NlpProcessingInstruments.attributes, (attribute) => attribute.cardinality === "unbounded"),
        (attribute) => attribute.key
      )
    );
    const metricKeys = A.flatMap(NlpProcessingInstruments.instruments, (instrument) =>
      instrument._tag === "MetricInstrument" ? instrument.attributes : []
    );
    expect(A.filter(metricKeys, (key) => HashSet.has(unboundedKeys, key))).toEqual([]);
  });

  it.layer(Digest.layerWebCrypto)("Operation.run", (it) => {
    it.effect("annotates a completed run with its term, id, counts and outcome", () =>
      Effect.gen(function* () {
        const captured = yield* Ref.make(O.none<Tracer.Span>());
        const inputs = yield* mintInputs([1, 2]);
        const logged = yield* spanCapturing(captured, false).run(inputs);
        const attributes = yield* attributesOf(captured);
        const [record] = A.fromIterable(logged.activities);
        expect(attributes.get(OperationTermAttribute)).toBe(stepTerm);
        expect(attributes.get(ActivityIdAttribute)).toBe(record?.id);
        expect(attributes.get(ActivityUsedCountAttribute)).toBe(2);
        expect(attributes.get(ActivityGeneratedCountAttribute)).toBe(2);
        expect(attributes.get(ActivityOutcomeAttribute)).toBe("completed");
      })
    );

    it.effect("annotates a failed run with an empty generated count", () =>
      Effect.gen(function* () {
        const captured = yield* Ref.make(O.none<Tracer.Span>());
        const inputs = yield* mintInputs([3]);
        yield* Effect.flip(spanCapturing(captured, true).run(inputs));
        const attributes = yield* attributesOf(captured);
        expect(attributes.get(ActivityGeneratedCountAttribute)).toBe(0);
        expect(attributes.get(ActivityOutcomeAttribute)).toBe("failed");
      })
    );
  });

  it.effect("counts cache lookups by result under the declared key", () =>
    Effect.gen(function* () {
      const hit = { ...packageLabel, [CacheResultAttribute]: "hit" };
      const miss = { ...packageLabel, [CacheResultAttribute]: "miss" };
      const hitsBefore = yield* counted(NlpCacheLookups.name, hit);
      const missesBefore = yield* counted(NlpCacheLookups.name, miss);
      const cached = yield* Composition.withCaching(
        backendNamed("primary", (text) => Effect.succeed([text])),
        {}
      );
      yield* cached.tokenize("same");
      yield* cached.tokenize("same");
      expect((yield* counted(NlpCacheLookups.name, hit)) - hitsBefore).toBe(1);
      expect((yield* counted(NlpCacheLookups.name, miss)) - missesBefore).toBe(1);
    })
  );

  it.effect("counts a backend fallback by cause classification", () =>
    Effect.gen(function* () {
      const failure = { ...packageLabel, [CauseClassificationAttribute]: "failure" };
      const before = yield* counted(NlpBackendFallbacks.name, failure);
      const composed = Composition.withFallback(
        backendNamed("primary", () => Effect.fail(Backend.operationError("primary", "tokenize", {}))),
        backendNamed("secondary", (text) => Effect.succeed([text]))
      );
      const tokens = yield* composed.tokenize("fallback");
      expect(tokens).toEqual(["fallback"]);
      expect((yield* counted(NlpBackendFallbacks.name, failure)) - before).toBe(1);
    })
  );
});
