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
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

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
          const guidance = error._tag === "OntologyTierGateRefusal" ? error.guidance : "";
          expect(
            pipe(guidance, Str.toLowerCase),
            "naming a destination would let an agent map it by probing"
          ).not.toContain("destination");
          expect(
            pipe(guidance, Str.toLowerCase),
            "naming the allowlist would let an agent map it by probing"
          ).not.toContain("allow");
        })
      );
    }
  );
  it.layer(Layer.mergeAll(fileStoreLayer(sidecar), failingClientLayer(outageError)), { timeout: "30 seconds" })(
    (it) => {
      it.effect("keeps an ordinary transport failure distinguishable from a denial", () =>
        Effect.gen(function* () {
          const error = yield* publishProvenance(request).pipe(Effect.flip);

          expect(error._tag, "an outage collapsed into the refusal would hide real failures from operators").toBe(
            "OntologyToolExecutionError"
          );
          const message = error._tag === "OntologyToolExecutionError" ? error.message : "";
          expect(message, "the underlying cause is not echoed back to the agent").not.toContain("connection reset");
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
          assertFalse(attempted, "nothing leaves the machine for a file that does not exist");
        })
      );
    });
  }
});

describe("OntologyMcpPublishHandlersLive wires gatedMutation in front of publishProvenance", () => {
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
          assertFalse(
            attempted,
            "the gate refuses before the egress boundary is reached: the two controls are ordered"
          );
        })
      );
    });
  }
});
