import { EgressDenied } from "@beep/api-transport";
import { TierGate, TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit";
import { OntologyMcpPublishHandlersLive, publishProvenance } from "@beep/ontology-server/tools";
import {
  OntologyFilePath,
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import {
  OntologyPublishToolkit,
  PublishProvenanceRequest,
  PublishProvenanceTool,
} from "@beep/ontology-use-cases/tools";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

const provPath = OntologyFilePath.make("ontology.prov.ttl");
const sidecar = "@prefix prov: <http://www.w3.org/ns/prov#> .\nex:x a prov:Entity .\n";

const request = PublishProvenanceRequest.make({
  provPath,
  destination: "https://registry.example/v1/provenance",
});

const fileStoreLayer = (source: string) =>
  Layer.succeed(OntologyFileStore, {
    read: () => Effect.succeed(ReadOntologyFileResult.make({ path: provPath, source })),
    write: () => Effect.void,
  } as unknown as typeof OntologyFileStore.Service);

const missingFileStoreLayer = Layer.succeed(OntologyFileStore, {
  read: () => Effect.fail(OntologyFileStoreError.make({ path: provPath, message: "missing", reason: "notFound" })),
  write: () => Effect.void,
} as unknown as typeof OntologyFileStore.Service);

// A client whose execute always fails with the given reason, so the error
// translation can be driven without a transport.
const failingClientLayer = (reason: HttpClientError.HttpClientError["reason"]) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.fail(new HttpClientError.HttpClientError({ reason })))
  );

const okClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response("stored", { status: 202 })))
  )
);

// Build the layer and provide its Context, mirroring `OntologyTools.test.ts`.
// `Effect.provide(layer)` outside an entry point is what `strictEffectProvide`
// exists to catch, and it would break scope lifetimes here.
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const egressDenial = EgressDenied.make({});

const transportErrorWith = (cause: unknown) =>
  new HttpClientError.TransportError({
    request: HttpClientRequest.post(request.destination),
    cause,
  });

// Hoisted so the call sites stay one level deep; nesting them trips
// `missedPipeableOpportunity`.
const egressDenialError = transportErrorWith(egressDenial);
const outageError = transportErrorWith(new Error("connection reset"));

describe("publishProvenance", () => {
  it.effect("publishes the sidecar and reports what was sent", () =>
    Effect.gen(function* () {
      const result = yield* publishProvenance(request).pipe(
        provideScopedLayer(Layer.mergeAll(fileStoreLayer(sidecar), okClientLayer))
      );

      expect(result.status).toBe(202);
      expect(result.publishedBytes).toBe(sidecar.length);
      expect(result.provPath).toBe(provPath);
    })
  );

  it.effect("flattens a governed egress denial into the reason-free refusal", () =>
    Effect.gen(function* () {
      const error = yield* publishProvenance(request).pipe(
        provideScopedLayer(Layer.mergeAll(fileStoreLayer(sidecar), failingClientLayer(egressDenialError))),
        Effect.flip
      );

      expect(error._tag).toBe("OntologyTierGateRefusal");
      // Reason-free: the guidance must say nothing about destinations or
      // allowlists, or an agent could map the allowlist by probing it.
      const guidance = error._tag === "OntologyTierGateRefusal" ? error.guidance : "";
      expect(guidance.toLowerCase()).not.toContain("destination");
      expect(guidance.toLowerCase()).not.toContain("allow");
    })
  );

  it.effect("keeps an ordinary transport failure distinguishable from a denial", () =>
    Effect.gen(function* () {
      // The sibling of the test above, and the reason it is not vacuous: if the
      // translation collapsed *every* transport failure into the refusal, a
      // denial would be indistinguishable from a network outage — which is the
      // opposite of the property, and would hide real failures from operators.
      const error = yield* publishProvenance(request).pipe(
        provideScopedLayer(Layer.mergeAll(fileStoreLayer(sidecar), failingClientLayer(outageError))),
        Effect.flip
      );

      expect(error._tag).toBe("OntologyToolExecutionError");
      // It also must not echo the underlying cause back to the agent.
      const message = error._tag === "OntologyToolExecutionError" ? error.message : "";
      expect(message).not.toContain("connection reset");
    })
  );

  it.effect("fails typed when the sidecar cannot be read, without attempting egress", () =>
    Effect.gen(function* () {
      let attempted = false;
      const watchingClient = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((httpRequest) => {
          attempted = true;
          return Effect.succeed(HttpClientResponse.fromWeb(httpRequest, new Response("", { status: 200 })));
        })
      );
      const error = yield* publishProvenance(request).pipe(
        provideScopedLayer(Layer.mergeAll(missingFileStoreLayer, watchingClient)),
        Effect.flip
      );

      expect(error._tag).toBe("OntologyToolExecutionError");
      // Nothing left the machine for a file that does not exist.
      expect(attempted).toBe(false);
    })
  );
});

// Dispatching through the real handler layer, rather than calling
// `publishProvenance` directly, is what proves the layer wires the gate in at
// all: a layer that forgot `gatedMutation` would still pass every test above.
describe("OntologyMcpPublishHandlersLive", () => {
  const refusingGate = Layer.succeed(
    TierGate,
    TierGate.of({
      evaluate: Effect.fn("OntologyPublishToolsTest.evaluate")(function* () {
        return TierGateVerdict.make({
          audit: TierGateAuditRecord.make({
            destructive: true,
            occurredAt: "2026-07-27T00:00:00.000Z",
            outcome: "refused",
            reason: "This action is not authorized for this session.",
            tool: PublishProvenanceTool.name,
            toolCallId: O.none(),
          }),
          verdict: "refused",
        });
      }),
      recordOutcome: Effect.fn("OntologyPublishToolsTest.recordOutcome")(function* () {}),
    })
  );

  it.effect("refuses at the gate before any egress is attempted", () =>
    Effect.gen(function* () {
      let attempted = false;
      const watchingClient = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((httpRequest) => {
          attempted = true;
          return Effect.succeed(HttpClientResponse.fromWeb(httpRequest, new Response("", { status: 200 })));
        })
      );
      const handlers = OntologyMcpPublishHandlersLive.pipe(
        Layer.provide(Layer.mergeAll(fileStoreLayer(sidecar), watchingClient, refusingGate))
      );
      const built = yield* OntologyPublishToolkit.pipe(provideScopedLayer(handlers));
      const result = yield* built
        .handle("ontology_publish_provenance", { provPath, destination: request.destination })
        .pipe(Stream.unwrap, Stream.run(Sink.last()), Effect.flatMap(Effect.fromOption));

      expect(result.isFailure).toBe(true);
      // The gate refused, so the tool never reached the egress boundary — the
      // two controls are ordered, not redundant.
      expect(attempted).toBe(false);
    })
  );
});
