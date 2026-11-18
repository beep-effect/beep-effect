import {
  AttributeKey,
  AttributeKeyName,
  Browser,
  CatalogEnrichmentOptions,
  CiRunner,
  CloudProviderName,
  CloudVm,
  effectiveTier,
  HostName,
  InstrumentCatalog,
  layerCatalogEnrichment,
  ObservabilityInstruments,
  PackageName,
  ProtocolSpanName,
  packageOf,
  Server,
  Serverless,
  SpanInstrument,
  SpanName,
  StrictDesktop,
  TelemetryRefusedCounter,
  TelemetryTier,
  VcsRevision,
  Workstation,
} from "@beep/observability/catalog";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Tracer from "effect/Tracer";
import type { EmitterContext, TelemetryRefusalTag } from "@beep/observability/catalog";

const owner = PackageName.make("@beep/observability-test");
const allowedKey = AttributeKeyName.make("beep.test.allowed");
const detailKey = AttributeKeyName.make("beep.test.detail");

const catalog = InstrumentCatalog.make({
  attributes: [
    ...ObservabilityInstruments.attributes,
    AttributeKey.make({
      key: allowedKey,
      type: "string",
      signals: ["span"],
      cardinality: "static",
      minTier: "shape-only",
      owner,
      description: "Span key allowed at every tier.",
    }),
    AttributeKey.make({
      key: detailKey,
      type: "string",
      signals: ["span"],
      cardinality: "bounded",
      minTier: "standard",
      owner,
      description: "Span key that needs the standard tier.",
    }),
  ],
  instruments: [
    SpanInstrument.make({
      name: SpanName.make("Parcels.read"),
      owner: PackageName.make("@beep/parcels-server"),
      family: "slice",
      minTier: "shape-only",
      description: "Reads one parcel.",
      kind: "internal",
    }),
    SpanInstrument.make({
      name: ProtocolSpanName.make("GET /health"),
      owner: PackageName.make("@beep/parcels-server"),
      family: "slice",
      minTier: "shape-only",
      description: "Parcels health probe.",
      kind: "server",
      protocol: true,
    }),
    SpanInstrument.make({
      name: ProtocolSpanName.make("GET /health"),
      owner: PackageName.make("@beep/docket-server"),
      family: "driver",
      minTier: "shape-only",
      description: "Docket health probe.",
      kind: "server",
      protocol: true,
    }),
  ],
});

const workstation = Workstation.make({ identitySource: "self-claimed", hostName: HostName.make("dankstation") });

const contexts: ReadonlyArray<EmitterContext> = [
  workstation,
  Server.make({ identitySource: "vouched", hostName: HostName.make("api-01") }),
  StrictDesktop.make({ identitySource: "vouched" }),
  CiRunner.make({
    identitySource: "vouched",
    pipelineRunId: "1234567890",
    vcsRevision: VcsRevision.make("4e66575c64"),
  }),
  CloudVm.make({ identitySource: "self-claimed", cloudProvider: CloudProviderName.make("aws") }),
  Serverless.make({
    identitySource: "vouched",
    cloudProvider: CloudProviderName.make("aws"),
    faasName: "docket-intake",
    deploymentEnvironment: "production",
  }),
  Browser.make({ identitySource: "self-claimed" }),
];

const refusedCountOf = (tag: TelemetryRefusalTag) =>
  Metric.value(TelemetryRefusedCounter.pipe(Metric.withAttributes({ "beep.schema_failure_tag": tag }))).pipe(
    Effect.map((state) => state.count)
  );

const refusedCount = refusedCountOf("attribute-not-allowed");

const makeRecordingTracer = () => {
  const spans: Array<Tracer.NativeSpan> = [];
  const layer = Layer.succeed(
    Tracer.Tracer,
    Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);
        return span;
      },
    })
  );
  return { spans, layer };
};

const enriched = (context: EmitterContext, requestedTier: TelemetryTier) => {
  const recording = makeRecordingTracer();
  const layer = layerCatalogEnrichment(CatalogEnrichmentOptions.make({ catalog, context, requestedTier })).pipe(
    Layer.provideMerge(recording.layer)
  );
  const run = <A, E>(effect: Effect.Effect<A, E>) =>
    Layer.build(layer).pipe(Effect.flatMap((services) => Effect.provideContext(effect, services)));
  return { spans: recording.spans, run };
};

const tracedSpan = (name: string) =>
  Effect.annotateCurrentSpan({ [allowedKey]: "late-allowed", [detailKey]: "late-detail" }).pipe(
    Effect.withSpan(name, { attributes: { [allowedKey]: "early-allowed", [detailKey]: "early-detail" } })
  );

const attributesOf = (spans: ReadonlyArray<Tracer.NativeSpan>, index: number) =>
  O.map(A.get(spans, index), (span) => span.attributes);

const overridingSpan = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ "beep.privacy_tier": "dev-verbose", "beep.family": "lab" });
  const span = yield* Effect.currentSpan;
  span.event("checkpoint", 1n, { [allowedKey]: "event" });
}).pipe(
  Effect.withSpan("Parcels.read", {
    attributes: { "beep.package": "@beep/impostor", "beep.identity_source": "vouched" },
  })
);

const stampedOf = (spans: ReadonlyArray<Tracer.NativeSpan>) =>
  O.map(attributesOf(spans, 0), (attributes) => [
    attributes.get("beep.package"),
    attributes.get("beep.family"),
    attributes.get("beep.privacy_tier"),
    attributes.get("beep.identity_source"),
  ]);

const eventsOf = (spans: ReadonlyArray<Tracer.NativeSpan>) =>
  O.map(A.get(spans, 0), (span) => A.map(span.events, ([name]) => name));

const makeEventMirror = () => {
  const mirrored: Array<string> = [];
  const layer = Layer.effect(
    Tracer.Tracer,
    Effect.map(Effect.tracer, (inner) =>
      Tracer.make({
        span: (options) => {
          const span = inner.span(options);
          const forward = span.event;
          span.event = function (this: Tracer.Span, name, startTime, attributes) {
            mirrored.push(name);
            forward.call(this, name, startTime, attributes);
          };
          return span;
        },
        context: inner.context,
      })
    )
  );
  return { mirrored, layer };
};

const runWith = <A, E>(layer: Layer.Layer<never>, effect: Effect.Effect<A, E>) =>
  Layer.build(layer).pipe(Effect.flatMap((services) => Effect.provideContext(effect, services)));

describe("layerCatalogEnrichment", () => {
  it.effect(
    "stamps package and family on a catalogued span and leaves an unknown span unstamped",
    Effect.fnUntraced(function* () {
      const { spans, run } = enriched(workstation, "standard");
      yield* run(Effect.all([tracedSpan("Parcels.read"), tracedSpan("Unknown.read")], { concurrency: 1 }));

      const known = attributesOf(spans, 0);
      const unknown = attributesOf(spans, 1);
      deepStrictEqual(
        O.map(known, (attributes) => [attributes.get("beep.package"), attributes.get("beep.family")]),
        O.some(["@beep/parcels-server", "slice"])
      );
      deepStrictEqual(
        O.map(unknown, (attributes) => [attributes.has("beep.package"), attributes.has("beep.family")]),
        O.some([false, false])
      );
    })
  );

  it.effect(
    "stamps the effective tier and identity source for every emitter context",
    Effect.fnUntraced(function* () {
      const observed = yield* Effect.forEach(
        contexts,
        (context) =>
          Effect.forEach(
            TelemetryTier.literals,
            (requestedTier) => {
              const { spans, run } = enriched(context, requestedTier);
              return run(tracedSpan("Parcels.read")).pipe(
                Effect.map(() =>
                  O.map(attributesOf(spans, 0), (attributes) => ({
                    tier: attributes.get("beep.privacy_tier"),
                    identity: attributes.get("beep.identity_source"),
                  }))
                )
              );
            },
            { concurrency: 1 }
          ),
        { concurrency: 1 }
      );

      deepStrictEqual(
        observed,
        A.map(contexts, (context) =>
          A.map(TelemetryTier.literals, (requestedTier) =>
            O.some({ tier: effectiveTier(context, requestedTier), identity: context.identitySource })
          )
        )
      );
    })
  );

  it.effect(
    "drops and counts non-allowlisted attributes under shape-only",
    Effect.fnUntraced(function* () {
      const { spans, run } = enriched(Browser.make({ identitySource: "self-claimed" }), "dev-verbose");
      const before = yield* refusedCount;
      yield* run(tracedSpan("Parcels.read"));
      const after = yield* refusedCount;

      const attributes = attributesOf(spans, 0);
      deepStrictEqual(
        O.map(attributes, (map) => [map.get(allowedKey), map.has(detailKey), map.get("beep.privacy_tier")]),
        O.some(["late-allowed", false, "shape-only"])
      );
      strictEqual(after - before, 2);
    })
  );

  it.effect(
    "drops nothing under standard",
    Effect.fnUntraced(function* () {
      const { spans, run } = enriched(
        Server.make({ identitySource: "vouched", hostName: HostName.make("api-01") }),
        "dev-verbose"
      );
      const before = yield* refusedCount;
      yield* run(tracedSpan("Parcels.read"));
      const after = yield* refusedCount;

      deepStrictEqual(
        O.map(attributesOf(spans, 0), (map) => [map.get(allowedKey), map.get(detailKey), map.get("beep.privacy_tier")]),
        O.some(["late-allowed", "late-detail", "standard"])
      );
      strictEqual(after - before, 0);
    })
  );

  it.effect(
    "ignores and counts overrides of stamped keys at shape-only and dev-verbose",
    Effect.fnUntraced(function* () {
      const strict = enriched(Browser.make({ identitySource: "self-claimed" }), "dev-verbose");
      const verbose = enriched(workstation, "dev-verbose");
      const before = yield* refusedCountOf("stamped-key-override");
      yield* strict.run(overridingSpan);
      const afterStrict = yield* refusedCountOf("stamped-key-override");
      yield* verbose.run(overridingSpan);
      const afterVerbose = yield* refusedCountOf("stamped-key-override");

      deepStrictEqual(stampedOf(strict.spans), O.some(["@beep/parcels-server", "slice", "shape-only", "self-claimed"]));
      deepStrictEqual(
        stampedOf(verbose.spans),
        O.some(["@beep/parcels-server", "slice", "dev-verbose", "self-claimed"])
      );
      strictEqual(afterStrict - before, 4);
      strictEqual(afterVerbose - afterStrict, 4);
    })
  );

  it.effect(
    "drops and counts span events under shape-only and keeps them at looser tiers",
    Effect.fnUntraced(function* () {
      const strict = enriched(StrictDesktop.make({ identitySource: "vouched" }), "standard");
      const loose = enriched(workstation, "standard");
      const before = yield* refusedCountOf("span-event-dropped");
      yield* strict.run(overridingSpan);
      const afterStrict = yield* refusedCountOf("span-event-dropped");
      yield* loose.run(overridingSpan);
      const afterLoose = yield* refusedCountOf("span-event-dropped");

      deepStrictEqual(eventsOf(strict.spans), O.some([]));
      deepStrictEqual(eventsOf(loose.spans), O.some(["checkpoint"]));
      strictEqual(afterStrict - before, 1);
      strictEqual(afterLoose - afterStrict, 0);
    })
  );

  it.effect(
    "keeps shape-only events from a wrapper composed inside it, and not from one outside it",
    Effect.fnUntraced(function* () {
      const options = CatalogEnrichmentOptions.make({
        catalog,
        context: StrictDesktop.make({ identitySource: "vouched" }),
        requestedTier: "standard",
      });
      const inside = makeEventMirror();
      const insideRecording = makeRecordingTracer();
      yield* runWith(
        layerCatalogEnrichment(options).pipe(
          Layer.provideMerge(inside.layer),
          Layer.provideMerge(insideRecording.layer)
        ),
        overridingSpan
      );
      const outside = makeEventMirror();
      const outsideRecording = makeRecordingTracer();
      yield* runWith(
        outside.layer.pipe(
          Layer.provideMerge(layerCatalogEnrichment(options)),
          Layer.provideMerge(outsideRecording.layer)
        ),
        overridingSpan
      );

      deepStrictEqual(inside.mirrored, []);
      deepStrictEqual(eventsOf(insideRecording.spans), O.some([]));
      deepStrictEqual(outside.mirrored, ["checkpoint"]);
      deepStrictEqual(eventsOf(outsideRecording.spans), O.some([]));
    })
  );

  it.effect(
    "resolves a repeated protocol span name to the same owner as packageOf",
    Effect.fnUntraced(function* () {
      const { spans, run } = enriched(workstation, "standard");
      yield* run(Effect.void.pipe(Effect.withSpan("GET /health")));

      deepStrictEqual(
        O.map(attributesOf(spans, 0), (attributes) => [attributes.get("beep.package"), attributes.get("beep.family")]),
        O.map(packageOf(catalog, "GET /health"), (resolved) => [resolved.package, resolved.family])
      );
      deepStrictEqual(
        O.map(packageOf(catalog, "GET /health"), (resolved) => resolved.package),
        PackageName.makeOption("@beep/parcels-server")
      );
    })
  );
});
