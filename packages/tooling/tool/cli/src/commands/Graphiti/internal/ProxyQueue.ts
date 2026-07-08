/**
 * Queue and backpressure implementation for the Graphiti proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Deferred, Duration, Effect, Inspectable, Queue, Ref, Semaphore } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { HttpClient } from "effect/unstable/http";
import { isFastMcpRequestBody, readRequestBodyBytes } from "./ProxyBody.js";
import { settleForwardedResponse } from "./ProxyForwarder.js";
import { addProxyHeaders, proxyErrorResponse } from "./ProxyResponses.js";
import { ProxyQueueStats } from "./ProxySchemas.js";
import { GraphitiProxyQueueService } from "./ProxyServices.js";
import type { Scope } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { GraphitiProxyConfig } from "./ProxyConfig.js";
import type { GraphitiProxyForwarderService } from "./ProxyServices.js";

type BufferedProxyRequest = {
  readonly bodyBytes: O.Option<Uint8Array>;
  readonly request: HttpServerRequest.HttpServerRequest;
};

/**
 * Construct proxy queue service implementation.
 *
 * @param config - Runtime graphiti proxy config.
 * @param forwarderService - Forwarder service implementation.
 * @returns Effect producing queue service implementation.
 * @example
 * ```ts
 * console.log("makeGraphitiProxyQueueService")
 * ```
 * @category models
 * @since 0.0.0
 */
export const makeGraphitiProxyQueueService: {
  (
    config: GraphitiProxyConfig,
    forwarderService: GraphitiProxyForwarderService["Service"]
  ): Effect.Effect<GraphitiProxyQueueService["Service"], never, HttpClient.HttpClient | Scope.Scope>;
  (
    forwarderService: GraphitiProxyForwarderService["Service"]
  ): (
    config: GraphitiProxyConfig
  ) => Effect.Effect<GraphitiProxyQueueService["Service"], never, HttpClient.HttpClient | Scope.Scope>;
} = dual(
  2,
  Effect.fn("GraphitiProxyServices.makeGraphitiProxyQueueService")(function* (
    config: GraphitiProxyConfig,
    forwarderService: GraphitiProxyForwarderService["Service"]
  ): Effect.fn.Return<GraphitiProxyQueueService["Service"], never, HttpClient.HttpClient | Scope.Scope> {
    const httpClient = yield* HttpClient.HttpClient;
    const queue = yield* Queue.dropping<{
      readonly proxyRequest: BufferedProxyRequest;
      readonly responseDeferred: Deferred.Deferred<HttpServerResponse.HttpServerResponse>;
    }>(config.maxQueue);

    const acceptingRef = yield* Ref.make(true);
    const activeRef = yield* Ref.make(0);
    const peakQueueDepthRef = yield* Ref.make(0);
    const processedRef = yield* Ref.make(0);
    const failedRef = yield* Ref.make(0);
    const rejectedRef = yield* Ref.make(0);
    const drainDeferred = yield* Deferred.make<void>();
    // Bound every upstream forward (queued workers and the fast lane alike) to
    // the configured concurrency so fast-lane requests cannot open unbounded
    // concurrent upstream connections outside the serialized worker pool.
    const forwardSemaphore = yield* Semaphore.make(config.concurrency);

    const forwardProxyRequest = (proxyRequest: BufferedProxyRequest) =>
      forwarderService.forward(proxyRequest.request, proxyRequest.bodyBytes).pipe(
        Effect.provideService(HttpClient.HttpClient, httpClient),
        Effect.catchDefect(
          Effect.fnUntraced(function* (cause) {
            yield* Ref.update(failedRef, (failed) => failed + 1);
            return proxyErrorResponse("upstream_failure", Inspectable.toStringUnknown(cause, 0), { status: 502 });
          })
        )
      );

    const checkDrain = Effect.fnUntraced(function* () {
      const accepting = yield* Ref.get(acceptingRef);
      if (accepting) {
        return;
      }

      const active = yield* Ref.get(activeRef);
      const queued = yield* Queue.size(queue);
      if (active === 0 && queued === 0) {
        yield* Queue.shutdown(queue).pipe(Effect.ignore);
        yield* Deferred.succeed(drainDeferred, undefined).pipe(Effect.ignore);
      }
    });

    // Forward a request while holding both an active-count and a concurrency
    // permit for the full lifetime of the proxied response. For streaming
    // MCP/SSE bodies the slot is released only when the response body stream
    // closes, errors, or is interrupted, so a flood of never-ending streams
    // cannot bypass `GRAPHITI_PROXY_CONCURRENCY` while reporting zero `active`.
    const forwardWithSlot: (
      proxyRequest: BufferedProxyRequest
    ) => Effect.Effect<HttpServerResponse.HttpServerResponse> = Effect.fnUntraced(function* (proxyRequest) {
      yield* Ref.update(activeRef, (active) => active + 1);
      yield* forwardSemaphore.take(1);

      const releasedRef = yield* Ref.make(false);
      const releaseSlot = Effect.gen(function* () {
        const alreadyReleased = yield* Ref.getAndSet(releasedRef, true);
        if (alreadyReleased) {
          return;
        }
        yield* forwardSemaphore.release(1);
        yield* Ref.update(activeRef, (active) => (active > 0 ? active - 1 : 0));
        yield* checkDrain();
      });

      const response = yield* forwardProxyRequest(proxyRequest).pipe(Effect.onInterrupt(() => releaseSlot));
      return yield* settleForwardedResponse(response, releaseSlot);
    });

    const worker = Effect.forever(
      Effect.gen(function* () {
        const job = yield* Queue.take(queue);

        const response = yield* forwardWithSlot(job.proxyRequest);

        const queued = yield* Queue.size(queue);
        const active = yield* Ref.get(activeRef);

        const responseWithHeaders = addProxyHeaders(response, { active, lane: "queued", queued });

        yield* Deferred.succeed(job.responseDeferred, responseWithHeaders).pipe(Effect.ignore);
        yield* Ref.update(processedRef, (processed) => processed + 1);
      })
    ).pipe(Effect.catchDefect(() => Effect.void));

    const workerSlots = A.range(1, config.concurrency);
    yield* Effect.forEach(workerSlots, () => worker.pipe(Effect.forkScoped), {
      concurrency: "unbounded",
    });

    const enqueue: (
      request: HttpServerRequest.HttpServerRequest
    ) => Effect.Effect<HttpServerResponse.HttpServerResponse> = Effect.fnUntraced(function* (request) {
      const accepting = yield* Ref.get(acceptingRef);
      if (!accepting) {
        return proxyErrorResponse("shutting_down", "Graphiti proxy is shutting down.", {
          status: 503,
          headers: {
            "retry-after": "1",
          },
        });
      }

      // Fail closed on disallowed targets (absolute-form / non-/mcp) before the
      // request body is buffered, so rejected paths never allocate memory.
      const targetRejection = forwarderService.rejectDisallowedTarget(request);
      if (O.isSome(targetRejection)) {
        return targetRejection.value.response;
      }

      const bodyOutcome = yield* readRequestBodyBytes(request, config.maxBodyBytes);
      if (bodyOutcome._tag === "ReadError") {
        return proxyErrorResponse("upstream_failure", Inspectable.toStringUnknown(bodyOutcome.cause, 0), {
          status: 400,
        });
      }
      if (bodyOutcome._tag === "Oversized") {
        yield* Ref.update(rejectedRef, (rejected) => rejected + 1);
        return proxyErrorResponse(
          "payload_too_large",
          `Graphiti proxy rejected request body exceeding ${config.maxBodyBytes} bytes.`,
          { status: 413 }
        );
      }
      const proxyRequest: BufferedProxyRequest = {
        bodyBytes: bodyOutcome.bodyBytes,
        request,
      };

      if (isFastMcpRequestBody(proxyRequest.bodyBytes)) {
        const response = yield* forwardWithSlot(proxyRequest);
        yield* Ref.update(processedRef, (processed) => processed + 1);
        const queued = yield* Queue.size(queue);
        const active = yield* Ref.get(activeRef);
        return addProxyHeaders(response, { active, lane: "fast", queued });
      }

      const responseDeferred = yield* Deferred.make<HttpServerResponse.HttpServerResponse>();
      const offered = yield* Queue.offer(queue, {
        proxyRequest,
        responseDeferred,
      });

      if (!offered) {
        yield* Ref.update(rejectedRef, (rejected) => rejected + 1);
        return proxyErrorResponse("queue_full", `Graphiti proxy queue full (max ${config.maxQueue})`, {
          status: 503,
          headers: {
            "retry-after": "1",
          },
        });
      }

      const queued = yield* Queue.size(queue);
      yield* Ref.update(peakQueueDepthRef, (peak) => (queued > peak ? queued : peak));

      return yield* Deferred.await(responseDeferred);
    });

    const snapshot = Effect.gen(function* () {
      const queued = yield* Queue.size(queue);
      const active = yield* Ref.get(activeRef);
      const peakQueueDepth = yield* Ref.get(peakQueueDepthRef);
      const processed = yield* Ref.get(processedRef);
      const failed = yield* Ref.get(failedRef);
      const rejected = yield* Ref.get(rejectedRef);

      return ProxyQueueStats.make({
        active,
        queued,
        peakQueueDepth,
        processed,
        failed,
        rejected,
        concurrency: config.concurrency,
        maxQueue: config.maxQueue,
        upstream: config.upstream,
      });
    });

    const beginShutdown = Ref.set(acceptingRef, false).pipe(Effect.andThen(checkDrain()));

    const awaitDrain = (timeoutMs: number): Effect.Effect<boolean> =>
      Deferred.await(drainDeferred).pipe(Effect.timeoutOption(Duration.millis(timeoutMs)), Effect.map(O.isSome));

    return GraphitiProxyQueueService.of({
      enqueue,
      snapshot,
      beginShutdown,
      awaitDrain,
    });
  })
);
