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
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, Match, pipe, Sink, Stream } from "effect";
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as O from "effect/Option";

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
  {
    let sentRequest = O.none<HttpClientRequest.HttpClientRequest>();
    const okClientLayer = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request) => {
        sentRequest = O.some(request);
        return Effect.succeed(HttpClientResponse.fromWeb(request, new Response("stored", { status: 202 })));
      })
    );
    it.layer(Layer.mergeAll(fileStoreLayer(sidecar), okClientLayer), { timeout: "30 seconds" })((it) => {
      it.effect("publishes the sidecar and reports what was sent", () =>
        Effect.gen(function* () {
          sentRequest = O.none();
          const result = yield* publishProvenance(request);

          expect(result.status).toBe(202);
          expect(result.publishedBytes).toBe(sidecar.length);
          expect(result.provPath).toBe(provPath);

          const sent = O.getOrThrow(sentRequest);
          expect(sent.method).toBe("POST");
          expect(sent.url).toBe(request.destination);
          expect(sent.headers["content-type"]).toBe("text/turtle");
          const sentText = Match.value(sent.body).pipe(
            Match.tag("Uint8Array", (body) => new TextDecoder().decode(body.body)),
            Match.orElse(() => undefined)
          );
          expect(sentText).toBe(sidecar);
        })
      );
    });
  }
  it.layer(Layer.mergeAll(fileStoreLayer(sidecar), failingClientLayer(egressDenialError)), { timeout: "30 seconds" })(
    (it) => {
      it.effect("flattens a governed egress denial into the reason-free refusal", () =>
        Effect.gen(function* () {
          const error = yield* publishProvenance(request).pipe(Effect.flip);

          expect(error._tag).toBe("OntologyTierGateRefusal");
          // Reason-free: the guidance must say nothing about destinations or
          // allowlists, or an agent could map the allowlist by probing it.
          const guidance = error._tag === "OntologyTierGateRefusal" ? error.guidance : "";
          expect(guidance.toLowerCase()).not.toContain("destination");
          expect(guidance.toLowerCase()).not.toContain("allow");
        })
      );
    }
  );
  it.layer(Layer.mergeAll(fileStoreLayer(sidecar), failingClientLayer(outageError)), { timeout: "30 seconds" })(
    (it) => {
      it.effect("keeps an ordinary transport failure distinguishable from a denial", () =>
        Effect.gen(function* () {
          // The sibling of the test above, and the reason it is not vacuous: if the
          // translation collapsed *every* transport failure into the refusal, a
          // denial would be indistinguishable from a network outage — which is the
          // opposite of the property, and would hide real failures from operators.
          const error = yield* publishProvenance(request).pipe(Effect.flip);

          expect(error._tag).toBe("OntologyToolExecutionError");
          // It also must not echo the underlying cause back to the agent.
          const message = error._tag === "OntologyToolExecutionError" ? error.message : "";
          expect(message).not.toContain("connection reset");
        })
      );
    }
  );

  {
    let attempted = false;
    const watchingClient = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((httpRequest) => {
        attempted = true;
        return Effect.succeed(HttpClientResponse.fromWeb(httpRequest, new Response("", { status: 200 })));
      })
    );
    it.layer(Layer.mergeAll(missingFileStoreLayer, watchingClient), { timeout: "30 seconds" })((it) => {
      it.effect("fails typed when the sidecar cannot be read, without attempting egress", () =>
        Effect.gen(function* () {
          attempted = false;
          const error = yield* publishProvenance(request).pipe(Effect.flip);

          expect(error._tag).toBe("OntologyToolExecutionError");
          // Nothing left the machine for a file that does not exist.
          pipe(attempted, assertFalse);
        })
      );
    });
  }
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

  {
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
    it.layer(handlers, { timeout: "30 seconds" })((it) => {
      it.effect("refuses at the gate before any egress is attempted", () =>
        Effect.gen(function* () {
          attempted = false;
          const built = yield* OntologyPublishToolkit;
          const result = yield* built
            .handle("ontology_publish_provenance", { provPath, destination: request.destination })
            .pipe(Stream.unwrap, Stream.run(Sink.last()), Effect.flatMap(Effect.fromOption));

          pipe(result.isFailure, assertTrue);
          // The gate refused, so the tool never reached the egress boundary — the
          // two controls are ordered, not redundant.
          pipe(attempted, assertFalse);
        })
      );
    });
  }
});
