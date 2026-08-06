import { EvidenceAnchor } from "@beep/semantic-web/evidence";
import { ProvO } from "@beep/semantic-web/prov";
import {
  ExportProvenanceRequest,
  ProjectProvenanceRequest,
  ProvenanceService,
  ProvenanceServiceLive,
  SummarizeProvenanceRequest,
} from "@beep/semantic-web/services/provenance";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const rawAnchor = {
  id: "https://example.com/evidence/1",
  target: {
    selector: {
      exact: "Alice",
      kind: "text-quote",
    },
    source: "https://example.com/documents/1",
  },
} as const;

const rawBundle = {
  lifecycle: {
    observedAt: "2026-03-08T12:00:00Z",
  },
  records: [
    {
      id: "thing:alice",
      provType: "Entity",
    },
    {
      id: "activity:ingest",
      provType: "Activity",
    },
    {
      id: "agent:semantic-web",
      provType: "SoftwareAgent",
    },
  ],
} as const;

const runProvenance = <A, E>(effect: Effect.Effect<A, E, ProvenanceService>) =>
  Effect.runPromise(effect.pipe(provideScopedLayer(ProvenanceServiceLive), Effect.orDie));

describe("Provenance", () => {
  it("decodes the bounded semantic-web ProvO surface", () => {
    const decoded = decodeUnknownSync(ProvO)(rawBundle);

    expect("records" in decoded).toBe(true);
    if ("records" in decoded) {
      expect(decoded.records).toHaveLength(3);
      expect(O.isSome(decoded.lifecycle)).toBe(true);
    }
  });

  it.effect("rejects bounded projections without evidence anchors when records are present", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(
          runProvenance(
            Effect.gen(function* () {
              const service = yield* ProvenanceService;
              return yield* service.project(
                decodeUnknownSync(ProjectProvenanceRequest)({
                  anchors: [],
                  bundle: rawBundle,
                  maxItems: 2,
                })
              );
            })
          )
        ).rejects.toThrow("Bounded provenance projections require explicit evidence anchors.")
      )
    )
  );

  it.effect("summarizes record counts and preserves lifecycle fields in bounded projections", () =>
    Effect.gen(function* () {
      const summary = yield* Effect.promise(() =>
        Promise.resolve(
          runProvenance(
            Effect.gen(function* () {
              const service = yield* ProvenanceService;
              return yield* service.summarize(
                decodeUnknownSync(SummarizeProvenanceRequest)({
                  anchors: [rawAnchor],
                  bundle: rawBundle,
                })
              );
            })
          )
        )
      );

      expect(summary.recordCount).toBe(3);
      expect(summary.entityCount).toBe(1);
      expect(summary.activityCount).toBe(1);
      expect(summary.agentCount).toBe(1);
      expect(summary.anchorCount).toBe(1);

      const projection = yield* Effect.promise(() =>
        Promise.resolve(
          runProvenance(
            Effect.gen(function* () {
              const service = yield* ProvenanceService;
              return yield* service.project(
                decodeUnknownSync(ProjectProvenanceRequest)({
                  anchors: [rawAnchor],
                  bundle: rawBundle,
                  maxItems: 1,
                })
              );
            })
          )
        )
      );

      expect(projection.truncated).toBe(true);
      expect(projection.bundle.records).toHaveLength(1);
      expect(projection.evidence.anchors).toHaveLength(1);
      expect(O.isSome(projection.bundle.lifecycle)).toBe(true);
    })
  );

  it.effect("rejects extension-tier exports from the core-only profile", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(
          runProvenance(
            Effect.gen(function* () {
              const service = yield* ProvenanceService;
              return yield* service.exportBundle(
                decodeUnknownSync(ExportProvenanceRequest)({
                  anchors: [rawAnchor],
                  bundle: {
                    records: [
                      {
                        id: "plan:1",
                        provType: "Plan",
                      },
                    ],
                  },
                  maxItems: 5,
                  profile: "prov-core-v1",
                })
              );
            })
          )
        ).rejects.toThrow("prov-core-v1 does not include extension-tier provenance records.")
      )
    )
  );

  it.effect("rejects extension-tier relations from the core-only profile", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(
          runProvenance(
            Effect.gen(function* () {
              const service = yield* ProvenanceService;
              return yield* service.exportBundle(
                decodeUnknownSync(ExportProvenanceRequest)({
                  anchors: [rawAnchor],
                  bundle: {
                    records: [
                      {
                        agent: "agent:semantic-web",
                        entity: "thing:alice",
                      },
                    ],
                  },
                  maxItems: 5,
                  profile: "prov-core-v1",
                })
              );
            })
          )
        ).rejects.toThrow("prov-core-v1 does not include extension-tier provenance records.")
      )
    )
  );

  it("decodes evidence anchors through the public surface", () => {
    const anchor = decodeUnknownSync(EvidenceAnchor)(rawAnchor);

    expect(anchor.id).toBe("https://example.com/evidence/1");
    expect(anchor.target.source).toBe("https://example.com/documents/1");
  });
});
